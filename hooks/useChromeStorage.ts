
import { useState, useEffect, useCallback, SetStateAction } from 'react';
import type { ReaderSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

const SYNC_KEY = 'readerSettings_sync';
const SYNC_ENABLED_KEY = 'syncEnabled';

async function isSyncEnabled(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local)) {
      return resolve(false);
    }
    chrome.storage.local.get(SYNC_ENABLED_KEY, (result) => {
      resolve(result[SYNC_ENABLED_KEY] ?? true);
    });
  });
}

async function syncToCloud(settings: ReaderSettings): Promise<void> {
  const enabled = await isSyncEnabled();
  if (!enabled || !(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync)) {
    return;
  }
  
  try {
    await chrome.storage.sync.set({ [SYNC_KEY]: settings });
  } catch (error) {
    console.warn('AutoScroll Reader: Sync failed:', error);
  }
}

async function syncFromCloud(): Promise<ReaderSettings | null> {
  const enabled = await isSyncEnabled();
  if (!enabled || !(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync)) {
    return null;
  }
  
  try {
    const result = await chrome.storage.sync.get(SYNC_KEY);
    return result[SYNC_KEY] ?? null;
  } catch (error) {
    console.warn('AutoScroll Reader: Cloud sync read failed:', error);
    return null;
  }
}

export function useChromeStorage<T,>(
  key: string,
  defaultValue: T,
): [T, (newValue: SetStateAction<T>) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    if (!(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local)) {
      console.warn('chrome.storage.local is not available. Using default value.');
      return;
    }

    chrome.storage.local.get(key, async (result) => {
      if (chrome.runtime.lastError) {
        console.error(`Error getting storage key ${key}:`, chrome.runtime.lastError.message);
        return;
      }
      
      if (result[key] !== undefined) {
        setValue(result[key]);
      }
      
      if (key === 'readerSettings') {
        const cloudSettings = await syncFromCloud();
        if (cloudSettings) {
          const merged = {
            ...cloudSettings,
            isScrolling: result[key]?.isScrolling ?? false
          };
          setValue(merged as T);
          chrome.storage.local.set({ [key]: merged });
        }
      }
    });

    if (!chrome.storage.onChanged) {
      return;
    }

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
      if (namespace === 'local' && changes[key]) {
        // The content script and other tabs write to local storage; keep the popup in sync.
        setValue((changes[key].newValue ?? defaultValue) as T);
        return;
      }
      if (namespace === 'sync' && key === 'readerSettings' && changes[SYNC_KEY]) {
        const newSettings = changes[SYNC_KEY].newValue as ReaderSettings;
        if (newSettings) {
          setValue(current => ({
            ...newSettings,
            isScrolling: (current as ReaderSettings)?.isScrolling ?? false
          } as T));
        }
      }
    };
    chrome.storage.onChanged.addListener(listener);

    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, [key]);

  const setStoredValue = useCallback((newValue: SetStateAction<T>) => {
    setValue(currentValue => {
        const valueToStore = newValue instanceof Function ? newValue(currentValue) : newValue;

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ [key]: valueToStore }, () => {
            if (chrome.runtime.lastError) {
              console.error(`Error setting storage key ${key}:`, chrome.runtime.lastError.message);
            }
          });
          
          if (key === 'readerSettings') {
            syncToCloud(valueToStore as ReaderSettings);
          }
        } else {
          console.warn('chrome.storage.local is not available. State will not be persisted.');
        }

        return valueToStore;
    });
  }, [key]);

  return [value, setStoredValue];
}


export const useReaderSettings = () => {
    const [settings, setSettings] = useChromeStorage<ReaderSettings>('readerSettings', DEFAULT_SETTINGS);

    const updateSettings = useCallback((newSettings: Partial<ReaderSettings>) => {
        setSettings(prevSettings => ({ ...prevSettings, ...newSettings }));
    }, [setSettings]);
    
    return [settings, updateSettings] as const;
};
