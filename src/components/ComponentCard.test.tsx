import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentCard } from './ComponentCard';
import type { GeneratedComponent } from '../types';

const component: GeneratedComponent = {
  id: 'c1',
  prompt: '버튼',
  code: 'const A = () => <button>hi</button>;\nrender(<A />);',
  createdAt: new Date('2026-11-05T01:02:03.000Z'),
};

const baseProps = {
  onRemove: vi.fn(),
  onRegenerate: vi.fn(),
  isLoading: false,
};

describe('ComponentCard', () => {
  it('스트리밍 중이 아니면 미리보기 탭으로 시작한다', () => {
    render(<ComponentCard {...baseProps} component={component} />);
    expect(screen.getByRole('tab', { name: '미리보기' })).toHaveAttribute('aria-selected', 'true');
  });

  it('스트리밍 중이면 코드 탭으로 시작해 지금까지의 코드를 보여준다', () => {
    render(
      <ComponentCard
        {...baseProps}
        isLoading
        isStreaming
        component={{ ...component, code: 'const A = ' }}
      />,
    );
    expect(screen.getByRole('tab', { name: '코드' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('const A =');
  });

  it('스트리밍이 끝나면 미리보기 탭으로 자동 전환된다', () => {
    const { rerender } = render(
      <ComponentCard {...baseProps} isLoading isStreaming component={{ ...component, code: 'const A' }} />,
    );

    rerender(<ComponentCard {...baseProps} isLoading={false} isStreaming={false} component={component} />);

    expect(screen.getByRole('tab', { name: '미리보기' })).toHaveAttribute('aria-selected', 'true');
  });

  it('스트리밍이 끝난 뒤에는 사용자가 코드 탭으로 다시 전환할 수 있다', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ComponentCard {...baseProps} isLoading isStreaming component={{ ...component, code: 'const A' }} />,
    );
    rerender(<ComponentCard {...baseProps} isLoading={false} isStreaming={false} component={component} />);

    await user.click(screen.getByRole('tab', { name: '코드' }));

    expect(screen.getByRole('tab', { name: '코드' })).toHaveAttribute('aria-selected', 'true');
  });

  it('스트리밍 중에는 미리보기 탭을 누를 수 없다', async () => {
    const user = userEvent.setup();
    render(<ComponentCard {...baseProps} isLoading isStreaming component={{ ...component, code: 'const A' }} />);

    await user.click(screen.getByRole('tab', { name: '미리보기' }));

    expect(screen.getByRole('tab', { name: '미리보기' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: '코드' })).toHaveAttribute('aria-selected', 'true');
  });

  it('스트리밍 중에는 삭제 버튼이 없다', () => {
    render(<ComponentCard {...baseProps} isLoading isStreaming component={{ ...component, code: 'c' }} />);
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
  });

  it('스트리밍이 아니면 삭제 버튼이 있다', () => {
    render(<ComponentCard {...baseProps} component={component} />);
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });
});
