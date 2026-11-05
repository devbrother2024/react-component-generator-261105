# src/AGENTS.md

## Module Context

Vite 가 번들하는 브라우저 SPA. `/api/generate`, `/api/config` 로만 서버와 통신하고, AI provider 를 직접 호출하지 않는다.

## Tech Stack & Constraints

- React 19 함수형 컴포넌트 + hooks. 상태 라이브러리 없이 `useState` 만 사용 (`src/App.tsx`, `src/hooks/useComponentGenerator.ts`).
- 서버 호출은 상대경로 `/api/...` 만 사용한다 (`src/hooks/useComponentGenerator.ts:23`, `src/App.tsx:29`). 절대 URL 이나 provider 엔드포인트를 클라이언트에 넣지 마라 (Vite proxy 가 3002 로 전달).
- 스타일은 전역 CSS (`src/App.css`, `src/index.css`) 와 className 방식. 새 스타일 라이브러리 추가 금지.
- `src/` 는 `tsc -b` 로 타입 검사된다 (`tsconfig.app.json:27`). 타입 import 는 `import type`.

## Implementation Patterns

- 컴포넌트는 `src/components/<PascalCase>.tsx` 에 named export (`export function X`). `App` 만 default export.
- 공용 타입은 `src/types/index.ts` 에 둔다 (`Provider`, `GeneratedComponent`). 서버의 `Provider` 타입과 동일 값이어야 한다 (`server/index.ts:57`).
- 생성 코드 미리보기는 `LivePreview` 가 `react-live` 의 `noInline` 으로 렌더한다 (`src/components/LivePreview.tsx:10`). 렌더 오류는 `LiveError` 가 표시하므로 별도 try/catch 를 두지 마라.
- 생성 결과 목록은 최신순으로 앞에 붙인다 (`src/hooks/useComponentGenerator.ts:42`).

## Testing Strategy

- 실행: `bun run test -- src`. 환경은 jsdom, 셋업은 `src/test/setup.ts` (각 테스트 후 `cleanup()` 자동 호출).
- 테스트는 대상 컴포넌트 옆에 `<Name>.test.tsx` 로 두고, `userEvent` 와 접근성 role/name 쿼리 (`getByRole('button', { name })`) 를 사용한다 (`PromptInput.test.tsx`).
- 현재 테스트가 있는 프론트 파일은 `PromptInput.tsx` 뿐이다. 훅 (`useComponentGenerator`) 과 `App` 의 키 검증 흐름은 미검증 영역이므로 수정 시 테스트 추가를 우선 고려한다.

## Local Golden Rules

- API 키를 `localStorage` / `sessionStorage` / 쿠키 / URL 에 저장하지 마라. 현재는 `useState` 에만 존재한다 (`src/App.tsx:16`).
- `handleProviderChange` 의 `setApiKey('')` (`src/App.tsx:51`) 를 지우지 마라. 한 provider 의 키가 다른 provider 요청에 실리는 것을 막는다.
- 생성 요청 전 키 검증은 `apiKey` 입력 또는 서버 `.env` 키 (`envKeys[provider]`) 둘 중 하나가 있어야 통과한다 (`src/App.tsx:38`). `envKeys` 는 `/api/config` 실패 시 모두 false 로 남는다 (`src/App.tsx:32`) — 이 경우 사용자가 직접 입력해야 하는 것이 정상 동작이다.
- 요청 body 에서 `apiKey` 는 값이 있을 때만 포함한다 (`src/hooks/useComponentGenerator.ts:26`). 빈 문자열을 보내면 서버의 `.env` 키 사용 경로가 막히지 않더라도 의도가 흐려지므로 이 조건부 spread 를 유지한다.
- `eslint-plugin-react-refresh` (`eslint.config.js:15`) 규칙 때문에 컴포넌트 파일에서 컴포넌트가 아닌 값을 export 하지 마라. 상수·헬퍼는 별도 모듈로 분리한다.
