import * as THREE from 'three';
import { BaseTechnique } from './BaseTechnique';
import { IShaderMaterial } from '../../../core/types/visual';

/**
 * Enum for Lenia initial pattern types
 */
export enum PatternType {
  Random = 'random',
  Circle = 'circle',
  Glider = 'glider',
  Custom = 'custom'
}

/**
 * Enum for color scheme visualization options
 */
export enum ColorScheme {
  Grayscale = 'grayscale',
  Heatmap = 'heatmap',
  Custom = 'custom'
}

/**
 * Type for normalized parameter values (0.0 to 1.0)
 */
export type NormalizedValue = number;

/**
 * Type for positive number values (greater than 0)
 */
export type PositiveNumber = number;

/**
 * Type for simulation dimensions (power of 2 recommended)
 */
export type SimulationDimension = 128 | 256 | 512 | 1024;

/**
 * Parameters for the Lenia technique (continuous cellular automata)
 */
export interface LeniaParams {
  /**
   * Radius of the convolution kernel (affects pattern formation)
   * @minimum 3
   * @maximum 21
   */
  kernelRadius: PositiveNumber;

  /**
   * Location of the peak in the kernel function (0 to 1)
   * Controls where maximum growth occurs in neighborhood
   * @minimum 0.0
   * @maximum 1.0
   */
  kernelPeakR: NormalizedValue;

  /**
   * Peak value in the kernel function (amplitude)
   * Controls intensity of neighborhood influence
   * @minimum 0.1
   * @maximum 2.0
   */
  kernelPeakA: PositiveNumber;

  /**
   * Kernel shape parameter (controls curve steepness)
   * Higher values create more defined boundaries
   * @minimum 1.0
   * @maximum 12.0
   */
  kernelShape: PositiveNumber;

  /**
   * Center of the growth mapping function
   * Controls the state value for maximum growth
   * @minimum 0.0
   * @maximum 1.0
   */
  growthCenter: NormalizedValue;

  /**
   * Width of the growth mapping function
   * Controls sensitivity to different state values
   * @minimum 0.001
   * @maximum 0.1
   */
  growthWidth: PositiveNumber;

  /**
   * Height of the growth mapping function (amplitude)
   * Controls maximum possible growth rate
   * @minimum 0.01
   * @maximum 0.3
   */
  growthHeight: PositiveNumber;

  /**
   * Time delta per frame
   * Controls simulation speed
   * @minimum 0.01
   * @maximum 0.5
   */
  timeStep: PositiveNumber;

  /**
   * Initial state pattern
   */
  initialPattern: PatternType;

  /**
   * Visualization color scheme
   */
  colorScheme: ColorScheme;

  /**
   * First color for custom color scheme
   */
  customColorA: THREE.Color;

  /**
   * Second color for custom color scheme
   */
  customColorB: THREE.Color;

  /**
   * Custom initial state texture (only used when initialPattern is 'custom')
   */
  customTexture?: THREE.Texture;
}

/**
 * Custom uniform interface that includes an update function
 */
interface IUniformWithUpdate extends THREE.IUniform {
  update?: (time: number, deltaTime?: number) => void;
  type?: string;
}

/**
 * Creates default parameters for Lenia
 * @returns Default Lenia parameters
 */
export function createDefaultLeniaParams(): LeniaParams {
  return {
    kernelRadius: 13,
    kernelPeakR: 0.5,
    kernelPeakA: 1.0,
    kernelShape: 4.0,
    growthCenter: 0.15,
    growthWidth: 0.015,
    growthHeight: 0.15,
    timeStep: 0.1,
    initialPattern: PatternType.Circle,
    colorScheme: ColorScheme.Heatmap,
    customColorA: new THREE.Color(0x000000),
    customColorB: new THREE.Color(0xffffff)
  };
}

/**
 * Type guard to check if a value is a valid PatternType
 * @param value Value to check
 * @returns True if the value is a valid pattern type
 */
function isValidPatternType(value: string): value is PatternType {
  return Object.values(PatternType).includes(value as PatternType);
}

/**
 * Type guard to check if a value is a valid ColorScheme
 * @param value Value to check
 * @returns True if the value is a valid color scheme
 */
function isValidColorScheme(value: string): value is ColorScheme {
  return Object.values(ColorScheme).includes(value as ColorScheme);
}

