const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const getApiBaseUrl = () => {
  const configuredBaseUrl = import.meta.env.VITE_BACKEND_URL;
  return configuredBaseUrl ? trimTrailingSlash(configuredBaseUrl) : '';
};

export const buildApiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();

  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
};
