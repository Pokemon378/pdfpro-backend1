const fs = require('fs');
const path = require('path');

// Clean up temporary files
function cleanupFiles(filePaths) {
    if (!Array.isArray(filePaths)) {
        filePaths = [filePaths];
    }
    
    filePaths.forEach(filePath => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.error(`Error deleting file ${filePath}:`, error);
        }
    });
}

// Get file size in MB
function getFileSize(filePath) {
    const stats = fs.statSync(filePath);
    return (stats.size / (1024 * 1024)).toFixed(2);
}

// Validate PDF file
function validatePDF(filePath) {
    if (!fs.existsSync(filePath)) {
        return { valid: false, error: 'File does not exist' };
    }
    
    const buffer = fs.readFileSync(filePath);
    // Check PDF magic number
    if (buffer.slice(0, 4).toString() !== '%PDF') {
        return { valid: false, error: 'Invalid PDF file' };
    }
    
    return { valid: true };
}

// Generate unique filename
function generateFilename(prefix, extension) {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1E9);
    return `${prefix}-${timestamp}-${random}${extension}`;
}

module.exports = {
    cleanupFiles,
    getFileSize,
    validatePDF,
    generateFilename
};

