import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { STORAGE_KEYS } from './utils/storage';

const ndjson = (...events: Array<Record<string, string>>) =>
  events.map((event) => `${JSON.stringify(event)}\n`).join('');

function mockApi({ envKeys = { anthropic: false, google: false } } = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/config') return { ok: true, json: async () => ({ envKeys }) };
    return new Response(ndjson({ type: 'done', code: 'render(<p>hi</p>)' }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** /api/generate 응답 청크를 테스트가 원하는 시점에 흘려 보낸다. */
function mockStreamingApi() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/config') {
        return { ok: true, json: async () => ({ envKeys: { anthropic: false, google: false } }) };
      }
      return new Response(body);
    }),
  );
  return {
    send: (event: Record<string, string>) => controller.enqueue(encoder.encode(ndjson(event))),
    close: () => controller.close(),
  };
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

describe('App 스트리밍', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function startGenerating() {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('API 키'), 'k');
    await user.type(screen.getByLabelText('만들고 싶은 컴포넌트 설명'), '카운터');
    await user.click(screen.getByRole('button', { name: '컴포넌트 생성' }));
    await screen.findByText('카운터', { selector: '.card-prompt' });
  }

  it('생성 중에는 코드 탭이 선택되고 도착한 코드가 실시간으로 보인다', async () => {
    const api = mockStreamingApi();
    await startGenerating();

    expect(screen.getByRole('tab', { name: '코드' })).toHaveAttribute('aria-selected', 'true');

    api.send({ type: 'delta', text: 'const Counter = () => {' });
    expect(await screen.findByText(/const Counter = \(\) => \{/)).toBeInTheDocument();

    api.send({ type: 'delta', text: '\n  return null;\n};' });
    expect(await screen.findByText(/return null;/)).toBeInTheDocument();

    api.send({ type: 'done', code: 'render(<p />)' });
    api.close();
  });

  it('생성이 끝나면 같은 카드가 유지된 채 미리보기 탭으로 전환된다', async () => {
    const api = mockStreamingApi();
    await startGenerating();
    const cardWhileStreaming = screen.getByText('카운터', { selector: '.card-prompt' }).closest('section');

    api.send({ type: 'delta', text: 'render(<p>done</p>)' });
    api.send({ type: 'done', code: 'render(<p>done</p>)' });
    api.close();

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: '미리보기' })).toHaveAttribute('aria-selected', 'true'),
    );
    expect(screen.getAllByText('카운터', { selector: '.card-prompt' })).toHaveLength(1);
    expect(screen.getByText('카운터', { selector: '.card-prompt' }).closest('section')).toBe(
      cardWhileStreaming,
    );
  });

  it('첫 생성 중에도 결과 섹션 헤더가 보여 완료 때 레이아웃이 밀리지 않는다', async () => {
    const api = mockStreamingApi();
    await startGenerating();

    api.send({ type: 'delta', text: 'const Counter = () => null;' });
    await screen.findByText(/const Counter/);

    expect(screen.getByRole('heading', { name: '생성된 컴포넌트 1개' })).toBeInTheDocument();

    api.send({ type: 'done', code: 'render(<p />)' });
    api.close();
  });

  it('다른 카드를 스트리밍해도 기존 카드의 탭은 그대로 미리보기다', async () => {
    localStorage.setItem(
      STORAGE_KEYS.components,
      JSON.stringify([
        {
          id: 'saved-1',
          prompt: '기존 버튼',
          code: 'render(<p>old</p>)',
          createdAt: '2026-11-05T01:02:03.000Z',
        },
      ]),
    );
    const api = mockStreamingApi();
    await startGenerating();

    api.send({ type: 'delta', text: 'const Counter = () => null;' });
    await screen.findByText(/const Counter/);

    const selectedTabs = screen.getAllByRole('tab', { selected: true }).map((tab) => tab.textContent);
    expect(selectedTabs).toEqual(['코드', '미리보기']); // 스트리밍 카드가 맨 위, 기존 카드가 아래

    api.send({ type: 'done', code: 'render(<p />)' });
    api.close();
  });

  it('생성이 실패하면 스트리밍 카드가 사라지고 에러가 보인다', async () => {
    const api = mockStreamingApi();
    await startGenerating();

    api.send({ type: 'error', error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
    api.close();

    expect(await screen.findByRole('alert')).toHaveTextContent('요청이 너무 많습니다');
    expect(screen.queryByText('카운터', { selector: '.card-prompt' })).not.toBeInTheDocument();
  });
});
