import * as THREE from 'three';
import { BaseTechnique } from './BaseTechnique';
import { IShaderMaterial } from '../../../core/types/visual';

/**
 * Interface representing a single metaball
 */
export interface IMetaball {
  position: THREE.Vector2;
  radius: number;
  strength: number;
}

/**
 * Parameters for the Metaballs technique
 */
export interface MetaballParams {
  metaballs: IMetaball[];
  threshold: number;
  colorMapping: 'grayscale' | 'heatmap' | 'custom';
  customColorA: THREE.Color;
  customColorB: THREE.Color;
}

/**
 * Custom uniform interface that includes an update function
 */
interface IUniformWithUpdate extends THREE.IUniform {
  update?: (time: number, deltaTime?: number) => any;
}

/**
 * Maximum number of metaballs supported by the shader
 */
const MAX_METABALLS = 16;

/**
 * Implementation of the Metaball visual technique
 */
export class Metaballs extends BaseTechnique {
  private metaballs: IMetaball[] = [];
  private threshold: number = 1.0;
  private colorMapping: string = 'grayscale';
  private customColorA: THREE.Color = new THREE.Color(0x000000);
  private customColorB: THREE.Color = new THREE.Color(0xffffff);
  
  constructor(id: string) {
    super(id, 'Metaballs');
  }
  
