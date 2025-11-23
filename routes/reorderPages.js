const express = require('express');
const pdfController = require('../controllers/pdfController');

module.exports = (upload) => {
    const router = express.Router();
    router.post('/', upload.single('file'), pdfController.reorderPages);
    return router;
};
