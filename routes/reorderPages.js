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

            const { order } = req.body; // Comma-separated page order like "3,1,2,4"
            const filePath = req.file.path;

            // Validate PDF
            const validation = validatePDF(filePath);
            if (!validation.valid) {
                cleanupFiles([filePath]);
                return res.status(400).json({ error: 'Invalid PDF file' });
            }

            if (!order) {
                cleanupFiles([filePath]);
                return res.status(400).json({ error: 'Please specify page order' });
            }

            const pdfBytes = fs.readFileSync(filePath);
            const pdf = await PDFDocument.load(pdfBytes);
            const totalPages = pdf.getPageCount();

            // Parse new order
            const orderArray = order.split(',').map(p => p.trim()).filter(p => p.length > 0);
            const newOrder = [];
            const seenPages = new Set();
            
            orderArray.forEach(p => {
                const page = Number(p);
                if (isNaN(page)) {
                    cleanupFiles([filePath]);
                    return res.status(400).json({ error: `Invalid page number: ${p}` });
                }
                if (page < 1 || page > totalPages) {
                    cleanupFiles([filePath]);
                    return res.status(400).json({ error: `Page number ${page} is out of range (1-${totalPages})` });
                }
                const pageIndex = page - 1;
                if (seenPages.has(pageIndex)) {
                    cleanupFiles([filePath]);
                    return res.status(400).json({ error: `Duplicate page number: ${page}` });
                }
                newOrder.push(pageIndex);
                seenPages.add(pageIndex);
            });

            if (newOrder.length !== totalPages) {
                cleanupFiles([filePath]);
                return res.status(400).json({ error: `Page order must include all ${totalPages} pages. You provided ${newOrder.length} pages.` });
            }

            // Create new PDF with reordered pages
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdf, newOrder);
            copiedPages.forEach((page) => newPdf.addPage(page));

            const newPdfBytes = await newPdf.save();
            const outputPath = path.join(__dirname, '../uploads', `reordered-${Date.now()}.pdf`);
            fs.writeFileSync(outputPath, newPdfBytes);

            cleanupFiles([filePath]);

            res.download(outputPath, 'reordered.pdf', (err) => {
                if (err) {
                    console.error('Download error:', err);
                }
                setTimeout(() => cleanupFiles([outputPath]), 5000);
            });
        } catch (error) {
            console.error('Reorder pages error:', error);
            res.status(500).json({ error: 'Failed to reorder pages: ' + error.message });
        }
    });

    return router;
};

