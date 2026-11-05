import { describe, it, expect } from 'vitest';
import { mapErrorMessage } from './errors';

describe('mapErrorMessage', () => {
  it('503 에러는 과부하 안내로 매핑한다', () => {
    expect(mapErrorMessage('Gemini API error: 503')).toEqual({
      status: 503,
      error: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
    });
  });

  it('429 에러는 요청 과다 안내로 매핑한다', () => {
    expect(mapErrorMessage('Claude API error: 429')).toEqual({
      status: 429,
      error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    });
  });

  it('그 밖의 에러는 메시지를 그대로 500 으로 돌려준다', () => {
    expect(mapErrorMessage('Claude API error: 401')).toEqual({
      status: 500,
      error: 'Claude API error: 401',
    });
  });
});

describe('mapErrorMessage — Anthropic 스트림 에러', () => {
  it('overloaded_error 는 과부하 안내로 매핑한다', () => {
    expect(mapErrorMessage('Claude API error: overloaded_error').status).toBe(503);
  });

  it('rate_limit_error 는 요청 과다 안내로 매핑한다', () => {
    expect(mapErrorMessage('Claude API error: rate_limit_error').status).toBe(429);
  });
});

describe('mapErrorMessage — Gemini 스트림 status 문자열', () => {
  it('UNAVAILABLE 은 과부하 안내로 매핑한다', () => {
    expect(mapErrorMessage('Gemini API error: UNAVAILABLE').status).toBe(503);
  });

  it('RESOURCE_EXHAUSTED 는 요청 과다 안내로 매핑한다', () => {
    expect(mapErrorMessage('Gemini API error: RESOURCE_EXHAUSTED').status).toBe(429);
  });
});
