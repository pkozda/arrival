import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTranslations } from '@arrival-atlas/core';
import type { SupportedLanguage } from '@/lib/product-contract';
import { DomainFieldRenderer } from '@/components/profile/DomainFieldRenderer';
import { DomainMutationEditor } from '@/components/profile/DomainMutationEditor';
import { getDomainEditSection } from '@/lib/profile-correction';

const tState = {
  language: 'en' as SupportedLanguage,
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/profile/move-to-germany/edit',
}));

vi.mock('@/components/AppProvider', () => ({
  useApp: () => ({
    language: tState.language,
    userContext: null,
    submitMutation: vi.fn(),
    profileHeadRevision: 0,
    refreshSessionState: vi.fn(),
    sessionId: 'session-1',
    t: (key: string) => getTranslations(tState.language)[key] ?? key,
  }),
}));

vi.mock('@/components/atlas-runtime', () => ({
  AtlasLink: ({
    children,
    href,
    ...props
  }: {
    children?: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  AtlasSecondaryButton: ({
    children,
    onClick,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  PageHeader: ({
    eyebrow,
    title,
    description,
    leading,
  }: {
    eyebrow?: React.ReactNode;
    title?: React.ReactNode;
    description?: React.ReactNode;
    leading?: React.ReactNode;
  }) => (
    <header>
      <div>{leading}</div>
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ),
}));

vi.mock('@/components/atlas-runtime/legacy', () => ({
  LegacyFormNode: ({
    children,
    onSubmit,
  }: {
    children?: React.ReactNode;
    onSubmit?: (event: React.FormEvent) => void;
  }) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(event);
      }}
    >
      {children}
    </form>
  ),
}));

vi.mock('@/lib/api', () => ({
  updateSessionLanguage: vi.fn(),
  updateSessionTheme: vi.fn(),
}));

vi.mock('@/lib/profile-correction/submit-domain-correction', () => ({
  submitDomainCorrectionRequests: vi.fn(),
}));

describe('Profile Intake localization', () => {
  let root: Root | null = null;

  beforeEach(() => {
    tState.language = 'en';
    document.body.innerHTML = '';
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    document.body.innerHTML = '';
  });

  async function render(node: React.ReactNode) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(node);
    });
    return container;
  }

  it('renders English field labels by default', async () => {
    const field = getDomainEditSection('move-to-germany').fields.find(
      (item) => item.formKey === 'residencyStatus'
    )!;
    const container = await render(
      <DomainFieldRenderer field={field} value="" onChange={() => undefined} />
    );
    expect(container.textContent).toContain('Residency status');
    expect(container.textContent).toContain('EU citizen');
    expect(container.querySelector('select')?.getAttribute('aria-label')).toBe('Residency status');
  });

  it('localizes field and enum labels for DE / RU / UA without reload', async () => {
    const field = getDomainEditSection('work-income').fields.find(
      (item) => item.formKey === 'employmentStatus'
    )!;
    const container = await render(
      <DomainFieldRenderer field={field} value="" onChange={() => undefined} />
    );

    tState.language = 'de';
    await act(async () => {
      root!.render(<DomainFieldRenderer field={field} value="" onChange={() => undefined} />);
    });
    expect(container.textContent).toContain('Beschäftigungsstatus');
    expect(container.textContent).toContain('Vollzeit beschäftigt');
    expect(container.querySelector('select')?.getAttribute('aria-label')).toBe(
      'Beschäftigungsstatus'
    );

    tState.language = 'ru';
    await act(async () => {
      root!.render(<DomainFieldRenderer field={field} value="" onChange={() => undefined} />);
    });
    expect(container.textContent).toContain('Статус занятости');
    expect(container.textContent).toContain('Работаю полный день');

    tState.language = 'ua';
    await act(async () => {
      root!.render(<DomainFieldRenderer field={field} value="" onChange={() => undefined} />);
    });
    expect(container.textContent).toContain('Статус зайнятості');
    expect(container.textContent).toContain('Працюю повний день');
    expect(container.textContent).not.toContain('Employment status');
  });

  it('localizes DomainMutationEditor chrome and back link for returning UA users', async () => {
    tState.language = 'ua';
    const container = await render(
      <DomainMutationEditor
        domainSlug="move-to-germany"
        onCancel={() => undefined}
        onSuccess={() => undefined}
      />
    );

    expect(container.querySelector('[data-ui-surface="profile-intake"]')).toBeTruthy();
    expect(container.textContent).toContain('Виправити дані');
    expect(container.textContent).toContain('Статус перебування');
    expect(container.textContent).toContain('Зберегти');
    expect(container.textContent).toContain('Скасувати');
    expect(container.textContent).toContain('Ваш переїзд до Німеччини');
    expect(container.textContent).not.toContain('Correct information');
    expect(container.textContent).not.toContain('Residency status');
  });
});
