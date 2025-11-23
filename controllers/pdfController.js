const { PDFDocument, degrees, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const gm = require('gm').subClass({ imageMagick: true });
const pdfParse = require('pdf-parse');
const archiver = require('archiver');
const { cleanupFiles, validatePDF } = require('../utils/pdfUtils');

const uploadsDir = path.join(__dirname, '../uploads');
const tmpDir = path.join(__dirname, '../tmp');

// Helper to send file
const sendFile = (res, filePath, downloadName) => {
    res.download(filePath, downloadName, (err) => {
        if (err) console.error('Download error:', err);
        // Cleanup after a delay
        setTimeout(() => cleanupFiles([filePath]), 60000); // 1 minute delay
    });
};

exports.merge = async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length < 2) {
            return res.status(400).json({ error: 'Please upload at least two PDF files' });
        }

        const mergedPdf = await PDFDocument.create();
        const filePaths = files.map(f => f.path);

        for (const file of files) {
            const pdfBytes = fs.readFileSync(file.path);
            const pdf = await PDFDocument.load(pdfBytes);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const pdfBytes = await mergedPdf.save();
        const outputPath = path.join(tmpDir, `merged-${Date.now()}.pdf`);
        fs.writeFileSync(outputPath, pdfBytes);

        cleanupFiles(filePaths);
        sendFile(res, outputPath, 'merged.pdf');
    } catch (error) {
        console.error('Merge error:', error);
        res.status(500).json({ error: 'Failed to merge PDFs' });
    }
};

exports.split = async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'Please upload a PDF file' });

        const { pages } = req.body; // "1,3-5" or "all"
        const pdfBytes = fs.readFileSync(file.path);
        const pdf = await PDFDocument.load(pdfBytes);
        const totalPages = pdf.getPageCount();

        // If "all", split into individual pages and zip
        if (!pages || pages === 'all') {
            const zipPath = path.join(tmpDir, `split-${Date.now()}.zip`);
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip');

            archive.pipe(output);

            for (let i = 0; i < totalPages; i++) {
                const newPdf = await PDFDocument.create();
                const [copiedPage] = await newPdf.copyPages(pdf, [i]);
                newPdf.addPage(copiedPage);
                const pdfBuffer = await newPdf.save();
                archive.append(Buffer.from(pdfBuffer), { name: `page-${i + 1}.pdf` });
            }

            await archive.finalize();

            output.on('close', () => {
                cleanupFiles([file.path]);
                sendFile(res, zipPath, 'split-pages.zip');
            });
            return;
        }

        // Parse ranges
        const rangeIndices = new Set();
        const parts = pages.split(',');
        for (const part of parts) {
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(n => parseInt(n) - 1);
                for (let i = start; i <= end; i++) {
                    if (i >= 0 && i < totalPages) rangeIndices.add(i);
                }
            } else {
                const idx = parseInt(part) - 1;
                if (idx >= 0 && idx < totalPages) rangeIndices.add(idx);
            }
        }

        const newPdf = await PDFDocument.create();
        const indices = Array.from(rangeIndices).sort((a, b) => a - b);
        const copiedPages = await newPdf.copyPages(pdf, indices);
        copiedPages.forEach(page => newPdf.addPage(page));

        const outputBytes = await newPdf.save();
        const outputPath = path.join(tmpDir, `split-${Date.now()}.pdf`);
        fs.writeFileSync(outputPath, outputBytes);

        cleanupFiles([file.path]);
        sendFile(res, outputPath, 'split.pdf');

    } catch (error) {
        console.error('Split error:', error);
        res.status(500).json({ error: 'Failed to split PDF' });
    }
};

exports.compress = async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'Please upload a PDF file' });

        const outputPath = path.join(tmpDir, `compressed-${Date.now()}.pdf`);

        // Use GM to compress (requires Ghostscript)
        gm(file.path)
            .density(72) // Lower density for compression
            .quality(50) // Lower quality
            .compress('JPEG') // Compress images
            .write(outputPath, (err) => {
                if (err) {
                    console.error('GM Compress error:', err);
                    // Fallback to pdf-lib if GM fails
                    return fallbackCompress(file.path, res);
                }
                cleanupFiles([file.path]);
                sendFile(res, outputPath, 'compressed.pdf');
            });

    } catch (error) {
        console.error('Compress error:', error);
        res.status(500).json({ error: 'Failed to compress PDF' });
    }
};

async function fallbackCompress(filePath, res) {
    try {
        const pdfBytes = fs.readFileSync(filePath);
        const pdf = await PDFDocument.load(pdfBytes);
        // Minimal compression by saving without object streams? Actually default is compressed.
        // We can just save it again, maybe it helps if original was bloated.
        const compressedBytes = await pdf.save({ useObjectStreams: false });
        const outputPath = path.join(tmpDir, `compressed-fallback-${Date.now()}.pdf`);
        fs.writeFileSync(outputPath, compressedBytes);
        cleanupFiles([filePath]);
        sendFile(res, outputPath, 'compressed.pdf');
    } catch (e) {
        res.status(500).json({ error: 'Failed to compress PDF' });
    }
}

