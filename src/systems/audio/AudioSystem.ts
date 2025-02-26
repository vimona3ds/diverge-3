import { IAudioNode, IAudioProcessor, IAudioWorkletProcessor } from '../../core/types/audio';
import { AudioNodeRegistry } from './AudioNodeRegistry';

// For older browsers with prefixed AudioContext
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

/**
 * Manages the audio processing system using Web Audio API
 */
export class AudioSystem {
  private audioContext: AudioContext | null = null;
  private initialized: boolean = false;
  private nodes: Map<string, IAudioNode> = new Map();
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private workletProcessors: Map<string, IAudioWorkletProcessor> = new Map();
  private registry: AudioNodeRegistry;
  private lastNodeActivityTimestamps: Map<string, number> = new Map();
  private unusedThreshold: number = 30000; // 30 seconds
  
  constructor() {
    this.registry = AudioNodeRegistry.getInstance();
  }
  
  /**
   * Initialize the audio system
   * Must be called after a user gesture to create AudioContext
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create master gain
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.audioContext.destination);
      
      // Create analyser
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.connect(this.masterGain);
      
      // Register all processors
      await this.registerProcessors();
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize audio system:', error);
      throw error;
    }
  }
  
  /**
   * Register built-in processors
   */
  private async registerProcessors(): Promise<void> {
    if (!this.audioContext) return;
    
    // Register builtin AudioWorklet processors
    // For now, we'll just register paths and load them when needed
    const processorPaths = [
      { id: 'noise-generator', path: '/worklets/noise-generator.js' },
      { id: 'grain-processor', path: '/worklets/grain-processor.js' }
    ];
    
    for (const { id, path } of processorPaths) {
      try {
        await this.audioContext.audioWorklet.addModule(path);
        const workletProcessor: IAudioWorkletProcessor = {
          id,
          name: id,
          processorPath: path,
          initialize: async (ctx) => {
            await ctx.audioWorklet.addModule(path);
          },
          createNode: (ctx, params) => {
            return new AudioWorkletNode(ctx, id, params);
          }
        };
        this.workletProcessors.set(id, workletProcessor);
      } catch (error) {
        console.error(`Failed to load AudioWorklet module ${id}:`, error);
      }
    }
  }
  
  /**
   * Get the audio context
   * @returns The audio context
   */
  public getContext(): AudioContext {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }
    return this.audioContext;
  }
  
  /**
   * Create an audio node
   * @param type The type of node to create
   * @param params Parameters for the node
   * @returns The created audio node or null if failed
   */
  public createAudioNode(type: string, params: any = {}): IAudioNode | null {
    if (!this.audioContext || !this.initialized) {
      console.error('Audio system not initialized');
      return null;
    }
    
    try {
      const processor = this.registry.getProcessor(type);
      if (!processor) {
        console.error(`Audio processor "${type}" not found`);
        return null;
      }
      
      const node = processor.createNode(this.audioContext, params);
      this.nodes.set(node.id, node);
      this.lastNodeActivityTimestamps.set(node.id, performance.now());
      return node;
    } catch (error) {
      console.error(`Failed to create audio node of type "${type}":`, error);
      return null;
    }
  }
  
  /**
   * Connect a node to the master output
   * @param node The node to connect
   */
  public connectToMaster(node: IAudioNode): void {
    if (!this.masterGain) return;
    
    try {
      node.connect({ 
        id: 'master', 
        node: this.masterGain, 
        params: { gain: this.masterGain.gain },
        connect: () => {},
        disconnect: () => {},
        dispose: () => {}
      });
      
      // Update activity timestamp when connected
      this.lastNodeActivityTimestamps.set(node.id, performance.now());
    } catch (error) {
      console.error('Failed to connect node to master:', error);
    }
  }
  
  /**
   * Update the audio system for the current frame
   * @param time Current time in milliseconds
   * @param deltaTime Time since last frame in milliseconds
   * @param visualData Data extracted from the visual system
   */
  public update(time: number, deltaTime: number, visualData?: Float32Array): void {
    // Process any audio updates that need to happen per frame
    // This could include updating audio parameters based on visual data
    if (!this.initialized || !visualData || visualData.length === 0) return;
    
    // For now, we'll just use the first value to control master volume as an example
    if (this.masterGain) {
      const value = Math.max(0, Math.min(1, visualData[0]));
      this.masterGain.gain.value = 0.2 + (value * 0.4); // Scale to 0.2-0.6 range
    }
    
    // Update activity timestamps for active nodes
    this.nodes.forEach((node, id) => {
      // We consider a node active if it's being used this frame
      // In a real implementation, we would have more complex activity detection
      this.lastNodeActivityTimestamps.set(id, performance.now());
    });
  }
  
  /**
   * Clean up unused audio nodes and resources
   * @returns Number of nodes cleaned up
   */
  public cleanUnusedResources(): number {
    if (!this.initialized) return 0;
    
    const now = performance.now();
    const nodesToRemove: string[] = [];
    
    // Find nodes that haven't been used for a while
    this.lastNodeActivityTimestamps.forEach((timestamp, id) => {
      if (now - timestamp > this.unusedThreshold) {
        nodesToRemove.push(id);
      }
    });
    
    // Clean up each unused node
    nodesToRemove.forEach(id => {
      const node = this.nodes.get(id);
      if (node) {
        try {
          // Dispose the node
          node.dispose();
          
          // Remove from collections
          this.nodes.delete(id);
          this.lastNodeActivityTimestamps.delete(id);
        } catch (error) {
          console.error(`Error disposing audio node ${id}:`, error);
        }
      }
    });
    
    return nodesToRemove.length;
  }
  
  /**
   * Set the time threshold for unused nodes (milliseconds)
   * @param threshold The time in milliseconds
   */
  public setUnusedThreshold(threshold: number): void {
    this.unusedThreshold = Math.max(5000, threshold); // Minimum 5 seconds
  }
  
  /**
   * Get frequency data from the analyser
   * @returns An array of frequency data
   */
  public getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array();
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }
  
  /**
   * Dispose of all resources
   */
  public dispose(): void {
    // Clean up all audio nodes
    this.nodes.forEach(node => node.dispose());
    this.nodes.clear();
    this.lastNodeActivityTimestamps.clear();
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    this.initialized = false;
  }
} 