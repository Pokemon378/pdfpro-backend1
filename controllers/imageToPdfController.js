const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

exports.convert = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'At least one image file is required' });
        }

        // Create a new PDF document
        const pdfDoc = await PDFDocument.create();

        // Add each image as a page
        for (const file of req.files) {
            const imageBytes = await fs.readFile(file.path);
            let image;

            // Detect image type and embed
            if (file.mimetype === 'image/png') {
                image = await pdfDoc.embedPng(imageBytes);
            } else if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
                image = await pdfDoc.embedJpg(imageBytes);
            } else {
                await fs.unlink(file.path);
                continue; // Skip unsupported formats
            }

            const page = pdfDoc.addPage([image.width, image.height]);
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
            });

            // Clean up uploaded file
            await fs.unlink(file.path);
        }

        // Save the PDF
        const pdfBytes = await pdfDoc.save();
        const outputPath = path.join(__dirname, '..', 'uploads', `images-to-pdf-${Date.now()}.pdf`);
        await fs.writeFile(outputPath, pdfBytes);

        // Send the file
        res.download(outputPath, 'converted.pdf', async (err) => {
            if (err) console.error('Download error:', err);
            try {
                await fs.unlink(outputPath);
            } catch (e) {
                console.error('Cleanup error:', e);
            }
        });

    } catch (error) {
        console.error('Image to PDF error:', error);
        res.status(500).json({ error: 'Failed to convert images to PDF', details: error.message });
    }
};
