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
  private initMaterial: IShaderMaterial | null = null;
  private simInitialized: boolean = false;
  private iterations: number = 0;
  private simWidth: number = 256;
  private simHeight: number = 256;
  private webGLRenderer: THREE.WebGLRenderer | null = null;
  
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
    
    // Store renderer reference
    this.webGLRenderer = renderer;
    
    // Create ping-pong render targets for simulation
    const width = this.simWidth;
    const height = this.simHeight;
    
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
    
    // Create initialization material
    this.createInitMaterial();
    
    // Initialize simulation state
    this.reset(this.params.initialPattern);
    
    this.simInitialized = true;
  }
  
  /**
   * Create a shader material for initializing the simulation state
   */
  private createInitMaterial(): void {
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    // Shader to initialize the Lenia state
    const fragmentShader = `
      uniform vec2 u_resolution;
      uniform int u_pattern;  // 0: random, 1: circle, 2: glider, 3: custom
      uniform sampler2D u_customTexture;
      uniform float u_seed;
      
      varying vec2 vUv;
      
      // Random function
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123 + u_seed);
      }
      
      void main() {
        vec2 uv = vUv;
        vec2 pixel = vUv * u_resolution;
        
        // Default state: empty (0.0)
        float state = 0.0;
        
        // Center of the texture
        vec2 center = u_resolution * 0.5;
        float dist = distance(pixel, center);
        
        if (u_pattern == 0) {
          // Random pattern
          state = random(uv) < 0.1 ? random(uv + 0.1) : 0.0;
        } 
        else if (u_pattern == 1) {
          // Circle pattern
          if (dist < u_resolution.x * 0.1) {
            state = smoothstep(u_resolution.x * 0.1, u_resolution.x * 0.05, dist);
          }
        }
        else if (u_pattern == 2) {
          // Glider-like pattern (a small asymmetric blob)
          vec2 offset = center - vec2(0.0, 20.0);
          float d1 = distance(pixel, offset);
          float d2 = distance(pixel, offset + vec2(10.0, 5.0));
          float d3 = distance(pixel, offset + vec2(-5.0, 5.0));
          
          state = smoothstep(10.0, 5.0, d1) * 0.8;
          state = max(state, smoothstep(8.0, 4.0, d2) * 0.7);
          state = max(state, smoothstep(7.0, 3.0, d3) * 0.9);
        }
        else if (u_pattern == 3) {
          // Custom pattern from texture
          vec4 custom = texture2D(u_customTexture, uv);
          state = custom.r;
        }
        
        // Output state in R channel, other channels unused
        gl_FragColor = vec4(state, 0.0, 0.0, 1.0);
      }
    `;
    
    const uniforms: { [key: string]: THREE.IUniform } = {
      u_resolution: { value: new THREE.Vector2(this.simWidth, this.simHeight) },
      u_pattern: { value: 1 }, // Default to circle pattern
      u_customTexture: { value: null },
      u_seed: { value: Math.random() * 100 }
    };
    
    this.initMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms
    }) as IShaderMaterial;
  }
  
  /**
   * Create a shader material for the Lenia simulation
   * @param params Parameters for the simulation
   */
  public createMaterial(params: LeniaParams): IShaderMaterial {
    this.params = { ...params };
    
    // Regenerate kernel with updated parameters
    this.generateKernelTexture();
    
    // Simulation shader for Lenia continuous cellular automata
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
      uniform float u_kernelRadius;
      
      varying vec2 vUv;
      
      // Growth function (bell curve)
      float growth(float x, float center, float width, float height) {
        return height * exp(-pow((x - center) / width, 2.0) * 2.0);
      }
      
      void main() {
        // Get normalized pixel coordinates
        vec2 uv = vUv;
        
        // Get current state at this pixel
        float state = texture2D(u_state, uv).r;
        
        // Calculate potential field from convolution with kernel
        float potential = 0.0;
        
        // Normalized pixel size (1/resolution)
        vec2 texel = 1.0 / u_resolution;
        
        // Kernel radius in pixels
        float radius = u_kernelRadius;
        
        // Perform convolution with kernel texture
        // Loop over kernel neighborhood
        for (float dy = -radius; dy <= radius; dy += 1.0) {
          for (float dx = -radius; dx <= radius; dx += 1.0) {
            // Calculate offset for kernel sampling
            vec2 kernelUV = vec2(
              (dx + radius) / (2.0 * radius + 1.0),
              (dy + radius) / (2.0 * radius + 1.0)
            );
            
            // Sample kernel weight at this offset
            float weight = texture2D(u_kernel, kernelUV).r;
            
            // Sample state with wrapped (torus) boundary conditions
            vec2 sampleUV = fract(uv + vec2(dx, dy) * texel);
            float neighborState = texture2D(u_state, sampleUV).r;
            
            // Accumulate weighted contribution
            potential += neighborState * weight;
          }
        }
        
        // Apply growth function to get state change
        float deltaState = growth(potential, u_growthCenter, u_growthWidth, u_growthHeight);
        
        // Update state with time step
        float newState = state + deltaState * u_timeStep;
        
        // Clamp to [0, 1] range
        newState = clamp(newState, 0.0, 1.0);
        
        // Output new state
        gl_FragColor = vec4(newState, 0.0, 0.0, 1.0);
      }
    `;
    
    const uniforms: { [key: string]: IUniformWithUpdate } = {
      u_state: { value: null },
      u_kernel: { value: this.kernelTexture },
      u_timeStep: { value: params.timeStep },
      u_growthCenter: { value: params.growthCenter },
      u_growthWidth: { value: params.growthWidth },
      u_growthHeight: { value: params.growthHeight },
      u_resolution: { value: new THREE.Vector2(this.simWidth, this.simHeight) },
      u_kernelRadius: { value: params.kernelRadius },
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
    
    // Create rendering material for visualization
    this.createRenderMaterial();
    
    return this.simulationMaterial;
  }
  
  /**
   * Create a material for rendering the Lenia state
   */
  private createRenderMaterial(): void {
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
      uniform float u_time;
      
      varying vec2 vUv;
      
      // Helper function to map a value from one range to another
      float map(float value, float min1, float max1, float min2, float max2) {
        return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
      }
      
      // Heatmap color mapping
      vec3 heatmap(float t) {
        // Smooth transitions: blue -> cyan -> green -> yellow -> red
        vec3 color = vec3(0.0);
        
        if (t < 0.25) {
          color = mix(vec3(0.0, 0.0, 0.5), vec3(0.0, 0.5, 0.5), map(t, 0.0, 0.25, 0.0, 1.0));
        } else if (t < 0.5) {
          color = mix(vec3(0.0, 0.5, 0.5), vec3(0.0, 0.5, 0.0), map(t, 0.25, 0.5, 0.0, 1.0));
        } else if (t < 0.75) {
          color = mix(vec3(0.0, 0.5, 0.0), vec3(0.5, 0.5, 0.0), map(t, 0.5, 0.75, 0.0, 1.0));
        } else {
          color = mix(vec3(0.5, 0.5, 0.0), vec3(0.5, 0.0, 0.0), map(t, 0.75, 1.0, 0.0, 1.0));
        }
        
        return color;
      }
      
      // Simplex noise for organic look
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
      
      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m;
        m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }
      
      void main() {
        // Sample the Lenia state
        float state = texture2D(u_state, vUv).r;
        
        // Add subtle organic noise
        float noise = snoise(vUv * 20.0 + u_time * 0.1) * 0.05;
        state = clamp(state + noise * state, 0.0, 1.0);
        
        // Add subtle pulsing
        float pulse = sin(u_time * 0.3) * 0.03 + 0.97;
        state *= pulse;
        
        // Apply color mapping based on scheme
        vec3 color;
        
        if (u_colorScheme == 0) {
          // Grayscale
          color = vec3(state);
        } else if (u_colorScheme == 1) {
          // Heatmap
          color = heatmap(state);
        } else {
          // Custom color mapping
          color = mix(u_colorA, u_colorB, state);
        }
        
        // Add "glow" effect for living cells
        if (state > 0.1) {
          float glow = state * 0.3 * (sin(u_time * 0.5) * 0.1 + 0.9);
          color += vec3(glow * 0.1, glow * 0.15, glow * 0.05);
        }
        
        // Output final color
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
      u_colorB: { value: this.params.customColorB },
      u_time: { 
        value: 0.0,
        update: (time: number) => time / 1000.0
      }
    };
    
    this.renderMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms
    }) as IShaderMaterial;
  }
  
  /**
   * Generate kernel texture for Lenia
   * The kernel is a bell-shaped function with a peak at radius r
   */
  private generateKernelTexture(): void {
    const kernelSize = this.params.kernelRadius * 2 + 1;
    const data = new Float32Array(kernelSize * kernelSize * 4);
    
    const center = this.params.kernelRadius;
    const peakR = this.params.kernelPeakR;  // Normalized peak location (0 to 1)
    const peakA = this.params.kernelPeakA;  // Peak value
    const shape = this.params.kernelShape;  // Controls how sharply the bell curve falls off
    
    // Kernel normalization factor
    let sum = 0.0;
    
    // First pass: calculate kernel values
    for (let y = 0; y < kernelSize; y++) {
      for (let x = 0; x < kernelSize; x++) {
        const index = (y * kernelSize + x) * 4;
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const normDist = Math.min(dist / this.params.kernelRadius, 1.0);
        
        // Bell-shaped kernel function
        // Gaussian-like curve centered at peakR
        let value = 0.0;
        if (normDist <= 1.0) {
          value = peakA * Math.exp(-Math.pow(normDist - peakR, 2) * shape);
        }
        
        data[index] = value;
        data[index + 1] = value;
        data[index + 2] = value;
        data[index + 3] = 1.0;
        
        sum += value;
      }
    }
    
    // Second pass: normalize kernel so values sum to 1
    if (sum > 0) {
      const normFactor = 1.0 / sum;
      for (let i = 0; i < kernelSize * kernelSize; i++) {
        const index = i * 4;
        data[index] *= normFactor;
        data[index + 1] *= normFactor;
        data[index + 2] *= normFactor;
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
    // Check if kernel parameters changed
    const kernelChanged = 
      this.params.kernelRadius !== params.kernelRadius ||
      this.params.kernelPeakR !== params.kernelPeakR ||
      this.params.kernelPeakA !== params.kernelPeakA ||
      this.params.kernelShape !== params.kernelShape;
      
    // Check if initial pattern changed
    const patternChanged = this.params.initialPattern !== params.initialPattern;
    const customTextureChanged = params.customTexture !== this.params.customTexture && 
                               params.initialPattern === 'custom';
    
    this.params = { ...params };
    
    // Regenerate kernel if needed
    if (kernelChanged) {
      this.generateKernelTexture();
    }
    
    if (this.simulationMaterial) {
      const uniforms = this.simulationMaterial.uniforms;
      
      // Update kernel texture if it was regenerated
      if (kernelChanged) {
        uniforms.u_kernel.value = this.kernelTexture;
      }
      
      // Update other parameters
      uniforms.u_timeStep.value = params.timeStep;
      uniforms.u_growthCenter.value = params.growthCenter;
      uniforms.u_growthWidth.value = params.growthWidth;
      uniforms.u_growthHeight.value = params.growthHeight;
      uniforms.u_kernelRadius.value = params.kernelRadius;
    }
    
    if (this.renderMaterial) {
      const uniforms = this.renderMaterial.uniforms;
      uniforms.u_colorScheme.value = 
        params.colorScheme === 'grayscale' ? 0 : 
        params.colorScheme === 'heatmap' ? 1 : 2;
      uniforms.u_colorA.value = params.customColorA;
      uniforms.u_colorB.value = params.customColorB;
    }
    
    // If initial pattern changed, reset the simulation
    if (patternChanged || customTextureChanged) {
      this.reset(params.initialPattern);
    }
  }
  
  /**
   * Get uniform updaters for time-based animations
   */
  public getUniformUpdaters(): Record<string, (time: number, deltaTime: number) => void> {
    return {
      u_time: (time: number) => {
        if (this.simulationMaterial) {
          this.simulationMaterial.uniforms.u_time.value = time / 1000.0;
        }
        if (this.renderMaterial) {
          this.renderMaterial.uniforms.u_time.value = time / 1000.0;
        }
      }
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
    if (!this.pingPongTargets || !this.initMaterial || !this.mesh || !this.webGLRenderer) return;
    
    // Set pattern type in initialization shader
    this.initMaterial.uniforms.u_pattern.value = 
      pattern === 'random' ? 0 :
      pattern === 'circle' ? 1 :
      pattern === 'glider' ? 2 : 3;
    
    // If using custom texture, set it
    if (pattern === 'custom' && this.params.customTexture) {
      this.initMaterial.uniforms.u_customTexture.value = this.params.customTexture;
    }
    
    // Randomize seed for initialization
    this.initMaterial.uniforms.u_seed.value = Math.random() * 100;
    
    // Render initialization shader to first target
    this.mesh.material = this.initMaterial;
    this.currentTarget = 0;
    
    // Render to both ping pong targets to initialize them both
    for (let i = 0; i < 2; i++) {
      this.mesh.material = this.initMaterial;
      this.webGLRenderer.setRenderTarget(this.pingPongTargets[i]);
      this.webGLRenderer.render(this.scene, this.camera);
    }
    
    this.webGLRenderer.setRenderTarget(null);
    this.iterations = 0;
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
    
    if (this.initMaterial) {
      this.initMaterial.dispose();
      this.initMaterial = null;
    }
    
    this.webGLRenderer = null;
    this.simInitialized = false;
  }
} 