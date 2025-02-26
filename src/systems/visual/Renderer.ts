import * as THREE from 'three';
import { IRenderTarget } from '../../core/types/visual';

export class Renderer {
  private renderer: THREE.WebGLRenderer;
  private mainScene: THREE.Scene;
  private mainCamera: THREE.OrthographicCamera;
  private renderTargets: Map<string, IRenderTarget> = new Map();
  private renderTargetPool: THREE.WebGLRenderTarget[] = [];
  
  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    // Setup orthographic camera for 2D rendering
    this.mainCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.mainCamera.position.z = 1;
    
    // Setup main scene with a full-screen quad
    this.mainScene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const quad = new THREE.Mesh(geometry, material);
    this.mainScene.add(quad);
    
    // Setup resize handler
    window.addEventListener('resize', this.handleResize.bind(this));
  }
  
  public initialize(container: HTMLElement): void {
    container.appendChild(this.renderer.domElement);
  }
  
  public createRenderTarget(
    id: string, 
    width: number, 
    height: number, 
    options: {
      format?: THREE.PixelFormat;
      type?: THREE.TextureDataType;
      minFilter?: THREE.TextureFilter;
      magFilter?: THREE.TextureFilter;
    } = {}
  ): IRenderTarget {
    // Try to reuse from pool
    let target = this.renderTargetPool.pop();
    
    if (!target || target.width !== width || target.height !== height) {
      target = new THREE.WebGLRenderTarget(width, height, {
        format: options.format || THREE.RGBAFormat,
        type: options.type || THREE.UnsignedByteType,
        minFilter: options.minFilter || THREE.LinearFilter,
        magFilter: options.magFilter || THREE.LinearFilter
      });
    }
    
    const renderTarget: IRenderTarget = {
      id,
      target,
      width,
      height,
      format: options.format || THREE.RGBAFormat,
      type: options.type || THREE.UnsignedByteType
    };
    
    this.renderTargets.set(id, renderTarget);
    return renderTarget;
  }
  
  public getRenderTarget(id: string): IRenderTarget | undefined {
    return this.renderTargets.get(id);
  }
  
  public releaseRenderTarget(id: string): void {
    const rt = this.renderTargets.get(id);
    if (rt) {
      this.renderTargetPool.push(rt.target);
      this.renderTargets.delete(id);
    }
  }
  
  public render(scene: THREE.Scene, camera: THREE.Camera, target?: THREE.WebGLRenderTarget): void {
    this.renderer.setRenderTarget(target || null);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
  }
  
  public renderToScreen(material: THREE.Material): void {
    const mesh = this.mainScene.children[0] as THREE.Mesh;
    mesh.material = material;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.mainScene, this.mainCamera);
  }
  
  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }
  
  public readPixels(
    target: THREE.WebGLRenderTarget, 
    x: number, 
    y: number, 
    width: number, 
    height: number, 
    format: THREE.PixelFormat, 
    type: THREE.TextureDataType
  ): Float32Array | Uint8Array {
    const buffer = type === THREE.FloatType ? 
      new Float32Array(width * height * 4) : 
      new Uint8Array(width * height * 4);
    
    this.renderer.readRenderTargetPixels(target, x, y, width, height, buffer);
    return buffer;
  }
  
  private handleResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  public cleanResourcePools(): void {
    // Logic to clean unused render targets if needed
  }
  
  public dispose(): void {
    window.removeEventListener('resize', this.handleResize.bind(this));
    
    // Dispose all render targets
    this.renderTargets.forEach(rt => rt.target.dispose());
    this.renderTargetPool.forEach(rt => rt.dispose());
    
    this.renderer.dispose();
    
    const mesh = this.mainScene.children[0] as THREE.Mesh;
    mesh.geometry.dispose();
    
    if (mesh.material instanceof THREE.Material) {
      mesh.material.dispose();
    } else if (Array.isArray(mesh.material)) {
      mesh.material.forEach(mat => mat.dispose());
    }
  }
} 