const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

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

// Routes
const adminRoute = require('./routes/admin');
const mergeRoute = require('./routes/merge');
const splitRoute = require('./routes/split');
const compressRoute = require('./routes/compress');
const rotateRoute = require('./routes/rotate');
const imageToPdfRoute = require('./routes/imageToPdf');
const watermarkRoute = require('./routes/watermark');
const passwordRoute = require('./routes/password');
const extractTextRoute = require('./routes/extractText');
const deletePagesRoute = require('./routes/deletePages');
const reorderPagesRoute = require('./routes/reorderPages');

app.use('/api/admin', adminRoute);
app.use('/api/merge', mergeRoute(upload));
app.use('/api/split', splitRoute(upload));
app.use('/api/compress', compressRoute(upload));
app.use('/api/rotate', rotateRoute(upload));
// app.use('/api/pdf-to-image', pdfToImageRoute(upload)); // Moved to client-side
app.use('/api/image-to-pdf', imageToPdfRoute(upload));
app.use('/api/watermark', watermarkRoute(upload));
app.use('/api/password', passwordRoute(upload));
app.use('/api/extract-text', extractTextRoute(upload));
app.use('/api/delete-pages', deletePagesRoute(upload));
app.use('/api/reorder-pages', reorderPagesRoute(upload));

// Download route
app.get('/api/download', (req, res) => {
    const fileName = req.query.file;
    if (!fileName) {
        return res.status(400).json({ error: 'File name required' });
    }
    const filePath = path.join(uploadsDir, fileName);
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
            const filePath = path.join(uploadsDir, file);
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
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`PDF Editor Server running on port ${PORT}`);
        console.log(`Uploads directory: ${uploadsDir}`);
    });
}

module.exports = app;

