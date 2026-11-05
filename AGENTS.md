# AGENTS.md

## Operational Commands

패키지 매니저와 런타임은 bun 고정. npm / yarn / pnpm 사용 금지 (`bun.lock` 사용 중).

- `bun install` — 의존성 설치
- `bun run dev` — API 서버(3002) + Vite(5173) 동시 실행
- `bun run server` — API 서버만 실행 (`bun --watch`)
- `bun run test` — vitest 1회 실행 (`src/**` 와 `server/**` 테스트 모두 포함, `vite.config.ts:20`)
- `bun run lint` — eslint
- `bun run build` — `tsc -b && vite build`

변경 후 검증 순서: `bun run lint` -> `bun run test` -> `bun run build`.

## Golden Rules

### Immutable

- API 키 값을 클라이언트 응답으로 내보내지 마라. `/api/config` 는 provider별 boolean 만 반환한다 (`server/index.ts:150-153`). `ENV_KEYS` 의 값 자체를 응답·로그에 넣지 마라.
- Google API 키는 URL 쿼리스트링에 실린다 (`server/index.ts:99`). 이 URL 이나 `fetch` 에러 객체를 통째로 로깅·응답에 넣지 마라.
- 사용자가 입력한 키는 React state 에만 둔다 (`src/App.tsx:16`). provider 를 바꾸면 키를 비운다 (`src/App.tsx:49-53`) — 다른 provider 로 키가 전송되는 것을 막는 경계이므로 제거 금지.
- `.env` 는 커밋 금지 (`.gitignore`). 새 환경변수를 추가하면 `server/index.ts` 의 `ENV_KEYS` 와 `/api/config` 응답에 함께 반영한다.

### Hard Constraints

- 생성 코드는 react-live `noInline` 모드로 실행된다 (`src/components/LivePreview.tsx:10`). 따라서 `import` 불가, 컴포넌트 정의 후 마지막에 `render(<X />)` 호출이 필수다. 이 계약은 `SYSTEM_PROMPT` (`server/index.ts:7-49`) 와 `ensureRenderCall` (`server/generator.ts:16`) 양쪽이 지킨다.
- 생성 코드는 TypeScript 문법 금지 (`server/index.ts:20`). react-live 는 JS 로만 변환한다.
- 서버 포트 3002 는 `server/index.ts:139` 와 `vite.config.ts:11` (proxy target) 두 곳에 하드코딩되어 있다. 하나만 바꾸면 프론트가 API 에 닿지 않는다. 같이 수정하라.

### Double Defense (한쪽만 제거하지 마라)

- 코드펜스: 프롬프트가 "펜스 없이 응답" 을 요구하고 (`server/index.ts:16`), 서버가 `stripCodeFences` 로 한 번 더 제거한다 (`server/generator.ts:5`).
- render 호출: 프롬프트가 요구하고 (`server/index.ts:12`), `ensureRenderCall` 이 누락 시 주입한다.
- 에러 분류: `callAnthropic` / `callGoogleModel` 이 `Claude API error: <status>` / `Gemini API error: <status>` 문자열을 던지고 (`server/index.ts:85,112`), 핸들러가 `message.includes('503' | '429')` 로 상태코드를 복원한다 (`server/index.ts:194,201`). 에러 메시지 포맷을 바꾸면 503/429 사용자 안내가 조용히 사라진다.

### Test Boundary

- 테스트가 있는 곳: `server/generator.ts`, `server/fallback.ts`, `src/components/PromptInput.tsx`.
- 테스트가 없는 곳: `server/index.ts` (import 시 `Bun.serve` 가 실행되는 부수효과 파일), `src/hooks/useComponentGenerator.ts`, `src/App.tsx`.
- 새 로직은 테스트 가능하도록 부수효과 없는 모듈로 분리하고 (`server/generator.ts:1-2` 주석 참고) `*.test.ts(x)` 를 옆에 둔다.

### Asymmetry

- 모델 폴백은 Google 에만 있다 (`GOOGLE_MODELS`, `server/index.ts:5,135`). Anthropic 은 단일 모델 고정 (`server/index.ts:77`). Anthropic 에도 폴백이 필요한지는 임의로 맞추지 말고 사용자에게 확인한다.
- `MAX_TOKENS` 절단 검사는 Google 경로에만 있다 (`server/index.ts:123`). Anthropic 응답의 `stop_reason` 은 확인하지 않는다.

### 타입 검사 범위

- `tsc -b` 는 `src/` (`tsconfig.app.json:27`) 와 `vite.config.ts` (`tsconfig.node.json:25`) 만 검사한다. `server/` 는 어느 tsconfig 에도 포함되지 않아 `bun run build` 로 타입 오류가 잡히지 않는다. server 변경 시 타입 정확성은 직접 점검한다.

## Project Context

프롬프트로 React 컴포넌트를 생성하고 react-live 로 즉시 미리보기하는 도구.

Tech Stack: React 19, TypeScript 5.9, Vite 8, Bun (API 서버), react-live, vitest + Testing Library, eslint 9.

## Standards & References

- 커밋: 한국어 컨벤션 `<type>: <요약>` (type: feat, fix, refactor, chore). 요약은 마침표 없이 50자 내외. `/commit` 스킬 사용 가능.
- `tsconfig` 는 `erasableSyntaxOnly`, `verbatimModuleSyntax` 를 켰다. `enum`, `namespace`, 파라미터 프로퍼티 금지, 타입 import 는 `import type` 사용.
- `README.md` 가 `cp .env.example .env` 를 안내하지만 `.env.example` 은 존재하지 않는다. 환경변수 이름은 `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`.

## Context Map

- **[API 서버 수정 (Bun)](./server/AGENTS.md)** — provider 호출, 폴백, 응답 정규화, 에러 매핑을 건드릴 때.
- **[프론트엔드 수정 (React/Vite)](./src/AGENTS.md)** — UI, 생성 훅, 미리보기, 컴포넌트 테스트를 건드릴 때.

## Maintenance Policy

이 문서의 규칙과 실제 코드가 어긋난 것을 발견하면 작업을 멈추지 말고 끝에 AGENTS.md 업데이트를 제안한다. 인용한 라인 번호가 밀렸으면 함께 갱신한다.
