export function isDevToolsEnabled(): boolean {
  if (process.env.ARRIVAL_ATLAS_DEV_TOOLS === 'false') {
    return false;
  }

  if (process.env.ARRIVAL_ATLAS_DEV_TOOLS === 'true') {
    return true;
  }

  return process.env.NODE_ENV !== 'production';
}
