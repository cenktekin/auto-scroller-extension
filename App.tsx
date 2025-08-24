
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ReaderSettings, ChromeMessage } from './types';
import { useReaderSettings } from './hooks/useChromeStorage';
import { Slider } from './components/Slider';
import { ColorButton } from './components/ColorButton';

const NEON_COLORS = ['#00ffff', '#39ff14', '#ff00ff', '#ff3366', '#fdda0d'];

const App: React.FC = () => {
  const [settings, updateSettings] = useReaderSettings();
  const toggleCountRef = useRef(0);
  console.log('Current settings:', settings);
  const [isContentScriptActive, setIsContentScriptActive] = useState(false);

  // Check for Chrome APIs availability.
  const isChromeApiAvailable = typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting && chrome.runtime;
  console.log('isChromeApiAvailable:', isChromeApiAvailable);
  if (!isChromeApiAvailable) {
    console.log('chrome.tabs:', typeof chrome !== 'undefined' ? chrome.tabs : 'chrome is undefined');
    console.log('chrome.scripting:', typeof chrome !== 'undefined' ? chrome.scripting : 'chrome is undefined');
    console.log('chrome.runtime:', typeof chrome !== 'undefined' ? chrome.runtime : 'chrome is undefined');
  }

  const sendMessageToContentScript = useCallback((message: ChromeMessage) => {
    if (!isChromeApiAvailable) {
      console.warn('Chrome APIs not available. Cannot send message to content script.');
      return;
    }

    console.log('sendMessageToContentScript called with:', message);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        const tabId = tabs[0].id;
        console.log('Target tab ID:', tabId);
        // First, ensure the content script is injected.
        chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        }).then(() => {
          console.log('Script injected successfully.');
          // Then, send the message.
          chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
              console.log("Could not establish connection. Assuming content script is not active yet.", chrome.runtime.lastError.message);
            } else if (response) {
              console.log('Received response from content script:', response);
              if (response.isScrolling !== undefined) {
                  updateSettings({ isScrolling: response.isScrolling });
              }
              setIsContentScriptActive(true);
            }
          });
        }).catch(err => console.error("Script injection failed: ", err));
      }
    });
  }, [isChromeApiAvailable, updateSettings]);
  
  // On popup open, check the status of the content script.
  useEffect(() => {
    console.log('useEffect triggered. isChromeApiAvailable:', isChromeApiAvailable);
    if (!isChromeApiAvailable) {
        console.warn('Chrome APIs not available. Skipping status check.');
        return;
    }

    console.log('Checking content script status...');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      console.log('Active tab query result:', tabs);
      if (tabs[0] && tabs[0].id) {
        const tabId = tabs[0].id;
        console.log('Injecting content script to tab:', tabId);
        // First, ensure the content script is injected.
        chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        }).then(() => {
          console.log('Script injected successfully for status check.');
          // Then, send the message.
          console.log('Sending GET_STATUS message to tab:', tabId);
          chrome.tabs.sendMessage(tabId, { type: 'GET_STATUS' }, (response) => {
            console.log('Received response for GET_STATUS:', response);
            console.log('Last error:', chrome.runtime.lastError);
            if (!chrome.runtime.lastError && response) {
              console.log('Content script is active. Current status:', response);
              updateSettings({ isScrolling: response.isScrolling });
              setIsContentScriptActive(true);
            } else {
               console.log('Content script is not active or not responding.');
               setIsContentScriptActive(false);
            }
          });
        }).catch(err => {
          console.error("Script injection failed for status check: ", err);
          setIsContentScriptActive(false);
        });
      } else {
        console.log('No active tab found or tab ID is missing.');
      }
    });
  }, [isChromeApiAvailable, updateSettings]);


  const handleToggleScrolling = () => {
    toggleCountRef.current++;
    console.log('handleToggleScrolling called. Count:', toggleCountRef.current);
    sendMessageToContentScript({ type: 'TOGGLE_SCROLL' });
  };
  
  const handleSettingChange = (update: Partial<ReaderSettings>) => {
    updateSettings(update);
    sendMessageToContentScript({ type: 'UPDATE_SETTINGS', payload: update });
  };

  return (
    <div className="p-4 bg-gray-800 text-gray-100 space-y-6 w-72">
      <header className="flex items-center justify-between pb-3 border-b border-gray-700">
        <h1 className="text-xl font-bold tracking-wider">AutoScroll Reader</h1>
        <div className={`w-3 h-3 rounded-full ${isContentScriptActive ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} title={isContentScriptActive ? 'Active' : 'Inactive'}></div>
      </header>
      
      <main className="space-y-4">
        <Slider
          label="Scroll Speed"
          min={0}
          max={10}
          value={settings.scrollSpeed}
          onChange={(e) => handleSettingChange({ scrollSpeed: parseInt(e.target.value, 10) })}
        />
        
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-2">Focus Line</h3>
          <div className="p-3 bg-gray-700/50 rounded-lg space-y-4">
            <Slider
              label="Thickness"
              min={1}
              max={50}
              value={settings.lineThickness}
              onChange={(e) => handleSettingChange({ lineThickness: parseInt(e.target.value, 10) })}
              unit="px"
            />
            <Slider
              label="Opacity"
              min={0}
              max={100}
              value={settings.lineOpacity}
              onChange={(e) => handleSettingChange({ lineOpacity: parseInt(e.target.value, 10) })}
              unit="%"
            />
            <div className="flex justify-around items-center pt-2">
              {NEON_COLORS.map(color => (
                <ColorButton
                  key={color}
                  color={color}
                  isSelected={settings.lineColor === color}
                  onClick={() => handleSettingChange({ lineColor: color })}
                />
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="pt-3 border-t border-gray-700">
        <button
          onClick={() => {
            console.log('Button clicked');
            handleToggleScrolling();
          }}
          className={`w-full py-3 text-lg font-semibold rounded-lg transition-colors duration-200 ${
            settings.isScrolling
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-cyan-500 hover:bg-cyan-600'
          }`}
        >
          {settings.isScrolling ? 'Stop Scrolling' : 'Start Scrolling'}
        </button>
        <p className="text-xs text-center text-gray-400 mt-2">Use Ctrl+Shift+S to toggle</p>
      </footer>
    </div>
  );
};

export default App;