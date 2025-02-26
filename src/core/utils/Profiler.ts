export interface ProfilerMark {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  parent?: string;
  children?: string[];
  depth: number;
  selfTime?: number;
}

export interface ProfilerSummary {
  count: number;
  totalTime: number;
  selfTime: number;
  avgTime: number;
  avgSelfTime: number;
  minTime: number;
  maxTime: number;
  lastTime: number;
}

export class Profiler {
  private static instance: Profiler;
  private marks: Map<string, ProfilerMark> = new Map();
  private activeMarks: Set<string> = new Set();
  private history: ProfilerMark[] = [];
  private historyLimit: number = 1000;
  private enabled: boolean = false;
  private markStack: string[] = [];
  
  private constructor() {}
  
  public static getInstance(): Profiler {
    if (!Profiler.instance) {
      Profiler.instance = new Profiler();
    }
    return Profiler.instance;
  }
  
  public enable(): void {
    this.enabled = true;
  }
  
  public disable(): void {
    this.enabled = false;
    this.clear();
  }
  
  /**
   * Start timing a named section of code
   * @param name Unique name for the timing mark
   * @param parent Optional parent mark name (if not specified, uses current mark)
   */
  public start(name: string, parent?: string): void {
    if (!this.enabled) return;
    
    // Get parent from stack if not specified
    const currentParent = parent || (this.markStack.length > 0 ? this.markStack[this.markStack.length - 1] : undefined);
    
    const mark: ProfilerMark = {
      name,
      startTime: performance.now(),
      parent: currentParent,
      children: [],
      depth: this.markStack.length
    };
    
    // Add as child to parent mark
    if (currentParent) {
      const parentMark = this.marks.get(currentParent);
      if (parentMark) {
        parentMark.children = parentMark.children || [];
        parentMark.children.push(name);
      }
    }
    
    this.marks.set(name, mark);
    this.activeMarks.add(name);
    this.markStack.push(name);
  }
  
  /**
   * End timing for a named section
   * @param name Name of the mark to end
   * @returns The completed mark or null if not found
   */
  public end(name: string): ProfilerMark | null {
    if (!this.enabled) return null;
    
    const mark = this.marks.get(name);
    if (!mark) {
      console.warn(`No mark found with name: ${name}`);
      return null;
    }
    
    // Verify this is the current mark
    if (this.markStack[this.markStack.length - 1] !== name) {
      console.warn(`Ending mark "${name}" but it's not the current mark. This may indicate overlapping marks.`);
    }
    
    mark.endTime = performance.now();
    mark.duration = mark.endTime - mark.startTime;
    
    // Calculate self time (excluding children)
    mark.selfTime = mark.duration;
    if (mark.children) {
      for (const childName of mark.children) {
        const child = this.marks.get(childName);
        if (child && child.duration) {
          mark.selfTime -= child.duration;
        }
      }
    }
    
    this.activeMarks.delete(name);
    this.markStack.pop();
    
    // Add to history
    this.history.push({...mark});
    
    // Trim history if needed
    while (this.history.length > this.historyLimit) {
      this.history.shift();
    }
    
    return mark;
  }
  
  /**
   * Get currently active timing marks with estimated durations
   */
  public getActiveMarks(): ProfilerMark[] {
    const now = performance.now();
    return Array.from(this.activeMarks).map(name => {
      const mark = this.marks.get(name)!;
      const duration = now - mark.startTime;
      
      // Estimate self time by subtracting active children
      let childTime = 0;
      if (mark.children) {
        for (const childName of mark.children) {
          if (this.activeMarks.has(childName)) {
            const child = this.marks.get(childName)!;
            childTime += now - child.startTime;
          }
        }
      }
      
      return {
        ...mark,
        duration,
        selfTime: duration - childTime
      };
    });
  }
  
  /**
   * Get the history of completed marks
   */
  public getHistory(): ProfilerMark[] {
    return [...this.history];
  }
  
  /**
   * Get statistical summary of all marks
   */
  public getSummary(): Record<string, ProfilerSummary> {
    const summary: Record<string, ProfilerSummary> = {};
    
    for (const mark of this.history) {
      if (!mark.duration || !mark.selfTime) continue;
      
      if (!summary[mark.name]) {
        summary[mark.name] = {
          count: 0,
          totalTime: 0,
          selfTime: 0,
          avgTime: 0,
          avgSelfTime: 0,
          minTime: Infinity,
          maxTime: -Infinity,
          lastTime: 0
        };
      }
      
      const stats = summary[mark.name];
      stats.count++;
      stats.totalTime += mark.duration;
      stats.selfTime += mark.selfTime;
      stats.minTime = Math.min(stats.minTime, mark.duration);
      stats.maxTime = Math.max(stats.maxTime, mark.duration);
      stats.lastTime = mark.duration;
    }
    
    // Calculate averages
    for (const name in summary) {
      const stats = summary[name];
      stats.avgTime = stats.totalTime / stats.count;
      stats.avgSelfTime = stats.selfTime / stats.count;
    }
    
    return summary;
  }
  
  /**
   * Clear all profiling data
   */
  public clear(): void {
    this.marks.clear();
    this.activeMarks.clear();
    this.history = [];
    this.markStack = [];
  }
} 