  /**
   * Create a shader material for the metaball effect
   * @param params Parameters for the metaball effect
   */
  public createMaterial(params: MetaballParams): IShaderMaterial {
    this.updateInternalState(params);
    
    // Create arrays for shader
    const positions = new Float32Array(MAX_METABALLS * 2);
    const radii = new Float32Array(MAX_METABALLS);
    const strengths = new Float32Array(MAX_METABALLS);
    
    // Fill arrays with initial values
    this.fillShaderArrays(positions, radii, strengths);
    
    const vertexShader = `
      varying vec2 vUv;
      
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    const fragmentShader = `
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_positions[${MAX_METABALLS}];
      uniform float u_radii[${MAX_METABALLS}];
      uniform float u_strengths[${MAX_METABALLS}];
      uniform int u_count;
      uniform float u_threshold;
      uniform int u_colorMapping;
      uniform vec3 u_colorA;
      uniform vec3 u_colorB;
      
      varying vec2 vUv;
      
      // Helper function to map a value from one range to another
      float map(float value, float min1, float max1, float min2, float max2) {
        return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
      }
      
      // Color mapping functions
      vec3 heatmap(float t) {
        // Red to Yellow to White color mapping
        return vec3(
          t > 0.5 ? 1.0 : map(t, 0.0, 0.5, 0.0, 1.0),
          t > 0.25 ? 1.0 : map(t, 0.0, 0.25, 0.0, 1.0),
          t > 0.75 ? map(t, 0.75, 1.0, 0.0, 1.0) : 0.0
        );
      }
      
      // Simple fractal noise for organic texture
      float noise(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      
      float fractalNoise(vec2 st) {
        float v = 0.0;
        float amp = 0.5;
        vec2 shift = vec2(100.0);
        // Rotate to reduce axial bias
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
        
        for (int i = 0; i < 3; i++) {
            v += amp * noise(st);
            st = rot * st * 2.0 + shift;
            amp *= 0.5;
        }
        return v;
      }
      
      void main() {
        // Convert UV to pixel coordinates
        vec2 uv = vUv;
        vec2 pixelCoord = uv * u_resolution;
        
        // Calculate metaball field
        float field = 0.0;
        
        for(int i = 0; i < ${MAX_METABALLS}; i++) {
          if(i >= u_count) break;
          
          vec2 metaballPos = u_positions[i];
          float radius = u_radii[i];
          float strength = u_strengths[i];
          
          // Calculate distance to metaball
          float dx = pixelCoord.x - metaballPos.x * u_resolution.x;
          float dy = pixelCoord.y - metaballPos.y * u_resolution.y;
          float d2 = dx * dx + dy * dy;
          
          // Inverse-square falloff
          field += strength * radius * radius / (d2 + 1.0);
        }
        
        // Apply threshold with smoothing for organic edges
        float intensity = smoothstep(u_threshold, u_threshold * 1.2, field);
        
        // Add subtle noise to field for organic texture
        float noise = fractalNoise(uv * 3.0 + u_time * 0.1) * 0.1;
        intensity = mix(intensity, intensity * (1.0 + noise), 0.3);
        
        // Apply color mapping
        vec3 color;
        
        if (u_colorMapping == 0) {
          // Grayscale
          color = vec3(intensity);
        } else if (u_colorMapping == 1) {
          // Heatmap
          color = heatmap(intensity);
        } else {
          // Custom color mapping
          color = mix(u_colorA, u_colorB, intensity);
        }
        
        // Add subtle pulsing effect for "aliveness"
        float pulse = sin(u_time * 0.5) * 0.05 + 0.95;
        color *= pulse;
        
        gl_FragColor = vec4(color, intensity > 0.05 ? 1.0 : intensity * 20.0);
      }
    `;
    
    const uniforms: { [key: string]: IUniformWithUpdate } = {
      u_resolution: { value: new THREE.Vector2(1, 1) },
      u_positions: { value: positions },
      u_radii: { value: radii },
      u_strengths: { value: strengths },
      u_count: { value: params.metaballs.length },
      u_threshold: { value: params.threshold },
      u_colorMapping: { 
        value: params.colorMapping === 'grayscale' ? 0 : 
              params.colorMapping === 'heatmap' ? 1 : 2 
      },
      u_colorA: { value: params.customColorA },
      u_colorB: { value: params.customColorB },
      u_time: { 
        value: 0.0,
        update: (time: number) => time / 1000.0
      }
    };
    
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true
    }) as IShaderMaterial;
    
    this.material = material;
    return material;
  }
  
  /**
   * Update metaball parameters
   * @param params New parameters
   */
  public updateParams(params: MetaballParams): void {
    if (!this.material) return;
    
    this.updateInternalState(params);
    
    // Update uniforms with new values
    const uniforms = this.material.uniforms;
    
    uniforms.u_count.value = this.metaballs.length;
    uniforms.u_threshold.value = this.threshold;
    uniforms.u_colorMapping.value = this.colorMapping === 'grayscale' ? 0 : 
                                   this.colorMapping === 'heatmap' ? 1 : 2;
    uniforms.u_colorA.value = this.customColorA;
    uniforms.u_colorB.value = this.customColorB;
    
    // Update metaball arrays
    this.fillShaderArrays(
      uniforms.u_positions.value,
      uniforms.u_radii.value,
      uniforms.u_strengths.value
    );
  }
  
  /**
   * Get uniform updaters for animation
   */
  public getUniformUpdaters(): Record<string, (time: number, deltaTime: number) => void> {
    return {
      u_time: (time: number) => {
        if (this.material) {
          this.material.uniforms.u_time.value = time / 1000.0;
        }
      }
    };
  }
  
  /**
   * Update internal state from params
   */
  private updateInternalState(params: MetaballParams): void {
    this.metaballs = [...params.metaballs];
    this.threshold = params.threshold;
    this.colorMapping = params.colorMapping;
    this.customColorA.copy(params.customColorA);
    this.customColorB.copy(params.customColorB);
  }
  
  /**
   * Fill shader array uniforms with metaball data
   */
  private fillShaderArrays(
    positions: Float32Array,
    radii: Float32Array,
    strengths: Float32Array
  ): void {
    // First reset all values to ensure unused slots are cleared
    positions.fill(0);
    radii.fill(0);
    strengths.fill(0);
    
    // Fill arrays with metaball data
    for (let i = 0; i < this.metaballs.length && i < MAX_METABALLS; i++) {
      const metaball = this.metaballs[i];
      positions[i * 2] = metaball.position.x;
      positions[i * 2 + 1] = metaball.position.y;
      radii[i] = metaball.radius;
      strengths[i] = metaball.strength;
    }
  }
} 