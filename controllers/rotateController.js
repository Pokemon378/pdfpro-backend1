const { PDFDocument, degrees } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

exports.rotate = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'PDF file is required' });
        }

        const { angle = 90 } = req.body; // Default 90 degrees
        const rotationAngle = parseInt(angle);

        // Load the PDF
        const pdfBytes = await fs.readFile(req.file.path);
        const pdfDoc = await PDFDocument.load(pdfBytes);

        // Rotate all pages
        const pages = pdfDoc.getPages();
        pages.forEach(page => {
            page.setRotation(degrees(rotationAngle));
        });

        // Save the rotated PDF
        const rotatedPdfBytes = await pdfDoc.save();
        const outputPath = path.join(__dirname, '..', 'uploads', `rotated-${Date.now()}.pdf`);
        await fs.writeFile(outputPath, rotatedPdfBytes);

        // Clean up uploaded file
        await fs.unlink(req.file.path);

        // Send the file
        res.download(outputPath, 'rotated.pdf', async (err) => {
            if (err) console.error('Download error:', err);
            try {
                await fs.unlink(outputPath);
            } catch (e) {
                console.error('Cleanup error:', e);
            }
        });

    } catch (error) {
        console.error('Rotate error:', error);
        res.status(500).json({ error: 'Failed to rotate PDF', details: error.message });
    }
};
