import * as THREE from 'three';
import { BaseTechnique } from './BaseTechnique';
import { IShaderMaterial } from '../../../core/types/visual';

// Define shader constants
// Base vertex shader used for all passes
const BASE_VERTEX_SHADER = `
  varying vec2 v_uv;
  
  void main() {
    v_uv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Shader for clearing render targets
const CLEAR_FRAG_SHADER = `
  uniform vec4 u_clearColor;
  
  void main() {
    gl_FragColor = u_clearColor;
  }
`;

// Shader for advection step
const ADVECTION_FRAG_SHADER = `
  precision highp float;
  
  varying vec2 v_uv;
  uniform sampler2D u_velocity;
  uniform sampler2D u_source;
  uniform vec2 u_texelSize;
  uniform float u_dt;
  uniform float u_dissipation;
  
  void main() {
    vec2 coord = v_uv - u_dt * texture2D(u_velocity, v_uv).xy * u_texelSize;
    gl_FragColor = u_dissipation * texture2D(u_source, coord);
  }
`;

// Shader for computing divergence
const DIVERGENCE_FRAG_SHADER = `
  precision highp float;
  
  varying vec2 v_uv;
  uniform sampler2D u_velocity;
  uniform vec2 u_texelSize;
  
  void main() {
    vec2 L = texture2D(u_velocity, v_uv - vec2(u_texelSize.x, 0.0)).xy;
    vec2 R = texture2D(u_velocity, v_uv + vec2(u_texelSize.x, 0.0)).xy;
    vec2 T = texture2D(u_velocity, v_uv + vec2(0.0, u_texelSize.y)).xy;
    vec2 B = texture2D(u_velocity, v_uv - vec2(0.0, u_texelSize.y)).xy;
    
    float divergence = 0.5 * ((R.x - L.x) + (T.y - B.y));
    gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
  }
