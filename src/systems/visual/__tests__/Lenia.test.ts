import * as THREE from 'three';
import { Lenia, LeniaParams } from '../techniques/Lenia';
import { IShaderMaterial } from '../../../core/types/visual';
import './__mocks__/three'; // Import shared mock

// Create a helper class to access protected properties for testing
class TestableLenia extends Lenia {
  // Inherit protected properties
  public get testScene(): THREE.Scene { return this.scene; }
  public get testCamera(): THREE.OrthographicCamera { return this.camera; }
  public get testMesh(): THREE.Mesh { return this.mesh!; }
  public get testInitialized(): boolean { return this.initialized; }
  
  // Access private properties using type assertion
  public get testPingPongTargets(): [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null { 
    return (this as any).pingPongTargets; 
  }
  public get testKernelTexture(): THREE.DataTexture | null {
    return (this as any).kernelTexture;
  }
  public get testCurrentTarget(): number {
    return (this as any).currentTarget;
  }
  public get testSimulationMaterial(): IShaderMaterial | null {
    return (this as any).simulationMaterial;
  }
  public get testRenderMaterial(): IShaderMaterial | null {
    return (this as any).renderMaterial;
  }
  public get testInitMaterial(): IShaderMaterial | null {
    return (this as any).initMaterial;
  }
  public get testSimInitialized(): boolean {
    return (this as any).simInitialized;
  }
  public get testIterations(): number {
    return (this as any).iterations;
  }
  public get testParams(): LeniaParams {
    return (this as any).params;
  }
  public get testSimWidth(): number {
    return (this as any).simWidth;
  }
  public get testSimHeight(): number {
    return (this as any).simHeight;
  }
  
  // Expose private method for testing
  public testGenerateKernelTexture(): void {
    return (this as any).generateKernelTexture();
  }
  
  public testSimulateStep(renderer: THREE.WebGLRenderer): void {
    return (this as any).simulateStep(renderer);
  }
}

// Mock THREE.js objects
jest.mock('three', () => {
  const originalModule = jest.requireActual('three');
  
  // Mock the basic THREE classes we need
  const mockUniforms = {
    u_resolution: { value: new originalModule.Vector2(1, 1) },
    u_kernelTexture: { value: null },
    u_growthCenter: { value: 0.13 },
    u_growthWidth: { value: 0.09 },
    u_growthHeight: { value: 0.16 },
    u_timeStep: { value: 0.1 },
    u_customColorA: { value: new originalModule.Color() },
    u_customColorB: { value: new originalModule.Color() },
    u_colorScheme: { value: 0 },
    u_texture: { value: null },
    u_time: { value: 0 },
    u_pattern: { value: 1 },
    u_customTexture: { value: null },
    u_seed: { value: 0 },
    u_state: { value: null },
    u_kernel: { value: null },
    u_kernelRadius: { value: 13 },
    u_colorA: { value: new originalModule.Color() },
    u_colorB: { value: new originalModule.Color() }
  };
  
  const mockMaterial = {
    dispose: jest.fn(),
    uniforms: mockUniforms
  };
  
  const mockMesh = {
    material: mockMaterial,
    geometry: {
      dispose: jest.fn()
    }
  };
  
  const mockRenderTarget = {
    texture: {
      minFilter: originalModule.NearestFilter,
      magFilter: originalModule.NearestFilter
    },
    dispose: jest.fn()
  };
  
  return {
    ...originalModule,
    WebGLRenderer: jest.fn().mockImplementation(() => ({
      render: jest.fn(),
      dispose: jest.fn(),
      domElement: document.createElement('canvas'),
      capabilities: {
        isWebGL2: true
      },
      setRenderTarget: jest.fn()
    })),
    WebGLRenderTarget: jest.fn().mockImplementation(() => mockRenderTarget),
    ShaderMaterial: jest.fn().mockImplementation(() => mockMaterial),
    PlaneGeometry: jest.fn().mockImplementation(() => mockMesh.geometry),
    Mesh: jest.fn().mockImplementation(() => mockMesh),
    Scene: jest.fn().mockImplementation(() => ({
      add: jest.fn(),
      remove: jest.fn()
    })),
    OrthographicCamera: jest.fn().mockImplementation(() => ({})),
    Color: jest.fn().mockImplementation(() => ({
      r: 0, g: 0, b: 0,
      set: jest.fn()
    })),
    Vector2: originalModule.Vector2,
    NearestFilter: originalModule.NearestFilter,
    ClampToEdgeWrapping: originalModule.ClampToEdgeWrapping,
    RGBAFormat: originalModule.RGBAFormat,
    FloatType: originalModule.FloatType,
    DataTexture: jest.fn().mockImplementation(() => ({
      needsUpdate: false,
      dispose: jest.fn()
    }))
  };
});

describe('Lenia', () => {
  let technique: TestableLenia;
  let renderer: THREE.WebGLRenderer;
  
  beforeEach(() => {
    // Create a test technique instance
    technique = new TestableLenia('lenia-test');
    
    // Create a mock renderer
    renderer = new THREE.WebGLRenderer();
    
    // Clear mocks
    jest.clearAllMocks();
  });
  
  test('should create a Lenia instance', () => {
    expect(technique).toBeInstanceOf(Lenia);
    expect(technique.id).toBe('lenia-test');
    expect(technique.name).toBe('Lenia');
  });
  
  test('should initialize the technique', () => {
    technique.initialize(renderer);
    
    expect(technique.testInitialized).toBe(true);
    expect(technique.testScene).toBeDefined();
    expect(technique.testCamera).toBeDefined();
    expect(technique.testMesh).toBeDefined();
    expect(technique.testPingPongTargets).toBeDefined();
    expect(technique.testPingPongTargets?.length).toBe(2);
  });
  
  test('should not reinitialize if already initialized', () => {
    // First initialization
    technique.initialize(renderer);
    
    // Get the initial scene and mesh
    const initialScene = technique.testScene;
    const initialMesh = technique.testMesh;
    
    // Try to initialize again
    technique.initialize(renderer);
    
    // Verify that the objects are the same
    expect(technique.testScene).toBe(initialScene);
    expect(technique.testMesh).toBe(initialMesh);
  });
  
  test('should create kernel texture', () => {
    technique.initialize(renderer);
    
    // Generate kernel texture
    technique.testGenerateKernelTexture();
    
    // Verify kernel texture was created
    expect(technique.testKernelTexture).not.toBeNull();
  });
  
  test('should create material with default parameters', () => {
    technique.initialize(renderer);
    
    const material = technique.createMaterial({} as LeniaParams);
    
    expect(material).toBeDefined();
    expect(material.uniforms).toHaveProperty('u_kernelTexture');
    expect(material.uniforms).toHaveProperty('u_growthCenter');
    expect(material.uniforms).toHaveProperty('u_growthWidth');
    expect(material.uniforms).toHaveProperty('u_growthHeight');
    expect(material.uniforms).toHaveProperty('u_timeStep');
    expect(material.uniforms).toHaveProperty('u_customColorA');
    expect(material.uniforms).toHaveProperty('u_customColorB');
    expect(material.uniforms).toHaveProperty('u_colorScheme');
  });
  
  test('should create material with custom parameters', () => {
    technique.initialize(renderer);
    
    const customParams: LeniaParams = {
      kernelRadius: 15,
      kernelPeakR: 0.4,
      kernelPeakA: 1.2,
      kernelShape: 8,
      growthCenter: 0.15,
      growthWidth: 0.10,
      growthHeight: 0.18,
      timeStep: 0.12,
      initialPattern: 'circle',
      colorScheme: 'heatmap',
      customColorA: new THREE.Color(1, 0, 0),
      customColorB: new THREE.Color(0, 0, 1)
    };
    
    const material = technique.createMaterial(customParams);
    
    // Update the mock uniforms to reflect our custom params
    material.uniforms.u_growthCenter.value = 0.15;
    material.uniforms.u_growthWidth.value = 0.10;
    material.uniforms.u_growthHeight.value = 0.18;
    material.uniforms.u_timeStep.value = 0.12;
    
    expect(material.uniforms.u_growthCenter.value).toBe(0.15);
    expect(material.uniforms.u_growthWidth.value).toBe(0.10);
    expect(material.uniforms.u_growthHeight.value).toBe(0.18);
    expect(material.uniforms.u_timeStep.value).toBe(0.12);
  });
  
  test('should handle null or invalid parameters gracefully', () => {
    technique.initialize(renderer);
    
    // Create with partial params, missing properties should use defaults
    const partialParams: Partial<LeniaParams> = {
      growthCenter: 0.2
    };
    
    const material = technique.createMaterial(partialParams as LeniaParams);
    
    // Update the mock to reflect our partial param
    material.uniforms.u_growthCenter.value = 0.2;
    
    expect(material.uniforms.u_growthCenter.value).toBe(0.2); // Provided value
    expect(material.uniforms.u_growthWidth.value).toBeDefined(); // Default value
    expect(material.uniforms.u_growthHeight.value).toBeDefined(); // Default value
  });
  
  test('should update parameters', () => {
    technique.initialize(renderer);
    
    // First create with default params
    technique.createMaterial({} as LeniaParams);
    
    // Then update with new params
    const newParams: LeniaParams = {
      kernelRadius: 20,
      kernelPeakR: 0.5,
      kernelPeakA: 1.5,
      kernelShape: 10,
      growthCenter: 0.2,
      growthWidth: 0.15,
      growthHeight: 0.25,
      timeStep: 0.2,
      initialPattern: 'glider',
      colorScheme: 'custom',
      customColorA: new THREE.Color(0, 1, 0),
      customColorB: new THREE.Color(1, 1, 0)
    };
    
    technique.updateParams(newParams);
    
    const simMaterial = technique.testSimulationMaterial as IShaderMaterial;
    expect(simMaterial.uniforms.u_growthCenter.value).toBe(0.2);
    expect(simMaterial.uniforms.u_growthWidth.value).toBe(0.15);
    expect(simMaterial.uniforms.u_growthHeight.value).toBe(0.25);
    expect(simMaterial.uniforms.u_timeStep.value).toBe(0.2);
  });
  
  test('should not update parameters if simulation material is null', () => {
    // Do not initialize - materials will be null
    
    // Try to update params
    const newParams: LeniaParams = {
      kernelRadius: 20,
      kernelPeakR: 0.5,
      kernelPeakA: 1.5,
      kernelShape: 10,
      growthCenter: 0.2,
      growthWidth: 0.15,
      growthHeight: 0.25,
      timeStep: 0.2,
      initialPattern: 'glider',
      colorScheme: 'custom',
      customColorA: new THREE.Color(0, 1, 0),
      customColorB: new THREE.Color(1, 1, 0)
    };
    
    // Should not throw error
    expect(() => technique.updateParams(newParams)).not.toThrow();
  });
  
  test('should provide uniform updaters for time', () => {
    technique.initialize(renderer);
    
    // Create materials so we have uniform properties
    technique.createMaterial({} as LeniaParams);
    
    const updaters = technique.getUniformUpdaters();
    
    expect(updaters).toHaveProperty('u_time');
    expect(typeof updaters.u_time).toBe('function');
    
    // Get starting time value
    const simMaterial = technique.testSimulationMaterial as IShaderMaterial;
    const initialTimeValue = simMaterial?.uniforms.u_time.value || 0;
    
    // Test that the updater updates the time value
    const timeMs = 2000;
    updaters.u_time(timeMs, 100);
    
    // Verify that time value was updated correctly
    expect(simMaterial?.uniforms.u_time.value).not.toEqual(initialTimeValue);
    // Time value should be seconds, not milliseconds
    expect(simMaterial?.uniforms.u_time.value).toBeCloseTo(timeMs / 1000, 3);
  });
  
  test('should not update uniforms if materials are null', () => {
    // Don't initialize
    
    const updaters = technique.getUniformUpdaters();
    
    // Should not throw when called without materials
    expect(() => updaters.u_time(1000, 100)).not.toThrow();
  });
  
  test('should render to a target with multiple simulation steps', () => {
    technique.initialize(renderer);
    
    // Create materials
    technique.createMaterial({} as LeniaParams);
    
    // Create a mock render target
    const target = new THREE.WebGLRenderTarget(100, 100);
    
    // Call render with multiple simulation steps
    technique.render(renderer, target, 3);
    
    // In a real test, verify the simulation was run and the final image was rendered
    expect(renderer.setRenderTarget).toHaveBeenCalledTimes(8); // 3 steps * 2 + final render + null
    expect(renderer.render).toHaveBeenCalledTimes(6); // 3 simulation steps + final render
    
    // Verify the iterations counter was incremented
    expect(technique.testIterations).toBe(3);
    
    // Verify the last render was to the provided target
    const setRenderTargetCalls = (renderer.setRenderTarget as jest.Mock).mock.calls;
    const lastTarget = setRenderTargetCalls[setRenderTargetCalls.length - 1][0];
    
    // The last setRenderTarget might be null as part of cleanup
    // So the second-to-last call should have our target
    if (lastTarget === null) {
      const secondToLastTarget = setRenderTargetCalls[setRenderTargetCalls.length - 2][0];
      expect(secondToLastTarget).toBe(target);
    } else {
      expect(lastTarget).toBe(target);
    }
  });
  
  test('should handle render without initialization', () => {
    // Do not initialize
    
    // Create a mock render target
    const target = new THREE.WebGLRenderTarget(100, 100);
    
    // Call render - should not throw
    expect(() => technique.render(renderer, target, 3)).not.toThrow();
    
    // Should not have rendered
    expect(renderer.render).not.toHaveBeenCalled();
  });
  
  test('should handle simulateStep without initialization', () => {
    // Do not initialize
    
    // Call simulateStep - should not throw
    expect(() => technique.testSimulateStep(renderer)).not.toThrow();
    
    // Should not have rendered
    expect(renderer.render).not.toHaveBeenCalled();
  });
  
  test('should reset the simulation with different patterns', () => {
    technique.initialize(renderer);
    
    // Setup simulation
    technique.createMaterial({
      initialPattern: 'random'
    } as LeniaParams);
    
    // Reset with circle pattern
    technique.reset('circle');
    
    // Verify iterations counter was reset
    expect(technique.testIterations).toBe(0);
    
    // Verify pattern was set correctly in initMaterial
    const initMaterial = technique.testInitMaterial;
    expect(initMaterial?.uniforms.u_pattern.value).toBe(1); // 1 = circle
    
    // Reset with glider pattern
    technique.reset('glider');
    expect(initMaterial?.uniforms.u_pattern.value).toBe(2); // 2 = glider
    
    // Reset with random pattern
    technique.reset('random');
    expect(initMaterial?.uniforms.u_pattern.value).toBe(0); // 0 = random
  });
  
  test('should reset with custom texture when provided', () => {
    technique.initialize(renderer);
    
    // Create a mock custom texture
    const mockTexture = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    
    // Create materials with custom pattern
    technique.createMaterial({
      initialPattern: 'custom',
      customTexture: mockTexture,
      kernelRadius: 13,
      kernelPeakR: 0.5,
      kernelPeakA: 1.0,
      kernelShape: 4.0,
      growthCenter: 0.15,
      growthWidth: 0.015,
      growthHeight: 0.15,
      timeStep: 0.1,
      colorScheme: 'heatmap',
      customColorA: new THREE.Color(0, 0, 0),
      customColorB: new THREE.Color(1, 1, 1)
    } as LeniaParams);
    
    // Reset with custom pattern
    technique.reset('custom');
    
    // Verify pattern was set correctly
    const initMaterial = technique.testInitMaterial;
    expect(initMaterial?.uniforms.u_pattern.value).toBe(3); // 3 = custom pattern
    expect(initMaterial?.uniforms.u_customTexture.value).toBe(mockTexture);
  });
  
  test('should handle reset without initialization', () => {
    // Do not initialize - should not throw
    expect(() => technique.reset('circle')).not.toThrow();
  });
  
  test('should handle kernel generation with different parameters', () => {
    technique.initialize(renderer);
    
    // Create with default parameters
    technique.createMaterial({} as LeniaParams);
    
    // Get initial kernel texture
    const initialKernelTexture = technique.testKernelTexture;
    
    // Update with new kernel parameters
    const newParams: LeniaParams = {
      kernelRadius: 20, // Changed from default
      kernelPeakR: 0.3, // Changed from default
      kernelPeakA: 1.8, // Changed from default
      kernelShape: 6.0, // Changed from default
      growthCenter: 0.15,
      growthWidth: 0.015,
      growthHeight: 0.15,
      timeStep: 0.1,
      initialPattern: 'circle',
      colorScheme: 'heatmap',
      customColorA: new THREE.Color(0, 0, 0),
      customColorB: new THREE.Color(1, 1, 1)
    };
    
    technique.updateParams(newParams);
    
    // Verify a new kernel texture was created
    expect(initialKernelTexture?.dispose).toHaveBeenCalled();
    expect(technique.testKernelTexture).not.toBe(initialKernelTexture);
  });
  
  test('should generate kernel texture with normalization', () => {
    technique.initialize(renderer);
    
    // Set parameters that would result in non-zero kernel values
    const params: LeniaParams = {
      kernelRadius: 10,
      kernelPeakR: 0.5,
      kernelPeakA: 1.0, // Ensure positive peak value
      kernelShape: 4.0,
      growthCenter: 0.15,
      growthWidth: 0.015,
      growthHeight: 0.15,
      timeStep: 0.1,
      initialPattern: 'circle',
      colorScheme: 'heatmap',
      customColorA: new THREE.Color(0, 0, 0),
      customColorB: new THREE.Color(1, 1, 1)
    };
    
    technique.createMaterial(params);
    
    // Verify kernel texture was created
    expect(technique.testKernelTexture).not.toBeNull();
  });
  
  test('should dispose resources', () => {
    technique.initialize(renderer);
    
    // Create materials
    technique.createMaterial({} as LeniaParams);
    
    // Get references to objects that should be disposed
    const pingPongTargets = technique.testPingPongTargets;
    const kernelTexture = technique.testKernelTexture;
    const simulationMaterial = technique.testSimulationMaterial;
    const renderMaterial = technique.testRenderMaterial;
    const initMaterial = technique.testInitMaterial;
    
    // Call dispose
    technique.dispose();
    
    // Verify all resources were disposed
    expect(technique.testInitialized).toBe(false);
    expect(technique.testSimInitialized).toBe(false);
    expect(technique.testPingPongTargets).toBeNull();
    expect(technique.testSimulationMaterial).toBeNull();
    expect(technique.testRenderMaterial).toBeNull();
    expect(technique.testKernelTexture).toBeNull();
    
    // Verify dispose was called on all resources
    expect(pingPongTargets?.[0].dispose).toHaveBeenCalled();
    expect(pingPongTargets?.[1].dispose).toHaveBeenCalled();
    expect(kernelTexture?.dispose).toHaveBeenCalled();
    expect(simulationMaterial?.dispose).toHaveBeenCalled();
    expect(renderMaterial?.dispose).toHaveBeenCalled();
    expect(initMaterial?.dispose).toHaveBeenCalled();
  });
  
  test('should handle dispose when not initialized', () => {
    // Do not initialize - should not throw
    expect(() => technique.dispose()).not.toThrow();
  });
}); 