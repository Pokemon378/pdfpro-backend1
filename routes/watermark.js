const express = require('express');
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { cleanupFiles, validatePDF } = require('../utils/pdfUtils');

module.exports = (upload) => {
    const router = express.Router();

    router.post('/', upload.fields([
        { name: 'files', maxCount: 50 },
        { name: 'file', maxCount: 1 },
        { name: 'watermarkImage', maxCount: 1 }
    ]), async (req, res) => {
        try {
            // Handle both 'files' (array) and 'file' (single) for compatibility
            let pdfFiles = [];
            
            if (req.files) {
                if (req.files.files && Array.isArray(req.files.files)) {
                    pdfFiles = req.files.files;
                } else if (req.files.file) {
                    // Handle single file - could be array or single object
                    pdfFiles = Array.isArray(req.files.file) ? req.files.file : [req.files.file];
                }
            }
            
            if (pdfFiles.length === 0) {
                return res.status(400).json({ error: 'Please upload at least one PDF file' });
            }

            const { text, position = 'center', opacity = 0.5, fontSize = 50, color = '#000000' } = req.body;
            
            // Validate that text is provided
            if (!text || text.trim() === '') {
                const filePaths = pdfFiles.map(f => f.path);
                cleanupFiles(filePaths);
                return res.status(400).json({ error: 'Please provide watermark text' });
            }
            
            const filePaths = pdfFiles.map(f => f.path);
            const tempFiles = [];

            // Parse color
            const colorMatch = color.match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
            const textColor = colorMatch 
                ? rgb(parseInt(colorMatch[1], 16) / 255, parseInt(colorMatch[2], 16) / 255, parseInt(colorMatch[3], 16) / 255)
                : rgb(0, 0, 0);

            // Position mapping - returns function that calculates position
            const positions = {
                'center': (page) => {
                    const width = page.getWidth();
                    const height = page.getHeight();
                    return { x: width / 2, y: height / 2 };
                },
                'top-left': (page) => {
                    const height = page.getHeight();
                    return { x: 50, y: height - 50 };
                },
                'top-right': (page) => {
                    const width = page.getWidth();
                    const height = page.getHeight();
                    return { x: width - 50, y: height - 50 };
                },
                'bottom-left': (page) => {
                    return { x: 50, y: 50 };
                },
                'bottom-right': (page) => {
                    const width = page.getWidth();
                    return { x: width - 50, y: 50 };
                }
            };

            // Process single file
            if (pdfFiles.length === 1) {
                const file = pdfFiles[0];
                const filePath = file.path;

                // Validate PDF
                const validation = validatePDF(filePath);
                if (!validation.valid) {
                    cleanupFiles([filePath]);
                    return res.status(400).json({ error: 'Invalid PDF file' });
                }

                const pdfBytes = fs.readFileSync(filePath);
                const pdf = await PDFDocument.load(pdfBytes);
                const pages = pdf.getPages();
                const font = await pdf.embedFont(StandardFonts.HelveticaBold);

                pages.forEach(page => {
                    if (req.files?.watermarkImage && req.files.watermarkImage[0]) {
                        // Image watermark - would need proper implementation
                        // For now, skip image watermark
                    } else {
                        // Text watermark
                        const posFunc = positions[position] || positions['center'];
                        const pos = posFunc(page);
                        const fontSizeNum = Number(fontSize) || 50;
                        const opacityNum = Number(opacity) || 0.5;
                        
                        // Calculate text width for centering
                        const textWidth = font.widthOfTextAtSize(text, fontSizeNum);
                        const textHeight = font.heightAtSize(fontSizeNum);
                        
                        let x = pos.x;
                        let y = pos.y;
                        
                        // Adjust for center positioning
                        if (position === 'center') {
                            x = pos.x - textWidth / 2;
                            y = pos.y - textHeight / 2;
                        } else if (position === 'top-right' || position === 'bottom-right') {
                            x = pos.x - textWidth;
                        }
                        
                        page.drawText(text, {
                            x: x,
                            y: y,
                            size: fontSizeNum,
                            font: font,
                            color: textColor,
                            opacity: opacityNum,
                            rotate: degrees(-45)
                        });
                    }
                });

                const watermarkedBytes = await pdf.save();
                const outputPath = path.join(__dirname, '../uploads', `watermarked-${Date.now()}.pdf`);
                fs.writeFileSync(outputPath, watermarkedBytes);

                cleanupFiles([filePath]);
                if (req.files?.watermarkImage) {
                    cleanupFiles([req.files.watermarkImage[0].path]);
                }

                res.download(outputPath, 'watermarked.pdf', (err) => {
                    if (err) {
                        console.error('Download error:', err);
                    }
                    setTimeout(() => cleanupFiles([outputPath]), 5000);
                });
            } else {
                // Process multiple files - create zip
                const archiver = require('archiver');
                const zipPath = path.join(__dirname, '../uploads', `watermarked-${Date.now()}.zip`);
                const output = fs.createWriteStream(zipPath);
                const archive = archiver('zip', { zlib: { level: 9 } });

                archive.pipe(output);

                archive.on('error', (err) => {
                    console.error('Archive error:', err);
                    cleanupFiles([...filePaths, ...tempFiles]);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Failed to create zip file: ' + err.message });
                    }
                });

                for (const file of pdfFiles) {
                    const filePath = file.path;

                    // Validate PDF
                    const validation = validatePDF(filePath);
                    if (!validation.valid) {
                        continue;
                    }

                    try {
                        const pdfBytes = fs.readFileSync(filePath);
                        const pdf = await PDFDocument.load(pdfBytes);
                        const pages = pdf.getPages();
                        const font = await pdf.embedFont(StandardFonts.HelveticaBold);

                        pages.forEach(page => {
                            const posFunc = positions[position] || positions['center'];
                            const pos = posFunc(page);
                            const fontSizeNum = Number(fontSize) || 50;
                            const opacityNum = Number(opacity) || 0.5;
                            
                            // Calculate text width for centering
                            const textWidth = font.widthOfTextAtSize(text, fontSizeNum);
                            const textHeight = font.heightAtSize(fontSizeNum);
                            
                            let x = pos.x;
                            let y = pos.y;
                            
                            // Adjust for center positioning
                            if (position === 'center') {
                                x = pos.x - textWidth / 2;
                                y = pos.y - textHeight / 2;
                            } else if (position === 'top-right' || position === 'bottom-right') {
                                x = pos.x - textWidth;
                            }
                            
                            page.drawText(text, {
                                x: x,
                                y: y,
                                size: fontSizeNum,
                                font: font,
                                color: textColor,
                                opacity: opacityNum,
                                rotate: degrees(-45)
                            });
                        });

                        const watermarkedBytes = await pdf.save();
                        const tempPath = path.join(__dirname, '../uploads', `temp-watermarked-${Date.now()}-${file.originalname}`);
                        fs.writeFileSync(tempPath, watermarkedBytes);
                        tempFiles.push(tempPath);

                        archive.file(tempPath, { name: `watermarked-${file.originalname}` });
                    } catch (err) {
                        console.error(`Error processing ${file.originalname}:`, err);
                    }
                }

                await archive.finalize();
                cleanupFiles(filePaths);
                if (req.files?.watermarkImage) {
                    cleanupFiles([req.files.watermarkImage[0].path]);
                }

                output.on('close', () => {
                    res.download(zipPath, 'watermarked-pdfs.zip', (err) => {
                        if (err) {
                            console.error('Download error:', err);
                        }
                        setTimeout(() => {
                            cleanupFiles([zipPath, ...tempFiles]);
                        }, 5000);
                    });
                });

                output.on('error', (err) => {
                    console.error('Output stream error:', err);
                    cleanupFiles([...filePaths, zipPath, ...tempFiles]);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Failed to create zip file: ' + err.message });
                    }
                });
            }
        } catch (error) {
            console.error('Watermark error:', error);
            if (req.files) {
                const filePaths = [];
                if (req.files.files) filePaths.push(...req.files.files.map(f => f.path));
                if (req.files.file) filePaths.push(req.files.file[0].path);
                if (req.files.watermarkImage) filePaths.push(req.files.watermarkImage[0].path);
                cleanupFiles(filePaths);
            }
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to add watermark: ' + error.message });
            }
        }
    });

    return router;
};

