import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { DEPLOY } from './deploy.config.js';

export default defineConfig({
  plugins: [react()],
  base: DEPLOY.base,
});
