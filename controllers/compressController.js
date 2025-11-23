const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

exports.compress = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'PDF file is required' });
        }

        // Load the PDF
        const pdfBytes = await fs.readFile(req.file.path);
        const pdfDoc = await PDFDocument.load(pdfBytes);

        // Save with compression (pdf-lib automatically compresses)
        const compressedPdfBytes = await pdfDoc.save({
            useObjectStreams: true,
            addDefaultPage: false
        });

        const outputPath = path.join(__dirname, '..', 'uploads', `compressed-${Date.now()}.pdf`);
        await fs.writeFile(outputPath, compressedPdfBytes);

        // Clean up uploaded file
        await fs.unlink(req.file.path);

        // Send the file
        res.download(outputPath, 'compressed.pdf', async (err) => {
            if (err) console.error('Download error:', err);
            try {
                await fs.unlink(outputPath);
            } catch (e) {
                console.error('Cleanup error:', e);
            }
        });

    } catch (error) {
        console.error('Compress error:', error);
        res.status(500).json({ error: 'Failed to compress PDF', details: error.message });
    }
};