/**
 * Clamps a normalized value to the 0-1 range
 * @param value Value to clamp
 * @returns Clamped value between 0 and 1
 */
function clampNormalized(value: number): NormalizedValue {
  return Math.max(0, Math.min(1, value));
}

/**
 * Ensures a value is positive (minimum 0.001)
 * @param value Value to check
 * @param minValue Minimum allowed value (defaults to 0.001)
 * @returns Value clamped to be at least minValue
 */
function ensurePositive(value: number, minValue: number = 0.001): PositiveNumber {
  return Math.max(minValue, value);
}

/**
 * Implementation of Lenia - a continuous, smooth cellular automata system
 * that produces lifelike organisms and patterns
 */
export class Lenia extends BaseTechnique {
  /**
   * Current simulation parameters
   */
  private params: LeniaParams;

  /**
   * Ping-pong render targets for simulation steps
   */
  private pingPongTargets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null = null;

  /**
   * Precomputed kernel texture
   */
  private kernelTexture: THREE.DataTexture | null = null;

  /**
   * Current active target index (0 or 1)
   */
  private currentTarget: number = 0;

  /**
   * Material for simulation step calculations
   */
  private simulationMaterial: IShaderMaterial | null = null;

  /**
   * Material for final rendering
   */
  private renderMaterial: IShaderMaterial | null = null;

  /**
   * Material for initializing simulation state
   */
  private initMaterial: IShaderMaterial | null = null;

  /**
   * Whether simulation has been initialized
   */
  private simInitialized: boolean = false;

  /**
   * Simulation iteration counter
   */
  private iterations: number = 0;

  /**
   * Simulation width in pixels
   */
  private simWidth: number = 256;

  /**
   * Simulation height in pixels
   */
  private simHeight: number = 256;

  /**
   * Reference to WebGL renderer
   */
  private webGLRenderer: THREE.WebGLRenderer | null = null;
  
