const express = require('express');
const pdfController = require('../controllers/pdfController');

module.exports = (upload) => {
    const router = express.Router();
    router.post('/', upload.array('files', 50), pdfController.merge);
    return router;
};
