
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ReaderSettings, ChromeMessage } from './types';
import { useReaderSettings } from './hooks/useChromeStorage';
import { Slider } from './components/Slider';
import { ColorButton } from './components/ColorButton';
import { isInjectableUrl } from './utils';

const NEON_COLORS = ['#00ffff', '#39ff14', '#ff00ff', '#ff3366', '#fdda0d'];

const App: React.FC = () => {
  const [settings, updateSettings] = useReaderSettings();
  const toggleCountRef = useRef(0);
  const [isContentScriptActive, setIsContentScriptActive] = useState(false);

  const isChromeApiAvailable = typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting && chrome.runtime;

  const sendMessageToContentScript = useCallback((message: ChromeMessage) => {
    if (!isChromeApiAvailable) {
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        const tabId = tabs[0].id;
        const tabUrl = (tabs[0] as any).url as string | undefined;
        if (!isInjectableUrl(tabUrl)) {
          setIsContentScriptActive(false);
          return;
        }
        chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        }).then(() => {
          chrome.tabs.sendMessage(tabId, message, (response) => {
            if (!chrome.runtime.lastError && response) {
              if (response.isScrolling !== undefined) {
                  updateSettings({ isScrolling: response.isScrolling });
              }
              setIsContentScriptActive(true);
            }
          });
        }).catch(() => {});
      }
    });
  }, [isChromeApiAvailable, updateSettings]);
  
  useEffect(() => {
    if (!isChromeApiAvailable) {
        return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        const tabId = tabs[0].id;
        const tabUrl = (tabs[0] as any).url as string | undefined;
        if (!isInjectableUrl(tabUrl)) {
          setIsContentScriptActive(false);
          return;
        }
        chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        }).then(() => {
          chrome.tabs.sendMessage(tabId, { type: 'GET_STATUS' }, (response) => {
            if (!chrome.runtime.lastError && response) {
              updateSettings({ isScrolling: response.isScrolling });
              setIsContentScriptActive(true);
            } else {
               setIsContentScriptActive(false);
            }
          });
        }).catch(() => {
          setIsContentScriptActive(false);
        });
      }
    });
  }, [isChromeApiAvailable, updateSettings]);


  const handleToggleScrolling = () => {
    toggleCountRef.current++;
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
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-300">Direction</span>
          <div className="flex gap-1">
            <button
              onClick={() => handleSettingChange({ scrollDirection: 'up' })}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                settings.scrollDirection === 'up'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              ↑ Up
            </button>
            <button
              onClick={() => handleSettingChange({ scrollDirection: 'down' })}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                settings.scrollDirection === 'down'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              ↓ Down
            </button>
          </div>
        </div>
        
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
            <Slider
              label="Position"
              min={10}
              max={90}
              value={settings.focusLinePosition}
              onChange={(e) => handleSettingChange({ focusLinePosition: parseInt(e.target.value, 10) })}
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
          onClick={handleToggleScrolling}
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
            onClick={() => sendMessageToContentScript({ type: 'TOGGLE_READING_MODE' })}
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