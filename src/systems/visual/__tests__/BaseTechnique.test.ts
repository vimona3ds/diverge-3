import * as THREE from 'three';
import { BaseTechnique } from '../techniques/BaseTechnique';
import { IShaderMaterial } from '../../../core/types/visual';

// Create a concrete implementation of BaseTechnique for testing
class TestTechnique extends BaseTechnique {
  // Add getters to expose protected properties for testing
  public get testScene(): THREE.Scene { return this.scene; }
  public get testCamera(): THREE.OrthographicCamera { return this.camera; }
  public get testMesh(): THREE.Mesh { return this.mesh!; }
  public get testInitialized(): boolean { return this.initialized; }

  public createMaterial(params: any): IShaderMaterial {
    // Simple implementation that returns a basic shader material
    const material = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0.0 }
      },
      vertexShader: `
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        void main() {
          gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
        }
      `
    }) as IShaderMaterial;
    
    return material;
  }
  
  public getUniformUpdaters(): Record<string, (time: number, deltaTime: number) => void> {
    return {
      u_time: (time: number) => time / 1000.0
    };
  }
}

// Mock THREE.js objects
jest.mock('three', () => {
  const originalModule = jest.requireActual('three');
  
  // Mock the basic THREE classes we need
  const mockMaterial = {
    dispose: jest.fn(),
    uniforms: {
      u_time: { value: 0.0 }
    }
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
      dispose: jest.fn()
    })),
    ShaderMaterial: jest.fn().mockImplementation(() => mockMaterial),
    PlaneGeometry: jest.fn().mockImplementation(() => mockMesh.geometry),
    Mesh: jest.fn().mockImplementation(() => mockMesh),
    Scene: jest.fn().mockImplementation(() => ({
      add: jest.fn(),
      remove: jest.fn()
    })),
    OrthographicCamera: jest.fn().mockImplementation(() => ({}))
  };
});

describe('BaseTechnique', () => {
  let technique: TestTechnique;
  let renderer: THREE.WebGLRenderer;
  
  beforeEach(() => {
    // Create a test technique instance
    technique = new TestTechnique('test-id', 'Test Technique');
    
    // Create a mock renderer
    renderer = new THREE.WebGLRenderer();
    
    // Clear mocks
    jest.clearAllMocks();
  });
  
  test('should create a BaseTechnique instance', () => {
    // TODO: Implement test that verifies the creation of a technique instance
    expect(technique).toBeInstanceOf(BaseTechnique);
    expect(technique.id).toBe('test-id');
    expect(technique.name).toBe('Test Technique');
  });
  
  test('should initialize the technique', () => {
    // TODO: Implement test that verifies initialization creates scene, camera, and mesh
    technique.initialize(renderer);
    
    expect(technique.testInitialized).toBe(true);
    expect(technique.testScene).toBeDefined();
    expect(technique.testCamera).toBeDefined();
    expect(technique.testMesh).toBeDefined();
  });
  
  test('should create and assign material', () => {
    // TODO: Implement test that verifies material creation and assignment
    technique.initialize(renderer);
    
    const params = { testParam: 42 };
    const material = technique.createMaterial(params);
    
    expect(material).toBeDefined();
    expect(material.uniforms).toHaveProperty('u_time');
  });
  
  test('should provide uniform updaters', () => {
    // TODO: Implement test that verifies uniform updater functions
    const updaters = technique.getUniformUpdaters();
    
    expect(updaters).toHaveProperty('u_time');
    expect(typeof updaters.u_time).toBe('function');
    
    // Test that the updater works correctly
    const timeMs = 2000;
    const result = updaters.u_time(timeMs, 0);
    expect(result).toBe(timeMs / 1000.0);
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
  
  test('should dispose resources', () => {
    // TODO: Implement test that verifies dispose cleans up all resources
    technique.initialize(renderer);
    
    // Create material
    const material = technique.createMaterial({});
    technique.testMesh.material = material;
    
    // Call dispose
    technique.dispose();
    
    // Verify all resources were disposed
    expect(technique.testInitialized).toBe(false);
    expect(technique.testMesh.geometry.dispose).toHaveBeenCalled();
    expect((technique.testMesh.material as any).dispose).toHaveBeenCalled();
  });
  
  test('should update parameters', () => {
    // TODO: Implement test that verifies updateParams method
    // This is a stub since the base class has an empty implementation
    // Concrete subclasses will implement this differently
    expect(() => {
      technique.updateParams({});
    }).not.toThrow();
  });
}); 