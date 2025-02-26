import { ProcessContext, IGraph } from '../types/node';
import { NodeProcessor } from './NodeProcessor';
import { AssetManager } from '../../services/asset-manager/AssetManager';
import { Scheduler } from '../../services/scheduler/Scheduler';
import { ErrorHandler, ErrorSeverity, wrapAsync } from '../utils/ErrorHandler';
import { MemoryMonitor } from '../utils/MemoryMonitor';
import { Profiler } from '../utils/Profiler';

// These will be implemented later
import { VisualSystem } from '../../systems/visual/VisualSystem';
import { AudioSystem } from '../../systems/audio/AudioSystem';

/**
 * Error recovery options for different engine components
 */
export enum RecoveryStrategy {
  CONTINUE, // Ignore the error and continue
  RETRY,    // Retry the operation
  FALLBACK, // Use fallback/simplified processing
  RESET     // Reset the component to initial state
}

/**
 * Configuration for engine error recovery
 */
export interface ErrorRecoveryConfig {
  maxRetries: number;
  nodeProcessingErrors: RecoveryStrategy;
  visualSystemErrors: RecoveryStrategy;
  audioSystemErrors: RecoveryStrategy;
  enableFallbackRendering: boolean;
}

/**
 * Main engine orchestrator for the audiovisual playground
 * Coordinates the node processing, visual system, and audio system
 */
export class Engine {
  private graph: IGraph;
  private nodeProcessor: NodeProcessor;
  private visualSystem: VisualSystem;
  private audioSystem: AudioSystem;
  private assetManager: AssetManager;
  private scheduler: Scheduler;
  private errorHandler: ErrorHandler;
  private memoryMonitor: MemoryMonitor;
  private profiler: Profiler;
  private running: boolean = false;
  private lastTime: number = 0;
  private frameCount: number = 0;
  private needsInitialization: boolean = true;

  // Error recovery tracking
  private recoveryConfig: ErrorRecoveryConfig;
  private retryCount: Record<string, number> = {};
  private systemStatus: {
    nodeProcessor: boolean;
    visualSystem: boolean;
    audioSystem: boolean;
  } = {
    nodeProcessor: true,
    visualSystem: true,
    audioSystem: true
  };
  
  constructor(recoveryConfig?: Partial<ErrorRecoveryConfig>) {
    this.graph = { nodes: {}, connections: {} };
    this.visualSystem = new VisualSystem();
    this.audioSystem = new AudioSystem();
    this.assetManager = new AssetManager();
    this.nodeProcessor = new NodeProcessor();
    this.scheduler = new Scheduler();
    this.errorHandler = ErrorHandler.getInstance();
    this.memoryMonitor = MemoryMonitor.getInstance();
    this.profiler = Profiler.getInstance();
    
    // Set default recovery configuration
    this.recoveryConfig = {
      maxRetries: 3,
      nodeProcessingErrors: RecoveryStrategy.FALLBACK,
      visualSystemErrors: RecoveryStrategy.FALLBACK,
      audioSystemErrors: RecoveryStrategy.FALLBACK,
      enableFallbackRendering: true,
      ...recoveryConfig
    };
    
    // Set up error handler listening
    this.setupErrorHandling();
    
    // Enable profiler in development
    this.profiler.enable();
    
    // Initialize memory monitor
    this.initializeMemoryMonitor();
    
    // Initialize systems after audio context is created from user gesture
    this.initialize = this.initialize.bind(this);
    this.update = this.update.bind(this);
  }

  /**
   * Set up error handling and monitoring
   */
  private setupErrorHandling(): void {
    this.errorHandler.addListener((error) => {
      // Handle system-specific errors
      if (error.severity >= ErrorSeverity.ERROR) {
        if (error.source === 'NodeProcessor') {
          this.handleSystemError('nodeProcessor', error);
        } else if (error.source === 'VisualSystem') {
          this.handleSystemError('visualSystem', error);
        } else if (error.source === 'AudioSystem') {
          this.handleSystemError('audioSystem', error);
        }
      }
    });
  }

