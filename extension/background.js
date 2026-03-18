// ── Background Service Worker ───────────────────────────────────────────
// Opens the welcome page when the extension is first installed.

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'welcome.html' });
  }
});
