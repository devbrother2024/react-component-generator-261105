import { describe, it, expect } from 'vitest';
import { parseProvider, parsePromptHistory, parseComponents } from './storageParsers';

describe('parseProvider', () => {
  it('알려진 provider 문자열을 그대로 반환한다', () => {
    expect(parseProvider('anthropic')).toBe('anthropic');
    expect(parseProvider('google')).toBe('google');
  });

  it('알 수 없는 값이면 undefined 를 반환한다', () => {
    expect(parseProvider('openai')).toBeUndefined();
    expect(parseProvider(42)).toBeUndefined();
  });
});

describe('parsePromptHistory', () => {
  it('문자열 배열을 그대로 반환한다', () => {
    expect(parsePromptHistory(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('배열이 아니면 undefined 를 반환한다', () => {
    expect(parsePromptHistory('a')).toBeUndefined();
  });

  it('문자열이 아닌 항목은 걸러낸다', () => {
    expect(parsePromptHistory(['a', 1, null, 'b'])).toEqual(['a', 'b']);
  });
});

describe('parseComponents', () => {
  const stored = {
    id: '1',
    prompt: '버튼',
    code: 'render(<button />)',
    createdAt: '2026-11-05T01:02:03.000Z',
  };

  it('createdAt 문자열을 Date 로 복원한다', () => {
    const [component] = parseComponents([stored]) ?? [];
    expect(component.createdAt).toBeInstanceOf(Date);
    expect(component.createdAt.toISOString()).toBe(stored.createdAt);
  });

  it('배열이 아니면 undefined 를 반환한다', () => {
    expect(parseComponents({})).toBeUndefined();
  });

  it('필드가 빠진 항목은 걸러낸다', () => {
    const result = parseComponents([stored, { id: '2', prompt: 'x' }]);
    expect(result).toHaveLength(1);
    expect(result?.[0].id).toBe('1');
  });

  it('createdAt 이 유효하지 않은 날짜면 해당 항목을 걸러낸다', () => {
    expect(parseComponents([{ ...stored, createdAt: 'not-a-date' }])).toEqual([]);
  });
});
