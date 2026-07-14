import { resolveCurrentSituation } from './resolver';
import { validateRegistration } from './validation';
import type {
  CurrentSituationListener,
  CurrentSituationResult,
  CurrentSituationSource,
  RegisterSurfaceInput,
  SurfaceRegistration,
  ValidationResult,
} from './types';

export class CurrentSituationRegistry {
  private readonly registrations = new Map<CurrentSituationSource, SurfaceRegistration>();
  private readonly listeners = new Set<CurrentSituationListener>();
  private current: CurrentSituationResult | null = null;

  register(input: RegisterSurfaceInput): ValidationResult {
    const validation = validateRegistration(input);
    if (!validation.ok) {
      return validation;
    }

    this.registrations.set(validation.registration.surface, validation.registration);
    this.recompute();
    return validation;
  }

  /** Alias for register — matches surface-bundle registration API. */
  registerSurfaceBundle(input: RegisterSurfaceInput): ValidationResult {
    return this.register(input);
  }

  remove(surface: CurrentSituationSource): boolean {
    const removed = this.registrations.delete(surface);
    if (removed) {
      this.recompute();
    }
    return removed;
  }

  resolve(): CurrentSituationResult | null {
    return resolveCurrentSituation(this.registrations);
  }

  getCurrent(): CurrentSituationResult | null {
    return this.current;
  }

  subscribe(listener: CurrentSituationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  unsubscribe(listener: CurrentSituationListener): void {
    this.listeners.delete(listener);
  }

  clear(): void {
    this.registrations.clear();
    this.recompute();
  }

  has(surface: CurrentSituationSource): boolean {
    return this.registrations.has(surface);
  }

  size(): number {
    return this.registrations.size;
  }

  private recompute(): void {
    const next = this.resolve();
    this.current = next;
    this.listeners.forEach((listener) => {
      try {
        listener(next);
      } catch {
        // Listeners must not break the registry.
      }
    });
  }
}

/** Process-wide singleton — infrastructure only; nothing consumes until E2. */
let sharedRegistry: CurrentSituationRegistry | null = null;

export function getCurrentSituationRegistry(): CurrentSituationRegistry {
  if (!sharedRegistry) {
    sharedRegistry = new CurrentSituationRegistry();
  }
  return sharedRegistry;
}

export function resetCurrentSituationRegistry(): void {
  sharedRegistry?.clear();
  sharedRegistry = null;
}
