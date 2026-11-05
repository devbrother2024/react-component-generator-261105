import { useState, useCallback } from 'react';
import type { GeneratedComponent, Provider } from '../types';
import { usePersistentState } from './usePersistentState';
import { STORAGE_KEYS } from '../utils/storage';
import { parseComponents } from '../utils/storageParsers';
import { readStreamEvents, UNREADABLE_RESPONSE } from '../utils/streamEvents';
import { stripStreamingFences } from '../utils/streamingCode';

interface UseComponentGeneratorReturn {
  components: GeneratedComponent[];
  /** 생성 중인 컴포넌트. 코드는 스트림이 도착하는 만큼 자란다. 영속화하지 않는다. */
  streamingComponent: GeneratedComponent | null;
  isLoading: boolean;
  error: string | null;
  generate: (prompt: string, apiKey: string | undefined, provider: Provider) => Promise<void>;
  removeComponent: (id: string) => void;
  clearAll: () => void;
}

export function useComponentGenerator(): UseComponentGeneratorReturn {
  const [components, setComponents] = usePersistentState<GeneratedComponent[]>(
    STORAGE_KEYS.components,
    [],
    parseComponents,
  );
  const [streamingComponent, setStreamingComponent] = useState<GeneratedComponent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    setIsLoading(true);
    setError(null);

    // 스트리밍 카드와 최종 카드가 같은 id 를 써야 React 가 카드를 유지한 채 탭만 전환한다.
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = new Date();
    setStreamingComponent({ id, prompt, code: '', createdAt });

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate component');
      }

      let raw = '';
      let finalCode: string | null = null;

      for await (const event of readStreamEvents(res.body)) {
        if (event.type === 'delta') {
          raw += event.text;
          const code = stripStreamingFences(raw);
          setStreamingComponent({ id, prompt, code, createdAt });
        } else if (event.type === 'done') {
          finalCode = event.code;
        } else if (event.type === 'error') {
          throw new Error(event.error || '컴포넌트 생성에 실패했습니다.');
        } else {
          // 구 서버 포맷({ code }) 등 알 수 없는 이벤트. 빈 에러로 조용히 실패하지 않게 한다.
          throw new Error(UNREADABLE_RESPONSE);
        }
      }

      if (finalCode === null) {
        throw new Error('응답이 중간에 끊겼습니다. 다시 시도해주세요.');
      }

      const newComponent: GeneratedComponent = { id, prompt, code: finalCode, createdAt };
      setComponents((prev) => [newComponent, ...prev]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setStreamingComponent(null);
      setIsLoading(false);
    }
  }, [setComponents]);

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, [setComponents]);

  const clearAll = useCallback(() => {
    setComponents([]);
  }, [setComponents]);

  return { components, streamingComponent, isLoading, error, generate, removeComponent, clearAll };
}
