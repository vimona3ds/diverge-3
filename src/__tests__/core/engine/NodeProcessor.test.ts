import { NodeProcessor } from '../../../../src/core/engine/NodeProcessor';
import { IGraph, INode, ProcessContext, PortType } from '../../../../src/core/types/node';
import { NodeRegistry } from '../../../../src/core/nodes/NodeRegistry';

// Mock dependencies
jest.mock('../../../../src/core/nodes/NodeRegistry', () => ({
  NodeRegistry: {
    getInstance: jest.fn().mockReturnValue({
      getDefinition: jest.fn()
    })
  }
}));

describe('NodeProcessor', () => {
  let nodeProcessor: NodeProcessor;
  let mockGraph: IGraph;
  let mockProcessContext: ProcessContext;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    nodeProcessor = new NodeProcessor();
    
    // Create a simple test graph - 3 nodes with 2 connections
    // node1 -> node2 -> node3
    mockGraph = {
      nodes: {
        'node1': {
          id: 'node1',
          type: 'sourceNode',
          position: { x: 0, y: 0 },
          inputs: {},
          outputs: {
            'output1': {
              id: 'output1',
              name: 'Output 1',
              type: PortType.FLOAT,
              nodeId: 'node1',
              connections: ['node2-input1'],
              data: 10
            }
          },
          params: {},
          state: {},
          processed: false
        },
        'node2': {
          id: 'node2',
          type: 'processNode',
          position: { x: 200, y: 0 },
          inputs: {
            'input1': {
              id: 'input1',
              name: 'Input 1',
              type: PortType.FLOAT,
              nodeId: 'node2',
              connected: true
            }
          },
          outputs: {
            'output1': {
              id: 'output1',
              name: 'Output 1',
              type: PortType.FLOAT,
              nodeId: 'node2',
              connections: ['node3-input1'],
              data: null
            }
          },
          params: {},
          state: {},
          processed: false
        },
        'node3': {
          id: 'node3',
          type: 'outputNode',
          position: { x: 400, y: 0 },
          inputs: {
            'input1': {
              id: 'input1',
              name: 'Input 1',
              type: PortType.FLOAT,
              nodeId: 'node3',
              connected: true
            }
          },
          outputs: {},
          params: {},
          state: {},
          processed: false
        }
      },
      connections: {
        'conn1': {
          id: 'conn1',
          sourceNodeId: 'node1',
          sourcePortId: 'output1',
          targetNodeId: 'node2',
          targetPortId: 'input1'
        },
        'conn2': {
          id: 'conn2',
          sourceNodeId: 'node2',
          sourcePortId: 'output1',
          targetNodeId: 'node3',
          targetPortId: 'input1'
        }
      }
    };
    
    // Set up mock process definitions
    const nodeRegistryMock = NodeRegistry.getInstance();
    (nodeRegistryMock.getDefinition as jest.Mock).mockImplementation((type) => {
      if (type === 'sourceNode') {
        return {
          type: 'sourceNode',
          process: (node: INode) => {
            // Source node just produces a constant value
            node.outputs.output1.data = 42;
          }
        };
      } else if (type === 'processNode') {
        return {
          type: 'processNode',
          process: (node: INode) => {
            // Process node doubles the input value
            const inputValue = node.inputs.input1.data;
            node.outputs.output1.data = inputValue ? inputValue * 2 : 0;
          }
        };
      } else if (type === 'outputNode') {
        return {
          type: 'outputNode',
          process: (node: INode) => {
            // Output node just stores the value (in this test)
            node.state.finalValue = node.inputs.input1.data;
          }
        };
      }
      return null;
    });
    
    // Create a mock processing context
    mockProcessContext = {
      time: 1000,
      deltaTime: 16,
      frame: 60,
      renderer: {} as any,
      audioContext: {} as any,
      assets: {}
    };
    
    nodeProcessor.setGraph(mockGraph);
  });
  
  describe('setGraph', () => {
    it('should set the graph and perform topological sorting', () => {
      const sortedNodes = (nodeProcessor as any).sortedNodes;
      
      // Verify that nodes are in dependency order
      expect(sortedNodes.length).toBe(3);
      expect(sortedNodes[0].id).toBe('node1');  // Source nodes come first
      expect(sortedNodes[1].id).toBe('node2');  // Process nodes second
      expect(sortedNodes[2].id).toBe('node3');  // Output nodes last
    });
  });
  
  describe('process', () => {
    it('should process all nodes in the correct order', () => {
      nodeProcessor.process(mockProcessContext);
      
      // Verify that all nodes were processed
      Object.values(mockGraph.nodes).forEach(node => {
        expect(node.processed).toBe(true);
      });
      
      // Verify that data flowed correctly through the graph
      expect(mockGraph.nodes.node1.outputs.output1.data).toBe(42);
      expect(mockGraph.nodes.node2.outputs.output1.data).toBe(84); // 42 * 2
      expect(mockGraph.nodes.node3.state.finalValue).toBe(84); // Same as node2 output
    });
    
    it('should handle graph cycles safely', () => {
      // Add a cycle: node3 -> node1
      mockGraph.connections['cycleConn'] = {
        id: 'cycleConn',
        sourceNodeId: 'node3',
        sourcePortId: 'output1',
        targetNodeId: 'node1',
        targetPortId: 'input1'
      };
      
      // Add an output to node3 and input to node1
      mockGraph.nodes.node3.outputs['output1'] = {
        id: 'output1',
        name: 'Output 1',
        type: PortType.FLOAT,
        nodeId: 'node3',
        connections: ['node1-input1'],
        data: 100
      };
      
      mockGraph.nodes.node1.inputs['input1'] = {
        id: 'input1',
        name: 'Input 1',
        type: PortType.FLOAT,
        nodeId: 'node1',
        connected: true
      };
      
      // Re-sort with the cycle
      nodeProcessor.setGraph(mockGraph);
      
      // This should not throw or cause an infinite loop
      nodeProcessor.process(mockProcessContext);
      
      // All nodes should be processed despite the cycle
      Object.values(mockGraph.nodes).forEach(node => {
        expect(node.processed).toBe(true);
      });
    });
    
    it('should handle errors in node processing without crashing the processor', () => {
      // Make one node throw an error during processing
      const nodeRegistryMock = NodeRegistry.getInstance();
      (nodeRegistryMock.getDefinition as jest.Mock).mockImplementation((type) => {
        if (type === 'processNode') {
          return {
            type: 'processNode',
            process: () => {
              throw new Error('Test error in node processing');
            }
          };
        }
        
        // Return normal processors for other nodes
        if (type === 'sourceNode') {
          return {
            type: 'sourceNode',
            process: (node: INode) => {
              node.outputs.output1.data = 42;
            }
          };
        } else if (type === 'outputNode') {
          return {
            type: 'outputNode',
            process: (node: INode) => {
              node.state.finalValue = node.inputs.input1.data;
            }
          };
        }
        return null;
      });
      
      // Should not throw
      nodeProcessor.process(mockProcessContext);
      
      // Other nodes should still be processed
      expect(mockGraph.nodes.node1.processed).toBe(true);
      expect(mockGraph.nodes.node2.processed).toBe(true);
      expect(mockGraph.nodes.node3.processed).toBe(true);
      
      // node1 output should be set, but node2 output should not be set because of the error
      expect(mockGraph.nodes.node1.outputs.output1.data).toBe(42);
      expect(mockGraph.nodes.node2.outputs.output1.data).toBe(null);
    });
  });
  
  describe('topologicalSort', () => {
    it('should sort nodes in correct dependency order', () => {
      // Create an artificial situation with branching dependencies
      // node1 -> node2 -> node4
      //       -> node3 -↗
      mockGraph.nodes['node4'] = {
        id: 'node4',
        type: 'outputNode',
        position: { x: 600, y: 0 },
        inputs: {
          'input1': {
            id: 'input1',
            name: 'Input from node2',
            type: PortType.FLOAT,
            nodeId: 'node4',
            connected: true
          },
          'input2': {
            id: 'input2',
            name: 'Input from node3',
            type: PortType.FLOAT,
            nodeId: 'node4',
            connected: true
          }
        },
        outputs: {},
        params: {},
        state: {},
        processed: false
      };
      
      mockGraph.nodes['node3'] = {
        id: 'node3',
        type: 'processNode',
        position: { x: 400, y: 100 },
        inputs: {
          'input1': {
            id: 'input1',
            name: 'Input 1',
            type: PortType.FLOAT,
            nodeId: 'node3',
            connected: true
          }
        },
        outputs: {
          'output1': {
            id: 'output1',
            name: 'Output 1',
            type: PortType.FLOAT,
            nodeId: 'node3',
            connections: ['node4-input2'],
            data: null
          }
        },
        params: {},
        state: {},
        processed: false
      };
      
      mockGraph.connections['conn3'] = {
        id: 'conn3',
        sourceNodeId: 'node1',
        sourcePortId: 'output1',
        targetNodeId: 'node3',
        targetPortId: 'input1'
      };
      
      mockGraph.connections['conn4'] = {
        id: 'conn4',
        sourceNodeId: 'node2',
        sourcePortId: 'output1',
        targetNodeId: 'node4',
        targetPortId: 'input1'
      };
      
      mockGraph.connections['conn5'] = {
        id: 'conn5',
        sourceNodeId: 'node3',
        sourcePortId: 'output1',
        targetNodeId: 'node4',
        targetPortId: 'input2'
      };
      
      nodeProcessor.setGraph(mockGraph);
      
      const sortedNodes = (nodeProcessor as any).sortedNodes;
      
      // Dependency ordering:
      // Node1 should be early because it has no inputs
      // Node4 should be last because it depends on both Node2 and Node3
      const node1Index = sortedNodes.findIndex(n => n.id === 'node1');
      const node4Index = sortedNodes.findIndex(n => n.id === 'node4');
      
      expect(node1Index).toBeLessThan(node4Index);
      
      // Node2 and Node3 both depend on Node1, so they should be after Node1
      const node2Index = sortedNodes.findIndex(n => n.id === 'node2');
      const node3Index = sortedNodes.findIndex(n => n.id === 'node3');
      
      expect(node1Index).toBeLessThan(node2Index);
      expect(node1Index).toBeLessThan(node3Index);
      
      // Node4 depends on both Node2 and Node3, so it should be after both
      expect(node2Index).toBeLessThan(node4Index);
      expect(node3Index).toBeLessThan(node4Index);
    });
  });
}); 