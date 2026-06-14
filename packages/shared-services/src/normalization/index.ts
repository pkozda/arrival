export function normalizeIncome(value: unknown): number | null {
  if (typeof value === 'number' && !isNaN(value)) return Math.round(value * 100) / 100;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[€$\s,]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : Math.round(parsed * 100) / 100;
  }
  return null;
}

export function normalizeHouseholdSize(value: unknown): number | null {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (typeof num === 'number' && Number.isInteger(num) && num > 0 && num <= 20) {
    return num;
  }
  return null;
}

export function normalizeTaxClass(value: unknown): 1 | 2 | 3 | 4 | 5 | 6 | null {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (typeof num === 'number' && num >= 1 && num <= 6) {
    return num as 1 | 2 | 3 | 4 | 5 | 6;
  }
  return null;
}

export function normalizeResidencyStatus(value: unknown): string | null {
  const valid = [
    'eu-citizen',
    'permanent-resident',
    'temporary-resident',
    'asylum-seeker',
    'student-visa',
    'work-visa',
    'tourist',
    'unknown',
  ];
  if (typeof value === 'string' && valid.includes(value)) return value;
  return null;
}

export function normalizeLocation(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return null;
  return trimmed;
}

export function normalizeLanguage(value: unknown): 'en' | 'de' | 'ru' | 'ua' | null {
  const valid = ['en', 'de', 'ru', 'ua'];
  if (typeof value === 'string' && valid.includes(value)) {
    return value as 'en' | 'de' | 'ru' | 'ua';
  }
  return null;
}

export function sanitizeString(value: unknown, maxLength = 500): string | null {
  if (typeof value !== 'string') return null;
  return value.trim().slice(0, maxLength);
}
