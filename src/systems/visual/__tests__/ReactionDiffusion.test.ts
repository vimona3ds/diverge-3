import * as THREE from 'three';
import { ReactionDiffusion, ReactionDiffusionParams } from '../techniques/ReactionDiffusion';
import { IShaderMaterial } from '../../../core/types/visual';

// Create a helper class to access protected properties for testing
class TestableReactionDiffusion extends ReactionDiffusion {
  public get testScene(): THREE.Scene { return this.scene; }
  public get testCamera(): THREE.OrthographicCamera { return this.camera; }
  public get testMesh(): THREE.Mesh { return this.mesh!; }
  public get testInitialized(): boolean { return this.initialized; }
  public get testPingPongTargets(): [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null { 
    return (this as any).pingPongTargets; 
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
}

// Mock THREE.js objects
jest.mock('three', () => {
  const originalModule = jest.requireActual('three');
  
  // Mock the basic THREE classes we need
  const mockUniforms = {
    u_resolution: { value: new originalModule.Vector2(1, 1) },
    u_feed: { value: 0.055 },
    u_kill: { value: 0.062 },
    u_diffuseA: { value: 1.0 },
    u_diffuseB: { value: 0.5 },
    u_timestep: { value: 1.0 },
    u_colorA: { value: new originalModule.Color() },
    u_colorB: { value: new originalModule.Color() },
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
      needsUpdate: false
    }))
  };
});

describe('ReactionDiffusion', () => {
  let technique: TestableReactionDiffusion;
  let renderer: THREE.WebGLRenderer;
  
  beforeEach(() => {
    // Create a test technique instance
    technique = new TestableReactionDiffusion('reaction-diffusion-test');
    
    // Create a mock renderer
    renderer = new THREE.WebGLRenderer();
    
    // Clear mocks
    jest.clearAllMocks();
  });
  
  test('should create a ReactionDiffusion instance', () => {
    expect(technique).toBeInstanceOf(ReactionDiffusion);
    expect(technique.id).toBe('reaction-diffusion-test');
    expect(technique.name).toBe('Reaction-Diffusion');
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
  
  test('should create material with default parameters', () => {
    technique.initialize(renderer);
    
    const material = technique.createMaterial({} as ReactionDiffusionParams);
    
    expect(material).toBeDefined();
    expect(material.uniforms).toHaveProperty('u_feed');
    expect(material.uniforms).toHaveProperty('u_kill');
    expect(material.uniforms).toHaveProperty('u_diffuseA');
    expect(material.uniforms).toHaveProperty('u_diffuseB');
    expect(material.uniforms).toHaveProperty('u_timestep');
    expect(material.uniforms).toHaveProperty('u_colorA');
    expect(material.uniforms).toHaveProperty('u_colorB');
  });
  
  test('should create material with custom parameters', () => {
    technique.initialize(renderer);
    
    const customParams: ReactionDiffusionParams = {
      feed: 0.045,
      kill: 0.065,
      diffuseA: 0.8,
      diffuseB: 0.3,
      timestep: 1.5,
      colorA: new THREE.Color(1, 0, 0),
      colorB: new THREE.Color(0, 0, 1),
      initialPattern: 'center'
    };
    
    const material = technique.createMaterial(customParams);
    
    expect(material.uniforms.u_feed.value).toBe(0.045);
    expect(material.uniforms.u_kill.value).toBe(0.065);
    expect(material.uniforms.u_diffuseA.value).toBe(0.8);
    expect(material.uniforms.u_diffuseB.value).toBe(0.3);
    expect(material.uniforms.u_timestep.value).toBe(1.5);
  });
  
  test('should update parameters', () => {
    technique.initialize(renderer);
    
    // First create with default params
    technique.createMaterial({} as ReactionDiffusionParams);
    
    // Then update with new params
    const newParams: ReactionDiffusionParams = {
      feed: 0.035,
      kill: 0.075,
      diffuseA: 0.9,
      diffuseB: 0.4,
      timestep: 2.0,
      colorA: new THREE.Color(0, 1, 0),
      colorB: new THREE.Color(1, 1, 0),
      initialPattern: 'spots'
    };
    
    technique.updateParams(newParams);
    
    const simMaterial = technique.testSimulationMaterial as IShaderMaterial;
    expect(simMaterial.uniforms.u_feed.value).toBe(0.035);
    expect(simMaterial.uniforms.u_kill.value).toBe(0.075);
    expect(simMaterial.uniforms.u_diffuseA.value).toBe(0.9);
    expect(simMaterial.uniforms.u_diffuseB.value).toBe(0.4);
    expect(simMaterial.uniforms.u_timestep.value).toBe(2.0);
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
    technique.render(renderer, target, 5);
    
    // In a real test, verify the simulation was run and the final image was rendered
    expect(renderer.setRenderTarget).toHaveBeenCalledTimes(11); // 5 steps * 2 + final render
    expect(renderer.render).toHaveBeenCalledTimes(11);
  });
  
  test('should reset the simulation', () => {
    technique.initialize(renderer);
    
    // Setup simulation
    technique.createMaterial({
      initialPattern: 'random'
    } as ReactionDiffusionParams);
    
    // Reset with a different pattern
    technique.reset('center');
    
    // Verify iterations counter was reset
    expect(technique.testIterations).toBe(0);
  });
  
  test('should dispose resources', () => {
    technique.initialize(renderer);
    
    // Create materials
    technique.createMaterial({} as ReactionDiffusionParams);
    
    // Call dispose
    technique.dispose();
    
    // Verify all resources were disposed
    expect(technique.testInitialized).toBe(false);
    expect(technique.testSimInitialized).toBe(false);
    expect(technique.testPingPongTargets).toBeNull();
    expect(technique.testSimulationMaterial).toBeNull();
    expect(technique.testRenderMaterial).toBeNull();
  });
}); 