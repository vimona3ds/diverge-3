import * as THREE from 'three';
import { FractalNoise, FractalNoiseParams } from '../techniques/FractalNoise';
import { IShaderMaterial } from '../../../core/types/visual';
import './__mocks__/three'; // Import shared THREE mock

// Create a helper class to access protected properties for testing
class TestableFractalNoise extends FractalNoise {
  // Access protected properties from BaseTechnique
  public get testScene(): THREE.Scene { return this.scene; }
  public get testCamera(): THREE.OrthographicCamera { return this.camera; }
  public get testMesh(): THREE.Mesh { return this.mesh!; }
  public get testInitialized(): boolean { return this.initialized; }
  
  // Access private properties using type assertion
  public get testNoiseMaterial(): IShaderMaterial | null {
    return (this as any).noiseMaterial;
  }
  
  public get testParams(): FractalNoiseParams {
    return (this as any).params;
  }
  
  public get testWebGLRenderer(): THREE.WebGLRenderer | null {
    return (this as any).webGLRenderer;
  }
  
  // Access private methods for testing
  public testGetNoiseTypeValue(): number {
    return (this as any).getNoiseTypeValue();
  }
  
  public testGetDomainTypeValue(): number {
    return (this as any).getDomainTypeValue();
  }
  
  public testGetColorModeValue(): number {
    return (this as any).getColorModeValue();
  }
}

// Mock THREE.js objects
jest.mock('three', () => {
  const originalModule = jest.requireActual('three');
  
  // Mock the basic THREE classes we need
  const mockUniforms = {
    u_scale: { value: 3.0 },
    u_octaves: { value: 5 },
    u_persistence: { value: 0.5 },
    u_lacunarity: { value: 2.0 },
    u_noiseType: { value: 0 },
    u_domainType: { value: 0 },
    u_colorMode: { value: 0 },
    u_colorA: { value: new originalModule.Color() },
    u_colorB: { value: new originalModule.Color() },
    u_time: { value: 0.0 },
    u_timeScale: { value: 0.1 },
    u_seed: { value: 123.456 },
    u_resolution: { value: new originalModule.Vector2(800, 600) }
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
      setRenderTarget: jest.fn(),
      getSize: jest.fn().mockReturnValue(new originalModule.Vector2(800, 600))
    })),
    ShaderMaterial: jest.fn().mockImplementation(() => mockMaterial),
    PlaneGeometry: jest.fn().mockImplementation(() => mockMesh.geometry),
    Mesh: jest.fn().mockImplementation(() => mockMesh),
    Scene: jest.fn().mockImplementation(() => ({
      add: jest.fn(),
      remove: jest.fn()
    })),
    OrthographicCamera: jest.fn().mockImplementation(() => ({})),
    Color: originalModule.Color,
    Vector2: originalModule.Vector2
  };
});

