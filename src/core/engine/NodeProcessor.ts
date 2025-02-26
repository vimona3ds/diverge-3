import { IGraph, INode, ProcessContext, IInputPort, IOutputPort, PortType, PortData } from '../types/node';
import { NodeRegistry } from '../nodes/NodeRegistry';

/**
 * Processes a node graph by executing nodes in topological order
 */
export class NodeProcessor {
  private graph: IGraph;
  private sortedNodes: INode[] = [];
  private nodeRegistry: NodeRegistry;
  
  constructor() {
    this.graph = { nodes: {}, connections: {} };
    this.nodeRegistry = NodeRegistry.getInstance();
  }
  
  /**
   * Set the graph to process
   * @param graph The node graph
   */
  public setGraph(graph: IGraph): void {
    this.graph = graph;
    this.sortedNodes = this.topologicalSort();
  }
  
  /**
   * Process the graph for the current frame
   * @param context The processing context with frame data
   */
  public process(context: ProcessContext): void {
    // Reset processed flag
    for (const node of this.sortedNodes) {
      node.processed = false;
    }
    
    // Process nodes in topological order
    for (const node of this.sortedNodes) {
      this.processNode(node, context);
    }
  }
  
  /**
   * Process a single node and its dependencies
   * @param node The node to process
   * @param context The processing context
   */
  private processNode(node: INode, context: ProcessContext): void {
    if (node.processed) return;
    
    // Process all input nodes first
    for (const [inputId, input] of Object.entries(node.inputs)) {
      if (input.connected) {
        // Find connection to this input
        const connection = Object.values(this.graph.connections).find(c => 
          c.targetNodeId === node.id && c.targetPortId === inputId
        );
        
        if (connection) {
          const sourceNode = this.graph.nodes[connection.sourceNodeId];
          if (sourceNode) {
            // Process source node first to ensure data is available
            this.processNode(sourceNode, context);
            
            // Transfer data from output to input with type checking
            const sourceOutput = sourceNode.outputs[connection.sourcePortId];
            if (sourceOutput && this.arePortsCompatible(sourceOutput, input)) {
              input.data = sourceOutput.data;
            }
          }
        }
      }
    }
    
    // Get node definition and process
    const definition = this.nodeRegistry.getDefinition(node.type);
    if (definition && definition.process) {
      try {
        definition.process(node, context);
      } catch (error) {
        console.error(`Error processing node "${node.type}" (${node.id}):`, error);
      }
    }
    
    node.processed = true;
  }
  
  /**
   * Check if two ports are type compatible for connection
   * @param output The output port
   * @param input The input port
   * @returns Whether the ports are compatible
   */
  private arePortsCompatible(
    output: IOutputPort,
    input: IInputPort
  ): boolean {
    // ANY type can connect to anything
    if (output.type === PortType.ANY || input.type === PortType.ANY) {
      return true;
    }
    
    // Otherwise types must match exactly
    return output.type === input.type;
  }
  
  /**
   * Sort nodes in topological order (dependencies first)
   * @returns Array of nodes in processing order
   */
  private topologicalSort(): INode[] {
    // Mark all nodes as not visited
    const visited = new Set<string>();
    const temp = new Set<string>();
    const order: INode[] = [];
    
    // Visit function for depth-first search
    const visit = (nodeId: string): void => {
      // If node is temporarily marked, we have a cycle
      if (temp.has(nodeId)) {
        console.warn('Cycle detected in node graph, may cause issues');
        return;
      }
      
      // If node is unvisited
      if (!visited.has(nodeId)) {
        // Mark temporarily
        temp.add(nodeId);
        
        // Visit all dependencies (connected inputs)
        const node = this.graph.nodes[nodeId];
        const connections = Object.values(this.graph.connections)
          .filter(c => c.targetNodeId === nodeId);
        
        for (const connection of connections) {
          visit(connection.sourceNodeId);
        }
        
        // Mark as visited
        visited.add(nodeId);
        temp.delete(nodeId);
        
        // Add to sorted order
        order.unshift(node);
      }
    };
    
    // Visit all nodes
    for (const nodeId in this.graph.nodes) {
      if (!visited.has(nodeId)) {
        visit(nodeId);
      }
    }
    
    return order;
  }
} 