import * as THREE from 'three';
import { BaseTechnique } from './BaseTechnique';
import { IShaderMaterial } from '../../../core/types/visual';

/**
 * Parameters for the fluid simulation
 */
export interface FluidSimulationParams {
  resolution: number;          // Grid resolution (power of 2 recommended)
  dyeResolution: number;       // Dye texture resolution (visualization)
  densityDissipation: number;  // How quickly the density dissipates
  velocityDissipation: number; // How quickly the velocity dissipates
  pressureIterations: number;  // Number of pressure solver iterations
  curl: number;                // Curl force strength (vorticity)
  splatRadius: number;         // Radius of fluid injection
  colorA: THREE.Color;         // First color for visualization
  colorB: THREE.Color;         // Second color for visualization
  colorMode: 'rainbow' | 'custom' | 'monochrome'; // Visualization mode
}

/**
 * Types of fluid simulation steps
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
 * Custom uniform interface that includes an update function
 */
interface IUniformWithUpdate extends THREE.IUniform {
  update?: (time: number, deltaTime?: number) => any;
}

/**
 * Implementation of 2D fluid simulation based on Navier-Stokes equations
 * Uses a grid-based approach with velocity and pressure fields
 */
export class FluidSimulation extends BaseTechnique {
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
  private advectionMaterial: IShaderMaterial | null = null;
  private divergenceMaterial: IShaderMaterial | null = null;
  private curlMaterial: IShaderMaterial | null = null;
  private vorticityMaterial: IShaderMaterial | null = null;
  private pressureMaterial: IShaderMaterial | null = null;
  private gradientSubtractMaterial: IShaderMaterial | null = null;
  private clearMaterial: IShaderMaterial | null = null;
  private displayMaterial: IShaderMaterial | null = null;
  
  // External forces
  private pointerPositions: { [id: number]: THREE.Vector2 } = {};
  private pointerForces: { [id: number]: THREE.Vector2 } = {};
  private lastUpdateTime: number = 0;
  
  constructor(id: string) {
    super(id, 'FluidSimulation');
    
    // Default parameters
    this.params = {
      resolution: 128,
      dyeResolution: 512,
      densityDissipation: 0.98,
      velocityDissipation: 0.98,
      pressureIterations: 20,
      curl: 30,
      splatRadius: 0.25,
      colorA: new THREE.Color(0x00ffff),
      colorB: new THREE.Color(0xff0000),
      colorMode: 'rainbow'
    };
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
    if (this.clearMaterial) {
      this.clearMaterial.uniforms.u_clearColor.value.set(0, 0, 0, 1);
      
      // Clear velocity
      if (this.velocityDoubleFBO) {
        this.mesh!.material = this.clearMaterial;
        renderer.setRenderTarget(this.velocityDoubleFBO[0]);
        renderer.render(this.scene, this.camera);
        renderer.setRenderTarget(this.velocityDoubleFBO[1]);
        renderer.render(this.scene, this.camera);
      }
      
      // Clear pressure
      if (this.pressureDoubleFBO) {
        this.mesh!.material = this.clearMaterial;
        renderer.setRenderTarget(this.pressureDoubleFBO[0]);
        renderer.render(this.scene, this.camera);
        renderer.setRenderTarget(this.pressureDoubleFBO[1]);
        renderer.render(this.scene, this.camera);
      }
      
      // Clear density
      if (this.densityDoubleFBO) {
        this.mesh!.material = this.clearMaterial;
        renderer.setRenderTarget(this.densityDoubleFBO[0]);
        renderer.render(this.scene, this.camera);
        renderer.setRenderTarget(this.densityDoubleFBO[1]);
        renderer.render(this.scene, this.camera);
      }
      
      // Clear divergence
      if (this.divergenceRenderTarget) {
        this.mesh!.material = this.clearMaterial;
        renderer.setRenderTarget(this.divergenceRenderTarget);
        renderer.render(this.scene, this.camera);
      }
      
      // Clear curl
      if (this.curlRenderTarget) {
        this.mesh!.material = this.clearMaterial;
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
    this.baseMaterial = new THREE.ShaderMaterial({
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: '',
      depthTest: false,
      depthWrite: false,
    });

    // Clear material
    this.clearMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_clearColor: { value: new THREE.Vector4(0, 0, 0, 1) },
      },
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: CLEAR_FRAG_SHADER,
      depthTest: false,
      depthWrite: false,
    });

