import { PRODUCT_NAME } from '@arrivalos/core';
import { buildApp } from './build-app.js';

const port = parseInt(process.env.PORT ?? '3001', 10);
const host = process.env.HOST ?? '0.0.0.0';

const app = await buildApp({ logger: true });

try {
  await app.listen({ port, host });
  console.log(`${PRODUCT_NAME} API running at http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
