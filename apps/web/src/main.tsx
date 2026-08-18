import { createRoot } from 'react-dom/client';
import { App } from './app';
import { createApi } from './api';
import { resolveApiBaseUrl } from './api/config';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('No se encontró el elemento raíz para iniciar la aplicación web.');
}

try {
  const api = createApi(resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL));
  createRoot(rootElement).render(<App api={api} />);
} catch (error: unknown) {
  const configurationError =
    error instanceof Error ? error : new Error('No se pudo configurar la conexión con la API.');
  createRoot(rootElement).render(<App configurationError={configurationError} />);
}
