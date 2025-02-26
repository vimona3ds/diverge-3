import * as THREE from 'three';
import { BaseTechnique } from './BaseTechnique';
import { IShaderMaterial } from '../../../core/types/visual';

/**
 * Parameters for the Lenia technique (continuous cellular automata)
 */
export interface LeniaParams {
  kernelRadius: number;         // Radius of the convolution kernel
  kernelPeakR: number;          // Location of the peak (0 to 1)
  kernelPeakA: number;          // Peak value
  kernelShape: number;          // Kernel shape parameter (controls curve)
  growthCenter: number;         // Center of the growth mapping
  growthWidth: number;          // Width of the growth mapping
  growthHeight: number;         // Height of the growth mapping
  timeStep: number;             // Time delta per frame
  initialPattern: 'random' | 'circle' | 'glider' | 'custom'; // Initial state
  colorScheme: 'grayscale' | 'heatmap' | 'custom';  // Visualization color scheme
  customColorA: THREE.Color;    // First color for custom scheme
  customColorB: THREE.Color;    // Second color for custom scheme
  customTexture?: THREE.Texture; // Custom initial state texture
}

/**
 * Custom uniform interface that includes an update function
 */
interface IUniformWithUpdate extends THREE.IUniform {
  update?: (time: number, deltaTime?: number) => any;
}

/**
 * Implementation of Lenia - a continuous, smooth cellular automata system
 * that produces lifelike organisms and patterns
 */
export class Lenia extends BaseTechnique {
  private params: LeniaParams;
  private pingPongTargets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null = null;
  private kernelTexture: THREE.DataTexture | null = null;
  private currentTarget: number = 0;
  private simulationMaterial: IShaderMaterial | null = null;
  private renderMaterial: IShaderMaterial | null = null;
  private simInitialized: boolean = false;
  private iterations: number = 0;
  
  constructor(id: string) {
    super(id, 'Lenia');
    
    // Default parameters
    this.params = {
      kernelRadius: 13,
      kernelPeakR: 0.5,
      kernelPeakA: 1.0,
      kernelShape: 4.0,
      growthCenter: 0.15,
      growthWidth: 0.015,
      growthHeight: 0.15,
      timeStep: 0.1,
      initialPattern: 'circle',
      colorScheme: 'heatmap',
      customColorA: new THREE.Color(0x000000),
      customColorB: new THREE.Color(0xffffff)
    };
  }
  
  /**
   * Initialize the technique with the WebGL renderer
   * @param renderer The WebGL renderer
   */
  public initialize(renderer: THREE.WebGLRenderer): void {
    super.initialize(renderer);
    
    // Create ping-pong render targets for simulation
    const width = 256;
    const height = 256;
    
    const options = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      stencilBuffer: false,
      depthBuffer: false
    };
    
    this.pingPongTargets = [
      new THREE.WebGLRenderTarget(width, height, options),
      new THREE.WebGLRenderTarget(width, height, options)
    ];
    
    // Generate kernel texture
    this.generateKernelTexture();
    
    // Initialize simulation state
    // TODO: Implement initialization of Lenia state
    
