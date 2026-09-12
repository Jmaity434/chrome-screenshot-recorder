# 1080p Screenshot & Screen Recorder

A clean, lightweight Chrome extension for high-quality screenshots and screen recording.

**No account. No backend. Works instantly after install.**

## Features

- **Screenshot** – Capture the visible tab as a high-quality PNG
- **Screen Recording** – Record any tab, window, or entire screen at **1080p** (1920×1080)
- **System audio** support (when available)
- Instant download – files are saved directly to your Downloads folder
- Zero setup – no sign-up, no login, no cloud

## How to Install (Developer Mode)

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the folder of this project
6. Done! The extension icon will appear in your toolbar

## How to Use

### Take a Screenshot
1. Open any webpage
2. Click the extension icon
3. Press **Capture Visible Tab**
4. The PNG is automatically downloaded

### Record Screen / Tab
1. Click the extension icon
2. Press **Start Recording**
3. Choose what to share (Chrome tab / Window / Entire Screen)
4. Recording starts at 1080p
5. Press **Stop Recording** when finished
6. The `.webm` video is downloaded automatically

> **Tip:** Keep the extension popup open while recording, or stop sharing from the Chrome sharing bar.

## Technical Notes

- Manifest V3
- Uses `chrome.tabs.captureVisibleTab` for screenshots
- Uses `getDisplayMedia` + `MediaRecorder` (VP9) for recording
- Target quality: 1920×1080 @ ~8 Mbps
- No external servers, no tracking, no accounts

## Project Structure

```
chrome-screenshot-recorder/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── background.js
└── README.md
```

## License

MIT – free to use and modify.
