const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
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

// Import routes
const routes = require('./routes');

// Use routes
app.use('/api', routes(upload));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'PDF Editor Server is running' });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'PDF Editor Pro Backend API',
        version: '1.0.0',
        endpoints: [
            '/api/health',
            '/api/merge',
            '/api/split',
            '/api/compress',
            '/api/rotate',
            '/api/image-to-pdf',
            '/api/pdf-to-image',
            '/api/watermark',
            '/api/extract-text',
            '/api/delete-pages',
            '/api/reorder-pages'
        ]
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`PDF Editor Server running on port ${PORT}`);
});

module.exports = app;
