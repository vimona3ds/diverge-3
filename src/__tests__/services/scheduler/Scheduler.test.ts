import { Scheduler } from '../../../services/scheduler/Scheduler';

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
      
    // Mock cancelAnimationFrame
    jest.spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => {});
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
      // Make sure scheduler is running, lastTime is set, and enough time has passed
      (scheduler as any).running = true;
      (scheduler as any).lastTime = 984; // 16ms before 1000
      (scheduler as any).interval = 16; // Ensure the interval check passes
      (scheduler as any).updateLoop(1000);
      
      expect(mockCallback).toHaveBeenCalledWith(1000, 16);
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
      (scheduler as any).animationFrameId = 123;
      
      // Then stop
      scheduler.stop();
      
      expect((scheduler as any).running).toBe(false);
      expect(window.cancelAnimationFrame).toHaveBeenCalledWith(123);
    });
    
    it('should not call cancelAnimationFrame if not running', () => {
      // Mock is already in place from beforeEach
      (window.cancelAnimationFrame as jest.Mock).mockClear();
      
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
      // Make sure scheduler is running
      (scheduler as any).running = true;
      
      // First call - should run because enough time has passed
      (scheduler as any).lastTime = 984; // 16ms before 1000
      (scheduler as any).updateLoop(1000);
      expect(mockCallback).toHaveBeenCalledTimes(1);
      
      mockCallback.mockClear();
      
      // Second call - too soon (8ms later)
      (scheduler as any).updateLoop(1008);
      expect(mockCallback).not.toHaveBeenCalled();
      
      // Third call - enough time passed (16ms later)
      (scheduler as any).updateLoop(1016);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('FPS calculation', () => {
    it('should calculate FPS based on frame times', () => {
      // Manually add frame timestamps
      const now = performance.now();
      (scheduler as any).frameTimestamps = [
        now - 900, now - 700, now - 500, now - 300
      ];
      
      // Should report 4 frames in the last second
      expect(scheduler.getCurrentFPS()).toBe(4);
    });
    
    it('should handle variable frame times', () => {
      // Manually add frame timestamps
      const now = performance.now();
      (scheduler as any).frameTimestamps = [
        now - 900, now - 700, now - 500, now - 300, now - 100
      ];
      
      // Should calculate average FPS over the measured period
      expect(scheduler.getCurrentFPS()).toBeGreaterThan(0);
    });
  });
  
  describe('update loop', () => {
    it('should request the next animation frame', () => {
      (scheduler as any).running = true;
      (scheduler as any).updateLoop(1000);
      
      expect(window.requestAnimationFrame).toHaveBeenCalled();
    });
    
    it('should update lastTime correctly', () => {
      // Setup first call with enough time elapsed
      (scheduler as any).lastTime = 0;
      (scheduler as any).running = true;
      (scheduler as any).updateLoop(1000);
      expect((scheduler as any).lastTime).toBe(1000);
      
      // Second call with enough time elapsed
      (scheduler as any).updateLoop(1100); // 100ms later
      expect((scheduler as any).lastTime).toBe(1100);
    });
  });
  
  describe('integration', () => {
    it('should calculate FPS based on actual frame timing', () => {
      jest.spyOn(performance, 'now')
        .mockReturnValue(2100);
      
      // Set up a specific test scenario with frame timestamps
      (scheduler as any).frameTimestamps = [
        1600, 1700, 1800, 1900, 2000 // 5 frames in last second
      ];
      
      // We should count only the frames in the last second
      expect(scheduler.getCurrentFPS()).toBe(5);
    });
  });
}); 