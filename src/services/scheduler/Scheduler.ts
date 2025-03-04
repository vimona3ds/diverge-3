/**
 * Scheduler service for managing the animation loop
 * Provides FPS control and a stable update loop
 */
export class Scheduler {
  private callback: ((time: number, deltaTime: number) => void) | null = null;
  private running: boolean = false;
  private lastTime: number = 0;
  private frameCount: number = 0;
  private frameTimestamps: number[] = [];
  private fpsLimit: number = 60;
  private interval: number = 1000 / 60; // Default to 60 FPS
  private animationFrameId: number = 0;
  
  constructor() {
    this.updateLoop = this.updateLoop.bind(this);
  }
  
  /**
   * Initialize the scheduler
   * @returns A promise that resolves when initialization is complete
   */
  public initialize(): void {
    // Initialize any required state
    this.frameCount = 0;
    this.frameTimestamps = [];
    this.lastTime = 0;
  }
  
  /**
   * Set the callback function to be called each frame
   * @param callback The callback function
   */
  public setCallback(callback: ((time: number, deltaTime: number) => void) | null): void {
    this.callback = callback;
  }
  
  /**
   * Set the target FPS
   * @param fps Target frames per second
   */
  public setTargetFPS(fps: number): void {
    this.setFPSLimit(fps);
  }
  
  /**
   * Set FPS limit
   * @param fps Maximum frames per second
   */
  public setFPSLimit(fps: number): void {
    this.fpsLimit = Math.max(1, Math.min(fps, 120)); // Clamp between 1 and 120 FPS
    this.interval = 1000 / this.fpsLimit;
  }
  
  /**
   * Start the scheduler
   */
  public start(): void {
    if (this.running) return;
    
    this.running = true;
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.frameTimestamps = [];
    this.requestNextFrame();
  }
  
  /**
   * Stop the scheduler
   */
  public stop(): void {
    if (!this.running) return;
    
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }
  
  /**
   * Get the current FPS
   * @returns Current frames per second
   */
  public getCurrentFPS(): number {
    const now = performance.now();
    const oneSecondAgo = now - 1000;
    
    // Remove timestamps older than 1 second
    this.frameTimestamps = this.frameTimestamps.filter(t => t > oneSecondAgo);
    
    return this.frameTimestamps.length;
  }
  
  /**
   * Request the next animation frame
   */
  private requestNextFrame(): void {
    if (!this.running) return;
    this.animationFrameId = global.requestAnimationFrame(this.updateLoop);
  }
  
  /**
   * The main update loop
   * @param time Current time in milliseconds
   */
  private updateLoop(time: number): void {
    if (!this.running) return;
    
    const deltaTime = time - this.lastTime;
    
    // Check if enough time has passed since last frame
    if (deltaTime >= this.interval) {
      // Record frame timestamp for FPS calculation
      this.frameTimestamps.push(time);
      
      // Call the callback if set
      if (this.callback) {
        try {
          this.callback(time, deltaTime);
        } catch (error) {
          console.error('Error in scheduler callback:', error);
        }
      }
      
      this.lastTime = time;
      this.frameCount++;
    }
    
    this.requestNextFrame();
  }
} 