/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly VITE_API_URL?: string;
  readonly VITE_AUTO_LOGIN_TENANT?: string;
  readonly VITE_AUTO_LOGIN_EMAIL?: string;
  readonly VITE_AUTO_LOGIN_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
