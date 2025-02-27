import * as THREE from 'three';
import { BaseTechnique } from './BaseTechnique';
import { IShaderMaterial } from '../../../core/types/visual';

/**
 * Parameters for the Reaction-Diffusion technique
 */
export interface ReactionDiffusionParams {
  feed: number; // Feed rate
  kill: number; // Kill rate
  diffuseA: number; // Diffusion rate of substance A
  diffuseB: number; // Diffusion rate of substance B
  timestep: number; // Simulation time step
  colorA: THREE.Color; // Color for substance A
  colorB: THREE.Color; // Color for substance B
  initialPattern: 'random' | 'center' | 'spots' | 'custom'; // Initial condition
  customTexture?: THREE.Texture; // Custom initial state texture
}

/**
 * Custom uniform interface that includes an update function
 */
interface IUniformWithUpdate extends THREE.IUniform {
  update?: (time: number, deltaTime?: number) => any;
}

/**
 * Implementation of the Reaction-Diffusion visual technique
 * Based on the Gray-Scott model
 */
export class ReactionDiffusion extends BaseTechnique {
  private params: ReactionDiffusionParams;
  private pingPongTargets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null = null;
  private currentTarget: number = 0;
  private simulationMaterial: IShaderMaterial | null = null;
  private renderMaterial: IShaderMaterial | null = null;
  private initMaterial: IShaderMaterial | null = null;
  private simInitialized: boolean = false;
  private iterations: number = 0;
  private simWidth: number = 512;
  private simHeight: number = 512;
  private webGLRenderer: THREE.WebGLRenderer | null = null;
  
