import { describe, expect, it, vi } from 'vitest'
import { guardCommit, type RunTests } from './commit-guard'

const bashInput = (command: string, cwd = '/work/repo') =>
  JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', cwd, tool_input: { command } })

describe('guardCommit', () => {
  it('git commit 이 아닌 명령은 테스트를 돌리지 않고 통과시킨다', () => {
    const runTests = vi.fn<RunTests>()

    const result = guardCommit(bashInput('git status'), runTests)

    expect(result).toEqual({ block: false })
    expect(runTests).not.toHaveBeenCalled()
  })

  it('git commit 이면 입력의 cwd 에서 테스트를 돌리고 실패하면 실패 출력과 함께 차단한다', () => {
    const runTests = vi.fn<RunTests>(() => ({ ok: false, output: 'FAIL src/a.test.ts > 합계를 계산한다' }))

    const result = guardCommit(bashInput('git commit -m "x"', '/work/repo'), runTests)

    expect(runTests).toHaveBeenCalledWith('/work/repo')
    expect(result.block).toBe(true)
    if (result.block) expect(result.message).toContain('FAIL src/a.test.ts > 합계를 계산한다')
  })

  it('git commit 이고 테스트가 모두 통과하면 통과시킨다', () => {
    const runTests = vi.fn<RunTests>(() => ({ ok: true, output: 'all green' }))

    expect(guardCommit(bashInput('git commit -m "x"'), runTests)).toEqual({ block: false })
  })

  it('차단 메시지에 커밋이 막힌 이유와 해야 할 일을 담는다', () => {
    const runTests: RunTests = () => ({ ok: false, output: 'FAIL x' })

    const result = guardCommit(bashInput('git commit -m "x"'), runTests)

    expect(result.block && result.message).toContain('테스트가 실패해 커밋을 차단했습니다')
    expect(result.block && result.message).toContain('통과시킨 뒤 다시 커밋')
  })

  it('테스트 출력이 길면 마지막 60줄만 메시지에 담는다', () => {
    const output = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n')
    const runTests: RunTests = () => ({ ok: false, output })

    const result = guardCommit(bashInput('git commit -m "x"'), runTests)

    expect(result.block && result.message).toContain('line 100')
    expect(result.block && result.message).toContain('line 41')
    expect(result.block && result.message).not.toContain('line 40\n')
  })

  it('입력을 해석할 수 없으면 통과시키지 않고 차단한다', () => {
    const runTests = vi.fn<RunTests>()

    const result = guardCommit('not json', runTests)

    expect(result.block).toBe(true)
    expect(runTests).not.toHaveBeenCalled()
  })

  it('테스트 실행 자체가 예외를 던지면 통과시키지 않고 차단한다', () => {
    const runTests = vi.fn<RunTests>(() => {
      throw new Error('spawn bun ENOENT')
    })

    const result = guardCommit(bashInput('git commit -m "x"'), runTests)

    expect(result.block).toBe(true)
    if (result.block) expect(result.message).toContain('spawn bun ENOENT')
  })
})