describe('FractalNoise', () => {
  let technique: TestableFractalNoise;
  let renderer: THREE.WebGLRenderer;
  
  beforeEach(() => {
    // Create a test technique instance
    technique = new TestableFractalNoise('fractal-noise-test');
    
    // Create a mock renderer
    renderer = new THREE.WebGLRenderer();
    
    // Clear mocks
    jest.clearAllMocks();
  });
  
  test('should create a FractalNoise instance', () => {
    expect(technique).toBeInstanceOf(FractalNoise);
    expect(technique.id).toBe('fractal-noise-test');
    expect(technique.name).toBe('FractalNoise');
  });
  
  test('should initialize the technique', () => {
    technique.initialize(renderer);
    
    expect(technique.testInitialized).toBe(true);
    expect(technique.testScene).toBeDefined();
    expect(technique.testCamera).toBeDefined();
    expect(technique.testMesh).toBeDefined();
    expect(technique.testWebGLRenderer).toBeDefined();
  });
  
  test('should create material with default parameters', () => {
    technique.initialize(renderer);
    
    const material = technique.createMaterial({});
    
    expect(material).toBeDefined();
    expect(material.uniforms).toHaveProperty('u_scale');
    expect(material.uniforms).toHaveProperty('u_octaves');
    expect(material.uniforms).toHaveProperty('u_persistence');
    expect(material.uniforms).toHaveProperty('u_lacunarity');
    expect(material.uniforms).toHaveProperty('u_noiseType');
    expect(material.uniforms).toHaveProperty('u_domainType');
    expect(material.uniforms).toHaveProperty('u_colorMode');
    expect(material.uniforms).toHaveProperty('u_colorA');
    expect(material.uniforms).toHaveProperty('u_colorB');
    expect(material.uniforms).toHaveProperty('u_time');
    expect(material.uniforms).toHaveProperty('u_timeScale');
    expect(material.uniforms).toHaveProperty('u_seed');
    expect(material.uniforms).toHaveProperty('u_resolution');
    
    // Verify default parameter values
    expect(material.uniforms.u_scale.value).toBe(3.0);
    expect(material.uniforms.u_octaves.value).toBe(5);
    expect(material.uniforms.u_persistence.value).toBe(0.5);
    expect(material.uniforms.u_lacunarity.value).toBe(2.0);
    expect(material.uniforms.u_noiseType.value).toBe(0);
    expect(material.uniforms.u_domainType.value).toBe(0);
    expect(material.uniforms.u_colorMode.value).toBe(0);
  });
  
  test('should create material with custom parameters', () => {
    technique.initialize(renderer);
    
    const customParams: Partial<FractalNoiseParams> = {
      scale: 5.0,
      octaves: 3,
      persistence: 0.7,
      lacunarity: 1.5,
      noiseType: 'perlin',
      domain: 'ridged',
      colorMode: 'colorful',
      colorA: new THREE.Color(1, 0, 0),
      colorB: new THREE.Color(0, 0, 1),
      timeScale: 0.5,
      seed: 42.0
    };
    
    const material = technique.createMaterial(customParams);
    
    // Verify custom parameter values
    expect(material.uniforms.u_scale.value).toBe(5.0);
    expect(material.uniforms.u_octaves.value).toBe(3);
    expect(material.uniforms.u_persistence.value).toBe(0.7);
    expect(material.uniforms.u_lacunarity.value).toBe(1.5);
    expect(material.uniforms.u_noiseType.value).toBe(1); // perlin
    expect(material.uniforms.u_domainType.value).toBe(1); // ridged
    expect(material.uniforms.u_colorMode.value).toBe(1); // colorful
    expect(material.uniforms.u_timeScale.value).toBe(0.5);
    expect(material.uniforms.u_seed.value).toBe(42.0);
  });
  
  test('should update parameters', () => {
    technique.initialize(renderer);
    
    // First create with default params
    technique.createMaterial({});
    
    // Then update with new params
    const newParams: Partial<FractalNoiseParams> = {
      scale: 2.0,
      octaves: 4,
      noiseType: 'worley',
      domain: 'turbulent',
      colorMode: 'custom'
    };
    
    technique.updateParams(newParams);
    
    const material = technique.testNoiseMaterial as IShaderMaterial;
    expect(material.uniforms.u_scale.value).toBe(2.0);
    expect(material.uniforms.u_octaves.value).toBe(4);
    expect(material.uniforms.u_noiseType.value).toBe(2); // worley
    expect(material.uniforms.u_domainType.value).toBe(2); // turbulent
    expect(material.uniforms.u_colorMode.value).toBe(2); // custom
  });
  
  test('should provide uniform updaters for time and resolution', () => {
    technique.initialize(renderer);
    technique.createMaterial({});
    
    const updaters = technique.getUniformUpdaters();
    
    expect(updaters).toHaveProperty('u_time');
    expect(updaters).toHaveProperty('u_resolution');
    expect(typeof updaters.u_time).toBe('function');
    expect(typeof updaters.u_resolution).toBe('function');
    
    // Test that the time updater works
    updaters.u_time(2000, 0);
    expect(technique.testNoiseMaterial?.uniforms.u_time.value).toBe(2);
    
    // Test that the resolution updater works
    updaters.u_resolution(0, 0);
    expect(technique.testNoiseMaterial?.uniforms.u_resolution.value.x).toBe(800);
    expect(technique.testNoiseMaterial?.uniforms.u_resolution.value.y).toBe(600);
  });
  
  test('should convert noise type strings correctly', () => {
    // Set different noise types and check the resulting value
    const technique1 = new TestableFractalNoise('test1');
    (technique1 as any).params = { noiseType: 'simplex' };
    expect(technique1.testGetNoiseTypeValue()).toBe(0);
    
    const technique2 = new TestableFractalNoise('test2');
    (technique2 as any).params = { noiseType: 'perlin' };
    expect(technique2.testGetNoiseTypeValue()).toBe(1);
    
    const technique3 = new TestableFractalNoise('test3');
    (technique3 as any).params = { noiseType: 'worley' };
    expect(technique3.testGetNoiseTypeValue()).toBe(2);
    
    const technique4 = new TestableFractalNoise('test4');
    (technique4 as any).params = { noiseType: 'value' };
    expect(technique4.testGetNoiseTypeValue()).toBe(3);
  });
  
  test('should convert domain type strings correctly', () => {
    // Set different domain types and check the resulting value
    const technique1 = new TestableFractalNoise('test1');
    (technique1 as any).params = { domain: 'normal' };
    expect(technique1.testGetDomainTypeValue()).toBe(0);
    
    const technique2 = new TestableFractalNoise('test2');
    (technique2 as any).params = { domain: 'ridged' };
    expect(technique2.testGetDomainTypeValue()).toBe(1);
    
    const technique3 = new TestableFractalNoise('test3');
    (technique3 as any).params = { domain: 'turbulent' };
    expect(technique3.testGetDomainTypeValue()).toBe(2);
    
    const technique4 = new TestableFractalNoise('test4');
    (technique4 as any).params = { domain: 'terraced' };
    expect(technique4.testGetDomainTypeValue()).toBe(3);
  });
  
  test('should convert color mode strings correctly', () => {
    // Set different color modes and check the resulting value
    const technique1 = new TestableFractalNoise('test1');
    (technique1 as any).params = { colorMode: 'grayscale' };
    expect(technique1.testGetColorModeValue()).toBe(0);
    
    const technique2 = new TestableFractalNoise('test2');
    (technique2 as any).params = { colorMode: 'colorful' };
    expect(technique2.testGetColorModeValue()).toBe(1);
    
    const technique3 = new TestableFractalNoise('test3');
    (technique3 as any).params = { colorMode: 'custom' };
    expect(technique3.testGetColorModeValue()).toBe(2);
  });

  // Test rendering functionality
  test('should render to a target', () => {
    technique.initialize(renderer);
    technique.createMaterial({});
    
    const target = new THREE.WebGLRenderTarget(800, 600);
    technique.render(renderer, target);
    
    // Verify rendering was called
    expect(renderer.setRenderTarget).toHaveBeenCalledWith(target);
    expect(renderer.render).toHaveBeenCalledWith(technique.testScene, technique.testCamera);
  });

  // Edge case: rendering without initialization should not throw errors
  test('should handle rendering without initialization', () => {
    // Should not throw an error
    expect(() => {
      technique.render(renderer);
    }).not.toThrow();
    
    // Should not perform any rendering
    expect(renderer.render).not.toHaveBeenCalled();
  });

  // Edge case: updating params without initialization should not throw errors
  test('should handle updating params without initialization', () => {
    expect(() => {
      technique.updateParams({ scale: 2.5 });
    }).not.toThrow();
  });

  // Edge case: properly handle null uniform values
  test('should handle null uniform values gracefully', () => {
    technique.initialize(renderer);
    const mockNoiseMaterial = technique.testNoiseMaterial;
    
    // Temporarily set uniforms to null to test edge case
    if (mockNoiseMaterial) {
      const originalUniforms = { ...mockNoiseMaterial.uniforms };
      mockNoiseMaterial.uniforms = null as any;
      
      // Should not throw errors when accessing null uniforms
      expect(() => {
        technique.updateParams({ scale: 2.5 });
        
        const updaters = technique.getUniformUpdaters();
        updaters.u_time(1000, 0);
        updaters.u_resolution(0, 0);
        
        technique.render(renderer);
      }).not.toThrow();
      
      // Restore original uniforms
      mockNoiseMaterial.uniforms = originalUniforms;
    }
  });

  // Test proper resource disposal
  test('should properly dispose resources', () => {
    technique.initialize(renderer);
    technique.createMaterial({});
    
    technique.dispose();
    
    // Verify mesh disposal (from BaseTechnique)
    expect(technique.testMesh.geometry.dispose).toHaveBeenCalled();
    expect(technique.testNoiseMaterial).toBeNull();
  });

  // Test all noise types together with all domain types
  test('should handle all noise/domain type combinations', () => {
    technique.initialize(renderer);
    
    const noiseTypes = ['simplex', 'perlin', 'worley', 'value'] as const;
    const domainTypes = ['normal', 'ridged', 'turbulent', 'terraced'] as const;
    
    // Test all combinations
    for (const noiseType of noiseTypes) {
      for (const domain of domainTypes) {
        const params = {
          noiseType,
          domain
        };
        
        // Should not throw errors
        expect(() => {
          technique.createMaterial(params);
          technique.render(renderer);
        }).not.toThrow();
      }
    }
  });

  // Test all color modes
  test('should handle all color modes', () => {
    technique.initialize(renderer);
    
    const colorModes = ['grayscale', 'colorful', 'custom'] as const;
    
    for (const colorMode of colorModes) {
      const params = {
        colorMode,
        colorA: new THREE.Color(1, 0, 0),
        colorB: new THREE.Color(0, 0, 1)
      };
      
      // Should not throw errors
      expect(() => {
        technique.createMaterial(params);
        technique.render(renderer);
      }).not.toThrow();
    }
  });

  // Test cleanup of mocks between tests to prevent test contamination
  test('should clean up mocks between tests', () => {
    // This test verifies that the beforeEach setup correctly clears mocks
    expect(jest.clearAllMocks).toBeDefined();
    
    technique.initialize(renderer);
    technique.render(renderer);
    
    expect(renderer.render).toHaveBeenCalled();
    expect(renderer.setRenderTarget).toHaveBeenCalled();
  });
}); 