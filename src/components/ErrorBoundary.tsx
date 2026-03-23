import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { withTranslation } from 'react-i18next';
import type { WithTranslation } from 'react-i18next';
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

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Error caught by boundary:', error, errorInfo);
    }
    
    this.setState({
      error,
      errorInfo
    });

    // يمكن إرسال الخطأ لخدمة تتبع الأخطاء مثل Sentry
    // logErrorToService(error, errorInfo);
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

      // استخدام fallback مخصص إن وُجد
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // واجهة الخطأ الافتراضية
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

