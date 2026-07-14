import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileBenefitGraphStore } from './benefit-graph-store.js';
import type { BenefitNode } from '../types/benefit-node.js';

const seedNode: BenefitNode = {
  id: 'test-benefit',
  name: 'Test Benefit',
  status: 'active',
  jurisdiction: 'DE',
  category: 'housing',
  eligibilityRules: [],
  dependencies: [],
  metadata: {},
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('FileBenefitGraphStore', () => {
  let tempDir = '';

  afterEach(async () => {
    tempDir = '';
  });

  it('constructs with seed nodes without throwing when filePath is set', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'mbde-store-'));
    const filePath = path.join(tempDir, 'graph.json');

    expect(() => new FileBenefitGraphStore(filePath, [seedNode])).not.toThrow();

    const store = new FileBenefitGraphStore(filePath, [seedNode]);
    await store.save();

    const raw = await readFile(filePath, 'utf8');
    const snapshot = JSON.parse(raw) as { nodes: BenefitNode[] };
    expect(snapshot.nodes.some((node) => node.id === 'test-benefit')).toBe(true);
  });
});
