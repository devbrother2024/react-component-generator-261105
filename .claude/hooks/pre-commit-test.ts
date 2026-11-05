// PreToolUse(Bash) 훅 진입점. stdin/프로세스 실행/종료 코드 같은 부수효과만 담당한다.
// 판단 로직은 commit-guard.ts (테스트 있음). 이 파일은 import 시 바로 실행되므로 테스트하지 않는다.
//
// 종료 코드: 0 = 통과, 2 = 차단 (stderr 가 Claude 에게 전달된다).
import { guardCommit, type RunTests } from './commit-guard'

const runTests: RunTests = (cwd) => {
  const proc = Bun.spawnSync(['bun', 'run', 'test'], {
    cwd,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return { ok: proc.exitCode === 0, output: `${proc.stdout.toString()}${proc.stderr.toString()}` }
}

const result = guardCommit(await Bun.stdin.text(), runTests)

if (result.block) {
  console.error(result.message)
  process.exit(2)
}
