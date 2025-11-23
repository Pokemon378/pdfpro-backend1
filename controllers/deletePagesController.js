const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

exports.deletePages = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'PDF file is required' });
        }

        const { pages } = req.body; // e.g., "1,3,5" (pages to delete)

        // Load the PDF
        const pdfBytes = await fs.readFile(req.file.path);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const totalPages = pdfDoc.getPageCount();

        // Parse pages to delete
        const pagesToDelete = pages.split(',').map(p => parseInt(p.trim()) - 1);

        // Create new PDF with remaining pages
        const newPdf = await PDFDocument.create();
        const allPages = Array.from({ length: totalPages }, (_, i) => i);
        const pagesToKeep = allPages.filter(p => !pagesToDelete.includes(p));

        const copiedPages = await newPdf.copyPages(pdfDoc, pagesToKeep);
        copiedPages.forEach((page) => newPdf.addPage(page));

        // Save the new PDF
        const newPdfBytes = await newPdf.save();
        const outputPath = path.join(__dirname, '..', 'uploads', `deleted-pages-${Date.now()}.pdf`);
        await fs.writeFile(outputPath, newPdfBytes);

        // Clean up uploaded file
        await fs.unlink(req.file.path);

        // Send the file
        res.download(outputPath, 'modified.pdf', async (err) => {
            if (err) console.error('Download error:', err);
            try {
                await fs.unlink(outputPath);
            } catch (e) {
                console.error('Cleanup error:', e);
            }
        });

    } catch (error) {
        console.error('Delete pages error:', error);
        res.status(500).json({ error: 'Failed to delete pages', details: error.message });
    }
};
