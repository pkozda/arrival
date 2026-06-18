import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './build-app.js';
import {
  resetTestStateStore,
  setupTestStateStore,
  teardownTestStateStore,
} from './test-state.js';

const FORBIDDEN_MODULE_KEYS = [
  'enabled',
  'featureFlags',
  'name',
  'executionConstraints',
  'spec',
  'frozen',
] as const;

const REQUIRED_MODULE_KEYS = [
  'id',
  'title',
  'description',
  'version',
  'status',
  'capabilities',
  'metadata',
] as const;

function assertPublicModuleListItem(module: Record<string, unknown>): void {
  for (const key of REQUIRED_MODULE_KEYS) {
    expect(module).toHaveProperty(key);
  }

  for (const key of FORBIDDEN_MODULE_KEYS) {
    expect(module).not.toHaveProperty(key);
  }

  expect(module.capabilities).toEqual({
    supports: {
      recommendations: expect.any(Boolean),
      actions: expect.any(Boolean),
      explanation: expect.any(Boolean),
      riskModel: expect.any(Boolean),
    },
  });
}

describe('Public Module Contract API', () => {
  beforeEach(async () => {
    setupTestStateStore();
    await resetTestStateStore();
  });

  afterEach(() => {
    teardownTestStateStore();
  });

  it('GET /api/modules returns PublicModuleContract[]', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/modules',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { modules: Array<Record<string, unknown>> };

    expect(body.modules.length).toBeGreaterThan(0);
    for (const module of body.modules) {
      assertPublicModuleListItem(module);
    }
  });

  it('GET /api/modules/:id returns PublicModuleContract', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/modules/financial-reality',
    });

    expect(response.statusCode).toBe(200);
    assertPublicModuleListItem(response.json() as Record<string, unknown>);
    expect(response.json()).toMatchObject({
      id: 'financial-reality',
      title: expect.any(String),
      status: 'available',
    });
  });

  it('GET /api/modules/:id returns 404 for unknown module', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/modules/unknown-module',
    });

    expect(response.statusCode).toBe(404);
  });

  it('ignores contractVersion query parameter without changing response shape', async () => {
    const app = await buildApp();

    const baseline = await app.inject({
      method: 'GET',
      url: '/api/modules/financial-reality',
    });
    const withVersion = await app.inject({
      method: 'GET',
      url: '/api/modules/financial-reality?contractVersion=1',
    });

    expect(withVersion.statusCode).toBe(200);
    expect(withVersion.json()).toEqual(baseline.json());
  });

  it('GET /api/modules/:id/schema returns frozen JSON schema projection', async () => {
    const app = await buildApp();

    const first = await app.inject({
      method: 'GET',
      url: '/api/modules/financial-reality/schema',
    });
    const second = await app.inject({
      method: 'GET',
      url: '/api/modules/financial-reality/schema',
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json()).toEqual(second.json());

    const body = first.json() as {
      inputSchema: Record<string, unknown>;
      outputSchema: Record<string, unknown>;
    };

    expect(body.inputSchema.type).toBe('object');
    expect(body.outputSchema.type).toBe('object');
    expect(body.inputSchema).toHaveProperty('properties');
    expect(body).not.toHaveProperty('enabled');
    expect(body).not.toHaveProperty('featureFlags');
    expect(body).not.toHaveProperty('executionConstraints');
  });

  it('GET /api/modules/:id/capabilities returns normalized capabilities', async () => {
    const app = await buildApp();

    const first = await app.inject({
      method: 'GET',
      url: '/api/modules/financial-reality/capabilities',
    });
    const second = await app.inject({
      method: 'GET',
      url: '/api/modules/financial-reality/capabilities',
    });

    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual(second.json());
    expect(first.json()).toEqual({
      supports: {
        recommendations: true,
        actions: true,
        explanation: true,
        riskModel: false,
      },
    });
  });

  it('GET /api/modules/:id/schema returns 404 for unknown module', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/modules/unknown-module/schema',
    });

    expect(response.statusCode).toBe(404);
  });
});
