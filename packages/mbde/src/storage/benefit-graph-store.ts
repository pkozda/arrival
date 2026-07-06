import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BenefitNode, BenefitNodeVersion } from '../types/benefit-node.js';
import type { UpdateLogEntry } from '../types/ingestion.js';
import type { BenefitGraphStorePort } from '../ingestion/pipeline.js';

export type BenefitGraphSnapshot = {
  nodes: BenefitNode[];
  versions: BenefitNodeVersion[];
  updateLogs: UpdateLogEntry[];
};

export class InMemoryBenefitGraphStore implements BenefitGraphStorePort {
  private nodes = new Map<string, BenefitNode>();
  private versions: BenefitNodeVersion[] = [];
  private updateLogs: UpdateLogEntry[] = [];

  constructor(seed: BenefitNode[] = []) {
    seed.forEach((node) => this.upsert(node));
  }

  listActive(): BenefitNode[] {
    return [...this.nodes.values()].filter((node) => node.status === 'active');
  }

  listAll(): BenefitNode[] {
    return [...this.nodes.values()];
  }

  getById(id: string): BenefitNode | undefined {
    return this.nodes.get(id);
  }

  upsert(node: BenefitNode): BenefitNode {
    this.nodes.set(node.id, node);
    return node;
  }

  deprecate(id: string, replacedById?: string): BenefitNode | undefined {
    const existing = this.nodes.get(id);
    if (!existing) {
      return undefined;
    }
    const deprecated: BenefitNode = {
      ...existing,
      status: 'deprecated',
      replacedById,
    };
    this.nodes.set(id, deprecated);
    return deprecated;
  }

  appendVersion(version: BenefitNodeVersion): void {
    this.versions.push(version);
  }

  listVersions(nodeId: string): BenefitNodeVersion[] {
    return this.versions.filter((version) => version.nodeId === nodeId);
  }

  appendUpdateLog(entry: UpdateLogEntry): void {
    const existingIndex = this.updateLogs.findIndex((log) => log.id === entry.id);
    if (existingIndex >= 0) {
      this.updateLogs[existingIndex] = entry;
      return;
    }
    this.updateLogs.unshift(entry);
  }

  listUpdateLogs(limit = 50): UpdateLogEntry[] {
    return this.updateLogs.slice(0, limit);
  }

  snapshot(): BenefitGraphSnapshot {
    return {
      nodes: this.listAll(),
      versions: [...this.versions],
      updateLogs: [...this.updateLogs],
    };
  }

  restore(snapshot: BenefitGraphSnapshot): void {
    this.nodes.clear();
    snapshot.nodes.forEach((node) => this.nodes.set(node.id, node));
    this.versions = [...snapshot.versions];
    this.updateLogs = [...snapshot.updateLogs];
  }
}

export class FileBenefitGraphStore extends InMemoryBenefitGraphStore {
  constructor(
    private readonly filePath: string,
    seed: BenefitNode[] = []
  ) {
    super(seed);
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const snapshot = JSON.parse(raw) as BenefitGraphSnapshot;
      this.restore(snapshot);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async save(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.snapshot(), null, 2), 'utf8');
  }

  override upsert(node: BenefitNode): BenefitNode {
    const saved = super.upsert(node);
    void this.save();
    return saved;
  }

  override deprecate(id: string, replacedById?: string): BenefitNode | undefined {
    const saved = super.deprecate(id, replacedById);
    void this.save();
    return saved;
  }

  override appendVersion(version: BenefitNodeVersion): void {
    super.appendVersion(version);
    void this.save();
  }

  override appendUpdateLog(entry: UpdateLogEntry): void {
    super.appendUpdateLog(entry);
    void this.save();
  }
}
