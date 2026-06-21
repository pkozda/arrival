export const LE_UX_SPACE = {
  section: '3rem',
  sectionLarge: '3rem',
  card: '1rem',
  cardPadding: '1rem',
  columnGap: '1.5rem',
} as const;

export const LE_UX_SECTION_STYLE = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: LE_UX_SPACE.section,
};

export const LE_UX_BREAKDOWN_GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))',
  gap: LE_UX_SPACE.columnGap,
  alignItems: 'start',
} as const;

export const LE_UX_BREAKDOWN_GRID_STACKED = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: LE_UX_SPACE.section,
} as const;
