import * as THREE from 'three';
import { Lenia, LeniaParams } from '../techniques/Lenia';
import { IShaderMaterial } from '../../../core/types/visual';

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
  public get testSimInitialized(): boolean {
    return (this as any).simInitialized;
  }
  public get testIterations(): number {
    return (this as any).iterations;
  }
  
  // Expose private method for testing
  public testGenerateKernelTexture(): void {
    return (this as any).generateKernelTexture();
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
    u_time: { value: 0 }
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
    
    expect(material.uniforms.u_growthCenter.value).toBe(0.15);
    expect(material.uniforms.u_growthWidth.value).toBe(0.10);
    expect(material.uniforms.u_growthHeight.value).toBe(0.18);
    expect(material.uniforms.u_timeStep.value).toBe(0.12);
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
  
  test('should provide uniform updaters for time', () => {
    technique.initialize(renderer);
    
    const updaters = technique.getUniformUpdaters();
    
    expect(updaters).toHaveProperty('u_time');
    expect(typeof updaters.u_time).toBe('function');
    
    // Test that the updater updates the time value
    const timeMs = 2000;
    updaters.u_time(timeMs, 100);
  });
  
  test('should render to a target with multiple simulation steps', () => {
    technique.initialize(renderer);
    
    // Create a mock render target
    const target = new THREE.WebGLRenderTarget(100, 100);
    
    // Call render with multiple simulation steps
    technique.render(renderer, target, 3);
    
    // In a real test, verify the simulation was run and the final image was rendered
    expect(renderer.setRenderTarget).toHaveBeenCalledTimes(7); // 3 steps * 2 + final render
    expect(renderer.render).toHaveBeenCalledTimes(7);
  });
  
  test('should reset the simulation', () => {
    technique.initialize(renderer);
    
    // Setup simulation
    technique.createMaterial({
      initialPattern: 'random'
    } as LeniaParams);
    
    // Reset with a different pattern
    technique.reset('circle');
    
    // Verify iterations counter was reset
    expect(technique.testIterations).toBe(0);
  });
  
  test('should dispose resources', () => {
    technique.initialize(renderer);
    
    // Create materials
    technique.createMaterial({} as LeniaParams);
    
    // Call dispose
    technique.dispose();
    
    // Verify all resources were disposed
    expect(technique.testInitialized).toBe(false);
    expect(technique.testSimInitialized).toBe(false);
    expect(technique.testPingPongTargets).toBeNull();
    expect(technique.testSimulationMaterial).toBeNull();
    expect(technique.testRenderMaterial).toBeNull();
    expect(technique.testKernelTexture).toBeNull();
  });
}); 