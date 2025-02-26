/**
 * Scheduler service for managing the animation loop
 * Provides FPS control and a stable update loop
 */
export class Scheduler {
  private callback: ((time: number) => void) | null = null;
  private running: boolean = false;
  private frameId: number | null = null;
  private lastTime: number = 0;
  private fpsLimit: number = 60;
  private interval: number = 1000 / 60; // Default to 60 FPS
  private frameTimestamps: number[] = [];
  private currentFPS: number = 0;
  
  constructor() {
    this.updateLoop = this.updateLoop.bind(this);
  }
  
  /**
   * Set the callback function to call each frame
   * @param callback The function to call each frame
   */
  public setCallback(callback: (time: number) => void): void {
    this.callback = callback;
  }
  
  /**
   * Set the FPS limit for the scheduler
   * @param fps The maximum frames per second
   */
  public setFPSLimit(fps: number): void {
    this.fpsLimit = Math.max(1, Math.min(120, fps));
    this.interval = 1000 / this.fpsLimit;
  }
  
  /**
   * Get the current frames per second
   * @returns The current FPS
   */
  public getCurrentFPS(): number {
    return this.currentFPS;
  }
  
  /**
   * Start the scheduler
   */
  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.updateLoop);
  }
  
  /**
   * Stop the scheduler
   */
  public stop(): void {
    if (!this.running) return;
    this.running = false;
    
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }
  
  /**
   * Calculate the current FPS based on recent frame timestamps
   * @param time Current time
   */
  private calculateFPS(time: number): void {
    // Keep only the last second of timestamps
    const oneSecondAgo = time - 1000;
    this.frameTimestamps.push(time);
    this.frameTimestamps = this.frameTimestamps.filter(t => t >= oneSecondAgo);
    
    // Calculate FPS from number of frames in the last second
    this.currentFPS = this.frameTimestamps.length;
  }
  
  /**
   * The update loop function that gets called each frame
   * @param time Current time in milliseconds
   */
  private updateLoop(time: number): void {
    this.frameId = requestAnimationFrame(this.updateLoop);
    
    // Calculate current FPS
    this.calculateFPS(time);
    
    // Apply FPS limiting
    const elapsed = time - this.lastTime;
    
    if (elapsed < this.interval) {
      return;
    }
    
    // Update time tracking based on FPS limit
    this.lastTime = time - (elapsed % this.interval);
    
    // Call the callback
    if (this.callback) {
      this.callback(time);
    }
  }
} 