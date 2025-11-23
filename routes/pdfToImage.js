const express = require('express');
const imageController = require('../controllers/imageController');

module.exports = (upload) => {
    const router = express.Router();
    router.post('/', upload.single('file'), imageController.pdfToImage);
    return router;
};
