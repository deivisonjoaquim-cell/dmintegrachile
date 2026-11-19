import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { reportAppError, translateAppError } from '../services/errorService';

interface State {
  hasError: boolean;
  title: string;
  message: string;
  actionHint?: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      title: 'Algo precisa de atenção',
      message: '',
    };
  }

  static getDerivedStateFromError(error: Error): State {
    const translated = translateAppError(error, { source: 'ErrorBoundary' });
    return {
      hasError: true,
      title: translated.title || 'Algo precisa de atenção',
      message: translated.message || 'Ocorreu um erro inesperado na interface.',
      actionHint: translated.actionHint,
    };
  }

  componentDidCatch(error: Error): void {
    reportAppError(error, { source: 'ErrorBoundary', silent: true });
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      title: 'Algo precisa de atenção',
      message: '',
      actionHint: undefined,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-bg)]">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-[#C82333] mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">{this.state.title}</h1>
            <p className="text-sm text-slate-600 mb-2 break-words">{this.state.message}</p>
            {this.state.actionHint && (
              <p className="text-xs text-slate-500 mb-6">{this.state.actionHint}</p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-slate-800 border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Tentar novamente
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:opacity-95 transition-opacity"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar página
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
