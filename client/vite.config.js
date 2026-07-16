import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies API + websocket to the Express server. Defaults to the
// local server (matches server PORT=5006) so `npm run dev` works out of the box.
// To develop the client against a remote/staging backend instead, set
// VITE_API_TARGET, e.g. VITE_API_TARGET=http://grn.salestracker.in:5006
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_TARGET || 'http://localhost:5006';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': target,
        '/socket.io': { target, ws: true },
      },
    },
  };
});
