import { describe, expect, it } from 'vitest';
import {
  explanationEntryTitle,
  humanizeConfidence,
  humanizeEnumValue,
  humanizeFieldName,
  humanizePriority,
} from './ux-labels';

describe('ux-labels', () => {
  it('humanizes common field names', () => {
    expect(humanizeFieldName('grossIncome')).toBe('Gross monthly income');
    expect(humanizeFieldName('employmentStatus')).toBe('Employment status');
  });

  it('humanizes enum values', () => {
    expect(humanizeEnumValue('self-employed')).toBe('Self-employed');
    expect(humanizeEnumValue('high')).toBe('High priority');
  });

  it('humanizes priority and confidence labels', () => {
    expect(humanizePriority('critical')).toBe('Critical');
    expect(humanizeConfidence('medium')).toBe('Moderate confidence');
  });

  it('uses factor labels for explanation entry titles', () => {
    expect(
      explanationEntryTitle([{ label: 'Rent exceeds recommended share' }], 'Fallback')
    ).toBe('Rent exceeds recommended share');
    expect(explanationEntryTitle([], 'Fallback')).toBe('Fallback');
  });
});
