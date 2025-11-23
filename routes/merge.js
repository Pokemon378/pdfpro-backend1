const express = require('express');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { cleanupFiles, validatePDF } = require('../utils/pdfUtils');

module.exports = (upload) => {
    const router = express.Router();

    router.post('/', upload.array('files', 20), async (req, res) => {
        try {
            if (!req.files || req.files.length < 2) {
                return res.status(400).json({ error: 'Please upload at least 2 PDF files' });
            }

            const mergedPdf = await PDFDocument.create();
            const filePaths = [];

            // Merge all PDFs
            for (const file of req.files) {
                const filePath = file.path;
                filePaths.push(filePath);

                // Validate PDF
                const validation = validatePDF(filePath);
                if (!validation.valid) {
                    cleanupFiles(filePaths);
                    return res.status(400).json({ error: `Invalid PDF: ${file.originalname}` });
                }

                const pdfBytes = fs.readFileSync(filePath);
                const pdf = await PDFDocument.load(pdfBytes);
                const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                pages.forEach((page) => mergedPdf.addPage(page));
            }

            // Save merged PDF
            const mergedPdfBytes = await mergedPdf.save();
            const outputPath = path.join(__dirname, '../uploads', `merged-${Date.now()}.pdf`);
            fs.writeFileSync(outputPath, mergedPdfBytes);

            // Cleanup input files
            cleanupFiles(filePaths);

            res.download(outputPath, 'merged.pdf', (err) => {
                if (err) {
                    console.error('Download error:', err);
                }
                // Cleanup output file after download
                setTimeout(() => cleanupFiles([outputPath]), 5000);
            });
        } catch (error) {
            console.error('Merge error:', error);
            if (req.files && req.files.length > 0) {
                const filePaths = req.files.map(f => f.path);
                cleanupFiles(filePaths);
            }
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to merge PDFs: ' + error.message });
            }
        }
    });

    return router;
};

