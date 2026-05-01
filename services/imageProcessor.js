const sharp = require('sharp');
const gifFrames = require('gif-frames');
const fs = require('fs').promises;
const path = require('path');

/**
 * Extract frames from GIF file
 */
async function extractGifFrames(gifPath) {
  try {
    const frameData = await gifFrames({
      url: gifPath,
      frames: 'all',
      outputType: 'png'
    });

    const frames = [];
    
    for (let i = 0; i < frameData.length; i++) {
      const frame = frameData[i];
      const tempPath = path.join('temp', `frame_${Date.now()}_${i}.png`);
      
      // Save frame temporarily
      await new Promise((resolve, reject) => {
        const writeStream = require('fs').createWriteStream(tempPath);
        frame.getImage().pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      // Process frame with sharp
      const processedFrame = await processFrame(tempPath);
      frames.push(processedFrame);

      // Clean up temp file
      await fs.unlink(tempPath);
    }

    return frames;
  } catch (error) {
    console.error('Error extracting GIF frames:', error);
    throw error;
  }
}

/**
 * Process static image (single frame)
 */
async function processStaticImage(imagePath) {
  const processedFrame = await processFrame(imagePath);
  return [processedFrame];
}

/**
 * Process a single frame - resize and extract pixel data
 */
async function processFrame(framePath) {
  try {
    // Resize to 60 pixels height (for 60 LEDs)
    // Width will be proportional to maintain aspect ratio
    const image = sharp(framePath);
    const metadata = await image.metadata();
    
    // Calculate width to maintain aspect ratio
    const targetHeight = 60;
    const aspectRatio = metadata.width / metadata.height;
    const targetWidth = Math.round(targetHeight * aspectRatio);

    // Resize and get raw pixel data
    const resized = await image
      .resize(targetWidth, targetHeight, {
        fit: 'fill',
        kernel: sharp.kernel.lanczos3
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = resized;
    const pixels = [];

    // Convert raw buffer to RGB array
    for (let y = 0; y < info.height; y++) {
      const row = [];
      for (let x = 0; x < info.width; x++) {
        const idx = (y * info.width + x) * info.channels;
        row.push({
          r: data[idx],
          g: data[idx + 1],
          b: data[idx + 2]
        });
      }
      pixels.push(row);
    }

    return {
      width: info.width,
      height: info.height,
      pixels: pixels
    };

  } catch (error) {
    console.error('Error processing frame:', error);
    throw error;
  }
}

module.exports = {
  extractGifFrames,
  processStaticImage,
  processFrame
};
