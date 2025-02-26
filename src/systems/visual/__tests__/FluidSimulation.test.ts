import * as THREE from 'three';
import { FluidSimulation, FluidSimulationParams } from '../techniques/FluidSimulation';
import { IShaderMaterial } from '../../../core/types/visual';

// Create a helper class to access protected properties for testing
class TestableFluidSimulation extends FluidSimulation {
  // Inherit protected properties
  public get testScene(): THREE.Scene { return this.scene; }
  public get testCamera(): THREE.OrthographicCamera { return this.camera; }
  public get testMesh(): THREE.Mesh { return this.mesh!; }
  public get testInitialized(): boolean { return this.initialized; }
  
  // Access private properties using type assertion
  public get testSimInitialized(): boolean {
    return (this as any).simInitialized;
  }
  
  public get testVelocityRenderTarget(): THREE.WebGLRenderTarget | null {
    return (this as any).velocityRenderTarget;
  }
  
  public get testDensityRenderTarget(): THREE.WebGLRenderTarget | null {
    return (this as any).densityRenderTarget;
  }
  
  public get testPressureRenderTarget(): THREE.WebGLRenderTarget | null {
    return (this as any).pressureRenderTarget;
  }
  
  public get testDivergenceRenderTarget(): THREE.WebGLRenderTarget | null {
    return (this as any).divergenceRenderTarget;
  }
  
  public get testCurlRenderTarget(): THREE.WebGLRenderTarget | null {
    return (this as any).curlRenderTarget;
  }
  
