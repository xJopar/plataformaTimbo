import { BadgeQuestionMarkIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useId, useRef, useState } from 'react';

const TOOLTIP_DURATION_MS = 5_000;

export function InterestRateInfo(): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const closeTooltip = window.setTimeout(() => setIsOpen(false), TOOLTIP_DURATION_MS);
    const closeWhenClickingOutside = (event: PointerEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener('pointerdown', closeWhenClickingOutside);
    return () => {
      window.clearTimeout(closeTooltip);
      document.removeEventListener('pointerdown', closeWhenClickingOutside);
    };
  }, [isOpen]);

  return (
    <span ref={containerRef} className="cc-interest-rate-info">
      <button
        type="button"
        className="cc-interest-rate-info-button"
        aria-controls={tooltipId}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        aria-label="Información sobre editar interés"
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setIsOpen(false);
        }}
      >
        <HugeiconsIcon
          aria-hidden="true"
          className="cc-interest-rate-info-icon"
          focusable="false"
          icon={BadgeQuestionMarkIcon}
          size={20}
          strokeWidth={1.8}
        />
      </button>
      {isOpen ? (
        <span id={tooltipId} className="cc-interest-rate-info-tooltip" role="tooltip">
          Cambiá la tasa para aplicar una promo vigente.
        </span>
      ) : null}
    </span>
  );
}
