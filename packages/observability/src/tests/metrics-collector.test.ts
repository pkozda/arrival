import { describe, expect, it } from 'vitest';
import { MetricsCollector } from '../metrics/MetricsCollector.js';

describe('metrics collector', () => {
  it('aggregates execution counts and latency percentiles', () => {
    const collector = new MetricsCollector();

    collector.recordExecution('financial-reality', 100, true);
    collector.recordExecution('financial-reality', 200, true);
    collector.recordExecution('financial-reality', 300, false);
    collector.recordExecution('financial-reality', 400, true);

    const metrics = collector.getModuleMetrics('financial-reality');

    expect(metrics.executions).toBe(4);
    expect(metrics.successes).toBe(3);
    expect(metrics.failures).toBe(1);
    expect(metrics.p50LatencyMs).toBe(200);
    expect(metrics.p95LatencyMs).toBe(400);
  });

  it('does not expose execution payload data in metrics snapshot', () => {
    const collector = new MetricsCollector();
    collector.recordExecution('benefits-simulator', 50, true);

    const snapshot = collector.snapshot();
    expect(JSON.stringify(snapshot)).not.toContain('input');
    expect(JSON.stringify(snapshot)).not.toContain('recommendation');
  });
});
