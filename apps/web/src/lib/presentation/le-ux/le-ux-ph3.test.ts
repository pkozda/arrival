import { describe, expect, it } from 'vitest';
import { leBadgeClass, leConfidenceClass, leSeverityClass } from '@/lib/presentation/le-ux/severity';

describe('PH-3 severity presentation classes', () => {
  it('maps planner severities to stable CSS hooks', () => {
    expect(leSeverityClass('critical')).toBe('le-severity--critical');
    expect(leSeverityClass('high')).toBe('le-severity--high');
    expect(leSeverityClass('medium')).toBe('le-severity--medium');
    expect(leSeverityClass('low')).toBe('le-severity--low');
    expect(leSeverityClass('unknown')).toBe('le-severity--medium');
  });

  it('composes badge classes without changing severity identity', () => {
    expect(leBadgeClass('critical')).toBe('badge le-badge le-badge--critical');
  });

  it('maps confidence levels for header presentation', () => {
    expect(leConfidenceClass('high')).toBe('le-confidence le-confidence--high');
    expect(leConfidenceClass('unknown')).toBe('le-confidence le-confidence--none');
  });
});
