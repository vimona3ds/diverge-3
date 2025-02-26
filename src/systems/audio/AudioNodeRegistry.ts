import { IAudioProcessor, IAudioWorkletProcessor } from '../../core/types/audio';

/**
 * Singleton registry for audio processors and worklets
 * This class manages all audio processing components in the application
 */
export class AudioNodeRegistry {
  private static instance: AudioNodeRegistry;
  private processors: Map<string, IAudioProcessor> = new Map();
  private workletProcessors: Map<string, IAudioWorkletProcessor> = new Map();
  
  private constructor() {
    // Private constructor to enforce singleton pattern
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): AudioNodeRegistry {
    if (!AudioNodeRegistry.instance) {
      AudioNodeRegistry.instance = new AudioNodeRegistry();
    }
    return AudioNodeRegistry.instance;
  }
  
  /**
   * Register an audio processor
   * @param processor The audio processor to register
   */
  public registerProcessor(processor: IAudioProcessor): void {
    if (this.processors.has(processor.id)) {
      console.warn(`Audio processor '${processor.id}' already registered. Overwriting.`);
    }
    this.processors.set(processor.id, processor);
  }
  
  /**
   * Register an audio worklet processor
   * @param processor The audio worklet processor to register
   */
  public registerWorkletProcessor(processor: IAudioWorkletProcessor): void {
    if (this.workletProcessors.has(processor.id)) {
      console.warn(`Audio worklet processor '${processor.id}' already registered. Overwriting.`);
    }
    this.workletProcessors.set(processor.id, processor);
  }
  
  /**
   * Get an audio processor by id
   * @param id The processor id to retrieve
   * @returns The audio processor or undefined if not found
   */
  public getProcessor(id: string): IAudioProcessor | undefined {
    return this.processors.get(id);
  }
  
  /**
   * Get an audio worklet processor by id
   * @param id The worklet processor id to retrieve
   * @returns The audio worklet processor or undefined if not found
   */
  public getWorkletProcessor(id: string): IAudioWorkletProcessor | undefined {
    return this.workletProcessors.get(id);
  }
  
  /**
   * Get all registered audio processors
   * @returns Array of all audio processors
   */
  public getAllProcessors(): IAudioProcessor[] {
    return Array.from(this.processors.values());
  }
  
  /**
   * Get all registered audio worklet processors
   * @returns Array of all audio worklet processors
   */
  public getAllWorkletProcessors(): IAudioWorkletProcessor[] {
    return Array.from(this.workletProcessors.values());
  }
  
  /**
   * Check if an audio processor is registered
   * @param id The processor id to check
   * @returns True if the processor is registered
   */
  public hasProcessor(id: string): boolean {
    return this.processors.has(id);
  }
  
  /**
   * Check if an audio worklet processor is registered
   * @param id The worklet processor id to check
   * @returns True if the worklet processor is registered
   */
  public hasWorkletProcessor(id: string): boolean {
    return this.workletProcessors.has(id);
  }
} 