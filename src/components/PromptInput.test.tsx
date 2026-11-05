import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromptInput } from './PromptInput';

describe('PromptInput', () => {
  it('프롬프트가 비어 있으면 생성 버튼이 비활성이다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);
    expect(screen.getByRole('button', { name: '컴포넌트 생성' })).toBeDisabled();
  });

  it('입력하면 버튼이 활성화되고 클릭 시 입력값으로 onGenerate가 호출된다', async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<PromptInput onGenerate={onGenerate} isLoading={false} />);

    await user.type(screen.getByRole('textbox'), '프로필 카드');
    const submit = screen.getByRole('button', { name: '컴포넌트 생성' });
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(onGenerate).toHaveBeenCalledWith('프로필 카드');
  });

  it('로딩 중에는 생성 버튼이 비활성이고 "생성 중..." 을 보여준다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={true} />);
    expect(screen.getByRole('button', { name: '생성 중...' })).toBeDisabled();
  });

  it('500자를 초과하면 에러 메시지를 보여주고 생성 버튼이 비활성이다', async () => {
    const user = userEvent.setup();
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);

    await user.click(screen.getByRole('textbox'));
    await user.paste('a'.repeat(501));

    expect(screen.getByRole('alert')).toHaveTextContent('프롬프트는 500자 이내로 입력해주세요.');
    expect(screen.getByRole('button', { name: '컴포넌트 생성' })).toBeDisabled();
  });

  it('500자를 초과하면 Ctrl+Enter 단축키로도 생성되지 않는다', async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<PromptInput onGenerate={onGenerate} isLoading={false} />);

    await user.click(screen.getByRole('textbox'));
    await user.paste('a'.repeat(501));
    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('히스토리가 있으면 "최근 프롬프트" 목록으로 보여준다', () => {
    render(
      <PromptInput onGenerate={vi.fn()} isLoading={false} history={['로그인 폼', '프로필 카드']} />,
    );
    const list = screen.getByRole('list', { name: '최근 프롬프트' });
    expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual([
      '로그인 폼',
      '프로필 카드',
    ]);
  });

  it('히스토리 항목을 누르면 입력창이 그 프롬프트로 채워진다', async () => {
    const user = userEvent.setup();
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} history={['로그인 폼']} />);

    await user.click(screen.getByRole('button', { name: '로그인 폼' }));

    expect(screen.getByRole('textbox')).toHaveValue('로그인 폼');
  });

  it('히스토리가 없으면 "최근 프롬프트" 목록을 보여주지 않는다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);
    expect(screen.queryByRole('list', { name: '최근 프롬프트' })).not.toBeInTheDocument();
  });
});
