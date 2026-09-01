import { bmpConfig } from './config';

export type BmpModule = 'research' | 'aftersales' | 'events' | 'pgdReview' | 'training';

export type BmpPage<T = Record<string, unknown>> = {
  items: T[];
  nextCursor: string | null;
  sourceUpdatedAt?: string;
};

export class BmpConnector {
  private readonly config = bmpConfig();

  get state() {
    return this.config.state;
  }

  async probe() {
    if (!this.config.baseUrl) return { reachable: false, configured: false, reason: 'base_url_missing' };
    try {
      const response = await this.request('/health', { method: 'GET' }, false);
      return { reachable: response.ok, configured: this.state === 'ready' };
    } catch {
      return { reachable: false, configured: this.state === 'ready' };
    }
  }

  async list<T = Record<string, unknown>>(module: BmpModule, cursor?: string, updatedAfter?: string): Promise<BmpPage<T>> {
    if (this.state !== 'ready') throw new Error('BMP integration is not configured.');
    const query = new URLSearchParams({ limit: '200' });
    if (cursor) query.set('cursor', cursor);
    if (updatedAfter) query.set('updated_after', updatedAfter);
    const response = await this.request(`${this.config.paths[module]}?${query}`, { method: 'GET' });
    if (!response.ok) throw new Error(`BMP returned HTTP ${response.status}.`);
    return await response.json() as BmpPage<T>;
  }

  private async request(path: string, init: RequestInit, requireAuth = true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      return await fetch(`${this.config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(requireAuth ? { Authorization: `Bearer ${this.config.token}` } : {}),
          ...init.headers,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
