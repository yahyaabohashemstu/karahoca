const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const localhostHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

const isLocalDevelopmentHost = (hostname: string) =>
  localhostHosts.has(hostname.toLowerCase());

const normalizeConfiguredBaseUrl = (value: string) => {
  if (typeof window === 'undefined') {
    return trimTrailingSlash(value);
  }

  try {
    return trimTrailingSlash(new URL(value, window.location.origin).toString());
  } catch {
    return trimTrailingSlash(value);
  }
};

export const getApiBaseUrl = () => {
  const configuredBaseUrl = import.meta.env.VITE_BACKEND_URL?.trim();
  if (!configuredBaseUrl) {
    return '';
  }

  const normalizedBaseUrl = normalizeConfiguredBaseUrl(configuredBaseUrl);

  if (typeof window === 'undefined') {
    return normalizedBaseUrl;
  }

  try {
    const parsedUrl = new URL(normalizedBaseUrl, window.location.origin);
    if (
      isLocalDevelopmentHost(parsedUrl.hostname) &&
      !isLocalDevelopmentHost(window.location.hostname)
    ) {
      return '';
    }
  } catch {
    return normalizedBaseUrl;
  }

  return normalizedBaseUrl;
};

export const buildApiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : '/' + path;
  const baseUrl = getApiBaseUrl();

  return baseUrl ? baseUrl + normalizedPath : normalizedPath;
};
