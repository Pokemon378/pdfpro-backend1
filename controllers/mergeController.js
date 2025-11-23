const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

exports.merge = async (req, res) => {
    try {
        if (!req.files || req.files.length < 2) {
            return res.status(400).json({ error: 'At least 2 PDF files are required' });
        }

        // Create a new PDF document
        const mergedPdf = await PDFDocument.create();

        // Load and merge each PDF
        for (const file of req.files) {
            const pdfBytes = await fs.readFile(file.path);
            const pdf = await PDFDocument.load(pdfBytes);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));

            // Clean up uploaded file
            await fs.unlink(file.path);
        }

        // Save the merged PDF
        const mergedPdfBytes = await mergedPdf.save();
        const outputPath = path.join(__dirname, '..', 'uploads', `merged-${Date.now()}.pdf`);
        await fs.writeFile(outputPath, mergedPdfBytes);

        // Send the file
        res.download(outputPath, 'merged.pdf', async (err) => {
            if (err) console.error('Download error:', err);
            // Clean up after download
            try {
                await fs.unlink(outputPath);
            } catch (e) {
                console.error('Cleanup error:', e);
            }
        });

    } catch (error) {
        console.error('Merge error:', error);
        res.status(500).json({ error: 'Failed to merge PDFs', details: error.message });
    }
};