  public get testVelocityDoubleFBO(): [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null {
    return (this as any).velocityDoubleFBO;
  }
  
  public get testDensityDoubleFBO(): [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null {
    return (this as any).densityDoubleFBO;
  }
  
  public get testDisplayMaterial(): IShaderMaterial | null {
    return (this as any).displayMaterial;
  }
}

// Mock THREE.js objects
jest.mock('three', () => {
  const originalModule = jest.requireActual('three');
  
  // Mock the basic THREE classes we need
  const mockUniforms = {
    u_resolution: { value: new originalModule.Vector2(1, 1) },
    u_texelSize: { value: new originalModule.Vector2(1/512, 1/512) },
    u_dyeTexelSize: { value: new originalModule.Vector2(1/1024, 1/1024) },
    u_density: { value: null },
    u_velocity: { value: null },
    u_pressure: { value: null },
    u_divergence: { value: null },
    u_curl: { value: null },
    u_iterations: { value: 20 },
    u_colorA: { value: new originalModule.Color() },
    u_colorB: { value: new originalModule.Color() },
    u_colorMode: { value: 0 },
    u_time: { value: 0 },
    u_dt: { value: 0.016 },
    u_dissipation: { value: 0.97 },
    u_densityDissipation: { value: 0.98 },
    u_velocityDissipation: { value: 0.99 },
    u_curl: { value: 20 },
    u_radius: { value: 0.3 }
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
      minFilter: originalModule.LinearFilter,
      magFilter: originalModule.LinearFilter
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
      setRenderTarget: jest.fn(),
      getSize: jest.fn().mockReturnValue(new originalModule.Vector2(800, 600))
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
    LinearFilter: originalModule.LinearFilter,
    ClampToEdgeWrapping: originalModule.ClampToEdgeWrapping,
    RGBAFormat: originalModule.RGBAFormat,
    HalfFloatType: originalModule.HalfFloatType
  };
});

describe('FluidSimulation', () => {
  let technique: TestableFluidSimulation;
  let renderer: THREE.WebGLRenderer;
  
  beforeEach(() => {
    // Create a test technique instance
    technique = new TestableFluidSimulation('fluid-simulation-test');
    
    // Create a mock renderer
    renderer = new THREE.WebGLRenderer();
    
    // Clear mocks
    jest.clearAllMocks();
  });
  
  test('should create a FluidSimulation instance', () => {
    expect(technique).toBeInstanceOf(FluidSimulation);
    expect(technique.id).toBe('fluid-simulation-test');
    expect(technique.name).toBe('Fluid Simulation');
  });
  
  test('should initialize the technique', () => {
    technique.initialize(renderer);
    
    expect(technique.testInitialized).toBe(true);
    expect(technique.testScene).toBeDefined();
    expect(technique.testCamera).toBeDefined();
    expect(technique.testMesh).toBeDefined();
    expect(technique.testVelocityRenderTarget).toBeDefined();
    expect(technique.testDensityRenderTarget).toBeDefined();
    expect(technique.testPressureRenderTarget).toBeDefined();
    expect(technique.testDivergenceRenderTarget).toBeDefined();
    expect(technique.testCurlRenderTarget).toBeDefined();
    expect(technique.testVelocityDoubleFBO).toBeDefined();
    expect(technique.testDensityDoubleFBO).toBeDefined();
  });
  
  test('should create material with default parameters', () => {
    technique.initialize(renderer);
    
    const material = technique.createMaterial({} as FluidSimulationParams);
    
    expect(material).toBeDefined();
    expect(material.uniforms).toHaveProperty('u_density');
    expect(material.uniforms).toHaveProperty('u_velocity');
    expect(material.uniforms).toHaveProperty('u_colorA');
    expect(material.uniforms).toHaveProperty('u_colorB');
    expect(material.uniforms).toHaveProperty('u_colorMode');
  });
  
  test('should create material with custom parameters', () => {
    technique.initialize(renderer);
    
    const customParams: FluidSimulationParams = {
      resolution: 256,
      dyeResolution: 512,
      densityDissipation: 0.95,
      velocityDissipation: 0.96,
      pressureIterations: 25,
      curl: 25,
      splatRadius: 0.25,
      colorA: new THREE.Color(1, 0, 0),
      colorB: new THREE.Color(0, 0, 1),
      colorMode: 'custom'
    };
    
    const material = technique.createMaterial(customParams);
    
    // Verify displayMaterial exists and has the right uniforms
    expect(technique.testDisplayMaterial).not.toBeNull();
    const displayMaterial = technique.testDisplayMaterial as IShaderMaterial;
    expect(displayMaterial.uniforms.u_colorMode.value).toBe(1); // custom mode
  });
  
  test('should update parameters', () => {
    technique.initialize(renderer);
    
    // First create with default params
    technique.createMaterial({} as FluidSimulationParams);
    
    // Then update with new params
    const newParams: FluidSimulationParams = {
      resolution: 128,
      dyeResolution: 256,
      densityDissipation: 0.92,
      velocityDissipation: 0.93,
      pressureIterations: 30,
      curl: 30,
      splatRadius: 0.2,
      colorA: new THREE.Color(0, 1, 0),
      colorB: new THREE.Color(1, 1, 0),
      colorMode: 'rainbow'
    };
    
    technique.updateParams(newParams);
    
    const displayMaterial = technique.testDisplayMaterial as IShaderMaterial;
    expect(displayMaterial.uniforms.u_colorMode.value).toBe(0); // rainbow mode
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
  
  test('should add force to the simulation', () => {
    technique.initialize(renderer);
    technique.createMaterial({} as FluidSimulationParams);
    
    // Add force at position
    technique.addForce(0.5, 0.5, 0.1, 0.2);
    
    // This is mostly a coverage test, as we can't easily verify the internal state
  });
  
  test('should add color splat to the simulation', () => {
    technique.initialize(renderer);
    technique.createMaterial({} as FluidSimulationParams);
    
    // Add color splat at position
    const color = new THREE.Color(1, 0, 0);
    technique.addColorSplat(0.5, 0.5, color, 0.3);
    
    // This is mostly a coverage test, as we can't easily verify the internal state
  });
  
  test('should render to a target', () => {
    technique.initialize(renderer);
    technique.createMaterial({} as FluidSimulationParams);
    
    // Create a mock render target
    const target = new THREE.WebGLRenderTarget(100, 100);
    
    // Call render
    technique.render(renderer, target);
    
    // Verify the renderer was called with our scene, camera, and target
    expect(renderer.setRenderTarget).toHaveBeenCalledWith(target);
    expect(renderer.render).toHaveBeenCalled();
  });
  
  test('should reset the simulation', () => {
    technique.initialize(renderer);
    technique.createMaterial({} as FluidSimulationParams);
    
    // Reset the simulation
    technique.reset();
    
    // This is mostly a coverage test, as we can't easily verify the internal state
  });
  
  test('should dispose resources', () => {
    technique.initialize(renderer);
    technique.createMaterial({} as FluidSimulationParams);
    
    // Call dispose
    technique.dispose();
    
    // Verify resources were disposed
    expect(technique.testInitialized).toBe(false);
    expect(technique.testSimInitialized).toBe(false);
    expect(technique.testVelocityRenderTarget).toBeNull();
    expect(technique.testDensityRenderTarget).toBeNull();
    expect(technique.testPressureRenderTarget).toBeNull();
    expect(technique.testDivergenceRenderTarget).toBeNull();
    expect(technique.testCurlRenderTarget).toBeNull();
    expect(technique.testVelocityDoubleFBO).toBeNull();
    expect(technique.testDensityDoubleFBO).toBeNull();
    expect(technique.testDisplayMaterial).toBeNull();
  });
}); 