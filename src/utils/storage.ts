// localStorage 접근은 비공개 모드·용량 초과·접근 거부로 언제든 던질 수 있어 모두 삼킨다.
// 저장 실패가 앱 동작을 막아서는 안 된다.

// API 키는 의도적으로 목록에 없다. 저장 대상이 아니다 (src/AGENTS.md Local Golden Rules).
export const STORAGE_KEYS = {
  provider: 'rcg:provider',
  promptHistory: 'rcg:prompt-history',
  components: 'rcg:components',
} as const;

export function readStorage<T>(
  key: string,
  parse: (raw: unknown) => T | undefined,
  fallback: T,
): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return parse(JSON.parse(stored)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패는 무시한다.
  }
}
