# AGENTS.md

## Operational Commands

패키지 매니저와 런타임은 bun 고정. npm / yarn / pnpm 사용 금지 (`bun.lock` 사용 중).

- `bun install` — 의존성 설치
- `bun run dev` — API 서버(3002) + Vite(5173) 동시 실행
- `bun run server` — API 서버만 실행 (`bun --watch`)
- `bun run test` — vitest 1회 실행 (`src/**`, `server/**`, `.claude/**` 테스트 모두 포함, `vite.config.ts:20`)
- `bun run lint` — eslint
- `bun run build` — `tsc -b && vite build`

변경 후 검증 순서: `bun run lint` -> `bun run test` -> `bun run build` -> (코드를 바꿨다면) `evaluator` 서브 에이전트 평가 ([Evaluator](#evaluator-코드-생성-후-적대적-평가) 참고).

## Golden Rules

### Immutable

- API 키 값을 클라이언트 응답으로 내보내지 마라. `/api/config` 는 provider별 boolean 만 반환한다 (`server/index.ts:150-153`). `ENV_KEYS` 의 값 자체를 응답·로그에 넣지 마라.
- Google API 키는 URL 쿼리스트링에 실린다 (`server/index.ts:99`). 이 URL 이나 `fetch` 에러 객체를 통째로 로깅·응답에 넣지 마라.
- 사용자가 입력한 키는 React state 에만 둔다 (`src/App.tsx:21`). provider 를 바꾸면 키를 비운다 (`src/App.tsx:64-68`) — 다른 provider 로 키가 전송되는 것을 막는 경계이므로 제거 금지.
- `.env` 는 커밋 금지 (`.gitignore`). 새 환경변수를 추가하면 `server/index.ts` 의 `ENV_KEYS` 와 `/api/config` 응답에 함께 반영한다.

### Sensitive Files (읽기·수정 차단)

민감 파일은 `.claude/settings.json` 의 `permissions.deny` (`Read(...)` / `Edit(...)` 쌍) 와 `sandbox` 가 차단한다. 에이전트는 아래 파일을 읽지도 수정하지도 않는다.

- 환경변수: `.env`, `.env.*` (예외: `.env.example` 은 읽기·수정 허용)
- 키·인증서: `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`, `*.keystore`, `id_rsa*` / `id_dsa*` / `id_ecdsa*` / `id_ed25519*`
- secret·credential 계열: `secret(s).*`, `*.secret(s)`, `secret(s)/`, `.secrets/`, `credentials`, `credentials.*`, `*.credentials`, `credentials/`, `service-account*.json`
- 인증 설정: `.npmrc`, `.netrc`, `.pgpass`, `.htpasswd`, `.aws/`, `.ssh/`, `.gnupg/`, `.kube/`
- 사용자 홈: `~/.ssh`, `~/.aws`, `~/.gnupg`, `~/.kube`, `~/.config/gcloud`, `~/.config/gh`, `~/.docker/config.json`, `~/.npmrc`, `~/.netrc`

규칙:

- 차단 오류를 우회하지 마라. `bun -e` / `node` / `python` 스크립트, `grep -r .`, 복사·이동·심볼릭 링크, `dangerouslyDisableSandbox` 로 내용을 읽거나 쓰는 시도 모두 금지다. permissions 만으로는 인터프리터 경로가 열려 있어 (`bun -e` 로 읽힘을 확인했다) `sandbox` 가 그 구멍을 막는 유일한 장치다. 둘 다 유지한다.
- 값이 필요하면 사용자에게 변수 **이름·형식**을 묻는다. 값 자체를 요구하거나 `.env` 를 열어보려 하지 마라.
- deny 규칙과 `sandbox.enabled` 를 완화·삭제하지 마라. `settings.local.json` 이나 CLI 플래그로 예외를 만드는 것도 같다. 완화는 사용자가 명시적으로 요청할 때만 한다.
- 새 종류의 비밀 파일이 생기면 `Read` 와 `Edit` 양쪽에 같은 패턴을 추가한다. `Read` deny 는 NotebookEdit 을 막지 못하므로 `Edit` 쌍이 필요하다. 프로젝트 루트 기준은 `/path`, 절대경로는 `//path` 다 (`/Users/...` 처럼 쓰면 절대경로가 아니다).
- `.env.example` 에는 변수 이름만 두고 실제 키를 넣지 마라. 읽기 예외라 deny 가 보호하지 않는다.
- 한계: sandbox 는 macOS / Linux / WSL2 만 지원한다. 네이티브 Windows 에서는 인터프리터 우회가 열려 있다. `autoAllowBashIfSandboxed: false` 는 기존 Bash 승인 프롬프트를 유지하려는 값이고, `network.allowLocalBinding` 은 dev 서버 포트 바인딩용이다.

### Commit Guard (커밋 전 테스트 강제)

`git commit` 은 PreToolUse(Bash) 훅 (`.claude/settings.json` 의 `hooks`) 이 먼저 가로채 `bun run test` 를 돌린다. 하나라도 실패하면 exit 2 로 Bash 호출 자체가 차단되고, 실패 출력 마지막 60줄이 에이전트에게 돌아온다.

- 구성: 감지 `.claude/hooks/is-git-commit.ts`, 판정 `.claude/hooks/commit-guard.ts` (둘 다 테스트 있음), I/O 진입점 `.claude/hooks/pre-commit-test.ts` (`server/index.ts` 처럼 부수효과 파일이라 테스트 없음).
- 훅은 명령을 **실행하기 전에** 검사한다. 테스트를 고치는 명령과 `git commit` 을 `&&` 로 한 줄에 묶으면 고치기 전 상태로 검사되어 차단된다. 수정과 커밋을 별도 Bash 호출로 나눠라.
- 우회하지 마라. 훅 제거·수정, 감지 정규식 약화, 테스트 삭제·skip 으로 통과시키는 것, 별칭(`git ci`)·스크립트·인터프리터로 커밋하는 것 모두 금지다. 차단되면 실패한 테스트를 고쳐라.
- fail closed 다. 입력을 해석하지 못하거나 테스트 실행이 예외를 던지면 통과가 아니라 차단이다. 설정의 `|| exit 2` 는 훅 프로세스가 죽거나 `bun` 이 없을 때도 차단하게 하는 장치이므로 지우지 마라.
- 감지는 일부러 넓게 잡는다 (`echo "git commit"` 같은 오탐은 테스트를 한 번 더 돌릴 뿐). 감지 규칙을 바꾸면 `is-git-commit.test.ts` 에 먼저 실패 케이스를 추가한다.
- 한계: 에이전트의 Bash 호출만 막는다. 사용자가 터미널에서 직접 하는 커밋, `git cherry-pick` / `merge` / `rebase` 가 만드는 커밋, 별칭, 셸 스크립트 안의 커밋은 감지하지 못한다. 테스트만 보며 lint·build 는 돌리지 않는다.

### TDD Reminder (편집 전 상기)

코드 파일을 `Edit` / `Write` 하면 PreToolUse 훅 (`.claude/settings.json` 의 `hooks`) 이 `.claude/rules/tdd.md` 요약을 `additionalContext` 로 주입한다. 차단하지 않는 알림이다.

- 구성: 판단 `.claude/hooks/tdd-reminder.ts` (테스트 있음), I/O 진입점 `.claude/hooks/remind-tdd.ts` (부수효과 파일이라 테스트 없음).
- 대상은 허용 목록이다: `src/`, `server/`, `.claude/hooks/` 의 `.ts` / `.tsx` / `.js` 등 코드 파일. 프로덕션 코드는 TDD 사이클 요약, `*.test.*` 는 RED 작성 규칙을 받는다. 문서·설정·스타일, `src/types/`, `src/test/`, `*.d.ts`, 프로젝트 밖 파일은 알리지 않는다.
- 알림은 편집이 실행된 직후 그 호출의 결과와 함께 보인다. 첫 편집 *전*이 아니라 다음 편집 전에 작용한다. 따라서 알림을 기다리지 말고 코드를 쓰기 전에 RED 부터 시작하라. 알림이 뜬 시점에 이미 테스트 없이 프로덕션 코드를 썼다면 `tdd.md` 의 삭제 강제 규칙을 적용한다.
- 알림 문구는 `tdd.md` 의 요약본이다. `tdd.md` 를 바꾸면 `tdd-reminder.ts` 문구와 `tdd-reminder.test.ts` 의 기대값도 함께 갱신한다. 새 코드 디렉터리가 생기면 `CODE_DIRS` 에 추가한다.
- fail open 이다. 입력이 이상하면 알림 없이 통과한다. 커밋 훅과 달리 `|| exit 2` 를 붙이지 마라.
- 한계: Bash 로 하는 파일 변경 (`sed -i`, 리다이렉션) 과 `NotebookEdit` 은 감지하지 못한다.

### Evaluator (코드 생성 후 적대적 평가)

`.claude/agents/evaluator.md` 는 메인 에이전트가 만든 코드를 **틀렸다고 가정하고** 평가하는 서브 에이전트다. Opus, 읽기 전용 (`Read` / `Grep` / `Glob` 만, `Write` / `Edit` / `NotebookEdit` / `Bash` / `Agent` 는 `disallowedTools` 로 명시 금지).

- 호출 시점: `src/`, `server/`, `.claude/hooks/` 의 코드를 생성·수정하는 작업을 마치고 lint / test / build 가 통과한 직후, **사용자에게 완료를 보고하기 전**. 문서·설정만 바꿨거나 오타·문구 수정처럼 동작이 없는 변경은 생략해도 된다.
- 호출 방법: `Agent` 도구의 `subagent_type: "evaluator"`. 서브 에이전트는 대화 기록을 못 보고 `git diff` 도 못 본다 (`Bash` 없음). 프롬프트에 반드시 넣는다: ① 요구사항 원문 ② 변경·생성한 파일 경로 전부 (테스트 포함) ③ 변경 의도 ④ 실행한 검증 명령과 결과 그대로 ⑤ 스스로 불확실한 부분. 평가자를 유도하려고 "문제없음" 같은 결론을 미리 적지 마라.
- 결과 처리: `차단` / `수정 필요` 판정의 지적은 조용히 무시하지 마라. 타당하면 TDD 로 고친다 (재현하는 실패 테스트 먼저). 틀렸다고 판단하면 해당 코드를 직접 확인하고, 반박 근거와 함께 사용자에게 보고한다. 수정한 뒤에는 다시 평가를 받는다.
- 평가자는 실행하지 못한다. 보고의 "직접 실행·확인해야 할 것" 은 메인 에이전트가 실행하고 결과를 확인한다.
- 불변식: 읽기 전용·Opus·적대적 전제는 `.claude/agents/evaluator.test.ts` 가 고정한다. 도구를 늘리거나 모델을 바꾸려면 테스트와 이 문서를 같이 고치고 사용자에게 먼저 확인한다.
- 한계: 호출은 `description` 의 "Use proactively" 와 이 규칙에 의존하는 *권고* 다. 훅처럼 강제되지 않는다. 서브 에이전트 정의는 세션 시작 시 로드되므로, 파일을 추가·수정한 뒤에는 `/agents` 로 다시 로드하거나 세션을 재시작한다.

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

- `tsc -b` 는 `src/` (`tsconfig.app.json:27`) 와 `vite.config.ts` (`tsconfig.node.json:25`) 만 검사한다. `server/` 는 어느 tsconfig 에도 포함되지 않아 `bun run build` 로 타입 오류가 잡히지 않는다. server 변경 시 타입 정확성은 직접 점검한다. `.claude/hooks/` 도 마찬가지로 어느 tsconfig 에도 없다 (lint 와 vitest 만 적용된다).

sandbox 안의 Bash 도구에서 `bun <파일>` / `bun -e` 가 출력 없이 exit 1 로 끝나는 것이 관찰됐다 (`bun run test|lint|build` 는 정상, 원인 미확인). 커밋 훅은 Bash 도구가 아니라 하네스가 실행하므로 영향이 없었다. 스크립트를 직접 실행해 검증할 때 이 증상이 나오면 코드 문제로 단정하지 마라.

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
