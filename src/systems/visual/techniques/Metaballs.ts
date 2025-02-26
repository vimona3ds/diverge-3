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
    
    // TODO: Use actual shader code from files once implemented
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
      
      // TODO: Replace with actual metaball shader implementation
      void main() {
        // Placeholder: just render a gradient
        gl_FragColor = vec4(vUv.x, vUv.y, sin(u_time) * 0.5 + 0.5, 1.0);
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
      uniforms
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
   * Get uniform updaters for time-based animations
   */
  public getUniformUpdaters(): Record<string, (time: number, deltaTime: number) => void> {
    return {
      u_time: (time: number) => time / 1000.0
    };
  }
  
  /**
   * Update internal state with new parameters
   */
  private updateInternalState(params: MetaballParams): void {
    this.metaballs = [...params.metaballs];
    this.threshold = params.threshold;
    this.colorMapping = params.colorMapping;
    this.customColorA = params.customColorA.clone();
    this.customColorB = params.customColorB.clone();
  }
  
  /**
   * Fill shader arrays with metaball data
   */
  private fillShaderArrays(
    positions: Float32Array,
    radii: Float32Array,
    strengths: Float32Array
  ): void {
    // Fill arrays with metaball data
    for (let i = 0; i < MAX_METABALLS; i++) {
      if (i < this.metaballs.length) {
        positions[i*2] = this.metaballs[i].position.x;
        positions[i*2+1] = this.metaballs[i].position.y;
        radii[i] = this.metaballs[i].radius;
        strengths[i] = this.metaballs[i].strength;
      } else {
        // Default values for unused slots
        positions[i*2] = 0;
        positions[i*2+1] = 0;
        radii[i] = 0;
        strengths[i] = 0;
      }
    }
  }
} 