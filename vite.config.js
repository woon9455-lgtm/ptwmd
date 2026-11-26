import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173, open: false },
  preview: { port: 4173 },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
});
