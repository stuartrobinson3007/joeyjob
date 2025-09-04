import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

const config = defineConfig({
  plugins: [
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart({
      customViteReactPlugin: true,
    }),
    viteReact(),
  ],
  optimizeDeps: {
    include: ['@taali/ui']
  },
  resolve: {
    alias: {
      '@/lib/utils': resolve(__dirname, './src/lib/utils')
    }
  },
  build: {
    rollupOptions: {
      external: ['@web-std/file']
    }
  }
})

export default config
