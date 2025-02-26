import { Scheduler } from '../../../../src/services/scheduler/Scheduler';

describe('Scheduler', () => {
  let scheduler: Scheduler;
  let mockCallback: jest.Mock;
  
  beforeEach(() => {
    jest.useFakeTimers();
    scheduler = new Scheduler();
    mockCallback = jest.fn();
    scheduler.setCallback(mockCallback);
    
    // Mock requestAnimationFrame
    jest.spyOn(window, 'requestAnimationFrame')
      .mockImplementation(cb => {
        setTimeout(() => cb(performance.now()), 16);
        return 1;
      });
  });
  
  afterEach(() => {
    jest.useRealTimers();
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
      (scheduler as any).updateLoop(1000);
      jest.advanceTimersByTime(16);
      
      expect(mockCallback).toHaveBeenCalledWith(1000);
    });
    
    it('should not throw if no callback is set', () => {
      scheduler.setCallback(null);
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
    beforeEach(() => {
      scheduler.setTargetFPS(60);
    });
    
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
      // First call - sets lastTime
      (scheduler as any).updateLoop(1000);
      jest.advanceTimersByTime(16);
      expect(mockCallback).toHaveBeenCalledTimes(1);
      
      mockCallback.mockClear();
      
      // Second call - too soon (8ms later)
      (scheduler as any).updateLoop(1008);
      jest.advanceTimersByTime(8);
      expect(mockCallback).not.toHaveBeenCalled();
      
      // Third call - enough time passed (16ms later)
      (scheduler as any).updateLoop(1016);
      jest.advanceTimersByTime(16);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('FPS calculation', () => {
    it('should calculate FPS based on frame times', () => {
      // Simulate 4 frames over 1 second
      const startTime = performance.now();
      
      for (let i = 0; i < 4; i++) {
        (scheduler as any).updateLoop(startTime + (i * 250));
        jest.advanceTimersByTime(250);
      }
      
      // Should report 4 frames in the last second
      expect(scheduler.getCurrentFPS()).toBe(4);
    });
    
    it('should handle variable frame times', () => {
      const startTime = performance.now();
      
      // Simulate irregular frame times
      [0, 100, 300, 400, 600].forEach(time => {
        (scheduler as any).updateLoop(startTime + time);
        jest.advanceTimersByTime(time);
      });
      
      // Should calculate average FPS over the measured period
      expect(scheduler.getCurrentFPS()).toBeGreaterThan(0);
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
  
  describe('start/stop', () => {
    it('should start and stop the update loop', () => {
      scheduler.start();
      expect((scheduler as any).running).toBe(true);
      expect(window.requestAnimationFrame).toHaveBeenCalled();
      
      scheduler.stop();
      expect((scheduler as any).running).toBe(false);
    });
    
    it('should not start multiple loops', () => {
      scheduler.start();
      const firstRequestId = (scheduler as any).animationFrameId;
      
      scheduler.start();
      expect((scheduler as any).animationFrameId).toBe(firstRequestId);
    });
  });
}); 