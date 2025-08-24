/**
 * This file provides global type declarations for the Chrome Extension APIs used in this project.
 * By defining these types, we get static analysis and autocompletion in TypeScript,
 * which helps prevent common errors and improves code quality.
 * This is a minimal set of types based on the project's usage.
 * For a complete set, you would typically install `@types/chrome`.
 */

declare namespace chrome {
  namespace runtime {
    const lastError: { message: string } | undefined;

    const onInstalled: {
      addListener(callback: (details: any) => void): void;
    };

    const onMessage: {
      addListener(
        callback: (
          message: any,
          sender: any,
          sendResponse: (response?: any) => void
        ) => boolean | void
      ): void;
    };
  }

  namespace storage {
    interface StorageArea {
      get(
        keys: string | string[] | { [key: string]: any } | null,
        callback: (items: { [key: string]: any }) => void
      ): void;
      set(items: { [key: string]: any }, callback?: () => void): void;
    }

    const local: StorageArea;

    const onChanged: {
      addListener(
        callback: (
          changes: { [key: string]: any },
          areaName: 'local' | 'sync' | 'managed'
        ) => void
      ): void;
    };
  }

  namespace commands {
    const onCommand: {
      addListener(callback: (command: string) => void): void;
    };
  }

  namespace tabs {
    interface Tab {
      id?: number;
      // other tab properties
    }
    
    function query(
      queryInfo: { active?: boolean; currentWindow?: boolean },
      callback: (result: Tab[]) => void
    ): void;

    function sendMessage(
      tabId: number,
      message: any,
      responseCallback?: (response: any) => void
    ): void;
  }

  namespace scripting {
    interface ScriptInjection {
      target: { tabId: number };
      files: string[];
    }
    
    function executeScript(injection: ScriptInjection): Promise<any>;
  }
}
