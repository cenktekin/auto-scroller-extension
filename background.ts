

chrome.runtime.onInstalled.addListener(() => {
  console.log('AutoScroll Reader installed.');
});

// Listen for the command defined in manifest.json
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-scroll') {
    // Get the currently active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
        // Send a message to the content script in the active tab
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_SCROLL' }, (response) => {
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
});