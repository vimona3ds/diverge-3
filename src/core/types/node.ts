import * as THREE from 'three';

export enum PortType {
  FLOAT = 'float',
  INT = 'int',
  VECTOR2 = 'vector2',
  VECTOR3 = 'vector3',
  COLOR = 'color',
  TEXTURE = 'texture',
  AUDIO_PARAM = 'audioParam',
  AUDIO_BUFFER = 'audioBuffer',
  AUDIO_NODE = 'audioNode',
  TRIGGER = 'trigger',
  ANY = 'any'
}

export interface IPort {
  id: string;
  name: string;
  type: PortType;
  nodeId: string;
  data?: any;
  allowMultiple?: boolean; // Can connect to multiple outputs
}

export interface IInputPort extends IPort {
  connected: boolean;
  defaultValue?: any;
}

export interface IOutputPort extends IPort {
  connections: string[]; // IDs of input ports this connects to
}

export interface INodeDefinition {
  type: string;
  category: 'source' | 'process' | 'parameter' | 'bridge' | 'output';
  system: 'visual' | 'audio' | 'bridge' | 'utility';
  inputs: IInputPort[];
  outputs: IOutputPort[];
  params: INodeParam[];
  initialize: (node: INode) => void;
  process: (node: INode, context: ProcessContext) => void;
}

export interface INodeParam {
  id: string;
  name: string;
  type: 'float' | 'int' | 'boolean' | 'string' | 'select' | 'color';
  defaultValue: any;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{label: string, value: any}>;
}

export interface INode {
  id: string;
  type: string;
  position: {x: number, y: number};
  inputs: Record<string, IInputPort>;
  outputs: Record<string, IOutputPort>;
  params: Record<string, any>;
  state: Record<string, any>; // Internal node state
  processed: boolean; // For topological sort
}

export interface IConnection {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}

export interface IGraph {
  nodes: Record<string, INode>;
  connections: Record<string, IConnection>;
}

export interface ProcessContext {
  time: number;
  deltaTime: number;
  frame: number;
  renderer: THREE.WebGLRenderer;
  audioContext: AudioContext;
  assets: any; // AssetManager
} 