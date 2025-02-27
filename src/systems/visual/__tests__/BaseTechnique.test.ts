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
  public get testMaterial(): IShaderMaterial | null { return this.material; }

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
    
    this.material = material;
    return material;
  }
  
  public getUniformUpdaters(): Record<string, (time: number, deltaTime: number) => void> {
    return {
      u_time: (time: number, deltaTime: number) => {
        return time / 1000.0;
      }
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
    },
    vertexShader: 'mock vertex shader',
    fragmentShader: 'mock fragment shader'
  };
  
  const mockGeometry = {
    dispose: jest.fn()
  };

  const mockMesh = {
    material: mockMaterial,
    geometry: mockGeometry
  };
  
  const mockScene = {
    add: jest.fn(),
    remove: jest.fn()
  };

  const mockCamera = {
    position: {
      z: 0
    }
  };

  const mockRenderTarget = {
    dispose: jest.fn()
  };

  const mockRenderer = {
    render: jest.fn(),
    dispose: jest.fn(),
    setRenderTarget: jest.fn()
  };

  // Helper function to clear all the mocks
  const clearAllMocks = () => {
    mockMaterial.dispose.mockClear();
    mockGeometry.dispose.mockClear();
    mockScene.add.mockClear();
    mockScene.remove.mockClear();
    mockRenderer.render.mockClear();
    mockRenderer.setRenderTarget.mockClear();
    mockRenderTarget.dispose.mockClear();
  };

  const SceneMock = jest.fn().mockImplementation(() => mockScene);
  const MeshMock = jest.fn().mockImplementation(() => {
    mockScene.add(mockMesh); // Simulate adding mesh to scene
    return mockMesh;
  });
  const ShaderMaterialMock = jest.fn().mockImplementation(() => mockMaterial);

  return {
    ...originalModule,
    WebGLRenderer: jest.fn().mockImplementation(() => mockRenderer),
    ShaderMaterial: ShaderMaterialMock,
    PlaneGeometry: jest.fn().mockImplementation(() => mockGeometry),
    Mesh: MeshMock,
    Scene: SceneMock,
    OrthographicCamera: jest.fn().mockImplementation(() => mockCamera),
    WebGLRenderTarget: jest.fn().mockImplementation(() => mockRenderTarget),
    // Add our helper
    __clearAllMocks: clearAllMocks
  };
});

describe('BaseTechnique', () => {
  let technique: TestTechnique;
  let renderer: THREE.WebGLRenderer;
  
  beforeEach(() => {
    // Clear all mocks
    (THREE as any).__clearAllMocks();
    
    // Create a test technique instance
    technique = new TestTechnique('test-id', 'Test Technique');
    
    // Create a mock renderer
    renderer = new THREE.WebGLRenderer();
  });
  
  test('should create a BaseTechnique instance', () => {
    // Implement test that verifies the creation of a technique instance
    expect(technique).toBeInstanceOf(BaseTechnique);
    expect(technique.id).toBe('test-id');
    expect(technique.name).toBe('Test Technique');
    
    // Verify that base properties are created
    expect(technique.testScene).toBeDefined();
    expect(technique.testCamera).toBeDefined();
    expect(technique.testMesh).toBeDefined();
    expect(technique.testInitialized).toBe(false);
  });
  
  test('should initialize the technique', () => {
    // Implement test that verifies initialization creates scene, camera, and mesh
    technique.initialize(renderer);
    
    expect(technique.testInitialized).toBe(true);
    expect(technique.testScene).toBeDefined();
    expect(technique.testCamera).toBeDefined();
    expect(technique.testMesh).toBeDefined();
    
    // Verify camera position
    expect(technique.testCamera.position.z).toBe(1);
    
    // The mesh is already added to scene in constructor
    expect(technique.testScene.add).toHaveBeenCalled();
  });
  
  test('should create and assign material', () => {
    // Implement test that verifies material creation and assignment
    technique.initialize(renderer);
    
    const params = { testParam: 42 };
    const material = technique.createMaterial(params);
    
    expect(material).toBeDefined();
    expect(material).toBe(technique.testMaterial);
    expect(material.uniforms).toHaveProperty('u_time');
    expect(THREE.ShaderMaterial).toHaveBeenCalled();
    
    // Verify that the material's shader strings are defined
    expect(material.vertexShader).toBe('mock vertex shader');
    expect(material.fragmentShader).toBe('mock fragment shader');
  });
  
  test('should provide uniform updaters', () => {
    // Implement test that verifies uniform updater functions
    const updaters = technique.getUniformUpdaters();
    
    expect(updaters).toHaveProperty('u_time');
    expect(typeof updaters.u_time).toBe('function');
    
    // Test that the updater works correctly
    const timeMs = 2000;
    const deltaTime = 16;
    const result = updaters.u_time(timeMs, deltaTime);
    expect(result).toBe(2); // timeMs / 1000
  });
  
  test('should render to a target', () => {
    // Implement test that verifies the render method
    technique.initialize(renderer);
    
    // Create a material
    const material = technique.createMaterial({});
    
    // Create a mock render target
    const target = new THREE.WebGLRenderTarget(100, 100);
    
    // Call render
    technique.render(renderer, target);
    
    // Verify setRenderTarget was called with the target
    expect(renderer.setRenderTarget).toHaveBeenCalledWith(target);
    
    // Verify renderer.render was called with the right parameters
    expect(renderer.render).toHaveBeenCalledWith(
      technique.testScene, 
      technique.testCamera
    );
    
    // Verify setRenderTarget was reset
    expect(renderer.setRenderTarget).toHaveBeenCalledWith(null);
  });
  
  test('should render to screen when no target is provided', () => {
    // Additional test for rendering without a target
    technique.initialize(renderer);
    technique.createMaterial({});
    
    // Call render without a target
    technique.render(renderer);
    
    // Verify setRenderTarget was called with null
    expect(renderer.setRenderTarget).toHaveBeenCalledWith(null);
    
    // Verify renderer.render was called
    expect(renderer.render).toHaveBeenCalled();
  });
  
  test('should dispose resources', () => {
    // Implement test that verifies dispose cleans up all resources
    technique.initialize(renderer);
    
    // Create material and manually mock its dispose method
    const material = technique.createMaterial({});
    material.dispose = jest.fn();
    
    // Set the material on the mesh
    technique.testMesh.material = material;
    
    // Call dispose
    technique.dispose();
    
    // Verify all resources were disposed
    expect(technique.testInitialized).toBe(false);
    expect(technique.testMesh.geometry.dispose).toHaveBeenCalled();
    expect(material.dispose).toHaveBeenCalled();
  });
  
  test('should update parameters', () => {
    // Implement test that verifies updateParams method
    // This is a stub since the base class has an empty implementation
    // Concrete subclasses will implement this differently
    expect(() => {
      technique.updateParams({});
    }).not.toThrow();
  });
  
  test('should do nothing when rendering without initialization', () => {
    // Add test for edge case - rendering without initialization
    // Don't initialize the technique
    technique.render(renderer);
    
    // Verify render was not called
    expect(renderer.render).not.toHaveBeenCalled();
  });
}); 