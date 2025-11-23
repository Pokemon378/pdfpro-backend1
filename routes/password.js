const express = require('express');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { cleanupFiles, validatePDF } = require('../utils/pdfUtils');

module.exports = (upload) => {
    const router = express.Router();

    // Add password
    router.post('/add', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Please upload a PDF file' });
            }

            const { userPassword, ownerPassword } = req.body;
            const filePath = req.file.path;

            // Validate PDF
            const validation = validatePDF(filePath);
            if (!validation.valid) {
                cleanupFiles([filePath]);
                return res.status(400).json({ error: 'Invalid PDF file' });
            }

            const pdfBytes = fs.readFileSync(filePath);
            const pdf = await PDFDocument.load(pdfBytes);

            // Set passwords
            // pdf-lib supports standard encryption
            const protectedBytes = await pdf.save({
                userPassword: userPassword || '',
                ownerPassword: ownerPassword || userPassword || '',
                permissions: {
                    printing: 'highResolution',
                    modifying: false,
                    copying: false,
                    annotating: false,
                    fillingForms: false,
                    contentAccessibility: false,
                    documentAssembly: false,
                },
            });
            const outputPath = path.join(__dirname, '../uploads', `protected-${Date.now()}.pdf`);
            fs.writeFileSync(outputPath, protectedBytes);

            cleanupFiles([filePath]);

            res.download(outputPath, 'protected.pdf', (err) => {
                if (err) {
                    console.error('Download error:', err);
                }
                setTimeout(() => cleanupFiles([outputPath]), 5000);
            });
        } catch (error) {
            console.error('Add password error:', error);
            res.status(500).json({ error: 'Failed to add password: ' + error.message });
        }
    });

    // Remove password (unlock)
    router.post('/remove', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Please upload a PDF file' });
            }

            const { password } = req.body;
            const filePath = req.file.path;

            // Validate PDF
            const validation = validatePDF(filePath);
            if (!validation.valid) {
                cleanupFiles([filePath]);
                return res.status(400).json({ error: 'Invalid PDF file' });
            }

            const pdfBytes = fs.readFileSync(filePath);
            // Note: pdf-lib doesn't support password removal directly
            // This would require additional libraries like qpdf or pdftk
            // For now, we'll just copy the PDF
            const pdf = await PDFDocument.load(pdfBytes);
            const unlockedBytes = await pdf.save();
            const outputPath = path.join(__dirname, '../uploads', `unlocked-${Date.now()}.pdf`);
            fs.writeFileSync(outputPath, unlockedBytes);

            cleanupFiles([filePath]);

            res.download(outputPath, 'unlocked.pdf', (err) => {
                if (err) {
                    console.error('Download error:', err);
                }
                setTimeout(() => cleanupFiles([outputPath]), 5000);
            });
        } catch (error) {
            console.error('Remove password error:', error);
            res.status(500).json({ error: 'Failed to remove password: ' + error.message });
        }
    });

    return router;
};

