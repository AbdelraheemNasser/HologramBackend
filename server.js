const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const imageProcessor = require('./services/imageProcessor');
const povConverter = require('./services/povConverter');

const app = express();
const PORT = process.env.PORT || 3000;
const LED_COUNT = parseInt(process.env.LED_COUNT) || 50;
const MOTOR_RPM = parseInt(process.env.MOTOR_RPM) || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/processed', express.static('processed'));

// Create directories if they don't exist
const initDirectories = async () => {
  const dirs = ['uploads', 'processed', 'temp'];
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      console.error(`Error creating directory ${dir}:`, err);
    }
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG, GIF) are allowed!'));
    }
  }
});

// Store processed images metadata
let processedImages = {};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Hologram POV Backend is running',
    config: {
      ledCount: LED_COUNT,
      motorRPM: MOTOR_RPM
    }
  });
});

// Upload and process image/GIF
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`📤 File uploaded: ${req.file.filename}`);
    
    const filePath = req.file.path;
    const fileId = path.parse(req.file.filename).name;
    const isGif = req.file.mimetype === 'image/gif';

    // Process the image/GIF
    let frames;
    if (isGif) {
      console.log('🎬 Processing GIF...');
      frames = await imageProcessor.extractGifFrames(filePath);
    } else {
      console.log('🖼️ Processing static image...');
      frames = await imageProcessor.processStaticImage(filePath);
    }

    console.log(`✅ Extracted ${frames.length} frame(s)`);

    // Convert frames to POV data
    console.log('🔄 Converting to POV data...');
    const povData = await povConverter.convertFramesToPOV(frames, LED_COUNT, MOTOR_RPM);

    // Save POV data
    const povFilePath = path.join('processed', `${fileId}.json`);
    await fs.writeFile(povFilePath, JSON.stringify(povData, null, 2));

    // Store metadata
    processedImages[fileId] = {
      id: fileId,
      originalName: req.file.originalname,
      filename: req.file.filename,
      isGif: isGif,
      frameCount: frames.length,
      povDataPath: povFilePath,
      uploadedAt: new Date().toISOString(),
      ledCount: LED_COUNT,
      motorRPM: MOTOR_RPM
    };

    console.log('✨ Processing complete!');

    res.json({
      success: true,
      message: 'File processed successfully',
      data: {
        fileId: fileId,
        frameCount: frames.length,
        isGif: isGif,
        povDataUrl: `/api/pov/${fileId}`,
        previewUrl: `/uploads/${req.file.filename}`
      }
    });

  } catch (error) {
    console.error('❌ Error processing file:', error);
    res.status(500).json({
      error: 'Failed to process file',
      message: error.message
    });
  }
});

// Get POV data for ESP32
app.get('/api/pov/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const frame = parseInt(req.query.frame) || 0;

    const metadata = processedImages[fileId];
    if (!metadata) {
      return res.status(404).json({ error: 'File not found' });
    }

    const povFilePath = metadata.povDataPath;
    const povDataRaw = await fs.readFile(povFilePath, 'utf-8');
    const povData = JSON.parse(povDataRaw);

    // Return specific frame or all data
    if (req.query.frame !== undefined) {
      if (frame >= povData.frames.length) {
        return res.status(400).json({ error: 'Frame index out of range' });
      }
      res.json({
        fileId: fileId,
        frameIndex: frame,
        totalFrames: povData.frames.length,
        frame: povData.frames[frame]
      });
    } else {
      res.json(povData);
    }

  } catch (error) {
    console.error('❌ Error retrieving POV data:', error);
    res.status(500).json({
      error: 'Failed to retrieve POV data',
      message: error.message
    });
  }
});

// Get list of all processed images
app.get('/api/images', (req, res) => {
  const imageList = Object.values(processedImages).map(img => ({
    id: img.id,
    originalName: img.originalName,
    isGif: img.isGif,
    frameCount: img.frameCount,
    uploadedAt: img.uploadedAt,
    povDataUrl: `/api/pov/${img.id}`,
    previewUrl: `/uploads/${img.filename}`
  }));

  res.json({
    count: imageList.length,
    images: imageList
  });
});

