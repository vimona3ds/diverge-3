// Add a declaration for performance.memory
declare global {
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
    };
  }
}

export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private gcTriggerLevel: number = 0.8; // 80% of max memory
  private disposed: boolean = false;
  private checkIntervalId: number | null = null;
  private listeners: Array<() => void> = [];
  
  private constructor() {
    // Start monitoring if supported
    if (window.performance && window.performance.memory) {
      this.startMonitoring();
    }
  }
  
  public static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }
  
  public addListener(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  public getMemoryInfo(): { current: number, max: number, percent: number } | null {
    if (!window.performance || !window.performance.memory) {
      return null;
    }
    
    const memory = window.performance.memory;
    return {
      current: memory.usedJSHeapSize,
      max: memory.jsHeapSizeLimit,
      percent: memory.usedJSHeapSize / memory.jsHeapSizeLimit
    };
  }
  
  private startMonitoring(): void {
    this.checkIntervalId = window.setInterval(() => {
      this.checkMemory();
    }, 10000); // Check every 10 seconds
  }
  
  private checkMemory(): void {
    if (this.disposed) return;
    
    const memory = this.getMemoryInfo();
    if (!memory) return;
    
    if (memory.percent > this.gcTriggerLevel) {
      console.warn(`Memory usage high: ${Math.round(memory.percent * 100)}%`);
      
      // Notify listeners of high memory usage
      this.notifyListeners();
    }
  }
  
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in memory listener:', error);
      }
    });
  }
  
  public dispose(): void {
    if (this.checkIntervalId !== null) {
      window.clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    this.disposed = true;
    this.listeners = [];
  }
} 