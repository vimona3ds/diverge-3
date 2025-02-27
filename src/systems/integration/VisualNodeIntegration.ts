import * as THREE from 'three';
import { IGraph, INode, ProcessContext } from '../../core/types/node';
import { NodeRegistry } from '../../core/nodes/NodeRegistry';
import { MetaballsNode } from '../../core/nodes/definitions/visual/MetaballsNode';
import { ReactionDiffusionNode } from '../../core/nodes/definitions/visual/ReactionDiffusionNode';
import { LeniaNode } from '../../core/nodes/definitions/visual/LeniaNode';
import { FluidSimulationNode } from '../../core/nodes/definitions/visual/FluidSimulationNode';
import { FeedbackLoopNode } from '../../core/nodes/definitions/visual/FeedbackLoopNode';
import { FractalNoiseNode } from '../../core/nodes/definitions/visual/FractalNoiseNode';

/**
 * Interface for visual technique objects with dispose method
 */
interface TechniqueWithDispose {
  dispose: () => void;
}

/**
 * Extended ProcessContext with visual-specific methods
 */
export interface VisualProcessContext extends ProcessContext {
  /**
   * Get data from a connected input port
   * @param nodeId The node ID to get input for
   * @param portId The port ID to get input for
   * @returns The data from the connected output port, or undefined if not connected
   */
  getInputData: (nodeId: string, portId: string) => any;
  
  /**
   * Set data on an output port
   * @param nodeId The node ID to set output for
   * @param portId The port ID to set output for
   * @param data The data to set
   */
  setOutputData: (nodeId: string, portId: string, data: any) => void;
}

/**
 * Integration layer between node system and visual system
 * Handles visual node registration, processing, and resource management
 */
export class VisualNodeIntegration {
  private graph: IGraph | null = null;
  private nodeRegistry: NodeRegistry;
  private outputData: Map<string, Map<string, any>> = new Map();
  
  /**
   * Create a new VisualNodeIntegration instance
   */
  constructor() {
    this.nodeRegistry = NodeRegistry.getInstance();
  }
  
  /**
   * Initialize the visual node integration
   * Registers all visual nodes with the node registry
   */
  public initialize(): void {
    // Register all visual nodes
    this.registerVisualNodes();
  }
  
  /**
   * Register all visual nodes with the node registry
   */
  private registerVisualNodes(): void {
    // Register each visual node definition
    this.nodeRegistry.register(MetaballsNode);
    this.nodeRegistry.register(ReactionDiffusionNode);
    this.nodeRegistry.register(LeniaNode);
    this.nodeRegistry.register(FluidSimulationNode);
    this.nodeRegistry.register(FeedbackLoopNode);
    this.nodeRegistry.register(FractalNoiseNode);
  }
  
  /**
   * Set the current graph
   * @param graph The graph to set
   */
  public setGraph(graph: IGraph): void {
    this.graph = graph;
  }
  
  /**
   * Create an extended process context with visual-specific methods
   * @param context The base process context
   * @returns An extended process context with visual-specific methods
   */
  public createVisualProcessContext(context: ProcessContext): VisualProcessContext {
    // Reset output data for this process cycle
    this.outputData.clear();
    
    // Create extended context with visual-specific methods
    const visualContext: VisualProcessContext = {
      ...context,
      
      // Get input data from a connected output
      getInputData: (nodeId: string, portId: string) => {
        if (!this.graph) return undefined;
        
        // Find the connection that targets this input
        const connection = Object.values(this.graph.connections).find(c => 
          c.targetNodeId === nodeId && c.targetPortId === portId
        );
        
        if (!connection) return undefined;
        
        // Get the source node and port
        const sourceNodeId = connection.sourceNodeId;
        const sourcePortId = connection.sourcePortId;
        
        // Get the data from the output map
        const nodeOutputs = this.outputData.get(sourceNodeId);
        if (!nodeOutputs) return undefined;
        
        return nodeOutputs.get(sourcePortId);
      },
      
      // Set output data for a node
      setOutputData: (nodeId: string, portId: string, data: any) => {
        // Get or create the node's output map
        let nodeOutputs = this.outputData.get(nodeId);
        if (!nodeOutputs) {
          nodeOutputs = new Map();
          this.outputData.set(nodeId, nodeOutputs);
        }
        
        // Set the output data
        nodeOutputs.set(portId, data);
      }
    };
    
    return visualContext;
  }
  
