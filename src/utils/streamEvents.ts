// 서버가 보내는 NDJSON 스트림(`server/stream.ts` 의 StreamEvent)을 읽는 순수 헬퍼.

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; code: string }
  | { type: 'error'; error: string };

/** 이벤트로 해석할 수 없는 응답(HTML, null, 구 서버 포맷 등)을 만났을 때 사용자에게 보이는 안내. */
export const UNREADABLE_RESPONSE = '서버 응답을 해석할 수 없습니다. 다시 시도해주세요.';

function parseEvent(line: string): StreamEvent {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new Error(UNREADABLE_RESPONSE);
  }
  if (typeof value !== 'object' || value === null) throw new Error(UNREADABLE_RESPONSE);
  return value as StreamEvent;
}

/** NDJSON 본문을 줄 단위로 파싱해 이벤트를 순서대로 내보낸다. */
export async function* readStreamEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) yield parseEvent(line);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) yield parseEvent(buffer);
  } finally {
    reader.releaseLock();
  }
}