  /**
   * Handle errors in specific subsystems
   */
  private handleSystemError(
    system: 'nodeProcessor' | 'visualSystem' | 'audioSystem', 
    error: any
  ): void {
    const strategyMap = {
      nodeProcessor: this.recoveryConfig.nodeProcessingErrors,
      visualSystem: this.recoveryConfig.visualSystemErrors,
      audioSystem: this.recoveryConfig.audioSystemErrors
    };

    const strategy = strategyMap[system];
    const systemKey = `${system}-${error.message}`;
    
    // Initialize retry count if not exists
    if (!this.retryCount[systemKey]) {
      this.retryCount[systemKey] = 0;
    }
    
    // Handle based on strategy
    switch (strategy) {
      case RecoveryStrategy.CONTINUE:
        // Just log and continue
        console.warn(`Continuing despite error in ${system}: ${error.message}`);
        break;
        
      case RecoveryStrategy.RETRY:
        if (this.retryCount[systemKey] < this.recoveryConfig.maxRetries) {
          console.warn(`Retrying ${system} after error: ${error.message}`);
          this.retryCount[systemKey]++;
          // System-specific retry logic would go here
        } else {
          console.error(`Max retries (${this.recoveryConfig.maxRetries}) reached for ${system}, falling back`);
          this.systemStatus[system] = false;
        }
        break;
        
      case RecoveryStrategy.FALLBACK:
        if (this.recoveryConfig.enableFallbackRendering) {
          console.warn(`Enabling fallback mode for ${system} after error: ${error.message}`);
          this.systemStatus[system] = false;
        } else {
          console.error(`Fallback disabled, stopping ${system} after error: ${error.message}`);
          this.systemStatus[system] = false;
        }
        break;
        
      case RecoveryStrategy.RESET:
        console.warn(`Resetting ${system} after error: ${error.message}`);
        if (system === 'nodeProcessor') {
          this.nodeProcessor = new NodeProcessor();
          this.nodeProcessor.setGraph(this.graph);
        } else if (system === 'visualSystem') {
          this.resetVisualSystem();
        } else if (system === 'audioSystem') {
          this.resetAudioSystem();
        }
        break;
    }
  }

  /**
   * Reset the visual system to recover from errors
   */
  private async resetVisualSystem(): Promise<void> {
    try {
      await this.visualSystem.dispose();
      this.visualSystem = new VisualSystem();
      await this.visualSystem.initialize(document.getElementById('viewport'));
      this.systemStatus.visualSystem = true;
    } catch (error) {
      this.errorHandler.report(
        'Failed to reset visual system',
        'Engine',
        ErrorSeverity.ERROR,
        error instanceof Error ? error.message : String(error),
        error
      );
      this.systemStatus.visualSystem = false;
    }
  }

  /**
   * Reset the audio system to recover from errors
   */
  private async resetAudioSystem(): Promise<void> {
    try {
      await this.audioSystem.dispose();
      this.audioSystem = new AudioSystem();
      await this.audioSystem.initialize();
      this.assetManager.setAudioContext(this.audioSystem.getContext());
      this.systemStatus.audioSystem = true;
    } catch (error) {
      this.errorHandler.report(
        'Failed to reset audio system',
        'Engine',
        ErrorSeverity.ERROR,
        error instanceof Error ? error.message : String(error),
        error
      );
      this.systemStatus.audioSystem = false;
    }
  }
  
  private initializeMemoryMonitor(): void {
    this.memoryMonitor.addListener(() => {
      // Clean up resource pools
      this.visualSystem.cleanResourcePools();
      
      // Force garbage collection hint
      this.forceGarbageCollectionHint();
    });
  }
  
  private forceGarbageCollectionHint(): void {
    // Create and release large temporary arrays to hint at GC
    let largeArray: number[] | null = new Array(10000);
    largeArray.fill(0);
    largeArray = null;
  }
  
  /**
   * Initialize the engine and its systems
   * Must be called after a user gesture to create AudioContext
   */
  public async initialize(): Promise<void> {
    if (!this.needsInitialization) return;
    
    try {
      this.profiler.start('engine-initialization');
      
      await this.audioSystem.initialize();
      
      await this.visualSystem.initialize(document.getElementById('viewport'));
      
      // Set the audio context in asset manager
      this.assetManager.setAudioContext(this.audioSystem.getContext());
      
      // Set up the scheduler
      this.scheduler.setCallback(this.update);
      
      this.needsInitialization = false;
      this.profiler.end('engine-initialization');
    } catch (error) {
      this.errorHandler.report(
        'Failed to initialize engine',
        'Engine',
        ErrorSeverity.FATAL,
        error instanceof Error ? error.message : String(error),
        error
      );
      throw error;
    }
  }

