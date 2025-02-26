import * as THREE from 'three';
import { Renderer } from './Renderer';

/**
 * Handles rendering visual content to the viewport
 */
export class ViewportRenderer {
  private renderer: Renderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private container: HTMLElement | null = null;
  private renderTargets: Map<string, THREE.WebGLRenderTarget> = new Map();
  private resizeObserver: ResizeObserver | null = null;
  
  constructor(renderer: Renderer) {
    this.renderer = renderer;
    
    // Setup basic rendering environment
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.camera.position.z = 1;
    
    // Create a full-screen quad to render content
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);
  }
  
  /**
   * Attach the renderer to a DOM element
   * @param container The DOM element to attach to
   */
  public attach(container: HTMLElement): void {
    if (this.container) {
      this.detach();
    }
    
    this.container = container;
    // TODO: Append renderer's DOM element to container
    
    // Setup resize handling
    this.resizeObserver = new ResizeObserver(this.handleResize.bind(this));
    this.resizeObserver.observe(container);
    
    // Initial size update
    this.handleResize();
  }
  
  /**
   * Detach the renderer from its current container
   */
  public detach(): void {
    if (!this.container) return;
    
    // TODO: Remove renderer's DOM element from container
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    this.container = null;
  }
  
  /**
   * Set the content to be displayed in the viewport
   * @param texture The texture to display
   */
  public setContent(texture: THREE.Texture): void {
    if (!this.scene.children.length) return;
    
    const mesh = this.scene.children[0] as THREE.Mesh;
    if (mesh.material instanceof THREE.MeshBasicMaterial) {
      mesh.material.map = texture;
      mesh.material.needsUpdate = true;
    }
  }
  
  /**
   * Set the material to be used for rendering
   * @param material The material to use
   */
  public setMaterial(material: THREE.Material): void {
    if (!this.scene.children.length) return;
    
    const mesh = this.scene.children[0] as THREE.Mesh;
    mesh.material = material;
  }
  
  /**
   * Render the current content to the viewport
   */
  public render(): void {
    // TODO: Implement rendering logic
  }
  
  /**
   * Handle container resize events
   */
  private handleResize(): void {
    if (!this.container) return;
    
    // TODO: Update renderer size based on container dimensions
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    this.detach();
    
    // Clean up scene resources
    if (this.scene.children.length) {
      const mesh = this.scene.children[0] as THREE.Mesh;
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
    }
    
    // Clean up render targets
    this.renderTargets.forEach(target => target.dispose());
    this.renderTargets.clear();
  }
} 