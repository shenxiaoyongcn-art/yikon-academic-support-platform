import { medicalLabConfig } from './config';

export type MedicalLabPage<T = Record<string, unknown>> = {
  items: T[];
  nextCursor: string | null;
  sourceUpdatedAt?: string;
};

export class MedicalLabConnector {
  private readonly config = medicalLabConfig();

  get state() {
    return this.config.state;
  }

  async probe() {
    if (!this.config.baseUrl) return { reachable: false, configured: false, reason: 'base_url_missing' };
    if (!this.config.healthPath) return { reachable: false, configured: false, reason: 'health_contract_missing' };
    try {
      const response = await this.request(this.config.healthPath, { method: 'GET' }, false);
      return { reachable: response.ok, configured: this.state === 'ready' };
    } catch {
      return { reachable: false, configured: this.state === 'ready' };
    }
  }

  async list<T = Record<string, unknown>>(cursor?: string, updatedAfter?: string): Promise<MedicalLabPage<T>> {
    if (this.state !== 'ready') throw new Error('Medical laboratory integration is not configured.');
    if (!this.config.metricsPath) throw new Error('Medical laboratory metrics endpoint is not configured.');
    const query = new URLSearchParams({ limit: '200' });
    if (cursor) query.set('cursor', cursor);
    if (updatedAfter) query.set('updated_after', updatedAfter);
    const response = await this.request(`${this.config.metricsPath}?${query}`, { method: 'GET' });
    if (!response.ok) throw new Error(`Medical laboratory system returned HTTP ${response.status}.`);
    return await response.json() as MedicalLabPage<T>;
  }

  private async request(path: string, init: RequestInit, requireAuth = true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      return await fetch(`${this.config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
        ...init,
        headers: { Accept: 'application/json', ...(requireAuth ? { Authorization: `Bearer ${this.config.token}` } : {}), ...init.headers },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