  constructor(id: string) {
    super(id, 'Reaction-Diffusion');
    
    // Default parameters
    this.params = {
      feed: 0.055,
      kill: 0.062,
      diffuseA: 1.0,
      diffuseB: 0.5,
      timestep: 1.0,
      colorA: new THREE.Color(0x000000),
      colorB: new THREE.Color(0xffffff),
      initialPattern: 'center'
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
    
    // Shader to initialize the reaction-diffusion state
    const fragmentShader = `
      uniform vec2 u_resolution;
      uniform int u_pattern;  // 0: random, 1: center, 2: spots, 3: custom
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
        
        // Default state: A=1, B=0
        float A = 1.0;
        float B = 0.0;
        
        // Center of the texture
        vec2 center = u_resolution * 0.5;
        float dist = distance(pixel, center);
        
        if (u_pattern == 0) {
          // Random pattern: small random B concentrations
          if (random(uv) > 0.99) {
            B = 1.0;
            A = 0.0;
          }
        } 
        else if (u_pattern == 1) {
          // Center pattern: B in center region
          if (dist < u_resolution.x * 0.05) {
            B = 1.0;
            A = 0.0;
          }
        }
        else if (u_pattern == 2) {
          // Spots pattern: multiple small spots of B
          float spots = 10.0;
          for (int i = 0; i < 5; i++) {
            for (int j = 0; j < 5; j++) {
              vec2 spotPos = vec2(
                float(i) / 5.0 * u_resolution.x + sin(float(j) * 1.5) * 20.0,
                float(j) / 5.0 * u_resolution.y + cos(float(i) * 1.5) * 20.0
              );
              float spotDist = distance(pixel, spotPos);
              if (spotDist < 5.0) {
                B = 1.0;
                A = 0.0;
              }
            }
          }
        }
        else if (u_pattern == 3) {
          // Custom pattern from texture
          vec4 custom = texture2D(u_customTexture, uv);
          A = custom.r;
          B = custom.g;
        }
        
        // Output RGBA: R = A, G = B, B and A unused
        gl_FragColor = vec4(A, B, 0.0, 1.0);
      }
    `;
    
    const uniforms: { [key: string]: THREE.IUniform } = {
      u_resolution: { value: new THREE.Vector2(this.simWidth, this.simHeight) },
      u_pattern: { value: 1 }, // Default to center pattern
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
   * Create a shader material for the reaction-diffusion simulation
   * @param params Parameters for the simulation
   */
  public createMaterial(params: ReactionDiffusionParams): IShaderMaterial {
    this.params = { ...params };
    
    // Simulation shader for Gray-Scott reaction-diffusion
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    const fragmentShader = `
      uniform sampler2D u_state;
      uniform float u_feed;
      uniform float u_kill;
      uniform float u_diffuseA;
      uniform float u_diffuseB;
      uniform float u_timestep;
      uniform vec2 u_resolution;
      uniform float u_time;
      
      varying vec2 vUv;
      
      void main() {
        // Get normalized pixel size
        vec2 texel = 1.0 / u_resolution;
        
        // Sample the current state at this pixel
        vec4 center = texture2D(u_state, vUv);
        float A = center.r;
        float B = center.g;
        
        // Sample neighbors for Laplacian approximation (3x3 stencil)
        // We'll use a weighted average with more weight to direct neighbors
        float laplaceA = 0.0;
        float laplaceB = 0.0;
        
        // 3x3 convolution kernel for Laplacian approximation
        // Core neighbors (direct adjacent) have weight 0.2
        // Diagonal neighbors have weight 0.05
        // Center is -1.0
        
        // Sample 8 surrounding points
        // North
        vec4 north = texture2D(u_state, vUv + vec2(0.0, texel.y));
        // South
        vec4 south = texture2D(u_state, vUv + vec2(0.0, -texel.y));
        // East
        vec4 east = texture2D(u_state, vUv + vec2(texel.x, 0.0));
        // West
        vec4 west = texture2D(u_state, vUv + vec2(-texel.x, 0.0));
        // NorthEast
        vec4 ne = texture2D(u_state, vUv + vec2(texel.x, texel.y));
        // NorthWest
        vec4 nw = texture2D(u_state, vUv + vec2(-texel.x, texel.y));
        // SouthEast
        vec4 se = texture2D(u_state, vUv + vec2(texel.x, -texel.y));
        // SouthWest
        vec4 sw = texture2D(u_state, vUv + vec2(-texel.x, -texel.y));
        
        // Calculate Laplacian
        laplaceA = north.r * 0.2 + south.r * 0.2 + east.r * 0.2 + west.r * 0.2 +
                  ne.r * 0.05 + nw.r * 0.05 + se.r * 0.05 + sw.r * 0.05 - A;
                  
        laplaceB = north.g * 0.2 + south.g * 0.2 + east.g * 0.2 + west.g * 0.2 +
                  ne.g * 0.05 + nw.g * 0.05 + se.g * 0.05 + sw.g * 0.05 - B;
        
        // Gray-Scott reaction-diffusion equation
        // A and B are the concentrations of two chemicals
        // A is converted to B when A and B meet (B is the catalyst)
        // B is converted back to A at rate k (kill rate)
        // A is added at rate f (feed rate)
        // Both A and B diffuse, but usually A diffuses faster
        
        // Calculate reaction
        float ABB = A * B * B;  // Autocatalytic reaction term (U + 2V -> 3V)
        
        // Update concentrations using Gray-Scott equations
        float nextA = A + u_timestep * (u_diffuseA * laplaceA - ABB + u_feed * (1.0 - A));
        float nextB = B + u_timestep * (u_diffuseB * laplaceB + ABB - (u_kill + u_feed) * B);
        
        // Clamp values to prevent instability
        nextA = clamp(nextA, 0.0, 1.0);
        nextB = clamp(nextB, 0.0, 1.0);
        
        // Output new state
        gl_FragColor = vec4(nextA, nextB, 0.0, 1.0);
      }
    `;
    
    const uniforms: { [key: string]: IUniformWithUpdate } = {
      u_state: { value: null },
      u_feed: { value: params.feed },
      u_kill: { value: params.kill },
      u_diffuseA: { value: params.diffuseA },
      u_diffuseB: { value: params.diffuseB },
      u_timestep: { value: params.timestep },
      u_resolution: { value: new THREE.Vector2(this.simWidth, this.simHeight) },
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
   * Create a material for rendering the reaction-diffusion state
   */
  private createRenderMaterial(): void {
    // This material is used to visualize the reaction-diffusion state
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    const fragmentShader = `
      uniform sampler2D u_state;
      uniform vec3 u_colorA;
      uniform vec3 u_colorB;
      uniform float u_time;
      
      varying vec2 vUv;
      
      // Simplex noise function for organic texture
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
      
      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                            0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                            -0.577350269189626, // -1.0 + 2.0 * C.x
                            0.024390243902439); // 1.0 / 41.0
        vec2 i = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
        m = m*m;
        m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }
      
      void main() {
        // Sample the reaction-diffusion state
        vec4 state = texture2D(u_state, vUv);
        
        // Get substance A and B concentrations
        float A = state.r;
        float B = state.g;
        
        // MRI-like visualization: highlight the patterns formed by substance B
        // We use substance B (catalyst) as it forms the interesting patterns
        float value = B;
        
        // Add subtle noise to make it look more organic, like MRI scan
        float noise = snoise(vUv * 10.0 + u_time * 0.1) * 0.05;
        value = max(0.0, min(1.0, value + noise));
        
        // Create subtle pulsing effect
        float pulse = sin(u_time * 0.5) * 0.03 + 0.97;
        value *= pulse;
        
        // Apply color mapping
        vec3 color = mix(u_colorA, u_colorB, value);
        
        // Add vein-like details
        float veins = snoise(vUv * 15.0 + vec2(0.0, u_time * 0.05)) * 0.1;
        color = mix(color, color * (1.0 + veins), 0.3 * B);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    
    const uniforms: { [key: string]: IUniformWithUpdate } = {
      u_state: { value: null },
      u_colorA: { value: this.params.colorA },
      u_colorB: { value: this.params.colorB },
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
   * Update simulation parameters
   * @param params New parameters
   */
  public updateParams(params: ReactionDiffusionParams): void {
    // Check if the initial pattern changed
    const patternChanged = this.params.initialPattern !== params.initialPattern;
    const customTextureChanged = params.customTexture !== this.params.customTexture && 
                               params.initialPattern === 'custom';
    
    this.params = { ...params };
    
    if (this.simulationMaterial) {
      const uniforms = this.simulationMaterial.uniforms;
      uniforms.u_feed.value = params.feed;
      uniforms.u_kill.value = params.kill;
      uniforms.u_diffuseA.value = params.diffuseA;
      uniforms.u_diffuseB.value = params.diffuseB;
      uniforms.u_timestep.value = params.timestep;
    }
    
    if (this.renderMaterial) {
      const uniforms = this.renderMaterial.uniforms;
      uniforms.u_colorA.value = params.colorA;
      uniforms.u_colorB.value = params.colorB;
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
   * Render the reaction-diffusion state to the given target
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
   * Reset the simulation state
   * @param pattern Pattern to initialize with
   */
  public reset(pattern: string = this.params.initialPattern): void {
    if (!this.pingPongTargets || !this.initMaterial || !this.mesh || !this.webGLRenderer) return;
    
    // Set pattern type in initialization shader
    this.initMaterial.uniforms.u_pattern.value = 
      pattern === 'random' ? 0 :
      pattern === 'center' ? 1 :
      pattern === 'spots' ? 2 : 3;
    
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
    
    this.simInitialized = false;
  }
} 