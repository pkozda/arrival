const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

export function defineModuleVersion(version: string): string {
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(`Module version must be semver (x.y.z): "${version}"`);
  }

  return version;
}

export function parseSemver(version: string): { major: number; minor: number; patch: number } {
  defineModuleVersion(version);
  const [major, minor, patch] = version.split('.').map((part) => Number(part));
  return { major, minor, patch };
}

export function compareSemver(
  left: string,
  right: string
): -1 | 0 | 1 {
  const a = parseSemver(left);
  const b = parseSemver(right);

  if (a.major !== b.major) {
    return a.major > b.major ? 1 : -1;
  }
  if (a.minor !== b.minor) {
    return a.minor > b.minor ? 1 : -1;
  }
  if (a.patch !== b.patch) {
    return a.patch > b.patch ? 1 : -1;
  }
  return 0;
}
