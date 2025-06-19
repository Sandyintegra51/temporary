const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { extractTextFromImage, extractTextFromScannedPDF } = require('../extractor/aiApiCall');


const router = express.Router();
const upload = multer({ 
    dest: path.join(__dirname, '..', 'uploads'),
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype === 'application/pdf' ||
            file.mimetype.startsWith('image/')
        ) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF and image files are allowed.'));
        }
    }
});

// Image route
router.post('/upload-image', upload.single('file'), async (req, res) => {
  try {
    const text = await extractTextFromImage(req.file.path);
    console.log('AI Response (image):', text); // Log AI response
    res.json({ extractedText: text }); // Always return the AI's response
  } catch (error) {
    console.error('Image Processing Error:', error);
    res.status(500).json({ 
      error: 'Image processing failed', 
      details: error.message || 'Internal server error' 
    });
  }
});

// PDF route
router.post('/upload-scanned-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'Invalid file type. Only PDF files are allowed.' });
    }

    console.log('Starting PDF processing...');
    const text = await extractTextFromScannedPDF(req.file.path);
    console.log('AI Response (pdf):', text); // Log AI response
    res.json({ extractedText: text }); // Always return the AI's response
  } catch (error) {
    console.error('PDF Processing Error:', error);
    res.status(500).json({ 
      error: 'PDF processing failed', 
      details: error.message || 'Internal server error' 
    });
  }
});


module.exports = router;
