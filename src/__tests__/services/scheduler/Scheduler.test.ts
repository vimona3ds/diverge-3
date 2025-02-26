import { Scheduler } from '../../../../src/services/scheduler/Scheduler';

describe('Scheduler', () => {
  let scheduler: Scheduler;
  
  beforeEach(() => {
    // Mock requestAnimationFrame and cancelAnimationFrame
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      return 123 as any; // Return a dummy ID
    });
    
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {});
    
    // Mock performance.now
    jest.spyOn(performance, 'now').mockReturnValue(1000);
    
    scheduler = new Scheduler();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('initialization', () => {
    it('should create a scheduler with default settings', () => {
      expect(scheduler).toBeDefined();
      expect((scheduler as any).running).toBe(false);
      expect((scheduler as any).fpsLimit).toBe(60);
      expect((scheduler as any).interval).toBe(1000 / 60);
    });
  });
  
  describe('callback handling', () => {
    it('should set and call the callback function', () => {
      const mockCallback = jest.fn();
      scheduler.setCallback(mockCallback);
      
      // Manually trigger the update loop
      (scheduler as any).updateLoop(1000);
      
      expect(mockCallback).toHaveBeenCalledWith(1000);
    });
    
    it('should not throw if no callback is set', () => {
      // Should not throw when no callback is set
      expect(() => {
        (scheduler as any).updateLoop(1000);
      }).not.toThrow();
    });
  });
  
  describe('start and stop', () => {
    it('should start the animation loop', () => {
      scheduler.start();
      
      expect((scheduler as any).running).toBe(true);
      expect(window.requestAnimationFrame).toHaveBeenCalled();
    });
    
    it('should not start again if already running', () => {
      scheduler.start();
      
      // Clear mock
      (window.requestAnimationFrame as jest.Mock).mockClear();
      
      // Try to start again
      scheduler.start();
      
      // Should not call requestAnimationFrame again
      expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    });
    
    it('should stop the animation loop', () => {
      // Start first
      scheduler.start();
      (scheduler as any).frameId = 123;
      
      // Then stop
      scheduler.stop();
      
      expect((scheduler as any).running).toBe(false);
      expect(window.cancelAnimationFrame).toHaveBeenCalledWith(123);
    });
    
    it('should not call cancelAnimationFrame if not running', () => {
      // Stop without starting
      scheduler.stop();
      
      expect(window.cancelAnimationFrame).not.toHaveBeenCalled();
    });
  });
  
  describe('FPS limiting', () => {
    it('should set the FPS limit', () => {
      scheduler.setFPSLimit(30);
      
      expect((scheduler as any).fpsLimit).toBe(30);
      expect((scheduler as any).interval).toBe(1000 / 30);
    });
    
    it('should enforce FPS limits within reasonable bounds', () => {
      // Test lower bound
      scheduler.setFPSLimit(0);
      expect((scheduler as any).fpsLimit).toBe(1); // Should clamp to 1
      
      // Test upper bound
      scheduler.setFPSLimit(1000);
      expect((scheduler as any).fpsLimit).toBe(120); // Should clamp to 120
    });
    
    it('should skip frames when needed to maintain FPS limit', () => {
      const mockCallback = jest.fn();
      scheduler.setCallback(mockCallback);
      scheduler.setFPSLimit(30); // 33.33ms between frames
      
      // First call - sets lastTime
      (scheduler as any).updateLoop(1000);
      expect(mockCallback).toHaveBeenCalledTimes(1);
      
      mockCallback.mockClear();
      
      // Second call too soon (only 16ms later) - should not call callback
      (scheduler as any).updateLoop(1016);
      expect(mockCallback).not.toHaveBeenCalled();
      
      mockCallback.mockClear();
      
      // Third call after interval (34ms later) - should call callback
      (scheduler as any).updateLoop(1034);
      expect(mockCallback).toHaveBeenCalled();
    });
  });
  
  describe('FPS calculation', () => {
    it('should calculate the current FPS', () => {
      // Mock performance.now to return different times for timestamps
      jest.spyOn(performance, 'now')
        .mockReturnValueOnce(0)     // First call
        .mockReturnValueOnce(100)   // Second call
        .mockReturnValueOnce(200)   // Third call
        .mockReturnValueOnce(300)   // Fourth call
        .mockReturnValueOnce(400)   // Fifth call
        .mockReturnValueOnce(1100); // Final call - 1.1s later
      
      // Simulate 5 frames in 1.1 seconds
      for (let i = 0; i < 5; i++) {
        (scheduler as any).calculateFPS(performance.now());
      }
      
      // Calculate FPS one more time, but 1.1s from the start
      // Only the last 4 frames should be counted (the first one is more than 1s ago)
      (scheduler as any).calculateFPS(performance.now());
      
      // Should report 4 frames in the last second
      expect(scheduler.getCurrentFPS()).toBe(4);
    });
    
    it('should return the current FPS', () => {
      // Set a known FPS value
      (scheduler as any).currentFPS = 42;
      
      expect(scheduler.getCurrentFPS()).toBe(42);
    });
  });
  
  describe('update loop', () => {
    it('should request the next animation frame', () => {
      (scheduler as any).updateLoop(1000);
      
      expect(window.requestAnimationFrame).toHaveBeenCalledWith(expect.any(Function));
    });
    
    it('should update lastTime correctly', () => {
      // Setup first call
      (scheduler as any).updateLoop(1000);
      expect((scheduler as any).lastTime).toBe(1000);
      
      // Second call with enough time elapsed
      (scheduler as any).updateLoop(1100); // 100ms later
      
      // lastTime should be updated: 1100 - (100 % (1000/60)) = 1100 - (100 % 16.67) = 1100 - 16.67 = 1083.33...
      // But we'll be less precise in our test due to floating point
      expect((scheduler as any).lastTime).toBeGreaterThan(1080);
      expect((scheduler as any).lastTime).toBeLessThan(1090);
    });
  });
  
  describe('integration', () => {
    it('should calculate FPS based on actual frame timing', () => {
      jest.spyOn(performance, 'now')
        .mockReturnValueOnce(1000)  // start
        .mockReturnValueOnce(1100)  // frame 1 - calculateFPS
        .mockReturnValueOnce(1100)  // frame 1 - lastTime check
        .mockReturnValueOnce(1200)  // frame 2 - calculateFPS
        .mockReturnValueOnce(1200)  // frame 2 - lastTime check
        .mockReturnValueOnce(1300)  // frame 3 - calculateFPS
        .mockReturnValueOnce(1300)  // frame 3 - lastTime check
        .mockReturnValueOnce(1400)  // frame 4 - calculateFPS
        .mockReturnValueOnce(1400)  // frame 4 - lastTime check
        .mockReturnValueOnce(1500)  // frame 5 - calculateFPS
        .mockReturnValueOnce(1500)  // frame 5 - lastTime check
        .mockReturnValueOnce(2100); // frame 6 - calculateFPS (1.1s later)
      
      const mockCallback = jest.fn();
      scheduler.setCallback(mockCallback);
      
      // Start scheduler
      scheduler.start();
      
      // Manually trigger the update loop multiple times
      for (let i = 0; i < 5; i++) {
        (scheduler as any).updateLoop(1100 + i * 100);
      }
      
      // Final call 1.1s after the first call
      (scheduler as any).updateLoop(2100);
      
      // We should count only the frames in the last second
      expect(scheduler.getCurrentFPS()).toBe(5);
    });
  });
}); 