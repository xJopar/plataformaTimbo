import { normalizeRequestRoute } from './request-route';

describe('normalizeRequestRoute', () => {
  it('conserva la ruta cuando no hay query string', () => {
    expect(normalizeRequestRoute('/api/health')).toBe('/api/health');
  });

  it('descarta el query string, incluidos code y state de un callback OAuth', () => {
    expect(normalizeRequestRoute('/api/auth/google/callback?state=abc123&code=super-secreto')).toBe(
      '/api/auth/google/callback',
    );
  });

  it('descarta un query string vacío', () => {
    expect(normalizeRequestRoute('/api/health?')).toBe('/api/health');
  });
});
