import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import 'modern-normalize/modern-normalize.css'
// Design tokens MUST load before every other stylesheet so every var(--*)
// reference resolves on first paint. See src/styles/tokens.css.
import './styles/tokens.css'
import './index.css'
import './styles/mobile.css'
import './i18n'
import App from './App.tsx'

const rootNode = document.getElementById('root')!;
const tree = (
  <StrictMode>
    <App />
  </StrictMode>
);

// Auto-detect prerendered content: if the server (or our build-time prerender
// script) baked content into #root, we HYDRATE on top of it. Otherwise —
// plain CSR boot. This lets the same bundle work for prerendered and
// non-prerendered routes in the same deploy.
if (rootNode.hasChildNodes()) {
  hydrateRoot(rootNode, tree);
} else {
  createRoot(rootNode).render(tree);
}