  /**
   * Creates a new Lenia instance
   * @param id Unique identifier for this technique
   */
  constructor(id: string) {
    super(id, 'Lenia');
    
    // Default parameters
    this.params = createDefaultLeniaParams();
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
   * @returns Lenia simulation shader material
   */
  public createMaterial(params: Partial<LeniaParams>): IShaderMaterial {
    // Merge with default parameters
    const defaultParams = createDefaultLeniaParams();
    const mergedParams: LeniaParams = {
      ...defaultParams,
      ...params
    };
    
    // Validate and sanitize parameters
    mergedParams.kernelRadius = Math.floor(ensurePositive(mergedParams.kernelRadius, 3));
    mergedParams.kernelPeakR = clampNormalized(mergedParams.kernelPeakR);
    mergedParams.kernelPeakA = ensurePositive(mergedParams.kernelPeakA, 0.1);
    mergedParams.kernelShape = ensurePositive(mergedParams.kernelShape, 1.0);
    mergedParams.growthCenter = clampNormalized(mergedParams.growthCenter);
    mergedParams.growthWidth = ensurePositive(mergedParams.growthWidth, 0.001);
    mergedParams.growthHeight = ensurePositive(mergedParams.growthHeight, 0.01);
    mergedParams.timeStep = ensurePositive(mergedParams.timeStep, 0.01);
    
    // Validate enum values
    if (typeof mergedParams.initialPattern === 'string' && !isValidPatternType(mergedParams.initialPattern)) {
      console.warn(`Invalid initialPattern: ${mergedParams.initialPattern}. Using default: circle`);
      mergedParams.initialPattern = PatternType.Circle;
    }
    
    if (typeof mergedParams.colorScheme === 'string' && !isValidColorScheme(mergedParams.colorScheme)) {
      console.warn(`Invalid colorScheme: ${mergedParams.colorScheme}. Using default: heatmap`);
      mergedParams.colorScheme = ColorScheme.Heatmap;
    }
    
    // Store validated parameters
    this.params = mergedParams;
    
    // Regenerate kernel with updated parameters
    this.generateKernelTexture();
    
    // Create a new simulation material if it doesn't exist
    if (!this.simulationMaterial) {
      this.simulationMaterial = this.createSimulationMaterial();
    }
    
    // Create a new render material if it doesn't exist
    if (!this.renderMaterial) {
      this.createRenderMaterial();
    }
    
    // Return the render material for visualization
    return this.renderMaterial as IShaderMaterial;
  }
  
  /**
   * Create a shader material for rendering the Lenia state
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
        value: this.params.colorScheme === ColorScheme.Grayscale ? 0 : 
               this.params.colorScheme === ColorScheme.Heatmap ? 1 : 2 
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
   * Create a shader material for the Lenia simulation
   * @param params Parameters for the simulation
   */
  private createSimulationMaterial(): IShaderMaterial {
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
    
    // Ensure params is initialized before accessing
    if (!this.params) {
      this.params = createDefaultLeniaParams();
    }
    
    const uniforms: { [key: string]: IUniformWithUpdate } = {
      u_state: { value: null },
      u_kernel: { value: this.kernelTexture },
      u_timeStep: { value: this.params.timeStep },
      u_growthCenter: { value: this.params.growthCenter },
      u_growthWidth: { value: this.params.growthWidth },
      u_growthHeight: { value: this.params.growthHeight },
      u_resolution: { value: new THREE.Vector2(this.simWidth, this.simHeight) },
      u_kernelRadius: { value: this.params.kernelRadius },
      u_time: { 
        value: 0.0,
        update: (time: number) => time / 1000.0
      }
    };
    
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms
    }) as IShaderMaterial;
  }
  
  /**
   * Update simulation parameters
   * @param params New parameters to apply
   */
  public updateParams(params: Partial<LeniaParams>): void {
    // Merge with existing parameters
    this.params = {
      ...this.params,
      ...params
    };
    
    // Validate and sanitize parameters
    this.params.kernelRadius = Math.floor(ensurePositive(this.params.kernelRadius, 3));
    this.params.kernelPeakR = clampNormalized(this.params.kernelPeakR);
    this.params.kernelPeakA = ensurePositive(this.params.kernelPeakA, 0.1);
    this.params.kernelShape = ensurePositive(this.params.kernelShape, 1.0);
    this.params.growthCenter = clampNormalized(this.params.growthCenter);
    this.params.growthWidth = ensurePositive(this.params.growthWidth, 0.001);
    this.params.growthHeight = ensurePositive(this.params.growthHeight, 0.01);
    this.params.timeStep = ensurePositive(this.params.timeStep, 0.01);
    
    // Validate enum values
    if (typeof this.params.initialPattern === 'string' && !isValidPatternType(this.params.initialPattern)) {
      console.warn(`Invalid initialPattern: ${this.params.initialPattern}. Using default: circle`);
      this.params.initialPattern = PatternType.Circle;
    }
    
    if (typeof this.params.colorScheme === 'string' && !isValidColorScheme(this.params.colorScheme)) {
      console.warn(`Invalid colorScheme: ${this.params.colorScheme}. Using default: heatmap`);
      this.params.colorScheme = ColorScheme.Heatmap;
    }
    
    // Update visual parameters
    if (this.simulationMaterial && this.simulationMaterial.uniforms) {
      // Apply sanitized parameters to uniforms
      if (this.simulationMaterial.uniforms.u_growthCenter) {
        this.simulationMaterial.uniforms.u_growthCenter.value = this.params.growthCenter;
      }
      
      if (this.simulationMaterial.uniforms.u_growthWidth) {
        this.simulationMaterial.uniforms.u_growthWidth.value = this.params.growthWidth;
      }
      
      if (this.simulationMaterial.uniforms.u_growthHeight) {
        this.simulationMaterial.uniforms.u_growthHeight.value = this.params.growthHeight;
      }
      
      if (this.simulationMaterial.uniforms.u_timeStep) {
        this.simulationMaterial.uniforms.u_timeStep.value = this.params.timeStep;
      }
      
      if (this.simulationMaterial.uniforms.u_kernelRadius) {
        this.simulationMaterial.uniforms.u_kernelRadius.value = this.params.kernelRadius;
      }
    }
    
    if (this.renderMaterial && this.renderMaterial.uniforms) {
      // Convert color scheme to integer for shader
      let colorSchemeValue: number;
      switch (this.params.colorScheme) {
        case ColorScheme.Grayscale:
          colorSchemeValue = 0;
          break;
        case ColorScheme.Heatmap:
          colorSchemeValue = 1;
          break;
        case ColorScheme.Custom:
          colorSchemeValue = 2;
          break;
        default:
          colorSchemeValue = 1; // Default to heatmap
      }
      
      if (this.renderMaterial.uniforms.u_colorScheme) {
        this.renderMaterial.uniforms.u_colorScheme.value = colorSchemeValue;
      }
      
      if (this.renderMaterial.uniforms.u_customColorA) {
        this.renderMaterial.uniforms.u_customColorA.value = this.params.customColorA;
      }
      
      if (this.renderMaterial.uniforms.u_customColorB) {
        this.renderMaterial.uniforms.u_customColorB.value = this.params.customColorB;
      }
    }
    
    // Regenerate kernel if kernel parameters changed
    this.generateKernelTexture();
  }
  
  /**
   * Get uniform updaters for this technique
   * @returns Record of uniform update functions
   */
  public getUniformUpdaters(): Record<string, (time: number, deltaTime: number) => void> {
    return {
      u_time: (time: number) => {
        // Update time uniform in simulation material
        if (this.simulationMaterial && this.simulationMaterial.uniforms && 
            this.simulationMaterial.uniforms.u_time) {
          this.simulationMaterial.uniforms.u_time.value = time / 1000;
        }
      }
    };
  }
  
  /**
   * Perform a simulation step
   * @param renderer WebGL renderer
   */
  private simulateStep(renderer: THREE.WebGLRenderer): void {
    // Ensure simulation is initialized
    if (!this.simInitialized || !this.pingPongTargets || 
        !this.simulationMaterial || !this.simulationMaterial.uniforms) {
      return;
    }
    
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
   * Render the Lenia simulation
   * @param renderer WebGL renderer
   * @param target Optional render target (renders to screen if not provided)
   * @param simSteps Number of simulation steps to run before rendering
   */
  public render(
    renderer: THREE.WebGLRenderer, 
    target?: THREE.WebGLRenderTarget,
    simSteps: number = 1
  ): void {
    // Ensure simulation is initialized with all required objects
    if (!this.simInitialized || 
        !renderer || 
        !this.renderMaterial || 
        !this.pingPongTargets || 
        !this.mesh ||
        !this.scene ||
        !this.camera) {
      console.warn("Lenia render called before full initialization");
      return;
    }
    
    // At this point, we've confirmed that none of these objects are null
    
    // Perform simulation steps
    for (let i = 0; i < simSteps; i++) {
      this.simulateStep(renderer);
    }
    
    // Increment iteration counter
    this.iterations += simSteps;
    
    // Set current state as input texture - using non-null assertion since we've already checked
    if (this.renderMaterial.uniforms.u_state) {
      this.renderMaterial.uniforms.u_state.value = this.pingPongTargets[this.currentTarget].texture;
    }
    
    // Set material to mesh - using non-null assertion since we've already checked
    this.mesh.material = this.renderMaterial;
    
    // Render to the target or to the screen if no target provided
    renderer.setRenderTarget(target || null);
    renderer.render(this.scene, this.camera);
  }
  
  /**
   * Reset the simulation to an initial state
   * @param pattern Pattern type to initialize with
   */
  public reset(pattern: string = this.params.initialPattern): void {
    // Ensure simulation materials exist
    if (!this.webGLRenderer || !this.initMaterial || !this.pingPongTargets) {
      // If not initialized yet, store the pattern and return
      if (this.params && isValidPatternType(pattern as PatternType)) {
        this.params.initialPattern = pattern as PatternType;
      }
      return;
    }
    
    // Convert pattern to numerical value for the shader
    let patternValue: number;
    switch (pattern) {
      case PatternType.Random:
        patternValue = 0;
        break;
      case PatternType.Circle:
        patternValue = 1;
        break;
      case PatternType.Glider:
        patternValue = 2;
        break;
      case PatternType.Custom:
        patternValue = 3;
        break;
      default:
        patternValue = 1; // Default to circle pattern
    }
    
    // Update pattern in initMaterial
    if (this.initMaterial.uniforms && this.initMaterial.uniforms.u_pattern) {
      this.initMaterial.uniforms.u_pattern.value = patternValue;
    }
    
    // Update custom texture if provided
    if (pattern === PatternType.Custom && this.params.customTexture && 
        this.initMaterial.uniforms && this.initMaterial.uniforms.u_customTexture) {
      this.initMaterial.uniforms.u_customTexture.value = this.params.customTexture;
    }
    
    // Update random seed
    if (this.initMaterial.uniforms && this.initMaterial.uniforms.u_seed) {
      this.initMaterial.uniforms.u_seed.value = Math.random() * 100;
    }
    
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
   * Dispose of all resources used by this technique
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