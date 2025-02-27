import * as THREE from 'three';
import { FluidSimulation, FluidSimulationParams } from '../techniques/FluidSimulation';
import { INode, ProcessContext, IInputPort, IOutputPort, PortType } from '../../../core/types/node';
import { NodeRegistry } from '../../../core/nodes/NodeRegistry';
import { FluidSimulationNode } from '../../../core/nodes/definitions/visual/FluidSimulationNode';

// Mock the NodeRegistry
jest.mock('../../../core/nodes/NodeRegistry', () => ({
  NodeRegistry: {
    getInstance: jest.fn().mockReturnValue({
      registerNode: jest.fn(),
      getDefinition: jest.fn().mockReturnValue(FluidSimulationNode)
    })
  }
}));

// Mock FluidSimulation class
jest.mock('../techniques/FluidSimulation', () => {
  return {
    FluidSimulation: jest.fn().mockImplementation(() => ({
      initialize: jest.fn(),
      createMaterial: jest.fn(),
      updateParams: jest.fn(),
      render: jest.fn(),
      dispose: jest.fn(),
      getOutputTexture: jest.fn().mockReturnValue(new THREE.Texture())
    }))
  };
});

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

// Define a mocked technique type for type safety in tests
interface MockedTechnique {
  initialize: jest.Mock;
  createMaterial: jest.Mock;
  updateParams: jest.Mock;
  render: jest.Mock;
  dispose: jest.Mock;
  getOutputTexture: jest.Mock;
}

describe('FluidSimulationNode', () => {
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
    
    // Create mock node
    mockNode = {
      id: 'fluid-node-1',
      type: 'fluidSimulation',
      position: { x: 0, y: 0 },
      processed: false,
      inputs: {
        input: {
          id: 'input',
          name: 'Input',
          type: PortType.TEXTURE,
          nodeId: 'fluid-node-1',
          connected: false
        } as IInputPort<PortType>
      },
      outputs: {
        output: {
          id: 'output',
          name: 'Output',
          type: PortType.TEXTURE,
          nodeId: 'fluid-node-1'
        } as IOutputPort<PortType>
      },
      params: {
        resolution: 128,
        dyeResolution: 512,
        densityDissipation: 0.98,
        velocityDissipation: 0.98,
        pressureIterations: 20,
        curl: 30,
        splatRadius: 0.25,
        colorMode: 'rainbow',
        colorA: new THREE.Color(0x00ffff),
        colorB: new THREE.Color(0xff0000)
      },
      state: {}
    };
    
    // Create mock context
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
    const definition = registry.getDefinition('fluidSimulation');
    
    expect(definition).toBeDefined();
    if (definition) {
      expect(definition.type).toBe('fluidSimulation');
      expect(definition.category).toBe('source');
      expect(definition.system).toBe('visual');
    }
  });
  
  test('should have correct input and output ports', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('fluidSimulation');
    
    expect(definition).toBeDefined();
    if (definition) {
      expect(definition.inputs).toHaveLength(1);
      expect(definition.inputs[0].id).toBe('input');
      expect(definition.inputs[0].type).toBe(PortType.TEXTURE);
      
      expect(definition.outputs).toHaveLength(1);
      expect(definition.outputs[0].id).toBe('output');
      expect(definition.outputs[0].type).toBe(PortType.TEXTURE);
    }
  });
  
  test('should have correct parameters', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('fluidSimulation');
    
    expect(definition).toBeDefined();
    if (definition) {
      // Check for required parameters
      const paramIds = definition.params.map(p => p.id);
      expect(paramIds).toContain('resolution');
      expect(paramIds).toContain('dyeResolution');
      expect(paramIds).toContain('densityDissipation');
      expect(paramIds).toContain('velocityDissipation');
      expect(paramIds).toContain('pressureIterations');
      expect(paramIds).toContain('curl');
      expect(paramIds).toContain('splatRadius');
      expect(paramIds).toContain('colorMode');
      expect(paramIds).toContain('colorA');
      expect(paramIds).toContain('colorB');
    }
  });
  
  test('should initialize correctly', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('fluidSimulation');
    
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
    const definition = registry.getDefinition('fluidSimulation');
    
    expect(definition).toBeDefined();
    if (definition) {
      // Initialize first
      definition.initialize(mockNode as INode);
      
      // Then process
      definition.process(mockNode as INode, mockContext);
      
      // Verify technique was created and initialized
      expect(FluidSimulation).toHaveBeenCalledWith(mockNode.id);
      
      const technique = (mockNode.state as any).technique as MockedTechnique;
      expect(technique).toBeDefined();
      expect(technique.initialize).toHaveBeenCalledWith(mockContext.renderer);
    }
  });
  
  test('should update technique parameters from node params', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('fluidSimulation');
    
    expect(definition).toBeDefined();
    if (definition) {
      // Initialize and process
      definition.initialize(mockNode as INode);
      definition.process(mockNode as INode, mockContext);
      
      // Verify technique parameters were updated
      const technique = (mockNode.state as any).technique as MockedTechnique;
      expect(technique.updateParams).toHaveBeenCalledWith({
        resolution: 128,
        dyeResolution: 512,
        densityDissipation: 0.98,
        velocityDissipation: 0.98,
        pressureIterations: 20,
        curl: 30,
        splatRadius: 0.25,
        colorMode: 'rainbow',
        colorA: mockNode.params!.colorA,
        colorB: mockNode.params!.colorB
      });
    }
  });
  
  test('should render technique and set output texture', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('fluidSimulation');
    
    expect(definition).toBeDefined();
    if (definition) {
      // Initialize and process
      definition.initialize(mockNode as INode);
      definition.process(mockNode as INode, mockContext);
      
      // Verify technique was rendered
      const technique = (mockNode.state as any).technique as MockedTechnique;
      expect(technique.render).toHaveBeenCalledWith(mockContext.renderer);
      
      // Verify output texture was set
      expect(technique.getOutputTexture).toHaveBeenCalled();
      expect(mockContext.setOutputData).toHaveBeenCalledWith(
        mockNode.id, 
        'output', 
        expect.any(THREE.Texture)
      );
    }
  });
  
  test('should dispose technique when node is disposed', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('fluidSimulation');
    
    expect(definition).toBeDefined();
    if (definition) {
      // Initialize and process
      definition.initialize(mockNode as INode);
      definition.process(mockNode as INode, mockContext);
      
      // Then dispose
      const disposeFunction = (mockNode.state as any).dispose;
      disposeFunction();
      
      // Verify technique was disposed
      const technique = (mockNode.state as any).technique as MockedTechnique;
      expect(technique.dispose).toHaveBeenCalled();
      expect((mockNode.state as any).technique).toBeNull();
    }
  });
  
  test('should reuse existing technique on subsequent process calls', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('fluidSimulation');
    
    expect(definition).toBeDefined();
    if (definition) {
      // Initialize and process
      definition.initialize(mockNode as INode);
      definition.process(mockNode as INode, mockContext);
      
      // Store reference to created technique
      const technique = (mockNode.state as any).technique as MockedTechnique;
      
      // Reset mocks for next assertion
      jest.clearAllMocks();
      
      // Process again
      definition.process(mockNode as INode, mockContext);
      
      // Verify technique was not recreated
      expect(FluidSimulation).not.toHaveBeenCalled();
      expect((mockNode.state as any).technique).toBe(technique);
      
      // But parameters were updated and technique was rendered
      expect(technique.updateParams).toHaveBeenCalled();
      expect(technique.render).toHaveBeenCalled();
    }
  });
}); 