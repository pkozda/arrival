import type { SchemaField } from '@/lib/product-contract';

export function getNestedValue(source: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = source;

  for (const segment of segments) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

export function buildInputFromFormData(
  formData: FormData,
  fields: SchemaField[],
  prefix = ''
): Record<string, unknown> {
  const input: Record<string, unknown> = {};

  for (const field of fields) {
    const fieldName = prefix ? `${prefix}.${field.name}` : field.name;

    if (field.type === 'object' && field.properties) {
      input[field.name] = buildInputFromFormData(formData, field.properties, fieldName);
      continue;
    }

    if (field.type === 'boolean') {
      input[field.name] = formData.get(fieldName) === 'on';
      continue;
    }

    const rawValue = formData.get(fieldName);
    if (rawValue === null || rawValue === '') {
      continue;
    }

    if (field.type === 'number' || field.type === 'integer') {
      input[field.name] = Number(rawValue);
      continue;
    }

    input[field.name] = String(rawValue);
  }

  return input;
}

function formatFieldLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

export function schemaFieldLabel(field: SchemaField): string {
  return formatFieldLabel(field.name);
}
