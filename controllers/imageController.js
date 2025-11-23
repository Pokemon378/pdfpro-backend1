const fs = require('fs');
const path = require('path');
const gm = require('gm').subClass({ imageMagick: true });
const { cleanupFiles } = require('../utils/pdfUtils');

const tmpDir = path.join(__dirname, '../tmp');

// Helper to send file
const sendFile = (res, filePath, downloadName) => {
    res.download(filePath, downloadName, (err) => {
        if (err) console.error('Download error:', err);
        setTimeout(() => cleanupFiles([filePath]), 60000);
    });
};

exports.imageToPdf = async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'Please upload images' });
        }

        const outputPath = path.join(tmpDir, `images-${Date.now()}.pdf`);

        // Use GM to convert images to PDF
        const state = gm();

        files.forEach(file => {
            state.in(file.path);
        });

        state
            .density(300, 300) // Set density for better quality
            .write(outputPath, (err) => {
                if (err) {
                    console.error('GM Image to PDF error:', err);
                    cleanupFiles(files.map(f => f.path));
                    return res.status(500).json({ error: 'Failed to convert images to PDF' });
                }

                cleanupFiles(files.map(f => f.path));
                sendFile(res, outputPath, 'images.pdf');
            });

    } catch (error) {
        console.error('Image to PDF error:', error);
        res.status(500).json({ error: 'Failed to convert images to PDF' });
    }
};

exports.pdfToImage = async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'Please upload a PDF' });

        const outputPrefix = path.join(tmpDir, `page-${Date.now()}`);

        // GM write to output-%03d.png will create multiple files
        gm(file.path)
            .density(300, 300)
            .write(`${outputPrefix}-%03d.png`, (err) => {
                if (err) {
                    console.error('GM PDF to Image error:', err);
                    cleanupFiles([file.path]);
                    return res.status(500).json({ error: 'Failed to convert PDF to images' });
                }

                // Find generated files
                const dirFiles = fs.readdirSync(tmpDir);
                const generatedFiles = dirFiles.filter(f => f.startsWith(path.basename(outputPrefix)));

                if (generatedFiles.length === 0) {
                    cleanupFiles([file.path]);
                    return res.status(500).json({ error: 'No images generated' });
                }

                // If single file, send it. If multiple, zip them.
                if (generatedFiles.length === 1) {
                    const finalPath = path.join(tmpDir, generatedFiles[0]);
                    cleanupFiles([file.path]);
                    sendFile(res, finalPath, 'page.png');
                } else {
                    const archiver = require('archiver');
                    const zipPath = path.join(tmpDir, `images-${Date.now()}.zip`);
                    const output = fs.createWriteStream(zipPath);
                    const archive = archiver('zip');

                    archive.pipe(output);

                    generatedFiles.forEach(f => {
                        archive.file(path.join(tmpDir, f), { name: f });
                    });

                    archive.finalize();

                    output.on('close', () => {
                        cleanupFiles([file.path, ...generatedFiles.map(f => path.join(tmpDir, f))]);
                        sendFile(res, zipPath, 'images.zip');
                    });
                }
            });

    } catch (error) {
        console.error('PDF to Image error:', error);
        res.status(500).json({ error: 'Failed to convert PDF to images' });
    }
};
