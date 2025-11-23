const express = require('express');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { cleanupFiles, validatePDF, getFileSize } = require('../utils/pdfUtils');

module.exports = (upload) => {
    const router = express.Router();

    router.post('/', upload.array('files', 50), async (req, res) => {
        try {
            const files = req.files || (req.file ? [req.file] : []);
            if (files.length === 0) {
                return res.status(400).json({ error: 'Please upload at least one PDF file' });
            }

            const { quality = 'medium' } = req.body;
            const filePaths = files.map(f => f.path);
            const tempFiles = [];

            // Set compression based on quality
            let saveOptions = {};
            if (quality === 'high') {
                saveOptions = { useObjectStreams: false };
            } else if (quality === 'low') {
                saveOptions = { useObjectStreams: true, updateMetadata: false };
            } else {
                saveOptions = { useObjectStreams: true };
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

                // Compress by removing metadata and optimizing
                const compressedPdf = await PDFDocument.create();
                const pages = await compressedPdf.copyPages(pdf, pdf.getPageIndices());
                pages.forEach((page) => compressedPdf.addPage(page));

                const compressedBytes = await compressedPdf.save(saveOptions);
                const outputPath = path.join(__dirname, '../uploads', `compressed-${Date.now()}.pdf`);
                fs.writeFileSync(outputPath, compressedBytes);

                cleanupFiles([filePath]);

                res.download(outputPath, 'compressed.pdf', (err) => {
                    if (err) {
                        console.error('Download error:', err);
                    }
                    setTimeout(() => cleanupFiles([outputPath]), 5000);
                });
            } else {
                // Process multiple files - create zip
                const zipPath = path.join(__dirname, '../uploads', `compressed-${Date.now()}.zip`);
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

                        // Compress by removing metadata and optimizing
                        const compressedPdf = await PDFDocument.create();
                        const pages = await compressedPdf.copyPages(pdf, pdf.getPageIndices());
                        pages.forEach((page) => compressedPdf.addPage(page));

                        const compressedBytes = await compressedPdf.save(saveOptions);
                        const tempPath = path.join(__dirname, '../uploads', `temp-compressed-${Date.now()}-${file.originalname}`);
                        fs.writeFileSync(tempPath, compressedBytes);
                        tempFiles.push(tempPath);

                        archive.file(tempPath, { name: `compressed-${file.originalname}` });
                    } catch (err) {
                        console.error(`Error processing ${file.originalname}:`, err);
                    }
                }

                await archive.finalize();
                cleanupFiles(filePaths);

                output.on('close', () => {
                    res.download(zipPath, 'compressed-pdfs.zip', (err) => {
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
            console.error('Compress error:', error);
            if (req.files && req.files.length > 0) {
                const filePaths = req.files.map(f => f.path);
                cleanupFiles(filePaths);
            }
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to compress PDF: ' + error.message });
            }
        }
    });

    return router;
};

