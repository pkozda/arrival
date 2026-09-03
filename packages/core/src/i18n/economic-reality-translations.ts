import { ECONOMIC_REALITY_COPY_DE } from './economic-reality-strings.de.js';
import { ECONOMIC_REALITY_COPY_EN } from './economic-reality-strings.en.js';
import { ECONOMIC_REALITY_COPY_RU } from './economic-reality-strings.ru.js';

export const ECONOMIC_REALITY_I18N = {
  en: ECONOMIC_REALITY_COPY_EN,
  de: ECONOMIC_REALITY_COPY_DE,
  ru: ECONOMIC_REALITY_COPY_RU,
  ua: ECONOMIC_REALITY_COPY_EN,
} as const;

export const ECONOMIC_REALITY_I18N_KEYS = Object.keys(ECONOMIC_REALITY_COPY_EN);
