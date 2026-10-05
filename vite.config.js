import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { DEPLOY } from './deploy.config.js';

export default defineConfig({
  plugins: [react()],
  // VITE_BASE overrides the base for the /dev/ preview build (see deploy-dev.yml)
  base: process.env.VITE_BASE || DEPLOY.base,
  ...(DEPLOY.assetsDir ? { build: { assetsDir: DEPLOY.assetsDir } } : {}),
});
