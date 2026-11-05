// provider 에러 메시지를 사용자 안내와 HTTP 상태로 매핑하는 순수 함수.
// openAnthropicStream / openGoogleModelStream 과 stream.ts 의 *TextDeltas 가 던지는
// `<이름> API error: <status|종류>` 포맷에 의존한다.
// 이 포맷을 바꾸면 503/429 안내가 조용히 사라진다 (AGENTS.md Double Defense).

export function mapErrorMessage(message: string): { status: number; error: string } {
  // Anthropic 스트림 도중 에러 이벤트는 HTTP 상태 대신 에러 종류 문자열로 온다.
  // Gemini 스트림 도중 에러는 숫자 코드 대신 status 문자열만 올 수 있다.
  if (message.includes('503') || message.includes('overloaded_error') || message.includes('UNAVAILABLE')) {
    return {
      status: 503,
      error: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
    };
  }

  if (message.includes('429') || message.includes('rate_limit_error') || message.includes('RESOURCE_EXHAUSTED')) {
    return { status: 429, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' };
  }

  return { status: 500, error: message };
}
