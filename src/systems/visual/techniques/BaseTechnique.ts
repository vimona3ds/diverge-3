import * as THREE from 'three';
import { IShaderMaterial, IVisualTechnique } from '../../../core/types/visual';

/**
 * Base class for visual techniques that implements common functionality
 */
export abstract class BaseTechnique implements IVisualTechnique {
  public id: string;
  public name: string;
  
  protected scene: THREE.Scene;
  protected camera: THREE.OrthographicCamera;
  protected material: IShaderMaterial | null = null;
  protected mesh: THREE.Mesh | null = null;
  protected initialized: boolean = false;
  
  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    
    // Create a scene with orthographic camera for 2D rendering
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;
    
    // Create a full-screen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry);
    this.scene.add(this.mesh);
  }
  
  /**
   * Initialize the technique with the WebGL renderer
   * @param renderer The WebGL renderer
   */
  public initialize(renderer: THREE.WebGLRenderer): void {
    // Default implementation does nothing
    this.initialized = true;
  }
  
  /**
   * Create a shader material with the given parameters
   * @param params Parameters for the material
   */
  public abstract createMaterial(params: any): IShaderMaterial;
  
  /**
   * Get uniform updaters for the material
   * @param params Parameters for the updaters
   */
  public getUniformUpdaters(params: any): Record<string, (time: number, deltaTime: number) => void> {
    // Default implementation returns empty record
    return {};
  }
  
  /**
   * Update the material parameters
   * @param params Parameters to update
   */
  public updateParams(params: any): void {
    // Default implementation does nothing
    // Subclasses should override this to update material uniforms
  }
  
  /**
   * Render the technique to the given target
   * @param renderer The WebGL renderer
   * @param target Optional render target (renders to screen if not provided)
   */
  public render(renderer: THREE.WebGLRenderer, target?: THREE.WebGLRenderTarget): void {
    if (!this.initialized || !this.mesh || !this.material) return;
    
    // Assign material to mesh
    this.mesh.material = this.material;
    
    // Render scene to target or screen
    renderer.setRenderTarget(target || null);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(null);
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      if (this.mesh.material instanceof THREE.Material) {
        this.mesh.material.dispose();
      }
    }
    
    this.initialized = false;
  }
} 