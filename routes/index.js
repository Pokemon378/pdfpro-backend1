const express = require('express');
const router = express.Router();

// Import controllers
const mergeController = require('../controllers/mergeController');
const splitController = require('../controllers/splitController');
const compressController = require('../controllers/compressController');
const rotateController = require('../controllers/rotateController');
const imageToPdfController = require('../controllers/imageToPdfController');
const pdfToImageController = require('../controllers/pdfToImageController');
const watermarkController = require('../controllers/watermarkController');
const extractTextController = require('../controllers/extractTextController');
const deletePagesController = require('../controllers/deletePagesController');
const reorderPagesController = require('../controllers/reorderPagesController');

module.exports = (upload) => {
    // Merge PDFs
    router.post('/merge', upload.array('files'), mergeController.merge);

    // Split PDF
    router.post('/split', upload.single('file'), splitController.split);

    // Compress PDF
    router.post('/compress', upload.single('file'), compressController.compress);

    // Rotate PDF
    router.post('/rotate', upload.single('file'), rotateController.rotate);

    // Image to PDF
    router.post('/image-to-pdf', upload.array('files'), imageToPdfController.convert);

    // PDF to Image
    router.post('/pdf-to-image', upload.single('file'), pdfToImageController.convert);

    // Watermark PDF
    router.post('/watermark', upload.single('file'), watermarkController.addWatermark);

    // Extract Text
    router.post('/extract-text', upload.single('file'), extractTextController.extract);

    // Delete Pages
    router.post('/delete-pages', upload.single('file'), deletePagesController.deletePages);

    // Reorder Pages
    router.post('/reorder-pages', upload.single('file'), reorderPagesController.reorder);

    return router;
};
