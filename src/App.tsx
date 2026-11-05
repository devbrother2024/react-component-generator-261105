import { useState, useEffect, useRef } from 'react';
import { PromptInput } from './components/PromptInput';
import { ComponentCard } from './components/ComponentCard';
import { Window } from './components/Window';
import { PixelLogo, PixelMac } from './components/PixelArt';
import { useComponentGenerator } from './hooks/useComponentGenerator';
import { usePersistentState } from './hooks/usePersistentState';
import { STORAGE_KEYS } from './utils/storage';
import { parseProvider, parsePromptHistory } from './utils/storageParsers';
import { addToHistory } from './utils/promptHistory';
import type { Provider } from './types';
import './App.css';

const PROVIDER_CONFIG = {
  anthropic: { label: 'Anthropic', placeholder: 'sk-ant-...' },
  google: { label: 'Google', placeholder: 'AIza...' },
} as const;

function App() {
  // API 키는 의도적으로 영속화하지 않는다. React state 에만 둔다 (src/AGENTS.md Local Golden Rules).
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = usePersistentState<Provider>(
    STORAGE_KEYS.provider,
    'google',
    parseProvider,
  );
  const [promptHistory, setPromptHistory] = usePersistentState<string[]>(
    STORAGE_KEYS.promptHistory,
    [],
    parsePromptHistory,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [envKeys, setEnvKeys] = useState<Record<Provider, boolean>>({
    anthropic: false,
    google: false,
  });
  const keyInputRef = useRef<HTMLInputElement>(null);
  const { components, isLoading, error, generate, removeComponent, clearAll } =
    useComponentGenerator();

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setEnvKeys(data.envKeys))
      .catch(() => {});
  }, []);

  const hasEnvKey = envKeys[provider];

  const handleGenerate = (prompt: string) => {
    if (!apiKey.trim() && !hasEnvKey) {
      setNotice(
        `${PROVIDER_CONFIG[provider].label} API 키가 필요합니다. 실행 설정에 키를 입력하거나 서버 .env에 설정하세요.`,
      );
      keyInputRef.current?.focus();
      return;
    }
    setNotice(null);
    setPromptHistory((prev) => addToHistory(prev, prompt));
    generate(prompt, apiKey || undefined, provider);
  };

  const handleProviderChange = (newProvider: Provider) => {
    setProvider(newProvider);
    setApiKey('');
    setNotice(null);
  };

  const activeProvider = PROVIDER_CONFIG[provider].label;
  const message = notice ?? error;

  return (
    <div className="app">
      <div className="menubar">
        <div className="menubar-brand">
          <PixelLogo size={20} />
          <span>React 컴포넌트 생성기</span>
        </div>
        <div className="menubar-status" aria-label="현재 작업 상태">
          <span className="menubar-item">{activeProvider}</span>
          <span className="menubar-item">컴포넌트 {components.length}개</span>
        </div>
      </div>

      <main className="desktop">
        <div className="workspace">
          <Window title="새 컴포넌트" className="win--composer">
            <PromptInput
              onGenerate={handleGenerate}
              isLoading={isLoading}
              history={promptHistory}
            />
          </Window>

          <Window title="실행 설정" className="win--settings">
            <div className="settings">
              <div className="field">
                <label htmlFor="provider">AI 제공사</label>
                <select
                  id="provider"
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value as Provider)}
                >
                  {Object.entries(PROVIDER_CONFIG).map(([key, { label }]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="api-key">API 키</label>
                <div className="api-key-field">
                  <input
                    id="api-key"
                    ref={keyInputRef}
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setNotice(null);
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={
                      hasEnvKey
                        ? '서버 키 사용 중 (직접 입력하면 덮어씁니다)'
                        : PROVIDER_CONFIG[provider].placeholder
                    }
                  />
                  <button
                    className="btn btn-toggle-key"
                    onClick={() => setShowKey(!showKey)}
                    type="button"
                    aria-pressed={showKey}
                  >
                    {showKey ? '숨기기' : '보기'}
                  </button>
                </div>
                <p className={`key-status ${hasEnvKey ? 'key-status--ready' : ''}`}>
                  <span className="led" aria-hidden="true" />
                  {hasEnvKey
                    ? '.env 키가 연결되어 있습니다.'
                    : '직접 입력하거나 서버 환경변수를 설정하세요.'}
                </p>
              </div>
            </div>
          </Window>
        </div>

        {message && (
          <div className="alert" role="alert">
            <span className="alert-icon" aria-hidden="true">
              !
            </span>
            <p>{message}</p>
          </div>
        )}

        <section className="results" aria-label="생성 결과">
          {components.length > 0 && (
            <div className="results-bar">
              <h2>생성된 컴포넌트 {components.length}개</h2>
              <button className="btn btn-clear" onClick={clearAll} type="button">
                전체 삭제
              </button>
            </div>
          )}

          {isLoading && (
            <Window title="생성 중" className="win--loading">
              <div className="loading-body">
                <p>컴포넌트를 생성하고 있습니다...</p>
                <div
                  className="progress"
                  role="progressbar"
                  aria-label="컴포넌트 생성 진행 중"
                >
                  <span />
                </div>
              </div>
            </Window>
          )}

          {components.length === 0 && !isLoading && (
            <div className="empty-state">
              <PixelMac size={100} />
              <div className="empty-copy">
                <h2>아직 생성된 컴포넌트가 없습니다.</h2>
                <p>
                  위 창에 만들고 싶은 UI를 적고 ‘컴포넌트 생성’을 누르세요. 예시 프롬프트를
                  누르면 입력창이 채워집니다.
                </p>
              </div>
            </div>
          )}

          <div className="results-grid">
            {components.map((component) => (
              <ComponentCard
                key={component.id}
                component={component}
                onRemove={removeComponent}
                onRegenerate={handleGenerate}
                isLoading={isLoading}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
