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

export type PortData = {
  [PortType.FLOAT]: number;
  [PortType.INT]: number;
  [PortType.VECTOR2]: THREE.Vector2;
  [PortType.VECTOR3]: THREE.Vector3;
  [PortType.COLOR]: THREE.Color;
  [PortType.TEXTURE]: THREE.Texture;
  [PortType.AUDIO_PARAM]: AudioParam;
  [PortType.AUDIO_BUFFER]: AudioBuffer;
  [PortType.AUDIO_NODE]: AudioNode;
  [PortType.TRIGGER]: boolean;
  [PortType.ANY]: unknown;
};

export interface IPort<T extends PortType = PortType> {
  id: string;
  name: string;
  type: T;
  nodeId: string;
  data?: PortData[T];
  allowMultiple?: boolean;
}

export interface IInputPort<T extends PortType = PortType> extends IPort<T> {
  connected: boolean;
  defaultValue?: PortData[T];
}

export interface IOutputPort<T extends PortType = PortType> extends IPort<T> {
  connections: string[];
}

export interface INodeDefinition {
  type: string;
  category: 'source' | 'process' | 'parameter' | 'bridge' | 'output';
  system: 'visual' | 'audio' | 'bridge' | 'utility';
  inputs: Array<Omit<IInputPort, 'nodeId' | 'data' | 'connected'>>;
  outputs: Array<Omit<IOutputPort, 'nodeId' | 'data' | 'connections'>>;
  params: INodeParam[];
  initialize: (node: INode) => void;
  process: (node: INode, context: ProcessContext) => void;
}

export type ParamType = 'float' | 'int' | 'boolean' | 'string' | 'select' | 'color';

export type ParamValue<T extends ParamType> = 
  T extends 'float' ? number :
  T extends 'int' ? number :
  T extends 'boolean' ? boolean :
  T extends 'string' ? string :
  T extends 'select' ? string | number :
  T extends 'color' ? THREE.Color :
  never;

export interface INodeParam<T extends ParamType = ParamType> {
  id: string;
  name: string;
  type: T;
  defaultValue: ParamValue<T>;
  min?: T extends ('float' | 'int') ? number : never;
  max?: T extends ('float' | 'int') ? number : never;
  step?: T extends ('float' | 'int') ? number : never;
  options?: T extends 'select' ? Array<{label: string, value: ParamValue<T>}> : never;
}

export interface INode {
  id: string;
  type: string;
  position: {x: number, y: number};
  inputs: Record<string, IInputPort>;
  outputs: Record<string, IOutputPort>;
  params: Record<string, ParamValue<ParamType>>;
  state: Record<string, unknown>;
  processed: boolean;
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
  assets: Record<string, unknown>;
} 