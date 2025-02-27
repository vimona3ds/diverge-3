import * as THREE from 'three';
import { FeedbackLoop, FeedbackLoopParams } from '../techniques/FeedbackLoop';
import { IShaderMaterial } from '../../../core/types/visual';
import './__mocks__/three'; // Import shared THREE mock

// Create a helper class to access protected properties for testing
class TestableFeedbackLoop extends FeedbackLoop {
  // Access protected properties from BaseTechnique
  public get testScene(): THREE.Scene { return this.scene; }
  public get testCamera(): THREE.OrthographicCamera { return this.camera; }
  public get testMesh(): THREE.Mesh { return this.mesh!; }
  public get testInitialized(): boolean { return this.initialized; }
  
  // Access private properties using type assertion
  public get testFeedbackPingPong(): [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null {
    return (this as any).feedbackPingPong;
  }
  
  public get testCurrentTarget(): number {
    return (this as any).currentTarget;
  }
  
  public get testFeedbackMaterial(): IShaderMaterial | null {
    return (this as any).feedbackMaterial;
  }
  
  public get testParams(): FeedbackLoopParams {
    return (this as any).params;
  }
  
  public get testWebGLRenderer(): THREE.WebGLRenderer | null {
    return (this as any).webGLRenderer;
  }
  
  // Access private methods for testing
  public testGetBlendModeValue(): number {
    return (this as any).getBlendModeValue();
  }
}

// Mock THREE.js objects
jest.mock('three', () => {
  const originalModule = jest.requireActual('three');
  
  // Mock the basic THREE classes we need
  const mockUniforms = {
    u_feedbackTexture: { value: null },
    u_currentTexture: { value: null },
    u_feedbackStrength: { value: 0.9 },
    u_fadeRate: { value: 0.05 },
    u_translation: { value: new originalModule.Vector2(0, 0) },
    u_scale: { value: 1.0 },
    u_rotation: { value: 0.0 },
    u_blendMode: { value: 2 },
    u_time: { value: 0.0 },
    u_colorShift: { value: false },
    u_colorShiftRate: { value: 0.01 }
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
  
  const mockTexture = {
    dispose: jest.fn()
  };
  
  const mockRenderTarget = {
    texture: mockTexture,
    dispose: jest.fn(),
    setSize: jest.fn()
  };
  
  return {
    ...originalModule,
    WebGLRenderer: jest.fn().mockImplementation(() => ({
      render: jest.fn(),
      clear: jest.fn(),
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
    Texture: jest.fn().mockImplementation(() => mockTexture),
    Vector2: originalModule.Vector2,
    LinearFilter: originalModule.LinearFilter,
    RGBAFormat: originalModule.RGBAFormat
  };
});

describe('FeedbackLoop', () => {
  let technique: TestableFeedbackLoop;
  let renderer: THREE.WebGLRenderer;
  
  beforeEach(() => {
    // Create a test technique instance
    technique = new TestableFeedbackLoop('feedback-loop-test');
    
    // Create a mock renderer
    renderer = new THREE.WebGLRenderer();
    
    // Clear mocks
    jest.clearAllMocks();
  });
  
  test('should create a FeedbackLoop instance', () => {
    expect(technique).toBeInstanceOf(FeedbackLoop);
    expect(technique.id).toBe('feedback-loop-test');
    expect(technique.name).toBe('FeedbackLoop');
  });
  
  test('should initialize the technique', () => {
    technique.initialize(renderer);
    
    expect(technique.testInitialized).toBe(true);
    expect(technique.testScene).toBeDefined();
    expect(technique.testCamera).toBeDefined();
    expect(technique.testMesh).toBeDefined();
    expect(technique.testFeedbackPingPong).toBeDefined();
    expect(technique.testFeedbackPingPong!.length).toBe(2);
    expect(technique.testCurrentTarget).toBe(0);
    expect(technique.testWebGLRenderer).toBeDefined();
  });
  
  test('should create material with default parameters', () => {
    technique.initialize(renderer);
    
    const mockTexture = new THREE.Texture();
    const material = technique.createMaterial({ feedbackTexture: mockTexture } as FeedbackLoopParams);
    
    expect(material).toBeDefined();
    expect(material.uniforms).toHaveProperty('u_feedbackTexture');
    expect(material.uniforms).toHaveProperty('u_currentTexture');
    expect(material.uniforms).toHaveProperty('u_feedbackStrength');
    expect(material.uniforms).toHaveProperty('u_translation');
    expect(material.uniforms).toHaveProperty('u_scale');
    expect(material.uniforms).toHaveProperty('u_rotation');
    expect(material.uniforms).toHaveProperty('u_blendMode');
    expect(material.uniforms).toHaveProperty('u_time');
    expect(material.uniforms).toHaveProperty('u_colorShift');
    expect(material.uniforms).toHaveProperty('u_colorShiftRate');
    
    // Verify default parameter values
    expect(material.uniforms.u_feedbackStrength.value).toBe(0.9);
    expect(material.uniforms.u_scale.value).toBe(1.0);
    expect(material.uniforms.u_blendMode.value).toBe(2); // screen mode
  });
  
  test('should create material with custom parameters', () => {
    technique.initialize(renderer);
    
    const customParams: FeedbackLoopParams = {
      feedbackTexture: new THREE.Texture(),
      feedbackStrength: 0.7,
      translateX: 0.1,
      translateY: -0.2,
      scale: 0.95,
      rotation: Math.PI / 4,
      blend: 'add',
      fadeRate: 0.1,
      colorShift: true,
      colorShiftRate: 0.02
    };
    
    const material = technique.createMaterial(customParams);
    
    // Verify custom parameter values
    expect(material.uniforms.u_feedbackStrength.value).toBe(0.7);
    expect(material.uniforms.u_fadeRate.value).toBe(0.1);
    expect(material.uniforms.u_translation.value.x).toBe(0.1);
    expect(material.uniforms.u_translation.value.y).toBe(-0.2);
    expect(material.uniforms.u_scale.value).toBe(0.95);
    expect(material.uniforms.u_rotation.value).toBe(Math.PI / 4);
    expect(material.uniforms.u_blendMode.value).toBe(0); // add mode
    expect(material.uniforms.u_colorShift.value).toBe(true);
    expect(material.uniforms.u_colorShiftRate.value).toBe(0.02);
  });
  
  test('should update parameters', () => {
    technique.initialize(renderer);
    
    // First create with default params
    const mockTexture = new THREE.Texture();
    technique.createMaterial({ feedbackTexture: mockTexture } as FeedbackLoopParams);
    
    // Then update with new params
    const newParams: Partial<FeedbackLoopParams> = {
      feedbackStrength: 0.5,
      translateX: 0.05,
      rotation: Math.PI / 2,
      blend: 'multiply',
      colorShift: true
    };
    
    technique.updateParams(newParams);
    
    const material = technique.testFeedbackMaterial as IShaderMaterial;
    expect(material.uniforms.u_feedbackStrength.value).toBe(0.5);
    expect(material.uniforms.u_translation.value.x).toBe(0.05);
    expect(material.uniforms.u_rotation.value).toBe(Math.PI / 2);
    expect(material.uniforms.u_blendMode.value).toBe(1); // multiply mode
    expect(material.uniforms.u_colorShift.value).toBe(true);
  });
  
  test('should provide uniform updaters for time', () => {
    technique.initialize(renderer);
    technique.createMaterial({ feedbackTexture: new THREE.Texture() } as FeedbackLoopParams);
    
    const updaters = technique.getUniformUpdaters();
    
    expect(updaters).toHaveProperty('u_time');
    expect(typeof updaters.u_time).toBe('function');
    
    // Test that the updater updates the time value
    const timeMs = 2000;
    updaters.u_time(timeMs, 0);
    expect(technique.testFeedbackMaterial?.uniforms.u_time.value).toBe(2);
  });
  
  test('should render to ping-pong buffers', () => {
    technique.initialize(renderer);
    technique.createMaterial({ feedbackTexture: new THREE.Texture() } as FeedbackLoopParams);
    
    // First render
    technique.render(renderer);
    expect(technique.testCurrentTarget).toBe(1); // Should have swapped to buffer 1
    
    // Second render
    technique.render(renderer);
    expect(technique.testCurrentTarget).toBe(0); // Should have swapped back to buffer 0
  });
  
  test('should resize the feedback buffers', () => {
    technique.initialize(renderer);
    
    const newWidth = 1024;
    const newHeight = 768;
    
    technique.resize(newWidth, newHeight);
    
    // Verify that setSize was called on both render targets
    const pingPong = technique.testFeedbackPingPong!;
    expect(pingPong[0].setSize).toHaveBeenCalledWith(newWidth, newHeight);
    expect(pingPong[1].setSize).toHaveBeenCalledWith(newWidth, newHeight);
  });
  
  test('should reset the feedback buffers', () => {
    technique.initialize(renderer);
    
    technique.reset();
    
    // Verify that clear was called for both render targets
    expect(renderer.setRenderTarget).toHaveBeenCalledTimes(3); // Two for reset plus one in initialize
    expect(renderer.clear).toHaveBeenCalledTimes(2);
  });
  
  test('should properly dispose resources', () => {
    technique.initialize(renderer);
    
    technique.dispose();
    
    // Verify that dispose was called for render targets
    const pingPong = technique.testFeedbackPingPong;
    expect(pingPong).toBeNull(); // Should be set to null after disposal
    
    // Verify mesh disposal (from BaseTechnique)
    expect(technique.testMesh.geometry.dispose).toHaveBeenCalled();
  });
  
  test('should compute correct blend mode values', () => {
    // Create instances with different blend modes to test conversion
    const technique1 = new TestableFeedbackLoop('test1');
    (technique1 as any).params = { blend: 'add' };
    expect(technique1.testGetBlendModeValue()).toBe(0);
    
    const technique2 = new TestableFeedbackLoop('test2');
    (technique2 as any).params = { blend: 'multiply' };
    expect(technique2.testGetBlendModeValue()).toBe(1);
    
    const technique3 = new TestableFeedbackLoop('test3');
    (technique3 as any).params = { blend: 'screen' };
    expect(technique3.testGetBlendModeValue()).toBe(2);
    
    const technique4 = new TestableFeedbackLoop('test4');
    (technique4 as any).params = { blend: 'overlay' };
    expect(technique4.testGetBlendModeValue()).toBe(3);
    
    // Test default case
    const technique5 = new TestableFeedbackLoop('test5');
    (technique5 as any).params = { blend: 'invalid' as any };
    expect(technique5.testGetBlendModeValue()).toBe(2); // Default to screen
  });
}); 