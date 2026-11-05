import { describe, expect, it } from 'vitest'
import { tddReminder } from './tdd-reminder'

const CWD = '/work/repo'

const toolInput = (tool: string, filePath: string, cwd = CWD) =>
  JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: tool, cwd, tool_input: { file_path: filePath } })

describe('tddReminder', () => {
  it('프로덕션 코드를 수정하면 실패하는 테스트를 먼저 쓰라고 상기시킨다', () => {
    const reminder = tddReminder(toolInput('Edit', `${CWD}/src/utils/sum.ts`))

    expect(reminder).toContain('src/utils/sum.ts')
    expect(reminder).toContain('실패하는 테스트를 먼저')
    expect(reminder).toContain('.claude/rules/tdd.md')
  })

  it('프로덕션 코드 알림에 사이클의 핵심 규칙을 모두 담는다', () => {
    const reminder = tddReminder(toolInput('Write', `${CWD}/server/fallback.ts`)) ?? ''

    expect(reminder).toContain('애매하면') // TDD 필요 여부 판단
    expect(reminder).toContain('버그 수정') // 재현하는 실패 테스트 먼저
    expect(reminder).toContain('삭제') // 테스트보다 먼저 쓴 프로덕션 코드
    expect(reminder).toContain('최소한의 코드') // GREEN
    expect(reminder).toContain('새 동작') // REFACTOR 에서 금지
  })

  it('테스트 파일을 수정하면 RED 작성 규칙을 상기시킨다', () => {
    const reminder = tddReminder(toolInput('Write', `${CWD}/src/utils/sum.test.ts`))

    expect(reminder).toContain('src/utils/sum.test.ts')
    expect(reminder).toContain('하나의 동작 = 하나의 테스트')
    expect(reminder).toContain('기능 미구현')
    expect(reminder).not.toContain('실패하는 테스트를 먼저')
  })

  it.each([
    `${CWD}/AGENTS.md`,
    `${CWD}/package.json`,
    `${CWD}/vite.config.ts`,
    `${CWD}/.claude/settings.json`,
    `${CWD}/.claude/skills/commit/SKILL.md`,
    `${CWD}/src/App.css`,
    `${CWD}/src/types/index.ts`,
    `${CWD}/src/vite-env.d.ts`,
    `${CWD}/src/test/setup.ts`,
    '/private/tmp/scratch/gen.ts',
  ])('TDD 대상이 아닌 파일은 알리지 않는다: %s', (filePath) => {
    expect(tddReminder(toolInput('Edit', filePath))).toBeNull()
  })

  it('입력을 해석할 수 없으면 예외 없이 알리지 않는다', () => {
    expect(tddReminder('not json')).toBeNull()
  })

  it('file_path 가 없는 도구 입력은 알리지 않는다', () => {
    const input = JSON.stringify({ tool_name: 'Bash', cwd: CWD, tool_input: { command: 'ls' } })

    expect(tddReminder(input)).toBeNull()
  })
})
