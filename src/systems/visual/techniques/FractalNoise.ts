import * as THREE from 'three';
import { BaseTechnique } from './BaseTechnique';
import { IShaderMaterial } from '../../../core/types/visual';

/**
 * Parameters for the fractal noise technique
 */
export interface FractalNoiseParams {
  scale: number;           // Base scale of the noise (0.1-10)
  octaves: number;         // Number of octaves to combine (1-8)
  persistence: number;     // How much each octave contributes (0-1)
  lacunarity: number;      // How frequency increases each octave (1-3)
  noiseType: 'simplex' | 'perlin' | 'worley' | 'value';  // Type of base noise to use
  domain: 'normal' | 'ridged' | 'turbulent' | 'terraced'; // How to transform the domain
  colorMode: 'grayscale' | 'colorful' | 'custom';  // Coloring mode
  colorA: THREE.Color;     // First color for gradients
  colorB: THREE.Color;     // Second color for gradients
  timeScale: number;       // How fast the noise animates (0-1)
  seed: number;            // Seed for the noise (0-1000)
}

/**
 * Custom uniform interface with update function
 */
interface IUniformWithUpdate extends THREE.IUniform {
  update?: (time: number, deltaTime?: number) => any;
  type: string;
}

/**
 * Helper function to convert THREE.ShaderMaterial to IShaderMaterial
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
 * FractalNoise implementation for generating procedural noise patterns
 * Uses Fractal Brownian Motion (FBM) with various noise types
 */
export class FractalNoise extends BaseTechnique {
  private params: FractalNoiseParams;
  private noiseMaterial: IShaderMaterial | null = null;
  
  // Initial parameters
  private static readonly DEFAULT_PARAMS: FractalNoiseParams = {
    scale: 3.0,
    octaves: 5,
    persistence: 0.5,
    lacunarity: 2.0,
    noiseType: 'simplex',
    domain: 'normal',
    colorMode: 'grayscale',
    colorA: new THREE.Color(0.0, 0.0, 0.0),
    colorB: new THREE.Color(1.0, 1.0, 1.0),
    timeScale: 0.1,
    seed: 123.456
  };
  
  constructor(id: string) {
    super(id, 'FractalNoise');
    
    // Initialize with default params
    this.params = { ...FractalNoise.DEFAULT_PARAMS };
  }
  
  /**
   * Create the fractal noise shader material
   */
  public createMaterial(params: Partial<FractalNoiseParams>): IShaderMaterial {
    this.params = {
      ...FractalNoise.DEFAULT_PARAMS,
      ...params
    };
    
    // Define vertex shader for noise generation
    const vertexShader = `
      varying vec2 v_uv;
      
      void main() {
        v_uv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    // Define fragment shader with multiple noise implementations
    const fragmentShader = `
      precision highp float;
      
      varying vec2 v_uv;
      
      uniform float u_scale;
      uniform int u_octaves;
      uniform float u_persistence;
      uniform float u_lacunarity;
      uniform int u_noiseType;
      uniform int u_domainType;
      uniform int u_colorMode;
      uniform vec3 u_colorA;
      uniform vec3 u_colorB;
      uniform float u_time;
      uniform float u_timeScale;
      uniform float u_seed;
      uniform vec2 u_resolution;
      
      // ----- Utility functions -----
      
      // Random function
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      
      // 2D value noise
      float valueNoise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        
        // Four corners
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        
        // Smooth interpolation
        vec2 u = smoothstep(0.0, 1.0, f);
        
        // Mix the four corners
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }
      
      // 2D perlin noise
      float perlinNoise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        
        // Four corners
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        
        // Smooth interpolation
        vec2 u = f * f * (3.0 - 2.0 * f);
        
