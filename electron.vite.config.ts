import { createRequire } from 'node:module'
import { resolve } from 'path'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const nodeRequire = createRequire(import.meta.url)
const processSubpathShim = nodeRequire.resolve('process')

const sharedRoot = resolve('src/shared')
const mainRoot = resolve('src/main')
const resourcesRoot = resolve('resources')

function rendererManualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined

  if (id.includes('@tanstack/react-router')) return 'vendor-router'
  if (
    id.includes('node_modules/react-dom') ||
    id.includes('node_modules\\react-dom') ||
    id.includes('node_modules/react/') ||
    id.includes('node_modules\\react\\')
  ) {
    return 'vendor-react'
  }
  if (id.includes('node_modules/motion') || id.includes('node_modules\\motion')) {
    return 'vendor-motion'
  }
  if (id.includes('@radix-ui')) return 'vendor-radix'
  if (id.includes('lucide-react')) return 'vendor-icons'
  if (
    id.includes('clsx') ||
    id.includes('tailwind-merge') ||
    id.includes('class-variance-authority')
  ) {
    return 'vendor-utils'
  }
  return undefined
}

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@main': mainRoot,
        '@shared': sharedRoot,
        '@resources': resourcesRoot,
        'process/': processSubpathShim
      }
    },
    build: {
      externalizeDeps: {
        exclude: ['archiver', 'electron-updater']
      },
      rollupOptions: {
        external: ['sharp']
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@shared': sharedRoot
      }
    }
  },
  renderer: {
    base: './',
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src'),
        '@shared': sharedRoot
      }
    },
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', 'motion', '@tanstack/react-router']
    },
    esbuild: {
      legalComments: 'none',
      treeShaking: true,
      drop: ['debugger']
    },
    build: {
      target: 'esnext',
      chunkSizeWarningLimit: 500,
      sourcemap: false,
      cssCodeSplit: true,
      assetsInlineLimit: 2048,
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          manualChunks: rendererManualChunks,
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      }
    }
  }
})
