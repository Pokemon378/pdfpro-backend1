const express = require('express');
const imageController = require('../controllers/imageController');

module.exports = (upload) => {
    const router = express.Router();
    router.post('/', upload.array('files', 50), imageController.imageToPdf);
    return router;
};
