import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodType } from 'zod';
import type { JsonSchema } from './JsonSchema.js';

export function convertZodToJsonSchema(schema: ZodType): JsonSchema {
  return zodToJsonSchema(schema, {
    $refStrategy: 'none',
    target: 'jsonSchema7',
  }) as JsonSchema;
}
