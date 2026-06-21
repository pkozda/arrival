import type {
  EconomicActionSetV1,
  EconomicPresentationV1,
} from '@arrival-atlas/product-contract';
import { ECONOMIC_REALITY_COPY_KEY_LIST } from '@arrival-atlas/product-contract';
import { resolveCopy, type CopyResolveContext } from './copy-resolver.js';

const REGISTERED_KEYS = new Set<string>(ECONOMIC_REALITY_COPY_KEY_LIST);

export class EconomicCopyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EconomicCopyValidationError';
  }
}

function assertKnownKey(key: string, path: string): void {
  if (!REGISTERED_KEYS.has(key)) {
    throw new EconomicCopyValidationError(`Unknown copy key at ${path}: ${key}`);
  }
}

export function assertResolvableCopyKey(
  key: string,
  locale: 'en' | 'de' = 'en',
  context: CopyResolveContext = {}
): string {
  assertKnownKey(key, 'assertResolvableCopyKey');
  return resolveCopy(key, locale, context);
}

export function validateActionSetCopyKeys(actionSet: EconomicActionSetV1): void {
  for (const action of actionSet.actions) {
    assertKnownKey(action.labelKey, `actionSet.actions.${action.id}.labelKey`);
    if (action.payload.intentKey) {
      assertKnownKey(action.payload.intentKey, `actionSet.actions.${action.id}.payload.intentKey`);
    }
  }
}

export function validatePresentationCopyKeys(presentation: EconomicPresentationV1): void {
  for (const section of presentation.sections) {
    assertKnownKey(section.titleKey, `presentation.sections.${section.sectionId}.titleKey`);
    for (const card of section.cards) {
      assertKnownKey(card.titleKey, `presentation.cards.${card.cardId}.titleKey`);
    }
  }

  assertKnownKey(
    presentation.primaryHighlight.labelKey,
    'presentation.primaryHighlight.labelKey'
  );

  for (const [index, highlight] of presentation.systemHighlights.entries()) {
    assertKnownKey(highlight.labelKey, `presentation.systemHighlights.${index}.labelKey`);
  }
}

export function validateNoRawStringsInPresentation(presentation: unknown): void {
  const serialized = JSON.stringify(presentation);
  if (serialized.includes('"title":')) {
    throw new EconomicCopyValidationError('Presentation contains raw title strings');
  }
  if (serialized.includes('"label":')) {
    throw new EconomicCopyValidationError('Presentation contains raw label strings');
  }
}
