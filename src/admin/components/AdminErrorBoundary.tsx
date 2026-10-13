import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AdminLangContext, defineMessages } from '../i18n/core';

// A class component can't call useT; it reads the language from context.
const messages = defineMessages({
  en: {
    updatedTitle: 'The dashboard was updated',
    updatedText: 'A new version was deployed while this tab was open. Reload to continue.',
    errorTitle: 'Something went wrong on this page',
    errorText: 'An unexpected error occurred.',
    reload: 'Reload',
  },
  ar: {
    updatedTitle: 'تم تحديث لوحة التحكم',
    updatedText: 'نُشرت نسخة جديدة أثناء فتح هذا التبويب. أعد تحميل الصفحة للمتابعة.',
    errorTitle: 'حدث خطأ في هذه الصفحة',
    errorText: 'حدث خطأ غير متوقع.',
    reload: 'إعادة التحميل',
  },
});

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
  static contextType = AdminLangContext;
  declare context: React.ContextType<typeof AdminLangContext>;
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
    const m = messages[this.context?.lang ?? 'ar'] as Record<keyof typeof messages.en, string>;
    return (
      <div className="adm-card" role="alert" style={{ maxWidth: 560, margin: '48px auto', textAlign: 'center' }}>
        <div className="adm-card-title" style={{ marginBottom: 8 }}>
          {chunk ? m.updatedTitle : m.errorTitle}
        </div>
        <p className="adm-text-muted" style={{ marginBottom: 20 }}>
          {chunk ? m.updatedText : error.message || m.errorText}
        </p>
        <button type="button" className="adm-btn adm-btn-primary" onClick={() => window.location.reload()}>
          {m.reload}
        </button>
      </div>
    );
  }
}
