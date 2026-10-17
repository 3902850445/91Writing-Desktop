import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'

  return {
    base: './',
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    server: {
      port: 7520,
      open: false
    },
    esbuild: isProd
      ? {
          drop: ['console', 'debugger'],
          legalComments: 'none'
        }
      : undefined,
    build: {
      target: 'es2018',
      cssCodeSplit: true,
      // Smaller assets on mobile WebView
      assetsInlineLimit: 2048,
      minify: 'esbuild',
      sourcemap: false,
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/vue') || id.includes('node_modules/vue-router')) {
              return 'vue'
            }
          }
        }
      },
      chunkSizeWarningLimit: 600
    }
  }
})

