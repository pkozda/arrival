import type { SupportedLanguage } from '@arrival-atlas/ui-contract';
import en from './life-event-content/en.json' with { type: 'json' };
import de from './life-event-content/de.json' with { type: 'json' };
import ru from './life-event-content/ru.json' with { type: 'json' };
import ua from './life-event-content/ua.json' with { type: 'json' };

type TranslationMap = Record<string, string>;

export const LIFE_EVENT_CONTENT_I18N: Record<SupportedLanguage, TranslationMap> = {
  en: en as TranslationMap,
  de: de as TranslationMap,
  ru: ru as TranslationMap,
  ua: ua as TranslationMap,
};

export const LIFE_EVENT_CONTENT_I18N_KEYS = Object.keys(en);