  /**
   * Configure error recovery behavior
   * @param config The error recovery configuration
   */
  public setErrorRecoveryConfig(config: Partial<ErrorRecoveryConfig>): void {
    this.recoveryConfig = {
      ...this.recoveryConfig,
      ...config
    };
  }
  
  /**
   * Set the node graph for processing
   * @param graph The node graph to process
   */
  public setGraph(graph: IGraph): void {
    this.graph = graph;
    this.nodeProcessor.setGraph(graph);
  }
  
  /**
   * Get the current node graph
   * @returns The current node graph
   */
  public getGraph(): IGraph {
    return this.graph;
  }
  
  /**
   * Get the visual system
   * @returns The visual system
   */
  public getVisualSystem(): VisualSystem {
    return this.visualSystem;
  }
  
  /**
   * Get the audio system
   * @returns The audio system
   */
  public getAudioSystem(): AudioSystem {
    return this.audioSystem;
  }
  
  /**
   * Get the asset manager
   * @returns The asset manager
   */
  public getAssetManager(): AssetManager {
    return this.assetManager;
  }

  /**
   * Get the current performance metrics
   * @returns Current performance data
   */
  public getPerformanceMetrics(): any {
    return {
      profiler: this.profiler.getSummary(),
      memory: this.memoryMonitor.getMemoryInfo(),
      systemStatus: { ...this.systemStatus },
      fps: this.scheduler.getCurrentFPS()
    };
  }
  
  /**
   * Start the engine processing loop
   */
  public start(): void {
    if (this.running || this.needsInitialization) return;
    
    this.running = true;
    this.lastTime = performance.now();
    this.scheduler.start();
    
    this.errorHandler.report(
      'Engine started',
      'Engine',
      ErrorSeverity.INFO
    );
  }
  
  /**
   * Stop the engine processing loop
   */
  public stop(): void {
    if (!this.running) return;
    
    this.running = false;
    this.scheduler.stop();
    
    this.errorHandler.report(
      'Engine stopped',
      'Engine',
      ErrorSeverity.INFO
    );
  }
  
  /**
   * Update callback for each frame
   * @param time Current time in milliseconds
   */
  private update(time: number): void {
    this.profiler.start('engine-update');
    
    const deltaTime = time - this.lastTime;
    this.lastTime = time;
    this.frameCount++;
    
    const context: ProcessContext = {
      time,
      deltaTime,
      frame: this.frameCount,
      renderer: this.visualSystem.getRenderer(),
      audioContext: this.audioSystem.getContext(),
      assets: this.assetManager
    };
    
    try {
      // Process node graph if system is healthy
      if (this.systemStatus.nodeProcessor) {
        this.profiler.start('node-processing');
        this.nodeProcessor.process(context);
        this.profiler.end('node-processing');
      }
      
      // Update visual system based on processed nodes
      if (this.systemStatus.visualSystem) {
        this.profiler.start('visual-update');
        this.visualSystem.update(time, deltaTime);
        this.profiler.end('visual-update');
      }
      
      // Extract data for audio from visuals if needed
      let visualData = undefined;
      if (this.systemStatus.visualSystem) {
        this.profiler.start('visual-data-extraction');
        visualData = this.visualSystem.extractData();
        this.profiler.end('visual-data-extraction');
      }
      
      // Update audio system
      if (this.systemStatus.audioSystem) {
        this.profiler.start('audio-update');
        this.audioSystem.update(time, deltaTime, visualData);
        this.profiler.end('audio-update');
      }
    } catch (error) {
      this.errorHandler.report(
        'Error in engine update loop',
        'Engine',
        ErrorSeverity.ERROR,
        error instanceof Error ? error.message : String(error),
        error
      );
    }
    
    this.profiler.end('engine-update');
  }

  /**
   * Run a cleanup pass to free unused resources
   */
  public cleanupResources(): void {
    this.profiler.start('resource-cleanup');
    
    // Trigger memory cleanup
    this.visualSystem.cleanResourcePools();
    this.audioSystem.cleanUnusedResources();
    this.assetManager.cleanUnusedAssets(this.graph);
    
    // Force a garbage collection hint
    this.forceGarbageCollectionHint();
    
    this.profiler.end('resource-cleanup');
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    this.stop();
    this.visualSystem.dispose();
    this.audioSystem.dispose();
    this.assetManager.dispose();
    this.memoryMonitor.dispose();
    this.profiler.disable();
  }
} 