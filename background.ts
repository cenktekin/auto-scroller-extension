

chrome.runtime.onInstalled.addListener(() => {
  console.log('AutoScroll Reader installed.');

  // Create context menu item to open PDFs with internal viewer
  chrome.contextMenus.create({
    id: 'open-with-autoscroll-viewer',
    title: 'Open with AutoScroll PDF Viewer',
    contexts: ['page', 'frame', 'link']
  });
});

// Listen for the command defined in manifest.json
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-scroll') {
    // Get the currently active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
        // Send a message to the content script in the active tab
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_SCROLL' }, (_response) => {
          if (chrome.runtime.lastError) {
            console.log("AutoScroll Reader: Content script not ready. Trying to inject.");
            // If content script is not there, inject it and then send the message again.
            if(tabs[0].id) {
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ['content.js'],
                world: "MAIN"
              }).then(() => {
                if(tabs[0].id) {
                  chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_SCROLL' });
                }
              }).catch(err => console.error("Failed to inject script:", err));
            }
          }
        });
      }
    });
  }
  if (command === 'toggle-reading-mode') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_READING_MODE' }, (_response) => {
          if (chrome.runtime.lastError) {
            // Inject then retry
            if (tabs[0].id) {
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ['content.js'],
                world: 'MAIN'
              }).then(() => {
                if (tabs[0].id) {
                  chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_READING_MODE' });
                }
              }).catch(err => console.error('Failed to inject script:', err));
            }
          }
        });
      }
    });
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'open-with-autoscroll-viewer') {
    const targetUrl = (info.linkUrl || info.pageUrl) ?? tab?.url;
    if (!targetUrl) return;
    // Simple PDF detection
    const isPdf = /\.pdf($|[?#])/i.test(targetUrl) || (tab?.url && /\.pdf($|[?#])/i.test(tab.url));
    if (!isPdf) {
      console.log('Selected resource does not look like a PDF. Opening anyway.');
    }
    const viewerUrl = chrome.runtime.getURL(`pdf-viewer.html?url=${encodeURIComponent(targetUrl)}`);
    chrome.tabs.create({ url: viewerUrl });
  }
});