'use client';

import type { SchemaField } from '@/lib/product-contract';
import { LegacyFormNode } from '@/components/atlas-runtime/legacy';
import { getNestedValue, schemaEnumLabel, schemaFieldLabel } from '@/lib/schema-form-utils';

export type SchemaLabelResolver = {
  fieldLabel: (field: SchemaField, path: string) => string;
  enumLabel: (field: SchemaField, path: string, value: unknown) => string;
};

type Props = {
  fields: SchemaField[];
  defaults: Record<string, unknown>;
  prefix?: string;
  disabled?: boolean;
  submitLabel: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  labelResolver?: SchemaLabelResolver;
};

function SchemaFieldInput({
  field,
  defaults,
  prefix = '',
  disabled = false,
  labelResolver,
}: {
  field: SchemaField;
  defaults: Record<string, unknown>;
  prefix?: string;
  disabled?: boolean;
  labelResolver?: SchemaLabelResolver;
}) {
  const fieldName = prefix ? `${prefix}.${field.name}` : field.name;
  const label = labelResolver
    ? labelResolver.fieldLabel(field, fieldName)
    : schemaFieldLabel(field);
  const defaultValue = getNestedValue(defaults, fieldName);

  if (field.type === 'object' && field.properties) {
    return (
      <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1rem' }}>
        <legend style={{ fontSize: '0.875rem', fontWeight: 600, padding: '0 0.25rem' }}>{label}</legend>
        {field.properties.map((nested) => (
          <SchemaFieldInput
            key={`${fieldName}.${nested.name}`}
            field={nested}
            defaults={defaults}
            prefix={fieldName}
            disabled={disabled}
            labelResolver={labelResolver}
          />
        ))}
      </fieldset>
    );
  }

  if (field.type === 'boolean') {
    return (
      <div className="form-group">
        <input
          id={fieldName}
          name={fieldName}
          type="checkbox"
          defaultChecked={Boolean(defaultValue)}
          disabled={disabled}
        />
        <label htmlFor={fieldName}>{label}</label>
      </div>
    );
  }

  if (field.enumValues && field.enumValues.length > 0) {
    return (
      <div className="form-group">
        <label htmlFor={fieldName}>{label}</label>
        <select id={fieldName} name={fieldName} defaultValue={String(defaultValue ?? field.enumValues[0])} disabled={disabled}>
          {field.enumValues.map((option) => (
            <option key={String(option)} value={String(option)}>
              {labelResolver
                ? labelResolver.enumLabel(field, fieldName, option)
                : schemaEnumLabel(option)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'number' || field.type === 'integer') {
    return (
      <div className="form-group">
        <label htmlFor={fieldName}>{label}</label>
        <input
          id={fieldName}
          name={fieldName}
          type="number"
          defaultValue={defaultValue !== undefined ? Number(defaultValue) : undefined}
          min={field.minimum}
          required={field.required}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className="form-group">
      <label htmlFor={fieldName}>{label}</label>
      <input
        id={fieldName}
        name={fieldName}
        type="text"
        defaultValue={defaultValue !== undefined ? String(defaultValue) : ''}
        required={field.required}
        disabled={disabled}
      />
    </div>
  );
}

export function SchemaForm({
  fields,
  defaults,
  prefix,
  disabled = false,
  submitLabel,
  onSubmit,
  labelResolver,
}: Props) {
  return (
    <LegacyFormNode onSubmit={onSubmit}>
      {fields.map((field) => (
        <SchemaFieldInput
          key={prefix ? `${prefix}.${field.name}` : field.name}
          field={field}
          defaults={defaults}
          prefix={prefix}
          disabled={disabled}
          labelResolver={labelResolver}
        />
      ))}
      <button type="submit" className="btn btn-primary" disabled={disabled} style={{ width: '100%' }}>
        {submitLabel}
      </button>
    </LegacyFormNode>
  );
}
