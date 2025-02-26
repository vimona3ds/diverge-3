import { ErrorHandler, ErrorSeverity, ErrorInfo, wrapAsync } from '../../../../src/core/utils/ErrorHandler';

// Mock PromiseRejectionEvent since it doesn't exist in Jest environment
class MockPromiseRejectionEvent {
  type: string;
  promise: Promise<any>;
  reason: any;
  defaultPrevented: boolean = false;

  constructor(type: string, init: { promise: Promise<any>, reason: any }) {
    this.type = type;
    this.promise = init.promise;
    this.reason = init.reason;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }
}

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  
  beforeEach(() => {
    // Clear the singleton instance before each test
    (ErrorHandler as any).instance = undefined;
    errorHandler = ErrorHandler.getInstance();
    
    // Reset the mocked console methods before each test
    // but don't restore the original implementation
    (console.info as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    (console.error as jest.Mock).mockClear();
    
    // Clear errors before each test
    errorHandler.clearErrors();
  });
  
  afterEach(() => {
    // We don't need to restore mocks since we're using the global mocks
  });
  
  describe('getInstance', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = ErrorHandler.getInstance();
      const instance2 = ErrorHandler.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
  
  describe('error reporting', () => {
    it('should report errors with correct severity', () => {
      // Test INFO severity
      const infoError = errorHandler.report('Info message', 'Test', ErrorSeverity.INFO);
      expect(infoError.severity).toBe(ErrorSeverity.INFO);
      expect(console.info).toHaveBeenCalled();
      
      // Test WARNING severity
      const warnError = errorHandler.report('Warning message', 'Test', ErrorSeverity.WARNING);
      expect(warnError.severity).toBe(ErrorSeverity.WARNING);
      expect(console.warn).toHaveBeenCalled();
      
      // Test ERROR severity
      const errorErr = errorHandler.report('Error message', 'Test', ErrorSeverity.ERROR);
      expect(errorErr.severity).toBe(ErrorSeverity.ERROR);
      expect(console.error).toHaveBeenCalled();
      
      // Test FATAL severity
      const fatalError = errorHandler.report('Fatal message', 'Test', ErrorSeverity.FATAL);
      expect(fatalError.severity).toBe(ErrorSeverity.FATAL);
      expect(console.error).toHaveBeenCalled();
    });
    
    it('should store reported errors', () => {
      errorHandler.report('Test message', 'Test');
      const errors = errorHandler.getErrors();
      
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Test message');
      expect(errors[0].source).toBe('Test');
    });
    
    it('should include timestamp and mark errors as unhandled by default', () => {
      const error = errorHandler.report('Test message', 'Test');
      
      expect(error.timestamp).toBeDefined();
      expect(error.handled).toBe(false);
    });
    
    it('should include additional details and data when provided', () => {
      const details = 'Error details';
      const data = { foo: 'bar' };
      
      const error = errorHandler.report('Test message', 'Test', ErrorSeverity.ERROR, details, data);
      
      expect(error.details).toBe(details);
      expect(error.data).toBe(data);
    });
  });
  
  describe('error listeners', () => {
    it('should notify listeners when an error is reported', () => {
      const listener = jest.fn();
      errorHandler.addListener(listener);
      
      const error = errorHandler.report('Test message', 'Test');
      
      expect(listener).toHaveBeenCalledWith(error);
    });
    
    it('should allow removing listeners', () => {
      const listener = jest.fn();
      const removeListener = errorHandler.addListener(listener);
      
      // Remove the listener
      removeListener();
      
      // Report an error
      errorHandler.report('Test message', 'Test');
      
      // Listener should not be called
      expect(listener).not.toHaveBeenCalled();
    });
    
    it('should continue notifying other listeners if one throws', () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const validListener = jest.fn();
      
      errorHandler.addListener(errorListener);
      errorHandler.addListener(validListener);
      
      // This should not throw
      errorHandler.report('Test message', 'Test');
      
      // The second listener should still be called
      expect(validListener).toHaveBeenCalled();
    });
  });
  
  describe('global error handling', () => {
    it('should handle global error events', () => {
      const errorEvent = new ErrorEvent('error', {
        message: 'Test error',
        filename: 'test.js',
        lineno: 10,
        colno: 20,
      });
      
      const preventDefaultSpy = jest.spyOn(errorEvent, 'preventDefault');
      
      errorHandler.handleGlobalError(errorEvent);
      
      // Check if error was reported
      const errors = errorHandler.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Test error');
      expect(errors[0].source).toBe('test.js');
      
      // Check if default handling was prevented
      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });
  
  describe('promise rejection handling', () => {
    it('should handle promise rejection events', () => {
      const reason = new Error('Promise rejected');
      const event = new MockPromiseRejectionEvent('unhandledrejection', {
        promise: Promise.reject(reason).catch(() => {}), // Catch to prevent actual unhandled rejection
        reason: reason
      });
      
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
      
      errorHandler.handlePromiseRejection(event as any);
      
      // Check if error was reported
      const errors = errorHandler.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Promise rejected');
      expect(errors[0].source).toBe('Promise');
      
      // Check if default handling was prevented
      expect(preventDefaultSpy).toHaveBeenCalled();
    });
    
    it('should handle promise rejections with non-Error objects', () => {
      const reason = 'String rejection reason';
      const event = new MockPromiseRejectionEvent('unhandledrejection', {
        promise: Promise.reject(reason).catch(() => {}), // Catch to prevent actual unhandled rejection
        reason: reason
      });
      
      errorHandler.handlePromiseRejection(event as any);
      
      // Check if error was reported
      const errors = errorHandler.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Promise rejected');
      expect(errors[0].details).toBe('String rejection reason');
    });
  });
  
  describe('error management', () => {
    it('should mark errors as handled', () => {
      const error = errorHandler.report('Test message', 'Test');
      
      errorHandler.markAsHandled(error);
      
      expect(error.handled).toBe(true);
    });
    
    it('should clear all errors', () => {
      errorHandler.report('Test message 1', 'Test');
      errorHandler.report('Test message 2', 'Test');
      
      errorHandler.clearErrors();
      
      const errors = errorHandler.getErrors();
      expect(errors.length).toBe(0);
    });
  });
  
  describe('wrapAsync utility', () => {
    it('should return the result of the wrapped function if successful', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const wrapped = wrapAsync(fn, 'Test', 'Operation failed');
      
      const result = await wrapped();
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalled();
    });
    
    it('should report errors and rethrow if the wrapped function fails', async () => {
      const error = new Error('Test error');
      const fn = jest.fn().mockRejectedValue(error);
      const wrapped = wrapAsync(fn, 'Test', 'Operation failed');
      
      await expect(wrapped()).rejects.toThrow('Test error');
      
      // Check if error was reported
      const errors = errorHandler.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Operation failed');
      expect(errors[0].source).toBe('Test');
      expect(errors[0].details).toBe('Test error');
    });
    
    it('should handle non-Error rejections', async () => {
      const fn = jest.fn().mockRejectedValue('string error');
      const wrapped = wrapAsync(fn, 'Test', 'Operation failed');
      
      await expect(wrapped()).rejects.toBe('string error');
      
      // Check if error was reported
      const errors = errorHandler.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].details).toBe('string error');
    });
  });
}); 