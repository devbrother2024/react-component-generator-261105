import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readStorage, writeStorage } from './storage';

const asStrings = (raw: unknown) =>
  Array.isArray(raw) && raw.every((v) => typeof v === 'string') ? (raw as string[]) : undefined;

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('저장한 값을 다시 읽어온다', () => {
    writeStorage('k', ['a', 'b']);
    expect(readStorage('k', asStrings, [])).toEqual(['a', 'b']);
  });

  it('저장된 값이 없으면 fallback 을 반환한다', () => {
    expect(readStorage('missing', asStrings, ['x'])).toEqual(['x']);
  });

  it('저장된 JSON 이 깨져 있으면 fallback 을 반환한다', () => {
    localStorage.setItem('k', '{not json');
    expect(readStorage('k', asStrings, ['x'])).toEqual(['x']);
  });

  it('parse 가 undefined 를 반환하면 fallback 을 반환한다', () => {
    localStorage.setItem('k', JSON.stringify({ not: 'array' }));
    expect(readStorage('k', asStrings, ['x'])).toEqual(['x']);
  });

  it('getItem 이 예외를 던지면 fallback 을 반환한다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readStorage('k', asStrings, ['x'])).toEqual(['x']);
  });

  it('setItem 이 예외를 던져도 writeStorage 는 throw 하지 않는다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => writeStorage('k', ['a'])).not.toThrow();
  });
});
