export type EvidenceType =
  | 'OFFICIAL_SOURCE'
  | 'CURRENT_PAGE'
  | 'TERMS'
  | 'LOCATION'
  | 'SALARY'
  | 'DEADLINE'
  | 'EMPLOYMENT_TYPE'
  | 'PARTICIPATION_REQUIREMENT'
  | 'OTHER';

/**
 * Attributed retained justification. AI may propose; persistence requires real sourceUrl/contentRef.
 * AI must not fabricate Evidence URLs (ADR-006).
 */
export type Evidence = {
  id: string;
  type: EvidenceType;
  sourceUrl: string;
  statement: string;
  capturedAt: string;
  contentRef?: string;
};
