import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { STORAGE_KEYS } from './utils/storage';

function mockApi({ envKeys = { anthropic: false, google: false } } = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/config') return { ok: true, json: async () => ({ envKeys }) };
    return { ok: true, json: async () => ({ code: 'render(<p>hi</p>)' }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const allStoredValues = () =>
  Object.keys(localStorage).map((k) => localStorage.getItem(k) ?? '').join('\n');

describe('App 영속화', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('저장된 provider 를 복원한다', () => {
    mockApi();
    localStorage.setItem(STORAGE_KEYS.provider, JSON.stringify('anthropic'));
    render(<App />);
    expect(screen.getByLabelText('AI 제공사')).toHaveValue('anthropic');
  });

  it('provider 를 바꾸면 저장소에 반영된다', async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText('AI 제공사'), 'anthropic');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.provider) ?? 'null')).toBe('anthropic');
  });

  it('API 키는 어떤 저장소에도 저장되지 않는다', async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('API 키'), 'AIza-secret-key-123');
    await user.type(screen.getByLabelText('만들고 싶은 컴포넌트 설명'), '버튼');
    await user.click(screen.getByRole('button', { name: '컴포넌트 생성' }));
    await screen.findByText('버튼', { selector: '.card-prompt' });

    expect(allStoredValues()).not.toContain('AIza-secret-key-123');
    expect(sessionStorage.length).toBe(0);
  });

  it('provider 를 바꾸면 입력해 둔 API 키가 비워진다', async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('API 키'), 'AIza-secret-key-123');
    await user.selectOptions(screen.getByLabelText('AI 제공사'), 'anthropic');

    expect(screen.getByLabelText('API 키')).toHaveValue('');
  });

  it('생성을 요청하면 프롬프트가 히스토리로 저장된다', async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('API 키'), 'k');
    await user.type(screen.getByLabelText('만들고 싶은 컴포넌트 설명'), '로그인 폼');
    await user.click(screen.getByRole('button', { name: '컴포넌트 생성' }));

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.promptHistory) ?? 'null')).toEqual([
        '로그인 폼',
      ]),
    );
  });

  it('저장된 히스토리를 "최근 프롬프트" 로 보여준다', () => {
    mockApi();
    localStorage.setItem(STORAGE_KEYS.promptHistory, JSON.stringify(['프로필 카드']));
    render(<App />);
    expect(screen.getByRole('list', { name: '최근 프롬프트' })).toHaveTextContent('프로필 카드');
  });

  it('API 키가 없어 생성이 막힌 요청은 히스토리에 남기지 않는다', async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('만들고 싶은 컴포넌트 설명'), '로그인 폼');
    await user.click(screen.getByRole('button', { name: '컴포넌트 생성' }));

    expect(localStorage.getItem(STORAGE_KEYS.promptHistory) ?? '[]').not.toContain('로그인 폼');
  });

  it('새로고침 후에도 생성된 컴포넌트 목록이 유지된다', async () => {
    mockApi();
    const user = userEvent.setup();
    const first = render(<App />);

    await user.type(screen.getByLabelText('API 키'), 'k');
    await user.type(screen.getByLabelText('만들고 싶은 컴포넌트 설명'), '로그인 폼');
    await user.click(screen.getByRole('button', { name: '컴포넌트 생성' }));
    await screen.findByText('로그인 폼', { selector: '.card-prompt' });
    first.unmount();

    render(<App />);
    expect(await screen.findByText('로그인 폼', { selector: '.card-prompt' })).toBeInTheDocument();
  });
});
