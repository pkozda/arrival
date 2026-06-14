import type {
  AppContext,
  Module,
  ModuleExecutionResult,
  ModuleRegistration,
} from '../types/index.js';
import { trackEvent } from '../events/index.js';

export class ModuleRegistry {
  private modules = new Map<string, ModuleRegistration>();

  register(registration: ModuleRegistration): void {
    const { id, version } = registration;

    if (this.modules.has(id)) {
      const existing = this.modules.get(id)!;
      if (existing.version === version) {
        throw new Error(`Module ${id}@${version} is already registered`);
      }
    }

    this.modules.set(id, registration);
    trackEvent('module.registered', {
      moduleId: id,
      payload: { version, name: registration.name },
    });
  }

  unregister(moduleId: string): boolean {
    const removed = this.modules.delete(moduleId);
    if (removed) {
      trackEvent('module.unregistered', { moduleId });
    }
    return removed;
  }

  get(moduleId: string): ModuleRegistration | undefined {
    return this.modules.get(moduleId);
  }

  list(includeDisabled = false): ModuleRegistration[] {
    const all = Array.from(this.modules.values());
    if (includeDisabled) return all;
    return all.filter((m) => m.enabled);
  }

  isEnabled(moduleId: string): boolean {
    const registration = this.modules.get(moduleId);
    if (!registration) return false;
    if (!registration.enabled) return false;
    return true;
  }

  hasFeatureFlag(moduleId: string, flag: string): boolean {
    const registration = this.modules.get(moduleId);
    if (!registration) return false;
    return registration.featureFlags[flag] ?? false;
  }

  setEnabled(moduleId: string, enabled: boolean): boolean {
    const registration = this.modules.get(moduleId);
    if (!registration) return false;
    registration.enabled = enabled;
    trackEvent('module.toggled', { moduleId, payload: { enabled } });
    return true;
  }

  setFeatureFlag(moduleId: string, flag: string, value: boolean): boolean {
    const registration = this.modules.get(moduleId);
    if (!registration) return false;
    registration.featureFlags[flag] = value;
    trackEvent('module.feature_flag', { moduleId, payload: { flag, value } });
    return true;
  }

  async execute<TInput, TOutput>(
    moduleId: string,
    input: TInput,
    context: AppContext
  ): Promise<ModuleExecutionResult<TOutput>> {
    const registration = this.modules.get(moduleId);

    if (!registration) {
      return {
        moduleId,
        version: 'unknown',
        success: false,
        error: `Module "${moduleId}" not found`,
        executedAt: new Date().toISOString(),
      };
    }

    if (!registration.enabled) {
      return {
        moduleId,
        version: registration.version,
        success: false,
        error: `Module "${moduleId}" is disabled`,
        executedAt: new Date().toISOString(),
      };
    }

    const module = registration.module as Module<TInput, TOutput>;

    try {
      const validatedInput = module.inputSchema.parse(input);
      trackEvent('module.execute.start', {
        moduleId,
        sessionId: context.sessionId,
      });

      const result = await module.execute(validatedInput, context);
      const validatedOutput = module.outputSchema.parse(result);

      trackEvent('module.execute.success', {
        moduleId,
        sessionId: context.sessionId,
      });

      return {
        moduleId,
        version: registration.version,
        success: true,
        data: validatedOutput,
        executedAt: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      trackEvent('module.execute.error', {
        moduleId,
        sessionId: context.sessionId,
        payload: { error: message },
      });

      return {
        moduleId,
        version: registration.version,
        success: false,
        error: message,
        executedAt: new Date().toISOString(),
      };
    }
  }
}

export const globalRegistry = new ModuleRegistry();

export function registerModule(registration: ModuleRegistration): void {
  globalRegistry.register(registration);
}

export function executeModule<TInput, TOutput>(
  moduleId: string,
  input: TInput,
  context: AppContext
): Promise<ModuleExecutionResult<TOutput>> {
  return globalRegistry.execute(moduleId, input, context);
}
