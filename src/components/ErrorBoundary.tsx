import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { reportAppError, translateAppError } from '../services/errorService';
import { BrandRibbon } from './BrandLogo';

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
          <div className="max-w-lg w-full bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl overflow-hidden text-center shadow-[0_12px_36px_rgba(11,31,51,0.08)] dark:shadow-[0_18px_46px_rgba(0,0,0,0.4)]">
            <BrandRibbon className="h-[3px] w-full" />
            <div className="p-8 sm:p-10">
              <div className="mx-auto w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200/80 dark:border-red-800/60 flex items-center justify-center text-[#A61C2B] dark:text-rose-400 mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="brand-kicker mb-1.5">Recuperação Segura</p>
              <h1 className="font-display text-2xl font-bold text-[#0B1F33] dark:text-white mb-2">{this.state.title}</h1>
              <p className="text-sm text-[#4A5A6D] dark:text-slate-300 mb-2 break-words leading-relaxed">{this.state.message}</p>
              {this.state.actionHint && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{this.state.actionHint}</p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                <button
                  type="button"
                  onClick={this.handleRetry}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-[#0B1F33] dark:text-slate-100 border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] hover:bg-[#F1EDE4] dark:hover:bg-[#183350] transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Tentar novamente
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#0B1F33] dark:bg-[#1B4D7A] hover:opacity-95 transition-opacity"
                >
                  <RefreshCw className="w-4 h-4 text-[#E5C76B]" />
                  Recarregar página
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
