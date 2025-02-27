import * as THREE from 'three';
import { BaseTechnique } from './BaseTechnique';
import { IShaderMaterial } from '../../../core/types/visual';

/**
 * Parameters for the feedback loop technique
 */
export interface FeedbackLoopParams {
  feedbackStrength: number;        // How much of the previous frame to mix in (0-1)
  feedbackTexture: THREE.Texture;   // The texture to feed back
  translateX: number;              // Translation amount on X axis (-1 to 1)
  translateY: number;              // Translation amount on Y axis (-1 to 1)
  scale: number;                   // Scaling factor (0.9-1.1 recommended)
  rotation: number;                // Rotation angle in radians
  blend: 'add' | 'multiply' | 'screen' | 'overlay'; // Blending mode
  fadeRate: number;                // How quickly the feedback fades (0-1)
  colorShift: boolean;             // Whether to apply color shifting
  colorShiftRate: number;          // How quickly colors shift (0-1)
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
 * FeedbackLoop implementation for creating visual feedback effects
 * Applies transformations and blending to create interesting visual patterns
 */
export class FeedbackLoop extends BaseTechnique {
  private params: FeedbackLoopParams;
  private feedbackPingPong: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null = null;
  private currentTarget: number = 0;
  private feedbackMaterial: IShaderMaterial | null = null;
  private webGLRenderer: THREE.WebGLRenderer | null = null;
  
  // Initial parameters
  private static readonly DEFAULT_PARAMS: Partial<FeedbackLoopParams> = {
    feedbackStrength: 0.9,
    translateX: 0.0,
    translateY: 0.0,
    scale: 1.0,
    rotation: 0.0,
    blend: 'screen',
    fadeRate: 0.05,
    colorShift: false,
    colorShiftRate: 0.01
  };
  
  constructor(id: string) {
    super(id, 'FeedbackLoop');
    
    // Initialize with default params (will be overridden in createMaterial)
    this.params = {
      ...FeedbackLoop.DEFAULT_PARAMS,
      feedbackTexture: new THREE.Texture(),
    } as FeedbackLoopParams;
  }
  
  /**
   * Initialize the feedback loop with WebGL renderer
   */
  public initialize(renderer: THREE.WebGLRenderer): void {
    super.initialize(renderer);
    
    // Create ping-pong buffers for feedback
    const width = renderer.getSize(new THREE.Vector2()).width;
    const height = renderer.getSize(new THREE.Vector2()).height;
    
    this.createFeedbackBuffers(width, height);
  }
  
  /**
   * Create ping-pong buffers for feedback effect
   */
  private createFeedbackBuffers(width: number, height: number): void {
    // Create two render targets for ping-pong rendering
    const options = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      stencilBuffer: false,
      depthBuffer: false
    };
    
    this.feedbackPingPong = [
      new THREE.WebGLRenderTarget(width, height, options),
      new THREE.WebGLRenderTarget(width, height, options)
    ];
    
    // Clear render targets
    if (this.webGLRenderer) {
      this.webGLRenderer.setRenderTarget(this.feedbackPingPong[0]);
      this.webGLRenderer.clear();
      this.webGLRenderer.setRenderTarget(this.feedbackPingPong[1]);
      this.webGLRenderer.clear();
      this.webGLRenderer.setRenderTarget(null);
    }
  }
  
