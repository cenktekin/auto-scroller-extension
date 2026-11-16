export const ERROR_MESSAGES = {
  STORAGE_UNAVAILABLE: 'Chrome storage API is not available',
  STORAGE_LOAD_FAILED: 'Failed to load settings from storage',
  STORAGE_SAVE_FAILED: 'Failed to save settings to storage',
  DOM_MANIPULATION_FAILED: 'Failed to manipulate DOM element',
  SCROLL_OPERATION_FAILED: 'Failed to perform scroll operation',
  MESSAGE_HANDLING_FAILED: 'Failed to handle extension message',
} as const;

export const handleChromeError = (operation: string, error?: unknown): void => {
  console.error(`AutoScroll Reader ${operation} failed:`, error || 'Unknown error');
};

export const showUserError = (message: string): void => {
  console.error(`AutoScroll Reader Error: ${message}`);
};