`;

// Shader for pressure solve step
const PRESSURE_FRAG_SHADER = `
  precision highp float;
  
  varying vec2 v_uv;
  uniform sampler2D u_pressure;
  uniform sampler2D u_divergence;
  uniform vec2 u_texelSize;
  
  void main() {
    float L = texture2D(u_pressure, v_uv - vec2(u_texelSize.x, 0.0)).x;
    float R = texture2D(u_pressure, v_uv + vec2(u_texelSize.x, 0.0)).x;
    float T = texture2D(u_pressure, v_uv + vec2(0.0, u_texelSize.y)).x;
    float B = texture2D(u_pressure, v_uv - vec2(0.0, u_texelSize.y)).x;
    float divergence = texture2D(u_divergence, v_uv).x;
    
    float pressure = (L + R + T + B - divergence) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`;

// Shader for subtracting pressure gradient
const GRADIENT_SUBTRACT_FRAG_SHADER = `
  precision highp float;
  
  varying vec2 v_uv;
  uniform sampler2D u_pressure;
  uniform sampler2D u_velocity;
  uniform vec2 u_texelSize;
  
  void main() {
    float L = texture2D(u_pressure, v_uv - vec2(u_texelSize.x, 0.0)).x;
    float R = texture2D(u_pressure, v_uv + vec2(u_texelSize.x, 0.0)).x;
    float T = texture2D(u_pressure, v_uv + vec2(0.0, u_texelSize.y)).x;
    float B = texture2D(u_pressure, v_uv - vec2(0.0, u_texelSize.y)).x;
    
    vec2 velocity = texture2D(u_velocity, v_uv).xy;
    velocity.xy -= 0.5 * vec2(R - L, T - B);
    
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

// Shader for curl computation
const CURL_FRAG_SHADER = `
  precision highp float;
  
  varying vec2 v_uv;
  uniform sampler2D u_velocity;
  uniform vec2 u_texelSize;
  
  void main() {
    float L = texture2D(u_velocity, v_uv - vec2(u_texelSize.x, 0.0)).y;
    float R = texture2D(u_velocity, v_uv + vec2(u_texelSize.x, 0.0)).y;
    float T = texture2D(u_velocity, v_uv + vec2(0.0, u_texelSize.y)).x;
    float B = texture2D(u_velocity, v_uv - vec2(0.0, u_texelSize.y)).x;
    
    float curl = (R - L) - (T - B);
    gl_FragColor = vec4(curl, 0.0, 0.0, 1.0);
  }
`;

// Shader for vorticity confinement
const VORTICITY_FRAG_SHADER = `
  precision highp float;
  
  varying vec2 v_uv;
  uniform sampler2D u_velocity;
  uniform sampler2D u_curl;
  uniform vec2 u_texelSize;
  uniform float u_curlStrength;
  uniform float u_dt;
  
  void main() {
    float L = texture2D(u_curl, v_uv - vec2(u_texelSize.x, 0.0)).x;
    float R = texture2D(u_curl, v_uv + vec2(u_texelSize.x, 0.0)).x;
    float T = texture2D(u_curl, v_uv + vec2(0.0, u_texelSize.y)).x;
    float B = texture2D(u_curl, v_uv - vec2(0.0, u_texelSize.y)).x;
    float C = texture2D(u_curl, v_uv).x;
    
    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force = normalize(force + 0.00001) * vec2(1.0, -1.0);
    force *= u_curlStrength * C;
    
    vec2 velocity = texture2D(u_velocity, v_uv).xy;
    velocity += force * u_dt;
    
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

// Shader for adding external forces
const ADD_FORCE_FRAG_SHADER = `
  precision highp float;
  
  varying vec2 v_uv;
  uniform sampler2D u_velocity;
  uniform vec2 u_point;
  uniform vec2 u_force;
  uniform float u_radius;
  
  void main() {
    vec2 velocity = texture2D(u_velocity, v_uv).xy;
    vec2 pos = v_uv - u_point;
    float dist = length(pos);
    
    if (dist < u_radius) {
      float factor = 1.0 - (dist / u_radius);
      factor = smoothstep(0.0, 1.0, factor);
      velocity += factor * u_force;
    }
    
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

// Shader for adding dye (color)
const ADD_DYE_FRAG_SHADER = `
  precision highp float;
  
  varying vec2 v_uv;
  uniform sampler2D u_density;
  uniform vec2 u_point;
  uniform vec3 u_color;
  uniform float u_radius;
  
  void main() {
    vec3 density = texture2D(u_density, v_uv).rgb;
    vec2 pos = v_uv - u_point;
    float dist = length(pos);
    
    if (dist < u_radius) {
      float factor = 1.0 - (dist / u_radius);
      factor = smoothstep(0.0, 1.0, factor) * 0.8;
      density += factor * u_color;
    }
    
    gl_FragColor = vec4(density, 1.0);
  }
`;

// Shader for displaying the fluid (final render)
const DISPLAY_FRAG_SHADER = `
  precision highp float;
  
  varying vec2 v_uv;
  uniform sampler2D u_density;
  uniform vec3 u_colorA;
  uniform vec3 u_colorB;
  uniform int u_colorMode;
  
  // Rainbow color mapping
  vec3 rainbow(float t) {
    vec3 c = vec3(1.0, 1.0, 1.0);
    
    if (t < 0.0) t = 0.0;
    if (t > 1.0) t = 1.0;
    
    if (t < 0.2) {
      c.r = 0.0;
      c.g = 0.0;
      c.b = 0.5 + t * 2.5;
    } else if (t < 0.4) {
      c.r = 0.0;
      c.g = (t - 0.2) * 5.0;
      c.b = 1.0;
    } else if (t < 0.6) {
      c.r = (t - 0.4) * 5.0;
      c.g = 1.0;
      c.b = (0.6 - t) * 5.0;
    } else if (t < 0.8) {
      c.r = 1.0;
      c.g = (0.8 - t) * 5.0;
      c.b = 0.0;
    } else {
      c.r = 1.0 - (t - 0.8) * 5.0;
      c.g = 0.0;
      c.b = 0.0;
    }
    
    return c;
  }
  
  void main() {
    vec3 density = texture2D(u_density, v_uv).rgb;
    float intensity = length(density) * 0.3;
    
    vec3 color;
    if (u_colorMode == 0) {
      // Rainbow mode
      color = rainbow(intensity);
    } else if (u_colorMode == 1) {
      // Custom color mode
      color = mix(u_colorA, u_colorB, intensity);
    } else {
      // Monochrome mode
      color = vec3(intensity);
    }
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Enum for fluid simulation colorization modes
 */
export enum ColorMode {
  Rainbow = 'rainbow',
  Custom = 'custom',
  Monochrome = 'monochrome'
}

/**
 * Type for positive number constraints (greater than 0)
 */
export type PositiveNumber = number;

/**
 * Type for resolution values (must be power of 2)
 */
export type PowerOfTwoResolution = 128 | 256 | 512 | 1024 | 2048;

/**
 * Type for 0-1 normalized values
 */
export type NormalizedValue = number;

/**
 * Range-constrained numerical types
 */
export type DissipationValue = number; // 0.0 to 1.0
export type PressureIterations = number; // Positive integer, typically 10-50
export type CurlStrength = number; // Positive number, typically 0-30

/**
 * Fluid simulation parameters with stricter, more specific types
 */
export interface FluidSimulationParams {
  /**
   * Grid resolution for the fluid simulation (power of 2 recommended)
   * Controls the detail level of the fluid dynamics
   * @minimum 128
   * @maximum 2048
   */
  resolution: PowerOfTwoResolution;

  /**
   * Dye texture resolution for visualization (power of 2 recommended)
   * Controls the detail level of the color visualization
   * @minimum 128
   * @maximum 2048
   */
  dyeResolution: PowerOfTwoResolution;

  /**
   * How quickly the dye color dissipates (0.0 to 1.0)
   * Lower values make the color fade quickly, higher values make it persist
   * @minimum 0.0
   * @maximum 1.0
   */
  densityDissipation: DissipationValue;

  /**
   * How quickly the velocity dissipates (0.0 to 1.0)
   * Lower values make the fluid slow down quickly, higher values maintain momentum
   * @minimum 0.0
   * @maximum 1.0
   */
  velocityDissipation: DissipationValue;

  /**
   * Number of iterations for the pressure solver
   * Higher values give more accurate fluid behavior but cost performance
   * @minimum 1
   * @maximum 50
   */
  pressureIterations: PressureIterations;

  /**
   * Curl force strength (vorticity confinement)
   * Controls how much small-scale vortices are preserved and enhanced
   * @minimum 0
   * @maximum 50
   */
  curl: CurlStrength;

  /**
   * Radius of fluid injection when adding forces or dye
   * @minimum 0.01
   * @maximum 1.0
   */
  splatRadius: NormalizedValue;

  /**
   * First color for visualization
   */
  colorA: THREE.Color;

  /**
   * Second color for visualization
   */
  colorB: THREE.Color;

  /**
   * Visualization color mode
   */
  colorMode: ColorMode;
}

/**
 * Enum for simulation steps
 */
enum SimStep {
  Advection,
  Diffusion,
  Pressure,
  Gradient,
  Curl,
  Vorticity,
  Divergence,
  Clear
}

/**
 * Interface for shader uniforms with update function
 */
interface IUniformWithUpdate extends THREE.IUniform {
  update?: (time: number, deltaTime?: number) => void;
  type: string;
}

/**
 * Helper function to create a shader material with typed uniforms
 * @param material The THREE.ShaderMaterial to convert
 * @param uniformTypes Record of uniform types
 * @returns Typed shader material
 */
const createShaderMaterial = (
  material: THREE.ShaderMaterial, 
  uniformTypes: Record<string, string>
): IShaderMaterial => {
  // Create a new material with the same properties
  const iMaterial = material as unknown as IShaderMaterial;
  
  // Convert uniforms to IShaderMaterial format
  const newUniforms: Record<string, IUniformWithUpdate> = {};
  
  // Add type property to each uniform
  for (const [key, uniform] of Object.entries(material.uniforms)) {
    newUniforms[key] = {
      ...uniform,
      type: uniformTypes[key] || 'any'
    };
  }
  
  // Replace uniforms with typed version
  iMaterial.uniforms = newUniforms;
  
  return iMaterial;
};

/**
 * Creates a type-safe set of default parameters for fluid simulation
 * @returns Default fluid simulation parameters
 */
export function createDefaultFluidParams(): FluidSimulationParams {
  return {
    resolution: 256,
    dyeResolution: 1024,
    densityDissipation: 0.98,
    velocityDissipation: 0.99,
    pressureIterations: 20,
    curl: 20,
    splatRadius: 0.3,
    colorA: new THREE.Color(0x000000),
    colorB: new THREE.Color(0xffffff),
    colorMode: ColorMode.Rainbow
  };
}

/**
 * Type guard to check if a value is a valid PowerOfTwoResolution
 * @param value The value to check
 * @returns True if the value is a valid power of two resolution
 */
function isPowerOfTwoResolution(value: number): value is PowerOfTwoResolution {
  return value === 128 || value === 256 || value === 512 || value === 1024 || value === 2048;
}

/**
 * Type guard to check if a value is a valid ColorMode
 * @param value The value to check
 * @returns True if the value is a valid color mode
 */
function isValidColorMode(value: string): value is ColorMode {
  return Object.values(ColorMode).includes(value as ColorMode);
}

/**
 * Clamps a dissipation value to the valid range (0-1)
 * @param value The value to clamp
 * @returns Clamped value between 0 and 1
 */
function clampDissipation(value: number): DissipationValue {
  return Math.max(0, Math.min(1, value));
}

/**
 * Implementation of fluid simulation based on Navier-Stokes equations
 * Provides a realistic fluid dynamics simulation with customizable parameters
 */
export class FluidSimulation extends BaseTechnique {
  /**
   * Current simulation parameters
   */
  private params: FluidSimulationParams;
  private simInitialized: boolean = false;
  
  // Render targets for simulation data
  private velocityRenderTarget: THREE.WebGLRenderTarget | null = null;
  private densityRenderTarget: THREE.WebGLRenderTarget | null = null;
  private pressureRenderTarget: THREE.WebGLRenderTarget | null = null;
  private divergenceRenderTarget: THREE.WebGLRenderTarget | null = null;
  private curlRenderTarget: THREE.WebGLRenderTarget | null = null;
  
  // Double buffer targets for ping-pong rendering
  private velocityDoubleFBO: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null = null;
  private densityDoubleFBO: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null = null;
  private pressureDoubleFBO: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null = null;
  
  // Materials for each simulation step
  private baseMaterial: IShaderMaterial | null = null;
  private advectionMaterial: IShaderMaterial | null = null;
  private divergenceMaterial: IShaderMaterial | null = null;
  private curlMaterial: IShaderMaterial | null = null;
  private vorticityMaterial: IShaderMaterial | null = null;
  private pressureMaterial: IShaderMaterial | null = null;
  private gradientSubtractMaterial: IShaderMaterial | null = null;
  private clearMaterial: IShaderMaterial | null = null;
  private displayMaterial: IShaderMaterial | null = null;
  private addForcesMaterial: IShaderMaterial | null = null;
  private addDyeMaterial: IShaderMaterial | null = null;
  
  // External forces
  private pointerPositions: { [id: number]: THREE.Vector2 } = {};
  private pointerForces: { [id: number]: THREE.Vector2 } = {};
  private lastUpdateTime: number = 0;
  
  /**
   * Creates a new FluidSimulation instance
   * @param id Unique identifier for this technique
   */
  constructor(id: string) {
    super(id, 'Fluid Simulation');
    
    // Initialize with default parameters
    this.params = createDefaultFluidParams();
  }
  
  /**
   * Initialize the technique with the WebGL renderer
   * @param renderer The WebGL renderer
   */
  public initialize(renderer: THREE.WebGLRenderer): void {
    super.initialize(renderer);
    
    this.createRenderTargets();
    this.createShaderMaterials();
    
    // Clear all render targets to start with a clean state
    if (this.clearMaterial && this.clearMaterial.uniforms && 
        this.clearMaterial.uniforms.u_clearColor && 
        this.clearMaterial.uniforms.u_clearColor.value) {
      this.clearMaterial.uniforms.u_clearColor.value.set(0, 0, 0, 1);
      
      // Clear velocity
      if (this.velocityDoubleFBO && this.mesh && this.scene && this.camera) {
        this.mesh.material = this.clearMaterial;
        renderer.setRenderTarget(this.velocityDoubleFBO[0]);
        renderer.render(this.scene, this.camera);
        renderer.setRenderTarget(this.velocityDoubleFBO[1]);
        renderer.render(this.scene, this.camera);
      }
      
      // Clear pressure
      if (this.pressureDoubleFBO && this.mesh && this.scene && this.camera) {
        this.mesh.material = this.clearMaterial;
        renderer.setRenderTarget(this.pressureDoubleFBO[0]);
        renderer.render(this.scene, this.camera);
        renderer.setRenderTarget(this.pressureDoubleFBO[1]);
        renderer.render(this.scene, this.camera);
      }
      
      // Clear density
      if (this.densityDoubleFBO && this.mesh && this.scene && this.camera) {
        this.mesh.material = this.clearMaterial;
        renderer.setRenderTarget(this.densityDoubleFBO[0]);
        renderer.render(this.scene, this.camera);
        renderer.setRenderTarget(this.densityDoubleFBO[1]);
        renderer.render(this.scene, this.camera);
      }
      
      // Clear divergence
      if (this.divergenceRenderTarget && this.mesh && this.scene && this.camera) {
        this.mesh.material = this.clearMaterial;
        renderer.setRenderTarget(this.divergenceRenderTarget);
        renderer.render(this.scene, this.camera);
      }
      
      // Clear curl
      if (this.curlRenderTarget && this.mesh && this.scene && this.camera) {
        this.mesh.material = this.clearMaterial;
        renderer.setRenderTarget(this.curlRenderTarget);
        renderer.render(this.scene, this.camera);
      }
      
      // Reset to default render target
      renderer.setRenderTarget(null);
    }
    
    // Initialize simulation clock
    this.lastUpdateTime = performance.now();
    
    this.simInitialized = true;
  }
  
  /**
   * Create all the render targets needed for the simulation
   */
  private createRenderTargets(): void {
    const simRes = this.params.resolution;
    const dyeRes = this.params.dyeResolution;
    
    const simOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      stencilBuffer: false,
      depthBuffer: false
    };
    
    // Create render targets for various simulation steps
    this.velocityDoubleFBO = [
      new THREE.WebGLRenderTarget(simRes, simRes, simOptions),
      new THREE.WebGLRenderTarget(simRes, simRes, simOptions)
    ];
    
    this.densityDoubleFBO = [
      new THREE.WebGLRenderTarget(dyeRes, dyeRes, simOptions),
      new THREE.WebGLRenderTarget(dyeRes, dyeRes, simOptions)
    ];
    
    this.pressureDoubleFBO = [
      new THREE.WebGLRenderTarget(simRes, simRes, simOptions),
      new THREE.WebGLRenderTarget(simRes, simRes, simOptions)
    ];
    
    this.divergenceRenderTarget = new THREE.WebGLRenderTarget(simRes, simRes, simOptions);
    this.curlRenderTarget = new THREE.WebGLRenderTarget(simRes, simRes, simOptions);
  }
  
  /**
   * Create all shader materials for the fluid simulation
   */
  private createShaderMaterials(): void {
    // Base material for rendering to a render target
    const baseMaterial = new THREE.ShaderMaterial({
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: '',
      depthTest: false,
      depthWrite: false,
    });
    
    this.baseMaterial = createShaderMaterial(baseMaterial, {});

    // Clear material
    const clearMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_clearColor: { value: new THREE.Vector4(0, 0, 0, 1) },
      },
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: CLEAR_FRAG_SHADER,
      depthTest: false,
      depthWrite: false,
    });
    
    this.clearMaterial = createShaderMaterial(clearMaterial, {
      u_clearColor: 'v4'
    });

    // Advection material
    const advectionMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_velocity: { value: null },
        u_source: { value: null },
        u_dt: { value: 0.0 },
        u_dissipation: { value: 1.0 },
        u_texelSize: { value: new THREE.Vector2(1.0 / this.params.resolution, 1.0 / this.params.resolution) },
      },
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: ADVECTION_FRAG_SHADER,
      depthTest: false,
      depthWrite: false,
    });
    
    this.advectionMaterial = createShaderMaterial(advectionMaterial, {
      u_velocity: 'sampler2D',
      u_source: 'sampler2D',
      u_dt: 'float',
      u_dissipation: 'float',
      u_texelSize: 'v2'
    });

    // Divergence material
    const divergenceMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_velocity: { value: null },
        u_texelSize: { value: new THREE.Vector2(1.0 / this.params.resolution, 1.0 / this.params.resolution) },
      },
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: DIVERGENCE_FRAG_SHADER,
      depthTest: false,
      depthWrite: false,
    });
    
    this.divergenceMaterial = createShaderMaterial(divergenceMaterial, {
      u_velocity: 'sampler2D',
      u_texelSize: 'v2'
    });

    // Pressure material
    const pressureMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_pressure: { value: null },
        u_divergence: { value: null },
        u_texelSize: { value: new THREE.Vector2(1.0 / this.params.resolution, 1.0 / this.params.resolution) },
      },
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: PRESSURE_FRAG_SHADER,
      depthTest: false,
      depthWrite: false,
    });
    
    this.pressureMaterial = createShaderMaterial(pressureMaterial, {
      u_pressure: 'sampler2D',
      u_divergence: 'sampler2D',
      u_texelSize: 'v2'
    });

    // Gradient subtract material
    const gradientSubtractMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_pressure: { value: null },
        u_velocity: { value: null },
        u_texelSize: { value: new THREE.Vector2(1.0 / this.params.resolution, 1.0 / this.params.resolution) },
      },
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: GRADIENT_SUBTRACT_FRAG_SHADER,
      depthTest: false,
      depthWrite: false,
    });
    
    this.gradientSubtractMaterial = createShaderMaterial(gradientSubtractMaterial, {
      u_pressure: 'sampler2D',
      u_velocity: 'sampler2D',
      u_texelSize: 'v2'
    });

    // Curl material
    const curlMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_velocity: { value: null },
        u_texelSize: { value: new THREE.Vector2(1.0 / this.params.resolution, 1.0 / this.params.resolution) },
      },
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: CURL_FRAG_SHADER,
      depthTest: false,
      depthWrite: false,
    });
    
    this.curlMaterial = createShaderMaterial(curlMaterial, {
      u_velocity: 'sampler2D',
      u_texelSize: 'v2'
    });

    // Vorticity material
    const vorticityMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_velocity: { value: null },
        u_curl: { value: null },
        u_texelSize: { value: new THREE.Vector2(1.0 / this.params.resolution, 1.0 / this.params.resolution) },
        u_curlStrength: { value: this.params.curl },
        u_dt: { value: 0.0 },
      },
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: VORTICITY_FRAG_SHADER,
      depthTest: false,
      depthWrite: false,
    });
    
    this.vorticityMaterial = createShaderMaterial(vorticityMaterial, {
      u_velocity: 'sampler2D',
      u_curl: 'sampler2D',
      u_texelSize: 'v2',
      u_curlStrength: 'float',
      u_dt: 'float'
    });

    // Add force material
    const addForcesMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_velocity: { value: null },
        u_point: { value: new THREE.Vector2(0, 0) },
        u_force: { value: new THREE.Vector2(0, 0) },
        u_radius: { value: this.params.splatRadius },
      },
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: ADD_FORCE_FRAG_SHADER,
      depthTest: false,
      depthWrite: false,
    });
    
    this.addForcesMaterial = createShaderMaterial(addForcesMaterial, {
      u_velocity: 'sampler2D',
      u_point: 'v2',
      u_force: 'v2',
      u_radius: 'float'
    });

    // Add dye material
    const addDyeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_density: { value: null },
        u_point: { value: new THREE.Vector2(0, 0) },
        u_color: { value: new THREE.Vector3(1, 1, 1) },
        u_radius: { value: this.params.splatRadius },
      },
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: ADD_DYE_FRAG_SHADER,
      depthTest: false,
      depthWrite: false,
    });
    
    this.addDyeMaterial = createShaderMaterial(addDyeMaterial, {
      u_density: 'sampler2D',
      u_point: 'v2',
      u_color: 'v3',
      u_radius: 'float'
    });

    // Display material
    const displayMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_density: { value: null },
        u_colorA: { value: this.params.colorA },
        u_colorB: { value: this.params.colorB },
        u_colorMode: { value: this.params.colorMode === 'rainbow' ? 0 :
                             this.params.colorMode === 'custom' ? 1 : 2 },
      },
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: DISPLAY_FRAG_SHADER,
      depthTest: false,
      depthWrite: false,
    });
    
    this.displayMaterial = createShaderMaterial(displayMaterial, {
      u_density: 'sampler2D',
      u_colorA: 'v3',
      u_colorB: 'v3',
      u_colorMode: 'int'
    });
  }
  
  /**
   * Creates a shader material for the fluid simulation
   * @param params Parameters for the simulation
   * @returns Shader material with appropriate uniforms and shaders
   */
  public createMaterial(params: Partial<FluidSimulationParams>): IShaderMaterial {
    // Merge with default parameters for any missing values
    const defaultParams = createDefaultFluidParams();
    const mergedParams: FluidSimulationParams = {
      ...defaultParams,
      ...params
    };
    
    // Validate and sanitize parameters
    if (!isPowerOfTwoResolution(mergedParams.resolution)) {
      console.warn(`Invalid resolution: ${mergedParams.resolution}. Using default: 256`);
      mergedParams.resolution = 256;
    }
    
    if (!isPowerOfTwoResolution(mergedParams.dyeResolution)) {
      console.warn(`Invalid dyeResolution: ${mergedParams.dyeResolution}. Using default: 1024`);
      mergedParams.dyeResolution = 1024;
    }
    
    mergedParams.densityDissipation = clampDissipation(mergedParams.densityDissipation);
    mergedParams.velocityDissipation = clampDissipation(mergedParams.velocityDissipation);
    
    mergedParams.pressureIterations = Math.max(1, Math.min(50, Math.floor(mergedParams.pressureIterations)));
    mergedParams.curl = Math.max(0, Math.min(50, mergedParams.curl));
    mergedParams.splatRadius = Math.max(0.01, Math.min(1, mergedParams.splatRadius));
    
    if (typeof mergedParams.colorMode === 'string' && !isValidColorMode(mergedParams.colorMode)) {
      console.warn(`Invalid colorMode: ${mergedParams.colorMode}. Using default: rainbow`);
      mergedParams.colorMode = ColorMode.Rainbow;
    }
    
    // Store validated parameters
    this.params = mergedParams;

    // Already created in initialize(), just update params
    this.updateParams(mergedParams);
    
    // Return the display material which will be used for visualization
    return this.displayMaterial as IShaderMaterial;
  }
  
  /**
   * Updates simulation parameters
   * @param params New parameters to apply
   */
  public updateParams(params: Partial<FluidSimulationParams>): void {
    // Merge with existing parameters
    this.params = {
      ...this.params,
      ...params
    };
    
    // Validate and sanitize parameters
    if (!isPowerOfTwoResolution(this.params.resolution)) {
      console.warn(`Invalid resolution: ${this.params.resolution}. Using default: 256`);
      this.params.resolution = 256;
    }
    
    if (!isPowerOfTwoResolution(this.params.dyeResolution)) {
      console.warn(`Invalid dyeResolution: ${this.params.dyeResolution}. Using default: 1024`);
      this.params.dyeResolution = 1024;
    }
    
    this.params.densityDissipation = clampDissipation(this.params.densityDissipation);
    this.params.velocityDissipation = clampDissipation(this.params.velocityDissipation);
    
    this.params.pressureIterations = Math.max(1, Math.min(50, Math.floor(this.params.pressureIterations)));
    this.params.curl = Math.max(0, Math.min(50, this.params.curl));
    this.params.splatRadius = Math.max(0.01, Math.min(1, this.params.splatRadius));
    
    if (typeof this.params.colorMode === 'string' && !isValidColorMode(this.params.colorMode)) {
      console.warn(`Invalid colorMode: ${this.params.colorMode}. Using default: rainbow`);
      this.params.colorMode = ColorMode.Rainbow;
    }
    
    // Update material uniforms
    if (this.vorticityMaterial && this.vorticityMaterial.uniforms && 
        this.vorticityMaterial.uniforms.u_curl_strength) {
      this.vorticityMaterial.uniforms.u_curl_strength.value = this.params.curl;
    }
    
    if (this.displayMaterial && this.displayMaterial.uniforms) {
      if (this.displayMaterial.uniforms.u_colorMode) {
        this.displayMaterial.uniforms.u_colorMode.value = 
          this.params.colorMode === 'rainbow' ? 0 : 
          this.params.colorMode === 'custom' ? 1 : 2;
      }
      
      if (this.displayMaterial.uniforms.u_colorA) {
        this.displayMaterial.uniforms.u_colorA.value = this.params.colorA;
      }
      
      if (this.displayMaterial.uniforms.u_colorB) {
        this.displayMaterial.uniforms.u_colorB.value = this.params.colorB;
      }
    }
    
    if (this.advectionMaterial && this.advectionMaterial.uniforms) {
      if (this.advectionMaterial.uniforms.u_dissipation) {
        this.advectionMaterial.uniforms.u_dissipation.value = this.params.velocityDissipation;
      }
    }
    
    if (this.addDyeMaterial && this.addDyeMaterial.uniforms) {
      if (this.addDyeMaterial.uniforms.u_dissipation) {
        this.addDyeMaterial.uniforms.u_dissipation.value = this.params.densityDissipation;
      }
    }
    
    // Update texel size uniforms where needed
    const simTexelSize = new THREE.Vector2(1.0 / this.params.resolution, 1.0 / this.params.resolution);
    const dyeTexelSize = new THREE.Vector2(1.0 / this.params.dyeResolution, 1.0 / this.params.dyeResolution);
    
    if (this.advectionMaterial) {
      this.advectionMaterial.uniforms.u_texelSize.value = simTexelSize;
    }
    
    if (this.divergenceMaterial) {
      this.divergenceMaterial.uniforms.u_texelSize.value = simTexelSize;
    }
    
    if (this.curlMaterial) {
      this.curlMaterial.uniforms.u_texelSize.value = simTexelSize;
    }
    
    if (this.vorticityMaterial) {
      this.vorticityMaterial.uniforms.u_texelSize.value = simTexelSize;
    }
    
    if (this.pressureMaterial) {
      this.pressureMaterial.uniforms.u_texelSize.value = simTexelSize;
    }
    
    if (this.gradientSubtractMaterial) {
      this.gradientSubtractMaterial.uniforms.u_texelSize.value = simTexelSize;
    }
  }
  
  /**
   * Get uniform updaters for time-based animations
   */
  public getUniformUpdaters(): Record<string, (time: number, deltaTime: number) => void> {
    return {
      u_dt: (time: number, deltaTime: number) => {
        // Cap delta time to avoid instability in the simulation
        const dt = Math.min(deltaTime, 0.016666); // Cap at ~60fps
        
        if (this.advectionMaterial && this.advectionMaterial.uniforms && 
            this.advectionMaterial.uniforms.u_dt) {
          this.advectionMaterial.uniforms.u_dt.value = dt;
        }
        
        if (this.vorticityMaterial && this.vorticityMaterial.uniforms && 
            this.vorticityMaterial.uniforms.u_dt) {
          this.vorticityMaterial.uniforms.u_dt.value = dt;
        }
      },
      
      u_time: (time: number) => {
        // Update time uniform for animations
        if (this.displayMaterial && this.displayMaterial.uniforms && 
            this.displayMaterial.uniforms.u_time) {
          this.displayMaterial.uniforms.u_time.value = time;
        }
      }
    };
  }
  
  /**
   * Perform one step of the fluid simulation
   * @param renderer The WebGL renderer
   * @param deltaTime Time since last update in milliseconds
   */
  private simulateStep(renderer: THREE.WebGLRenderer, deltaTime: number): void {
    if (!this.simInitialized || !this.velocityDoubleFBO) return;
    
    const dt = Math.min(deltaTime / 1000.0, 0.016);
    
    // Function to swap ping-pong buffers
    const swap = (fbo: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget]) => {
      const temp = fbo[0];
      fbo[0] = fbo[1];
      fbo[1] = temp;
    };
    
    // Update shader uniforms with current time step
    if (this.advectionMaterial && this.advectionMaterial.uniforms) {
      if (this.advectionMaterial.uniforms.u_dt) {
        this.advectionMaterial.uniforms.u_dt.value = dt;
      }
    }
    
    if (this.vorticityMaterial && this.vorticityMaterial.uniforms) {
      if (this.vorticityMaterial.uniforms.u_dt) {
        this.vorticityMaterial.uniforms.u_dt.value = dt;
      }
    }
    
    // 1. Advect velocity
    if (this.advectionMaterial && this.advectionMaterial.uniforms && 
        this.velocityDoubleFBO && this.mesh && this.scene && this.camera) {
      
      if (this.advectionMaterial.uniforms.u_velocity) {
        this.advectionMaterial.uniforms.u_velocity.value = this.velocityDoubleFBO[0].texture;
      }
      
      if (this.advectionMaterial.uniforms.u_source) {
        this.advectionMaterial.uniforms.u_source.value = this.velocityDoubleFBO[0].texture;
      }
      
      if (this.advectionMaterial.uniforms.u_dissipation) {
        this.advectionMaterial.uniforms.u_dissipation.value = this.params.velocityDissipation;
      }
      
      this.mesh.material = this.advectionMaterial;
      renderer.setRenderTarget(this.velocityDoubleFBO[1]);
      renderer.render(this.scene, this.camera);
      swap(this.velocityDoubleFBO);
    }
    
    // 2. Calculate curl
    if (this.curlMaterial) {
      this.curlMaterial.uniforms.u_velocity.value = this.velocityDoubleFBO[0].texture;
      
      this.mesh!.material = this.curlMaterial;
      renderer.setRenderTarget(this.curlRenderTarget);
      renderer.render(this.scene, this.camera);
    }
    
    // 3. Apply vorticity confinement (adds swirls)
    if (this.vorticityMaterial && this.curlRenderTarget) {
      this.vorticityMaterial.uniforms.u_velocity.value = this.velocityDoubleFBO[0].texture;
      this.vorticityMaterial.uniforms.u_curl.value = this.curlRenderTarget.texture;
      
      this.mesh!.material = this.vorticityMaterial;
      renderer.setRenderTarget(this.velocityDoubleFBO[1]);
      renderer.render(this.scene, this.camera);
      swap(this.velocityDoubleFBO);
    }
    
    // 4. Calculate divergence
    if (this.divergenceMaterial) {
      this.divergenceMaterial.uniforms.u_velocity.value = this.velocityDoubleFBO[0].texture;
      
      this.mesh!.material = this.divergenceMaterial;
      renderer.setRenderTarget(this.divergenceRenderTarget);
      renderer.render(this.scene, this.camera);
    }
    
    // 5. Clear pressure
    if (this.clearMaterial && this.pressureDoubleFBO && this.mesh && this.scene && this.camera) {
      if (this.clearMaterial.uniforms && 
          this.clearMaterial.uniforms.u_clearColor && 
          this.clearMaterial.uniforms.u_clearColor.value) {
        this.clearMaterial.uniforms.u_clearColor.value.set(0, 0, 0, 1);
      }
      
      this.mesh.material = this.clearMaterial;
      renderer.setRenderTarget(this.pressureDoubleFBO[0]);
      renderer.render(this.scene, this.camera);
    }
    
    // 6. Solve pressure (multiple iterations for accuracy)
    if (this.pressureMaterial && this.pressureDoubleFBO && this.divergenceRenderTarget) {
      this.pressureMaterial.uniforms.u_divergence.value = this.divergenceRenderTarget.texture;
      
      // Jacobi iteration - typically 20-40 iterations
      const iterations = this.params.pressureIterations;
      for (let i = 0; i < iterations; i++) {
        this.pressureMaterial.uniforms.u_pressure.value = this.pressureDoubleFBO[0].texture;
        
        this.mesh!.material = this.pressureMaterial;
        renderer.setRenderTarget(this.pressureDoubleFBO[1]);
        renderer.render(this.scene, this.camera);
        swap(this.pressureDoubleFBO);
      }
    }
    
    // 7. Subtract pressure gradient to make velocity divergence-free
    if (this.gradientSubtractMaterial && this.velocityDoubleFBO && this.pressureDoubleFBO) {
      this.gradientSubtractMaterial.uniforms.u_pressure.value = this.pressureDoubleFBO[0].texture;
      this.gradientSubtractMaterial.uniforms.u_velocity.value = this.velocityDoubleFBO[0].texture;
      
      this.mesh!.material = this.gradientSubtractMaterial;
      renderer.setRenderTarget(this.velocityDoubleFBO[1]);
      renderer.render(this.scene, this.camera);
      swap(this.velocityDoubleFBO);
    }
    
    // 8. Advect density/color
    if (this.advectionMaterial && this.advectionMaterial.uniforms && 
        this.densityDoubleFBO && this.velocityDoubleFBO && 
        this.mesh && this.scene && this.camera) {
      
      if (this.advectionMaterial.uniforms.u_velocity) {
        this.advectionMaterial.uniforms.u_velocity.value = this.velocityDoubleFBO[0].texture;
      }
      
      if (this.advectionMaterial.uniforms.u_source) {
        this.advectionMaterial.uniforms.u_source.value = this.densityDoubleFBO[0].texture;
      }
      
      if (this.advectionMaterial.uniforms.u_dissipation) {
        this.advectionMaterial.uniforms.u_dissipation.value = this.params.densityDissipation;
      }
      
      this.mesh.material = this.advectionMaterial;
      renderer.setRenderTarget(this.densityDoubleFBO[1]);
      renderer.render(this.scene, this.camera);
      swap(this.densityDoubleFBO);
    }
  }
  
  /**
   * Add external force to the fluid simulation
   * @param x Normalized x position (0-1)
   * @param y Normalized y position (0-1)
   * @param dx Force x component
   * @param dy Force y component
   * @param renderer The WebGL renderer to use
   */
  public addForce(x: number, y: number, dx: number, dy: number, renderer: THREE.WebGLRenderer): void {
    if (!this.velocityDoubleFBO || !this.initialized) return;
    
    // Create a temporary shader material for applying force
    const forceShader = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        
        uniform sampler2D u_velocity;
        uniform vec2 u_point;
        uniform vec2 u_force;
        uniform float u_radius;
        
        varying vec2 vUv;
        
        void main() {
          vec2 uv = vUv;
          vec2 coord = u_point;
          
          // Calculate distance to force point
          vec2 diff = uv - coord;
          float d = length(diff);
          
          // Get existing velocity
          vec2 velocity = texture2D(u_velocity, uv).xy;
          
          // Apply force using a smooth falloff based on distance
          float influence = exp(-d * d / u_radius);
          velocity += u_force * influence;
          
          gl_FragColor = vec4(velocity, 0.0, 1.0);
        }
      `,
      uniforms: {
        u_velocity: { value: this.velocityDoubleFBO[0].texture },
        u_point: { value: new THREE.Vector2(x, y) },
        u_force: { value: new THREE.Vector2(dx, dy) },
        u_radius: { value: this.params.splatRadius * 0.5 }
      }
    });
    
    // Apply force to velocity field
    this.mesh!.material = forceShader;
    renderer.setRenderTarget(this.velocityDoubleFBO[1]);
    renderer.render(this.scene, this.camera);
    
    // Swap buffers to use the updated velocity
    [this.velocityDoubleFBO[0], this.velocityDoubleFBO[1]] = 
      [this.velocityDoubleFBO[1], this.velocityDoubleFBO[0]];
    
    // Clean up the temporary material
    forceShader.dispose();
  }
  
  /**
   * Add a color splat to the fluid simulation
   * @param x Normalized x position (0-1)
   * @param y Normalized y position (0-1)
   * @param color The color to add
   * @param radius The radius of the splat
   * @param renderer The WebGL renderer to use
   */
  public addColorSplat(x: number, y: number, color: THREE.Color, radius: number = this.params.splatRadius, renderer: THREE.WebGLRenderer): void {
    if (!this.densityDoubleFBO || !this.initialized) return;
    
    // Create a temporary shader material for adding color
    const colorSplatShader = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        
        uniform sampler2D u_density;
        uniform vec2 u_point;
        uniform vec3 u_color;
        uniform float u_radius;
        
        varying vec2 vUv;
        
        void main() {
          vec2 uv = vUv;
          vec2 coord = u_point;
          
          // Calculate distance to splat point
          vec2 diff = uv - coord;
          float d = length(diff);
          
          // Get existing density
          vec4 density = texture2D(u_density, uv);
          
          // Apply color splat using a smooth falloff based on distance
          float influence = exp(-d * d / u_radius);
          vec3 finalColor = density.rgb + u_color * influence;
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      uniforms: {
        u_density: { value: this.densityDoubleFBO[0].texture },
        u_point: { value: new THREE.Vector2(x, y) },
        u_color: { value: color },
        u_radius: { value: radius * radius }
      }
    });
    
    // Apply color to density field
    this.mesh!.material = colorSplatShader;
    renderer.setRenderTarget(this.densityDoubleFBO[1]);
    renderer.render(this.scene, this.camera);
    
    // Swap buffers to use the updated density
    [this.densityDoubleFBO[0], this.densityDoubleFBO[1]] = 
      [this.densityDoubleFBO[1], this.densityDoubleFBO[0]];
    
    // Add a bit of force in the same location to make the fluid move
    this.addForce(x, y, 0, 0.005, renderer);
    
    // Clean up the temporary material
    colorSplatShader.dispose();
  }
  
  /**
   * Render the fluid simulation to the given target
   * @param renderer The WebGL renderer
   * @param target Optional render target (renders to screen if not provided)
   */
  public render(
    renderer: THREE.WebGLRenderer, 
    target?: THREE.WebGLRenderTarget
  ): void {
    if (!this.simInitialized || !this.densityDoubleFBO || !this.displayMaterial) return;
    
    // Calculate delta time
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;
    
    // Perform simulation steps
    this.simulateStep(renderer, deltaTime);
    
    // Render the density to the output target
    this.displayMaterial.uniforms.u_density.value = this.densityDoubleFBO[0].texture;
    
    this.mesh!.material = this.displayMaterial;
    renderer.setRenderTarget(target || null);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(null);
  }
  
  /**
   * Reset the simulation
   * @param renderer The WebGL renderer to use
   */
  public reset(renderer: THREE.WebGLRenderer): void {
    if (!this.initialized || !this.clearMaterial || !this.mesh || !this.scene || !this.camera) return;
    
    // Clear all simulation render targets
    if (this.clearMaterial.uniforms && 
        this.clearMaterial.uniforms.u_clearColor && 
        this.clearMaterial.uniforms.u_clearColor.value) {
      this.clearMaterial.uniforms.u_clearColor.value.set(0, 0, 0, 1);
    }
    
    if (this.velocityDoubleFBO) {
      this.mesh.material = this.clearMaterial;
      renderer.setRenderTarget(this.velocityDoubleFBO[0]);
      renderer.render(this.scene, this.camera);
      renderer.setRenderTarget(this.velocityDoubleFBO[1]);
      renderer.render(this.scene, this.camera);
    }
    
    if (this.pressureDoubleFBO) {
      this.mesh.material = this.clearMaterial;
      renderer.setRenderTarget(this.pressureDoubleFBO[0]);
      renderer.render(this.scene, this.camera);
      renderer.setRenderTarget(this.pressureDoubleFBO[1]);
      renderer.render(this.scene, this.camera);
    }
    
    if (this.densityDoubleFBO) {
      this.mesh.material = this.clearMaterial;
      renderer.setRenderTarget(this.densityDoubleFBO[0]);
      renderer.render(this.scene, this.camera);
      renderer.setRenderTarget(this.densityDoubleFBO[1]);
      renderer.render(this.scene, this.camera);
    }
    
    if (this.divergenceRenderTarget) {
      this.mesh.material = this.clearMaterial;
      renderer.setRenderTarget(this.divergenceRenderTarget);
      renderer.render(this.scene, this.camera);
    }
    
    if (this.curlRenderTarget) {
      this.mesh.material = this.clearMaterial;
      renderer.setRenderTarget(this.curlRenderTarget);
      renderer.render(this.scene, this.camera);
    }
    
    // Reset simulation clock
    this.lastUpdateTime = performance.now();
    
    // Clear any stored forces or positions
    this.pointerPositions = {};
    this.pointerForces = {};
    
    // Reset to default render target
    renderer.setRenderTarget(null);
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    super.dispose();
    
    // Clean up render targets
    if (this.velocityDoubleFBO) {
      this.velocityDoubleFBO[0].dispose();
      this.velocityDoubleFBO[1].dispose();
      this.velocityDoubleFBO = null;
    }
    
    if (this.densityDoubleFBO) {
      this.densityDoubleFBO[0].dispose();
      this.densityDoubleFBO[1].dispose();
      this.densityDoubleFBO = null;
    }
    
    if (this.pressureDoubleFBO) {
      this.pressureDoubleFBO[0].dispose();
      this.pressureDoubleFBO[1].dispose();
      this.pressureDoubleFBO = null;
    }
    
    if (this.divergenceRenderTarget) {
      this.divergenceRenderTarget.dispose();
      this.divergenceRenderTarget = null;
    }
    
    if (this.curlRenderTarget) {
      this.curlRenderTarget.dispose();
      this.curlRenderTarget = null;
    }
    
    // Clean up materials
    const materials = [
      this.advectionMaterial,
      this.divergenceMaterial,
      this.curlMaterial,
      this.vorticityMaterial,
      this.pressureMaterial,
      this.gradientSubtractMaterial,
      this.clearMaterial,
      this.displayMaterial
    ];
    
    materials.forEach(material => {
      if (material) material.dispose();
    });
    
    this.advectionMaterial = null;
    this.divergenceMaterial = null;
    this.curlMaterial = null;
    this.vorticityMaterial = null;
    this.pressureMaterial = null;
    this.gradientSubtractMaterial = null;
    this.clearMaterial = null;
    this.displayMaterial = null;
    
    this.simInitialized = false;
  }
} 