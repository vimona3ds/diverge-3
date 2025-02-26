export enum ErrorSeverity {
  INFO,
  WARNING,
  ERROR,
  FATAL
}

export interface ErrorInfo {
  message: string;
  details?: string;
  severity: ErrorSeverity;
  timestamp: number;
  source: string;
  handled: boolean;
  data?: any;
}

/**
 * Singleton error handler for managing and reporting errors across the application
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errors: ErrorInfo[] = [];
  private errorListeners: Array<(error: ErrorInfo) => void> = [];
  
  private constructor() {
    // Install global error handlers
    window.addEventListener('error', this.handleGlobalError.bind(this));
    window.addEventListener('unhandledrejection', this.handlePromiseRejection.bind(this));
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }
  
  /**
   * Report an error to the error handler
   * @param message The error message
   * @param source The source of the error
   * @param severity The severity level
   * @param details Additional error details
   * @param data Any additional data
   * @returns The created error info object
   */
  public report(
    message: string, 
    source: string, 
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    details?: string,
    data?: any
  ): ErrorInfo {
    const error: ErrorInfo = {
      message,
      details,
      severity,
      timestamp: Date.now(),
      source,
      handled: false,
      data
    };
    
    this.errors.push(error);
    this.notifyListeners(error);
    
    // Log to console based on severity
    switch (severity) {
      case ErrorSeverity.INFO:
        console.info(`[${source}] ${message}`, details ? details : '');
        break;
      case ErrorSeverity.WARNING:
        console.warn(`[${source}] ${message}`, details ? details : '');
        break;
      case ErrorSeverity.ERROR:
      case ErrorSeverity.FATAL:
        console.error(`[${source}] ${message}`, details ? details : '');
        break;
    }
    
    return error;
  }
  
  /**
   * Handle a promise rejection event
   * @param event The promise rejection event
   */
  public handlePromiseRejection(event: PromiseRejectionEvent): void {
    const message = event.reason?.message || 'Promise rejected';
    const details = event.reason?.stack || String(event.reason);
    
    this.report(
      message,
      'Promise',
      ErrorSeverity.ERROR,
      details,
      event.reason
    );
    
    // Prevent default handling
    event.preventDefault();
  }
  
  /**
   * Handle a global error event
   * @param event The error event
   */
  public handleGlobalError(event: ErrorEvent): void {
    this.report(
      event.message || 'Unknown error',
      event.filename || 'global',
      ErrorSeverity.ERROR,
      `Line: ${event.lineno}, Col: ${event.colno}\n${event.error?.stack || ''}`,
      event.error
    );
    
    // Prevent default handling
    event.preventDefault();
  }
  
  /**
   * Get all errors
   * @returns Array of all error infos
   */
  public getErrors(): ErrorInfo[] {
    return [...this.errors];
  }
  
  /**
   * Add a listener for errors
   * @param listener The listener function
   * @returns A function to remove the listener
   */
  public addListener(listener: (error: ErrorInfo) => void): () => void {
    this.errorListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.errorListeners = this.errorListeners.filter(l => l !== listener);
    };
  }
  
  /**
   * Notify all listeners of an error
   * @param error The error info to notify about
   */
  private notifyListeners(error: ErrorInfo): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        console.error('Error in error listener:', e);
      }
    });
  }
  
  /**
   * Mark an error as handled
   * @param error The error to mark as handled
   */
  public markAsHandled(error: ErrorInfo): void {
    error.handled = true;
  }
  
  /**
   * Clear all errors
   */
  public clearErrors(): void {
    this.errors = [];
  }
}

/**
 * Utility function to wrap async functions with error handling
 * @param fn The function to wrap
 * @param source The source name for error reporting
 * @param errorMsg The error message to use
 * @returns The wrapped function
 */
export function wrapAsync<T>(
  fn: (...args: any[]) => Promise<T>, 
  source: string,
  errorMsg: string = 'Operation failed'
): (...args: any[]) => Promise<T> {
  return async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      ErrorHandler.getInstance().report(
        errorMsg,
        source,
        ErrorSeverity.ERROR,
        error instanceof Error ? error.message : String(error),
        error
      );
      throw error;
    }
  };
} 