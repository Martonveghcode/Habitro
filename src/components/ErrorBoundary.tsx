import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      message: "",
    };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message,
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("UI crash captured by ErrorBoundary", error, info);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="centered-shell">
          <h1 className="title">Error en la interfaz</h1>
          <p className="error-text">{this.state.message || "Se produjo un error inesperado."}</p>
          <p className="muted">Recarga la pagina. Si continua, revisa la consola y comparte el primer error.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
