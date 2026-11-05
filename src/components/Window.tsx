import { useId } from 'react';
import type { ReactNode } from 'react';

interface WindowProps {
  title: string;
  children: ReactNode;
  className?: string;
  /** 있으면 타이틀바 왼쪽에 닫기 박스가 생긴다. */
  onClose?: () => void;
  closeLabel?: string;
}

export function Window({ title, children, className = '', onClose, closeLabel = '닫기' }: WindowProps) {
  const titleId = useId();

  return (
    <section className={`win ${className}`.trim()} aria-labelledby={titleId}>
      <div className="win-titlebar">
        {onClose && (
          <button
            type="button"
            className="win-close"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
          />
        )}
        <span id={titleId} className="win-title">
          {title}
        </span>
      </div>
      <div className="win-body">{children}</div>
    </section>
  );
}
