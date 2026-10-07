import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Two pages: the Tokens toy at /, and the first idea kept as scrap at /scrap/.
      input: { main: 'index.html', scrap: 'scrap/index.html' },
    },
  },
});
