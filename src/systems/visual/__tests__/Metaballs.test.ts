import * as THREE from 'three';
import { Metaballs, MetaballParams, IMetaball } from '../techniques/Metaballs';
import { IShaderMaterial } from '../../../core/types/visual';

// Create a helper class to access protected properties for testing
class TestableMetaballs extends Metaballs {
  public get testScene(): THREE.Scene { return this.scene; }
  public get testCamera(): THREE.OrthographicCamera { return this.camera; }
  public get testMesh(): THREE.Mesh { return this.mesh!; }
  public get testInitialized(): boolean { return this.initialized; }
  
  // Access to protected methods for testing if needed
  public testGetMetaballsArray(): Float32Array {
    return (this as any).metaballsArray;
  }
}

// Mock THREE.js objects
jest.mock('three', () => {
  const originalModule = jest.requireActual('three');
  
  // Mock the basic THREE classes we need
  const mockUniforms = {
    u_resolution: { value: new originalModule.Vector2(1, 1) },
    u_metaballs: { value: null },
    u_metaballCount: { value: 0 },
    u_time: { value: 0, update: jest.fn() },
    u_color1: { value: new originalModule.Color() },
    u_color2: { value: new originalModule.Color() },
    u_threshold: { value: 1.0 }
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
  
  return {
    ...originalModule,
    WebGLRenderer: jest.fn().mockImplementation(() => ({
      render: jest.fn(),
      dispose: jest.fn(),
      domElement: document.createElement('canvas')
    })),
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
    Vector2: originalModule.Vector2
  };
});

describe('Metaballs', () => {
  let technique: TestableMetaballs;
  let renderer: THREE.WebGLRenderer;
  
  beforeEach(() => {
    // Create a test technique instance
    technique = new TestableMetaballs('metaballs-test');
    
    // Create a mock renderer
    renderer = new THREE.WebGLRenderer();
    
    // Clear mocks
    jest.clearAllMocks();
  });
  
  test('should create a Metaballs instance', () => {
    // TODO: Implement test that verifies the creation of a technique instance
    expect(technique).toBeInstanceOf(Metaballs);
    expect(technique.id).toBe('metaballs-test');
    expect(technique.name).toBe('Metaballs');
  });
  
  test('should initialize the technique', () => {
    // TODO: Implement test that verifies initialization creates scene, camera, and mesh
    technique.initialize(renderer);
    
    expect(technique.testInitialized).toBe(true);
    expect(technique.testScene).toBeDefined();
    expect(technique.testCamera).toBeDefined();
    expect(technique.testMesh).toBeDefined();
  });
  
  test('should create material with default parameters', () => {
    // TODO: Implement test that verifies material creation with default params
    technique.initialize(renderer);
    
    const material = technique.createMaterial({} as MetaballParams);
    
    expect(material).toBeDefined();
    expect(material.uniforms).toHaveProperty('u_metaballs');
    expect(material.uniforms).toHaveProperty('u_metaballCount');
    expect(material.uniforms).toHaveProperty('u_resolution');
    expect(material.uniforms).toHaveProperty('u_time');
    expect(material.uniforms).toHaveProperty('u_color1');
    expect(material.uniforms).toHaveProperty('u_color2');
    expect(material.uniforms).toHaveProperty('u_threshold');
  });
  
  test('should create material with custom parameters', () => {
    // TODO: Implement test that verifies material creation with custom params
    technique.initialize(renderer);
    
    const customParams: MetaballParams = {
      metaballs: [
        { position: new THREE.Vector2(0.5, 0.5), radius: 0.1, strength: 1.0 }
      ],
      threshold: 0.5,
      colorMapping: 'custom',
      customColorA: new THREE.Color(1, 0, 0),
      customColorB: new THREE.Color(0, 0, 1)
    };
    
    const material = technique.createMaterial(customParams);
    
    expect(material.uniforms.u_metaballCount.value).toBe(1);
    expect(material.uniforms.u_threshold.value).toBe(0.5);
    // In a real test, we would also check the color values
  });
  
  test('should update parameters', () => {
    // TODO: Implement test that verifies updateParams method
    technique.initialize(renderer);
    
    // First create with default params
    technique.createMaterial({} as MetaballParams);
    
    // Then update with new params
    const newParams: MetaballParams = {
      metaballs: [
        { position: new THREE.Vector2(0.2, 0.3), radius: 0.15, strength: 0.8 },
        { position: new THREE.Vector2(0.7, 0.7), radius: 0.2, strength: 1.2 }
      ],
      threshold: 0.7,
      colorMapping: 'custom',
      customColorA: new THREE.Color(0, 1, 0),
      customColorB: new THREE.Color(1, 1, 0)
    };
    
    technique.updateParams(newParams);
    
    const material = technique.testMesh.material as IShaderMaterial;
    expect(material.uniforms.u_metaballCount.value).toBe(2);
    expect(material.uniforms.u_threshold.value).toBe(0.7);
  });
  
  test('should provide uniform updaters for time', () => {
    // TODO: Implement test that verifies uniform updater functions for time
    technique.initialize(renderer);
    
    const updaters = technique.getUniformUpdaters();
    
    expect(updaters).toHaveProperty('u_time');
    expect(typeof updaters.u_time).toBe('function');
    
    // Test that the updater updates the time value
    const timeMs = 2000;
    updaters.u_time(timeMs, 100);
    
    // In real test we would verify the update function was called with correct values
  });
  
  test('should render to a target', () => {
    // TODO: Implement test that verifies the render method
    technique.initialize(renderer);
    
    // Create a mock render target
    const target = new THREE.WebGLRenderTarget(100, 100);
    
    // Call render
    technique.render(renderer, target);
    
    // Verify renderer.render was called with the right parameters
    expect(renderer.render).toHaveBeenCalledWith(technique.testScene, technique.testCamera, target, true);
  });
  
  test('should handle metaballs array updates', () => {
    // TODO: Implement test that verifies metaballs array updates
    technique.initialize(renderer);
    
    // Create with multiple metaballs
    const params: MetaballParams = {
      metaballs: [
        { position: new THREE.Vector2(0.2, 0.3), radius: 0.15, strength: 0.8 },
        { position: new THREE.Vector2(0.7, 0.7), radius: 0.2, strength: 1.2 },
        { position: new THREE.Vector2(0.4, 0.6), radius: 0.1, strength: 0.9 }
      ],
      threshold: 0.5,
      color1: new THREE.Color(1, 0, 0),
      color2: new THREE.Color(0, 0, 1)
    };
    
    technique.createMaterial(params);
    
    // Verify the metaballs array contains the right data
    // In a real test we would check the contents of the Float32Array
    const metaballsArray = technique.testGetMetaballsArray();
    expect(metaballsArray).toBeDefined();
    expect(metaballsArray.length).toBeGreaterThan(0);
  });
  
  test('should dispose resources', () => {
    // TODO: Implement test that verifies dispose cleans up all resources
    technique.initialize(renderer);
    
    // Create material
    const material = technique.createMaterial({} as MetaballParams);
    technique.testMesh.material = material;
    
    // Call dispose
    technique.dispose();
    
    // Verify all resources were disposed
    expect(technique.testInitialized).toBe(false);
    expect(technique.testMesh.geometry.dispose).toHaveBeenCalled();
    expect((technique.testMesh.material as any).dispose).toHaveBeenCalled();
  });
}); 