import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'path';

/**
 * Exécute les fonctions serverless `api/**` pendant le développement (`vite dev`).
 * Vite ne les lance pas nativement — seul le déploiement Vercel (ou `vercel dev`)
 * le fait — donc sans ce pont, tout appel à `/api/...` retombe sur le fallback SPA
 * (HTML) et échoue (ex. le test « État du serveur IA » des paramètres).
 *
 * Le handler est chargé via `ssrLoadModule` et req/res sont adaptés au contrat
 * Vercel minimal utilisé par nos fonctions (`req.method`, `req.body`,
 * `res.status().json()`). Actif uniquement en mode `serve` : la production Vercel
 * continue d'utiliser le même fichier comme fonction serverless, sans changement.
 */
function vercelApiDevServer(): Plugin {
  return {
    name: 'vercel-api-dev-server',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        void handleApiRequest(server, req, res, next);
      });
    },
  };
}

async function handleApiRequest(
  server: ViteDevServer,
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
): Promise<void> {
  const url = req.url ?? '';
  const pathname = url.split('?')[0].replace(/\/+$/, '');
  // On ne traite que les routes API, et jamais de remontée de chemin (../).
  if (!pathname.startsWith('/api/') || pathname.includes('..')) return next();

  try {
    const mod = await server.ssrLoadModule(`${pathname}.ts`);
    const handler = mod.default;
    if (typeof handler !== 'function') return next();

    // Adaptateurs vers le contrat Vercel attendu par les fonctions.
    const vercelReq = req as IncomingMessage & { body?: unknown };
    vercelReq.body = await readJsonBody(req);
    const vercelRes = res as ServerResponse & {
      status: (code: number) => typeof vercelRes;
      json: (data: unknown) => typeof vercelRes;
    };
    vercelRes.status = (code: number) => {
      res.statusCode = code;
      return vercelRes;
    };
    vercelRes.json = (data: unknown) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return vercelRes;
    };

    await handler(vercelReq, vercelRes);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Erreur du pont API de développement.',
      }),
    );
  }
}

/** Lit et parse le corps JSON d'une requête (ou `undefined` si vide/illisible). */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) return resolve(undefined);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        resolve(undefined);
      }
    });
    req.on('error', () => resolve(undefined));
  });
}

export default defineConfig({
  plugins: [react(), vercelApiDevServer()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Isole les grosses dépendances dans des chunks vendor dédiés : meilleur
        // cache (elles changent rarement) et allègement du bundle d'entrée.
        // onnxruntime-web n'est PAS listé → il reste chargé en dynamique (lazy).
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('firebase')) return 'vendor-firebase';
          if (id.includes('konva')) return 'vendor-konva';
          if (id.includes('jspdf') || id.includes('html2pdf') || id.includes('html2canvas')) return 'vendor-pdf';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('react-router') || id.includes('react-dom') || /[\\/]react[\\/]/.test(id)) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
});
