import { isGitCommit } from './is-git-commit'

export type TestRun = { ok: boolean; output: string }
export type GuardResult = { block: false } | { block: true; message: string }
export type RunTests = (cwd: string) => TestRun

const TAIL_LINES = 60

function failureMessage(output: string): string {
  const tail = output.split('\n').slice(-TAIL_LINES).join('\n')
  return `테스트가 실패해 커밋을 차단했습니다. 실패한 테스트를 고쳐 모두 통과시킨 뒤 다시 커밋하세요.\n\n${tail}`
}

export function guardCommit(rawInput: string, runTests: RunTests): GuardResult {
  try {
    const input = JSON.parse(rawInput)
    if (!isGitCommit(input.tool_input.command)) return { block: false }

    const run = runTests(input.cwd)
    if (run.ok) return { block: false }
    return { block: true, message: failureMessage(run.output) }
  } catch (error) {
    // 보호 훅은 fail closed: 판단 불가면 통과시키지 않는다.
    return { block: true, message: `커밋 보호 훅 오류: ${error instanceof Error ? error.message : String(error)}` }
  }
}