        // Mix the four corners
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }
      
      // Hash function for simplex noise
      vec2 hash(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)),
                dot(p, vec2(269.5, 183.3)));
        return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
      }
      
      // 2D simplex noise
      float simplexNoise(vec2 p) {
        const float K1 = 0.366025404; // (sqrt(3)-1)/2
        const float K2 = 0.211324865; // (3-sqrt(3))/6
        
        // Skew the input space
        vec2 i = floor(p + (p.x + p.y) * K1);
        vec2 a = p - i + (i.x + i.y) * K2;
        vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec2 b = a - o + K2;
        vec2 c = a - 1.0 + 2.0 * K2;
        
        // Calculate the contribution from the three corners
        vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
        vec3 n = h * h * h * h * vec3(dot(a, hash(i)), 
                                    dot(b, hash(i + o)),
                                    dot(c, hash(i + 1.0)));
        
        // Add contributions
        return 0.5 + 0.5 * (n.x + n.y + n.z);
      }
      
      // Distance function for Worley noise
      float worleyNoise(vec2 p) {
        vec2 i_st = floor(p);
        vec2 f_st = fract(p);
        float minDist = 1.0; // Minimum distance
        
        // Check the neighboring cells (3x3 grid)
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 cellPoint = neighbor + random(i_st + neighbor) - f_st;
            float dist = length(cellPoint);
            minDist = min(minDist, dist);
          }
        }
        
        return minDist;
      }
      
      // Apply domain warp based on domainType
      float domainWarp(float noise, float domainType) {
        if (domainType == 1.0) {
          // Ridged multifractal
          return 1.0 - abs(noise * 2.0 - 1.0);
        } else if (domainType == 2.0) {
          // Turbulent
          return noise * noise;
        } else if (domainType == 3.0) {
          // Terraced
          return floor(noise * 10.0) / 10.0;
        }
        
        // Normal (unchanged)
        return noise;
      }
      
      // Generate basic noise based on noiseType
      float basicNoise(vec2 p, float noiseType) {
        if (noiseType == 1.0) {
          return perlinNoise(p);
        } else if (noiseType == 2.0) {
          return 1.0 - worleyNoise(p); // Invert for better visual
        } else if (noiseType == 3.0) {
          return valueNoise(p);
        }
        
        // Default to simplex
        return simplexNoise(p);
      }
      
      // Fractal Brownian Motion implementation
      float fbm(vec2 p, float noiseType, float domainType) {
        float value = 0.0;
        float amplitude = 1.0;
        float frequency = 1.0;
        float maxValue = 0.0;  // Used for normalization
        
        // Accumulate octaves
        for (int i = 0; i < 10; i++) {
          if (i >= u_octaves) break;
          
          // Get noise value
          float noise = basicNoise(p * frequency + u_time * u_timeScale, noiseType);
          
          // Apply domain warping
          noise = domainWarp(noise, domainType);
          
          // Accumulate
          value += amplitude * noise;
          maxValue += amplitude;
          
          // Update values for next octave
          amplitude *= u_persistence;
          frequency *= u_lacunarity;
        }
        
        // Normalize
        return value / maxValue;
      }
      
      void main() {
        // Set up the noise coordinates
        vec2 st = v_uv * u_scale;
        
        // Add seed to position
        st += vec2(u_seed);
        
        // Calculate noise value
        float noiseValue = fbm(st, float(u_noiseType), float(u_domainType));
        
        // Apply color based on colorMode
        vec3 color;
        if (u_colorMode == 0) {
          // Grayscale
          color = vec3(noiseValue);
        } else if (u_colorMode == 1) {
          // Colorful (rainbow mapping)
          float hue = noiseValue;
          float saturation = 0.8;
          float value = 0.9;
          
          // HSV to RGB conversion
          vec3 c = vec3(hue, saturation, value);
          vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          color = c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        } else {
          // Custom color gradient
          color = mix(u_colorA, u_colorB, noiseValue);
        }
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    
    // Create shader material
    const material = new THREE.ShaderMaterial({
      uniforms: {
        u_scale: { value: this.params.scale },
        u_octaves: { value: this.params.octaves },
        u_persistence: { value: this.params.persistence },
        u_lacunarity: { value: this.params.lacunarity },
        u_noiseType: { value: this.getNoiseTypeValue() },
        u_domainType: { value: this.getDomainTypeValue() },
        u_colorMode: { value: this.getColorModeValue() },
        u_colorA: { value: this.params.colorA },
        u_colorB: { value: this.params.colorB },
        u_time: { value: 0.0 },
        u_timeScale: { value: this.params.timeScale },
        u_seed: { value: this.params.seed },
        u_resolution: { value: new THREE.Vector2(1, 1) }
      },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false
    });
    
    // Convert to IShaderMaterial
    this.noiseMaterial = createShaderMaterial(material, {
      u_scale: 'float',
      u_octaves: 'int',
      u_persistence: 'float',
      u_lacunarity: 'float',
      u_noiseType: 'int',
      u_domainType: 'int',
      u_colorMode: 'int',
      u_colorA: 'v3',
      u_colorB: 'v3',
      u_time: 'float',
      u_timeScale: 'float',
      u_seed: 'float',
      u_resolution: 'v2'
    });
    
    // Set this as the technique's material (required by BaseTechnique)
    this.material = this.noiseMaterial;
    
    return this.noiseMaterial;
  }
  
  /**
   * Convert noise type string to value
   */
  private getNoiseTypeValue(): number {
    switch (this.params.noiseType) {
      case 'perlin': return 1;
      case 'worley': return 2;
      case 'value': return 3;
      default: return 0; // simplex
    }
  }
  
  /**
   * Convert domain type string to value
   */
  private getDomainTypeValue(): number {
    switch (this.params.domain) {
      case 'ridged': return 1;
      case 'turbulent': return 2;
      case 'terraced': return 3;
      default: return 0; // normal
    }
  }
  
  /**
   * Convert color mode string to value
   */
  private getColorModeValue(): number {
    switch (this.params.colorMode) {
      case 'colorful': return 1;
      case 'custom': return 2;
      default: return 0; // grayscale
    }
  }
  
  /**
   * Update parameters
   */
  public updateParams(params: Partial<FractalNoiseParams>): void {
    if (!this.noiseMaterial || !this.noiseMaterial.uniforms) return;
    
    // Update params object
    this.params = {
      ...this.params,
      ...params
    };
    
    // Update shader uniforms
    const uniforms = this.noiseMaterial.uniforms;
    
    if (params.scale !== undefined && uniforms.u_scale) {
      uniforms.u_scale.value = params.scale;
    }
    
    if (params.octaves !== undefined && uniforms.u_octaves) {
      uniforms.u_octaves.value = params.octaves;
    }
    
    if (params.persistence !== undefined && uniforms.u_persistence) {
      uniforms.u_persistence.value = params.persistence;
    }
    
    if (params.lacunarity !== undefined && uniforms.u_lacunarity) {
      uniforms.u_lacunarity.value = params.lacunarity;
    }
    
    if (params.noiseType !== undefined && uniforms.u_noiseType) {
      uniforms.u_noiseType.value = this.getNoiseTypeValue();
    }
    
    if (params.domain !== undefined && uniforms.u_domainType) {
      uniforms.u_domainType.value = this.getDomainTypeValue();
    }
    
    if (params.colorMode !== undefined && uniforms.u_colorMode) {
      uniforms.u_colorMode.value = this.getColorModeValue();
    }
    
    if (params.colorA !== undefined && uniforms.u_colorA) {
      uniforms.u_colorA.value = params.colorA;
    }
    
    if (params.colorB !== undefined && uniforms.u_colorB) {
      uniforms.u_colorB.value = params.colorB;
    }
    
    if (params.timeScale !== undefined && uniforms.u_timeScale) {
      uniforms.u_timeScale.value = params.timeScale;
    }
    
    if (params.seed !== undefined && uniforms.u_seed) {
      uniforms.u_seed.value = params.seed;
    }
  }
  
  /**
   * Get uniform update functions
   */
  public getUniformUpdaters(): Record<string, (time: number, deltaTime: number) => void> {
    return {
      u_time: (time: number) => {
        if (this.noiseMaterial && this.noiseMaterial.uniforms && this.noiseMaterial.uniforms.u_time) {
          this.noiseMaterial.uniforms.u_time.value = time / 1000.0;
        }
      },
      
      u_resolution: (time: number) => {
        if (this.noiseMaterial && this.noiseMaterial.uniforms && this.noiseMaterial.uniforms.u_resolution && this.webGLRenderer) {
          const size = new THREE.Vector2();
          this.webGLRenderer.getSize(size);
          this.noiseMaterial.uniforms.u_resolution.value = size;
        }
      }
    };
  }
  
  /**
   * Initialize the fractal noise with WebGL renderer
   */
  public initialize(renderer: THREE.WebGLRenderer): void {
    super.initialize(renderer);
    
    // Store reference to renderer for resolution updates
    this.webGLRenderer = renderer;
    
    // Get initial resolution
    if (this.noiseMaterial && this.noiseMaterial.uniforms && this.noiseMaterial.uniforms.u_resolution) {
      const size = new THREE.Vector2();
      renderer.getSize(size);
      this.noiseMaterial.uniforms.u_resolution.value = size;
    }
  }
  
  // Reference to the WebGL renderer
  private webGLRenderer: THREE.WebGLRenderer | null = null;

  /**
   * Render the fractal noise
   */
  public render(renderer: THREE.WebGLRenderer, target?: THREE.WebGLRenderTarget): void {
    if (!this.initialized || !this.mesh || !this.noiseMaterial) return;

    // Store reference to renderer for future use
    this.webGLRenderer = renderer;
    
    // Render to the target
    this.mesh.material = this.noiseMaterial;
    renderer.setRenderTarget(target || null);
    renderer.render(this.scene, this.camera);
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    super.dispose();
    
    if (this.noiseMaterial) {
      this.noiseMaterial = null;
    }
    
    this.webGLRenderer = null;
  }
} 