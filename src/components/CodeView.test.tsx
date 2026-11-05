import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CodeView } from './CodeView';

describe('CodeView', () => {
  it('코드와 줄 수를 보여준다', () => {
    render(<CodeView code={'a\nb'} />);
    expect(screen.getByText('2줄')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '복사' })).toBeEnabled();
  });

  it('스트리밍 중에는 생성 중 표시를 보이고 복사 버튼을 막는다', () => {
    render(<CodeView code="const A" isStreaming />);
    expect(screen.getByText('생성 중...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '복사' })).toBeDisabled();
  });

  it('스트리밍 중 아직 코드가 없으면 대기 안내를 보인다', () => {
    render(<CodeView code="" isStreaming />);
    expect(screen.getByText('응답을 기다리는 중...')).toBeInTheDocument();
  });

  it('스트리밍 중 코드가 자라면 코드 블록을 맨 아래로 스크롤한다', () => {
    const { rerender } = render(<CodeView code="a" isStreaming />);
    const block = screen.getByText('a').closest('pre') as HTMLElement;
    Object.defineProperty(block, 'scrollHeight', { value: 500, configurable: true });

    rerender(<CodeView code={'a\nb'} isStreaming />);

    expect(block.scrollTop).toBe(500);
  });

  it('스트리밍이 아니면 코드가 바뀌어도 스크롤을 건드리지 않는다', () => {
    const { rerender } = render(<CodeView code="a" />);
    const block = screen.getByText('a').closest('pre') as HTMLElement;
    Object.defineProperty(block, 'scrollHeight', { value: 500, configurable: true });

    rerender(<CodeView code={'a\nb'} />);

    expect(block.scrollTop).toBe(0);
  });

  it('스트리밍이 아니면 생성 중 표시가 없다', () => {
    render(<CodeView code="const A" />);
    expect(screen.queryByText('생성 중...')).not.toBeInTheDocument();
  });
});
