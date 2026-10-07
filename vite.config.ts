import basicSsl from '@vitejs/plugin-basic-ssl';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

function privacyWebProxyPlugin() {
  return {
    name: 'privacy-web-proxy',
    configureServer(server: any) {
      server.middlewares.use('/api/proxy', async (req: any, res: any) => {
        try {
          const reqUrl = new URL(req.url, 'http://localhost');
          const target = reqUrl.searchParams.get('url');
          if (!target) {
            res.statusCode = 400;
            res.end('Missing url parameter');
            return;
          }

          const response = await fetch(target, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
            },
            redirect: 'follow',
          });

          const contentType = response.headers.get('content-type') || 'text/html';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Access-Control-Allow-Origin', '*');

          if (contentType.includes('text/html')) {
            let html = await response.text();
            // Inject base tag so relative resources load from the target host
            const baseTag = `<base href="${target}">`;
            if (html.includes('<head>')) {
              html = html.replace('<head>', `<head>${baseTag}`);
            } else if (html.includes('<HEAD>')) {
              html = html.replace('<HEAD>', `<HEAD>${baseTag}`);
            } else {
              html = baseTag + html;
            }
            res.end(html);
          } else {
            const buf = await response.arrayBuffer();
            res.end(Buffer.from(buf));
          }
        } catch (err: any) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'text/html');
          res.end(`
            <div style="font-family: system-ui, sans-serif; padding: 2rem; background: #0b0f17; color: #f1f5f9; min-height: 100vh;">
              <h3 style="color: #38bdf8; font-size: 1.1rem; margin-bottom: 0.5rem;">BitVault Private Web Sandbox</h3>
              <p style="color: #f87171; font-size: 0.9rem;">Could not load page directly: ${err.message}</p>
              <div style="margin-top: 1.5rem;">
                <a href="${req.url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 0.5rem 1rem; background: #06b6d4; color: #000; font-weight: bold; border-radius: 6px; text-decoration: none; font-size: 0.85rem;">Open in Isolated Tab &rarr;</a>
              </div>
            </div>
          `);
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), basicSsl(), privacyWebProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
