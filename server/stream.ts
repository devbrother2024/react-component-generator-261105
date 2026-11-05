// 스트리밍 응답 처리용 순수 함수들. 부수효과(Bun.serve 등)가 없어 단위 테스트가 가능하다.

import { stripCodeFences, ensureRenderCall } from './generator';
import { mapErrorMessage } from './errors';

/** 서버 → 클라이언트 NDJSON 이벤트. 한 줄에 하나씩 보낸다. */
export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; code: string }
  | { type: 'error'; error: string };

/** 이벤트를 NDJSON 한 줄로 직렬화한다. JSON 이스케이프 덕에 텍스트의 개행이 줄을 깨지 않는다. */
export function encodeEvent(event: StreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/**
 * provider 의 SSE 응답 본문에서 `data:` 페이로드를 순서대로 꺼낸다.
 * 청크 경계에서 잘린 줄·멀티바이트 문자를 이어 붙이고, `[DONE]` 센티널은 건너뛴다.
 */
export async function* readSseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const extract = (line: string): string | null => {
    if (!line.startsWith('data:')) return null;
    const data = line.slice(5).trimStart();
    return data === '[DONE]' ? null : data;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const data = extract(line.replace(/\r$/, ''));
        if (data !== null) yield data;
      }
    }
    buffer += decoder.decode();
    const last = extract(buffer.replace(/\r$/, ''));
    if (last !== null) yield last;
  } finally {
    reader.releaseLock();
  }
}

/**
 * provider 텍스트 델타 스트림을 클라이언트용 NDJSON 이벤트 스트림으로 바꾼다.
 * 델타는 원문 그대로 내보내고, 끝나면 펜스 제거·render 주입을 거친 최종 코드를 done 으로 보낸다.
 * 클라이언트가 연결을 끊으면 `onCancel` 로 업스트림 요청을 중단할 기회를 준다.
 */
export function createEventStream(
  textStream: AsyncGenerator<string>,
  onCancel?: () => void,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cancelled = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      // 취소된 스트림에 쓰면 예외가 나므로 막는다.
      const send = (event: StreamEvent) => {
        if (!cancelled) controller.enqueue(encoder.encode(encodeEvent(event)));
      };

      try {
        let raw = '';
        for await (const text of textStream) {
          if (cancelled) break; // 연결이 끊겼다면 남은 토큰을 더 소비하지 않는다
          raw += text;
          send({ type: 'delta', text });
        }

        const code = ensureRenderCall(stripCodeFences(raw));
        if (code) {
          send({ type: 'done', code });
        } else {
          send({ type: 'error', error: '모델이 빈 응답을 반환했습니다. 다시 시도해주세요.' });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        send({ type: 'error', error: mapErrorMessage(message).error });
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() {
      cancelled = true;
      onCancel?.();
    },
  });
}

const STREAM_INTERRUPTED = '응답이 중간에 끊겼습니다. 다시 시도해주세요.';

/**
 * Anthropic SSE 본문에서 텍스트 델타를 꺼낸다.
 * 도중 error 이벤트, 또는 message_stop 없는 종료는 잘린 코드가 성공으로 나가지 않도록 던진다.
 * 에러 포맷 `Claude API error: <종류>` 는 mapErrorMessage 가 의존한다.
 */
export async function* anthropicTextDeltas(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  let finished = false;
  for await (const data of readSseData(body)) {
    const { text, error, done } = parseAnthropicChunk(data);
    if (error) throw new Error(`Claude API error: ${error}`);
    if (text) yield text;
    if (done) finished = true;
  }
  if (!finished) throw new Error(STREAM_INTERRUPTED);
}

/**
 * Gemini SSE 본문에서 텍스트를 꺼낸다.
 * 도중 error 페이로드, MAX_TOKENS 절단, finishReason 없는 종료는 던진다.
 * 에러 포맷 `Gemini API error: <코드>` 는 mapErrorMessage 가 의존한다.
 */
export async function* googleTextDeltas(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  let finished = false;
  for await (const data of readSseData(body)) {
    const { text, finishReason, error } = parseGoogleChunk(data);
    if (error) throw new Error(`Gemini API error: ${error}`);
    if (text) yield text;
    if (finishReason === 'MAX_TOKENS') {
      throw new Error('생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.');
    }
    if (finishReason) finished = true;
  }
  if (!finished) throw new Error(STREAM_INTERRUPTED);
}

function safeParse(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/** Anthropic Messages 스트림 이벤트에서 텍스트 델타를 꺼낸다. 도중의 error 이벤트는 종류를 `error` 로 돌려준다. */
export function parseAnthropicChunk(data: string): { text: string; error?: string; done?: boolean } {
  const event = safeParse(data) as {
    type?: string;
    delta?: { type?: string; text?: string };
    error?: { type?: string };
  } | null;

  if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    return { text: event.delta.text ?? '' };
  }
  if (event?.type === 'error') {
    return { text: '', error: event.error?.type ?? 'unknown_error' };
  }
  if (event?.type === 'message_stop') {
    return { text: '', done: true };
  }
  return { text: '' };
}

/** Gemini streamGenerateContent 청크에서 텍스트와 종료 사유를 꺼낸다. 도중 error 페이로드는 코드를 `error` 로 돌려준다. */
export function parseGoogleChunk(data: string): { text: string; finishReason?: string; error?: string } {
  const chunk = safeParse(data) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    error?: { code?: number | string; status?: string };
  } | null;

  if (chunk?.error) {
    return { text: '', error: String(chunk.error.code ?? chunk.error.status ?? 'unknown') };
  }

  const candidate = chunk?.candidates?.[0];
  if (!candidate) return { text: '' };

  return {
    text: candidate.content?.parts?.map((part) => part.text ?? '').join('') ?? '',
    finishReason: candidate.finishReason,
  };
}
