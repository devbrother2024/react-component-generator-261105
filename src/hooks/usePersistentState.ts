import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { readStorage, writeStorage } from '../utils/storage';

// useState 와 같은 시그니처에 localStorage 동기화만 얹는다.
// API 키처럼 저장하면 안 되는 값에는 쓰지 마라 (src/AGENTS.md Local Golden Rules).
export function usePersistentState<T>(
  key: string,
  fallback: T,
  parse: (raw: unknown) => T | undefined,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readStorage(key, parse, fallback));

  useEffect(() => {
    writeStorage(key, value);
  }, [key, value]);

  return [value, setValue];
}
