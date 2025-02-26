import { Profiler, ProfilerMark } from '../../../../src/core/utils/Profiler';

describe('Profiler', () => {
  let profiler: Profiler;
  
  beforeEach(() => {
    // Clear the singleton instance before each test
    (Profiler as any).instance = undefined;
    
    // Mock performance.now
    jest.spyOn(performance, 'now')
      .mockImplementationOnce(() => 1000)   // First call (start)
      .mockImplementationOnce(() => 1100);  // Second call (end) - 100ms later
    
    // Create the instance
    profiler = Profiler.getInstance();
    
    // Enable profiling
    profiler.enable();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
    profiler.disable();
  });
  
  describe('getInstance', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = Profiler.getInstance();
      const instance2 = Profiler.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
  
  describe('enable and disable', () => {
    it('should not record marks when disabled', () => {
      // Disable profiling
      profiler.disable();
      
      // Try to start and end a mark
      profiler.start('test-mark');
      profiler.end('test-mark');
      
      // Should not have recorded anything
      const history = profiler.getHistory();
      expect(history.length).toBe(0);
    });
    
    it('should clear existing marks when disabled', () => {
      // Record a mark
      profiler.start('test-mark');
      profiler.end('test-mark');
      
      // Verify we have a mark
      let history = profiler.getHistory();
      expect(history.length).toBe(1);
      
      // Disable profiling
      profiler.disable();
      
      // History should be cleared
      history = profiler.getHistory();
      expect(history.length).toBe(0);
    });
    
    it('should allow recording marks when enabled again', () => {
      // Disable profiling
      profiler.disable();
      
      // Enable profiling again
      profiler.enable();
      
      // Record a mark
      profiler.start('test-mark');
      profiler.end('test-mark');
      
      // Should have recorded the mark
      const history = profiler.getHistory();
      expect(history.length).toBe(1);
    });
  });
  
  describe('mark creation and measurement', () => {
    it('should create marks and measure duration correctly', () => {
      profiler.start('test-mark');
      const mark = profiler.end('test-mark');
      
      expect(mark).not.toBeNull();
      expect(mark?.name).toBe('test-mark');
      expect(mark?.startTime).toBe(1000);
      expect(mark?.endTime).toBe(1100);
      expect(mark?.duration).toBe(100);
    });
    
    it('should return null when ending a non-existent mark', () => {
      const result = profiler.end('non-existent-mark');
      expect(result).toBeNull();
    });
    
    it('should support nested marks with parent references', () => {
      // Reset mocks to provide sequential timestamps
      jest.spyOn(performance, 'now')
        .mockImplementationOnce(() => 1000)  // parent start
        .mockImplementationOnce(() => 1050)  // child start
        .mockImplementationOnce(() => 1150)  // child end
        .mockImplementationOnce(() => 1200); // parent end
      
      // Start parent mark
      profiler.start('parent-mark');
      
      // Start child mark with parent reference
      profiler.start('child-mark', 'parent-mark');
      
      // End child mark
      const childMark = profiler.end('child-mark');
      
      // End parent mark
      const parentMark = profiler.end('parent-mark');
      
      // Check parent mark
      expect(parentMark?.name).toBe('parent-mark');
      expect(parentMark?.startTime).toBe(1000);
      expect(parentMark?.endTime).toBe(1200);
      expect(parentMark?.duration).toBe(200);
      expect(parentMark?.parent).toBeUndefined();
      
      // Check child mark
      expect(childMark?.name).toBe('child-mark');
      expect(childMark?.startTime).toBe(1050);
      expect(childMark?.endTime).toBe(1150);
      expect(childMark?.duration).toBe(100);
      expect(childMark?.parent).toBe('parent-mark');
    });
  });
  
  describe('active mark tracking', () => {
    it('should track active marks and provide duration estimate', () => {
      // Mock performance.now to return incremental times
      jest.spyOn(performance, 'now')
        .mockReturnValueOnce(1000)    // start time for mark1
        .mockReturnValueOnce(1050)    // start time for mark2
        .mockReturnValueOnce(1200);   // current time when getting active marks
      
      profiler.start('mark1');
      profiler.start('mark2');
      
      const activeMarks = profiler.getActiveMarks();
      
      expect(activeMarks.length).toBe(2);
      
      // First mark
      expect(activeMarks[0].name).toBe('mark1');
      expect(activeMarks[0].startTime).toBe(1000);
      expect(activeMarks[0].duration).toBe(200); // 1200 - 1000
      
      // Second mark
      expect(activeMarks[1].name).toBe('mark2');
      expect(activeMarks[1].startTime).toBe(1050);
      expect(activeMarks[1].duration).toBe(150); // 1200 - 1050
    });
    
    it('should remove marks from active list when ended', () => {
      // Mock performance.now
      jest.spyOn(performance, 'now')
        .mockReturnValueOnce(1000)  // start time for mark1
        .mockReturnValueOnce(1050)  // start time for mark2
        .mockReturnValueOnce(1100)  // end time for mark1
        .mockReturnValueOnce(1200); // current time when getting active marks
      
      profiler.start('mark1');
      profiler.start('mark2');
      
      // End the first mark
      profiler.end('mark1');
      
      const activeMarks = profiler.getActiveMarks();
      
      // Only the second mark should be active
      expect(activeMarks.length).toBe(1);
      expect(activeMarks[0].name).toBe('mark2');
    });
  });
  
  describe('history management', () => {
    it('should add completed marks to history', () => {
      profiler.start('mark1');
      profiler.end('mark1');
      
      const history = profiler.getHistory();
      
      expect(history.length).toBe(1);
      expect(history[0].name).toBe('mark1');
    });
    
    it('should limit history to the configured maximum size', () => {
      // Set a small history limit for testing
      (profiler as any).historyLimit = 2;
      
      // Create 3 marks (one more than the limit)
      for (let i = 0; i < 3; i++) {
        jest.spyOn(performance, 'now')
          .mockReturnValueOnce(1000 + i * 100)  // start time
          .mockReturnValueOnce(1050 + i * 100); // end time
        
        profiler.start(`mark${i}`);
        profiler.end(`mark${i}`);
      }
      
      const history = profiler.getHistory();
      
      // Should only keep the most recent 2 marks
      expect(history.length).toBe(2);
      expect(history[0].name).toBe('mark1');
      expect(history[1].name).toBe('mark2');
    });
    
    it('should clear history when requested', () => {
      profiler.start('mark1');
      profiler.end('mark1');
      
      profiler.clear();
      
      const history = profiler.getHistory();
      expect(history.length).toBe(0);
    });
  });
  
  describe('summary statistics', () => {
    it('should generate correct summary statistics', () => {
      // Create marks with different durations
      jest.spyOn(performance, 'now')
        .mockReturnValueOnce(1000)  // start mark1
        .mockReturnValueOnce(1100)  // end mark1 (duration 100)
        .mockReturnValueOnce(1200)  // start mark2
        .mockReturnValueOnce(1350)  // end mark2 (duration 150)
        .mockReturnValueOnce(1400)  // start mark1 again
        .mockReturnValueOnce(1550); // end mark1 again (duration 150)
      
      // First mark1 (duration 100)
      profiler.start('mark1');
      profiler.end('mark1');
      
      // mark2 (duration 150)
      profiler.start('mark2');
      profiler.end('mark2');
      
      // Second mark1 (duration 150)
      profiler.start('mark1');
      profiler.end('mark1');
      
      const summary = profiler.getSummary();
      
      // Check mark1 statistics
      expect(summary['mark1'].count).toBe(2);
      expect(summary['mark1'].totalTime).toBe(250); // 100 + 150
      expect(summary['mark1'].avgTime).toBe(125); // (100 + 150) / 2
      
      // Check mark2 statistics
      expect(summary['mark2'].count).toBe(1);
      expect(summary['mark2'].totalTime).toBe(150);
      expect(summary['mark2'].avgTime).toBe(150);
    });
    
    it('should handle marks without duration in summary', () => {
      // Create a mark without ending it
      jest.spyOn(performance, 'now').mockReturnValue(1000);
      profiler.start('incomplete-mark');
      
      // Create a completed mark
      jest.spyOn(performance, 'now')
        .mockReturnValueOnce(1100)  // start
        .mockReturnValueOnce(1200); // end
      profiler.start('complete-mark');
      profiler.end('complete-mark');
      
      const summary = profiler.getSummary();
      
      // The incomplete mark should not be in the summary
      expect(summary['incomplete-mark']).toBeUndefined();
      
      // The complete mark should be in the summary
      expect(summary['complete-mark']).toBeDefined();
    });
  });
}); 