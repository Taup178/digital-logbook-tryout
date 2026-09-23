/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_AUTH_SERVICE_URL: string;
  readonly VITE_DASHBOARD_SERVICE_URL: string;
  readonly VITE_PROJECT_SERVICE_URL: string;
  readonly VITE_API_GATEWAY_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
