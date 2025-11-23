const express = require('express');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { cleanupFiles, validatePDF } = require('../utils/pdfUtils');

module.exports = (upload) => {
    const router = express.Router();

    router.post('/', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Please upload a PDF file' });
            }

            const { pages } = req.body;
            const filePath = req.file.path;

            // Validate PDF
            const validation = validatePDF(filePath);
            if (!validation.valid) {
                cleanupFiles([filePath]);
                return res.status(400).json({ error: 'Invalid PDF file' });
            }

            if (!pages) {
                cleanupFiles([filePath]);
                return res.status(400).json({ error: 'Please specify pages to delete' });
            }

            const pdfBytes = fs.readFileSync(filePath);
            const pdf = await PDFDocument.load(pdfBytes);
            const totalPages = pdf.getPageCount();

            // Parse pages to delete
            const pagesArray = pages.split(',').map(p => p.trim()).filter(p => p.length > 0);
            const pagesToDelete = new Set();
            pagesArray.forEach(p => {
                const page = Number(p);
                if (!isNaN(page) && page >= 1 && page <= totalPages) {
                    pagesToDelete.add(page - 1);
                }
            });
            
            const pagesToKeep = Array.from({ length: totalPages }, (_, i) => i)
                .filter(i => !pagesToDelete.has(i));

            if (pagesToKeep.length === 0) {
                cleanupFiles([filePath]);
                return res.status(400).json({ error: 'Cannot delete all pages' });
            }

            // Create new PDF with remaining pages
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdf, pagesToKeep);
            copiedPages.forEach((page) => newPdf.addPage(page));

            const newPdfBytes = await newPdf.save();
            const outputPath = path.join(__dirname, '../uploads', `deleted-pages-${Date.now()}.pdf`);
            fs.writeFileSync(outputPath, newPdfBytes);

            cleanupFiles([filePath]);

            res.download(outputPath, 'deleted-pages.pdf', (err) => {
                if (err) {
                    console.error('Download error:', err);
                }
                setTimeout(() => cleanupFiles([outputPath]), 5000);
            });
        } catch (error) {
            console.error('Delete pages error:', error);
            res.status(500).json({ error: 'Failed to delete pages: ' + error.message });
        }
    });

    return router;
};

