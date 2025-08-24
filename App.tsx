
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

    const isInjectableUrl = (url?: string) => {
      if (!url) return false;
      try {
        const u = new URL(url);
        const proto = u.protocol;
        const host = u.host;
        // Disallow browser/internal pages and web store
        if (proto === 'chrome:' || proto === 'edge:' || proto === 'opera:' || proto === 'about:') return false;
        if (proto === 'chrome-extension:') return false;
        if (host.endsWith('chrome.google.com') || host.endsWith('chromewebstore.google.com')) return false;
        // Allow http/https only for injection. file: would need explicit permission.
        return proto === 'http:' || proto === 'https:';
      } catch {
        return false;
      }
    };

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        const tabId = tabs[0].id;
        const tabUrl = (tabs[0] as any).url as string | undefined;
        if (!isInjectableUrl(tabUrl)) {
          console.warn('Skipping injection on restricted or unsupported URL:', tabUrl);
          setIsContentScriptActive(false);
          return;
        }
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

    const isInjectableUrl = (url?: string) => {
      if (!url) return false;
      try {
        const u = new URL(url);
        const proto = u.protocol;
        const host = u.host;
        if (proto === 'chrome:' || proto === 'edge:' || proto === 'opera:' || proto === 'about:') return false;
        if (proto === 'chrome-extension:') return false;
        if (host.endsWith('chrome.google.com') || host.endsWith('chromewebstore.google.com')) return false;
        return proto === 'http:' || proto === 'https:';
      } catch {
        return false;
      }
    };

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      console.log('Active tab query result:', tabs);
      if (tabs[0] && tabs[0].id) {
        const tabId = tabs[0].id;
        const tabUrl = (tabs[0] as any).url as string | undefined;
        if (!isInjectableUrl(tabUrl)) {
          console.log('Restricted URL detected, skipping status injection:', tabUrl);
          setIsContentScriptActive(false);
          return;
        }
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
  
  const handleOpenPdfViewer = () => {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.tabs) {
        console.warn('Chrome APIs not available to open PDF viewer.');
        return;
      }
      const url = chrome.runtime.getURL('pdf-viewer.html');
      chrome.tabs.create({ url });
    } catch (err) {
      console.error('Failed to open PDF viewer:', err);
    }
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

      <footer className="pt-3 border-t border-gray-700 space-y-3">
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
        <p className="text-xs text-center text-gray-400">Shortcut: Ctrl+Shift+S</p>

        <div className="flex items-center justify-between">
          <button
            onClick={handleOpenPdfViewer}
            className="w-full py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            style={{ width: '48%' }}
          >
            Open PDF Viewer
          </button>
          <button
            onClick={() => {
              console.log('Reading Mode toggle from popup');
              sendMessageToContentScript({ type: 'TOGGLE_READING_MODE' });
            }}
            className="py-2 text-sm font-medium rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-100 transition-colors"
            style={{ width: '48%' }}
          >
            Reading Mode
          </button>
        </div>
        <p className="text-[11px] text-center text-gray-400">Reading Mode shortcut: Ctrl+Shift+R</p>

        <div className="flex items-center justify-between">
          <a
            href="https://github.com/cenktekin"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-lg ring-1 ring-gray-600 ring-offset-2 ring-offset-gray-800 text-gray-100 hover:text-white transition-all"
            style={{ width: '20%', height: '40px' }}
            title="GitHub Repository"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.016c0 4.427 2.865 8.184 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.866-.014-1.699-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.907-.62.069-.607.069-.607 1.003.071 1.53 1.03 1.53 1.03.892 1.53 2.341 1.088 2.91.833.091-.647.35-1.088.636-1.339-2.221-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.989 1.029-2.689-.103-.253-.446-1.272.098-2.65 0 0 .84-.269 2.75 1.027A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.505.337 1.908-1.296 2.747-1.027 2.747-1.027.546 1.378.203 2.397.1 2.65.641.7 1.028 1.596 1.028 2.689 0 3.848-2.338 4.695-4.566 4.944.359.31.678.921.678 1.856 0 1.339-.012 2.419-.012 2.749 0 .268.18.58.688.481A10.022 10.022 0 0 0 22 12.016C22 6.484 17.523 2 12 2Z" clipRule="evenodd"/>
            </svg>
          </a>
          <a
            href="https://buymeacoffee.com/cenktekin"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 ml-2 py-2 text-sm font-semibold rounded-lg transition-all no-underline"
            style={{
              background: '#F59E0B',
              color: '#111827',
              textDecoration: 'none',
              boxShadow: '0 6px 14px rgba(245, 158, 11, 0.35)'
            }}
          >
            Buy me a coffee ☕
          </a>
        </div>
      </footer>
    </div>
  );
};

export default App;