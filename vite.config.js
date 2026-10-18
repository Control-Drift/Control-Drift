import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (
            id.includes('node_modules/three') ||
            id.includes('node_modules/@react-three') ||
            id.includes('node_modules/postprocessing') ||
            id.includes('node_modules/three-stdlib')
          ) {
            return 'vendor-three';
          }
          if (
            id.includes('node_modules/@react-pdf') ||
            id.includes('node_modules/pdfkit') ||
            id.includes('node_modules/fontkit') ||
            id.includes('node_modules/yoga-layout')
          ) {
            return 'vendor-pdf';
          }
          if (
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/d3-') ||
            id.includes('node_modules/@xyflow')
          ) {
            return 'vendor-charts';
          }
          if (
            id.includes('node_modules/@tiptap') ||
            id.includes('node_modules/prosemirror') ||
            id.includes('node_modules/marked') ||
            id.includes('node_modules/dompurify')
          ) {
            return 'vendor-editor';
          }
        }
      }
    }
  }
})
