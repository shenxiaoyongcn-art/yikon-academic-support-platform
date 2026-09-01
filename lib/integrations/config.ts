export type IntegrationState = 'ready' | 'missing_credentials' | 'not_configured';

export function synologyConfig() {
  const baseUrl = normalizeHttpsUrl(process.env.SYNOLOGY_BASE_URL || 'https://sznas.ali.cnvseq.com');
  const username = process.env.SYNOLOGY_USERNAME?.trim() || '';
  const password = process.env.SYNOLOGY_PASSWORD || '';

  return {
    baseUrl,
    username,
    password,
    rootFolder: process.env.SYNOLOGY_ROOT_FOLDER?.trim() || '/',
    state: username && password ? 'ready' as const : 'missing_credentials' as const,
  };
}

export function bmpConfig() {
  const baseUrl = process.env.BMP_BASE_URL ? normalizeHttpsUrl(process.env.BMP_BASE_URL) : '';
  const token = process.env.BMP_SERVICE_TOKEN?.trim() || '';
  return {
    baseUrl,
    token,
    state: !baseUrl ? 'not_configured' as const : token ? 'ready' as const : 'missing_credentials' as const,
    paths: {
      research: process.env.BMP_RESEARCH_PATH || '/api/v1/research-projects',
      aftersales: process.env.BMP_AFTERSALES_PATH || '/api/v1/aftersales-tickets',
      events: process.env.BMP_EVENTS_PATH || '/api/v1/academic-events',
      pgdReview: process.env.BMP_PGD_REVIEW_PATH || '/api/v1/pgd-reviews',
      training: process.env.BMP_TRAINING_PATH || '/api/v1/genetic-counseling-training',
    },
  };
}

function normalizeHttpsUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Integration base URL must use HTTPS.');
  url.pathname = url.pathname.replace(/\/$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}
