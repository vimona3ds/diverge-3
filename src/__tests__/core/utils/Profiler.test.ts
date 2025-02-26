import { Profiler } from '../../../../src/core/utils/Profiler';

describe('Profiler', () => {
  let profiler: Profiler;
  
  beforeEach(() => {
    profiler = Profiler.getInstance();
    profiler.clear();
    profiler.enable();
    
    // Mock performance.now()
    let time = 1000;
    jest.spyOn(performance, 'now').mockImplementation(() => {
      return time++;
    });
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
    profiler.disable();
  });
  
  describe('mark creation and measurement', () => {
    it('should create and complete marks correctly', () => {
      profiler.start('test-mark');
      const mark = profiler.end('test-mark');
      
      expect(mark).toBeDefined();
      expect(mark?.name).toBe('test-mark');
      expect(mark?.startTime).toBe(1000);
      expect(mark?.endTime).toBe(1001);
      expect(mark?.duration).toBe(1);
    });
    
    it('should support nested marks with parent references', () => {
      profiler.start('parent-mark');
      profiler.start('child-mark');
      const childMark = profiler.end('child-mark');
      const parentMark = profiler.end('parent-mark');
      
      expect(childMark?.name).toBe('child-mark');
      expect(childMark?.startTime).toBe(1001);
      expect(childMark?.endTime).toBe(1002);
      expect(childMark?.duration).toBe(1);
      expect(childMark?.parent).toBe('parent-mark');
      
      expect(parentMark?.name).toBe('parent-mark');
      expect(parentMark?.startTime).toBe(1000);
      expect(parentMark?.endTime).toBe(1003);
      expect(parentMark?.duration).toBe(3);
      expect(parentMark?.parent).toBeUndefined();
    });
    
    it('should calculate self time correctly', () => {
      profiler.start('parent-mark');
      profiler.start('child1');
      profiler.end('child1');
      profiler.start('child2');
      profiler.end('child2');
      const parentMark = profiler.end('parent-mark');
      
      expect(parentMark?.duration).toBe(5); // Total time
      expect(parentMark?.selfTime).toBe(3); // Total - children time
    });
  });
  
  describe('active mark tracking', () => {
    it('should track active marks and provide duration estimate', () => {
      profiler.start('mark1');
      profiler.start('mark2');
      
      const activeMarks = profiler.getActiveMarks();
      expect(activeMarks.length).toBe(2);
      
      // First mark
      expect(activeMarks[0].name).toBe('mark1');
      expect(activeMarks[0].startTime).toBe(1000);
      expect(activeMarks[0].duration).toBe(2); // Current time (1002) - start time (1000)
      
      // Second mark
      expect(activeMarks[1].name).toBe('mark2');
      expect(activeMarks[1].startTime).toBe(1001);
      expect(activeMarks[1].duration).toBe(1); // Current time (1002) - start time (1001)
    });
    
    it('should warn when ending marks out of order', () => {
      const consoleSpy = jest.spyOn(console, 'warn');
      
      profiler.start('mark1');
      profiler.start('mark2');
      profiler.end('mark1'); // Out of order
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Ending mark "mark1" but it\'s not the current mark. This may indicate overlapping marks.'
      );
    });
  });
  
  describe('summary statistics', () => {
    it('should generate correct summary statistics', () => {
      // First run
      profiler.start('mark1');
      profiler.end('mark1');
      
      // Second run
      profiler.start('mark1');
      profiler.end('mark1');
      
      // Different mark
      profiler.start('mark2');
      profiler.end('mark2');
      
      const summary = profiler.getSummary();
      
      // Check mark1 statistics
      expect(summary['mark1'].count).toBe(2);
      expect(summary['mark1'].totalTime).toBe(2);
      expect(summary['mark1'].avgTime).toBe(1);
      
      // Check mark2 statistics
      expect(summary['mark2'].count).toBe(1);
      expect(summary['mark2'].totalTime).toBe(1);
      expect(summary['mark2'].avgTime).toBe(1);
    });
    
    it('should handle marks without duration in summary', () => {
      profiler.start('incomplete-mark');
      profiler.start('complete-mark');
      profiler.end('complete-mark');
      
      const summary = profiler.getSummary();
      
      // The complete mark should be in the summary
      expect(summary['complete-mark']).toBeDefined();
      expect(summary['complete-mark'].count).toBe(1);
      expect(summary['complete-mark'].totalTime).toBe(1);
      
      // The incomplete mark should not affect the summary
      expect(summary['incomplete-mark']).toBeUndefined();
    });
  });
}); 