# server/AGENTS.md

## Module Context

Bun 런타임에서 도는 AI provider 프록시 서버. 브라우저 번들(Vite)에 포함되지 않으며 `/api/*` 요청을 Vite proxy 로 받는다.

## Tech Stack & Constraints

- 런타임은 `Bun.serve` + 전역 `fetch`. axios, express 등 HTTP 라이브러리 추가 금지.
- provider SDK 없이 REST 를 직접 호출한다 (`server/index.ts:69,99`). 동일 방식 유지.
- 환경변수는 `process.env` 로 모듈 로드 시점에 한 번 읽는다 (`server/index.ts:59-62`). `.env` 변경은 서버 재시작 후 반영된다 (`bun --watch` 는 `.env` 변화를 감지하지 못할 수 있으니 수동 재시작).

## Implementation Patterns

- 부수효과 없는 로직은 별도 파일로 분리하고 옆에 `*.test.ts` 를 둔다: `generator.ts` (응답 정규화), `fallback.ts` (모델 폴백).
- 새 provider 추가 시 동시에 수정할 곳: `Provider` 타입 (`server/index.ts:57`), `ENV_KEYS`, `/api/config` 응답, `/api/generate` 분기, 프론트 `src/types/index.ts` 와 `src/App.tsx` 의 `PROVIDER_CONFIG`.
- 모든 응답은 `CORS_HEADERS` 를 붙인다 (`server/index.ts:51`). 새 응답 경로를 추가할 때 `{ headers: CORS_HEADERS }` 누락 주의.
- 사용자 대상 에러 문구는 한국어, 서버 내부 에러 문구는 기존처럼 영어(`Prompt is required` 등)와 섞여 있다. 기존 문구 톤을 따른다.

## Testing Strategy

- `bun run test -- server` 로 서버 테스트만 실행.
- `index.ts` 는 import 하는 순간 포트 3002 를 점유하므로 테스트에서 import 하지 마라 (`generator.test.ts`, `fallback.test.ts` 는 순수 모듈만 import).
- 새 순수 함수에는 정상/경계/실패 케이스를 `describe` 단위로 한국어 `it` 설명과 함께 작성한다 (기존 테스트 스타일).

## Local Golden Rules

- 에러 메시지에 `503` / `429` 같은 숫자 문자열을 의도 없이 넣지 마라. 핸들러가 `message.includes()` 로 상태를 판별한다 (`server/index.ts:194,201`). 반대로 provider 에러는 `<이름> API error: <status>` 포맷을 유지하라.
- `withModelFallback` 은 모든 예외를 삼키고 다음 모델로 넘어간다 (`server/fallback.ts:13-17`). 따라서 `MAX_TOKENS` 절단 에러 (`server/index.ts:124`) 도 폴백을 유발한다. 폴백이 부적절한 에러가 생기면 `attempt` 안에서 구분하는 로직을 추가하고 테스트로 고정하라.
- `SYSTEM_PROMPT` 를 수정할 때 "import 금지 / render() 호출 / 펜스 금지 / TS 문법 금지" 4개 규칙은 유지한다. 클라이언트 미리보기가 이에 의존한다.
- 모델 ID (`claude-haiku-4-5-20251001`, `gemini-*`) 변경은 사용자 요청이 있을 때만 한다.
- `callGoogleModel` 의 `url` (키 포함) 을 로그/에러에 넣지 마라.
