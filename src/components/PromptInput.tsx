import { useState } from 'react';
import { validatePrompt } from '../utils/validatePrompt';

interface PromptInputProps {
  onGenerate: (prompt: string) => void;
  isLoading: boolean;
}

const EXAMPLES = [
  'SaaS 관리자용 KPI 카드 3개. 매출, 활성 사용자, 전환율을 비교 가능한 형태로 표시',
  '설정 페이지의 알림 토글 패널. 이메일, 슬랙, 주간 리포트 옵션 포함',
  '검색 필터 바. 상태, 담당자, 날짜 범위를 선택하고 결과 수를 보여주는 UI',
  '온보딩 체크리스트. 5단계 진행률과 완료/대기 상태를 보여주는 카드',
  '요금제 비교 카드 3개. 추천 플랜을 강조하고 CTA 버튼 포함',
  '테이블 행 상세보기 패널. 선택한 고객의 기본 정보와 최근 활동 표시',
];

export function PromptInput({ onGenerate, isLoading }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const validation = validatePrompt(prompt);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && validation.valid && !isLoading) {
      onGenerate(prompt.trim());
    }
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
  };

  return (
    <div className="prompt-section">
      <h1 className="prompt-title">무엇을 만들까요?</h1>
      <p className="prompt-lead">
        만들고 싶은 UI를 설명하면 React 컴포넌트를 생성해 바로 미리 보고 코드로 확인합니다.
      </p>
      <form onSubmit={handleSubmit} className="prompt-form">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="예: 고객 목록 테이블 위에 들어갈 검색 필터 바를 만들어줘. 상태, 담당자, 날짜 범위 필터가 필요해."
          aria-label="만들고 싶은 컴포넌트 설명"
          className="prompt-textarea"
          rows={4}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleSubmit(e);
            }
          }}
        />
        {!validation.valid && (
          <p className="prompt-error" role="alert">
            {validation.message}
          </p>
        )}
        <div className="prompt-actions">
          <p className="prompt-hint">Cmd/Ctrl + Enter로도 생성할 수 있습니다.</p>
          <button
            type="submit"
            className="btn-generate"
            disabled={!prompt.trim() || !validation.valid || isLoading}
          >
            {isLoading ? <span>생성 중...</span> : '컴포넌트 생성'}
          </button>
        </div>
      </form>
      <div className="prompt-examples">
        <p className="examples-label" id="examples-label">
          예시 프롬프트
        </p>
        <ul className="examples-list" aria-labelledby="examples-label">
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button
                className="example-row"
                onClick={() => handleExampleClick(example)}
                type="button"
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
