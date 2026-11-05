import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistentState } from './usePersistentState';

const asStrings = (raw: unknown) =>
  Array.isArray(raw) && raw.every((v) => typeof v === 'string') ? (raw as string[]) : undefined;

describe('usePersistentState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('저장된 값이 있으면 초기값으로 복원한다', () => {
    localStorage.setItem('k', JSON.stringify(['saved']));
    const { result } = renderHook(() => usePersistentState('k', [] as string[], asStrings));
    expect(result.current[0]).toEqual(['saved']);
  });

  it('저장된 값이 없으면 fallback 을 초기값으로 쓴다', () => {
    const { result } = renderHook(() => usePersistentState('k', ['init'], asStrings));
    expect(result.current[0]).toEqual(['init']);
  });

  it('상태가 바뀌면 localStorage 에 저장한다', () => {
    const { result } = renderHook(() => usePersistentState('k', [] as string[], asStrings));
    act(() => result.current[1](['changed']));
    expect(JSON.parse(localStorage.getItem('k') ?? 'null')).toEqual(['changed']);
  });
});
