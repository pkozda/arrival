import { z } from 'zod';

export const RuleOperatorSchema = z.enum([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'exists',
  'contains',
  'not_in',
]);

export type RuleOperator = z.infer<typeof RuleOperatorSchema>;

export const ConditionSchema = z.object({
  field: z.string(),
  operator: RuleOperatorSchema,
  value: z.unknown().optional(),
});

export type Condition = z.infer<typeof ConditionSchema>;

export type RuleExpression =
  | { type: 'and'; rules: RuleExpression[] }
  | { type: 'or'; rules: RuleExpression[] }
  | { type: 'not'; rule: RuleExpression }
  | { type: 'condition'; condition: Condition };

export const RuleExpressionSchema: z.ZodType<RuleExpression> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('and'), rules: z.array(RuleExpressionSchema) }),
    z.object({ type: z.literal('or'), rules: z.array(RuleExpressionSchema) }),
    z.object({ type: z.literal('not'), rule: RuleExpressionSchema }),
    z.object({ type: z.literal('condition'), condition: ConditionSchema }),
  ])
);

export function condition(field: string, operator: RuleOperator, value?: unknown): RuleExpression {
  return { type: 'condition', condition: { field, operator, value } };
}

export function and(...rules: RuleExpression[]): RuleExpression {
  return { type: 'and', rules };
}

export function or(...rules: RuleExpression[]): RuleExpression {
  return { type: 'or', rules };
}

export function not(rule: RuleExpression): RuleExpression {
  return { type: 'not', rule };
}
