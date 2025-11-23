const pdfParse = require('pdf-parse');
const fs = require('fs').promises;

exports.extract = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'PDF file is required' });
        }

        // Read the PDF file
        const dataBuffer = await fs.readFile(req.file.path);

        // Extract text
        const data = await pdfParse(dataBuffer);

        // Clean up uploaded file
        await fs.unlink(req.file.path);

        // Send the extracted text
        res.json({
            text: data.text,
            pages: data.numpages,
            info: data.info
        });

    } catch (error) {
        console.error('Extract text error:', error);
        res.status(500).json({ error: 'Failed to extract text', details: error.message });
    }
};
