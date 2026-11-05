import type { GeneratedComponent, Provider } from '../types';

// localStorage 의 값은 외부 입력이다. 스키마가 바뀌었거나 손상된 데이터가 앱을 깨뜨리지 않도록
// 각 파서는 형태를 검증하고, 맞지 않으면 undefined 를 반환해 호출 측이 fallback 을 쓰게 한다.

const PROVIDERS: readonly Provider[] = ['anthropic', 'google'];

export function parseProvider(raw: unknown): Provider | undefined {
  return PROVIDERS.find((p) => p === raw);
}

export function parsePromptHistory(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.filter((item): item is string => typeof item === 'string');
}

function parseComponent(raw: unknown): GeneratedComponent | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { id, prompt, code, createdAt } = raw as Record<string, unknown>;
  if (typeof id !== 'string' || typeof prompt !== 'string' || typeof code !== 'string') {
    return undefined;
  }
  if (typeof createdAt !== 'string') return undefined;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return undefined;
  return { id, prompt, code, createdAt: date };
}

export function parseComponents(raw: unknown): GeneratedComponent[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.flatMap((item) => parseComponent(item) ?? []);
}
