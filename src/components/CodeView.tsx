import { useState, useRef, useEffect } from 'react';

interface CodeViewProps {
  code: string;
  /** 스트리밍 중이면 생성 중 표시를 보이고, 코드가 자랄 때마다 맨 아래로 스크롤한다. */
  isStreaming?: boolean;
}

export function CodeView({ code, isStreaming = false }: CodeViewProps) {
  const [copied, setCopied] = useState(false);
  const blockRef = useRef<HTMLPreElement>(null);
  const lineCount = code.split('\n').length;

  useEffect(() => {
    const block = blockRef.current;
    if (isStreaming && block) block.scrollTop = block.scrollHeight;
  }, [code, isStreaming]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-panel">
      <div className="code-bar">
        <span className="code-meta">{isStreaming ? '생성 중...' : `${lineCount}줄`}</span>
        <button className="btn btn-copy" onClick={handleCopy} disabled={isStreaming} type="button">
          {copied ? '복사됨!' : '복사'}
        </button>
      </div>
      <pre
        ref={blockRef}
        className={`code-block ${isStreaming ? 'code-block--streaming' : ''}`.trim()}
        tabIndex={0}
      >
        <code>{isStreaming && !code ? '응답을 기다리는 중...' : code}</code>
      </pre>
    </div>
  );
}
