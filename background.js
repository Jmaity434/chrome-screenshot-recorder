// Service worker - required for Manifest V3
// Currently minimal. All capture logic lives in popup.js for simplicity and reliability.

chrome.runtime.onInstalled.addListener(() => {
  console.log('1080p Screenshot & Screen Recorder installed.');
});
