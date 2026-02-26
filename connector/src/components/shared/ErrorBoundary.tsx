import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {}

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="panel mx-auto mt-20 max-w-xl p-8 text-center">
          <h2 className="mb-2 text-2xl">Something broke.</h2>
          <p className="text-[var(--ink-soft)]">{this.state.message}</p>
          <button
            className="mt-5 rounded-lg bg-[var(--ink)] px-4 py-2 text-white"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
