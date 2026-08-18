import { describe, expect, it } from 'vitest';
import { DEFAULT_API_BASE_URL, resolveApiBaseUrl } from './config';

describe('resolveApiBaseUrl', () => {
  it('usa la URL local por defecto cuando la variable no existe', () => {
    expect(resolveApiBaseUrl(undefined)).toBe(DEFAULT_API_BASE_URL);
  });

  it('acepta y normaliza un origen HTTPS', () => {
    expect(resolveApiBaseUrl('https://api.example.test/')).toBe('https://api.example.test');
  });

  it.each([
    'api.example.test',
    'ftp://api.example.test',
    'https://api.example.test/path',
    'https://api.example.test?x=1',
    'https://api.example.test#section',
  ])('rechaza un valor inválido: %s', (value) => {
    expect(() => resolveApiBaseUrl(value)).toThrow(
      'VITE_API_BASE_URL debe ser un origen HTTP o HTTPS válido',
    );
  });
});
