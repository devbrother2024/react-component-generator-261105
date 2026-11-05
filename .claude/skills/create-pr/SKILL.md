---
name: create-pr
description: |
  현재 브랜치의 커밋을 분석해 템플릿(한국어/영어)에 맞춘 Pull Request 를 서브 에이전트가 대신 생성한다.
  "PR 만들어줘", "PR 생성해줘", "풀리퀘스트 올려줘", "PR 올려줘", "create a PR", "open a pull request", "/create-pr" 같은 요청에 활성화한다.
  언어는 프로젝트로 정한다: react-component-generator 프로젝트에서는 한국어, 그 외 모든 프로젝트에서는 영어로 작성한다.
  `--lang ko|en` 으로 덮어쓸 수 있다. 푸시 후 PR URL 을 반환한다.
context: fork
argument-hint: "[--lang ko|en] [--base <branch>] [--draft]"
allowed-tools: Bash(git:*), Bash(gh:*), Read
---

# create-pr: 브랜치 분석 → 템플릿 채우기 → PR 생성

이 스킬은 `context: fork` 로 **격리된 서브 에이전트**에서 실행된다. 서브 에이전트는 메인 대화의 맥락을 보지 못하므로, 필요한 정보는 전부 `git` / `gh` 로 직접 수집한다. 사용자에게 되묻는 것도 어렵기 때문에, 판단이 필요한 상황에서는 임의로 진행하지 말고 **중단 사유를 보고서에 적어 반환**한다. 메인 에이전트가 그 보고를 받아 사용자와 이어서 처리한다.

## 인자

| 인자 | 기본값 | 의미 |
|------|--------|------|
| `--lang ko\|en` | 프로젝트별 자동 결정 (아래 "언어 규칙") | PR 템플릿 언어. "한국어로", "영어로", "in English" 같은 표현도 동일하게 처리 |
| `--base <branch>` | 저장소 기본 브랜치 | PR 이 병합될 대상 브랜치 |
| `--draft` | 꺼짐 | Draft PR 로 생성. "초안", "draft" 표현도 동일 |

## 언어 규칙

**현재 프로젝트(`react-component-generator`)는 한국어, 그 외 모든 프로젝트는 영어**로 PR 을 쓴다. 제목·본문·보고서의 PR 관련 문구 전부 같은 언어를 쓴다.

결정 순서 (위가 우선):

1. 사용자가 `--lang` 이나 "영어로" / "한국어로" 처럼 명시했으면 그대로 따른다.
2. 아래 중 하나라도 맞으면 프로젝트가 `react-component-generator` 이므로 **한국어(`ko`)**.
   - 저장소 루트 `package.json` 의 `name` 이 `react-component-generator`
   - `git remote get-url origin` 결과에 `react-component-generator` 가 포함됨
3. 그 외(다른 프로젝트, 판별 불가 포함)는 **영어(`en`)**. 판별이 애매할 때 영어를 기본으로 두는 이유는, 영어 PR 은 어느 팀이 읽어도 큰 문제가 없지만 한국어 PR 은 읽을 수 없는 리뷰어를 막기 때문이다.

판별은 Step 1 사전 점검에서 함께 수행한다 (`git remote get-url origin`, `package.json` 읽기).

## 템플릿

| 언어 | 파일 |
|------|------|
| 한국어 | `references/pr-template.ko.md` |
| English | `references/pr-template.en.md` |

위 언어 규칙으로 정한 언어의 파일 **하나만** Read 한다. 두 템플릿은 섹션 구조가 같고 언어만 다르다. 템플릿을 고치려면 스킬 본문이 아니라 이 파일들을 수정한다.

## 워크플로우

### Step 1: 사전 점검

아래를 **병렬로** 실행한다.

```bash
git branch --show-current
git status --short
gh repo view --json defaultBranchRef --jq .defaultBranchRef.name   # --base 가 없을 때 base 결정
gh auth status
git remote get-url origin        # 언어 규칙 판별용
```

`package.json` 의 `name` 도 Read 로 확인해 "언어 규칙"에 따라 PR 언어를 확정한다.

다음 경우에는 PR 을 만들지 않고 **중단 후 사유를 보고**한다. 되돌리기 어려운 외부 행위(푸시, PR 게시)이므로 애매한 상태에서 밀어붙이지 않는다.

- 현재 브랜치가 base 브랜치와 같다 (main 에서 직접 PR 은 불가). → 브랜치를 새로 만들고 다시 호출하라고 안내
- `gh` 인증이 안 되어 있다
- base 대비 커밋이 0개다 (Step 2 에서 확인)
- 이미 같은 브랜치의 열린 PR 이 있다 → `gh pr list --head <branch> --state open --json url` 로 확인하고, 있으면 새로 만들지 말고 그 URL 을 보고

