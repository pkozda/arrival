export type AtlasCosmicTheme = {
  id: 'atlas-cosmic-dark';
  colorScheme: 'dark';
  tokens: {
    bgDeep: string;
    bgMid: string;
    bgSurface: string;
    text: string;
    textMuted: string;
    primary: string;
    accent: string;
    border: string;
    overlay: string;
    radius: string;
    shadow: string;
  };
};

export const ATLAS_COSMIC_THEME: AtlasCosmicTheme = {
  id: 'atlas-cosmic-dark',
  colorScheme: 'dark',
  tokens: {
    bgDeep: 'var(--atlas-bg-deep)',
    bgMid: 'var(--atlas-bg-mid)',
    bgSurface: 'var(--atlas-bg-surface)',
    text: 'var(--atlas-text)',
    textMuted: 'var(--atlas-text-muted)',
    primary: 'var(--color-primary)',
    accent: 'var(--color-accent)',
    border: 'var(--color-border)',
    overlay: 'var(--color-overlay)',
    radius: 'var(--radius)',
    shadow: 'var(--shadow)',
  },
};
