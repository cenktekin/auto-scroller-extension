
import { useState, useEffect, useCallback, SetStateAction } from 'react';
import type { ReaderSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

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

    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) {
        console.error(`Error getting storage key ${key}:`, chrome.runtime.lastError.message);
        return;
      }
      if (result[key] !== undefined) {
        setValue(result[key]);
      }
    });
  }, [key]);

  const setStoredValue = useCallback((newValue: SetStateAction<T>) => {
    // We use the functional update form of `useState`'s setter.
    // This allows us to get the latest state value to calculate the new state,
    // without needing to add the state value itself to `useCallback`'s dependency array.
    // This keeps the `setStoredValue` function stable across re-renders.
    setValue(currentValue => {
        const valueToStore = newValue instanceof Function ? newValue(currentValue) : newValue;

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ [key]: valueToStore }, () => {
            if (chrome.runtime.lastError) {
              console.error(`Error setting storage key ${key}:`, chrome.runtime.lastError.message);
            }
          });
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
        // Use functional update to get the latest state without needing it as a dependency.
        setSettings(prevSettings => ({ ...prevSettings, ...newSettings }));
    }, [setSettings]);
    
    return [settings, updateSettings] as const;
};
