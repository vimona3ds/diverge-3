export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface ErrorStack {
  frames: Array<{
    fileName: string;
    lineNumber: number;
    columnNumber: number;
    functionName?: string;
  }>;
  raw: string;
}

export interface ErrorInfo {
  id: string;
  message: string;
  details?: string;
  severity: ErrorSeverity;
  timestamp: number;
  source: string;
  handled: boolean;
  stack?: ErrorStack;
  data?: unknown;
  relatedErrors?: string[];
}

export type ErrorListener = (error: ErrorInfo) => void | Promise<void>;

/**
 * Singleton error handler for managing and reporting errors across the application
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errors: Map<string, ErrorInfo> = new Map();
  private errorListeners: Set<ErrorListener> = new Set();
  private readonly maxErrors: number = 1000;
  
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
   * Parse an error stack trace into a structured format
   * @param stack The stack trace string
   * @returns Parsed stack trace
   */
  private parseStack(stack: string): ErrorStack {
    const lines = stack.split('\n').map(line => line.trim());
    const frames = lines
      .filter(line => line.startsWith('at '))
      .map(line => {
        const match = line.match(/at (?:(.+?)\s+)?\(?(.+):(\d+):(\d+)\)?/);
        if (!match) return null;
        
        const [, fnName, fileName, lineStr, colStr] = match;
        return {
          fileName: fileName || 'unknown',
          lineNumber: parseInt(lineStr, 10) || 0,
          columnNumber: parseInt(colStr, 10) || 0,
          functionName: fnName || undefined
        };
      })
      .filter((frame): frame is NonNullable<typeof frame> => frame !== null);
    
    return {
      frames,
      raw: stack
    };
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
    data?: unknown
  ): ErrorInfo {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const error: ErrorInfo = {
      id,
      message,
      details,
      severity,
      timestamp: Date.now(),
      source,
      handled: false,
      data
    };
    
    // Parse stack trace if available
    if (data instanceof Error && typeof data.stack === 'string') {
      try {
        error.stack = this.parseStack(data.stack);
      } catch {
        // Ignore parsing errors
      }
    }
    
    // Store error
    this.errors.set(id, error);
    
    // Trim old errors if needed
    if (this.errors.size > this.maxErrors) {
      const oldestKey = this.errors.keys().next().value;
      this.errors.delete(oldestKey);
    }
    
    // Notify listeners
    void this.notifyListeners(error);
    
    // Log to console based on severity
    const consoleArgs = [
      `[${source}] ${message}`,
      details || ''
    ];
    
    if (error.stack?.raw) {
      consoleArgs.push(`\n${error.stack.raw}`);
    }
    
    switch (severity) {
      case ErrorSeverity.INFO:
        console.info(...consoleArgs);
        break;
      case ErrorSeverity.WARNING:
        console.warn(...consoleArgs);
        break;
      case ErrorSeverity.ERROR:
      case ErrorSeverity.FATAL:
        console.error(...consoleArgs);
        break;
    }
    
    return error;
  }
  
  /**
   * Handle a promise rejection event
   * @param event The promise rejection event
   */
  public handlePromiseRejection(event: PromiseRejectionEvent): void {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : 'Promise rejected';
    const details = reason instanceof Error ? reason.stack : String(reason);
    
    const error = this.report(
      message,
      'Promise',
      ErrorSeverity.ERROR,
      details,
      reason
    );
    
    // Link related errors if available
    if (reason instanceof Error && reason.cause) {
      const cause = reason.cause;
      if (cause instanceof Error) {
        const causeError = this.report(
          cause.message,
          'Promise',
          ErrorSeverity.ERROR,
          cause.stack,
          cause
        );
        error.relatedErrors = [causeError.id];
      }
    }
    
    // Prevent default handling
    event.preventDefault();
  }
  
  /**
   * Handle a global error event
   * @param event The ErrorEvent
   */
  public handleGlobalError(event: ErrorEvent): void {
    const error = event.error;
    const message = error?.message || event.message || 'Unknown error';
    const details = error?.stack || `Line: ${event.lineno}, Col: ${event.colno}`;
    
    this.report(
      message,
      event.filename || 'global',
      ErrorSeverity.ERROR,
      details,
      error
    );
    
    // Prevent default handling
    event.preventDefault();
  }
  
  /**
   * Get all errors
   * @returns Array of all error infos
   */
  public getErrors(): ErrorInfo[] {
    return Array.from(this.errors.values());
  }
  
  /**
   * Get a specific error by ID
   * @param id The error ID
   * @returns The error info or undefined if not found
   */
  public getError(id: string): ErrorInfo | undefined {
    return this.errors.get(id);
  }
  
  /**
   * Add a listener for errors
   * @param listener The listener function
   * @returns A function to remove the listener
   */
  public addListener(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }
  
  /**
   * Notify all listeners of an error
   * @param error The error info to notify about
   */
  private async notifyListeners(error: ErrorInfo): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const listener of this.errorListeners) {
      try {
        const result = listener(error);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (e) {
        console.error('Error in error listener:', e);
      }
    }
    
    // Wait for all async listeners
    await Promise.all(promises);
  }
  
  /**
   * Mark an error as handled
   * @param errorOrId The error or error ID to mark as handled
   */
  public markAsHandled(errorOrId: ErrorInfo | string): void {
    const error = typeof errorOrId === 'string' ? 
      this.errors.get(errorOrId) : 
      errorOrId;
    
    if (error) {
      error.handled = true;
    }
  }
  
  /**
   * Clear all errors
   */
  public clearErrors(): void {
    this.errors.clear();
  }
}

/**
 * Utility function to wrap async functions with error handling
 * @param fn The function to wrap
 * @param source The source name for error reporting
 * @param errorMsg The error message to use
 * @returns The wrapped function
 */
export function wrapAsync<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  source: string,
  errorMsg = 'Operation failed'
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
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