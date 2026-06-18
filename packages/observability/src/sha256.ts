import { createHash } from 'node:crypto';
import { stableStringify } from './stableStringify.js';

export function sha256Checksum(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}