    // Advection material
    this.advectionMaterial = new THREE.ShaderMaterial({
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

    // Divergence material
    this.divergenceMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_velocity: { value: null },
        u_texelSize: { value: new THREE.Vector2(1.0 / this.params.resolution, 1.0 / this.params.resolution) },
      },
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: DIVERGENCE_FRAG_SHADER,
      depthTest: false,
      depthWrite: false,
    });

    // Pressure material
    this.pressureMaterial = new THREE.ShaderMaterial({
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

    // Gradient material
    this.gradientSubtractMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_pressure: { value: null },
        u_velocity: { value: null },
        u_texelSize: { value: new THREE.Vector2(1.0 / this.params.resolution, 1.0 / this.params.resolution) },
      },
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: GRADIENT_FRAG_SHADER,
      depthTest: false,
      depthWrite: false,
    });

    // Curl material
    this.curlMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_velocity: { value: null },
        u_texelSize: { value: new THREE.Vector2(1.0 / this.params.resolution, 1.0 / this.params.resolution) },
      },
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: CURL_FRAG_SHADER,
      depthTest: false,
      depthWrite: false,
    });

    // Vorticity material
    this.vorticityMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_velocity: { value: null },
        u_curl: { value: null },
        u_curl_strength: { value: this.params.curl },
        u_dt: { value: 0.0 },
        u_texelSize: { value: new THREE.Vector2(1.0 / this.params.resolution, 1.0 / this.params.resolution) },
      },
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: VORTICITY_FRAG_SHADER,
      depthTest: false,
      depthWrite: false,
    });

    // Add forces material
    this.addForcesMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_velocity: { value: null },
        u_force: { value: new THREE.Vector2(0, 0) },
        u_point: { value: new THREE.Vector2(0, 0) },
        u_radius: { value: this.params.splatRadius * 0.5 },
        u_texelSize: { value: new THREE.Vector2(1.0 / this.params.resolution, 1.0 / this.params.resolution) },
      },
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: ADD_FORCE_FRAG_SHADER,
      depthTest: false,
      depthWrite: false,
    });

    // Add color/dye material
    this.addDyeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_density: { value: null },
        u_color: { value: new THREE.Vector4(1, 1, 1, 1) },
        u_point: { value: new THREE.Vector2(0, 0) },
        u_radius: { value: this.params.splatRadius * this.params.splatRadius },
        u_texelSize: { value: new THREE.Vector2(1.0 / this.params.resolution, 1.0 / this.params.resolution) },
      },
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: ADD_DYE_FRAG_SHADER,
      depthTest: false,
      depthWrite: false,
    });

    // Display material for rendering the final result
    this.displayMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_density: { value: null },
        u_velocity: { value: null },
        u_colorMode: { value: 0 },
        u_colorA: { value: this.params.colorA },
        u_colorB: { value: this.params.colorB },
        u_time: { value: 0.0 },
      },
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: DISPLAY_FRAG_SHADER,
      depthTest: false,
      depthWrite: false,
    });
  }
  
  /**
   * Create a shader material for the fluid simulation
   * @param params Parameters for the simulation
   */
  public createMaterial(params: FluidSimulationParams): IShaderMaterial {
    this.params = { ...params };
    
    // Already created in initialize(), just update params
    this.updateParams(params);
    
    // Return the display material which will be used for visualization
    return this.displayMaterial as IShaderMaterial;
  }
  
  /**
   * Update simulation parameters
   * @param params New parameters
   */
  public updateParams(params: FluidSimulationParams): void {
    // If resolution changed, we need to recreate render targets
    const resolutionChanged = 
      this.params.resolution !== params.resolution ||
      this.params.dyeResolution !== params.dyeResolution;
    
    this.params = { ...params };
    
    if (resolutionChanged && this.simInitialized) {
      // TODO: Dispose and recreate render targets with new resolution
    }
    
    // Update material uniforms
    if (this.vorticityMaterial) {
      this.vorticityMaterial.uniforms.u_curl_strength.value = params.curl;
    }
    
    if (this.displayMaterial) {
      this.displayMaterial.uniforms.u_colorMode.value = 
        params.colorMode === 'rainbow' ? 0 : 
        params.colorMode === 'custom' ? 1 : 2;
      this.displayMaterial.uniforms.u_colorA.value = params.colorA;
      this.displayMaterial.uniforms.u_colorB.value = params.colorB;
    }
    
    // Update texel size uniforms where needed
    const simTexelSize = new THREE.Vector2(1.0 / params.resolution, 1.0 / params.resolution);
    const dyeTexelSize = new THREE.Vector2(1.0 / params.dyeResolution, 1.0 / params.dyeResolution);
    
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
        return Math.min(deltaTime / 1000.0, 0.016);
      }
    };
  }
  
  /**
   * Perform one step of the fluid simulation
   * @param renderer The WebGL renderer
   * @param deltaTime Time since last update in milliseconds
   */
  private simulateStep(renderer: THREE.WebGLRenderer, deltaTime: number): void {
    if (!this.velocityDoubleFBO || !this.densityDoubleFBO || !this.pressureDoubleFBO) return;
    
    // Helper to swap FBO buffers
    const swap = (fbo: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget]) => {
      [fbo[0], fbo[1]] = [fbo[1], fbo[0]];
    };
    
    // Convert deltaTime to seconds and clamp to avoid instability
    const dt = Math.min(deltaTime / 1000, 0.016);
    
    // Update shader uniforms with current time step
    if (this.advectionMaterial) this.advectionMaterial.uniforms.u_dt.value = dt;
    if (this.vorticityMaterial) this.vorticityMaterial.uniforms.u_dt.value = dt;
    
    // 1. Advect velocity
    if (this.advectionMaterial) {
      this.advectionMaterial.uniforms.u_velocity.value = this.velocityDoubleFBO[0].texture;
      this.advectionMaterial.uniforms.u_source.value = this.velocityDoubleFBO[0].texture;
      this.advectionMaterial.uniforms.u_dissipation.value = this.params.velocityDissipation;
      
      this.mesh!.material = this.advectionMaterial;
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
    if (this.clearMaterial && this.pressureDoubleFBO) {
      this.clearMaterial.uniforms.u_clearColor.value.set(0, 0, 0, 1);
      
      this.mesh!.material = this.clearMaterial;
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
    if (this.advectionMaterial && this.densityDoubleFBO) {
      this.advectionMaterial.uniforms.u_velocity.value = this.velocityDoubleFBO[0].texture;
      this.advectionMaterial.uniforms.u_source.value = this.densityDoubleFBO[0].texture;
      this.advectionMaterial.uniforms.u_dissipation.value = this.params.densityDissipation;
      
      this.mesh!.material = this.advectionMaterial;
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
    if (!this.initialized || !this.clearMaterial) return;
    
    // Clear all simulation render targets
    this.clearMaterial.uniforms.u_clearColor.value.set(0, 0, 0, 1);
    
    if (this.velocityDoubleFBO) {
      this.mesh!.material = this.clearMaterial;
      renderer.setRenderTarget(this.velocityDoubleFBO[0]);
      renderer.render(this.scene, this.camera);
      renderer.setRenderTarget(this.velocityDoubleFBO[1]);
      renderer.render(this.scene, this.camera);
    }
    
    if (this.pressureDoubleFBO) {
      this.mesh!.material = this.clearMaterial;
      renderer.setRenderTarget(this.pressureDoubleFBO[0]);
      renderer.render(this.scene, this.camera);
      renderer.setRenderTarget(this.pressureDoubleFBO[1]);
      renderer.render(this.scene, this.camera);
    }
    
    if (this.densityDoubleFBO) {
      this.mesh!.material = this.clearMaterial;
      renderer.setRenderTarget(this.densityDoubleFBO[0]);
      renderer.render(this.scene, this.camera);
      renderer.setRenderTarget(this.densityDoubleFBO[1]);
      renderer.render(this.scene, this.camera);
    }
    
    if (this.divergenceRenderTarget) {
      this.mesh!.material = this.clearMaterial;
      renderer.setRenderTarget(this.divergenceRenderTarget);
      renderer.render(this.scene, this.camera);
    }
    
    if (this.curlRenderTarget) {
      this.mesh!.material = this.clearMaterial;
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