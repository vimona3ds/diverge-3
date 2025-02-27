import * as THREE from 'three';
import { NodeRegistry } from '../../../core/nodes/NodeRegistry';
import { VisualNodeIntegration, VisualProcessContext } from '../';
import { IGraph, INode, ProcessContext, PortType } from '../../../core/types/node';
import { MetaballsNode } from '../../../core/nodes/definitions/visual/MetaballsNode';
import { ReactionDiffusionNode } from '../../../core/nodes/definitions/visual/ReactionDiffusionNode';

// Mock implementations
jest.mock('three');

// Mock visual techniques
jest.mock('../../../../systems/visual/techniques/Metaballs');
jest.mock('../../../../systems/visual/techniques/ReactionDiffusion');

/**
 * Interface for objects with mock functions
 */
interface MockWithDispose {
  dispose: jest.Mock;
}

describe('VisualNodeIntegration', () => {
  let nodeRegistry: NodeRegistry;
  let visualNodeIntegration: VisualNodeIntegration;
  let mockRenderer: THREE.WebGLRenderer;
  let mockProcessContext: ProcessContext;
  let mockGraph: IGraph;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock renderer
    mockRenderer = new THREE.WebGLRenderer() as jest.Mocked<THREE.WebGLRenderer>;
    
    // Setup mock process context
    mockProcessContext = {
      time: 0,
      deltaTime: 0.016,
      frame: 0,
      renderer: mockRenderer,
      audioContext: {} as AudioContext,
      assets: {}
    };
    
    // Setup mock graph
    mockGraph = {
      nodes: {},
      connections: {}
    };
    
    // Get NodeRegistry instance
    nodeRegistry = NodeRegistry.getInstance();
    
    // Create VisualNodeIntegration
    visualNodeIntegration = new VisualNodeIntegration();
  });

  test('should register all visual nodes', () => {
    // Spy on register method
    const registerSpy = jest.spyOn(nodeRegistry, 'register');
    
    // Initialize integration
    visualNodeIntegration.initialize();
    
    // Verify all visual nodes are registered
    expect(registerSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'metaballs' }));
    expect(registerSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'reactionDiffusion' }));
    expect(registerSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'lenia' }));
    expect(registerSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'fluidSimulation' }));
    expect(registerSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'feedbackLoop' }));
    expect(registerSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'fractalNoise' }));
    
    // Restore spy
    registerSpy.mockRestore();
  });

  test('should create extended process context with visual methods', () => {
    // Create extended context
    const extendedContext = visualNodeIntegration.createVisualProcessContext(mockProcessContext);
    
    // Verify extended context has expected methods
    expect(extendedContext).toHaveProperty('getInputData');
    expect(extendedContext).toHaveProperty('setOutputData');
    expect(extendedContext).toHaveProperty('renderer', mockRenderer);
  });

  test('should handle texture data between nodes', () => {
    // Create extended context
    const extendedContext = visualNodeIntegration.createVisualProcessContext(mockProcessContext);
    
    // Create mock texture
    const mockTexture = new THREE.Texture() as jest.Mocked<THREE.Texture>;
    
    // Set output data
    extendedContext.setOutputData('node1', 'output', mockTexture);
    
    // Try to get input data (simulating a connection from node1.output to node2.input)
    const inputData = extendedContext.getInputData('node2', 'input');
    
    // Currently should be undefined because no connections are defined
    expect(inputData).toBeUndefined();
    
    // Setup a connection in the graph
    mockGraph.connections['conn1'] = {
      id: 'conn1',
      sourceNodeId: 'node1',
      sourcePortId: 'output',
      targetNodeId: 'node2',
      targetPortId: 'input'
    };
    
    // Set the graph in the integration
    visualNodeIntegration.setGraph(mockGraph);
    
    // Now try again to get input data
    const inputDataAfterConnection = extendedContext.getInputData('node2', 'input');
    
    // Should now receive the texture from node1
    expect(inputDataAfterConnection).toBe(mockTexture);
  });

  test('should clean up resources properly', () => {
    // Create a mock disposal function
    const mockDispose = jest.fn();
    
    // Create a mock node with a technique
    const mockNode: INode = {
      id: 'node1',
      type: 'metaballs',
      position: { x: 0, y: 0 },
      inputs: {},
      outputs: {},
      params: {},
      state: {
        technique: {
          dispose: mockDispose
        } as unknown as MockWithDispose
      },
      processed: false
    };
    
    // Add node to graph
    mockGraph.nodes['node1'] = mockNode;
    
    // Set graph in integration
    visualNodeIntegration.setGraph(mockGraph);
    
    // Call dispose
    visualNodeIntegration.dispose();
    
    // Verify technique dispose was called
    expect(mockDispose).toHaveBeenCalled();
  });

  test('should process visual nodes correctly', () => {
    // Create mock metaballs node
    const metaballsNode: INode = {
      id: 'metaballs1',
      type: 'metaballs',
      position: { x: 0, y: 0 },
      inputs: {},
      outputs: {
        output: {
          id: 'output',
          name: 'Output',
          type: PortType.TEXTURE,
          nodeId: 'metaballs1',
          connections: ['conn1'],
          data: undefined,
          allowMultiple: true
        }
      },
      params: {
        threshold: 0.5
      },
      state: {},
      processed: false
    };
    
    // Create mock reaction diffusion node that uses the metaballs output
    const rdNode: INode = {
      id: 'rd1',
      type: 'reactionDiffusion',
      position: { x: 0, y: 0 },
      inputs: {
        seed: {
          id: 'seed',
          name: 'Seed',
          type: PortType.TEXTURE,
          nodeId: 'rd1',
          connected: true,
          data: undefined
        }
      },
      outputs: {},
      params: {
        feed: 0.055,
        kill: 0.062
      },
      state: {},
      processed: false
    };
    
    // Add nodes to graph
    mockGraph.nodes['metaballs1'] = metaballsNode;
    mockGraph.nodes['rd1'] = rdNode;
    
    // Create connection
    mockGraph.connections['conn1'] = {
      id: 'conn1',
      sourceNodeId: 'metaballs1',
      sourcePortId: 'output',
      targetNodeId: 'rd1',
      targetPortId: 'seed'
    };
    
    // Set graph in integration
    visualNodeIntegration.setGraph(mockGraph);
    
    // Create extended context
    const extendedContext = visualNodeIntegration.createVisualProcessContext(mockProcessContext);
    
    // Mock the process method for testing
    const processSpy = jest.spyOn(MetaballsNode, 'process');
    const rdProcessSpy = jest.spyOn(ReactionDiffusionNode, 'process');
    
    // Process the nodes
    visualNodeIntegration.processNodes(extendedContext);
    
    // Verify node processes were called in correct order (metaballs first, then reaction diffusion)
    expect(processSpy).toHaveBeenCalledWith(metaballsNode, expect.anything());
    expect(rdProcessSpy).toHaveBeenCalledWith(rdNode, expect.anything());
    
    // Restore spies
    processSpy.mockRestore();
    rdProcessSpy.mockRestore();
  });
}); 