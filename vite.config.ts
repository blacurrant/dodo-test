import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // The o200k vocabulary is a single ~2 MB chunk (1 MB gzipped). It's loaded lazily after
    // first paint, so the default 500 kB warning is noise here.
    chunkSizeWarningLimit: 2100,
    rollupOptions: {
      // Two pages: the dodo-play toy at /, and the first idea kept as scrap at /scrap/.
      input: { main: 'index.html', scrap: 'scrap/index.html' },
    },
  },
});