  /**
   * Create the feedback shader material
   */
  public createMaterial(params: FeedbackLoopParams): IShaderMaterial {
    this.params = {
      ...FeedbackLoop.DEFAULT_PARAMS,
      ...params
    } as FeedbackLoopParams;
    
    // Define vertex shader for feedback effect
    const vertexShader = `
      varying vec2 v_uv;
      
      void main() {
        v_uv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    // Define fragment shader for feedback effect with transformations
    const fragmentShader = `
      precision highp float;
      
      varying vec2 v_uv;
      
      uniform sampler2D u_feedbackTexture;
      uniform sampler2D u_currentTexture;
      uniform float u_feedbackStrength;
      uniform float u_fadeRate;
      uniform vec2 u_translation;
      uniform float u_scale;
      uniform float u_rotation;
      uniform int u_blendMode;
      uniform float u_time;
      uniform bool u_colorShift;
      uniform float u_colorShiftRate;
      
      // Apply transformation to UV coordinates
      vec2 transformUV(vec2 uv) {
        // Center UVs
        vec2 centered = uv - 0.5;
        
        // Scale
        centered *= u_scale;
        
        // Rotate
        float s = sin(u_rotation);
        float c = cos(u_rotation);
        mat2 rotationMatrix = mat2(c, -s, s, c);
        centered = rotationMatrix * centered;
        
        // Translate
        centered += u_translation;
        
        // Back to 0-1 range
        return centered + 0.5;
      }
      
      // Color shift function
      vec3 shiftColor(vec3 color, float time) {
        // Subtle hue rotation
        float angle = time * u_colorShiftRate;
        vec3 k = vec3(0.57735, 0.57735, 0.57735);
        float cosAngle = cos(angle);
        
        return color * cosAngle + cross(k, color) * sin(angle) + k * dot(k, color) * (1.0 - cosAngle);
      }
      
      // Blend modes
      vec4 blendAdd(vec4 base, vec4 blend) {
        return min(base + blend, 1.0);
      }
      
      vec4 blendMultiply(vec4 base, vec4 blend) {
        return base * blend;
      }
      
      vec4 blendScreen(vec4 base, vec4 blend) {
        return 1.0 - (1.0 - base) * (1.0 - blend);
      }
      
      vec4 blendOverlay(vec4 base, vec4 blend) {
        vec4 result;
        for (int i = 0; i < 4; i++) {
          if (base[i] < 0.5) {
            result[i] = 2.0 * base[i] * blend[i];
          } else {
            result[i] = 1.0 - 2.0 * (1.0 - base[i]) * (1.0 - blend[i]);
          }
        }
        return result;
      }
      
      void main() {
        // Get current texture color
        vec4 current = texture2D(u_currentTexture, v_uv);
        
        // Transform UV coordinates for feedback
        vec2 feedbackUV = transformUV(v_uv);
        
        // Check if transformed UVs are within bounds
        if (feedbackUV.x < 0.0 || feedbackUV.x > 1.0 || feedbackUV.y < 0.0 || feedbackUV.y > 1.0) {
          // Out of bounds, just use current texture
          gl_FragColor = current;
          return;
        }
        
        // Sample feedback texture
        vec4 feedback = texture2D(u_feedbackTexture, feedbackUV);
        
        // Apply fade
        feedback *= (1.0 - u_fadeRate);
        
        // Apply color shifting if enabled
        if (u_colorShift) {
          feedback.rgb = shiftColor(feedback.rgb, u_time);
        }
        
        // Apply blending based on blend mode
        vec4 result;
        if (u_blendMode == 0) {
          result = blendAdd(current, feedback * u_feedbackStrength);
        } else if (u_blendMode == 1) {
          result = blendMultiply(current, feedback * u_feedbackStrength);
        } else if (u_blendMode == 2) {
          result = blendScreen(current, feedback * u_feedbackStrength);
        } else {
          result = blendOverlay(current, feedback * u_feedbackStrength);
        }
        
        gl_FragColor = result;
      }
    `;
    
    // Create shader material
    const material = new THREE.ShaderMaterial({
      uniforms: {
        u_feedbackTexture: { value: this.feedbackPingPong ? this.feedbackPingPong[0].texture : null },
        u_currentTexture: { value: this.params.feedbackTexture },
        u_feedbackStrength: { value: this.params.feedbackStrength },
        u_fadeRate: { value: this.params.fadeRate },
        u_translation: { value: new THREE.Vector2(this.params.translateX, this.params.translateY) },
        u_scale: { value: this.params.scale },
        u_rotation: { value: this.params.rotation },
        u_blendMode: { value: this.getBlendModeValue() },
        u_time: { value: 0.0 },
        u_colorShift: { value: this.params.colorShift },
        u_colorShiftRate: { value: this.params.colorShiftRate }
      },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false
    });
    
    // Convert to IShaderMaterial
    this.feedbackMaterial = createShaderMaterial(material, {
      u_feedbackTexture: 'sampler2D',
      u_currentTexture: 'sampler2D',
      u_feedbackStrength: 'float',
      u_fadeRate: 'float',
      u_translation: 'v2',
      u_scale: 'float',
      u_rotation: 'float',
      u_blendMode: 'int',
      u_time: 'float',
      u_colorShift: 'bool',
      u_colorShiftRate: 'float'
    });
    
    // Set this as the technique's material (required by BaseTechnique)
    this.material = this.feedbackMaterial;
    
    return this.feedbackMaterial;
  }
  
  /**
   * Convert blend mode string to value
   */
  private getBlendModeValue(): number {
    switch (this.params.blend) {
      case 'add': return 0;
      case 'multiply': return 1;
      case 'screen': return 2;
      case 'overlay': return 3;
      default: return 2; // Default to screen
    }
  }
  
  /**
   * Update parameters
   */
  public updateParams(params: Partial<FeedbackLoopParams>): void {
    if (!this.feedbackMaterial || !this.feedbackMaterial.uniforms) return;
    
    // Update params object
    this.params = {
      ...this.params,
      ...params
    };
    
    // Update shader uniforms
    const uniforms = this.feedbackMaterial.uniforms;
    
    if (params.feedbackStrength !== undefined && uniforms.u_feedbackStrength) {
      uniforms.u_feedbackStrength.value = params.feedbackStrength;
    }
    
    if (params.fadeRate !== undefined && uniforms.u_fadeRate) {
      uniforms.u_fadeRate.value = params.fadeRate;
    }
    
    if ((params.translateX !== undefined || params.translateY !== undefined) && uniforms.u_translation) {
      uniforms.u_translation.value.set(
        params.translateX !== undefined ? params.translateX : this.params.translateX,
        params.translateY !== undefined ? params.translateY : this.params.translateY
      );
    }
    
    if (params.scale !== undefined && uniforms.u_scale) {
      uniforms.u_scale.value = params.scale;
    }
    
    if (params.rotation !== undefined && uniforms.u_rotation) {
      uniforms.u_rotation.value = params.rotation;
    }
    
    if (params.blend !== undefined && uniforms.u_blendMode) {
      uniforms.u_blendMode.value = this.getBlendModeValue();
    }
    
    if (params.colorShift !== undefined && uniforms.u_colorShift) {
      uniforms.u_colorShift.value = params.colorShift;
    }
    
    if (params.colorShiftRate !== undefined && uniforms.u_colorShiftRate) {
      uniforms.u_colorShiftRate.value = params.colorShiftRate;
    }
    
    if (params.feedbackTexture !== undefined && uniforms.u_currentTexture) {
      uniforms.u_currentTexture.value = params.feedbackTexture;
    }
  }
  
  /**
   * Get uniform update functions
   */
  public getUniformUpdaters(): Record<string, (time: number, deltaTime: number) => void> {
    return {
      u_time: (time: number) => {
        if (this.feedbackMaterial && this.feedbackMaterial.uniforms && this.feedbackMaterial.uniforms.u_time) {
          this.feedbackMaterial.uniforms.u_time.value = time / 1000.0;
        }
      }
    };
  }
  
  /**
   * Render the feedback effect
   */
  public render(renderer: THREE.WebGLRenderer, target?: THREE.WebGLRenderTarget): void {
    if (!this.initialized || !this.mesh || !this.feedbackMaterial || !this.feedbackPingPong) return;
    
    // Store reference to WebGL renderer for buffer initialization
    this.webGLRenderer = renderer;
    
    // Make sure uniforms exist
    if (!this.feedbackMaterial.uniforms) return;
    
    // Update feedback texture uniform to use the previous frame
    const prevIndex = this.currentTarget;
    const nextIndex = (this.currentTarget + 1) % 2;
    
    // Use the previous render as input if the uniform exists
    if (this.feedbackMaterial.uniforms.u_feedbackTexture) {
      this.feedbackMaterial.uniforms.u_feedbackTexture.value = this.feedbackPingPong[prevIndex].texture;
    }
    
    // Render to the next target in the ping-pong pair
    this.mesh.material = this.feedbackMaterial;
    renderer.setRenderTarget(this.feedbackPingPong[nextIndex]);
    renderer.render(this.scene, this.camera);
    
    // If target is provided, copy the result to it
    if (target) {
      renderer.setRenderTarget(target);
      renderer.render(this.scene, this.camera);
    } else {
      // Otherwise render to the screen
      renderer.setRenderTarget(null);
      renderer.render(this.scene, this.camera);
    }
    
    // Swap buffers
    this.currentTarget = nextIndex;
  }
  
  /**
   * Resize feedback buffers when renderer size changes
   */
  public resize(width: number, height: number): void {
    if (this.feedbackPingPong) {
      this.feedbackPingPong[0].setSize(width, height);
      this.feedbackPingPong[1].setSize(width, height);
    } else {
      this.createFeedbackBuffers(width, height);
    }
  }
  
  /**
   * Reset the feedback effect (clear buffers)
   */
  public reset(): void {
    if (!this.webGLRenderer || !this.feedbackPingPong) return;
    
    // Clear both buffers
    this.webGLRenderer.setRenderTarget(this.feedbackPingPong[0]);
    this.webGLRenderer.clear();
    this.webGLRenderer.setRenderTarget(this.feedbackPingPong[1]);
    this.webGLRenderer.clear();
    this.webGLRenderer.setRenderTarget(null);
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    super.dispose();
    
    if (this.feedbackPingPong) {
      this.feedbackPingPong[0].dispose();
      this.feedbackPingPong[1].dispose();
      this.feedbackPingPong = null;
    }
    
    if (this.feedbackMaterial) {
      this.feedbackMaterial = null;
    }
    
    this.currentTarget = 0;
  }
} 