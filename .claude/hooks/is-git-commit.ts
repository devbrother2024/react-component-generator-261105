// 보호 훅은 놓치는 것(미탐)이 과하게 잡는 것(오탐)보다 나쁘다.
// 그래서 명령 전체에서 `git [전역 옵션...] commit` 을 넓게 찾는다. 오탐은 테스트를 한 번 더 돌릴 뿐이다.
const GIT_COMMIT = /(?:^|[\s(`'"])git(\s+(-[Cc]\s+\S+|--[\w-]+(=\S+)?))*\s+commit(?![\w-])/

export function isGitCommit(command: string): boolean {
  return GIT_COMMIT.test(command)
}
