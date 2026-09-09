/**
 * E10 — Tax Administration view model (Finance vertical slice Option C).
 * Authoritative: employment.taxClass, employment.churchTax.
 * Not banking, not income ownership, not benefits, not financial advice.
 */
import type { UserProfileViewV1 } from '@/lib/product-contract';

export type TaxAdministrationStateV1 = 'NOT_ADDED' | 'INCOMPLETE' | 'READY';

export type TaxAdministrationNextActionKindV1 = 'update_tax_details' | 'review_tax_details' | 'none';

export type TaxAdministrationKnownFactV1 = {
  factId: 'taxClass' | 'churchTax';
  presence: 'KNOWN' | 'UNKNOWN';
  labelKey: string;
  valueText?: string;
};

export type TaxAdministrationViewModelV1 = {
  state: TaxAdministrationStateV1;
  stateLabelKey: string;
  explanationKey: string;
  knownFacts: TaxAdministrationKnownFactV1[];
  missingFieldKeys: string[];
  nextAction: {
    kind: TaxAdministrationNextActionKindV1;
    href: string | null;
    labelKey: string;
  };
  disclaimerKey: string;
  /** Explicitly not a bank-account status — banking facts do not exist. */
  bankingNoteKey: string;
};

function isTaxClass(value: unknown): value is 1 | 2 | 3 | 4 | 5 | 6 {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6;
}

/**
 * Derive tax administration status from authoritative employment tax facts.
 * undefined taxClass ≠ class 1; undefined churchTax ≠ false.
 */
export function buildTaxAdministrationViewModel(
  profile: UserProfileViewV1 | null | undefined
): TaxAdministrationViewModelV1 {
  const employment = profile?.domains?.employment;
  const taxClass = isTaxClass(employment?.taxClass) ? employment.taxClass : undefined;
  const churchTaxKnown = typeof employment?.churchTax === 'boolean';
  const churchTax = churchTaxKnown ? employment!.churchTax : undefined;

  const knownFacts: TaxAdministrationKnownFactV1[] = [
    {
      factId: 'taxClass',
      presence: taxClass !== undefined ? 'KNOWN' : 'UNKNOWN',
      labelKey: 'finance.tax.fact.taxClass',
      valueText: taxClass !== undefined ? String(taxClass) : undefined,
    },
    {
      factId: 'churchTax',
      presence: churchTaxKnown ? 'KNOWN' : 'UNKNOWN',
      labelKey: 'finance.tax.fact.churchTax',
      valueText: churchTaxKnown
        ? churchTax
          ? 'finance.tax.presence.yes'
          : 'finance.tax.presence.no'
        : undefined,
    },
  ];

  const missingFieldKeys: string[] = [];
  if (taxClass === undefined) {
    missingFieldKeys.push('finance.tax.missing.taxClass');
  }

  const disclaimerKey = 'finance.tax.disclaimer';
  const bankingNoteKey = 'finance.tax.bankingDeferred';

  if (taxClass === undefined && !churchTaxKnown) {
    return {
      state: 'NOT_ADDED',
      stateLabelKey: 'finance.tax.state.NOT_ADDED',
      explanationKey: 'finance.tax.explanation.notAdded',
      knownFacts,
      missingFieldKeys,
      nextAction: {
        kind: 'update_tax_details',
        href: '/profile/work-income/edit',
        labelKey: 'finance.tax.action.updateTax',
      },
      disclaimerKey,
      bankingNoteKey,
    };
  }

  if (taxClass === undefined) {
    return {
      state: 'INCOMPLETE',
      stateLabelKey: 'finance.tax.state.INCOMPLETE',
      explanationKey: 'finance.tax.explanation.incomplete',
      knownFacts,
      missingFieldKeys,
      nextAction: {
        kind: 'update_tax_details',
        href: '/profile/work-income/edit',
        labelKey: 'finance.tax.action.updateTax',
      },
      disclaimerKey,
      bankingNoteKey,
    };
  }

  return {
    state: 'READY',
    stateLabelKey: 'finance.tax.state.READY',
    explanationKey: churchTaxKnown
      ? 'finance.tax.explanation.ready'
      : 'finance.tax.explanation.readyTaxClassOnly',
    knownFacts,
    missingFieldKeys: [],
    nextAction: {
      kind: 'review_tax_details',
      href: '/profile/work-income/edit',
      labelKey: 'finance.tax.action.reviewTax',
    },
    disclaimerKey,
    bankingNoteKey,
  };
}
