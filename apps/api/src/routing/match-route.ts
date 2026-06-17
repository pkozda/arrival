export function normalizeRoutePath(path: string): string {
  const withoutQuery = path.split('?')[0] ?? path;
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

export function matchRoute(pattern: string, path: string): boolean {
  const patternParts = normalizeRoutePath(pattern).split('/').filter(Boolean);
  const pathParts = normalizeRoutePath(path).split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return false;
  }

  return patternParts.every((segment, index) => {
    if (segment.startsWith(':')) {
      return pathParts[index] !== undefined && pathParts[index].length > 0;
    }
    return segment === pathParts[index];
  });
}
