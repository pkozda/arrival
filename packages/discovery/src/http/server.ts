import http from 'node:http';
import type { DiscoveryService } from '../service/discovery-service.js';
import {
  createDiscoveryHttpHandler,
  type DiscoveryHttpHandlerOptions,
} from './router.js';
import { MAX_ADMIN_BODY_BYTES } from './types.js';
import type { DiscoveryHttpRequest } from './types.js';

export type CreateDiscoveryHttpServerOptions = DiscoveryHttpHandlerOptions & {
  /** Bound listen options are left to the host; this only creates the server. */
};

/**
 * Optional Node http.Server adapter. Hosts control listen/TLS.
 * Body is capped at MAX_ADMIN_BODY_BYTES.
 */
export function createDiscoveryHttpServer(
  service: DiscoveryService,
  options: CreateDiscoveryHttpServerOptions = {}
): http.Server {
  const handler = createDiscoveryHttpHandler(service, options);

  return http.createServer((req, res) => {
    void (async () => {
      const chunks: Buffer[] = [];
      let total = 0;
      let tooLarge = false;

      for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buf.length;
        if (total > MAX_ADMIN_BODY_BYTES) {
          tooLarge = true;
          break;
        }
        chunks.push(buf);
      }

      if (tooLarge) {
        res.writeHead(400, {
          'content-type': 'application/json; charset=utf-8',
        });
        res.end(
          JSON.stringify({
            error: {
              code: 'INVALID_REQUEST',
              message: 'Request body too large',
              requestId: 'overflow',
            },
          })
        );
        return;
      }

      const request: DiscoveryHttpRequest = {
        method: req.method ?? 'GET',
        path: req.url ?? '/',
        headers: req.headers as DiscoveryHttpRequest['headers'],
        bodyText: Buffer.concat(chunks).toString('utf8'),
      };

      const response = await handler.handle(request);
      res.writeHead(response.status, response.headers);
      res.end(response.bodyText);
    })().catch(() => {
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      }
      res.end(
        JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: 'unknown',
          },
        })
      );
    });
  });
}
