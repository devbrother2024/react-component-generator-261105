import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useComponentGenerator } from './useComponentGenerator';
import { STORAGE_KEYS } from '../utils/storage';

const stored = {
  id: 'saved-1',
  prompt: '버튼',
  code: 'render(<button />)',
  createdAt: '2026-11-05T01:02:03.000Z',
};

const readStoredComponents = () =>
  JSON.parse(localStorage.getItem(STORAGE_KEYS.components) ?? '[]');

describe('useComponentGenerator 영속화', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('저장된 컴포넌트 목록으로 시작한다', () => {
    localStorage.setItem(STORAGE_KEYS.components, JSON.stringify([stored]));
    const { result } = renderHook(() => useComponentGenerator());
    expect(result.current.components).toHaveLength(1);
    expect(result.current.components[0].createdAt).toBeInstanceOf(Date);
  });

  it('컴포넌트를 삭제하면 저장소에도 반영된다', () => {
    localStorage.setItem(STORAGE_KEYS.components, JSON.stringify([stored]));
    const { result } = renderHook(() => useComponentGenerator());
    act(() => result.current.removeComponent('saved-1'));
    expect(readStoredComponents()).toEqual([]);
  });

  it('생성에 성공하면 새 컴포넌트가 저장소에 최신순으로 추가된다', async () => {
    localStorage.setItem(STORAGE_KEYS.components, JSON.stringify([stored]));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: 'render(<p />)' }) }),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('문단', undefined, 'google'));

    await waitFor(() => expect(readStoredComponents()).toHaveLength(2));
    expect(readStoredComponents()[0].prompt).toBe('문단');
  });

  it('전체 삭제하면 저장소도 비워진다', () => {
    localStorage.setItem(STORAGE_KEYS.components, JSON.stringify([stored]));
    const { result } = renderHook(() => useComponentGenerator());
    act(() => result.current.clearAll());
    expect(readStoredComponents()).toEqual([]);
  });
});
