import { describe, it, expect, vi } from 'vitest';
import {
  encodeEvent,
  readSseData,
  parseAnthropicChunk,
  parseGoogleChunk,
  createEventStream,
  anthropicTextDeltas,
  googleTextDeltas,
} from './stream';
import type { StreamEvent } from './stream';

async function* textOf(...parts: string[]): AsyncGenerator<string> {
  for (const part of parts) yield part;
}

async function* failingAfter(parts: string[], message: string): AsyncGenerator<string> {
  for (const part of parts) yield part;
  throw new Error(message);
}

async function readEvents(stream: ReadableStream<Uint8Array>): Promise<StreamEvent[]> {
  const text = await new Response(stream).text();
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as StreamEvent);
}

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>): Promise<string[]> {
  const out: string[] = [];
  for await (const data of readSseData(body)) out.push(data);
  return out;
}

describe('encodeEvent', () => {
  it('이벤트를 JSON 한 줄과 개행으로 직렬화한다', () => {
    expect(encodeEvent({ type: 'delta', text: 'const' })).toBe('{"type":"delta","text":"const"}\n');
  });

  it('텍스트 안의 개행은 이스케이프되어 한 줄을 유지한다', () => {
    const line = encodeEvent({ type: 'delta', text: 'a\nb' });
    expect(line.trimEnd().split('\n')).toHaveLength(1);
  });
});

describe('readSseData', () => {
  it('data: 줄의 페이로드를 순서대로 내보낸다', async () => {
    const body = streamOf('data: {"a":1}\n\ndata: {"a":2}\n\n');
    expect(await collect(body)).toEqual(['{"a":1}', '{"a":2}']);
  });

  it('청크 경계에서 잘린 줄을 이어 붙인다', async () => {
    const body = streamOf('data: {"a"', ':1}\n\ndata: {"a":2}\n\n');
    expect(await collect(body)).toEqual(['{"a":1}', '{"a":2}']);
  });

  it('멀티바이트 문자가 청크 경계에서 잘려도 깨지지 않는다', async () => {
    const bytes = new TextEncoder().encode('data: 한글\n\n');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 8)); // '한' 의 중간
        controller.enqueue(bytes.slice(8));
        controller.close();
      },
    });
    expect(await collect(body)).toEqual(['한글']);
  });

  it('event: 줄과 주석 줄은 무시한다', async () => {
    const body = streamOf('event: content_block_delta\n: ping\ndata: {"a":1}\n\n');
    expect(await collect(body)).toEqual(['{"a":1}']);
  });

  it('CRLF 개행도 처리한다', async () => {
    const body = streamOf('data: {"a":1}\r\n\r\n');
    expect(await collect(body)).toEqual(['{"a":1}']);
  });

  it('스트림이 개행 없이 끝나도 마지막 data 줄을 내보낸다', async () => {
    const body = streamOf('data: {"a":1}');
    expect(await collect(body)).toEqual(['{"a":1}']);
  });

  it('[DONE] 센티널은 내보내지 않는다', async () => {
    const body = streamOf('data: {"a":1}\n\ndata: [DONE]\n\n');
    expect(await collect(body)).toEqual(['{"a":1}']);
  });
});

describe('parseAnthropicChunk', () => {
  it('content_block_delta 의 text_delta 에서 텍스트를 꺼낸다', () => {
    const data = JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'const A' },
    });
    expect(parseAnthropicChunk(data)).toEqual({ text: 'const A' });
  });

  it('텍스트 델타가 아닌 이벤트는 빈 텍스트를 돌려준다', () => {
    const data = JSON.stringify({ type: 'message_start', message: {} });
    expect(parseAnthropicChunk(data)).toEqual({ text: '' });
  });

  it('JSON 이 아닌 페이로드는 빈 텍스트를 돌려준다', () => {
    expect(parseAnthropicChunk('not json')).toEqual({ text: '' });
  });

  it('message_stop 이벤트는 정상 종료 표시를 돌려준다', () => {
    const data = JSON.stringify({ type: 'message_stop' });
    expect(parseAnthropicChunk(data)).toEqual({ text: '', done: true });
  });

  it('스트림 도중의 error 이벤트는 에러 종류를 돌려준다', () => {
    const data = JSON.stringify({
      type: 'error',
      error: { type: 'overloaded_error', message: 'Overloaded' },
    });
    expect(parseAnthropicChunk(data)).toEqual({ text: '', error: 'overloaded_error' });
  });
});

describe('parseGoogleChunk', () => {
  it('candidates 의 parts 텍스트를 이어 붙인다', () => {
    const data = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'const ' }, { text: 'A' }] } }],
    });
    expect(parseGoogleChunk(data)).toEqual({ text: 'const A', finishReason: undefined });
  });

  it('finishReason 을 함께 돌려준다', () => {
    const data = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'MAX_TOKENS' }],
    });
    expect(parseGoogleChunk(data).finishReason).toBe('MAX_TOKENS');
  });

  it('텍스트가 없는 청크는 빈 텍스트를 돌려준다', () => {
    const data = JSON.stringify({ candidates: [{ finishReason: 'STOP' }] });
    expect(parseGoogleChunk(data)).toEqual({ text: '', finishReason: 'STOP' });
  });

  it('JSON 이 아닌 페이로드는 빈 텍스트를 돌려준다', () => {
    expect(parseGoogleChunk('not json')).toEqual({ text: '' });
  });

  it('스트림 도중의 error 페이로드는 에러 코드를 돌려준다', () => {
    const data = JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE', message: 'overloaded' } });
    expect(parseGoogleChunk(data)).toEqual({ text: '', error: '503' });
  });
});

