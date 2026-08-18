import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(() => {
    service = new HealthService();
  });

  it('informa el estado "ok"', () => {
    expect(service.getHealth().status).toBe('ok');
  });

  it('informa una marca de tiempo en formato ISO 8601', () => {
    const { timestamp } = service.getHealth();
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });
});
