const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

exports.addWatermark = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'PDF file is required' });
        }

        const { text = 'WATERMARK' } = req.body;

        // Load the PDF
        const pdfBytes = await fs.readFile(req.file.path);
        const pdfDoc = await PDFDocument.load(pdfBytes);

        // Add watermark to all pages
        const pages = pdfDoc.getPages();
        pages.forEach(page => {
            const { width, height } = page.getSize();
            page.drawText(text, {
                x: width / 4,
                y: height / 2,
                size: 50,
                color: rgb(0.75, 0.75, 0.75),
                opacity: 0.3,
            });
        });

        // Save the watermarked PDF
        const watermarkedPdfBytes = await pdfDoc.save();
        const outputPath = path.join(__dirname, '..', 'uploads', `watermarked-${Date.now()}.pdf`);
        await fs.writeFile(outputPath, watermarkedPdfBytes);

        // Clean up uploaded file
        await fs.unlink(req.file.path);

        // Send the file
        res.download(outputPath, 'watermarked.pdf', async (err) => {
            if (err) console.error('Download error:', err);
            try {
                await fs.unlink(outputPath);
            } catch (e) {
                console.error('Cleanup error:', e);
            }
        });

    } catch (error) {
        console.error('Watermark error:', error);
        res.status(500).json({ error: 'Failed to add watermark', details: error.message });
    }
};
