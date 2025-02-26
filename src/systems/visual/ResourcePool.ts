import * as THREE from 'three';

export interface PooledResource<T> {
  resource: T;
  lastUsed: number;
  inUse: boolean;
}

/**
 * Generic pool for reusing resources such as WebGL buffers, textures, etc.
 */
export class ResourcePool<T> {
  private resources: Map<string, PooledResource<T>> = new Map();
  private factory: (id: string, ...args: any[]) => T;
  private dispose: (resource: T) => void;
  private maxAge: number; // Time in ms before unused resource is considered for disposal
  private maxSize: number; // Maximum number of resources to keep in pool
  
  constructor(
    factory: (id: string, ...args: any[]) => T,
    dispose: (resource: T) => void,
    options: {
      maxAge?: number;
      maxSize?: number;
    } = {}
  ) {
    this.factory = factory;
    this.dispose = dispose;
    this.maxAge = options.maxAge || 30000; // Default 30 seconds
    this.maxSize = options.maxSize || 20;   // Default 20 resources
  }
  
  /**
   * Acquire a resource from the pool or create a new one
   * @param id Unique identifier for the resource
   * @param args Arguments to pass to the factory if creating a new resource
   * @returns The acquired or created resource
   */
  public acquire(id: string, ...args: any[]): T {
    let pooled = this.resources.get(id);
    
    if (!pooled) {
      // Create new resource
      const resource = this.factory(id, ...args);
      pooled = {
        resource,
        lastUsed: performance.now(),
        inUse: true
      };
      this.resources.set(id, pooled);
    } else {
      // Mark existing resource as in use
      pooled.inUse = true;
      pooled.lastUsed = performance.now();
    }
    
    return pooled.resource;
  }
  
  /**
   * Release a resource back to the pool
   * @param id The identifier of the resource to release
   */
  public release(id: string): void {
    const pooled = this.resources.get(id);
    if (pooled) {
      pooled.inUse = false;
      pooled.lastUsed = performance.now();
    }
  }
  
  /**
   * Check if a resource exists in the pool
   * @param id The identifier to check
   * @returns True if the resource exists in the pool
   */
  public has(id: string): boolean {
    return this.resources.has(id);
  }
  
  /**
   * Clean up old or excess resources
   */
  public clean(): void {
    const now = performance.now();
    let count = 0;
    
    // Count in-use resources
    for (const [_, pooled] of this.resources) {
      if (pooled.inUse) count++;
    }
    
    // If we have too many resources, or resources are old, dispose them
    for (const [id, pooled] of this.resources) {
      // Skip resources in use
      if (pooled.inUse) continue;
      
      const age = now - pooled.lastUsed;
      
      // Dispose if too old or we have too many resources
      if (age > this.maxAge || count >= this.maxSize) {
        this.dispose(pooled.resource);
        this.resources.delete(id);
      } else {
        count++;
      }
    }
  }
  
  /**
   * Dispose all resources in the pool
   */
  public disposeAll(): void {
    for (const [_, pooled] of this.resources) {
      this.dispose(pooled.resource);
    }
    this.resources.clear();
  }
}

/**
 * Specialized resource pool for THREE.js WebGLRenderTargets
 */
export class RenderTargetPool {
  private pool: ResourcePool<THREE.WebGLRenderTarget>;
  
  constructor() {
    this.pool = new ResourcePool<THREE.WebGLRenderTarget>(
      (id, width, height, options) => {
        return new THREE.WebGLRenderTarget(width, height, options);
      },
      (target) => {
        target.dispose();
      },
      { maxAge: 10000, maxSize: 10 }
    );
  }
  
  /**
   * Acquire a render target from the pool or create a new one
   * @param id Unique identifier for the target
   * @param width Width of the render target
   * @param height Height of the render target
   * @param options Additional WebGLRenderTarget options
   * @returns A WebGLRenderTarget
   */
  public acquire(id: string, width: number, height: number, options?: THREE.RenderTargetOptions): THREE.WebGLRenderTarget {
    return this.pool.acquire(id, width, height, options);
  }
  
  /**
   * Release a render target back to the pool
   * @param id The identifier of the render target to release
   */
  public release(id: string): void {
    this.pool.release(id);
  }
  
  /**
   * Clean up old or excess render targets
   */
  public clean(): void {
    this.pool.clean();
  }
  
  /**
   * Dispose all render targets in the pool
   */
  public dispose(): void {
    this.pool.disposeAll();
  }
} 