// Get latest uploaded image (for ESP32 to auto-fetch)
app.get('/api/latest', async (req, res) => {
  try {
    const images = Object.values(processedImages);
    if (images.length === 0) {
      return res.status(404).json({ error: 'No images available' });
    }

    // Sort by upload time and get latest
    images.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    const latest = images[0];

    const povFilePath = latest.povDataPath;
    const povDataRaw = await fs.readFile(povFilePath, 'utf-8');
    const povData = JSON.parse(povDataRaw);

    // For ESP32: Only send first frame to avoid memory issues
    // ESP32 can request more frames individually if needed
    const firstFrameOnly = {
      fileId: latest.id,
      originalName: latest.originalName,
      isGif: latest.isGif,
      uploadedAt: latest.uploadedAt,
      config: povData.config,
      frameCount: povData.frameCount,
      frames: [povData.frames[0]] // Only first frame
    };

    res.json(firstFrameOnly);

  } catch (error) {
    console.error('❌ Error retrieving latest image:', error);
    res.status(500).json({
      error: 'Failed to retrieve latest image',
      message: error.message
    });
  }
});

// ESP32-friendly endpoint with minimal data
app.get('/api/esp32/latest', async (req, res) => {
  try {
    const images = Object.values(processedImages);
    if (images.length === 0) {
      return res.status(404).json({ error: 'No images available' });
    }

    // Sort by upload time and get latest
    images.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    const latest = images[0];

    const povFilePath = latest.povDataPath;
    const povDataRaw = await fs.readFile(povFilePath, 'utf-8');
    const povData = JSON.parse(povDataRaw);

    // Send only config and first 5 slices for testing
    const minimalData = {
      config: povData.config,
      frameCount: povData.frameCount,
      frames: [{
        sliceCount: Math.min(5, povData.frames[0].sliceCount),
        slices: povData.frames[0].slices.slice(0, 5)
      }]
    };

    res.json(minimalData);

  } catch (error) {
    console.error('❌ Error retrieving latest image:', error);
    res.status(500).json({
      error: 'Failed to retrieve latest image',
      message: error.message
    });
  }
});

// Delete image
app.delete('/api/images/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const metadata = processedImages[fileId];

    if (!metadata) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete files
    await fs.unlink(path.join('uploads', metadata.filename));
    await fs.unlink(metadata.povDataPath);

    delete processedImages[fileId];

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting image:', error);
    res.status(500).json({
      error: 'Failed to delete image',
      message: error.message
    });
  }
});

// Start server
const startServer = async () => {
  await initDirectories();
  await loadExistingFiles();
  
  app.listen(PORT, () => {
    console.log('🚀 ========================================');
    console.log(`🌟 Hologram POV Backend Server Started`);
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`💡 LED Count: ${LED_COUNT}`);
    console.log(`⚡ Motor RPM: ${MOTOR_RPM}`);
    console.log(`📁 Loaded ${Object.keys(processedImages).length} existing images`);
    console.log('🚀 ========================================');
  });
};

// Load existing processed files on startup
const loadExistingFiles = async () => {
  try {
    const processedFiles = await fs.readdir('processed');
    const uploadedFiles = await fs.readdir('uploads');
    
    for (const file of processedFiles) {
      if (path.extname(file) === '.json') {
        const fileId = path.parse(file).name;
        const povFilePath = path.join('processed', file);
        
        // Find corresponding upload file
        const uploadFile = uploadedFiles.find(f => f.startsWith(fileId));
        
        if (uploadFile) {
          // Read POV data to get frame count
          const povDataRaw = await fs.readFile(povFilePath, 'utf-8');
          const povData = JSON.parse(povDataRaw);
          
          processedImages[fileId] = {
            id: fileId,
            originalName: uploadFile,
            filename: uploadFile,
            isGif: povData.frameCount > 1,
            frameCount: povData.frameCount,
            povDataPath: povFilePath,
            uploadedAt: new Date().toISOString(),
            ledCount: povData.config.ledCount,
            motorRPM: povData.config.motorRPM
          };
          
          console.log(`✓ Loaded: ${fileId} (${povData.frameCount} frames)`);
        }
      }
    }
  } catch (error) {
    console.log('ℹ️ No existing files to load or error loading:', error.message);
  }
};

startServer();
