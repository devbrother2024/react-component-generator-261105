import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useComponentGenerator } from './useComponentGenerator';
import { STORAGE_KEYS } from '../utils/storage';
import type { StreamEvent } from '../utils/streamEvents';

const stored = {
  id: 'saved-1',
  prompt: '버튼',
  code: 'render(<button />)',
  createdAt: '2026-11-05T01:02:03.000Z',
};

const readStoredComponents = () =>
  JSON.parse(localStorage.getItem(STORAGE_KEYS.components) ?? '[]');

const line = (event: StreamEvent) => `${JSON.stringify(event)}\n`;

/** 서버의 NDJSON 응답을 흉내 낸다. */
const ndjsonResponse = (...events: StreamEvent[]) =>
  new Response(events.map(line).join(''), {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });

/** 청크를 원하는 시점에 흘려 보낼 수 있는 스트림 응답. */
function controllableResponse() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    response: new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } }),
    send: (event: StreamEvent) => controller.enqueue(encoder.encode(line(event))),
    close: () => controller.close(),
  };
}

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
      vi.fn().mockResolvedValue(ndjsonResponse({ type: 'done', code: 'render(<p />)' })),
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

describe('useComponentGenerator 스트리밍', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('생성 전에는 스트리밍 중인 컴포넌트가 없다', () => {
    const { result } = renderHook(() => useComponentGenerator());
    expect(result.current.streamingComponent).toBeNull();
  });

  it('delta 가 도착할 때마다 스트리밍 컴포넌트의 코드가 누적된다', async () => {
    const stream = controllableResponse();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response));
    const { result } = renderHook(() => useComponentGenerator());

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.generate('버튼', undefined, 'google');
    });

    stream.send({ type: 'delta', text: 'const A' });
    await waitFor(() => expect(result.current.streamingComponent?.code).toBe('const A'));
    stream.send({ type: 'delta', text: ' = 1;' });
    await waitFor(() => expect(result.current.streamingComponent?.code).toBe('const A = 1;'));
    expect(result.current.streamingComponent?.prompt).toBe('버튼');

    stream.send({ type: 'done', code: 'const A = 1;' });
    stream.close();
    await act(() => pending);
  });

  it('스트리밍 중 코드펜스는 화면용 코드에서 가려진다', async () => {
    const stream = controllableResponse();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response));
    const { result } = renderHook(() => useComponentGenerator());

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.generate('버튼', undefined, 'google');
    });

    stream.send({ type: 'delta', text: '```jsx\nconst A = 1;' });
    await waitFor(() => expect(result.current.streamingComponent?.code).toBe('const A = 1;'));

    stream.send({ type: 'done', code: 'const A = 1;' });
    stream.close();
    await act(() => pending);
  });

  it('done 이벤트의 정규화된 코드로 컴포넌트가 추가되고 스트리밍 상태가 끝난다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ndjsonResponse(
          { type: 'delta', text: 'const A = () => null;' },
          { type: 'done', code: 'const A = () => null;\n\nrender(<A />);' },
        ),
      ),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('빈 컴포넌트', undefined, 'google'));

    expect(result.current.streamingComponent).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.components).toHaveLength(1);
    expect(result.current.components[0].code).toBe('const A = () => null;\n\nrender(<A />);');
  });

  it('스트리밍 컴포넌트와 최종 컴포넌트는 같은 id 를 쓴다', async () => {
    const stream = controllableResponse();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response));
    const { result } = renderHook(() => useComponentGenerator());

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.generate('버튼', undefined, 'google');
    });
    await waitFor(() => expect(result.current.streamingComponent).not.toBeNull());
    const streamingId = result.current.streamingComponent?.id;

    stream.send({ type: 'done', code: 'render(<p />)' });
    stream.close();
    await act(() => pending);

    expect(result.current.components[0].id).toBe(streamingId);
  });

  it('스트림 도중 error 이벤트가 오면 에러를 노출하고 컴포넌트를 추가하지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ndjsonResponse(
          { type: 'delta', text: 'const A' },
          { type: 'error', error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        ),
      ),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('버튼', undefined, 'google'));

    expect(result.current.error).toBe('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
    expect(result.current.components).toHaveLength(0);
    expect(result.current.streamingComponent).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('스트림 시작 전 HTTP 에러는 응답 JSON 의 error 를 노출한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Prompt is required' }), { status: 400 }),
      ),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('', undefined, 'google'));

    expect(result.current.error).toBe('Prompt is required');
    expect(result.current.streamingComponent).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('done 없이 스트림이 끊기면 에러로 처리한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(ndjsonResponse({ type: 'delta', text: 'const A' })),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('버튼', undefined, 'google'));

    expect(result.current.error).toBe('응답이 중간에 끊겼습니다. 다시 시도해주세요.');
    expect(result.current.components).toHaveLength(0);
    expect(result.current.streamingComponent).toBeNull();
  });

  it('알 수 없는 형식의 이벤트를 받으면 해석 실패 안내를 노출한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ndjsonResponse({ code: 'render(<p />)' } as unknown as StreamEvent),
      ),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('버튼', undefined, 'google'));

    expect(result.current.error).toBe('서버 응답을 해석할 수 없습니다. 다시 시도해주세요.');
    expect(result.current.components).toHaveLength(0);
  });

  it('error 이벤트의 메시지가 비어 있으면 기본 실패 안내를 노출한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(ndjsonResponse({ type: 'error', error: '' })),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('버튼', undefined, 'google'));

    expect(result.current.error).toBe('컴포넌트 생성에 실패했습니다.');
  });

  it('스트리밍 중인 미완성 컴포넌트는 저장소에 기록되지 않는다', async () => {
    const stream = controllableResponse();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response));
    const { result } = renderHook(() => useComponentGenerator());

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.generate('버튼', undefined, 'google');
    });
    stream.send({ type: 'delta', text: 'const A' });
    await waitFor(() => expect(result.current.streamingComponent?.code).toBe('const A'));

    expect(readStoredComponents()).toEqual([]);

    stream.send({ type: 'done', code: 'render(<p />)' });
    stream.close();
    await act(() => pending);
  });

  it('새 생성을 시작하면 이전 에러가 지워진다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: '실패' }), { status: 500 }))
      .mockResolvedValueOnce(ndjsonResponse({ type: 'done', code: 'render(<p />)' }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useComponentGenerator());

    await act(() => result.current.generate('a', undefined, 'google'));
    expect(result.current.error).toBe('실패');
    await act(() => result.current.generate('b', undefined, 'google'));

    expect(result.current.error).toBeNull();
  });
});
