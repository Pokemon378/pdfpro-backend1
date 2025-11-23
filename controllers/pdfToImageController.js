const fs = require('fs').promises;
const path = require('path');

exports.convert = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'PDF file is required' });
        }

        // Note: PDF to Image conversion requires external tools like pdf-poppler or GraphicsMagick
        // This is a placeholder implementation
        res.status(501).json({
            error: 'PDF to Image conversion requires additional system dependencies',
            message: 'Please install GraphicsMagick or pdf-poppler on your server'
        });

        // Clean up uploaded file
        await fs.unlink(req.file.path);

    } catch (error) {
        console.error('PDF to Image error:', error);
        res.status(500).json({ error: 'Failed to convert PDF to images', details: error.message });
    }
};
