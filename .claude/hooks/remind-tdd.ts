// PreToolUse(Edit|Write) 훅 진입점. stdin/stdout 같은 부수효과만 담당한다.
// 판단 로직은 tdd-reminder.ts (테스트 있음). 이 파일은 import 시 바로 실행되므로 테스트하지 않는다.
//
// 알림은 additionalContext 로 Claude 컨텍스트에 주입한다. 차단하지 않으므로 항상 exit 0.
import { tddReminder } from './tdd-reminder'

const reminder = tddReminder(await Bun.stdin.text())

if (reminder) {
  console.log(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: reminder } }),
  )
}
