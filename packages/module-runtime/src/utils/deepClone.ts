export function deepClone<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  return structuredClone(value);
}
