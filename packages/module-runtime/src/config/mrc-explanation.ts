export function isMrcExplanationEnabled(): boolean {
  return process.env.ARRIVAL_ATLAS_MRC_EXPLANATION === 'true';
}
