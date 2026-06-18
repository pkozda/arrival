import { describe, expect, it } from 'vitest';
import { deriveDefaultValues, extractSchemaFields } from './deriveSchemaDefaults.js';

describe('deriveSchemaDefaults', () => {
  it('extracts fields and defaults from module input schema', () => {
    const schema = {
      type: 'object',
      properties: {
        grossIncome: { type: 'number', minimum: 0 },
        churchTax: { type: 'boolean', default: false },
        employmentStatus: {
          type: 'string',
          enum: ['employed', 'student'],
          default: 'employed',
        },
        currentStatus: {
          type: 'object',
          properties: {
            employed: { type: 'boolean', default: false },
          },
        },
      },
      required: ['grossIncome'],
    };

    const fields = extractSchemaFields(schema);
    expect(fields.map((field) => field.name)).toEqual([
      'grossIncome',
      'churchTax',
      'employmentStatus',
      'currentStatus',
    ]);

    const defaults = deriveDefaultValues(schema);
    expect(defaults).toEqual({
      churchTax: false,
      employmentStatus: 'employed',
      currentStatus: { employed: false },
    });
  });
});
