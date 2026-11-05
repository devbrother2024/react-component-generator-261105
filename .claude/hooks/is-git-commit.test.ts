import { describe, expect, it } from 'vitest'
import { isGitCommit } from './is-git-commit'

describe('isGitCommit', () => {
  it('git commit 명령을 감지한다', () => {
    expect(isGitCommit('git commit -m "feat: x"')).toBe(true)
  })

  it('&& 로 이어진 복합 명령 안의 git commit 을 감지한다', () => {
    expect(isGitCommit('git add . && git commit -m "feat: x"')).toBe(true)
  })

  it.each([
    'git -C ../other commit -m "x"',
    'git -c user.name=a commit -m "x"',
    'git --no-pager commit -m "x"',
    'git --git-dir=.git commit -m "x"',
  ])('git 전역 옵션이 끼어 있어도 감지한다: %s', (command) => {
    expect(isGitCommit(command)).toBe(true)
  })

  it.each([
    'GIT_AUTHOR_NAME=a git commit -m "x"',
    'env git commit -m "x"',
    '(cd sub && git commit -m "x")',
    'echo $(git commit -m "x")',
    'echo `git commit -m "x"`',
    "sh -c 'git commit -m x'",
    'bash -c "git add . && git commit -m x"',
  ])('접두어·서브셸·따옴표로 감싸져 있어도 감지한다: %s', (command) => {
    expect(isGitCommit(command)).toBe(true)
  })

  it.each(['git commit-tree HEAD^{tree} -m x', 'git status', 'git log --oneline', 'bun run test'])(
    'git commit 이 아닌 명령은 감지하지 않는다: %s',
    (command) => {
      expect(isGitCommit(command)).toBe(false)
    },
  )
})
