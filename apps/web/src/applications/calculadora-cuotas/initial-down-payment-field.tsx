import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import type { FinancingConfigValue } from './financing-config';

const MAX_PERCENTAGE = 100;

interface InitialDownPaymentFieldProps {
  value: FinancingConfigValue;
  totalPriceUsd: number;
  onChange: (nextValue: FinancingConfigValue) => void;
}

function formatEditable(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return value.toLocaleString('es-PY', { maximumFractionDigits: 2 });
}

function formatWhileTyping(value: string): string {
  const allowed = value.replace(/[^\d.,]/g, '');
  const commaPosition = allowed.lastIndexOf(',');
  const dotPosition = allowed.lastIndexOf('.');
  const separatorPosition = Math.max(commaPosition, dotPosition);
  const hasDecimal = separatorPosition >= 0 && allowed.length - separatorPosition - 1 <= 2;
  const integerDigits = (hasDecimal ? allowed.slice(0, separatorPosition) : allowed).replace(
    /\D/g,
    '',
  );
  const decimalDigits = hasDecimal
    ? allowed
        .slice(separatorPosition + 1)
        .replace(/\D/g, '')
        .slice(0, 2)
    : '';
  const integer = integerDigits === '' ? '' : Number(integerDigits).toLocaleString('es-PY');
  return hasDecimal ? `${integer},${decimalDigits}` : integer;
}

function parseDecimal(value: string): number | undefined {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  if (normalized === '') return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function roundUsd(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function InitialDownPaymentField({
  value,
  totalPriceUsd,
  onChange,
}: InitialDownPaymentFieldProps): React.JSX.Element {
  const downPaymentUsd =
    value.downPaymentMode === 'manual'
      ? value.downPaymentManualUsd
      : roundUsd((totalPriceUsd * value.downPaymentPercent) / MAX_PERCENTAGE);
  const downPaymentPercent =
    totalPriceUsd > 0 ? (downPaymentUsd / totalPriceUsd) * MAX_PERCENTAGE : 0;
  const sliderStyle = {
    '--cc-down-payment-progress': downPaymentPercent / MAX_PERCENTAGE,
  } as CSSProperties;
  const [percentInput, setPercentInput] = useState(formatEditable(downPaymentPercent));
  const [amountInput, setAmountInput] = useState(formatEditable(downPaymentUsd));
  const [error, setError] = useState<string | undefined>(undefined);
  const isEditingPercent = useRef(false);
  const isEditingAmount = useRef(false);

  useEffect(() => {
    if (!isEditingPercent.current) setPercentInput(formatEditable(downPaymentPercent));
    if (!isEditingAmount.current) setAmountInput(formatEditable(downPaymentUsd));
  }, [downPaymentPercent, downPaymentUsd]);

  function setPercent(nextPercent: number): void {
    const normalizedPercent = Math.min(Math.max(nextPercent, 0), MAX_PERCENTAGE);
    onChange({
      ...value,
      downPaymentMode: 'percent',
      downPaymentPercent: normalizedPercent,
      downPaymentManualUsd: roundUsd((totalPriceUsd * normalizedPercent) / MAX_PERCENTAGE),
    });
  }

  function setAmount(nextAmount: number): void {
    const normalizedAmount = Math.min(Math.max(nextAmount, 0), totalPriceUsd);
    onChange({
      ...value,
      downPaymentMode: 'manual',
      downPaymentManualUsd: roundUsd(normalizedAmount),
      downPaymentPercent:
        totalPriceUsd > 0 ? (normalizedAmount / totalPriceUsd) * MAX_PERCENTAGE : 0,
    });
  }

  function reportError(message: string): void {
    setError(message);
    toast.error(message);
  }

  function commitPercent(): void {
    isEditingPercent.current = false;
    const parsed = parseDecimal(percentInput);
    if (parsed === undefined) {
      setPercent(0);
      return;
    }
    if (parsed > MAX_PERCENTAGE) reportError('La entrega no puede superar el 100 %.');
    setPercent(parsed);
  }

  function commitAmount(): void {
    isEditingAmount.current = false;
    const parsed = parseDecimal(amountInput);
    if (parsed === undefined) {
      setAmount(0);
      return;
    }
    if (parsed > totalPriceUsd) reportError('La entrega no puede superar el precio total.');
    setAmount(parsed);
  }

  return (
    <fieldset className="cc-down-payment">
      <legend>Entrega inicial</legend>
      <div className="cc-down-payment-values">
        <label
          className="cc-down-payment-value cc-down-payment-value--amount"
          htmlFor="cc-down-payment-manual"
        >
          <span className="cc-down-payment-value-label">Monto</span>
          <span className="cc-down-payment-readout">
            <input
              id="cc-down-payment-manual"
              aria-label="Monto"
              aria-describedby={error === undefined ? undefined : 'cc-down-payment-error'}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amountInput}
              onFocus={() => {
                isEditingAmount.current = true;
              }}
              onChange={(event) => {
                const next = formatWhileTyping(event.target.value);
                setAmountInput(next);
                const parsed = parseDecimal(next);
                if (parsed !== undefined) setAmount(parsed);
              }}
              onBlur={commitAmount}
            />
            <span aria-hidden="true">USD</span>
          </span>
        </label>
        <label
          className="cc-down-payment-value cc-down-payment-value--percent"
          htmlFor="cc-down-payment-percent"
        >
          <span className="cc-down-payment-value-label">Porcentaje</span>
          <span className="cc-down-payment-readout">
            <input
              id="cc-down-payment-percent"
              aria-label="Porcentaje"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={percentInput}
              onFocus={() => {
                isEditingPercent.current = true;
              }}
              onChange={(event) => {
                const next = formatWhileTyping(event.target.value);
                setPercentInput(next);
                const parsed = parseDecimal(next);
                if (parsed !== undefined) setPercent(parsed);
              }}
              onBlur={commitPercent}
            />
            <span aria-hidden="true">%</span>
          </span>
        </label>
      </div>
      <div className="cc-down-payment-slider-control" style={sliderStyle}>
        <span className="cc-down-payment-slider-track" aria-hidden="true" />
        <input
          className="cc-down-payment-slider"
          type="range"
          min={0}
          max={MAX_PERCENTAGE}
          step={0.01}
          value={downPaymentPercent}
          aria-label="Porcentaje de entrega inicial"
          onChange={(event) => {
            isEditingPercent.current = false;
            isEditingAmount.current = false;
            setError(undefined);
            setPercent(Number(event.target.value));
          }}
        />
      </div>
      <div className="cc-down-payment-slider-scale" aria-hidden="true">
        <span>0 %</span>
        <span>100 %</span>
      </div>
      {error === undefined ? null : (
        <p id="cc-down-payment-error" className="cc-field-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
