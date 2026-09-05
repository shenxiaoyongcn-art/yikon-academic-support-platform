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
    authPath: process.env.BMP_AUTH_PATH?.trim() || '',
    authContractVerified: process.env.BMP_AUTH_CONTRACT_VERIFIED === 'true',
    authContractVersion: process.env.BMP_AUTH_CONTRACT_VERSION?.trim() || '',
    apiContractVersion: process.env.BMP_API_CONTRACT_VERSION?.trim() || '',
    healthPath: process.env.BMP_HEALTH_PATH?.trim() || '',
    state: !baseUrl ? 'not_configured' as const : token && process.env.BMP_API_CONTRACT_VERSION?.trim() ? 'ready' as const : 'missing_credentials' as const,
    paths: {
      tender: process.env.BMP_TENDER_PATH?.trim() || '',
      research: process.env.BMP_RESEARCH_PATH?.trim() || '',
      aftersales: process.env.BMP_AFTERSALES_PATH?.trim() || '',
      events: process.env.BMP_EVENTS_PATH?.trim() || '',
      salesAnalytics: process.env.BMP_SALES_ANALYTICS_PATH?.trim() || '',
      pgdReview: process.env.BMP_PGD_REVIEW_PATH?.trim() || '',
      pgdCenters: process.env.BMP_PGD_CENTERS_PATH?.trim() || '',
      training: process.env.BMP_TRAINING_PATH?.trim() || '',
    },
  };
}

export function medicalLabConfig() {
  const baseUrl = process.env.MEDICAL_LAB_BASE_URL ? normalizeHttpsUrl(process.env.MEDICAL_LAB_BASE_URL) : '';
  const token = process.env.MEDICAL_LAB_SERVICE_TOKEN?.trim() || '';
  return {
    baseUrl,
    token,
    metricsPath: process.env.MEDICAL_LAB_METRICS_PATH?.trim() || '',
    healthPath: process.env.MEDICAL_LAB_HEALTH_PATH?.trim() || '',
    state: !baseUrl ? 'not_configured' as const : token ? 'ready' as const : 'missing_credentials' as const,
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
