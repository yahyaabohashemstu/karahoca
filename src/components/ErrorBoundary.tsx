import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { withTranslation } from 'react-i18next';
import type { WithTranslation } from 'react-i18next';
import { getClientSessionId } from '../utils/clientSession';
import { readCsrfToken } from '../utils/apiFetch';
import { buildApiUrl } from '../utils/api';
import './ErrorBoundary.css';

interface Props extends WithTranslation {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Retries an async function with exponential backoff delays until it
 * succeeds OR the delays list is exhausted. Each delay is "best effort" —
 * if the tab closes between attempts the retry is lost.
 *
 * The backoff schedule is injected so the ErrorBoundary test suite (or a
 * caller) can supply a tighter schedule.
 */
const DEFAULT_BACKOFF_MS: readonly number[] = [1_000, 3_000, 10_000];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const postWithBackoff = async (
  path: string,
  payload: unknown,
  delays: readonly number[] = DEFAULT_BACKOFF_MS,
): Promise<void> => {
  const attempts = delays.length + 1;
  // Fully-resolved URL — we can't use `apiFetch` here because it reads the
  // document, and Error-boundary reports should survive a tab-closing mid-
  // flight via `keepalive`. We still attach the CSRF header manually so the
  // public CSRF guard on /api/log-error accepts the request.
  const url = buildApiUrl(path);
  for (let i = 0; i < attempts; i++) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const csrf = readCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        // `keepalive: true` lets the request survive the tab closing mid-flight.
        keepalive: true,
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      if (response.ok) return;
      // 4xx is probably a bug in our payload — retrying won't help.
      if (response.status >= 400 && response.status < 500) return;
    } catch {
      /* network error — fall through to delay */
    }
    // If there's a delay left for this attempt, wait; otherwise drop.
    if (i < delays.length) {
      await sleep(delays[i]);
    }
  }
};

/**
 * Pulls a request id off an error that was thrown from an API fetch.
 * The public `fetch`-wrapper utility (src/utils/api.ts) is expected to
 * attach `reqId` or `requestId` to thrown errors — we read either.
 */
const extractRequestId = (err: unknown): string | null => {
  if (!err || typeof err !== 'object') return null;
  const bag = err as Record<string, unknown>;
  if (typeof bag.reqId === 'string' && bag.reqId.length > 0 && bag.reqId.length <= 128) {
    return bag.reqId;
  }
  if (typeof bag.requestId === 'string' && bag.requestId.length > 0 && bag.requestId.length <= 128) {
    return bag.requestId;
  }
  const cause = bag.cause;
  if (cause && typeof cause === 'object') {
    return extractRequestId(cause);
  }
  return null;
};

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  // Cached once per mount — useful so multiple errors in the same tab
  // share a sessionId.
  private readonly sessionId = getClientSessionId();

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      // Dev: keep the browser's rich error object visible for debugging.
      console.error('Error caught by boundary:', error, errorInfo);
    }

    // Production + dev both: forward to server. Pino on the backend will
    // bind its own reqId to the log line; we ship the FAILED-request's
    // reqId (if any) as `clientReqId` so the two can be joined.
    const clientReqId = extractRequestId(error);
    void postWithBackoff('/api/log-error', {
      message: error.message,
      stack: error.stack?.slice(0, 500),
      componentStack: errorInfo.componentStack?.slice(0, 500),
      url: typeof window !== 'undefined' ? window.location.href : '',
      ts: new Date().toISOString(),
      sessionId: this.sessionId,
      ...(clientReqId ? { clientReqId } : {}),
    });

    // Forward to Sentry if the SDK was installed at boot. No import from
    // @sentry/react here — the SDK attaches itself to window.Sentry-like
    // globals when main.tsx initialises it, and we access it loosely.
    const sentry = (globalThis as { __karahocaSentry?: { captureException?: (e: unknown, ctx?: unknown) => void } })
      .__karahocaSentry;
    if (sentry?.captureException) {
      try {
        sentry.captureException(error, {
          tags: { sessionId: this.sessionId, ...(clientReqId ? { clientReqId } : {}) },
          extra: { componentStack: errorInfo.componentStack },
        });
      } catch {
        /* never block the UI on telemetry */
      }
    }

    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      const { t } = this.props;

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary__container">
            <div className="error-boundary__icon">
              <svg
                width="80"
                height="80"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h1 className="error-boundary__title">{t('errorBoundary.title')}</h1>

            <p className="error-boundary__message">
              {t('errorBoundary.message')}
            </p>

            {import.meta.env.DEV && this.state.error && (
              <details className="error-boundary__details">
                <summary>{t('errorBoundary.details')}</summary>
                <pre className="error-boundary__error-text">
                  {this.state.error.toString()}
                </pre>
                {this.state.errorInfo && (
                  <pre className="error-boundary__stack">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}

            <div className="error-boundary__actions">
              <button
                onClick={this.handleReload}
                className="btn btn--primary"
              >
                {t('errorBoundary.reload')}
              </button>
              <button
                onClick={this.handleGoHome}
                className="btn btn--ghost"
              >
                {t('errorBoundary.home')}
              </button>
            </div>

            <p className="error-boundary__help">
              {t('errorBoundary.help')}{' '}
              <a href="mailto:info@karahoca.com" className="error-boundary__link">
                {t('errorBoundary.contact')}
              </a>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const TranslatedErrorBoundary = withTranslation()(ErrorBoundary);

export default TranslatedErrorBoundary;
