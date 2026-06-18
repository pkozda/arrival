export type ModuleMetrics = {
  executions: number;
  successes: number;
  failures: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
};

type ExecutionSample = {
  success: boolean;
  latencyMs: number;
};

function percentile(values: number[], percentileRank: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileRank / 100) * sorted.length) - 1)
  );
  return sorted[index] ?? 0;
}

export class MetricsCollector {
  private readonly samplesByModuleId = new Map<string, ExecutionSample[]>();

  recordExecution(moduleId: string, latencyMs: number, success: boolean): void {
    const samples = this.samplesByModuleId.get(moduleId) ?? [];
    samples.push({ success, latencyMs });
    this.samplesByModuleId.set(moduleId, samples);
  }

  getModuleMetrics(moduleId: string): ModuleMetrics {
    const samples = this.samplesByModuleId.get(moduleId) ?? [];
    const latencies = samples.map((sample) => sample.latencyMs);

    return {
      executions: samples.length,
      successes: samples.filter((sample) => sample.success).length,
      failures: samples.filter((sample) => !sample.success).length,
      p50LatencyMs: percentile(latencies, 50),
      p95LatencyMs: percentile(latencies, 95),
    };
  }

  snapshot(): Record<string, ModuleMetrics> {
    return Object.fromEntries(
      [...this.samplesByModuleId.keys()]
        .sort()
        .map((moduleId) => [moduleId, this.getModuleMetrics(moduleId)])
    );
  }

  reset(): void {
    this.samplesByModuleId.clear();
  }
}

export const globalMetricsCollector = new MetricsCollector();
