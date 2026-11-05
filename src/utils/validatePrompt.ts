export const MAX_PROMPT_LENGTH = 500;

export interface PromptValidation {
  valid: boolean;
  length: number;
  message?: string;
}

export function validatePrompt(prompt: string): PromptValidation {
  const { length } = prompt.trim();

  if (length > MAX_PROMPT_LENGTH) {
    return {
      valid: false,
      length,
      message: `프롬프트는 ${MAX_PROMPT_LENGTH}자 이내로 입력해주세요.`,
    };
  }
  return { valid: true, length };
}
