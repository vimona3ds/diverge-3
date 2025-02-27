import * as THREE from 'three';
import { FeedbackLoop, FeedbackLoopParams } from '../techniques/FeedbackLoop';
import { INode, ProcessContext, IInputPort, IOutputPort, PortType } from '../../../core/types/node';
import { NodeRegistry } from '../../../core/nodes/NodeRegistry';
import { FeedbackLoopNode } from '../../../core/nodes/definitions/visual/FeedbackLoopNode';

// Mock the NodeRegistry
jest.mock('../../../core/nodes/NodeRegistry', () => ({
  NodeRegistry: {
    getInstance: jest.fn().mockReturnValue({
      registerNode: jest.fn(),
      getDefinition: jest.fn().mockReturnValue(FeedbackLoopNode)
    })
  }
}));

// Mock FeedbackLoop class
jest.mock('../techniques/FeedbackLoop', () => {
  return {
    FeedbackLoop: jest.fn().mockImplementation(() => ({
      initialize: jest.fn(),
      createMaterial: jest.fn(),
      updateParams: jest.fn(),
      render: jest.fn(),
      reset: jest.fn(),
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
    Vector2: jest.fn().mockImplementation(() => ({
      x: 0, y: 0,
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
  reset: jest.Mock;
  dispose: jest.Mock;
  getOutputTexture: jest.Mock;
}

describe('FeedbackLoopNode', () => {
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
      id: 'feedback-node-1',
      type: 'feedbackLoop',
      position: { x: 0, y: 0 },
      processed: false,
      inputs: {
        input: {
          id: 'input',
          name: 'Input',
          type: PortType.TEXTURE,
          nodeId: 'feedback-node-1',
          connected: true
        } as IInputPort<PortType>
      },
      outputs: {
        output: {
          id: 'output',
          name: 'Output',
          type: PortType.TEXTURE,
          nodeId: 'feedback-node-1'
        } as IOutputPort<PortType>
      },
      params: {
        feedbackStrength: 0.9,
        translateX: 0.01,
        translateY: 0.02,
        scale: 1.01,
        rotation: 0.05,
        blend: 'screen',
        fadeRate: 0.05,
        colorShift: true,
        colorShiftRate: 0.01
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
      getInputData: jest.fn().mockReturnValue(new THREE.Texture()),
      setOutputData: jest.fn()
    };
  });
  
  test('should be defined in the NodeRegistry', () => {
    // Use getDefinition directly as we're already mocking it
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('feedbackLoop');
    
    expect(definition).toBeDefined();
    if (definition) {
      expect(definition.type).toBe('feedbackLoop');
      expect(definition.category).toBe('process');
      expect(definition.system).toBe('visual');
    }
  });
  
  test('should have correct input and output ports', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('feedbackLoop');
    
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
    const definition = registry.getDefinition('feedbackLoop');
    
    expect(definition).toBeDefined();
    if (definition) {
      // Check for required parameters
      const paramIds = definition.params.map(p => p.id);
      expect(paramIds).toContain('feedbackStrength');
      expect(paramIds).toContain('translateX');
      expect(paramIds).toContain('translateY');
      expect(paramIds).toContain('scale');
      expect(paramIds).toContain('rotation');
      expect(paramIds).toContain('blend');
      expect(paramIds).toContain('fadeRate');
      expect(paramIds).toContain('colorShift');
      expect(paramIds).toContain('colorShiftRate');
    }
  });
  
  test('should initialize correctly', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('feedbackLoop');
    
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
    const definition = registry.getDefinition('feedbackLoop');
    
    expect(definition).toBeDefined();
    if (definition) {
      // Initialize first
      definition.initialize(mockNode as INode);
      
      // Then process
      definition.process(mockNode as INode, mockContext);
      
      // Verify technique was created and initialized
      expect(FeedbackLoop).toHaveBeenCalledWith(mockNode.id);
      
      const technique = (mockNode.state as any).technique as MockedTechnique;
      expect(technique).toBeDefined();
      expect(technique.initialize).toHaveBeenCalledWith(mockContext.renderer);
    }
  });
  
  test('should update technique parameters from node params', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('feedbackLoop');
    
    expect(definition).toBeDefined();
    if (definition) {
      // Initialize and process
      definition.initialize(mockNode as INode);
      definition.process(mockNode as INode, mockContext);
      
      // Verify technique parameters were updated
      const technique = (mockNode.state as any).technique as MockedTechnique;
      expect(technique.updateParams).toHaveBeenCalledWith({
        feedbackStrength: 0.9,
        translateX: 0.01,
        translateY: 0.02,
        scale: 1.01,
        rotation: 0.05,
        blend: 'screen',
        fadeRate: 0.05,
        colorShift: true,
        colorShiftRate: 0.01,
        feedbackTexture: expect.any(THREE.Texture)
      });
    }
  });
  
  test('should render technique and set output texture', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('feedbackLoop');
    
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
    const definition = registry.getDefinition('feedbackLoop');
    
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
    const definition = registry.getDefinition('feedbackLoop');
    
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
      expect(FeedbackLoop).not.toHaveBeenCalled();
      expect((mockNode.state as any).technique).toBe(technique);
      
      // But parameters were updated and technique was rendered
      expect(technique.updateParams).toHaveBeenCalled();
      expect(technique.render).toHaveBeenCalled();
    }
  });
  
  test('should reset technique when input is disconnected and connected again', () => {
    const registry = NodeRegistry.getInstance();
    const definition = registry.getDefinition('feedbackLoop');
    
    expect(definition).toBeDefined();
    if (definition) {
      // Initialize and process with connected input
      definition.initialize(mockNode as INode);
      definition.process(mockNode as INode, mockContext);
      
      // Get technique reference
      const technique = (mockNode.state as any).technique as MockedTechnique;
      
      // Disconnect input
      (mockNode as any).inputs.input.connected = false;
      
      // Process again
      definition.process(mockNode as INode, mockContext);
      
      // Reconnect input
      (mockNode as any).inputs.input.connected = true;
      
      // Process once more
      definition.process(mockNode as INode, mockContext);
      
      // Verify technique was reset after reconnection
      expect(technique.reset).toHaveBeenCalled();
    }
  });
}); 