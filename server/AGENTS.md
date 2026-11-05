# server/AGENTS.md

## Module Context

Bun 런타임에서 도는 AI provider 프록시 서버. 브라우저 번들(Vite)에 포함되지 않으며 `/api/*` 요청을 Vite proxy 로 받는다.

## Tech Stack & Constraints

- 런타임은 `Bun.serve` + 전역 `fetch`. axios, express 등 HTTP 라이브러리 추가 금지.
- provider SDK 없이 REST 를 직접 호출한다 (`server/index.ts:78,111`). 동일 방식 유지. 응답은 SSE 로 받아 `stream.ts` 가 파싱한다 (Anthropic `stream: true`, Google `:streamGenerateContent?alt=sse`).
- 환경변수는 `process.env` 로 모듈 로드 시점에 한 번 읽는다 (`server/index.ts:60-63`). `.env` 변경은 서버 재시작 후 반영된다 (`bun --watch` 는 `.env` 변화를 감지하지 못할 수 있으니 수동 재시작).

## Implementation Patterns

- 부수효과 없는 로직은 별도 파일로 분리하고 옆에 `*.test.ts` 를 둔다: `generator.ts` (응답 정규화), `fallback.ts` (모델 폴백), `stream.ts` (SSE 파싱·provider 청크 해석·NDJSON 이벤트 스트림), `errors.ts` (에러 메시지 → 상태코드/안내 매핑).
- `/api/generate` 는 NDJSON 스트림을 돌려준다 (루트 AGENTS.md "Streaming" 참고). 새 provider 는 `*TextDeltas` (텍스트 델타 + 도중 에러 + 비정상 종료 검출) 를 `stream.ts` 에 테스트와 함께 추가하고, `index.ts` 에는 연결 열기만 둔다.
- 새 provider 추가 시 동시에 수정할 곳: `Provider` 타입 (`server/index.ts:58`), `ENV_KEYS`, `/api/config` 응답, `/api/generate` 분기, 프론트 `src/types/index.ts` 와 `src/App.tsx` 의 `PROVIDER_CONFIG`.
- 모든 응답은 `CORS_HEADERS` 를 붙인다 (`server/index.ts:52`). 스트림 응답도 포함이다. 새 응답 경로를 추가할 때 `{ headers: CORS_HEADERS }` 누락 주의.
- 사용자 대상 에러 문구는 한국어, 서버 내부 에러 문구는 기존처럼 영어(`Prompt is required` 등)와 섞여 있다. 기존 문구 톤을 따른다.

## Testing Strategy

- `bun run test -- server` 로 서버 테스트만 실행.
- `index.ts` 는 import 하는 순간 포트 3002 를 점유하므로 테스트에서 import 하지 마라 (`generator.test.ts`, `fallback.test.ts`, `stream.test.ts`, `errors.test.ts` 는 순수 모듈만 import). 스트림 테스트는 `new ReadableStream` 으로 청크를 직접 흘려 보낸다 (`stream.test.ts` 의 `streamOf`).
- 새 순수 함수에는 정상/경계/실패 케이스를 `describe` 단위로 한국어 `it` 설명과 함께 작성한다 (기존 테스트 스타일).

## Local Golden Rules

- 에러 메시지에 `503` / `429` 같은 숫자 문자열을 의도 없이 넣지 마라. `mapErrorMessage` (`server/errors.ts`) 가 `message.includes()` 로 상태를 판별한다. 반대로 provider 에러는 `<이름> API error: <status|종류|코드>` 포맷을 유지하라 (`overloaded_error` / `rate_limit_error` 도 같은 매핑을 탄다).
- `withModelFallback` 은 모든 예외를 삼키고 다음 모델로 넘어간다 (`server/fallback.ts:13-17`). 이제 `attempt` 는 연결 열기(응답 코드 확인)까지만 감싼다 (`openGoogleStream`, `server/index.ts:131-141`). 스트림 도중의 `MAX_TOKENS` 절단·에러는 폴백을 유발하지 않고 `error` 이벤트가 된다. 연결 단계 밖의 실패를 `attempt` 안으로 넣으면 이미 전송한 델타 뒤에 다른 모델 응답이 이어 붙으므로 넣지 마라.
- 스트림이 정상 종료 표지(Google `finishReason`, Anthropic `message_stop`) 없이 끝나면 에러다. 잘린 코드가 `done` 으로 나가 클라이언트 저장소에 들어가는 것을 막는 장치이므로 지우지 마라 (`stream.test.ts` 가 고정한다). 한계: 표지가 있는 비정상 종료(Google `SAFETY` / `RECITATION`, Anthropic `max_tokens`)는 아직 성공으로 처리된다.
- `SYSTEM_PROMPT` 를 수정할 때 "import 금지 / render() 호출 / 펜스 금지 / TS 문법 금지" 4개 규칙은 유지한다. 클라이언트 미리보기가 이에 의존한다.
- 모델 ID (`claude-haiku-4-5-20251001`, `gemini-*`) 변경은 사용자 요청이 있을 때만 한다.
- `openGoogleModelStream` 의 `url` (키 포함, `server/index.ts:109`) 을 로그/에러에 넣지 마라.
