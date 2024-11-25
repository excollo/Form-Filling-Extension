chrome.runtime.onInstalled.addListener(() => {
  console.log("Excel to Form Auto-Fill extension installed.");
});

// Listener for content script injection
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkContentScript") {
    sendResponse({ status: "ready" });
  }
  return true;
});
