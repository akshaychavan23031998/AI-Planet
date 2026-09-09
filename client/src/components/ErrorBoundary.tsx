import { Component } from 'react';
import type { ReactNode } from 'react';
import { ErrorState } from './ui';
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main>
          <ErrorState
            error={null}
            onRetry={() => this.setState({ failed: false })}
          />
          <a href="/">Back to Dashboard</a>
        </main>
      );
    return this.props.children;
  }
}
