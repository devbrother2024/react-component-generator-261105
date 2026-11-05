import { describe, it, expect } from 'vitest';
import { validatePrompt } from './validatePrompt';

describe('validatePrompt', () => {
  it('500자 이하면 유효하다', () => {
    const result = validatePrompt('a'.repeat(500));

    expect(result.valid).toBe(true);
  });

  it('501자 이상이면 무효이고 길이 초과 메시지를 반환한다', () => {
    const result = validatePrompt('a'.repeat(501));

    expect(result.valid).toBe(false);
    expect(result.length).toBe(501);
    expect(result.message).toBe('프롬프트는 500자 이내로 입력해주세요.');
  });

  it('앞뒤 공백은 제외하고 길이를 판단한다', () => {
    // PromptInput 이 trim 한 값을 전송하므로 전송되는 값 기준으로 검증한다.
    const result = validatePrompt(`  ${'a'.repeat(500)}  `);

    expect(result.valid).toBe(true);
    expect(result.length).toBe(500);
  });
});
