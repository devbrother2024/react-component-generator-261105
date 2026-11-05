import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// evaluator 서브 에이전트 정의의 불변식을 고정한다.
// 읽기 전용 / Opus / 적대적 전제가 실수로 풀리지 않게 하는 안전망이다.
const AGENT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'evaluator.md')
const READ_ONLY_TOOLS = ['Read', 'Grep', 'Glob']

function readAgent() {
  if (!existsSync(AGENT_PATH)) return null
  const match = readFileSync(AGENT_PATH, 'utf8').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return null

  const fields: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':')
    if (/^\w+:/.test(line)) fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim()
  }
  return { fields, body: match[2] }
}

const toList = (value = '') =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

describe('evaluator 서브 에이전트 정의', () => {
  it('evaluator 라는 이름으로 정의되어 있다', () => {
    expect(readAgent()?.fields.name).toBe('evaluator')
  })

  it('Opus 모델로 지정한다', () => {
    expect(readAgent()?.fields.model).toBe('opus')
  })

  it('읽기 전용 도구만 허용한다', () => {
    const tools = toList(readAgent()?.fields.tools)

    expect(tools.length).toBeGreaterThan(0)
    expect(tools.filter((tool) => !READ_ONLY_TOOLS.includes(tool))).toEqual([])
  })

  it('쓰기·실행·위임 도구를 명시적으로 금지한다', () => {
    const disallowed = toList(readAgent()?.fields.disallowedTools)

    for (const tool of ['Write', 'Edit', 'NotebookEdit', 'Bash', 'Agent']) {
      expect(disallowed).toContain(tool)
    }
  })

  it('코드 생성 직후 자동 위임되도록 description 에 proactively 를 쓴다', () => {
    expect(readAgent()?.fields.description).toContain('proactively')
  })

  it('구현이 틀렸다고 가정하는 적대적 전제를 프롬프트에 담는다', () => {
    expect(readAgent()?.body).toContain('틀렸다고 가정')
  })
})
