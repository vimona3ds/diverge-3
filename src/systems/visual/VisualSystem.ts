import * as THREE from 'three';
import { Renderer } from './Renderer';
import { IPixelDataExtractor } from '../../core/types/visual';
import { VisualDataExtractor } from '../bridge/VisualDataExtractor';
import { ResourcePool } from './ResourcePool';
import { ErrorHandler, ErrorSeverity } from '../../core/utils/ErrorHandler';

/**
 * Manages the visual rendering system using THREE.js
 */
export class VisualSystem {
  private renderer: Renderer;
  private mainScene: THREE.Scene;
  private mainCamera: THREE.OrthographicCamera;
  private outputTexture: THREE.Texture | null = null;
  private outputMaterial: THREE.Material | null = null;
  private dataExtractor: IPixelDataExtractor;
  private dataTexture: THREE.WebGLRenderTarget | null = null;
  private renderTargetPool: ResourcePool<THREE.WebGLRenderTarget>;
  private errorHandler: ErrorHandler;
  private initialized: boolean = false;
  
  constructor() {
    this.renderer = new Renderer();
    this.mainScene = new THREE.Scene();
    
    // Setup camera for 2D rendering
    this.mainCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.mainCamera.position.z = 1;
    
    // Create data extractor for visual-to-audio bridge
    this.dataExtractor = new VisualDataExtractor();
    this.renderTargetPool = new ResourcePool<THREE.WebGLRenderTarget>(
      (id, width, height, options) => new THREE.WebGLRenderTarget(width, height, options),
      (target) => target.dispose(),
      { maxAge: 10000, maxSize: 10 }
    );
    this.errorHandler = ErrorHandler.getInstance();
  }
  
  /**
   * Initialize the visual system
   * @param container The HTML element to attach the renderer to
   */
  public async initialize(container: HTMLElement | null): Promise<void> {
    if (this.initialized || !container) return;
    
    try {
      // Initialize renderer
      this.renderer.initialize(container);
      
      // Create a default scene with a quad
      const geometry = new THREE.PlaneGeometry(2, 2);
      const material = new THREE.MeshBasicMaterial({ color: 0x666666 });
      const quad = new THREE.Mesh(geometry, material);
      this.mainScene.add(quad);
      
      // Setup data render target for visual-to-audio bridge
      const width = Math.min(128, window.innerWidth);
      const height = Math.min(128, window.innerHeight);
      this.dataTexture = this.renderer.createRenderTarget('data', width, height).target;
      this.dataExtractor.setup(4, 4, THREE.RGBAFormat);
      
      this.outputMaterial = material;
      this.initialized = true;
    } catch (error) {
      this.errorHandler.report(
        'Failed to initialize VisualSystem',
        'VisualSystem',
        ErrorSeverity.ERROR,
        error instanceof Error ? error.message : String(error),
        error
      );
      throw error;
    }
  }
  
  /**
   * Get the THREE.js renderer
   * @returns The THREE.js WebGLRenderer
   */
  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer.getRenderer();
  }
  
  /**
   * Update the visual system for the current frame
   * @param time Current time in milliseconds
   * @param deltaTime Time since last frame in milliseconds
   */
  public update(time: number, deltaTime: number): void {
    if (!this.initialized) return;
    
    // Update any animated materials
    if (this.outputMaterial && 'uniforms' in this.outputMaterial) {
      const material = this.outputMaterial as THREE.ShaderMaterial;
      for (const name in material.uniforms) {
        const uniform = material.uniforms[name];
        if (uniform.update) {
          uniform.value = uniform.update(time, deltaTime);
        }
      }
    }
    
    // Render scene to screen and data texture
    this.renderer.render(this.mainScene, this.mainCamera, this.dataTexture);
    this.renderer.renderToScreen(this.outputMaterial);
  }
  
  /**
   * Set the output texture to be displayed in the viewport
   * @param texture The texture to display
   */
  public setOutputTexture(texture: THREE.Texture): void {
    this.outputTexture = texture;
    
    if (!this.mainScene.children[0]) return;
    
    const mesh = this.mainScene.children[0] as THREE.Mesh;
    if (mesh.material instanceof THREE.MeshBasicMaterial) {
      mesh.material.map = texture;
      mesh.material.needsUpdate = true;
    } else {
      const material = new THREE.MeshBasicMaterial({ map: texture });
      mesh.material = material;
      this.outputMaterial = material;
    }
  }
  
  /**
   * Set the output material to be used for rendering
   * @param material The material to use
   */
  public setOutputMaterial(material: THREE.Material): void {
    if (!this.mainScene.children[0]) return;
    
    const mesh = this.mainScene.children[0] as THREE.Mesh;
    mesh.material = material;
    this.outputMaterial = material;
  }
  
  /**
   * Extract data from the rendered scene for audio processing
   * @returns Extracted pixel data as a Float32Array
   */
  public extractData(): Float32Array {
    if (!this.initialized || !this.dataTexture) {
      return new Float32Array(16); // Default empty data
    }
    
    return this.dataExtractor.extract(this.renderer.getRenderer(), this.dataTexture);
  }
  
  /**
   * Clean up WebGL resources when needed
   */
  public cleanResourcePools(): void {
    this.renderer.cleanResourcePools();
    this.renderTargetPool.clean();
  }
  
  /**
   * Dispose of all resources
   */
  public dispose(): void {
    if (this.mainScene.children[0]) {
      const mesh = this.mainScene.children[0] as THREE.Mesh;
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
    }
    
    if (this.dataTexture) {
      this.dataTexture.dispose();
    }
    
    this.renderer.dispose();
    this.renderTargetPool.disposeAll();
    this.initialized = false;
  }
} 