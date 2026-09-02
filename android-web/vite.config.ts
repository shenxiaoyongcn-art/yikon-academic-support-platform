import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const currentDirectory = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => ({
  root: currentDirectory,
  base: './',
  plugins: [react()],
  build: {
    outDir: path.resolve(currentDirectory, mode === 'web' ? '../web-dist' : '../android-app/app/src/main/assets'),
    emptyOutDir: true,
    target: 'es2017',
  },
}));
