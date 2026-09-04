import { useId } from 'react';
import styled from 'styled-components';

interface ReinforcementSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ReinforcementSwitch({
  checked,
  onChange,
}: ReinforcementSwitchProps): React.JSX.Element {
  const filterId = `reinforcement-switch-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <StyledWrapper>
      <div className="toggle-container">
        <input
          aria-label="Agregar refuerzos"
          checked={checked}
          className="toggle-input"
          role="switch"
          type="checkbox"
          onChange={(event) => onChange(event.target.checked)}
        />
        <svg aria-hidden="true" className="toggle" focusable="false" viewBox="0 0 292 142">
          <path
            className="toggle-background"
            d="M71 142C31.7878 142 0 110.212 0 71C0 31.7878 31.7878 0 71 0C110.212 0 119 30 146 30C173 30 182 0 221 0C260 0 292 31.7878 292 71C292 110.212 260.212 142 221 142C181.788 142 173 112 146 112C119 112 110.212 142 71 142Z"
          />
          <rect className="toggle-icon on" height="64" rx="6" width="12" x="64" y="39" />
          <path
            className="toggle-icon off"
            d="M221 91C232.046 91 241 82.0457 241 71C241 59.9543 232.046 51 221 51C209.954 51 201 59.9543 201 71C201 82.0457 209.954 91 221 91ZM221 103C238.673 103 253 88.6731 253 71C253 53.3269 238.673 39 221 39C203.327 39 189 53.3269 189 71C189 88.6731 203.327 103 221 103Z"
            fillRule="evenodd"
          />
          <g filter={`url(#${filterId})`}>
            <rect
              className="toggle-circle-center"
              fill="#fff"
              height="58"
              rx="29"
              width="116"
              x="13"
              y="42"
            />
            <rect
              className="toggle-circle left"
              fill="#fff"
              height="114"
              rx="58"
              width="114"
              x="14"
              y="14"
            />
            <rect
              className="toggle-circle right"
              fill="#fff"
              height="114"
              rx="58"
              width="114"
              x="164"
              y="14"
            />
          </g>
          <filter id={filterId}>
            <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              result="goo"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            />
          </filter>
        </svg>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.span`
  display: inline-flex;
  align-items: center;
  min-height: 44px;

  .toggle-container {
    --active-color: var(--cc-c-brand, #00388a);
    --inactive-color: #b9c5d4;
    position: relative;
    aspect-ratio: 292 / 142;
    height: 2.125rem;
    touch-action: manipulation;
  }

  .toggle-input {
    appearance: none;
    margin: 0;
    position: absolute;
    z-index: 1;
    inset: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }

  .toggle-input:focus-visible {
    outline: 2px solid var(--cc-c-brand, #00388a);
    outline-offset: 4px;
    border-radius: 999px;
  }

  .toggle {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
    transition: transform 120ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  .toggle-input:active + .toggle {
    transform: scale(0.97);
  }

  .toggle-background {
    fill: var(--inactive-color);
    transition: fill 180ms ease;
  }

  .toggle-input:checked + .toggle .toggle-background {
    fill: var(--active-color);
  }

  .toggle-circle-center {
    transform-origin: center;
    transition: transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
  }

  .toggle-input:checked + .toggle .toggle-circle-center {
    transform: translateX(150px);
  }

  .toggle-circle {
    transform-origin: center;
    backface-visibility: hidden;
    transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1);
  }

  .toggle-circle.left {
    transform: scale(1);
  }

  .toggle-input:checked + .toggle .toggle-circle.left {
    transform: scale(0.01);
  }

  .toggle-circle.right {
    transform: scale(0.01);
  }

  .toggle-input:checked + .toggle .toggle-circle.right {
    transform: scale(1);
  }

  .toggle-icon {
    transition: fill 180ms ease;
  }

  .toggle-icon.on {
    fill: var(--inactive-color);
  }

  .toggle-input:checked + .toggle .toggle-icon.on {
    fill: #fff;
  }

  .toggle-icon.off {
    fill: #f3f7fb;
  }

  .toggle-input:checked + .toggle .toggle-icon.off {
    fill: var(--active-color);
  }

  .toggle-input:focus-visible + .toggle .toggle-background,
  .toggle-input:focus-visible + .toggle .toggle-circle-center,
  .toggle-input:focus-visible + .toggle .toggle-circle,
  .toggle-input:focus-visible + .toggle .toggle-icon {
    transition-duration: 0ms;
  }

  @media (hover: hover) and (pointer: fine) {
    .toggle-input:hover + .toggle {
      transform: scale(1.02);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle,
    .toggle-background,
    .toggle-circle-center,
    .toggle-circle,
    .toggle-icon {
      transition-duration: 0ms;
    }
  }
`;
