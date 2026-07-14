import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DISPLAY_LANGUAGE_STORAGE_KEY } from '@/lib/i18n/display-language';
import {
  ARRIVAL_WELCOME_STORAGE_KEY,
  clearArrivalWelcomeState,
  persistArrivalLanguageSelected,
  persistArrivalWelcomeCompleted,
  readArrivalWelcomeRecord,
  shouldShowArrivalWelcome,
} from '@/lib/arrival-welcome';

describe('arrival-welcome-state', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts as new_visitor on a fresh device', () => {
    expect(readArrivalWelcomeRecord()).toEqual({ version: 1, state: 'new_visitor' });
    expect(shouldShowArrivalWelcome()).toBe(true);
  });

  it('moves to language_selected when a language is chosen', () => {
    const next = persistArrivalLanguageSelected('ua');
    expect(next.state).toBe('language_selected');
    expect(next.selectedLanguage).toBe('ua');
    expect(shouldShowArrivalWelcome()).toBe(true);
  });

  it('persists completion and skips welcome on return', () => {
    persistArrivalLanguageSelected('de');
    persistArrivalWelcomeCompleted('de');

    const stored = JSON.parse(storage.get(ARRIVAL_WELCOME_STORAGE_KEY)!);
    expect(stored.state).toBe('completed');

    expect(readArrivalWelcomeRecord().state).toBe('returning_visitor');
    expect(shouldShowArrivalWelcome()).toBe(false);
  });

  it('migrates legacy display language preference as completed', () => {
    storage.set(DISPLAY_LANGUAGE_STORAGE_KEY, 'ru');

    const record = readArrivalWelcomeRecord();
    expect(record.state).toBe('returning_visitor');
    expect(record.selectedLanguage).toBe('ru');
    expect(shouldShowArrivalWelcome()).toBe(false);
  });

  it('clears only arrival welcome state', () => {
    persistArrivalWelcomeCompleted('en');
    storage.set(DISPLAY_LANGUAGE_STORAGE_KEY, 'en');

    clearArrivalWelcomeState();

    expect(storage.has(ARRIVAL_WELCOME_STORAGE_KEY)).toBe(false);
    expect(storage.get(DISPLAY_LANGUAGE_STORAGE_KEY)).toBe('en');
  });
});
