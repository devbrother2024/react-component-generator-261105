import { describe, it, expect } from 'vitest';
import { readStreamEvents } from './streamEvents';
import type { StreamEvent } from './streamEvents';

function streamOf(...chunks: Array<string | Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
      }
      controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const event of readStreamEvents(body)) out.push(event);
  return out;
}

describe('readStreamEvents', () => {
  it('줄 단위 JSON 을 이벤트로 순서대로 내보낸다', async () => {
    const body = streamOf(
      '{"type":"delta","text":"const"}\n{"type":"done","code":"const A = 1;"}\n',
    );
    expect(await collect(body)).toEqual([
      { type: 'delta', text: 'const' },
      { type: 'done', code: 'const A = 1;' },
    ]);
  });

  it('청크 경계에서 잘린 줄을 이어 붙인다', async () => {
    const body = streamOf('{"type":"delta","te', 'xt":"a"}\n');
    expect(await collect(body)).toEqual([{ type: 'delta', text: 'a' }]);
  });

  it('멀티바이트 문자가 청크 경계에서 잘려도 깨지지 않는다', async () => {
    const bytes = new TextEncoder().encode('{"type":"delta","text":"한"}\n');
    // '{"type":"delta","text":"' 가 24바이트라 25번째 바이트는 '한'(3바이트)의 첫 바이트다.
    const body = streamOf(bytes.slice(0, 25), bytes.slice(25));
    expect(await collect(body)).toEqual([{ type: 'delta', text: '한' }]);
  });

  it('빈 줄은 건너뛴다', async () => {
    const body = streamOf('\n{"type":"delta","text":"a"}\n\n');
    expect(await collect(body)).toEqual([{ type: 'delta', text: 'a' }]);
  });

  it('JSON 이 아닌 줄은 해석 실패 안내로 던진다', async () => {
    const body = streamOf('<!doctype html><html></html>\n');
    await expect(collect(body)).rejects.toThrow('서버 응답을 해석할 수 없습니다. 다시 시도해주세요.');
  });

  it('객체가 아닌 JSON 줄도 해석 실패 안내로 던진다', async () => {
    const body = streamOf('null\n');
    await expect(collect(body)).rejects.toThrow('서버 응답을 해석할 수 없습니다. 다시 시도해주세요.');
  });

  it('개행 없이 끝난 마지막 줄도 내보낸다', async () => {
    const body = streamOf('{"type":"done","code":"x"}');
    expect(await collect(body)).toEqual([{ type: 'done', code: 'x' }]);
  });
});
