import { type ClipboardEvent, type FormEvent, type KeyboardEvent, useState } from 'react';
import { ApiHttpError, type Api, type PreauthorizeAdministrativeUserBulkResult } from '../api';
import { reportBrowserOperationFailed } from '../browser-diagnostics';
import { corporateEmailDomain } from '../runtime-config';

interface EmailChip {
  id: number;
  value: string;
}

interface PreauthorizeUsersPageProps {
  api: Api;
  onNavigate: (pathname: string) => void;
}

function validateCorporateEmail(email: string, allEmails: readonly string[]): string | undefined {
  if (!email.includes('@')) return 'Ingresá un correo completo.';
  if (!email.endsWith(`@${corporateEmailDomain}`)) {
    return `El correo debe terminar en @${corporateEmailDomain}.`;
  }
  if (allEmails.filter((candidate) => candidate === email).length > 1) {
    return 'El correo está repetido.';
  }
  return undefined;
}

function splitEmails(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

export function PreauthorizeUsersPage({
  api,
  onNavigate,
}: PreauthorizeUsersPageProps): React.JSX.Element {
  const [draftEmail, setDraftEmail] = useState('');
  const [emailChips, setEmailChips] = useState<EmailChip[]>([]);
  const [nextChipId, setNextChipId] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [results, setResults] = useState<PreauthorizeAdministrativeUserBulkResult[] | undefined>(
    undefined,
  );

  const addEmails = (rawValue: string): void => {
    const emails = splitEmails(rawValue);
    if (emails.length === 0) return;
    setEmailChips((current) => [
      ...current,
      ...emails.map((value, index) => ({ id: nextChipId + index, value })),
    ]);
    setNextChipId((current) => current + emails.length);
    setDraftEmail('');
    setError(undefined);
  };

  const commitDraft = (): void => addEmails(draftEmail);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' && event.key !== ',') return;
    event.preventDefault();
    commitDraft();
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>): void => {
    const pastedText = event.clipboardData.getData('text');
    if (!/[\n,]/.test(pastedText)) return;
    event.preventDefault();
    addEmails(pastedText);
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const emails =
      draftEmail.trim().length > 0
        ? [...emailChips, { id: nextChipId, value: draftEmail }]
        : emailChips;
    const normalizedEmails = emails.map((chip) => chip.value.trim().toLowerCase());
    const hasInvalidEmail = normalizedEmails.some(
      (email) => validateCorporateEmail(email, normalizedEmails) !== undefined,
    );
    if (normalizedEmails.length === 0) {
      setError('Agregá al menos un correo corporativo.');
      return;
    }
    if (hasInvalidEmail) {
      setError('Corregí o quitá los correos marcados antes de preautorizar.');
      return;
    }

    setIsSaving(true);
    setError(undefined);
    setResults(undefined);
    try {
      const nextResults = await api.administration.preauthorizeUsersBulk(
        normalizedEmails.map((corporateEmail) => ({ corporateEmail })),
      );
      setResults(nextResults);
      if (nextResults.every((result) => result.status === 'CREATED')) {
        setEmailChips([]);
        setDraftEmail('');
      }
    } catch (submitError) {
      reportBrowserOperationFailed(submitError, {
        operation: 'administration.manage-users',
        method: 'POST',
        route: '/api/admin/users/bulk',
        provider: 'api',
        ...(submitError instanceof ApiHttpError ? { status: submitError.status } : {}),
      });
      setError(
        submitError instanceof ApiHttpError && submitError.status === 403
          ? 'Tu sesión no tiene permiso para preautorizar usuarios.'
          : 'No pudimos preautorizar los usuarios. Intentá nuevamente.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="administration-content" aria-labelledby="preauthorize-users-title">
      <a
        className="text-link"
        href="/admin"
        onClick={(event) => {
          event.preventDefault();
          onNavigate('/admin');
        }}
      >
        Volver a Usuarios
      </a>
      <h1 id="preauthorize-users-title">Preautorizar usuarios</h1>
      <p className="administration-description">
        Agregá correos corporativos. El nombre visible se completará con el perfil de Google cuando
        la persona ingrese por primera vez.
      </p>
      <form className="preauthorize-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor="corporate-email-entry">Correos corporativos</label>
        <p className="field-hint">
          Separá cada correo con una coma o pegá una lista separada por comas.
        </p>
        {emailChips.length === 0 ? null : (
          <ul className="email-chip-list" aria-label="Correos para preautorizar">
            {emailChips.map((chip) => {
              const validationError = validateCorporateEmail(
                chip.value,
                emailChips.map((candidate) => candidate.value),
              );
              return (
                <li
                  key={chip.id}
                  className={
                    validationError === undefined ? 'email-chip' : 'email-chip email-chip--invalid'
                  }
                >
                  <span>{chip.value}</span>
                  {validationError === undefined ? null : <span>{validationError}</span>}
                  <button
                    type="button"
                    aria-label={`Quitar ${chip.value}`}
                    onClick={() =>
                      setEmailChips((current) =>
                        current.filter((candidate) => candidate.id !== chip.id),
                      )
                    }
                  >
                    Quitar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <input
          id="corporate-email-entry"
          value={draftEmail}
          placeholder={`persona@${corporateEmailDomain}`}
          onChange={(event) => setDraftEmail(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />
        {draftEmail.trim().length === 0 ? null : (
          <button className="text-button" type="button" onClick={commitDraft}>
            Agregar correo
          </button>
        )}
        {error === undefined ? null : <p role="alert">{error}</p>}
        <button className="action-button" type="submit" disabled={isSaving}>
          {isSaving ? 'Preautorizando…' : 'Preautorizar usuarios'}
        </button>
      </form>
      {results === undefined ? null : (
        <section className="state-surface" aria-labelledby="preauthorize-results-title">
          <h2 id="preauthorize-results-title">Resultado de la preautorización</h2>
          <ul className="bulk-result-list">
            {results.map((result) => (
              <li
                key={result.corporateEmail}
                className={`bulk-result-item bulk-result-item--${result.status.toLowerCase()}`}
              >
                {result.corporateEmail}:{' '}
                {result.status === 'CREATED' ? 'preautorizado' : result.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
