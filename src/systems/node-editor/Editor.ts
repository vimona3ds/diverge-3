import { IGraph, INode, IConnection, INodeDefinition } from '../../core/types/node';
import { NodeFactory } from './NodeFactory';
import { v4 as uuidv4 } from 'uuid';
import { ErrorHandler, ErrorSeverity } from '../../core/utils/ErrorHandler';

export class Editor {
  private graph: IGraph;
  private factory: NodeFactory;
  private onGraphChangeCallbacks: Array<(graph: IGraph) => void> = [];
  private errorHandler: ErrorHandler;
  
  constructor() {
    this.graph = { nodes: {}, connections: {} };
    this.factory = new NodeFactory();
    this.errorHandler = ErrorHandler.getInstance();
  }
  
  public getGraph(): IGraph {
    return this.graph;
  }
  
  public createNode(type: string, position: { x: number, y: number }): INode | null {
    try {
      const node = this.factory.createNode(type, position);
      if (!node) return null;
      
      // Add to graph
      this.graph.nodes[node.id] = node;
      this.notifyGraphChange();
      
      return node;
    } catch (error) {
      this.errorHandler.report(
        `Failed to create node of type "${type}"`, 
        'NodeEditor',
        ErrorSeverity.ERROR,
        error instanceof Error ? error.message : String(error),
        error
      );
      return null;
    }
  }
  
  public deleteNode(nodeId: string): void {
    if (!this.graph.nodes[nodeId]) return;
    
    // Delete all connections to/from this node
    for (const connId in this.graph.connections) {
      const conn = this.graph.connections[connId];
      if (conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId) {
        this.deleteConnection(connId);
      }
    }
    
    // Delete the node
    delete this.graph.nodes[nodeId];
    this.notifyGraphChange();
  }
  
  public createConnection(
    sourceNodeId: string, 
    sourcePortId: string, 
    targetNodeId: string, 
    targetPortId: string
  ): IConnection | null {
    // Validate source and target
    const sourceNode = this.graph.nodes[sourceNodeId];
    const targetNode = this.graph.nodes[targetNodeId];
    
    if (!sourceNode || !targetNode) {
      this.errorHandler.report(
        'Source or target node not found',
        'NodeEditor',
        ErrorSeverity.WARNING
      );
      return null;
    }
    
    const sourcePort = sourceNode.outputs[sourcePortId];
    const targetPort = targetNode.inputs[targetPortId];
    
    if (!sourcePort || !targetPort) {
      this.errorHandler.report(
        'Source or target port not found',
        'NodeEditor',
        ErrorSeverity.WARNING
      );
      return null;
    }
    
    // Check if types are compatible
    if (sourcePort.type !== targetPort.type && 
        sourcePort.type !== 'any' && 
        targetPort.type !== 'any') {
      this.errorHandler.report(
        `Incompatible port types: ${sourcePort.type} -> ${targetPort.type}`,
        'NodeEditor',
        ErrorSeverity.WARNING
      );
      return null;
    }
    
    // Check if target port is already connected and doesn't allow multiple
    if (targetPort.connected && !targetPort.allowMultiple) {
      // Remove existing connection to this input
      for (const connId in this.graph.connections) {
        const conn = this.graph.connections[connId];
        if (conn.targetNodeId === targetNodeId && conn.targetPortId === targetPortId) {
          this.deleteConnection(connId);
          break;
        }
      }
    }
    
    // Create new connection
    const connection: IConnection = {
      id: uuidv4(),
      sourceNodeId,
      sourcePortId,
      targetNodeId,
      targetPortId
    };
    
    // Update connection status
    sourcePort.connections.push(connection.id);
    targetPort.connected = true;
    
    // Add to graph
    this.graph.connections[connection.id] = connection;
    this.notifyGraphChange();
    
    return connection;
  }
  
  public deleteConnection(connectionId: string): void {
    const connection = this.graph.connections[connectionId];
    if (!connection) return;
    
    // Update source port
    const sourceNode = this.graph.nodes[connection.sourceNodeId];
    if (sourceNode) {
      const sourcePort = sourceNode.outputs[connection.sourcePortId];
      if (sourcePort) {
        sourcePort.connections = sourcePort.connections.filter(id => id !== connectionId);
      }
    }
    
    // Update target port
    const targetNode = this.graph.nodes[connection.targetNodeId];
    if (targetNode) {
      const targetPort = targetNode.inputs[connection.targetPortId];
      if (targetPort) {
        // Check if this is the last connection to this port
        let hasOtherConnections = false;
        for (const connId in this.graph.connections) {
          if (connId !== connectionId) {
            const conn = this.graph.connections[connId];
            if (conn.targetNodeId === connection.targetNodeId && 
                conn.targetPortId === connection.targetPortId) {
              hasOtherConnections = true;
              break;
            }
          }
        }
        
        if (!hasOtherConnections) {
          targetPort.connected = false;
          targetPort.data = undefined;
        }
      }
    }
    
    // Delete connection
    delete this.graph.connections[connectionId];
    this.notifyGraphChange();
  }
  
  public updateNodePosition(nodeId: string, position: { x: number, y: number }): void {
    const node = this.graph.nodes[nodeId];
    if (!node) return;
    
    node.position = { ...position };
    this.notifyGraphChange();
  }
  
  public updateNodeParam(nodeId: string, paramId: string, value: any): void {
    const node = this.graph.nodes[nodeId];
    if (!node) return;
    
    node.params[paramId] = value;
    this.notifyGraphChange();
  }
  
  public onGraphChange(callback: (graph: IGraph) => void): () => void {
    this.onGraphChangeCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.onGraphChangeCallbacks = this.onGraphChangeCallbacks.filter(cb => cb !== callback);
    };
  }
  
  private notifyGraphChange(): void {
    // Create a deep copy to prevent direct mutation
    const graphCopy = JSON.parse(JSON.stringify(this.graph));
    this.onGraphChangeCallbacks.forEach(callback => callback(graphCopy));
  }
  
  public clear(): void {
    this.graph = { nodes: {}, connections: {} };
    this.notifyGraphChange();
  }
  
  public loadGraph(graph: IGraph): void {
    this.graph = JSON.parse(JSON.stringify(graph));
    this.notifyGraphChange();
  }
  
  public exportGraph(): string {
    return JSON.stringify(this.graph);
  }
} 