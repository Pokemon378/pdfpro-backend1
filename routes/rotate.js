const express = require('express');
const { PDFDocument, degrees } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { cleanupFiles, validatePDF } = require('../utils/pdfUtils');

module.exports = (upload) => {
    const router = express.Router();

    router.post('/', upload.array('files', 50), async (req, res) => {
        try {
            const files = req.files || (req.file ? [req.file] : []);
            if (files.length === 0) {
                return res.status(400).json({ error: 'Please upload at least one PDF file' });
            }

            const { angle = 90, pages } = req.body;
            const filePaths = files.map(f => f.path);
            const tempFiles = [];

            // Parse angle
            let rotationAngle = degrees(Number(angle));
            if (![90, 180, 270].includes(Number(angle))) {
                rotationAngle = degrees(90);
            }

            // Process single file
            if (files.length === 1) {
                const file = files[0];
                const filePath = file.path;

                // Validate PDF
                const validation = validatePDF(filePath);
                if (!validation.valid) {
                    cleanupFiles([filePath]);
                    return res.status(400).json({ error: 'Invalid PDF file' });
                }

                const pdfBytes = fs.readFileSync(filePath);
                const pdf = await PDFDocument.load(pdfBytes);
                const totalPages = pdf.getPageCount();

                // Determine which pages to rotate
                let pagesToRotate = [];
                if (pages) {
                    const pagesArray = pages.split(',').map(p => p.trim()).filter(p => p.length > 0);
                    const seenPages = new Set();
                    pagesArray.forEach(p => {
                        const page = Number(p);
                        if (!isNaN(page) && page >= 1 && page <= totalPages) {
                            const pageIndex = page - 1;
                            if (!seenPages.has(pageIndex)) {
                                pagesToRotate.push(pageIndex);
                                seenPages.add(pageIndex);
                            }
                        }
                    });
                } else {
                    // Rotate all pages
                    pagesToRotate = Array.from({ length: totalPages }, (_, i) => i);
                }

                if (pagesToRotate.length === 0) {
                    cleanupFiles([filePath]);
                    return res.status(400).json({ error: 'No valid pages to rotate' });
                }

                // Rotate pages
                pagesToRotate.forEach(pageIndex => {
                    const page = pdf.getPage(pageIndex);
                    page.setRotation(degrees(page.getRotation().angle + rotationAngle.angle));
                });

                const rotatedBytes = await pdf.save();
                const outputPath = path.join(__dirname, '../uploads', `rotated-${Date.now()}.pdf`);
                fs.writeFileSync(outputPath, rotatedBytes);

                cleanupFiles([filePath]);

                res.download(outputPath, 'rotated.pdf', (err) => {
                    if (err) {
                        console.error('Download error:', err);
                    }
                    setTimeout(() => cleanupFiles([outputPath]), 5000);
                });
            } else {
                // Process multiple files - create zip
                const zipPath = path.join(__dirname, '../uploads', `rotated-${Date.now()}.zip`);
                const output = fs.createWriteStream(zipPath);
                const archive = archiver('zip', { zlib: { level: 9 } });

                archive.pipe(output);

                archive.on('error', (err) => {
                    console.error('Archive error:', err);
                    cleanupFiles([...filePaths, ...tempFiles]);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Failed to create zip file: ' + err.message });
                    }
                });

                for (const file of files) {
                    const filePath = file.path;

                    // Validate PDF
                    const validation = validatePDF(filePath);
                    if (!validation.valid) {
                        continue;
                    }

                    try {
                        const pdfBytes = fs.readFileSync(filePath);
                        const pdf = await PDFDocument.load(pdfBytes);
                        const totalPages = pdf.getPageCount();

                        // Determine which pages to rotate
                        let pagesToRotate = [];
                        if (pages) {
                            const pagesArray = pages.split(',').map(p => p.trim()).filter(p => p.length > 0);
                            const seenPages = new Set();
                            pagesArray.forEach(p => {
                                const page = Number(p);
                                if (!isNaN(page) && page >= 1 && page <= totalPages) {
                                    const pageIndex = page - 1;
                                    if (!seenPages.has(pageIndex)) {
                                        pagesToRotate.push(pageIndex);
                                        seenPages.add(pageIndex);
                                    }
                                }
                            });
                        } else {
                            pagesToRotate = Array.from({ length: totalPages }, (_, i) => i);
                        }

                        // Rotate pages
                        pagesToRotate.forEach(pageIndex => {
                            const page = pdf.getPage(pageIndex);
                            page.setRotation(degrees(page.getRotation().angle + rotationAngle.angle));
                        });

                        const rotatedBytes = await pdf.save();
                        const tempPath = path.join(__dirname, '../uploads', `temp-rotated-${Date.now()}-${file.originalname}`);
                        fs.writeFileSync(tempPath, rotatedBytes);
                        tempFiles.push(tempPath);

                        archive.file(tempPath, { name: `rotated-${file.originalname}` });
                    } catch (err) {
                        console.error(`Error processing ${file.originalname}:`, err);
                    }
                }

                await archive.finalize();
                cleanupFiles(filePaths);

                output.on('close', () => {
                    res.download(zipPath, 'rotated-pdfs.zip', (err) => {
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
                    cleanupFiles([...filePaths, zipPath, ...tempFiles]);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Failed to create zip file: ' + err.message });
                    }
                });
            }
        } catch (error) {
            console.error('Rotate error:', error);
            if (req.files && req.files.length > 0) {
                const filePaths = req.files.map(f => f.path);
                cleanupFiles(filePaths);
            }
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to rotate PDF: ' + error.message });
            }
        }
    });

    return router;
};

