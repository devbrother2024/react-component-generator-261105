// TDD 리마인더가 다루는 디렉터리 (허용 목록). 그 밖의 파일은 알리지 않는다.
const CODE_DIRS = ['src/', 'server/', '.claude/hooks/']
// tdd.md 의 "TDD 불필요": 타입 정의, 테스트 인프라.
const EXEMPT_DIRS = ['src/types/', 'src/test/']
const CODE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/
const DECLARATION_FILE = /\.d\.ts$/
const TEST_FILE = /\.test\.[jt]sx?$/

export function tddReminder(rawInput: string): string | null {
  // 알림은 보조 장치다. 입력이 이상해도 편집을 막지 않도록 fail open.
  try {
    return buildReminder(rawInput)
  } catch {
    return null
  }
}

function buildReminder(rawInput: string): string | null {
  const input = JSON.parse(rawInput)
  const path: string = input.tool_input.file_path.replace(`${input.cwd}/`, '')

  if (!CODE_DIRS.some((dir) => path.startsWith(dir))) return null
  if (EXEMPT_DIRS.some((dir) => path.startsWith(dir))) return null
  if (!CODE_FILE.test(path) || DECLARATION_FILE.test(path)) return null

  if (TEST_FILE.test(path)) {
    return `[TDD 리마인더] 테스트 ${path} 을 수정하려 합니다. 하나의 동작 = 하나의 테스트입니다. 작성 뒤 반드시 실행해 실패 이유가 기능 미구현인지 확인하세요.`
  }

  return [
    `[TDD 리마인더] ${path} 을 수정하려 합니다. .claude/rules/tdd.md 는 Rigid 규칙입니다. 단계를 건너뛰거나 예외를 스스로 만들지 마세요.`,
    '- 이 변경이 TDD 필수(비즈니스 로직, API, 유틸, 제어 흐름)인지 먼저 판단하세요. 애매하면 TDD 를 적용합니다.',
    '- 버그 수정이면 버그를 재현하는 실패하는 테스트를 먼저 쓰세요.',
    '- 실패하는 테스트를 먼저 쓰고 실행해 RED(실패 이유 = 기능 미구현)를 확인하기 전에는 이 파일을 건드리지 마세요.',
    '- 테스트보다 먼저 쓴 프로덕션 코드가 있다면 참고용으로도 남기지 말고 삭제한 뒤 RED 부터 다시 시작하세요.',
    '- GREEN 은 테스트가 요구하는 최소한의 코드만 씁니다 (YAGNI). 테스트를 고쳐서 통과시키지 마세요.',
    '- REFACTOR 에서는 새 동작을 추가하지 말고, 매번 전체 테스트가 green 인지 확인하세요.',
  ].join('\n')
}
