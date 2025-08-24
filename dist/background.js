chrome.runtime.onInstalled.addListener(() => {
  console.log("AutoScroll Reader installed.");
});
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-scroll") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_SCROLL" }, (response) => {
          if (chrome.runtime.lastError) {
            console.log("AutoScroll Reader: Content script not ready. Trying to inject.");
            if (tabs[0].id) {
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ["content.js"],
                world: "MAIN"
              }).then(() => {
                if (tabs[0].id) {
                  chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_SCROLL" });
                }
              }).catch((err) => console.error("Failed to inject script:", err));
            }
          }
        });
      }
    });
  }
});