작업 트리에 커밋되지 않은 변경이 있으면 PR 에는 **포함되지 않는다**. 임의로 커밋하지 말고 보고서에 "커밋되지 않은 변경 N개 제외됨" 이라고 적는다 (커밋은 `/commit` 스킬의 몫이다).

### Step 2: 변경 분석

```bash
git fetch origin <base>
git log origin/<base>..HEAD --format='%h %s%n%b---'
git diff origin/<base>...HEAD --stat
git diff origin/<base>...HEAD
```

- 커밋 메시지만으로 의도가 불분명하면 diff 와 변경 파일을 Read 로 확인한다.
- diff 가 매우 크면 `--stat` 과 핵심 파일 위주로 요약한다. 모든 줄을 읽으려 하지 않는다.
- 변경 목록에 `.env`, 키·토큰·자격증명으로 보이는 파일이나 값이 있으면 **푸시하지 말고 중단 후 보고**한다. 한 번 올라간 비밀값은 이력에서 지워도 이미 노출된 것으로 봐야 한다.

### Step 3: 제목과 본문 작성

**제목**

- 형식: `<type>: <요약>` (type: `feat`, `fix`, `refactor`, `chore`). 이 저장소의 커밋 컨벤션과 같다.
- 한국어는 50자 내외, 마침표 없음. 영어는 명령형 현재 시제(`feat: add prompt validation`), 72자 이내, 마침표 없음.
- 커밋 메시지의 언어와 PR 언어가 달라도 PR 은 언어 규칙을 따른다. 영어 PR 이면 한국어 커밋 내용을 번역해서 쓴다.
- 커밋이 여러 개면 가장 큰 목적을 type 으로 삼는다. 커밋이 1개면 그 커밋 제목을 그대로 써도 된다.

**본문**

- 선택한 템플릿의 섹션 구조를 **그대로 유지**하며 채운다. 섹션을 삭제하거나 순서를 바꾸지 않는다. 리뷰어가 매번 같은 위치에서 같은 정보를 찾을 수 있어야 하기 때문이다.
- 해당 사항이 없는 섹션은 지우지 말고 `해당 없음` / `N/A` 로 둔다.
- "무엇을 바꿨나"는 파일 나열이 아니라 **동작 변화** 중심으로 쓴다. diff 를 읽으면 알 수 있는 것은 반복하지 않는다.
- 테스트 체크리스트는 **실제로 실행해 본 것만** 체크한다. 이 서브 에이전트가 직접 실행하지 않았다면 체크하지 말고 비워 둔다. 검증하지 않은 항목에 체크하면 리뷰어를 오도한다.
- 연결된 이슈 번호가 커밋 메시지나 브랜치명에 보이면 `Closes #N` 으로 적는다. 추측으로 만들지 않는다.
- 시스템 컨텍스트에 PR 설명 attribution 지침이 있으면 본문 맨 끝에 그대로 덧붙인다.

본문은 임시 파일이 아니라 HEREDOC 으로 전달한다 (아래 Step 5).

### Step 4: 푸시

```bash
git push -u origin HEAD
```

- 이미 upstream 이 있으면 `git push` 만 한다.
- push 가 거부(non-fast-forward 등)되면 **`--force` 를 쓰지 않고** 중단 후 보고한다. 원격 이력을 덮어쓰는 결정은 사용자의 몫이다.

### Step 5: PR 생성

```bash
gh pr create --base <base> --title "<제목>" --body "$(cat <<'EOF'
<채운 본문>
EOF
)"
```

- `--draft` 가 지정됐으면 `--draft` 를 추가한다.
- 본문에 백틱·`$` 가 많으므로 HEREDOC 의 `'EOF'` 따옴표를 유지한다 (셸 치환 방지).
- 라벨·리뷰어·담당자는 지정되지 않았으면 붙이지 않는다.

### Step 6: 결과 보고

메인 에이전트에 아래 형식으로 반환한다. 사용자에게는 이 요약이 전달된다.

```
PR 생성 완료
- URL: https://github.com/<owner>/<repo>/pull/N
- 제목: <제목>
- base ← head: <base> ← <branch>
- 언어/모드: ko / ready (또는 en, draft) — 언어를 정한 근거(프로젝트 판별 또는 명시 지정)도 한 줄로
- 포함된 커밋: N개
- 참고: <제외된 미커밋 변경, 체크하지 않은 테스트 항목 등. 없으면 생략>
```

중단한 경우에는 `PR 미생성` 으로 시작하고 **중단 사유**와 **사용자가 다음에 할 일**을 적는다.

## 금지 사항

- `git push --force` / `--force-with-lease`, `git reset --hard`, `git config` 변경 금지
- 커밋되지 않은 변경을 대신 커밋하거나 stash 하지 않는다
- 이미 열린 PR 을 닫거나 덮어쓰지 않는다
- `.env`·키·토큰이 포함된 상태로 푸시하지 않는다
- 실행하지 않은 검증을 완료로 표기하지 않는다
- 템플릿에 없는 섹션을 임의로 추가하지 않는다
