import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

// A render error or a page chunk that no longer exists used to fall through
// to the public site's boundary: an Arabic error screen whose button led to
// the home page. This one stays inside the admin, in English.

const RELOAD_FLAG = 'karahoca-admin:chunk-reload';

// After a deploy, an open admin tab still references the previous build's
// page chunks, which are gone: loading one fails until the page reloads.
const isChunkLoadError = (error: Error) =>
  /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i
    .test(`${error.name} ${error.message}`);

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AdminErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isChunkLoadError(error)) {
      // One automatic reload picks up the new build. The timestamp stops a
      // reload loop when the chunk is missing for another reason.
      let reloadedRecently = true;
      try {
        const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
        reloadedRecently = Date.now() - last < 30_000;
        if (!reloadedRecently) sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
      } catch {
        // Storage blocked: fall through to the manual button.
      }
      if (!reloadedRecently) {
        window.location.reload();
        return;
      }
    }
    console.error('[admin] render error', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunk = isChunkLoadError(error);
    return (
      <div className="adm-card" role="alert" style={{ maxWidth: 560, margin: '48px auto', textAlign: 'center' }}>
        <div className="adm-card-title" style={{ marginBottom: 8 }}>
          {chunk ? 'The dashboard was updated' : 'Something went wrong on this page'}
        </div>
        <p className="adm-text-muted" style={{ marginBottom: 20 }}>
          {chunk
            ? 'A new version was deployed while this tab was open. Reload to continue.'
            : error.message || 'An unexpected error occurred.'}
        </p>
        <button type="button" className="adm-btn adm-btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
