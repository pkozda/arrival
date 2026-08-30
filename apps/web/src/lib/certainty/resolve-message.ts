import type { CertaintyMessageDescriptor } from './types';

export type CertaintyTranslate = (key: string) => string;

/** Interpolates `{param}` placeholders after looking up the translation key. */
export function fillCertaintyTemplate(
  template: string,
  params: Record<string, string | number> = {}
): string {
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}

/**
 * Presentation-layer resolver: descriptor → localized string.
 * Certainty domain code must not call this.
 */
export function resolveCertaintyMessage(
  descriptor: CertaintyMessageDescriptor | null | undefined,
  t: CertaintyTranslate
): string {
  if (!descriptor) {
    return '';
  }
  return fillCertaintyTemplate(t(descriptor.key), descriptor.params);
}
