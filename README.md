# PDF Editor Pro - Backend API

Backend API for PDF Editor Pro, providing PDF manipulation services.

## Features

- ✅ Merge multiple PDFs
- ✅ Split PDF by page ranges
- ✅ Compress PDF files
- ✅ Rotate PDF pages
- ✅ Convert images to PDF
- ✅ Convert PDF to images (requires system dependencies)
- ✅ Add watermark to PDFs
- ✅ Extract text from PDFs
- ✅ Delete specific pages
- ✅ Reorder PDF pages

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/merge` | POST | Merge multiple PDFs |
| `/api/split` | POST | Split PDF by pages |
| `/api/compress` | POST | Compress PDF |
| `/api/rotate` | POST | Rotate PDF pages |
| `/api/image-to-pdf` | POST | Convert images to PDF |
| `/api/pdf-to-image` | POST | Convert PDF to images |
| `/api/watermark` | POST | Add watermark |
| `/api/extract-text` | POST | Extract text |
| `/api/delete-pages` | POST | Delete pages |
| `/api/reorder-pages` | POST | Reorder pages |

## Deployment on Render

1. Push this repository to GitHub
2. Create a new Web Service on Render
3. Connect your GitHub repository
4. Render will automatically detect `package.json` and deploy

### Render Configuration

- **Build Command**: `npm install`
- **Start Command**: `node server.js`
- **Environment**: Node.js

## Local Development

```bash
npm install
npm start
```

Server runs on `http://localhost:3000`

## Environment Variables

- `PORT` - Server port (default: 3000)

## Dependencies

- express - Web framework
- cors - CORS middleware
- multer - File upload handling
- pdf-lib - PDF manipulation
- pdf-parse - Text extraction
- archiver - ZIP creation

## License

MIT
