const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const gm = require('gm').subClass({ imageMagick: true });

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads and tmp directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const tmpDir = path.join(__dirname, 'tmp');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

// Enable CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Import Routes
const mergeRoute = require('./routes/merge');
const splitRoute = require('./routes/split');
const compressRoute = require('./routes/compress');
const rotateRoute = require('./routes/rotate');
const imageToPdfRoute = require('./routes/imageToPdf');
const pdfToImageRoute = require('./routes/pdfToImage');
const watermarkRoute = require('./routes/watermark');
const extractTextRoute = require('./routes/extractText');
const deletePagesRoute = require('./routes/deletePages');
const reorderPagesRoute = require('./routes/reorderPages');

// Use Routes
app.use('/api/merge', mergeRoute(upload));
app.use('/api/split', splitRoute(upload));
app.use('/api/compress', compressRoute(upload));
app.use('/api/rotate', rotateRoute(upload));
app.use('/api/image-to-pdf', imageToPdfRoute(upload));
app.use('/api/pdf-to-image', pdfToImageRoute(upload));
app.use('/api/watermark', watermarkRoute(upload));
app.use('/api/extract-text', extractTextRoute(upload));
app.use('/api/delete-pages', deletePagesRoute(upload));
app.use('/api/reorder-pages', reorderPagesRoute(upload));

// Download route
app.get('/api/download', (req, res) => {
    const fileName = req.query.file;
    if (!fileName) {
        return res.status(400).json({ error: 'File name required' });
    }
    // Check in both uploads and tmp
    let filePath = path.join(uploadsDir, fileName);
    if (!fs.existsSync(filePath)) {
        filePath = path.join(tmpDir, fileName);
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, (err) => {
        if (err) {
            console.error('Download error:', err);
        }
    });
});

// Cleanup route - delete temporary files
app.post('/api/cleanup', (req, res) => {
    const { files } = req.body;
    if (files && Array.isArray(files)) {
        files.forEach(file => {
            // Try deleting from uploads
            let filePath = path.join(uploadsDir, file);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            // Try deleting from tmp
            filePath = path.join(tmpDir, file);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        });
    }
    res.json({ success: true });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'PDF Editor Server is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`PDF Editor Server running on port ${PORT}`);
});

module.exports = app;

