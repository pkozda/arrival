export function isMrcExplanationEnabled(): boolean {
  return process.env.ARRIVALOS_MRC_EXPLANATION === 'true';
}
