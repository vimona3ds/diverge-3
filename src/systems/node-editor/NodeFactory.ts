import { INode, INodeDefinition, IInputPort, IOutputPort } from '../../core/types/node';
import { NodeRegistry } from '../../core/nodes/NodeRegistry';
import { v4 as uuidv4 } from 'uuid';

export class NodeFactory {
  private registry: NodeRegistry;
  
  constructor() {
    this.registry = NodeRegistry.getInstance();
  }
  
  /**
   * Create a new node instance of the specified type
   * @param type The node type to create
   * @param position The position of the node in the editor
   * @returns A new node instance or null if the type doesn't exist
   */
  public createNode(type: string, position: { x: number, y: number }): INode | null {
    const definition = this.registry.getDefinition(type);
    if (!definition) {
      console.error(`Node definition for type "${type}" not found`);
      return null;
    }
    
    // Create node instance
    const node: INode = {
      id: uuidv4(),
      type,
      position: { ...position },
      inputs: {},
      outputs: {},
      params: {},
      state: {},
      processed: false
    };
    
    // Set up inputs
    for (const input of definition.inputs) {
      node.inputs[input.id] = {
        ...input,
        nodeId: node.id,
        connected: false
      };
    }
    
    // Set up outputs
    for (const output of definition.outputs) {
      node.outputs[output.id] = {
        ...output,
        nodeId: node.id,
        connections: []
      };
    }
    
    // Set default params
    for (const param of definition.params) {
      node.params[param.id] = param.defaultValue;
    }
    
    // Initialize the node
    if (definition.initialize) {
      definition.initialize(node);
    }
    
    return node;
  }
  
  private cloneInputPort(port: IInputPort): IInputPort {
    return {
      id: port.id,
      name: port.name,
      type: port.type,
      nodeId: port.nodeId,
      data: port.data,
      connected: false,
      defaultValue: port.defaultValue,
      allowMultiple: port.allowMultiple
    };
  }
  
  private cloneOutputPort(port: IOutputPort): IOutputPort {
    return {
      id: port.id,
      name: port.name,
      type: port.type,
      nodeId: port.nodeId,
      data: port.data,
      connections: [],
      allowMultiple: port.allowMultiple
    };
  }
} 