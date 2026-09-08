import { BadgeQuestionMarkIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useId, useState } from 'react';

export function InterestRateInfo(): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span className="cc-interest-rate-info">
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
