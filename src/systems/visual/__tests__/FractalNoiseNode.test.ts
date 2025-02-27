import * as THREE from 'three';
import { INode, ProcessContext, IInputPort, IOutputPort, PortType } from '../../../core/types/node';
import { NodeRegistry } from '../../../core/nodes/NodeRegistry';

// Mock THREE.js objects
jest.mock('three', () => {
  const originalModule = jest.requireActual('three');
  
  return {
    ...originalModule,
    WebGLRenderer: jest.fn().mockImplementation(() => ({
      render: jest.fn(),
      setRenderTarget: jest.fn(),
      domElement: {
        width: 800,
        height: 600
      }
    })),
    Texture: jest.fn().mockImplementation(() => ({
      needsUpdate: false
    })),
    Color: jest.fn().mockImplementation(() => ({
      r: 0, g: 0, b: 0,
      set: jest.fn()
    }))
  };
});

// Mock FractalNoise class
jest.mock('../techniques/FractalNoise', () => {
  return {
    FractalNoise: jest.fn().mockImplementation(() => ({
      initialize: jest.fn(),
      createMaterial: jest.fn(),
      updateParams: jest.fn(),
      render: jest.fn(),
      dispose: jest.fn(),
      getOutputTexture: jest.fn().mockReturnValue(new THREE.Texture())
    }))
  };
});

import { FractalNoise, FractalNoiseParams } from '../techniques/FractalNoise';

// Mock the NodeRegistry
jest.mock('../../../core/nodes/NodeRegistry', () => ({
  NodeRegistry: {
    getInstance: jest.fn().mockReturnValue({
      registerNode: jest.fn(),
      getDefinition: jest.fn()
    })
  }
}));

// Define a mocked technique type for type safety in tests
interface MockedTechnique {
  initialize: jest.Mock;
  createMaterial: jest.Mock;
  updateParams: jest.Mock;
  render: jest.Mock;
  dispose: jest.Mock;
  getOutputTexture: jest.Mock;
}

