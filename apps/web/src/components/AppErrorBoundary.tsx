'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { SurfaceErrorPanel } from '@/components/surface/SurfaceErrorPanel';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

/** REL-01 — app-shell crash recovery UI. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Unexpected application error',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('AppErrorBoundary', error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, message: '' });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="container" style={{ padding: '4rem 1rem' }}>
          <div className="card" style={{ padding: '2rem' }}>
            <SurfaceErrorPanel
              title="Application error"
              message={this.state.message}
              onRetry={this.handleRetry}
              retryLabel="Try again"
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
