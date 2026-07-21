export {};

declare global {
  interface Window {
    adept?: {
      queue: {
        enqueue: (item: unknown) => Promise<unknown>;
        getAll: () => Promise<unknown[]>;
        getPending: () => Promise<unknown[]>;
        markSynced: (id: string) => Promise<void>;
        markFailed: (id: string, error: string) => Promise<void>;
        remove: (id: string) => Promise<void>;
        clear: () => Promise<void>;
      };
      credentials: {
        set: (key: string, value: string) => Promise<void>;
        get: (key: string) => Promise<string | null>;
        delete: (key: string) => Promise<void>;
      };
      app: {
        getVersion: () => Promise<string>;
        openExternal: (url: string) => Promise<void>;
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
        checkOnline: () => Promise<boolean>;
        checkForUpdates: () => Promise<void>;
        installUpdate: () => Promise<void>;
      };
      pdf: {
        open: (url: string) => Promise<void>;
        download: (url: string, filename: string) => Promise<void>;
      };
      documents: {
        save: (fileName: string, base64: string) => Promise<string | null>;
      };
      on: (channel: string, callback: (...args: unknown[]) => void) => void;
      off: (channel: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}
