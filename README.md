# ScreenStudio - 1080p Screenshot & Screen Recorder

A lightweight, high-performance Chrome extension for lossless screenshots and high-definition screen recordings, built with a modern **Light Theme Liquid Glass** design system.

**100% Client-Side • No Account Required • No Tracking • Works Instantly**

---

## Key Features

### 📷 Screenshot Suite
* **Visible Area**: One-click capture of your active viewport.
* **Full Page**: Automated scrolling and lossless canvas stitching with Device Pixel Ratio (DPI) awareness.
* **Select Area**: Interactive crosshair overlay with dimension indicator to crop any rectangular region.
* **3s Delay Capture**: Timed countdown for capturing dropdown menus, tooltips, or hover states.
* **Entire Screen**: Native display media snapshot for capturing outside the browser.

### 🎥 Screen Recording
* **Multiple Resolutions**: Record in **1080p Ultra HD**, **720p HD**, or **1440p 2K QHD**.
* **Audio Capture & Mixing**:
  * 🎤 Microphone recording (voiceover)
  * 🔊 System audio recording
  * Automatic multi-track audio mixing via Web Audio API (`AudioContext`).
* **Capture Sources**: Record entire monitor, specific application window, or current browser tab.
* **Background Recording**: Powered by Chrome Manifest V3 Offscreen Documents (`chrome.offscreen`) so you can switch tabs freely while recording continues.
* **Floating Liquid Control Bar**: Compact floating capsule with live pulsing indicator, elapsed timer, pause/resume, and stop & save controls.

### ✨ Liquid Glass Preview & Download Window
* **Instant Media Preview**: Inspect captures immediately before saving.
  * **Video**: Built-in HTML5 player with duration, resolution, and file size details.
  * **Screenshots**: High-resolution image preview with dimensions and file size.
* **Custom Filename**: Rename captures directly in the preview window.
* **One-Click Actions**:
  * **Download**: Save `.webm` video or `.png` image.
  * **Copy to Clipboard**: Copy screenshot images directly into system clipboard (`clipboardWrite`) for instant pasting into Slack, Discord, Docs, or email.

---

## Design System: Light Theme Liquid Glass

* **Liquid Acrylic Surfaces**: Translucent frosted glass layers (`backdrop-filter: blur(28px) saturate(190%)`) with dual inner specular reflections.
* **Ambient Lighting Mesh**: Organic pastel fluid light orbs providing natural liquid refraction through glass surfaces.
* **Interactive Micro-Animations**: Specular hover highlights, tactile button presses, and live pulsing status indicators.

---

## How to Install (Developer Mode)

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked**.
5. Select the project folder containing `manifest.json`.
6. The extension is now installed and ready to use!

---

## How to Use

### Taking a Screenshot
1. Click the extension icon in the toolbar.
2. Under the **Screenshot** tab, choose your desired mode:
   * **Visible Area**, **Full Page**, or **Select Area**
   * Or use **3s Delay** / **Entire Screen** under Advanced.
3. The **Preview & Download** window opens automatically.
4. Review your screenshot, edit the filename if desired, and click **Download** or **Copy Image**.

### Recording Video
1. Click the extension icon and select the **Record** tab.
2. Choose your capture source (*Entire Screen*, *Current Tab*, or *App Window*).
3. Toggle 🎤 **Mic** and 🔊 **System** audio as needed.
4. Select your quality preset (**1080p**, **720p**, or **1440p**).
5. Click **Start Recording** and choose the screen/window to share.
6. A floating liquid glass controls bar appears while you record. Use **⏸ Pause** / **▶ Resume** as needed.
7. Click **⏹ Stop** when finished. The preview window opens to play back and download your `.webm` file.

---

## Project Structure

```
chrome-screenshot-recorder/
├── manifest.json         # Extension Manifest V3 configuration & permissions
├── background.js         # Service worker: window management & region capture
├── offscreen.html        # Offscreen document entry point
├── offscreen.js          # Offscreen screen capture & Web Audio mixing
├── controls.html         # Floating liquid glass recording bar
├── controls.js           # Timer, pause/resume, and stop logic
├── popup.html            # Main extension popup interface
├── popup.css             # Light theme liquid glass styling for popup
├── popup.js              # Screenshot workflows & recording trigger
├── preview.html          # Interactive preview & download window
├── preview.css           # Liquid glass styling for preview interface
├── preview.js            # Preview player, download, and clipboard copy logic
├── db.js                 # Origin-shared IndexedDB storage for capture Blobs
├── content-script.js     # Drag-and-drop region selection overlay
├── icons/                # Extension icons (16x16, 48x48, 128x128)
└── README.md             # Project documentation
```

---

## Technical Stack

* **Architecture**: Chrome Manifest V3
* **Audio Engine**: Web Audio API (`AudioContext`, `createMediaStreamDestination`, `createMediaStreamSource`)
* **Video Capture**: `navigator.mediaDevices.getDisplayMedia` + `MediaRecorder` (VP9/VP8 WebM)
* **Storage**: Origin-scoped IndexedDB (zero memory limits, reliable Blob storage)
* **Design**: Vanilla CSS with modern Glassmorphism & custom backdrop filters
* **Privacy**: 100% local client execution, no third-party tracking, no network calls

---

## License

MIT License — Free to use, modify, and distribute.

