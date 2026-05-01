/**
 * Convert processed frames to POV (Persistence of Vision) data structure
 * This creates angle-based slices for the rotating LED display
 */

const FULL_ROTATION = 360; // degrees

/**
 * Convert frames to POV data structure
 * @param {Array} frames - Array of processed frames with pixel data
 * @param {number} ledCount - Number of LEDs (60)
 * @param {number} motorRPM - Motor speed in RPM (3000)
 * @returns {Object} POV data structure with angle-based slices
 */
async function convertFramesToPOV(frames, ledCount = 60, motorRPM = 3000) {
  const povFrames = [];

  // Calculate timing information
  const rotationsPerSecond = motorRPM / 60;
  const millisecondsPerRotation = 1000 / rotationsPerSecond;
  const microsecondsPerRotation = millisecondsPerRotation * 1000;

  for (const frame of frames) {
    const { width, height, pixels } = frame;
    
    // Number of slices = width of image (each column becomes a slice)
    const sliceCount = width;
    const degreesPerSlice = FULL_ROTATION / sliceCount;
    const microsecondsPerSlice = microsecondsPerRotation / sliceCount;

    const slices = [];

    // Convert each column to a slice
    for (let x = 0; x < width; x++) {
      const angle = x * degreesPerSlice;
      const ledData = [];

      // Extract LED colors for this slice (column)
      for (let y = 0; y < height && y < ledCount; y++) {
        const pixel = pixels[y][x];
        ledData.push({
          r: pixel.r,
          g: pixel.g,
          b: pixel.b
        });
      }

      // Pad with black if we have fewer pixels than LEDs
      while (ledData.length < ledCount) {
        ledData.push({ r: 0, g: 0, b: 0 });
      }

      slices.push({
        angle: Math.round(angle * 100) / 100,
        leds: ledData
      });
    }

    povFrames.push({
      sliceCount: sliceCount,
      slices: slices
    });
  }

  return {
    config: {
      ledCount: ledCount,
      motorRPM: motorRPM,
      rotationsPerSecond: rotationsPerSecond,
      millisecondsPerRotation: Math.round(millisecondsPerRotation * 100) / 100,
      microsecondsPerRotation: Math.round(microsecondsPerRotation)
    },
    frameCount: povFrames.length,
    frames: povFrames
  };
}

module.exports = {
  convertFramesToPOV
};