exports.rotate = async (req, res) => {
    try {
        const file = req.file;
        const { angle = 90 } = req.body;

        const pdfBytes = fs.readFileSync(file.path);
        const pdf = await PDFDocument.load(pdfBytes);
        const pages = pdf.getPages();

        pages.forEach(page => {
            const currentRotation = page.getRotation().angle;
            page.setRotation(degrees(currentRotation + parseInt(angle)));
        });

        const outputBytes = await pdf.save();
        const outputPath = path.join(tmpDir, `rotated-${Date.now()}.pdf`);
        fs.writeFileSync(outputPath, outputBytes);

        cleanupFiles([file.path]);
        sendFile(res, outputPath, 'rotated.pdf');
    } catch (error) {
        console.error('Rotate error:', error);
        res.status(500).json({ error: 'Failed to rotate PDF' });
    }
};

exports.deletePages = async (req, res) => {
    try {
        const file = req.file;
        const { pages } = req.body; // "1,3"

        const pdfBytes = fs.readFileSync(file.path);
        const pdf = await PDFDocument.load(pdfBytes);
        const totalPages = pdf.getPageCount();

        const pagesToDelete = new Set();
        if (pages) {
            pages.split(',').forEach(p => {
                const idx = parseInt(p) - 1;
                if (idx >= 0 && idx < totalPages) pagesToDelete.add(idx);
            });
        }

        const newPdf = await PDFDocument.create();
        const keepIndices = [];
        for (let i = 0; i < totalPages; i++) {
            if (!pagesToDelete.has(i)) keepIndices.push(i);
        }

        const copiedPages = await newPdf.copyPages(pdf, keepIndices);
        copiedPages.forEach(page => newPdf.addPage(page));

        const outputBytes = await newPdf.save();
        const outputPath = path.join(tmpDir, `deleted-${Date.now()}.pdf`);
        fs.writeFileSync(outputPath, outputBytes);

        cleanupFiles([file.path]);
        sendFile(res, outputPath, 'modified.pdf');
    } catch (error) {
        console.error('Delete pages error:', error);
        res.status(500).json({ error: 'Failed to delete pages' });
    }
};

exports.reorderPages = async (req, res) => {
    try {
        const file = req.file;
        const { order } = req.body; // "2,1,3"

        const pdfBytes = fs.readFileSync(file.path);
        const pdf = await PDFDocument.load(pdfBytes);
        const totalPages = pdf.getPageCount();

        const newPdf = await PDFDocument.create();
        const indices = order.split(',').map(p => parseInt(p) - 1).filter(i => i >= 0 && i < totalPages);

        const copiedPages = await newPdf.copyPages(pdf, indices);
        copiedPages.forEach(page => newPdf.addPage(page));

        const outputBytes = await newPdf.save();
        const outputPath = path.join(tmpDir, `reordered-${Date.now()}.pdf`);
        fs.writeFileSync(outputPath, outputBytes);

        cleanupFiles([file.path]);
        sendFile(res, outputPath, 'reordered.pdf');
    } catch (error) {
        console.error('Reorder error:', error);
        res.status(500).json({ error: 'Failed to reorder pages' });
    }
};

exports.watermark = async (req, res) => {
    try {
        const file = req.file;
        const { text = 'CONFIDENTIAL', color = '0,0,0', opacity = 0.5, size = 50 } = req.body;

        const pdfBytes = fs.readFileSync(file.path);
        const pdf = await PDFDocument.load(pdfBytes);
        const pages = pdf.getPages();

        const [r, g, b] = color.split(',').map(c => parseInt(c) / 255);

        pages.forEach(page => {
            const { width, height } = page.getSize();
            page.drawText(text, {
                x: width / 2 - (text.length * size) / 4,
                y: height / 2,
                size: parseInt(size),
                color: rgb(r, g, b),
                opacity: parseFloat(opacity),
                rotate: degrees(45),
            });
        });

        const outputBytes = await pdf.save();
        const outputPath = path.join(tmpDir, `watermarked-${Date.now()}.pdf`);
        fs.writeFileSync(outputPath, outputBytes);

        cleanupFiles([file.path]);
        sendFile(res, outputPath, 'watermarked.pdf');
    } catch (error) {
        console.error('Watermark error:', error);
        res.status(500).json({ error: 'Failed to add watermark' });
    }
};

exports.extractText = async (req, res) => {
    try {
        const file = req.file;
        const dataBuffer = fs.readFileSync(file.path);

        const data = await pdfParse(dataBuffer);
        const text = data.text;

        const outputPath = path.join(tmpDir, `extracted-${Date.now()}.txt`);
        fs.writeFileSync(outputPath, text);

        cleanupFiles([file.path]);
        res.download(outputPath, 'extracted.txt', (err) => {
            if (err) console.error(err);
            setTimeout(() => cleanupFiles([outputPath]), 60000);
        });
    } catch (error) {
        console.error('Extract text error:', error);
        res.status(500).json({ error: 'Failed to extract text' });
    }
};
