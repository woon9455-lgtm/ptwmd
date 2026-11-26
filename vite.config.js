import { defineConfig } from 'vite';

export default defineConfig({
  // /api 요청은 로컬 Cloudflare(wrangler pages dev, 8799)로 넘긴다 — `npm run dev`가 둘 다 띄움
  // changeOrigin: false → 서버가 브라우저 주소(Host)를 그대로 보고 다른 사이트 요청을 막을 수 있게
  server: { port: 5173, open: false, proxy: { '/api': { target: 'http://127.0.0.1:8799', changeOrigin: false } } },
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
