import { MemoryMonitor } from '../../../../src/core/utils/MemoryMonitor';

describe('MemoryMonitor', () => {
  let memoryMonitor: MemoryMonitor;
  
  beforeEach(() => {
    // Clear the singleton instance before each test
    (MemoryMonitor as any).instance = undefined;
    
    // Mock window.performance.memory
    Object.defineProperty(window.performance, 'memory', {
      value: {
        usedJSHeapSize: 100,
        jsHeapSizeLimit: 200,
        totalJSHeapSize: 150
      },
      configurable: true
    });
    
    // Mock setInterval
    jest.spyOn(window, 'setInterval').mockImplementation((callback, ms) => {
      return 123 as any; // Return a dummy interval ID
    });
    
    // Mock clearInterval
    jest.spyOn(window, 'clearInterval').mockImplementation((id) => {});
    
    // Create the instance
    memoryMonitor = MemoryMonitor.getInstance();
  });
  
  afterEach(() => {
    // Clean up
    memoryMonitor.dispose();
    jest.restoreAllMocks();
  });
  
  describe('getInstance', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = MemoryMonitor.getInstance();
      const instance2 = MemoryMonitor.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
  
  describe('getMemoryInfo', () => {
    it('should return memory usage information when available', () => {
      const memoryInfo = memoryMonitor.getMemoryInfo();
      
      expect(memoryInfo).not.toBeNull();
      expect(memoryInfo?.current).toBe(100);
      expect(memoryInfo?.max).toBe(200);
      expect(memoryInfo?.percent).toBe(0.5); // 100/200
    });
    
    it('should return null when memory info is not available', () => {
      // Remove memory info
      Object.defineProperty(window.performance, 'memory', {
        value: undefined,
        configurable: true
      });
      
      const memoryInfo = memoryMonitor.getMemoryInfo();
      
      expect(memoryInfo).toBeNull();
    });
  });
  
  describe('memory monitoring', () => {
    it('should start monitoring on creation', () => {
      expect(window.setInterval).toHaveBeenCalled();
    });
    
    it('should call listeners when memory usage is high', () => {
      const listener = jest.fn();
      memoryMonitor.addListener(listener);
      
      // Simulate high memory usage
      Object.defineProperty(window.performance, 'memory', {
        value: {
          usedJSHeapSize: 180, // 90% of limit
          jsHeapSizeLimit: 200,
          totalJSHeapSize: 190
        },
        configurable: true
      });
      
      // Manually trigger memory check
      (memoryMonitor as any).checkMemory();
      
      expect(listener).toHaveBeenCalled();
    });
    
    it('should not call listeners when memory usage is normal', () => {
      const listener = jest.fn();
      memoryMonitor.addListener(listener);
      
      // Normal memory usage (50%)
      Object.defineProperty(window.performance, 'memory', {
        value: {
          usedJSHeapSize: 100,
          jsHeapSizeLimit: 200,
          totalJSHeapSize: 150
        },
        configurable: true
      });
      
      // Manually trigger memory check
      (memoryMonitor as any).checkMemory();
      
      expect(listener).not.toHaveBeenCalled();
    });
    
    it('should continue notifying other listeners if one throws', () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const validListener = jest.fn();
      
      memoryMonitor.addListener(errorListener);
      memoryMonitor.addListener(validListener);
      
      // Simulate high memory usage
      Object.defineProperty(window.performance, 'memory', {
        value: {
          usedJSHeapSize: 180, // 90% of limit
          jsHeapSizeLimit: 200,
          totalJSHeapSize: 190
        },
        configurable: true
      });
      
      // Manually trigger memory check - this should not throw
      (memoryMonitor as any).checkMemory();
      
      // The second listener should still be called
      expect(validListener).toHaveBeenCalled();
    });
  });
  
  describe('listener management', () => {
    it('should allow adding and removing listeners', () => {
      const listener = jest.fn();
      const removeListener = memoryMonitor.addListener(listener);
      
      // Simulate high memory usage
      Object.defineProperty(window.performance, 'memory', {
        value: {
          usedJSHeapSize: 180, // 90% of limit
          jsHeapSizeLimit: 200,
          totalJSHeapSize: 190
        },
        configurable: true
      });
      
      // Trigger check with listener
      (memoryMonitor as any).checkMemory();
      expect(listener).toHaveBeenCalled();
      
      // Remove listener
      removeListener();
      
      // Reset mock
      listener.mockClear();
      
      // Trigger check again
      (memoryMonitor as any).checkMemory();
      
      // Listener should not be called this time
      expect(listener).not.toHaveBeenCalled();
    });
  });
  
  describe('dispose', () => {
    it('should clear the interval and remove all listeners when disposed', () => {
      // Add a listener
      const listener = jest.fn();
      memoryMonitor.addListener(listener);
      
      // Dispose
      memoryMonitor.dispose();
      
      // Should clear the interval
      expect(window.clearInterval).toHaveBeenCalledWith(123);
      
      // Should be marked as disposed
      expect((memoryMonitor as any).disposed).toBe(true);
      
      // Should remove all listeners
      // Simulate high memory usage
      Object.defineProperty(window.performance, 'memory', {
        value: {
          usedJSHeapSize: 180, // 90% of limit
          jsHeapSizeLimit: 200,
          totalJSHeapSize: 190
        },
        configurable: true
      });
      
      // Manually trigger memory check
      (memoryMonitor as any).checkMemory();
      
      // Listener should not be called because monitor is disposed
      expect(listener).not.toHaveBeenCalled();
    });
  });
}); 