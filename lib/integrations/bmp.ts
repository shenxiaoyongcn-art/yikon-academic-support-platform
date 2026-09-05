import { bmpConfig } from './config';

export type BmpModule = 'tender' | 'research' | 'aftersales' | 'events' | 'salesAnalytics' | 'pgdReview' | 'pgdCenters' | 'training';

export type BmpPage<T = Record<string, unknown>> = {
  items: T[];
  nextCursor: string | null;
  sourceUpdatedAt?: string;
  contractVersion: string;
};

export class BmpConnector {
  private readonly config = bmpConfig();

  constructor(private readonly userToken?: string) {}

  get state() {
    if (!this.config.baseUrl) return 'not_configured' as const;
    return (this.userToken || this.config.token) && this.config.apiContractVersion ? 'ready' as const : 'missing_credentials' as const;
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

  async list<T = Record<string, unknown>>(module: BmpModule, cursor?: string, updatedAfter?: string): Promise<BmpPage<T>> {
    if (this.state !== 'ready') throw new Error('BMP integration is not configured.');
    const path = this.config.paths[module];
    if (!path) throw new Error(`BMP ${module} endpoint is not configured.`);
    const query = new URLSearchParams({ limit: '200' });
    if (cursor) query.set('cursor', cursor);
    if (updatedAfter) query.set('updated_after', updatedAfter);
    const response = await this.request(`${path}?${query}`, { method: 'GET' });
    if (!response.ok) throw new Error(`BMP returned HTTP ${response.status}.`);
    const page = await response.json() as BmpPage<T>;
    if (page.contractVersion !== this.config.apiContractVersion || !Array.isArray(page.items) || !(page.nextCursor === null || typeof page.nextCursor === 'string')) throw new Error('BMP response does not match the accepted contract version.');
    return page;
  }

  private async request(path: string, init: RequestInit, requireAuth = true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      return await fetch(`${this.config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(requireAuth ? { Authorization: `Bearer ${this.userToken || this.config.token}` } : {}),
          ...init.headers,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
