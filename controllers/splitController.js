const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

exports.split = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'PDF file is required' });
        }

        const { pages } = req.body; // e.g., "1-3,5,7-9"

        // Load the PDF
        const pdfBytes = await fs.readFile(req.file.path);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const totalPages = pdfDoc.getPageCount();

        // Parse page ranges
        const pageNumbers = parsePageRanges(pages, totalPages);

        // Create new PDF with selected pages
        const newPdf = await PDFDocument.create();
        const copiedPages = await newPdf.copyPages(pdfDoc, pageNumbers);
        copiedPages.forEach((page) => newPdf.addPage(page));

        // Save the split PDF
        const splitPdfBytes = await newPdf.save();
        const outputPath = path.join(__dirname, '..', 'uploads', `split-${Date.now()}.pdf`);
        await fs.writeFile(outputPath, splitPdfBytes);

        // Clean up uploaded file
        await fs.unlink(req.file.path);

        // Send the file
        res.download(outputPath, 'split.pdf', async (err) => {
            if (err) console.error('Download error:', err);
            try {
                await fs.unlink(outputPath);
            } catch (e) {
                console.error('Cleanup error:', e);
            }
        });

    } catch (error) {
        console.error('Split error:', error);
        res.status(500).json({ error: 'Failed to split PDF', details: error.message });
    }
};

function parsePageRanges(rangeString, maxPages) {
    if (!rangeString) {
        return Array.from({ length: maxPages }, (_, i) => i);
    }

    const pages = new Set();
    const ranges = rangeString.split(',');

    ranges.forEach(range => {
        if (range.includes('-')) {
            const [start, end] = range.split('-').map(n => parseInt(n.trim()) - 1);
            for (let i = start; i <= end && i < maxPages; i++) {
                pages.add(i);
            }
        } else {
            const page = parseInt(range.trim()) - 1;
            if (page >= 0 && page < maxPages) {
                pages.add(page);
            }
        }
    });

    return Array.from(pages).sort((a, b) => a - b);
}
