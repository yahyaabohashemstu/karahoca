import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // expose to LAN — access from phone via IP
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        // Split heavy third-party libs into their own async chunks so they
        // only load on pages that actually use them (AIChatWidget, FlipBook).
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('pdfjs-dist')) return 'pdfjs';
          if (id.includes('react-markdown') || id.includes('remark-') || id.includes('mdast-') || id.includes('micromark') || id.includes('unist-') || id.includes('hast-')) {
            return 'markdown';
          }
          if (id.includes('react-helmet-async')) return 'seo-vendor';
          if (id.includes('/react-dom/') || id.includes('\\react-dom\\')) return 'react-vendor';
          if (id.includes('/react/') || id.includes('\\react\\')) return 'react-vendor';
          if (id.includes('react-router')) return 'react-vendor';
          if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n-vendor';
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    minify: 'esbuild',
    reportCompressedSize: false,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'react-helmet-async'],
  },
})
