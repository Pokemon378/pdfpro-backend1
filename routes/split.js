const express = require('express');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { cleanupFiles, validatePDF } = require('../utils/pdfUtils');

module.exports = (upload) => {
    const router = express.Router();

    router.post('/', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Please upload a PDF file' });
            }

            const { pages, ranges } = req.body;
            const filePath = req.file.path;

            // Validate PDF
            const validation = validatePDF(filePath);
            if (!validation.valid) {
                cleanupFiles([filePath]);
                return res.status(400).json({ error: 'Invalid PDF file' });
            }

            const pdfBytes = fs.readFileSync(filePath);
            const sourcePdf = await PDFDocument.load(pdfBytes);
            const totalPages = sourcePdf.getPageCount();

            let pageRanges = [];

            if (ranges) {
                // Parse ranges like "1-3,5,7-9" or individual pages like "1,3,5"
                const rangeArray = ranges.split(',').map(r => r.trim()).filter(r => r.length > 0);
                const seenPages = new Set();
                
                rangeArray.forEach(range => {
                    if (range.includes('-')) {
                        const parts = range.split('-').map(p => p.trim());
                        if (parts.length !== 2) {
                            cleanupFiles([filePath]);
                            return res.status(400).json({ error: `Invalid range format: ${range}. Use format like "1-3"` });
                        }
                        const start = Number(parts[0]);
                        const end = Number(parts[1]);
                        
                        if (isNaN(start) || isNaN(end)) {
                            cleanupFiles([filePath]);
                            return res.status(400).json({ error: `Invalid range: ${range}. Must contain numbers` });
                        }
                        
                        if (start > end) {
                            cleanupFiles([filePath]);
                            return res.status(400).json({ error: `Invalid range: ${range}. Start page must be less than or equal to end page` });
                        }
                        
                        for (let i = start; i <= end; i++) {
                            if (i >= 1 && i <= totalPages) {
                                const pageIndex = i - 1;
                                if (!seenPages.has(pageIndex)) {
                                    pageRanges.push(pageIndex);
                                    seenPages.add(pageIndex);
                                }
                            }
                        }
                    } else {
                        const page = Number(range.trim());
                        if (isNaN(page)) {
                            cleanupFiles([filePath]);
                            return res.status(400).json({ error: `Invalid page number: ${range}` });
                        }
                        if (page >= 1 && page <= totalPages) {
                            const pageIndex = page - 1;
                            if (!seenPages.has(pageIndex)) {
                                pageRanges.push(pageIndex);
                                seenPages.add(pageIndex);
                            }
                        }
                    }
                });
            } else if (pages) {
                // Individual pages (backward compatibility)
                const pagesArray = pages.split(',').map(p => p.trim()).filter(p => p.length > 0);
                const seenPages = new Set();
                pagesArray.forEach(p => {
                    const page = Number(p);
                    if (!isNaN(page) && page >= 1 && page <= totalPages) {
                        const pageIndex = page - 1;
                        if (!seenPages.has(pageIndex)) {
                            pageRanges.push(pageIndex);
                            seenPages.add(pageIndex);
                        }
                    }
                });
            } else {
                // Split into individual pages
                pageRanges = Array.from({ length: totalPages }, (_, i) => i);
            }

            if (pageRanges.length === 0) {
                cleanupFiles([filePath]);
                return res.status(400).json({ error: 'No valid pages selected' });
            }

            // If single page range, return single PDF
            if (pageRanges.length === 1) {
                const newPdf = await PDFDocument.create();
                const [page] = await newPdf.copyPages(sourcePdf, [pageRanges[0]]);
                newPdf.addPage(page);
                const pdfBytes = await newPdf.save();
                const outputPath = path.join(__dirname, '../uploads', `split-${Date.now()}.pdf`);
                fs.writeFileSync(outputPath, pdfBytes);
                cleanupFiles([filePath]);
                res.download(outputPath, 'split.pdf', () => {
                    setTimeout(() => cleanupFiles([outputPath]), 5000);
                });
            } else {
                // Multiple pages - create zip with individual PDFs
                const zipPath = path.join(__dirname, '../uploads', `split-${Date.now()}.zip`);
                const output = fs.createWriteStream(zipPath);
                const archive = archiver('zip', { zlib: { level: 9 } });
                const tempFiles = [];

                archive.pipe(output);

                // Handle archive errors
                archive.on('error', (err) => {
                    console.error('Archive error:', err);
                    cleanupFiles([filePath, ...tempFiles]);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Failed to create zip file: ' + err.message });
                    }
                });

                try {
                    for (let i = 0; i < pageRanges.length; i++) {
                        const newPdf = await PDFDocument.create();
                        const [page] = await newPdf.copyPages(sourcePdf, [pageRanges[i]]);
                        newPdf.addPage(page);
                        const pdfBytes = await newPdf.save();
                        const tempPath = path.join(__dirname, '../uploads', `temp-${Date.now()}-${i}.pdf`);
                        fs.writeFileSync(tempPath, pdfBytes);
                        tempFiles.push(tempPath);
                        archive.file(tempPath, { name: `page-${pageRanges[i] + 1}.pdf` });
                    }

                    await archive.finalize();
                    cleanupFiles([filePath]);

                    output.on('close', () => {
                        res.download(zipPath, 'split-pages.zip', (err) => {
                            if (err) {
                                console.error('Download error:', err);
                            }
                            setTimeout(() => {
                                cleanupFiles([zipPath, ...tempFiles]);
                            }, 5000);
                        });
                    });

                    output.on('error', (err) => {
                        console.error('Output stream error:', err);
                        cleanupFiles([filePath, zipPath, ...tempFiles]);
                        if (!res.headersSent) {
                            res.status(500).json({ error: 'Failed to create zip file: ' + err.message });
                        }
                    });
                } catch (err) {
                    cleanupFiles([filePath, ...tempFiles]);
                    throw err;
                }
            }
        } catch (error) {
            console.error('Split error:', error);
            res.status(500).json({ error: 'Failed to split PDF: ' + error.message });
        }
    });

    return router;
};