    this.simInitialized = true;
  }
  
  /**
   * Create a shader material for the Lenia simulation
   * @param params Parameters for the simulation
   */
  public createMaterial(params: LeniaParams): IShaderMaterial {
    this.params = { ...params };
    
    // Regenerate kernel with updated parameters
    this.generateKernelTexture();
    
    // TODO: Use actual shader code from files once implemented
    // This would be the simulation shader for updating the Lenia state
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    const fragmentShader = `
      uniform sampler2D u_state;
      uniform sampler2D u_kernel;
      uniform float u_timeStep;
      uniform float u_growthCenter;
      uniform float u_growthWidth;
      uniform float u_growthHeight;
      uniform vec2 u_resolution;
      uniform float u_time;
      
      varying vec2 vUv;
      
      // TODO: Replace with actual Lenia implementation
      void main() {
        // Placeholder: just a gradient color with time animation
        gl_FragColor = vec4(vUv.x, vUv.y, sin(u_time) * 0.5 + 0.5, 1.0);
      }
    `;
    
    const uniforms: { [key: string]: IUniformWithUpdate } = {
      u_state: { value: null },
      u_kernel: { value: this.kernelTexture },
      u_timeStep: { value: params.timeStep },
      u_growthCenter: { value: params.growthCenter },
      u_growthWidth: { value: params.growthWidth },
      u_growthHeight: { value: params.growthHeight },
      u_resolution: { value: new THREE.Vector2(256, 256) },
      u_time: { 
        value: 0.0,
        update: (time: number) => time / 1000.0
      }
    };
    
    this.simulationMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms
    }) as IShaderMaterial;
    
    // Also create the render material for visualization
    this.createRenderMaterial();
    
    return this.simulationMaterial;
  }
  
  /**
   * Create a material for rendering the Lenia state
   */
  private createRenderMaterial(): void {
    // This material is used to visualize the Lenia state
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    const fragmentShader = `
      uniform sampler2D u_state;
      uniform int u_colorScheme;
      uniform vec3 u_colorA;
      uniform vec3 u_colorB;
      
      varying vec2 vUv;
      
      // TODO: Replace with actual visualization implementation
      void main() {
        vec4 state = texture2D(u_state, vUv);
        // Use the R channel for visualization
        float value = state.r;
        
        vec3 color;
        if (u_colorScheme == 0) {
          // Grayscale
          color = vec3(value);
        } else if (u_colorScheme == 1) {
          // Heatmap
          color = vec3(
            smoothstep(0.0, 0.33, value),
            smoothstep(0.0, 0.66, value) - smoothstep(0.66, 1.0, value),
            smoothstep(0.66, 1.0, value)
          );
        } else {
          // Custom color
          color = mix(u_colorA, u_colorB, value);
        }
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    
    const uniforms: { [key: string]: IUniformWithUpdate } = {
      u_state: { value: null },
      u_colorScheme: { 
        value: this.params.colorScheme === 'grayscale' ? 0 : 
               this.params.colorScheme === 'heatmap' ? 1 : 2 
      },
      u_colorA: { value: this.params.customColorA },
      u_colorB: { value: this.params.customColorB }
    };
    
    this.renderMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms
    }) as IShaderMaterial;
  }
  
  /**
   * Generate a kernel texture based on current parameters
   */
  private generateKernelTexture(): void {
    const kernelSize = this.params.kernelRadius * 2 + 1;
    const data = new Float32Array(kernelSize * kernelSize * 4);
    
    // TODO: Implement kernel generation based on parameters
    // This is a placeholder that just creates a circular kernel
    const center = this.params.kernelRadius;
    const maxDist = this.params.kernelRadius;
    
    for (let y = 0; y < kernelSize; y++) {
      for (let x = 0; x < kernelSize; x++) {
        const index = (y * kernelSize + x) * 4;
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const normDist = Math.min(dist / maxDist, 1.0);
        
        // Simple bell-shaped kernel
        // TODO: Replace with actual Lenia kernel function
        const value = (normDist < 1.0) ? 
          this.params.kernelPeakA * Math.exp(-Math.pow(normDist - this.params.kernelPeakR, 2) * this.params.kernelShape) : 
          0.0;
        
        data[index] = value;
        data[index + 1] = value;
        data[index + 2] = value;
        data[index + 3] = 1.0;
      }
    }
    
    // Dispose previous texture if exists
    if (this.kernelTexture) {
      this.kernelTexture.dispose();
    }
    
    // Create new texture
    this.kernelTexture = new THREE.DataTexture(
      data,
      kernelSize,
      kernelSize,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.kernelTexture.needsUpdate = true;
  }
  
  /**
   * Update simulation parameters
   * @param params New parameters
   */
  public updateParams(params: LeniaParams): void {
    const oldKernelParams = {
      kernelRadius: this.params.kernelRadius,
      kernelPeakR: this.params.kernelPeakR,
      kernelPeakA: this.params.kernelPeakA,
      kernelShape: this.params.kernelShape
    };
    
    this.params = { ...params };
    
    // Check if kernel parameters changed
    const kernelChanged = 
      oldKernelParams.kernelRadius !== params.kernelRadius ||
      oldKernelParams.kernelPeakR !== params.kernelPeakR ||
      oldKernelParams.kernelPeakA !== params.kernelPeakA ||
      oldKernelParams.kernelShape !== params.kernelShape;
    
    if (kernelChanged) {
      this.generateKernelTexture();
    }
    
    if (this.simulationMaterial) {
      const uniforms = this.simulationMaterial.uniforms;
      uniforms.u_kernel.value = this.kernelTexture;
      uniforms.u_timeStep.value = params.timeStep;
      uniforms.u_growthCenter.value = params.growthCenter;
      uniforms.u_growthWidth.value = params.growthWidth;
      uniforms.u_growthHeight.value = params.growthHeight;
    }
    
    if (this.renderMaterial) {
      const uniforms = this.renderMaterial.uniforms;
      uniforms.u_colorScheme.value = params.colorScheme === 'grayscale' ? 0 : 
                                    params.colorScheme === 'heatmap' ? 1 : 2;
      uniforms.u_colorA.value = params.customColorA;
      uniforms.u_colorB.value = params.customColorB;
    }
    
    // If initial pattern changed, reset the simulation
    // TODO: Implement reset logic
  }
  
  /**
   * Get uniform updaters for time-based animations
   */
  public getUniformUpdaters(): Record<string, (time: number, deltaTime: number) => void> {
    return {
      u_time: (time: number) => time / 1000.0
    };
  }
  
  /**
   * Perform one simulation step
   * @param renderer The WebGL renderer
   */
  private simulateStep(renderer: THREE.WebGLRenderer): void {
    if (!this.pingPongTargets || !this.simulationMaterial) return;
    
    // Set current state as input
    this.simulationMaterial.uniforms.u_state.value = 
      this.pingPongTargets[this.currentTarget].texture;
    
    // Render to the other target
    const nextTarget = (this.currentTarget + 1) % 2;
    
    this.mesh!.material = this.simulationMaterial;
    renderer.setRenderTarget(this.pingPongTargets[nextTarget]);
    renderer.render(this.scene, this.camera);
    
    // Swap targets
    this.currentTarget = nextTarget;
    this.iterations++;
  }
  
  /**
   * Render the Lenia state to the given target
   * @param renderer The WebGL renderer
   * @param target Optional render target (renders to screen if not provided)
   * @param simSteps Number of simulation steps to perform before rendering
   */
  public render(
    renderer: THREE.WebGLRenderer, 
    target?: THREE.WebGLRenderTarget,
    simSteps: number = 1
  ): void {
    if (!this.simInitialized || !this.pingPongTargets || !this.renderMaterial) return;
    
    // Perform simulation steps
    for (let i = 0; i < simSteps; i++) {
      this.simulateStep(renderer);
    }
    
    // Render the final state with the render material
    this.renderMaterial.uniforms.u_state.value = 
      this.pingPongTargets[this.currentTarget].texture;
    
    this.mesh!.material = this.renderMaterial;
    renderer.setRenderTarget(target || null);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(null);
  }
  
  /**
   * Reset the simulation with a specific pattern
   * @param pattern Pattern to initialize with
   */
  public reset(pattern: string = this.params.initialPattern): void {
    // TODO: Implement reset logic to reinitialize the simulation state
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    super.dispose();
    
    if (this.pingPongTargets) {
      this.pingPongTargets[0].dispose();
      this.pingPongTargets[1].dispose();
      this.pingPongTargets = null;
    }
    
    if (this.kernelTexture) {
      this.kernelTexture.dispose();
      this.kernelTexture = null;
    }
    
    if (this.simulationMaterial) {
      this.simulationMaterial.dispose();
      this.simulationMaterial = null;
    }
    
    if (this.renderMaterial) {
      this.renderMaterial.dispose();
      this.renderMaterial = null;
    }
    
    this.simInitialized = false;
  }
} 