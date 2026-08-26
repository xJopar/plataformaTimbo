import { useEffect, useState } from 'react';
import type { AuthSession } from '../api';

function formatCurrentDateTime(value: Date): string {
  return new Intl.DateTimeFormat('es-PY', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(value);
}

interface PlatformSessionBarProps {
  session: AuthSession;
}

export function PlatformSessionBar({ session }: PlatformSessionBarProps): React.JSX.Element {
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date());
  const employeeName = session.displayName ?? session.corporateEmail;

  useEffect(() => {
    const updateCurrentDateTime = () => setCurrentDateTime(new Date());
    const millisecondsUntilNextMinute = 60_000 - (Date.now() % 60_000);
    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      updateCurrentDateTime();
      intervalId = window.setInterval(updateCurrentDateTime, 60_000);
    }, millisecondsUntilNextMinute);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  return (
    <section className="subheader" aria-label="Información de sesión">
      <p>
        Hola, <strong>{employeeName}</strong>
      </p>
      <time dateTime={currentDateTime.toISOString()}>{formatCurrentDateTime(currentDateTime)}</time>
    </section>
  );
}
