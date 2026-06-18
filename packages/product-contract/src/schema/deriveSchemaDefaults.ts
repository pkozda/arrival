import type { JsonSchema } from '../JsonSchema.js';

export type SchemaFieldType = 'string' | 'number' | 'integer' | 'boolean' | 'object';

export type SchemaField = {
  name: string;
  type: SchemaFieldType;
  required: boolean;
  enumValues?: Array<string | number>;
  minimum?: number;
  defaultValue?: unknown;
  properties?: SchemaField[];
};

function readSchemaRecord(schema: JsonSchema): Record<string, unknown> {
  return schema as Record<string, unknown>;
}

function readPropertySchema(property: unknown): Record<string, unknown> {
  return (property ?? {}) as Record<string, unknown>;
}

export function extractSchemaFields(schema: JsonSchema, requiredFields: string[] = []): SchemaField[] {
  const record = readSchemaRecord(schema);
  const properties = readSchemaRecord((record.properties ?? {}) as JsonSchema);
  const required = Array.isArray(record.required)
    ? record.required.filter((entry): entry is string => typeof entry === 'string')
    : requiredFields;

  return Object.entries(properties).map(([name, propertySchema]) => {
    const property = readPropertySchema(propertySchema);
    const type = typeof property.type === 'string' ? property.type : 'string';
    const enumValues = Array.isArray(property.enum)
      ? property.enum.filter((entry): entry is string | number =>
          typeof entry === 'string' || typeof entry === 'number'
        )
      : undefined;

    if (type === 'object' && property.properties) {
      const nestedRequired = Array.isArray(property.required)
        ? property.required.filter((entry): entry is string => typeof entry === 'string')
        : [];
      return {
        name,
        type: 'object' as const,
        required: required.includes(name),
        defaultValue: property.default,
        properties: extractSchemaFields(propertySchema as JsonSchema, nestedRequired),
      };
    }

    return {
      name,
      type: (type === 'integer' ? 'integer' : type) as SchemaFieldType,
      required: required.includes(name),
      ...(enumValues ? { enumValues } : {}),
      ...(typeof property.minimum === 'number' ? { minimum: property.minimum } : {}),
      ...(property.default !== undefined ? { defaultValue: property.default } : {}),
    };
  });
}

export function deriveDefaultValues(schema: JsonSchema): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  for (const field of extractSchemaFields(schema)) {
    if (field.type === 'object' && field.properties) {
      defaults[field.name] = deriveDefaultValues({
        type: 'object',
        properties: Object.fromEntries(
          field.properties.map((nested) => [
            nested.name,
            {
              type: nested.type,
              ...(nested.enumValues ? { enum: nested.enumValues } : {}),
              ...(nested.minimum !== undefined ? { minimum: nested.minimum } : {}),
              ...(nested.defaultValue !== undefined ? { default: nested.defaultValue } : {}),
              ...(nested.properties
                ? {
                    type: 'object',
                    properties: Object.fromEntries(
                      nested.properties.map((child) => [child.name, { type: child.type, default: child.defaultValue }])
                    ),
                  }
                : {}),
            },
          ])
        ),
        required: field.properties.filter((nested) => nested.required).map((nested) => nested.name),
      });
      continue;
    }

    if (field.defaultValue !== undefined) {
      defaults[field.name] = field.defaultValue;
      continue;
    }

    if (field.type === 'boolean') {
      defaults[field.name] = false;
      continue;
    }

    if (field.type === 'string' && field.enumValues && field.enumValues.length > 0) {
      defaults[field.name] = field.enumValues[0];
      continue;
    }

    if ((field.type === 'number' || field.type === 'integer') && field.enumValues && field.enumValues.length > 0) {
      defaults[field.name] = field.enumValues[0];
    }
  }

  return defaults;
}

export function mergeProfileIntoDefaults(
  defaults: Record<string, unknown>,
  profile: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!profile) {
    return defaults;
  }

  const merged = { ...defaults };

  for (const [key, value] of Object.entries(defaults)) {
    if (profile[key] !== undefined && profile[key] !== null) {
      merged[key] = profile[key];
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      merged[key] = mergeProfileIntoDefaults(value as Record<string, unknown>, profile);
    }
  }

  return merged;
}
