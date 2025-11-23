const express = require('express');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { cleanupFiles } = require('../utils/pdfUtils');

module.exports = (upload) => {
    const router = express.Router();

    router.post('/', upload.array('files', 50), async (req, res) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'Please upload at least one image file' });
            }

            const { pageSize = 'A4', orientation = 'portrait' } = req.body;
            const pdf = await PDFDocument.create();
            const filePaths = [];

            // Page dimensions
            const dimensions = {
                'A4': { width: 595, height: 842 },
                'Letter': { width: 612, height: 792 },
                'Legal': { width: 612, height: 1008 }
            };

            let { width, height } = dimensions[pageSize] || dimensions['A4'];
            if (orientation === 'landscape') {
                [width, height] = [height, width];
            }

            let processedCount = 0;
            for (const file of req.files) {
                const filePath = file.path;
                filePaths.push(filePath);

                try {
                    // Process image with sharp
                    const imageBuffer = await sharp(filePath)
                        .resize(width, height, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
                        .toBuffer();

                    let image;
                    const ext = path.extname(file.originalname).toLowerCase();

                    if (['.jpg', '.jpeg'].includes(ext)) {
                        image = await pdf.embedJpg(imageBuffer);
                    } else if (['.png'].includes(ext)) {
                        image = await pdf.embedPng(imageBuffer);
                    } else {
                        // Try to convert to PNG
                        const pngBuffer = await sharp(filePath).png().toBuffer();
                        image = await pdf.embedPng(pngBuffer);
                    }

                    const page = pdf.addPage([width, height]);
                    page.drawImage(image, {
                        x: 0,
                        y: 0,
                        width: width,
                        height: height,
                    });
                    processedCount++;
                } catch (error) {
                    console.error(`Error processing image ${file.originalname}:`, error);
                }
            }

            if (processedCount === 0) {
                cleanupFiles(filePaths);
                return res.status(400).json({ error: 'No images were successfully processed' });
            }

            const pdfBytes = await pdf.save();
            const outputPath = path.join(__dirname, '../uploads', `images-pdf-${Date.now()}.pdf`);
            fs.writeFileSync(outputPath, pdfBytes);

            cleanupFiles(filePaths);

            res.download(outputPath, 'images.pdf', (err) => {
                if (err) {
                    console.error('Download error:', err);
                }
                setTimeout(() => cleanupFiles([outputPath]), 5000);
            });
        } catch (error) {
            console.error('Image to PDF error:', error);
            if (req.files && req.files.length > 0) {
                const filePaths = req.files.map(f => f.path);
                cleanupFiles(filePaths);
            }
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to convert images to PDF: ' + error.message });
            }
        }
    });

    return router;
};

