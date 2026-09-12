# 1080p Screenshot & Screen Recorder

A clean, lightweight Chrome extension for high-quality screenshots and screen recording.

**No account. No backend. Works instantly after install.**

## Features

### Screenshot
- **Visible Area** – Capture exactly what you see on screen
- **Full Page** – Automatically scrolls and stitches the entire page
- **Select Area** – Draw a box to capture only a specific region

### Screen Recording
- Record any Chrome tab, window, or entire screen at **1080p**
- System audio support
- **Persistent recording window** – you can freely switch tabs and work while recording continues
- Instant download as `.webm`

## How to Install (Developer Mode)

1. Download or clone this repository
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the project folder (the one that contains `manifest.json`)
6. Done!

## How to Use

### Screenshot
1. Click the extension icon
2. Choose one of the three options:
   - **Visible Area**
   - **Full Page**
   - **Select Area** (then drag on the page)
3. The PNG is automatically downloaded

### Screen Recording
1. Click the extension icon
2. Press **Start Recording**
3. A small floating window will open
4. Choose what to share (tab / window / screen)
5. You can now freely switch tabs and work — recording continues
6. Click **Stop & Save** in the small window when finished

## Technical Notes

- Manifest V3
- Screenshot: `chrome.tabs.captureVisibleTab` + OffscreenCanvas cropping/stitching
- Recording: `getDisplayMedia` + MediaRecorder (VP9) inside a persistent popup window
- Target quality: 1920×1080 @ ~8 Mbps
- No external servers, no tracking, no accounts

## Project Structure

```
chrome-screenshot-recorder/
├── manifest.json
├── popup.html / popup.css / popup.js
├── recorder.html / recorder.js      ← persistent recording window
├── content-script.js               ← region selection overlay
├── background.js
└── README.md
```

## License

MIT – free to use and modify.