const sse = (...payloads: object[]) => payloads.map((p) => `data: ${JSON.stringify(p)}\n\n`).join('');

const googleChunk = (text: string, finishReason?: string) => ({
  candidates: [{ content: { parts: [{ text }] }, ...(finishReason && { finishReason }) }],
});

const anthropicDelta = (text: string) => ({
  type: 'content_block_delta',
  delta: { type: 'text_delta', text },
});

async function drain(stream: AsyncGenerator<string>): Promise<{ texts: string[]; error?: string }> {
  const texts: string[] = [];
  try {
    for await (const text of stream) texts.push(text);
  } catch (err) {
    return { texts, error: err instanceof Error ? err.message : String(err) };
  }
  return { texts };
}

const INTERRUPTED = '응답이 중간에 끊겼습니다. 다시 시도해주세요.';

describe('googleTextDeltas', () => {
  it('청크의 텍스트를 순서대로 내보낸다', async () => {
    const body = streamOf(sse(googleChunk('const A'), googleChunk(' = 1;', 'STOP')));
    expect(await drain(googleTextDeltas(body))).toEqual({ texts: ['const A', ' = 1;'] });
  });

  it('MAX_TOKENS 로 끝나면 마지막 텍스트까지 내보낸 뒤 절단 에러를 던진다', async () => {
    const body = streamOf(sse(googleChunk('const A', 'MAX_TOKENS')));
    expect(await drain(googleTextDeltas(body))).toEqual({
      texts: ['const A'],
      error: '생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.',
    });
  });

  it('스트림 도중 error 페이로드가 오면 `Gemini API error: <코드>` 로 던진다', async () => {
    const body = streamOf(sse(googleChunk('const A'), { error: { code: 503 } }));
    expect(await drain(googleTextDeltas(body))).toEqual({
      texts: ['const A'],
      error: 'Gemini API error: 503',
    });
  });

  it('finishReason 없이 스트림이 끝나면 끊김 에러를 던진다', async () => {
    const body = streamOf(sse(googleChunk('const A')));
    expect(await drain(googleTextDeltas(body))).toEqual({ texts: ['const A'], error: INTERRUPTED });
  });
});

describe('anthropicTextDeltas', () => {
  it('텍스트 델타를 순서대로 내보낸다', async () => {
    const body = streamOf(
      sse(anthropicDelta('const A'), anthropicDelta(' = 1;'), { type: 'message_stop' }),
    );
    expect(await drain(anthropicTextDeltas(body))).toEqual({ texts: ['const A', ' = 1;'] });
  });

  it('스트림 도중 error 이벤트가 오면 `Claude API error: <종류>` 로 던진다', async () => {
    const body = streamOf(
      sse(anthropicDelta('const A'), { type: 'error', error: { type: 'overloaded_error' } }),
    );
    expect(await drain(anthropicTextDeltas(body))).toEqual({
      texts: ['const A'],
      error: 'Claude API error: overloaded_error',
    });
  });

  it('message_stop 없이 스트림이 끝나면 끊김 에러를 던진다', async () => {
    const body = streamOf(sse(anthropicDelta('const A')));
    expect(await drain(anthropicTextDeltas(body))).toEqual({ texts: ['const A'], error: INTERRUPTED });
  });
});

describe('createEventStream', () => {
  it('텍스트 델타를 delta 이벤트로 순서대로 내보낸다', async () => {
    const events = await readEvents(createEventStream(textOf('const A', ' = 1;')));
    expect(events.slice(0, 2)).toEqual([
      { type: 'delta', text: 'const A' },
      { type: 'delta', text: ' = 1;' },
    ]);
  });

  it('마지막에 정규화된 코드를 done 이벤트로 내보낸다', async () => {
    const events = await readEvents(
      createEventStream(textOf('```jsx\nconst Card = () => null;', '\n```')),
    );
    expect(events.at(-1)).toEqual({
      type: 'done',
      code: 'const Card = () => null;\n\nrender(<Card />);',
    });
  });

  it('도중에 에러가 나면 error 이벤트로 끝나고 done 은 보내지 않는다', async () => {
    const events = await readEvents(
      createEventStream(failingAfter(['const A'], 'Gemini API error: 503')),
    );
    expect(events.map((event) => event.type)).toEqual(['delta', 'error']);
    expect(events.at(-1)).toEqual({
      type: 'error',
      error: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
    });
  });

  it('텍스트가 하나도 없으면 error 이벤트를 보낸다', async () => {
    const events = await readEvents(createEventStream(textOf()));
    expect(events).toEqual([
      { type: 'error', error: '모델이 빈 응답을 반환했습니다. 다시 시도해주세요.' },
    ]);
  });

  it('클라이언트가 스트림을 취소하면 onCancel 이 한 번 호출된다', async () => {
    const onCancel = vi.fn();
    async function* source(): AsyncGenerator<string> {
      yield 'a';
      await new Promise(() => {}); // 다음 청크를 기다리는 중
    }

    const reader = createEventStream(source(), onCancel).getReader();
    await reader.read(); // 첫 delta
    await reader.cancel();

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('취소된 뒤에는 원본에서 다음 텍스트를 더 읽지 않는다', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let requestedAfterB = false;
    async function* source(): AsyncGenerator<string> {
      yield 'a';
      await gate;
      yield 'b';
      requestedAfterB = true; // 소비자가 'b' 다음 값을 요청해야만 도달한다
      yield 'c';
    }

    const reader = createEventStream(source()).getReader();
    await reader.read(); // 첫 delta
    await reader.cancel();
    release();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(requestedAfterB).toBe(false);
  });
});