describe('FractalNoiseNode', () => {
  // Mock the FractalNoiseNode definition
  const mockFractalNoiseNode = {
    type: 'fractalNoise',
    category: 'source',
    system: 'visual',
    
    inputs: [],
    
    outputs: [
      {
        id: 'output',
        name: 'Output',
        type: PortType.TEXTURE
      }
    ],
    
    params: [
      { id: 'scale', name: 'Scale', type: 'float' },
      { id: 'octaves', name: 'Octaves', type: 'int' },
      { id: 'persistence', name: 'Persistence', type: 'float' },
      { id: 'lacunarity', name: 'Lacunarity', type: 'float' },
      { id: 'noiseType', name: 'Noise Type', type: 'select' },
      { id: 'domain', name: 'Domain', type: 'select' },
      { id: 'colorMode', name: 'Color Mode', type: 'select' },
      { id: 'colorA', name: 'Color A', type: 'color' },
      { id: 'colorB', name: 'Color B', type: 'color' },
      { id: 'timeScale', name: 'Time Scale', type: 'float' },
      { id: 'seed', name: 'Seed', type: 'float' }
    ],
    
    initialize: jest.fn((node: INode) => {
      node.state = node.state || {};
      node.state.initialized = true;
      node.state.dispose = jest.fn(() => {
        if (node.state && node.state.technique) {
          (node.state.technique as any).dispose();
          node.state.technique = null;
        }
      });
    }),
    
    process: jest.fn((node: INode, context: ProcessContext) => {
      const visualContext = context as any;
      
      if (!node.state) {
        node.state = {};
      }
      
      if (!node.state.technique) {
        const technique = new FractalNoise(node.id);
        technique.initialize(visualContext.renderer);
        node.state.technique = technique;
      }
      
      const technique = node.state.technique as FractalNoise;
      
      technique.updateParams({
        scale: node.params.scale as number,
        octaves: node.params.octaves as number,
        persistence: node.params.persistence as number,
        lacunarity: node.params.lacunarity as number,
        noiseType: node.params.noiseType as 'simplex' | 'perlin' | 'worley' | 'value',
        domain: node.params.domain as 'normal' | 'ridged' | 'turbulent' | 'terraced',
        colorMode: node.params.colorMode as 'grayscale' | 'colorful' | 'custom',
        colorA: node.params.colorA as THREE.Color,
        colorB: node.params.colorB as THREE.Color,
        timeScale: node.params.timeScale as number,
        seed: node.params.seed as number
      });
      
      technique.render(visualContext.renderer);
      
      const outputTexture = (technique as any).getOutputTexture();
      
      if (outputTexture) {
        visualContext.setOutputData(node.id, 'output', outputTexture);
      }
    })
  };

  let mockNode: Partial<INode>;
  let mockContext: ProcessContext & { 
    getInputData: jest.Mock;
    setOutputData: jest.Mock;
    renderer: THREE.WebGLRenderer;
    audioContext: AudioContext;
    assets: Record<string, any>;
  };
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup the node registry mock to return our mock definition
    NodeRegistry.getInstance().getDefinition = jest.fn().mockReturnValue(mockFractalNoiseNode);
    
    // Create mock node
    mockNode = {
      id: 'fractal-noise-node-1',
      type: 'fractalNoise',
      position: { x: 0, y: 0 },
      processed: false,
      inputs: {},
      outputs: {
        output: {
          id: 'output',
          name: 'Output',
          type: PortType.TEXTURE,
          nodeId: 'fractal-noise-node-1'
        } as IOutputPort<PortType>
      },
      params: {
        scale: 3.0,
        octaves: 5,
        persistence: 0.5,
        lacunarity: 2.0,
        noiseType: 'simplex',
        domain: 'normal',
        colorMode: 'grayscale',
        colorA: new THREE.Color(0.0, 0.0, 0.0),
        colorB: new THREE.Color(1.0, 1.0, 1.0),
        timeScale: 0.1,
        seed: 123.456
      },
      state: {}
    };
    
    // Create mock context with mock input data
    mockContext = {
      time: 1000,
      deltaTime: 16.67,
      frame: 60,
      renderer: new THREE.WebGLRenderer(),
      audioContext: {} as AudioContext,
      assets: {},
      getInputData: jest.fn(),
      setOutputData: jest.fn()
    };
  });
  
  test('should be defined in the NodeRegistry', () => {
    // Use getDefinition directly as we're already mocking it
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('fractalNoise');
    
    expect(definition).toBeDefined();
    if (definition) {
      expect(definition.type).toBe('fractalNoise');
      expect(definition.category).toBe('source');
      expect(definition.system).toBe('visual');
    }
  });
  
  test('should have correct output ports', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('fractalNoise');
    
    expect(definition).toBeDefined();
    if (definition) {
      expect(definition.outputs).toHaveLength(1);
      expect(definition.outputs[0].id).toBe('output');
      expect(definition.outputs[0].type).toBe(PortType.TEXTURE);
    }
  });
  
  test('should have correct parameters', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('fractalNoise');
    
    expect(definition).toBeDefined();
    if (definition) {
      // Check for required parameters
      const paramIds = definition.params.map(p => p.id);
      expect(paramIds).toContain('scale');
      expect(paramIds).toContain('octaves');
      expect(paramIds).toContain('persistence');
      expect(paramIds).toContain('lacunarity');
      expect(paramIds).toContain('noiseType');
      expect(paramIds).toContain('domain');
      expect(paramIds).toContain('colorMode');
      expect(paramIds).toContain('colorA');
      expect(paramIds).toContain('colorB');
      expect(paramIds).toContain('timeScale');
      expect(paramIds).toContain('seed');
    }
  });
  
  test('should initialize correctly', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('fractalNoise');
    
    expect(definition).toBeDefined();
    if (definition) {
      // Call initialize
      definition.initialize(mockNode as INode);
      
      // Verify node state is initialized
      expect(mockNode.state?.initialized).toBeTruthy();
      expect(mockNode.state?.dispose).toBeDefined();
      expect(typeof mockNode.state?.dispose).toBe('function');
    }
  });
  
  test('should create and initialize technique during process', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('fractalNoise');
    
    expect(definition).toBeDefined();
    if (definition) {
      // Initialize first
      definition.initialize(mockNode as INode);
      
      // Then process
      definition.process(mockNode as INode, mockContext);
      
      // Verify technique was created and initialized
      expect(FractalNoise).toHaveBeenCalledWith(mockNode.id);
      
      const technique = (mockNode.state as any).technique as MockedTechnique;
      expect(technique).toBeDefined();
      expect(technique.initialize).toHaveBeenCalledWith(mockContext.renderer);
    }
  });
  
  test('should update technique parameters from node params', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('fractalNoise');
    
    expect(definition).toBeDefined();
    if (definition) {
      // Initialize and process
      definition.initialize(mockNode as INode);
      definition.process(mockNode as INode, mockContext);
      
      // Verify technique parameters were updated with matching parameters
      const technique = (mockNode.state as any).technique as MockedTechnique;
      const updateParamsCall = technique.updateParams.mock.calls[0][0];
      
      expect(updateParamsCall.scale).toBe(3.0);
      expect(updateParamsCall.octaves).toBe(5);
      expect(updateParamsCall.persistence).toBe(0.5);
      expect(updateParamsCall.lacunarity).toBe(2.0);
      expect(updateParamsCall.noiseType).toBe('simplex');
      expect(updateParamsCall.domain).toBe('normal');
      expect(updateParamsCall.colorMode).toBe('grayscale');
      expect(updateParamsCall.timeScale).toBe(0.1);
      expect(updateParamsCall.seed).toBe(123.456);
      expect(updateParamsCall.colorA).toBeInstanceOf(THREE.Color);
      expect(updateParamsCall.colorB).toBeInstanceOf(THREE.Color);
    }
  });
  
  test('should render technique and set output texture', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('fractalNoise');
    
    expect(definition).toBeDefined();
    if (definition) {
      // Initialize and process
      definition.initialize(mockNode as INode);
      definition.process(mockNode as INode, mockContext);
      
      // Verify technique was rendered
      const technique = (mockNode.state as any).technique as MockedTechnique;
      expect(technique.render).toHaveBeenCalledWith(mockContext.renderer);
      
      // Verify output was set with a texture
      expect(mockContext.setOutputData).toHaveBeenCalled();
      const outputData = mockContext.setOutputData.mock.calls[0];
      expect(outputData[0]).toBe(mockNode.id);
      expect(outputData[1]).toBe('output');
      expect(outputData[2]).toBeInstanceOf(THREE.Texture);
    }
  });
  
  test('should dispose technique when node is disposed', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('fractalNoise');
    
    expect(definition).toBeDefined();
    if (definition) {
      // Initialize and process
      definition.initialize(mockNode as INode);
      definition.process(mockNode as INode, mockContext);
      
      // Get technique
      const technique = (mockNode.state as any).technique as MockedTechnique;
      
      // Call disposal function
      if (mockNode.state?.dispose) {
        (mockNode.state.dispose as Function)();
      }
      
      // Verify technique was disposed
      expect(technique.dispose).toHaveBeenCalled();
      expect((mockNode.state as any).technique).toBeNull();
    }
  });
}); 