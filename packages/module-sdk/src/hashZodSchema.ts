import type { z } from 'zod';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function hashString(input: string): string {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function serializeZodDef(def: z.ZodTypeDef, seen: WeakSet<object>): string {
  if (seen.has(def)) {
    return '"cycle"';
  }
  seen.add(def);

  const typeName = (def as { typeName?: string }).typeName;

  switch (typeName) {
    case 'ZodString':
      return stableStringify({ type: 'string', checks: (def as z.ZodStringDef).checks ?? [] });
    case 'ZodNumber':
      return stableStringify({ type: 'number', checks: (def as z.ZodNumberDef).checks ?? [] });
    case 'ZodBoolean':
      return stableStringify({ type: 'boolean' });
    case 'ZodLiteral':
      return stableStringify({ type: 'literal', value: (def as z.ZodLiteralDef).value });
    case 'ZodEnum':
      return stableStringify({ type: 'enum', values: (def as z.ZodEnumDef).values });
    case 'ZodNativeEnum':
      return stableStringify({ type: 'nativeEnum', values: (def as z.ZodNativeEnumDef).values });
    case 'ZodArray':
      return stableStringify({
        type: 'array',
        element: serializeZodDef((def as z.ZodArrayDef).type._def, seen),
      });
    case 'ZodObject': {
      const shape = (def as z.ZodObjectDef).shape();
      const serializedShape = Object.fromEntries(
        Object.keys(shape)
          .sort()
          .map((key) => [key, serializeZodDef(shape[key]!._def, seen)])
      );
      return stableStringify({ type: 'object', shape: serializedShape });
    }
    case 'ZodOptional':
      return stableStringify({
        type: 'optional',
        inner: serializeZodDef((def as z.ZodOptionalDef).innerType._def, seen),
      });
    case 'ZodNullable':
      return stableStringify({
        type: 'nullable',
        inner: serializeZodDef((def as z.ZodNullableDef).innerType._def, seen),
      });
    case 'ZodDefault':
      return stableStringify({
        type: 'default',
        inner: serializeZodDef((def as z.ZodDefaultDef).innerType._def, seen),
        defaultValue: (def as z.ZodDefaultDef).defaultValue(),
      });
    case 'ZodUnion':
      return stableStringify({
        type: 'union',
        options: (def as z.ZodUnionDef).options.map((option) =>
          serializeZodDef(option._def, seen)
        ),
      });
    case 'ZodDiscriminatedUnion': {
      const discriminated = def as unknown as {
        discriminator: string;
        options: Map<unknown, z.ZodTypeAny> | z.ZodTypeAny[];
      };
      const options = Array.isArray(discriminated.options)
        ? discriminated.options
        : [...discriminated.options.values()];
      return stableStringify({
        type: 'discriminatedUnion',
        discriminator: discriminated.discriminator,
        options: options.map((option) => serializeZodDef(option._def, seen)),
      });
    }
    case 'ZodEffects':
      return stableStringify({
        type: 'effects',
        inner: serializeZodDef((def as z.ZodEffectsDef).schema._def, seen),
      });
    case 'ZodAny':
      return stableStringify({ type: 'any' });
    case 'ZodUnknown':
      return stableStringify({ type: 'unknown' });
    case 'ZodRecord':
      return stableStringify({
        type: 'record',
        key: serializeZodDef((def as z.ZodRecordDef).keyType._def, seen),
        value: serializeZodDef((def as z.ZodRecordDef).valueType._def, seen),
      });
    default:
      return stableStringify({ type: typeName ?? 'unknown' });
  }
}

export function hashZodSchema(schema: z.ZodTypeAny): string {
  return hashString(serializeZodDef(schema._def, new WeakSet()));
}

export function hashStableValue(value: unknown): string {
  return hashString(stableStringify(value));
}
