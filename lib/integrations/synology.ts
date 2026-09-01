import { synologyConfig } from './config';

type SynologyEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code: number };
};

export type SynologyFile = {
  name: string;
  path: string;
  isdir: boolean;
  size?: number;
  additional?: {
    time?: { mtime?: number };
    owner?: { user?: string };
  };
};

export class SynologyConnector {
  private readonly config = synologyConfig();
  private readonly sessionName = 'AcademicSupportPlatform';

  get state() {
    return this.config.state;
  }

  async probe() {
    const query = new URLSearchParams({
      api: 'SYNO.API.Info',
      version: '1',
      method: 'query',
      query: 'SYNO.API.Auth,SYNO.FileStation.List,SYNO.FileStation.Search',
    });
    const response = await this.fetchJson<Record<string, { path: string; minVersion: number; maxVersion: number }>>(
      `/webapi/query.cgi?${query}`,
    );
    return {
      reachable: response.success,
      configured: this.state === 'ready',
      apiCount: Object.keys(response.data || {}).length,
    };
  }

  async search(pattern: string, limit = 50) {
    if (!pattern.trim()) return [];
    return this.withSession(async (sid) => {
      const started = await this.call<{ taskid: string }>('SYNO.FileStation.Search', 'start', sid, {
        folder_path: JSON.stringify([this.config.rootFolder]),
        pattern: pattern.trim(),
        recursive: 'true',
      });
      const taskId = started.taskid;
      try {
        const result = await this.call<{ files: SynologyFile[]; finished: boolean }>('SYNO.FileStation.Search', 'list', sid, {
          taskid: taskId,
          offset: '0',
          limit: String(Math.min(Math.max(limit, 1), 200)),
          additional: JSON.stringify(['time', 'owner']),
        });
        return result.files || [];
      } finally {
        await this.call('SYNO.FileStation.Search', 'stop', sid, { taskid: taskId }).catch(() => undefined);
      }
    });
  }

  async list(folderPath = this.config.rootFolder, limit = 100) {
    return this.withSession(async (sid) => {
      const result = await this.call<{ files: SynologyFile[] }>('SYNO.FileStation.List', 'list', sid, {
        folder_path: folderPath,
        offset: '0',
        limit: String(Math.min(Math.max(limit, 1), 500)),
        sort_by: 'name',
        sort_direction: 'asc',
        additional: JSON.stringify(['time', 'owner']),
      });
      return result.files || [];
    });
  }

  private async login() {
    if (this.state !== 'ready') throw new IntegrationConfigurationError('Synology credentials are not configured.');
    const body = new URLSearchParams({
      api: 'SYNO.API.Auth',
      version: '7',
      method: 'login',
      account: this.config.username,
      passwd: this.config.password,
      session: this.sessionName,
      format: 'sid',
    });
    const result = await this.fetchJson<{ sid: string }>('/webapi/entry.cgi', { method: 'POST', body });
    if (!result.success || !result.data?.sid) throw new IntegrationAuthError(result.error?.code);
    return result.data.sid;
  }

  private async logout(sid: string) {
    const body = new URLSearchParams({
      api: 'SYNO.API.Auth',
      version: '7',
      method: 'logout',
      session: this.sessionName,
      _sid: sid,
    });
    await this.fetchJson('/webapi/entry.cgi', { method: 'POST', body });
  }

  private async withSession<T>(operation: (sid: string) => Promise<T>) {
    const sid = await this.login();
    try {
      return await operation(sid);
    } finally {
      await this.logout(sid).catch(() => undefined);
    }
  }

  private async call<T = Record<string, never>>(
    api: string,
    method: string,
    sid: string,
    values: Record<string, string>,
  ): Promise<T> {
    const body = new URLSearchParams({ api, version: '2', method, _sid: sid, ...values });
    const result = await this.fetchJson<T>('/webapi/entry.cgi', { method: 'POST', body });
    if (!result.success || !result.data) throw new IntegrationRequestError('Synology API request failed.', result.error?.code);
    return result.data;
  }

  private async fetchJson<T>(path: string, init?: RequestInit): Promise<SynologyEnvelope<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        ...init,
        headers: { Accept: 'application/json', ...init?.headers },
        signal: controller.signal,
      });
      if (!response.ok) throw new IntegrationRequestError(`Synology returned HTTP ${response.status}.`);
      return await response.json() as SynologyEnvelope<T>;
    } catch (error) {
      if (error instanceof IntegrationRequestError) throw error;
      throw new IntegrationRequestError('Synology connection failed.');
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class IntegrationConfigurationError extends Error {}
export class IntegrationAuthError extends Error {
  constructor(public readonly apiCode?: number) { super('Synology authentication failed.'); }
}
export class IntegrationRequestError extends Error {
  constructor(message: string, public readonly apiCode?: number) { super(message); }
}
