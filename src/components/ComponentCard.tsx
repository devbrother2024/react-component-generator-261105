import { useState } from 'react';
import type { GeneratedComponent } from '../types';
import { LivePreview } from './LivePreview';
import { CodeView } from './CodeView';
import { Window } from './Window';

interface ComponentCardProps {
  component: GeneratedComponent;
  onRemove: (id: string) => void;
  onRegenerate: (prompt: string) => void;
  isLoading: boolean;
  /** 코드가 아직 생성되는 중이다. 코드 탭을 보여주고, 끝나면 미리보기 탭으로 전환한다. */
  isStreaming?: boolean;
}

type Tab = 'preview' | 'code';

const tabFor = (isStreaming: boolean): Tab => (isStreaming ? 'code' : 'preview');

export function ComponentCard({
  component,
  onRemove,
  onRegenerate,
  isLoading,
  isStreaming = false,
}: ComponentCardProps) {
  const [activeTab, setActiveTab] = useState<Tab>(tabFor(isStreaming));
  const [wasStreaming, setWasStreaming] = useState(isStreaming);
  const [previewKey, setPreviewKey] = useState(0);

  // 스트리밍 상태가 바뀌는 순간 탭을 맞춘다 (렌더 중 상태 조정 패턴).
  if (wasStreaming !== isStreaming) {
    setWasStreaming(isStreaming);
    setActiveTab(tabFor(isStreaming));
  }

  const createdAt = component.createdAt.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Window
      title={`${createdAt}에 생성`}
      className="component-card"
      onClose={isStreaming ? undefined : () => onRemove(component.id)}
      closeLabel="삭제"
    >
      <div className="card-header">
        <p className="card-prompt">{component.prompt}</p>
        <div className="card-actions">
          <button
            className="btn btn-refresh"
            onClick={() => setPreviewKey((k) => k + 1)}
            title="미리보기 새로고침"
            aria-label="미리보기 새로고침"
            type="button"
          >
            ↻
          </button>
          <button
            className="btn btn-regenerate"
            onClick={() => onRegenerate(component.prompt)}
            disabled={isLoading}
            type="button"
          >
            {isLoading ? '생성 중...' : '재생성'}
          </button>
        </div>
      </div>
      <div className="card-tabs" role="tablist" aria-label="보기 방식">
        <button
          className={`tab ${activeTab === 'preview' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('preview')}
          disabled={isStreaming}
          role="tab"
          aria-selected={activeTab === 'preview'}
          type="button"
        >
          미리보기
        </button>
        <button
          className={`tab ${activeTab === 'code' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('code')}
          role="tab"
          aria-selected={activeTab === 'code'}
          type="button"
        >
          코드
        </button>
      </div>
      <div className="card-content" role="tabpanel">
        {activeTab === 'preview' ? (
          <LivePreview key={previewKey} code={component.code} />
        ) : (
          <CodeView code={component.code} isStreaming={isStreaming} />
        )}
      </div>
    </Window>
  );
}
