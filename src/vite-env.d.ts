/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * Ambient type declarations for Vite virtual modules.
 *
 * `virtual:pwa-register` is injected by vite-plugin-pwa at build time. It
 * exposes a `registerSW(options)` factory we consume from
 * `src/components/ServiceWorkerUpdate.tsx`. The line above pulls in the
 * official client types so the import + callback signatures are typed.
 */
