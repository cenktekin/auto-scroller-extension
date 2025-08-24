chrome.runtime.onInstalled.addListener(() => {
  console.log("AutoScroll Reader installed.");
  chrome.contextMenus.create({
    id: "open-with-autoscroll-viewer",
    title: "Open with AutoScroll PDF Viewer",
    contexts: ["page", "frame", "link"]
  });
});
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-scroll") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_SCROLL" }, (_response) => {
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
  if (command === "toggle-reading-mode") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_READING_MODE" }, (_response) => {
          if (chrome.runtime.lastError) {
            if (tabs[0].id) {
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ["content.js"],
                world: "MAIN"
              }).then(() => {
                if (tabs[0].id) {
                  chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_READING_MODE" });
                }
              }).catch((err) => console.error("Failed to inject script:", err));
            }
          }
        });
      }
    });
  }
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open-with-autoscroll-viewer") {
    const targetUrl = (info.linkUrl || info.pageUrl) ?? (tab == null ? void 0 : tab.url);
    if (!targetUrl) return;
    const isPdf = /\.pdf($|[?#])/i.test(targetUrl) || (tab == null ? void 0 : tab.url) && /\.pdf($|[?#])/i.test(tab.url);
    if (!isPdf) {
      console.log("Selected resource does not look like a PDF. Opening anyway.");
    }
    const viewerUrl = chrome.runtime.getURL(`pdf-viewer.html?url=${encodeURIComponent(targetUrl)}`);
    chrome.tabs.create({ url: viewerUrl });
  }
});
