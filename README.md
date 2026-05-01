# Hologram POV Backend Server

Node.js backend server that processes images/GIFs and converts them to POV (Persistence of Vision) data for ESP32 hologram display.

![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)
![Express](https://img.shields.io/badge/Express-4.18-blue.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

## 🌟 Features

- ✅ Upload images (JPEG, PNG) and GIFs
- ✅ Automatic frame extraction from GIFs
- ✅ Convert images to angle-based POV data structure
- ✅ REST API for ESP32 to fetch POV data
- ✅ Optimized for 60 LEDs WS2812B strip
- ✅ Configured for 3000 RPM motor speed

## 📋 Prerequisites

- Node.js 16 or higher
- npm or yarn

## 🚀 Installation

```bash
# Clone the repository
git clone git@github.com:AbdelraheemNasser/HologramBackend.git
cd HologramBackend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your settings
# PORT=3000
# LED_COUNT=60
# MOTOR_RPM=3000

# Start the server
npm start
```

## 📡 API Endpoints

### 1. Health Check
```
GET /api/health
```

### 2. Upload Image/GIF
```
POST /api/upload
Content-Type: multipart/form-data
Body: file (image/gif)
```

Response:
```json
{
  "success": true,
  "data": {
    "fileId": "uuid",
    "frameCount": 10,
    "isGif": true,
    "povDataUrl": "/api/pov/uuid"
  }
}
```

### 3. Get POV Data (for ESP32)
```
GET /api/pov/:fileId
GET /api/pov/:fileId?frame=0
```

### 4. Get Latest Image (ESP32 auto-fetch)
```
GET /api/latest
```

### 5. List All Images
```
GET /api/images
```

### 6. Delete Image
```
DELETE /api/images/:fileId
```

## 🔧 Configuration

Create a `.env` file:

```env
PORT=3000
LED_COUNT=60
MOTOR_RPM=3000
UPLOAD_DIR=./uploads
PROCESSED_DIR=./processed
```

## 📊 POV Data Structure

The server converts images to this structure:

```json
{
  "config": {
    "ledCount": 60,
    "motorRPM": 3000,
    "rotationsPerSecond": 50,
    "millisecondsPerRotation": 20,
    "microsecondsPerRotation": 20000
  },
  "frameCount": 1,
  "frames": [
    {
      "sliceCount": 120,
      "slices": [
        {
          "angle": 0,
          "leds": [
            {"r": 255, "g": 0, "b": 0},
            {"r": 0, "g": 255, "b": 0},
            ...
          ]
        }
      ]
    }
  ]
}
```

## 🏗️ Project Structure

```
backend/
├── server.js              # Main server file
├── services/
│   ├── imageProcessor.js  # Image/GIF processing
│   └── povConverter.js    # POV data conversion
├── uploads/               # Uploaded files
├── processed/             # POV JSON files
├── temp/                  # Temporary files
├── package.json           # Dependencies
├── .env.example           # Environment template
└── README.md
```

## 🔄 How It Works

1. **Upload**: Client uploads image/GIF
2. **Extract**: Server extracts frames from GIF (or single frame from image)
3. **Resize**: Each frame is resized to 60 pixels height (for 60 LEDs)
4. **Convert**: Each column of pixels becomes an angle slice
5. **Store**: POV data is stored as JSON
6. **Serve**: ESP32 fetches POV data via REST API

## 🧪 Testing

Test the server:

```bash
# Health check
curl http://localhost:3000/api/health

# Upload image
curl -X POST -F "file=@image.jpg" http://localhost:3000/api/upload

# Get latest
curl http://localhost:3000/api/latest
```

## 📦 Dependencies

- **express**: Web framework
- **multer**: File upload handling
- **sharp**: Image processing
- **gif-frames**: GIF frame extraction
- **cors**: Cross-origin requests
- **dotenv**: Environment variables
- **uuid**: Unique ID generation

## 🐛 Troubleshooting

### Server won't start
- Check if port 3000 is already in use
- Verify Node.js version: `node --version` (need 16+)
- Check all dependencies installed: `npm install`

### Image processing fails
- Verify image file is valid
- Check uploads/ and processed/ folders exist
- Check server logs for specific error

### ESP32 can't connect
- Verify server IP address
- Check firewall settings
- Ensure ESP32 and server on same network

## 🔗 Related Repositories

- **Mobile App**: https://github.com/AbdelraheemNasser/HologramMobileApp
- **ESP32 Firmware**: https://github.com/AbdelraheemNasser/HologramESP32

## 📄 License

MIT License - Feel free to use and modify!

## 👨‍💻 Author

Abdelraheem Nasser

## 🙏 Acknowledgments

- FastLED library for LED control
- Sharp for image processing
- Express.js for web framework
