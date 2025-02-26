/**
 * Scheduler service for managing the animation loop
 * Provides FPS control and a stable update loop
 */
export class Scheduler {
  private callback: ((time: number, deltaTime: number) => void) | null = null;
  private running: boolean = false;
  private frameId: number | null = null;
  private lastTime: number = 0;
  private lastFrameTime: number = 0;
  private fpsLimit: number = 60;
  private interval: number = 1000 / 60; // Default to 60 FPS
  private frameTimestamps: number[] = [];
  private currentFPS: number = 0;
  private accumulatedTime: number = 0;
  private readonly maxDeltaTime: number = 100; // Maximum time step in ms
  
  constructor() {
    this.updateLoop = this.updateLoop.bind(this);
  }
  
  /**
   * Set the callback function to call each frame
   * @param callback The function to call each frame with time and deltaTime
   */
  public setCallback(callback: (time: number, deltaTime: number) => void): void {
    this.callback = callback;
  }
  
  /**
   * Set the FPS limit for the scheduler
   * @param fps The maximum frames per second (1-120)
   */
  public setFPSLimit(fps: number): void {
    // Clamp FPS between 1 and 120
    this.fpsLimit = Math.max(1, Math.min(120, fps));
    this.interval = 1000 / this.fpsLimit;
    
    // Reset timing when FPS limit changes
    this.accumulatedTime = 0;
    this.lastTime = performance.now();
    this.lastFrameTime = this.lastTime;
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
    this.lastFrameTime = this.lastTime;
    this.accumulatedTime = 0;
    this.frameTimestamps = [];
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
    
    // Clear state
    this.accumulatedTime = 0;
    this.frameTimestamps = [];
  }
  
  /**
   * Calculate the current FPS using exponential moving average
   * @param deltaTime Time since last frame in milliseconds
   */
  private calculateFPS(deltaTime: number): void {
    // Calculate instantaneous FPS
    const instantFPS = 1000 / deltaTime;
    
    // Use exponential moving average for smoother FPS
    const alpha = 0.1; // Smoothing factor
    this.currentFPS = Math.round(
      alpha * instantFPS + (1 - alpha) * this.currentFPS
    );
    
    // Clamp to reasonable values
    this.currentFPS = Math.max(0, Math.min(120, this.currentFPS));
  }
  
  /**
   * The update loop function that gets called each frame
   * @param time Current time in milliseconds
   */
  private updateLoop(time: number): void {
    if (!this.running) return;
    
    this.frameId = requestAnimationFrame(this.updateLoop);
    
    // Calculate frame timing
    const deltaTime = time - this.lastTime;
    this.lastTime = time;
    
    // Accumulate time since last frame
    this.accumulatedTime += deltaTime;
    
    // Limit accumulated time to prevent spiral of death
    this.accumulatedTime = Math.min(this.accumulatedTime, this.maxDeltaTime);
    
    // Update if enough time has accumulated
    if (this.accumulatedTime >= this.interval) {
      // Calculate actual frame time for FPS calculation
      const actualFrameTime = time - this.lastFrameTime;
      this.lastFrameTime = time;
      
      // Update FPS calculation
      this.calculateFPS(actualFrameTime);
      
      // Remove accumulated time
      this.accumulatedTime -= this.interval;
      
      // Call the callback with current time and delta
      if (this.callback) {
        // Use fixed time step for stability
        this.callback(time, this.interval);
      }
    }
  }
} 