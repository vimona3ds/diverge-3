export interface ProfilerMark {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  parent?: string;
}

export class Profiler {
  private static instance: Profiler;
  private marks: Map<string, ProfilerMark> = new Map();
  private activeMarks: Set<string> = new Set();
  private history: ProfilerMark[] = [];
  private historyLimit: number = 1000;
  private enabled: boolean = false;
  
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
  
  public start(name: string, parent?: string): void {
    if (!this.enabled) return;
    
    const mark: ProfilerMark = {
      name,
      startTime: performance.now(),
      parent
    };
    
    this.marks.set(name, mark);
    this.activeMarks.add(name);
  }
  
  public end(name: string): ProfilerMark | null {
    if (!this.enabled) return null;
    
    const mark = this.marks.get(name);
    if (!mark) {
      console.warn(`No mark found with name: ${name}`);
      return null;
    }
    
    mark.endTime = performance.now();
    mark.duration = mark.endTime - mark.startTime;
    
    this.activeMarks.delete(name);
    
    // Add to history
    this.history.push({...mark});
    
    // Trim history if needed
    if (this.history.length > this.historyLimit) {
      this.history = this.history.slice(-this.historyLimit);
    }
    
    return mark;
  }
  
  public getActiveMarks(): ProfilerMark[] {
    return Array.from(this.activeMarks).map(name => {
      const mark = this.marks.get(name)!;
      return {
        ...mark,
        duration: performance.now() - mark.startTime
      };
    });
  }
  
  public getHistory(): ProfilerMark[] {
    return [...this.history];
  }
  
  public getSummary(): Record<string, { count: number, totalTime: number, avgTime: number }> {
    const summary: Record<string, { count: number, totalTime: number, avgTime: number }> = {};
    
    for (const mark of this.history) {
      if (!mark.duration) continue;
      
      if (!summary[mark.name]) {
        summary[mark.name] = {
          count: 0,
          totalTime: 0,
          avgTime: 0
        };
      }
      
      summary[mark.name].count++;
      summary[mark.name].totalTime += mark.duration;
    }
    
    // Calculate averages
    for (const name in summary) {
      summary[name].avgTime = summary[name].totalTime / summary[name].count;
    }
    
    return summary;
  }
  
  public clear(): void {
    this.marks.clear();
    this.activeMarks.clear();
    this.history = [];
  }
} 