  /**
   * Process all nodes in the graph in topological order
   * @param context The visual process context
   */
  public processNodes(context: VisualProcessContext): void {
    if (!this.graph) return;
    
    // Get a topologically sorted list of nodes
    const sortedNodes = this.topologicalSort();
    
    // Reset processed flag for all nodes
    for (const node of sortedNodes) {
      node.processed = false;
    }
    
    // Process each node in order
    for (const node of sortedNodes) {
      this.processNode(node, context);
    }
  }
  
  /**
   * Process a single node
   * @param node The node to process
   * @param context The visual process context
   */
  private processNode(node: INode, context: VisualProcessContext): void {
    if (node.processed) return;
    
    // Process all input nodes first
    for (const inputId in node.inputs) {
      const input = node.inputs[inputId];
      if (input.connected) {
        // Find connection to this input
        const connection = Object.values(this.graph!.connections).find(c => 
          c.targetNodeId === node.id && c.targetPortId === inputId
        );
        
        if (connection) {
          const sourceNode = this.graph!.nodes[connection.sourceNodeId];
          this.processNode(sourceNode, context);
        }
      }
    }
    
    // Get node definition and process
    const definition = this.nodeRegistry.getDefinition(node.type);
    if (definition && definition.process) {
      // Process the node
      definition.process(node, context);
    }
    
    // Mark as processed
    node.processed = true;
  }
  
  /**
   * Sort nodes topologically for processing order
   * @returns Sorted array of nodes
   */
  private topologicalSort(): INode[] {
    if (!this.graph) return [];
    
    const visited = new Set<string>();
    const temp = new Set<string>();
    const result: INode[] = [];
    
    // Visit function for depth-first search
    const visit = (nodeId: string) => {
      // Skip if already processed
      if (visited.has(nodeId)) return;
      
      // Check for cycles
      if (temp.has(nodeId)) {
        console.warn('Cycle detected in node graph. Processing may be incorrect.');
        return;
      }
      
      // Mark as temporary visited
      temp.add(nodeId);
      
      const node = this.graph!.nodes[nodeId];
      
      // Visit all nodes that depend on outputs from this node
      for (const connectionId in this.graph!.connections) {
        const connection = this.graph!.connections[connectionId];
        if (connection.sourceNodeId === nodeId) {
          visit(connection.targetNodeId);
        }
      }
      
      // Mark as visited and add to result
      temp.delete(nodeId);
      visited.add(nodeId);
      result.unshift(node);
    };
    
    // Visit all nodes
    for (const nodeId in this.graph.nodes) {
      visit(nodeId);
    }
    
    return result;
  }
  
  /**
   * Dispose of all resources
   * Call when the integration is no longer needed
   */
  public dispose(): void {
    if (!this.graph) return;
    
    // Dispose all node techniques
    for (const nodeId in this.graph.nodes) {
      const node = this.graph.nodes[nodeId];
      
      // If the node has a technique with dispose method, call it
      if (node.state && 
          typeof node.state === 'object' && 
          node.state.technique && 
          this.isTechniqueWithDispose(node.state.technique)) {
        node.state.technique.dispose();
      }
    }
    
    // Clear output data
    this.outputData.clear();
    
    // Clear graph reference
    this.graph = null;
  }
  
  /**
   * Type guard to check if an object is a technique with dispose method
   * @param obj Object to check
   * @returns True if the object has a dispose method
   */
  private isTechniqueWithDispose(obj: unknown): obj is TechniqueWithDispose {
    return obj !== null && 
           typeof obj === 'object' && 
           'dispose' in obj && 
           typeof (obj as TechniqueWithDispose).dispose === 'function';
  }
} 