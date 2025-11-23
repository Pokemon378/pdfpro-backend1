const express = require('express');
const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { cleanupFiles, validatePDF } = require('../utils/pdfUtils');

module.exports = (upload) => {
    const router = express.Router();

    router.post('/', upload.fields([
        { name: 'files', maxCount: 50 },
        { name: 'file', maxCount: 1 }
    ]), async (req, res) => {
        try {
            // Handle both 'files' (array) and 'file' (single) for compatibility
            const files = req.files?.files || (req.files?.file ? [req.files.file[0]] : []);
            if (files.length === 0) {
                return res.status(400).json({ error: 'Please upload at least one PDF file' });
            }

            const filePaths = files.map(f => f.path);
            const tempFiles = [];

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

                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdf(dataBuffer);

                const text = data.text || '';
                const outputPath = path.join(__dirname, '../uploads', `extracted-text-${Date.now()}.txt`);
                fs.writeFileSync(outputPath, text);

                cleanupFiles([filePath]);

                res.download(outputPath, 'extracted-text.txt', (err) => {
                    if (err) {
                        console.error('Download error:', err);
                    }
                    setTimeout(() => cleanupFiles([outputPath]), 5000);
                });
            } else {
                // Process multiple files - create zip
                const zipPath = path.join(__dirname, '../uploads', `extracted-text-${Date.now()}.zip`);
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
                        const dataBuffer = fs.readFileSync(filePath);
                        const data = await pdf(dataBuffer);
                        const text = data.text || '';
                        const tempPath = path.join(__dirname, '../uploads', `temp-text-${Date.now()}-${path.basename(file.originalname, path.extname(file.originalname))}.txt`);
                        fs.writeFileSync(tempPath, text);
                        tempFiles.push(tempPath);

                        archive.file(tempPath, { name: `extracted-${path.basename(file.originalname, path.extname(file.originalname))}.txt` });
                    } catch (err) {
                        console.error(`Error processing ${file.originalname}:`, err);
                    }
                }

                await archive.finalize();
                cleanupFiles(filePaths);

                output.on('close', () => {
                    res.download(zipPath, 'extracted-texts.zip', (err) => {
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
            console.error('Extract text error:', error);
            if (req.files) {
                const filePaths = [];
                if (req.files.files) filePaths.push(...req.files.files.map(f => f.path));
                if (req.files.file) filePaths.push(req.files.file[0].path);
                cleanupFiles(filePaths);
            }
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to extract text: ' + error.message });
            }
        }
    });

    return router;
};

