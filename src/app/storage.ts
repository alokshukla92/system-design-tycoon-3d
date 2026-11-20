// localStorage wrapper. Keys are namespaced `sdt:<name>` and JSON-encoded; storage errors are swallowed.
export const storage = {
  get<T>(name: string, fallback: T): T {
    try {
      return (JSON.parse(localStorage.getItem(`sdt:${name}`) as string) as T) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(name: string, value: unknown): void {
    try {
      localStorage.setItem(`sdt:${name}`, JSON.stringify(value));
    } catch {
      /* quota / private mode */
    }
  },
};
