const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

exports.reorder = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'PDF file is required' });
        }

        const { order } = req.body; // e.g., "3,1,2,4" (new page order)

        // Load the PDF
        const pdfBytes = await fs.readFile(req.file.path);
        const pdfDoc = await PDFDocument.load(pdfBytes);

        // Parse new order (convert to 0-indexed)
        const newOrder = order.split(',').map(p => parseInt(p.trim()) - 1);

        // Create new PDF with reordered pages
        const newPdf = await PDFDocument.create();
        const copiedPages = await newPdf.copyPages(pdfDoc, newOrder);
        copiedPages.forEach((page) => newPdf.addPage(page));

        // Save the reordered PDF
        const newPdfBytes = await newPdf.save();
        const outputPath = path.join(__dirname, '..', 'uploads', `reordered-${Date.now()}.pdf`);
        await fs.writeFile(outputPath, newPdfBytes);

        // Clean up uploaded file
        await fs.unlink(req.file.path);

        // Send the file
        res.download(outputPath, 'reordered.pdf', async (err) => {
            if (err) console.error('Download error:', err);
            try {
                await fs.unlink(outputPath);
            } catch (e) {
                console.error('Cleanup error:', e);
            }
        });

    } catch (error) {
        console.error('Reorder pages error:', error);
        res.status(500).json({ error: 'Failed to reorder pages', details: error.message });
    }
};
