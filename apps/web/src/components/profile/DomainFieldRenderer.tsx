'use client';

import type { DomainDraftValues, DomainEditFieldDefinition } from '@/lib/profile-correction';

type Props = {
  field: DomainEditFieldDefinition;
  value: string | boolean | number | undefined;
  onChange: (formKey: string, value: string | boolean | number | undefined) => void;
  disabled?: boolean;
};

export function DomainFieldRenderer({ field, value, onChange, disabled = false }: Props) {
  const inputId = `profile-field-${field.formKey}`;

  if (field.type === 'boolean') {
    return (
      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          id={inputId}
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) => onChange(field.formKey, event.target.checked)}
        />
        <label htmlFor={inputId} style={{ margin: 0 }}>
          {field.label}
        </label>
      </div>
    );
  }

  if (field.type === 'select' && field.options) {
    return (
      <div className="form-group">
        <label htmlFor={inputId}>{field.label}</label>
        <select
          id={inputId}
          className="form-control"
          value={value === undefined ? '' : String(value)}
          disabled={disabled}
          onChange={(event) => onChange(field.formKey, event.target.value)}
        >
          <option value="">Select…</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="form-group">
      <label htmlFor={inputId}>{field.label}</label>
      <input
        id={inputId}
        className="form-control"
        type={field.type === 'number' ? 'number' : 'text'}
        value={value === undefined ? '' : String(value)}
        placeholder={field.placeholder}
        min={field.min}
        max={field.max}
        disabled={disabled}
        onChange={(event) =>
          onChange(
            field.formKey,
            field.type === 'number' ? event.target.value : event.target.value
          )
        }
      />
    </div>
  );
}

export type { DomainDraftValues };
