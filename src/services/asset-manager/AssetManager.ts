import { IGraph, INode } from '../../core/types/node';

export interface Asset {
  id: string;
  type: 'audio' | 'image' | 'video' | 'text' | 'binary' | 'other';
  name: string;
  data: any; // AudioBuffer, HTMLImageElement, etc.
  metadata?: Record<string, any>;
  lastUsed?: number; // Timestamp when the asset was last used
}

/**
 * Manages loading and storing assets used by the application
 */
export class AssetManager {
  private assets: Map<string, Asset> = new Map();
  private assetPaths: Map<string, string> = new Map(); // Maps paths to asset IDs
  private audioContext: AudioContext | null = null;
  private unusedThreshold: number = 60000; // 60 seconds
  
  constructor() {}
  
  /**
   * Initialize the asset manager
   * @returns A promise that resolves when initialization is complete
   */
  public async initialize(): Promise<void> {
    // Initialize any internal state, cache structures, etc.
    return Promise.resolve();
  }
  
  /**
   * Set the audio context for audio asset handling
   * @param context The audio context to use
   */
  public setAudioContext(context: AudioContext): void {
    this.audioContext = context;
  }
  
  /**
   * Load an asset from a file
   * @param path The path/name to store the asset under
   * @param file The file to load
   * @returns A promise resolving to the loaded asset
   */
  public async loadAsset(path: string, file: Blob): Promise<Asset> {
    return new Promise<Asset>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const asset: Asset = {
            id: `asset-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            type: this.determineAssetType(file.type),
            name: path,
            data: event.target!.result,
            metadata: {
              size: file.size,
              mimeType: file.type
            },
            lastUsed: Date.now()
          };
          
          this.assets.set(asset.id, asset);
          this.assetPaths.set(path, asset.id);
          resolve(asset);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to load asset'));
      };
      
      if (file.type.startsWith('text/')) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  }
  
  /**
   * Get an asset by its path
   * @param path The path of the asset
   * @returns The asset or undefined if not found
   */
  public getAssetByPath(path: string): Asset | undefined {
    const assetId = this.assetPaths.get(path);
    if (assetId) {
      return this.getAsset(assetId);
    }
    return undefined;
  }
  
  /**
   * Determine the asset type from a MIME type
   * @param mimeType The MIME type
   * @returns The asset type
   */
  private determineAssetType(mimeType: string): Asset['type'] {
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('text/')) return 'text';
    if (mimeType === 'application/octet-stream') return 'binary';
    return 'other';
  }
  
  /**
   * Load an audio file
   * @param file The audio file to load
   * @returns A promise resolving to the loaded asset
   */
  public async loadAudio(file: File): Promise<Asset> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }
    
    return new Promise<Asset>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const buffer = await this.audioContext!.decodeAudioData(event.target!.result as ArrayBuffer);
          
          const asset: Asset = {
            id: `audio-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            type: 'audio',
            name: file.name,
            data: buffer,
            metadata: {
              duration: buffer.duration,
              sampleRate: buffer.sampleRate,
              numberOfChannels: buffer.numberOfChannels,
              size: file.size
            },
            lastUsed: Date.now()
          };
          
          this.assets.set(asset.id, asset);
          resolve(asset);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = (error) => {
        reject(error);
      };
      
      reader.readAsArrayBuffer(file);
    });
  }
  
  /**
   * Load an image file
   * @param file The image file to load
   * @returns A promise resolving to the loaded asset
   */
  public async loadImage(file: File): Promise<Asset> {
    return new Promise<Asset>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const image = new Image();
        
        image.onload = () => {
          const asset: Asset = {
            id: `image-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            type: 'image',
            name: file.name,
            data: image,
            metadata: {
              width: image.width,
              height: image.height,
              size: file.size
            },
            lastUsed: Date.now()
          };
          
          this.assets.set(asset.id, asset);
          resolve(asset);
        };
        
        image.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        
        image.src = event.target!.result as string;
      };
      
      reader.onerror = (error) => {
        reject(error);
      };
      
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * Get an asset by ID
   * @param id The asset ID
   * @returns The asset or undefined if not found
   */
  public getAsset(id: string): Asset | undefined {
    const asset = this.assets.get(id);
    if (asset) {
      // Update last used timestamp
      asset.lastUsed = Date.now();
    }
    return asset;
  }
  
  /**
   * Get all assets
   * @returns Array of all assets
   */
  public getAllAssets(): Asset[] {
    return Array.from(this.assets.values());
  }
  
  /**
   * Get assets of a specific type
   * @param type The asset type to filter by
   * @returns Array of assets of the specified type
   */
  public getAssetsByType(type: Asset['type']): Asset[] {
    return Array.from(this.assets.values()).filter(asset => asset.type === type);
  }
  
  /**
   * Remove an asset
   * @param id The asset ID to remove
   * @returns True if the asset was removed
   */
  public removeAsset(id: string): boolean {
    return this.assets.delete(id);
  }
  
  /**
   * Find assets that are in use in the node graph
   * @param graph The current node graph
   * @returns Set of asset IDs in use
   */
  private findAssetsInUse(graph: IGraph): Set<string> {
    const usedAssets = new Set<string>();
    
    // Helper function to check node parameters for asset references
    const checkNodeForAssets = (node: INode) => {
      // Check node params for asset references
      for (const paramKey in node.params) {
        const param = node.params[paramKey];
        if (typeof param === 'string' && param.startsWith('asset:')) {
          const assetId = param.substring(6); // Remove 'asset:' prefix
          usedAssets.add(assetId);
        }
      }
      
      // Check node state for asset references
      for (const stateKey in node.state) {
        const state = node.state[stateKey];
        if (typeof state === 'string' && state.startsWith('asset:')) {
          const assetId = state.substring(6);
          usedAssets.add(assetId);
        }
      }
    };
    
    // Check all nodes in the graph
    for (const nodeId in graph.nodes) {
      checkNodeForAssets(graph.nodes[nodeId]);
    }
    
    return usedAssets;
  }
  
  /**
   * Clean up unused assets based on the current graph
   * @param graph The current node graph
   * @returns Number of assets removed
   */
  public cleanUnusedAssets(graph: IGraph): number {
    // Find assets in use
    const usedAssetIds = this.findAssetsInUse(graph);
    const now = Date.now();
    let removedCount = 0;
    
    // Check each asset
    this.assets.forEach((asset, id) => {
      // If asset is not in use and hasn't been used recently, remove it
      if (
        !usedAssetIds.has(id) && 
        asset.lastUsed && 
        now - asset.lastUsed > this.unusedThreshold
      ) {
        // Clean up resources
        if (asset.type === 'audio') {
          // Audio buffers don't need explicit cleanup
        } else if (asset.type === 'image') {
          // Free image resources if possible
          if (asset.data instanceof HTMLImageElement) {
            asset.data.src = '';
          }
        }
        
        // Remove from collection
        this.assets.delete(id);
        removedCount++;
      }
    });
    
    return removedCount;
  }
  
  /**
   * Set the time threshold for unused assets (milliseconds)
   * @param threshold The time in milliseconds
   */
  public setUnusedThreshold(threshold: number): void {
    this.unusedThreshold = Math.max(5000, threshold); // Minimum 5 seconds
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    this.assets.clear();
    this.assetPaths.clear();
    this.audioContext = null;
  }
} 