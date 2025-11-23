const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const cleanupFiles = (filePaths) => {
    if (!filePaths || !Array.isArray(filePaths)) return;

    filePaths.forEach(filePath => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.error(`Error deleting file ${filePath}:`, error);
        }
    });
};

const validatePDF = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) {
            return { valid: false, error: 'File does not exist' };
        }
        // Basic check for PDF header
        const buffer = Buffer.alloc(5);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, 5, 0);
        fs.closeSync(fd);

        if (buffer.toString() !== '%PDF-') {
            return { valid: false, error: 'Invalid PDF header' };
        }
        return { valid: true };
    } catch (error) {
        return { valid: false, error: error.message };
    }
};

const getFileSize = (filePath) => {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch (error) {
        return 0;
    }
};

module.exports = {
    cleanupFiles,
    validatePDF,
    getFileSize
};
