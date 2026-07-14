import type { SupportedLanguage } from '@/lib/product-contract';
import { readStoredDisplayLanguage } from '@/lib/i18n/display-language';
import {
  ARRIVAL_WELCOME_STORAGE_KEY,
  type ArrivalWelcomeRecordV1,
  type ArrivalWelcomeState,
} from './types';

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function parseRecord(raw: string | null): ArrivalWelcomeRecordV1 | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ArrivalWelcomeRecordV1>;
    if (parsed.version !== 1 || !parsed.state) {
      return null;
    }

    const validStates: ArrivalWelcomeState[] = [
      'new_visitor',
      'language_selected',
      'returning_visitor',
      'completed',
    ];

    if (!validStates.includes(parsed.state)) {
      return null;
    }

    return {
      version: 1,
      state: parsed.state,
      selectedLanguage: parsed.selectedLanguage,
      completedAt: parsed.completedAt,
    };
  } catch {
    return null;
  }
}

function writeRecord(record: ArrivalWelcomeRecordV1): void {
  const local = getLocalStorage();
  if (!local) {
    return;
  }

  try {
    local.setItem(ARRIVAL_WELCOME_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignore quota / private mode
  }
}

function migrateLegacyLanguagePreference(): ArrivalWelcomeRecordV1 | null {
  const existingLanguage = readStoredDisplayLanguage();
  if (!existingLanguage) {
    return null;
  }

  return {
    version: 1,
    state: 'completed',
    selectedLanguage: existingLanguage,
    completedAt: new Date(0).toISOString(),
  };
}

export function readArrivalWelcomeRecord(): ArrivalWelcomeRecordV1 {
  const local = getLocalStorage();
  if (!local) {
    return { version: 1, state: 'new_visitor' };
  }

  try {
    const stored = parseRecord(local.getItem(ARRIVAL_WELCOME_STORAGE_KEY));
    if (stored) {
      if (stored.state === 'completed') {
        return { ...stored, state: 'returning_visitor' };
      }
      return stored;
    }
  } catch {
    return { version: 1, state: 'new_visitor' };
  }

  const migrated = migrateLegacyLanguagePreference();
  if (migrated) {
    writeRecord(migrated);
    return { ...migrated, state: 'returning_visitor' };
  }

  return { version: 1, state: 'new_visitor' };
}

export function shouldShowArrivalWelcome(record: ArrivalWelcomeRecordV1 = readArrivalWelcomeRecord()): boolean {
  return record.state === 'new_visitor' || record.state === 'language_selected';
}

export function persistArrivalLanguageSelected(language: SupportedLanguage): ArrivalWelcomeRecordV1 {
  const record: ArrivalWelcomeRecordV1 = {
    version: 1,
    state: 'language_selected',
    selectedLanguage: language,
  };
  writeRecord(record);
  return record;
}

export function persistArrivalWelcomeCompleted(
  language: SupportedLanguage
): ArrivalWelcomeRecordV1 {
  const record: ArrivalWelcomeRecordV1 = {
    version: 1,
    state: 'completed',
    selectedLanguage: language,
    completedAt: new Date().toISOString(),
  };
  writeRecord(record);
  return record;
}

export function clearArrivalWelcomeState(): void {
  try {
    getLocalStorage()?.removeItem(ARRIVAL_WELCOME_STORAGE_KEY);
  } catch {
    // ignore
  }
}
