# Audiovisual Node Playground: Implementation Guide for Engineers

## 1. Project Structure & Organization

### 1.1 Directory Structure
```
/src
  /components           # React components
    /ui                 # Reusable UI components
    /nodes              # Node-specific components
    /viewport           # Rendering viewport components
  /core
    /engine             # Core processing engine
    /nodes              # Node definitions and logic
    /types              # TypeScript type definitions
    /utils              # Utility functions
  /systems
    /node-editor        # Node editor implementation
    /visual             # Visual processing system
    /audio              # Audio processing system
    /bridge             # Visual-audio bridge
  /services             # Service layer
    /scheduler          # Frame scheduling
    /asset-manager      # Asset loading/management
    /state              # Application state
  /shaders              # GLSL shader code
    /chunks             # Reusable shader chunks
    /techniques         # Technique-specific shaders
  /workers              # Web Workers
  /worklets             # Audio Worklets
  /styles               # Global styles
  index.tsx             # Entry point
```

### 1.2 Key Files Overview

```
/src/core/engine/Engine.ts       # Main engine orchestrator
/src/core/nodes/NodeRegistry.ts  # Node type registration
/src/systems/node-editor/Editor.ts # Node editor implementation
/src/systems/visual/Renderer.ts  # THREE.js renderer setup
/src/systems/audio/AudioSystem.ts # Web Audio API setup
```

## 2. Type System & Core Interfaces

### 2.1 Node System Types

```typescript
// src/core/types/node.ts

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
  assets: AssetManager;
}
```

### 2.2 Visual System Types

```typescript
// src/core/types/visual.ts

export interface IRenderTarget {
  id: string;
  target: THREE.WebGLRenderTarget;
  width: number;
  height: number;
  format: THREE.PixelFormat;
  type: THREE.TextureDataType;
}

export interface IShaderMaterial extends THREE.ShaderMaterial {
  uniforms: {
    [key: string]: {
      value: any;
      type: string;
      update?: (time: number, deltaTime: number) => void;
    }
  }
}

export interface IVisualTechnique {
  id: string;
  name: string;
  initialize: (renderer: THREE.WebGLRenderer) => void;
  createMaterial: (params: any) => IShaderMaterial;
  getUniformUpdaters: (params: any) => Record<string, (time: number, deltaTime: number) => void>;
  render: (renderer: THREE.WebGLRenderer, target?: THREE.WebGLRenderTarget) => void;
  dispose: () => void;
}

export interface IPixelDataExtractor {
  extract: (renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget) => Float32Array;
  setup: (width: number, height: number, format: THREE.PixelFormat) => void;
}
```

### 2.3 Audio System Types

```typescript
// src/core/types/audio.ts

export interface IAudioNode {
  id: string;
  node: AudioNode;
  params: Record<string, AudioParam>;
  connect: (target: IAudioNode) => void;
  disconnect: (target?: IAudioNode) => void;
  dispose: () => void;
}

export interface IAudioProcessor {
  id: string;
  name: string;
  createNode: (audioContext: AudioContext, params: any) => IAudioNode;
  updateParams: (node: IAudioNode, params: any) => void;
}

export interface IAudioWorkletProcessor {
  id: string;
  name: string;
  processorPath: string;
  initialize: (audioContext: AudioContext) => Promise<void>;
  createNode: (audioContext: AudioContext, params: any) => AudioWorkletNode;
}

export interface ISamplePlayer {
  id: string;
  buffer: AudioBuffer;
  play: (options: {
    time?: number,
    offset?: number,
    duration?: number,
    playbackRate?: number,
    loop?: boolean
  }) => AudioBufferSourceNode;
  stop: (time?: number) => void;
}

export interface IVisualAudioBridge {
  id: string;
  connect: (extractor: IPixelDataExtractor, audioParams: AudioParam[]) => void;
  process: (time: number, deltaTime: number) => void;
  dispose: () => void;
}
```

## 3. Core Classes Implementation

### 3.1 Engine Orchestrator

```typescript
// src/core/engine/Engine.ts

import { ProcessContext, IGraph } from '../types/node';
import { NodeProcessor } from './NodeProcessor';
import { VisualSystem } from '../../systems/visual/VisualSystem';
import { AudioSystem } from '../../systems/audio/AudioSystem';
import { AssetManager } from '../../services/asset-manager/AssetManager';
import { Scheduler } from '../../services/scheduler/Scheduler';

export class Engine {
  private graph: IGraph;
  private nodeProcessor: NodeProcessor;
  private visualSystem: VisualSystem;
  private audioSystem: AudioSystem;
  private assetManager: AssetManager;
  private scheduler: Scheduler;
  private running: boolean = false;
  private lastTime: number = 0;
  private frameCount: number = 0;
  
  constructor() {
    this.graph = { nodes: {}, connections: {} };
    this.visualSystem = new VisualSystem();
    this.audioSystem = new AudioSystem();
    this.assetManager = new AssetManager();
    this.nodeProcessor = new NodeProcessor();
    this.scheduler = new Scheduler();
    
    // Initialize systems after audio context is created from user gesture
    this.initialize = this.initialize.bind(this);
    this.update = this.update.bind(this);
  }
  
  public async initialize(): Promise<void> {
    await this.audioSystem.initialize();
    await this.visualSystem.initialize(document.getElementById('viewport'));
    this.scheduler.setCallback(this.update);
  }
  
  public setGraph(graph: IGraph): void {
    this.graph = graph;
    this.nodeProcessor.setGraph(graph);
  }
  
  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.scheduler.start();
  }
  
  public stop(): void {
    if (!this.running) return;
    this.running = false;
    this.scheduler.stop();
  }
  
  private update(time: number): void {
    const deltaTime = time - this.lastTime;
    this.lastTime = time;
    this.frameCount++;
    
    const context: ProcessContext = {
      time,
      deltaTime,
      frame: this.frameCount,
      renderer: this.visualSystem.getRenderer(),
      audioContext: this.audioSystem.getContext(),
      assets: this.assetManager
    };
    
    // Process node graph
    this.nodeProcessor.process(context);
    
    // Update visual system based on processed nodes
    this.visualSystem.update(time, deltaTime);
    
    // Extract data for audio from visuals if needed
    const visualData = this.visualSystem.extractData();
    
    // Update audio system
    this.audioSystem.update(time, deltaTime, visualData);
  }
  
  public dispose(): void {
    this.stop();
    this.visualSystem.dispose();
    this.audioSystem.dispose();
    this.assetManager.dispose();
  }
}
```

### 3.2 Node Processor

```typescript
// src/core/engine/NodeProcessor.ts

import { IGraph, INode, ProcessContext } from '../types/node';
import { NodeRegistry } from '../nodes/NodeRegistry';

export class NodeProcessor {
  private graph: IGraph;
  private sortedNodes: INode[] = [];
  private nodeRegistry: NodeRegistry;
  
  constructor() {
    this.nodeRegistry = NodeRegistry.getInstance();
  }
  
  public setGraph(graph: IGraph): void {
    this.graph = graph;
    this.sortedNodes = this.topologicalSort();
  }
  
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
  
  private processNode(node: INode, context: ProcessContext): void {
    if (node.processed) return;
    
    // Process all input nodes first
    for (const inputId in node.inputs) {
      const input = node.inputs[inputId];
      if (input.connected) {
        // Find connection to this input
        const connection = Object.values(this.graph.connections).find(c => 
          c.targetNodeId === node.id && c.targetPortId === inputId
        );
        
        if (connection) {
          const sourceNode = this.graph.nodes[connection.sourceNodeId];
          this.processNode(sourceNode, context);
          
          // Transfer data from output to input
          const sourceOutput = sourceNode.outputs[connection.sourcePortId];
          input.data = sourceOutput.data;
        }
      }
    }
    
    // Get node definition and process
    const definition = this.nodeRegistry.getDefinition(node.type);
    if (definition && definition.process) {
      definition.process(node, context);
    }
    
    node.processed = true;
  }
  
  private topologicalSort(): INode[] {
    // Mark all nodes as not visited
    const visited: Record<string, boolean> = {};
    const temp: Record<string, boolean> = {};
    const order: INode[] = [];
    
    // Visit function for depth-first search
    const visit = (nodeId: string) => {
      // If node is temporarily marked, we have a cycle
      if (temp[nodeId]) {
        console.warn('Cycle detected in node graph, may cause issues');
        return;
      }
      
      // If node is unvisited
      if (!visited[nodeId]) {
        // Mark temporarily
        temp[nodeId] = true;
        
        // Visit all dependencies (connected inputs)
        const node = this.graph.nodes[nodeId];
        const connections = Object.values(this.graph.connections)
          .filter(c => c.targetNodeId === nodeId);
        
        for (const connection of connections) {
          visit(connection.sourceNodeId);
        }
        
        // Mark as visited
        visited[nodeId] = true;
        temp[nodeId] = false;
        
        // Add to sorted order
        order.unshift(node);
      }
    };
    
    // Visit all nodes
    for (const nodeId in this.graph.nodes) {
      if (!visited[nodeId]) {
        visit(nodeId);
      }
    }
    
    return order;
  }
}
```

## 4. Visual System Implementation

### 4.1 Renderer Setup

```typescript
// src/systems/visual/Renderer.ts

import * as THREE from 'three';
import { IRenderTarget } from '../../core/types/visual';

export class Renderer {
  private renderer: THREE.WebGLRenderer;
  private mainScene: THREE.Scene;
  private mainCamera: THREE.OrthographicCamera;
  private renderTargets: Map<string, IRenderTarget> = new Map();
  private renderTargetPool: THREE.WebGLRenderTarget[] = [];
  
  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    // Setup orthographic camera for 2D rendering
    this.mainCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.mainCamera.position.z = 1;
    
    // Setup main scene with a full-screen quad
    this.mainScene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const quad = new THREE.Mesh(geometry, material);
    this.mainScene.add(quad);
    
    // Setup resize handler
    window.addEventListener('resize', this.handleResize.bind(this));
  }
  
  public initialize(container: HTMLElement): void {
    container.appendChild(this.renderer.domElement);
  }
  
  public createRenderTarget(id: string, width: number, height: number, options: {
    format?: THREE.PixelFormat,
    type?: THREE.TextureDataType,
    minFilter?: THREE.TextureFilter,
    magFilter?: THREE.TextureFilter
  } = {}): IRenderTarget {
    // Try to reuse from pool
    let target = this.renderTargetPool.pop();
    
    if (!target || target.width !== width || target.height !== height) {
      target = new THREE.WebGLRenderTarget(width, height, {
        format: options.format || THREE.RGBAFormat,
        type: options.type || THREE.UnsignedByteType,
        minFilter: options.minFilter || THREE.LinearFilter,
        magFilter: options.magFilter || THREE.LinearFilter
      });
    }
    
    const renderTarget: IRenderTarget = {
      id,
      target,
      width,
      height,
      format: options.format || THREE.RGBAFormat,
      type: options.type || THREE.UnsignedByteType
    };
    
    this.renderTargets.set(id, renderTarget);
    return renderTarget;
  }
  
  public getRenderTarget(id: string): IRenderTarget | undefined {
    return this.renderTargets.get(id);
  }
  
  public releaseRenderTarget(id: string): void {
    const rt = this.renderTargets.get(id);
    if (rt) {
      this.renderTargetPool.push(rt.target);
      this.renderTargets.delete(id);
    }
  }
  
  public render(scene: THREE.Scene, camera: THREE.Camera, target?: THREE.WebGLRenderTarget): void {
    this.renderer.setRenderTarget(target || null);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
  }
  
  public renderToScreen(material: THREE.Material): void {
    (this.mainScene.children[0] as THREE.Mesh).material = material;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.mainScene, this.mainCamera);
  }
  
  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }
  
  public readPixels(target: THREE.WebGLRenderTarget, x: number, y: number, width: number, height: number, format: THREE.PixelFormat, type: THREE.PixelDataType): Float32Array | Uint8Array {
    const buffer = type === THREE.FloatType ? 
      new Float32Array(width * height * 4) : 
      new Uint8Array(width * height * 4);
    
    this.renderer.readRenderTargetPixels(
      target, x, y, width, height, buffer
    );
    
    return buffer;
  }
  
  private handleResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  public dispose(): void {
    window.removeEventListener('resize', this.handleResize.bind(this));
    
    // Dispose all render targets
    this.renderTargets.forEach(rt => rt.target.dispose());
    this.renderTargetPool.forEach(rt => rt.dispose());
    
    this.renderer.dispose();
    (this.mainScene.children[0] as THREE.Mesh).geometry.dispose();
    (this.mainScene.children[0] as THREE.Mesh).material.dispose();
  }
}
```

### 4.2 Technique Implementation Example (Metaballs)

```typescript
// src/systems/visual/techniques/MetaballTechnique.ts

import * as THREE from 'three';
import { IVisualTechnique, IShaderMaterial } from '../../../core/types/visual';
import metaballVertexShader from '../../../shaders/techniques/metaball.vert';
import metaballFragmentShader from '../../../shaders/techniques/metaball.frag';

export interface IMetaball {
  position: THREE.Vector2;
  radius: number;
  strength: number;
}

export interface MetaballParams {
  metaballs: IMetaball[];
  threshold: number;
  colorMapping: 'grayscale' | 'heatmap' | 'custom';
  customColorA: THREE.Color;
  customColorB: THREE.Color;
}

export class MetaballTechnique implements IVisualTechnique {
  public id: string;
  public name: string = 'Metaballs';
  
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private material: IShaderMaterial;
  private mesh: THREE.Mesh;
  
  constructor(id: string) {
    this.id = id;
    
    // Create a scene with a quad
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;
    
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.material = this.createMaterial({
      metaballs: [],
      threshold: 1.0,
      colorMapping: 'grayscale',
      customColorA: new THREE.Color(0x000000),
      customColorB: new THREE.Color(0xffffff)
    });
    
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);
  }
  
  public initialize(renderer: THREE.WebGLRenderer): void {
    // Nothing specific needed for initialization
  }
  
  public createMaterial(params: MetaballParams): IShaderMaterial {
    const MAX_METABALLS = 16; // Shader constant limit
    
    // Create arrays for shader
    const positions = new Float32Array(MAX_METABALLS * 2);
    const radii = new Float32Array(MAX_METABALLS);
    const strengths = new Float32Array(MAX_METABALLS);
    
    // Fill arrays with initial values
    for (let i = 0; i < MAX_METABALLS; i++) {
      if (i < params.metaballs.length) {
        positions[i*2] = params.metaballs[i].position.x;
        positions[i*2+1] = params.metaballs[i].position.y;
        radii[i] = params.metaballs[i].radius;
        strengths[i] = params.metaballs[i].strength;
      } else {
        // Default values for unused slots
        positions[i*2] = 0;
        positions[i*2+1] = 0;
        radii[i] = 0;
        strengths[i] = 0;
      }
    }
    
    const material = new THREE.ShaderMaterial({
      vertexShader: metaballVertexShader,
      fragmentShader: metaballFragmentShader,
      uniforms: {
        u_resolution: { value: new THREE.Vector2(1, 1), type: 'v2' },
        u_positions: { value: positions, type: 'float32array' },
        u_radii: { value: radii, type: 'float32array' },
        u_strengths: { value: strengths, type: 'float32array' },
        u_count: { value: params.metaballs.length, type: 'int' },
        u_threshold: { value: params.threshold, type: 'float' },
        u_colorMapping: { value: params.colorMapping === 'grayscale' ? 0 : 
                                params.colorMapping === 'heatmap' ? 1 : 2, type: 'int' },
        u_colorA: { value: params.customColorA, type: 'v3' },
        u_colorB: { value: params.customColorB, type: 'v3' },
        u_time: { value: 0.0, type: 'float', 
                 update: (time: number) => { return time / 1000.0; } }
      }
    }) as IShaderMaterial;
    
    return material;
  }
  
  public getUniformUpdaters(params: MetaballParams): Record<string, (time: number, deltaTime: number) => void> {
    return {
      u_time: (time: number, deltaTime: number) => time / 1000.0
    };
  }
  
  public updateParams(params: MetaballParams): void {
    const MAX_METABALLS = 16;
    
    // Update uniforms
    this.material.uniforms.u_threshold.value = params.threshold;
    this.material.uniforms.u_colorMapping.value = params.colorMapping === 'grayscale' ? 0 : 
                                                 params.colorMapping === 'heatmap' ? 1 : 2;
    this.material.uniforms.u_colorA.value = params.customColorA;
    this.material.uniforms.u_colorB.value = params.customColorB;
    this.material.uniforms.u_count.value = Math.min(params.metaballs.length, MAX_METABALLS);
    
    // Update metaball arrays
    const positions = this.material.uniforms.u_positions.value;
    const radii = this.material.uniforms.u_radii.value;
    const strengths = this.material.uniforms.u_strengths.value;
    
    for (let i = 0; i < MAX_METABALLS; i++) {
      if (i < params.metaballs.length) {
        positions[i*2] = params.metaballs[i].position.x;
        positions[i*2+1] = params.metaballs[i].position.y;
        radii[i] = params.metaballs[i].radius;
        strengths[i] = params.metaballs[i].strength;
      } else {
        // Zero out unused metaballs
        positions[i*2] = 0;
        positions[i*2+1] = 0;
        radii[i] = 0;
        strengths[i] = 0;
      }
    }
  }
  
  public render(renderer: THREE.WebGLRenderer, target?: THREE.WebGLRenderTarget): void {
    // Update resolution uniform
    this.material.uniforms.u_resolution.value.set(
      renderer.domElement.width,
      renderer.domElement.height
    );
    
    // Render the scene
    renderer.setRenderTarget(target || null);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(null);
  }
  
  public dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
```

### 4.3 Example Shader Files

```glsl
// src/shaders/techniques/metaball.vert
attribute vec3 position;
attribute vec2 uv;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
```

```glsl
// src/shaders/techniques/metaball.frag
precision highp float;

uniform vec2 u_resolution;
uniform float u_positions[32]; // x,y pairs, so 16 metaballs
uniform float u_radii[16];
uniform float u_strengths[16];
uniform int u_count;
uniform float u_threshold;
uniform int u_colorMapping;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform float u_time;

varying vec2 vUv;

// Utility function to convert from UV to pixel coordinates
vec2 pixelCoord() {
  return vUv * u_resolution;
}

// Color mapping functions
vec3 heatMap(float t) {
  vec3 c1 = vec3(0.0, 0.0, 1.0);
  vec3 c2 = vec3(1.0, 0.0, 0.0);
  return mix(c1, c2, t);
}

void main() {
  vec2 uv = vUv;
  vec2 p = pixelCoord();
  
  // Calculate metaball field
  float field = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i >= u_count) break;
    
    vec2 center = vec2(u_positions[i*2], u_positions[i*2+1]);
    float radius = u_radii[i];
    float strength = u_strengths[i];
    
    // Convert positions to screen space
    vec2 metaballPos = center * u_resolution;
    
    // Calculate distance squared
    float d2 = distance(p, metaballPos);
    d2 = d2 * d2;
    
    // Inverse square falloff with strength factor
    field += (strength * radius * radius) / (d2 + 0.000001);
  }
  
  // Threshold and smooth edge
  float intensity = smoothstep(u_threshold, u_threshold * 1.1, field);
  
  // Apply color mapping
  vec3 color;
  if (u_colorMapping == 0) {
    // Grayscale
    color = vec3(intensity);
  } else if (u_colorMapping == 1) {
    // Heatmap
    color = heatMap(intensity);
  } else {
    // Custom colors
    color = mix(u_colorA, u_colorB, intensity);
  }
  
  gl_FragColor = vec4(color, 1.0);
}
```

## 5. Audio System Implementation

### 5.1 Audio Context Setup

```typescript
// src/systems/audio/AudioSystem.ts

import { IAudioNode, IAudioProcessor, IAudioWorkletProcessor } from '../../core/types/audio';
import { AudioNodeRegistry } from './AudioNodeRegistry';

export class AudioSystem {
  private audioContext: AudioContext | null = null;
  private initialized: boolean = false;
  private nodes: Map<string, IAudioNode> = new Map();
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private workletProcessors: Map<string, IAudioWorkletProcessor> = new Map();
  private registry: AudioNodeRegistry;
  
  constructor() {
    this.registry = AudioNodeRegistry.getInstance();
  }
  
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create master gain
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.audioContext.destination);
      
      // Create analyser
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.connect(this.masterGain);
      
      // Register all processors
      await this.registerProcessors();
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize audio system:', error);
      throw error;
    }
  }
  
  private async registerProcessors(): Promise<void> {
    if (!this.audioContext) return;
    
    // Register builtin AudioWorklet processors
    const processorPaths = [
      { id: 'noise-generator', path: '/worklets/noise-generator.js' },
      { id: 'grain-processor', path: '/worklets/grain-processor.js' }
    ];
    
    for (const { id, path } of processorPaths) {
      try {
        await this.audioContext.audioWorklet.addModule(path);
        this.workletProcessors.set(id, {
          id,
          name: id,
          processorPath: path,
          initialize: async (ctx) => {
            await ctx.audioWorklet.addModule(path);
          },
          createNode: (ctx, params) => {
            return new AudioWorkletNode(ctx, id, params);
          }
        });
      } catch (error) {
        console.error(`Failed to load AudioWorklet module ${id}:`, error);
      }
    }
  }
  
  public getContext(): AudioContext {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }
    return this.audioContext;
  }
  
  public createAudioNode(type: string, params: any = {}): IAudioNode | null {
    if (!this.audioContext || !this.initialized) {
      console.error('Audio system not initialized');
      return null;
    }
    
    try {
      const processor = this.registry.getProcessor(type);
      if (!processor) {
        console.error(`Audio processor "${type}" not found`);
        return null;
      }
      
      const node = processor.createNode(this.audioContext, params);
      this.nodes.set(node.id, node);
      return node;
    } catch (error) {
      console.error(`Failed to create audio node of type "${type}":`, error);
      return null;
    }
  }
  
  public connectToMaster(node: IAudioNode): void {
    if (!this.masterGain) return;
    
    try {
      node.connect({ 
        id: 'master', 
        node: this.masterGain, 
        params: { gain: this.masterGain.gain },
        connect: () => {},
        disconnect: () => {},
        dispose: () => {}
      });
    } catch (error) {
      console.error('Failed to connect node to master:', error);
    }
  }
  
  public update(time: number, deltaTime: number, visualData?: any): void {
    // Process any audio updates that need to happen per frame
    // This could include updating audio parameters based on visual data
    if (visualData) {
      // Map visual data to audio parameters
    }
  }
  
  public dispose(): void {
    // Clean up all audio nodes
    this.nodes.forEach(node => node.dispose());
    this.nodes.clear();
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}
```

### 5.2 Audio Worklet Example

```javascript
// public/worklets/noise-generator.js

class NoiseGenerator extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this.noiseType = options.processorOptions?.type || 'white';
    this.lastOutput = 0;
    
    // For pink noise
    this.pinkNoise = new Array(7).fill(0);
    
    // For brown noise
    this.brownNoise = 0;
  }
  
  generateWhiteNoise() {
    return Math.random() * 2 - 1;
  }
  
  generatePinkNoise() {
    let b0, b1, b2, b3, b4, b5, b6;
    let white = this.generateWhiteNoise();
    
    this.pinkNoise[0] = 0.99886 * this.pinkNoise[0] + white * 0.0555179;
    this.pinkNoise[1] = 0.99332 * this.pinkNoise[1] + white * 0.0750759;
    this.pinkNoise[2] = 0.96900 * this.pinkNoise[2] + white * 0.1538520;
    this.pinkNoise[3] = 0.86650 * this.pinkNoise[3] + white * 0.3104856;
    this.pinkNoise[4] = 0.55000 * this.pinkNoise[4] + white * 0.5329522;
    this.pinkNoise[5] = -0.7616 * this.pinkNoise[5] + white * 0.0168980;
    
    return (this.pinkNoise[0] + this.pinkNoise[1] + this.pinkNoise[2] + 
            this.pinkNoise[3] + this.pinkNoise[4] + this.pinkNoise[5]) * 0.11;
  }
  
  generateBrownNoise() {
    const white = this.generateWhiteNoise();
    this.brownNoise = (this.brownNoise + (0.02 * white)) / 1.02;
    return this.brownNoise * 3.5; // Scaling to roughly match other noise levels
  }
  
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    
    for (let channel = 0; channel < output.length; channel++) {
      const outputChannel = output[channel];
      
      for (let i = 0; i < outputChannel.length; i++) {
        // Choose noise generation based on type
        if (this.noiseType === 'pink') {
          outputChannel[i] = this.generatePinkNoise();
        } else if (this.noiseType === 'brown') {
          outputChannel[i] = this.generateBrownNoise();
        } else { // Default to white
          outputChannel[i] = this.generateWhiteNoise();
        }
      }
    }
    
    return true; // Keep processor alive
  }
}

registerProcessor('noise-generator', NoiseGenerator);
```

## 6. Bridge Between Visual and Audio

### 6.1 Visual Data Extractor

```typescript
// src/systems/bridge/VisualDataExtractor.ts

import * as THREE from 'three';
import { IPixelDataExtractor } from '../../core/types/visual';

export class VisualDataExtractor implements IPixelDataExtractor {
  private width: number = 1;
  private height: number = 1;
  private format: THREE.PixelFormat = THREE.RGBAFormat;
  private buffer: Float32Array | Uint8Array;
  private isFloat: boolean = false;
  
  constructor() {
    this.buffer = new Uint8Array(4); // Default 1x1 RGBA
  }
  
  public setup(width: number, height: number, format: THREE.PixelFormat, type: THREE.TextureDataType = THREE.UnsignedByteType): void {
    this.width = width;
    this.height = height;
    this.format = format;
    this.isFloat = type === THREE.FloatType || type === THREE.HalfFloatType;
    
    // Create appropriate buffer
    const bytesPerPixel = format === THREE.RGBAFormat ? 4 : 
                         format === THREE.RGBFormat ? 3 : 
                         format === THREE.LuminanceFormat ? 1 : 4;
    
    const totalBytes = width * height * bytesPerPixel;
    this.buffer = this.isFloat ? 
      new Float32Array(totalBytes) : 
      new Uint8Array(totalBytes);
  }
  
  public extract(
    renderer: THREE.WebGLRenderer, 
    target: THREE.WebGLRenderTarget
  ): Float32Array {
    // Read pixels from render target
    renderer.readRenderTargetPixels(
      target,
      0, 0,
      this.width, this.height,
      this.buffer
    );
    
    // Convert to normalized Float32Array for consistent API
    if (!this.isFloat) {
      const floatBuffer = new Float32Array(this.buffer.length);
      // Normalize 0-255 to 0-1
      for (let i = 0; i < this.buffer.length; i++) {
        floatBuffer[i] = (this.buffer as Uint8Array)[i] / 255;
      }
      return floatBuffer;
    }
    
    return this.buffer as Float32Array;
  }
  
  public extractAverage(
    renderer: THREE.WebGLRenderer,
    target: THREE.WebGLRenderTarget
  ): { r: number, g: number, b: number, a: number } {
    const data = this.extract(renderer, target);
    
    // Calculate average values
    let r = 0, g = 0, b = 0, a = 0;
    const pixelCount = this.width * this.height;
    const bytesPerPixel = this.format === THREE.RGBAFormat ? 4 : 
                         this.format === THREE.RGBFormat ? 3 : 
                         this.format === THREE.LuminanceFormat ? 1 : 4;
    
    for (let i = 0; i < pixelCount; i++) {
      const offset = i * bytesPerPixel;
      r += data[offset];
      
      if (bytesPerPixel > 1) {
        g += data[offset + 1];
        
        if (bytesPerPixel > 2) {
          b += data[offset + 2];
          
          if (bytesPerPixel > 3) {
            a += data[offset + 3];
          }
        }
      }
    }
    
    return {
      r: r / pixelCount,
      g: bytesPerPixel > 1 ? g / pixelCount : 0,
      b: bytesPerPixel > 2 ? b / pixelCount : 0,
      a: bytesPerPixel > 3 ? a / pixelCount : 1
    };
  }
}
```

### 6.2 Visual to Audio Bridge

```typescript
// src/systems/bridge/VisualAudioBridge.ts

import { IVisualAudioBridge } from '../../core/types/audio';
import { IPixelDataExtractor } from '../../core/types/visual';

export interface IVisualAudioMapping {
  sourceType: 'average' | 'pixel' | 'histogram';
  sourceChannel: 'r' | 'g' | 'b' | 'a' | 'luminance';
  targetParam: AudioParam;
  inputRange: [number, number]; // Min/max of visual data
  outputRange: [number, number]; // Min/max for audio param
  mapping: 'linear' | 'exponential' | 'logarithmic';
  lag: number; // 0-1: amount of smoothing to apply
}

export class VisualAudioBridge implements IVisualAudioBridge {
  private id: string;
  private extractor: IPixelDataExtractor | null = null;
  private mappings: IVisualAudioMapping[] = [];
  private lastValues: Map<AudioParam, number> = new Map();
  
  constructor(id: string) {
    this.id = id;
  }
  
  public connect(extractor: IPixelDataExtractor, audioParams: AudioParam[]): void {
    this.extractor = extractor;
    
    // Initialize last values
    audioParams.forEach(param => {
      this.lastValues.set(param, param.value);
    });
  }
  
  public addMapping(mapping: IVisualAudioMapping): void {
    this.mappings.push(mapping);
    this.lastValues.set(mapping.targetParam, mapping.targetParam.value);
  }
  
  public removeMappingForParam(param: AudioParam): void {
    this.mappings = this.mappings.filter(m => m.targetParam !== param);
    this.lastValues.delete(param);
  }
  
  public process(time: number, deltaTime: number): void {
    if (!this.extractor) return;
    
    // Process each mapping
    for (const mapping of this.mappings) {
      let value: number;
      
      // Extract value based on source type
      if (mapping.sourceType === 'average') {
        const avg = this.getAverageValue(mapping.sourceChannel);
        value = this.mapValue(avg, mapping);
      } else if (mapping.sourceType === 'pixel') {
        const pixel = this.getPixelValue(mapping.sourceChannel);
        value = this.mapValue(pixel, mapping);
      } else { // histogram
        const hist = this.getHistogramValue(mapping.sourceChannel);
        value = this.mapValue(hist, mapping);
      }
      
      // Apply lag/smoothing if needed
      if (mapping.lag > 0 && this.lastValues.has(mapping.targetParam)) {
        const lastValue = this.lastValues.get(mapping.targetParam)!;
        value = lastValue * mapping.lag + value * (1 - mapping.lag);
      }
      
      // Update the audio parameter
      mapping.targetParam.setValueAtTime(value, time);
      this.lastValues.set(mapping.targetParam, value);
    }
  }
  
  private getAverageValue(channel: string): number {
    // Placeholder - real implementation would extract from the visual data
    return 0.5; // Return a default value for now
  }
  
  private getPixelValue(channel: string): number {
    // Placeholder
    return 0.5;
  }
  
  private getHistogramValue(channel: string): number {
    // Placeholder
    return 0.5;
  }
  
  private mapValue(input: number, mapping: IVisualAudioMapping): number {
    // Normalize input to 0-1 range
    const normalized = (input - mapping.inputRange[0]) / 
                     (mapping.inputRange[1] - mapping.inputRange[0]);
    const clamped = Math.max(0, Math.min(1, normalized));
    
    let output: number;
    
    if (mapping.mapping === 'exponential') {
      // Exponential mapping (^2)
      output = clamped * clamped;
    } else if (mapping.mapping === 'logarithmic') {
      // Logarithmic mapping (sqrt)
      output = Math.sqrt(clamped);
    } else {
      // Linear mapping
      output = clamped;
    }
    
    // Scale to output range
    return mapping.outputRange[0] + 
           output * (mapping.outputRange[1] - mapping.outputRange[0]);
  }
  
  public dispose(): void {
    this.mappings = [];
    this.lastValues.clear();
    this.extractor = null;
  }
}
```

## 7. Node Editor Implementation

### 7.1 Editor Core

```typescript
// src/systems/node-editor/Editor.ts

import { IGraph, INode, IConnection, INodeDefinition } from '../../core/types/node';
import { NodeFactory } from './NodeFactory';
import { v4 as uuidv4 } from 'uuid';

export class Editor {
  private graph: IGraph;
  private factory: NodeFactory;
  private onGraphChangeCallbacks: Array<(graph: IGraph) => void> = [];
  
  constructor() {
    this.graph = { nodes: {}, connections: {} };
    this.factory = new NodeFactory();
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
      console.error(`Failed to create node of type "${type}":`, error);
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
      console.error('Source or target node not found');
      return null;
    }
    
    const sourcePort = sourceNode.outputs[sourcePortId];
    const targetPort = targetNode.inputs[targetPortId];
    
    if (!sourcePort || !targetPort) {
      console.error('Source or target port not found');
      return null;
    }
    
    // Check if types are compatible
    if (sourcePort.type !== targetPort.type && 
        sourcePort.type !== 'any' && 
        targetPort.type !== 'any') {
      console.error(`Incompatible port types: ${sourcePort.type} -> ${targetPort.type}`);
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
}
```

### 7.2 Node Factory

```typescript
// src/systems/node-editor/NodeFactory.ts

import { INode, INodeDefinition } from '../../core/types/node';
import { NodeRegistry } from '../../core/nodes/NodeRegistry';
import { v4 as uuidv4 } from 'uuid';

export class NodeFactory {
  private registry: NodeRegistry;
  
  constructor() {
    this.registry = NodeRegistry.getInstance();
  }
  
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
}
```

## 8. Asset Management

```typescript
// src/services/asset-manager/AssetManager.ts

export interface Asset {
  id: string;
  type: 'audio' | 'image' | 'video' | 'other';
  name: string;
  data: any; // AudioBuffer, HTMLImageElement, etc.
  metadata?: Record<string, any>;
}

export class AssetManager {
  private assets: Map<string, Asset> = new Map();
  private audioContext: AudioContext | null = null;
  
  constructor() {}
  
  public setAudioContext(context: AudioContext): void {
    this.audioContext = context;
  }
  
  public async loadAudio(file: File): Promise<Asset> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }
    
    return new Promise<Asset>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const buffer = await this.audioContext!.decodeAudioData(event.target!.result as ArrayBuffer);
          
          const asset: Asset = {
            id: `audio-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            type: 'audio',
            name: file.name,
            data: buffer,
            metadata: {
              duration: buffer.duration,
              sampleRate: buffer.sampleRate,
              numberOfChannels: buffer.numberOfChannels,
              size: file.size
            }
          };
          
          this.assets.set(asset.id, asset);
          resolve(asset);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = (error) => {
        reject(error);
      };
      
      reader.readAsArrayBuffer(file);
    });
  }
  
  public async loadImage(file: File): Promise<Asset> {
    return new Promise<Asset>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const image = new Image();
        
        image.onload = () => {
          const asset: Asset = {
            id: `image-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            type: 'image',
            name: file.name,
            data: image,
            metadata: {
              width: image.width,
              height: image.height,
              size: file.size
            }
          };
          
          this.assets.set(asset.id, asset);
          resolve(asset);
        };
        
        image.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        
        image.src = event.target!.result as string;
      };
      
      reader.onerror = (error) => {
        reject(error);
      };
      
      reader.readAsDataURL(file);
    });
  }
  
  public getAsset(id: string): Asset | undefined {
    return this.assets.get(id);
  }
  
  public getAllAssets(): Asset[] {
    return Array.from(this.assets.values());
  }
  
  public removeAsset(id: string): boolean {
    return this.assets.delete(id);
  }
  
  public dispose(): void {
    this.assets.clear();
  }
}
```

## 9. Performance Optimizations

### 9.1 Scheduler Service

```typescript
// src/services/scheduler/Scheduler.ts

export class Scheduler {
  private callback: ((time: number) => void) | null = null;
  private running: boolean = false;
  private frameId: number | null = null;
  private lastTime: number = 0;
  private fpsLimit: number = 60;
  private interval: number = 1000 / 60; // Default to 60 FPS
  
  constructor() {
    this.updateLoop = this.updateLoop.bind(this);
  }
  
  public setCallback(callback: (time: number) => void): void {
    this.callback = callback;
  }
  
  public setFPSLimit(fps: number): void {
    this.fpsLimit = Math.max(1, Math.min(120, fps));
    this.interval = 1000 / this.fpsLimit;
  }
  
  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.updateLoop);
  }
  
  public stop(): void {
    if (!this.running) return;
    this.running = false;
    
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }
  
  private updateLoop(time: number): void {
    this.frameId = requestAnimationFrame(this.updateLoop);
    
    // Apply FPS limiting
    const elapsed = time - this.lastTime;
    
    if (elapsed < this.interval) {
      return;
    }
    
    // Update time tracking based on FPS limit
    this.lastTime = time - (elapsed % this.interval);
    
    // Call the callback
    if (this.callback) {
      this.callback(time);
    }
  }
}
```

### 9.2 Memory Pool for WebGL Resources

```typescript
// src/systems/visual/ResourcePool.ts

import * as THREE from 'three';

export interface PooledResource<T> {
  resource: T;
  lastUsed: number;
  inUse: boolean;
}

export class ResourcePool<T> {
  private resources: Map<string, PooledResource<T>> = new Map();
  private factory: (id: string, ...args: any[]) => T;
  private dispose: (resource: T) => void;
  private maxAge: number; // Time in ms before unused resource is considered for disposal
  private maxSize: number; // Maximum number of resources to keep in pool
  
  constructor(
    factory: (id: string, ...args: any[]) => T,
    dispose: (resource: T) => void,
    options: {
      maxAge?: number;
      maxSize?: number;
    } = {}
  ) {
    this.factory = factory;
    this.dispose = dispose;
    this.maxAge = options.maxAge || 30000; // Default 30 seconds
    this.maxSize = options.maxSize || 20;   // Default 20 resources
  }
  
  public acquire(id: string, ...args: any[]): T {
    let pooled = this.resources.get(id);
    
    if (!pooled) {
      // Create new resource
      const resource = this.factory(id, ...args);
      pooled = {
        resource,
        lastUsed: performance.now(),
        inUse: true
      };
      this.resources.set(id, pooled);
    } else {
      // Mark existing resource as in use
      pooled.inUse = true;
      pooled.lastUsed = performance.now();
    }
    
    return pooled.resource;
  }
  
  public release(id: string): void {
    const pooled = this.resources.get(id);
    if (pooled) {
      pooled.inUse = false;
      pooled.lastUsed = performance.now();
    }
  }
  
  public has(id: string): boolean {
    return this.resources.has(id);
  }
  
  public clean(): void {
    const now = performance.now();
    let count = 0;
    
    // Count in-use resources
    for (const [_, pooled] of this.resources) {
      if (pooled.inUse) count++;
    }
    
    // If we have too many resources, or resources are old, dispose them
    for (const [id, pooled] of this.resources) {
      // Skip resources in use
      if (pooled.inUse) continue;
      
      const age = now - pooled.lastUsed;
      
      // Dispose if too old or we have too many resources
      if (age > this.maxAge || count >= this.maxSize) {
        this.dispose(pooled.resource);
        this.resources.delete(id);
      } else {
        count++;
      }
    }
  }
  
  public disposeAll(): void {
    for (const [id, pooled] of this.resources) {
      this.dispose(pooled.resource);
    }
    this.resources.clear();
  }
}

// Example usage for render targets
export class RenderTargetPool {
  private pool: ResourcePool<THREE.WebGLRenderTarget>;
  
  constructor() {
    this.pool = new ResourcePool<THREE.WebGLRenderTarget>(
      (id, width, height, options) => {
        return new THREE.WebGLRenderTarget(width, height, options);
      },
      (target) => {
        target.dispose();
      },
      { maxAge: 10000, maxSize: 10 }
    );
  }
  
  public acquire(id: string, width: number, height: number, options?: THREE.WebGLRenderTargetOptions): THREE.WebGLRenderTarget {
    return this.pool.acquire(id, width, height, options);
  }
  
  public release(id: string): void {
    this.pool.release(id);
  }
  
  public clean(): void {
    this.pool.clean();
  }
  
  public dispose(): void {
    this.pool.disposeAll();
  }
}
```

## 10. Error Handling & Robustness

```typescript
// src/core/utils/ErrorHandler.ts

export enum ErrorSeverity {
  INFO,
  WARNING,
  ERROR,
  FATAL
}

export interface ErrorInfo {
  message: string;
  details?: string;
  severity: ErrorSeverity;
  timestamp: number;
  source: string;
  handled: boolean;
  data?: any;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errors: ErrorInfo[] = [];
  private errorListeners: Array<(error: ErrorInfo) => void> = [];
  
  private constructor() {
    // Install global error handlers
    window.addEventListener('error', this.handleGlobalError.bind(this));
    window.addEventListener('unhandledrejection', this.handlePromiseRejection.bind(this));
  }
  
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }
  
  public report(
    message: string, 
    source: string, 
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    details?: string,
    data?: any
  ): ErrorInfo {
    const error: ErrorInfo = {
      message,
      details,
      severity,
      timestamp: Date.now(),
      source,
      handled: false,
      data
    };
    
    this.errors.push(error);
    this.notifyListeners(error);
    
    // Log to console based on severity
    switch (severity) {
      case ErrorSeverity.INFO:
        console.info(`[${source}] ${message}`, details ? details : '');
        break;
      case ErrorSeverity.WARNING:
        console.warn(`[${source}] ${message}`, details ? details : '');
        break;
      case ErrorSeverity.ERROR:
      case ErrorSeverity.FATAL:
        console.error(`[${source}] ${message}`, details ? details : '');
        break;
    }
    
    return error;
  }
  
  public handlePromiseRejection(event: PromiseRejectionEvent): void {
    const message = event.reason?.message || 'Promise rejected';
    const details = event.reason?.stack || String(event.reason);
    
    this.report(
      message,
      'Promise',
      ErrorSeverity.ERROR,
      details,
      event.reason
    );
    
    // Prevent default handling
    event.preventDefault();
  }
  
  public handleGlobalError(event: ErrorEvent): void {
    this.report(
      event.message || 'Unknown error',
      event.filename || 'global',
      ErrorSeverity.ERROR,
      `Line: ${event.lineno}, Col: ${event.colno}\n${event.error?.stack || ''}`,
      event.error
    );
    
    // Prevent default handling
    event.preventDefault();
  }
  
  public getErrors(): ErrorInfo[] {
    return [...this.errors];
  }
  
  public addListener(listener: (error: ErrorInfo) => void): () => void {
    this.errorListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.errorListeners = this.errorListeners.filter(l => l !== listener);
    };
  }
  
  private notifyListeners(error: ErrorInfo): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        console.error('Error in error listener:', e);
      }
    });
  }
  
  public markAsHandled(error: ErrorInfo): void {
    error.handled = true;
  }
  
  public clearErrors(): void {
    this.errors = [];
  }
}

// Example usage and utility function
export function wrapAsync<T>(
  fn: (...args: any[]) => Promise<T>, 
  source: string,
  errorMsg: string = 'Operation failed'
): (...args: any[]) => Promise<T> {
  return async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      ErrorHandler.getInstance().report(
        errorMsg,
        source,
        ErrorSeverity.ERROR,
        error instanceof Error ? error.message : String(error),
        error
      );
      throw error;
    }
  };
}
```

## 11. Common Node Implementations

### 11.1 Visual Node Implementation Example

```typescript
// src/core/nodes/visual/MetaballNode.ts

import { INodeDefinition, INode, ProcessContext } from '../../types/node';
import { PortType } from '../../types/node';
import * as THREE from 'three';
import { MetaballTechnique, IMetaball } from '../../../systems/visual/techniques/MetaballTechnique';

export const MetaballNode: INodeDefinition = {
  type: 'metaball',
  category: 'process',
  system: 'visual',
  
  inputs: [
    {
      id: 'input',
      name: 'Input',
      type: PortType.TEXTURE,
      nodeId: '',
      connected: false,
      allowMultiple: false
    }
  ],
  
  outputs: [
    {
      id: 'output',
      name: 'Output',
      type: PortType.TEXTURE,
      nodeId: '',
      connections: []
    }
  ],
  
  params: [
    {
      id: 'count',
      name: 'Metaball Count',
      type: 'int',
      defaultValue: 3,
      min: 1,
      max: 16,
      step: 1
    },
    {
      id: 'threshold',
      name: 'Threshold',
      type: 'float',
      defaultValue: 1.0,
      min: 0.1,
      max: 10.0,
      step: 0.1
    },
    {
      id: 'colorMapping',
      name: 'Color Mapping',
      type: 'select',
      defaultValue: 'grayscale',
      options: [
        { label: 'Grayscale', value: 'grayscale' },
        { label: 'Heatmap', value: 'heatmap' },
        { label: 'Custom', value: 'custom' }
      ]
    },
    {
      id: 'colorA',
      name: 'Color A',
      type: 'color',
      defaultValue: '#000000'
    },
    {
      id: 'colorB',
      name: 'Color B',
      type: 'color',
      defaultValue: '#ffffff'
    }
  ],
  
  initialize: (node: INode) => {
    // Initialize metaball positions with random values
    const metaballs: IMetaball[] = [];
    const count = node.params.count || 3;
    
    for (let i = 0; i < count; i++) {
      metaballs.push({
        position: new THREE.Vector2(Math.random(), Math.random()),
        radius: 0.1 + Math.random() * 0.1,
        strength: 0.5 + Math.random() * 0.5
      });
    }
    
    // Store in node state
    node.state.metaballs = metaballs;
    node.state.techniqueId = `metaball-${node.id}`;
    node.state.renderTargetId = `rt-metaball-${node.id}`;
  },
  
  process: (node: INode, context: ProcessContext) => {
    const { renderer, time, deltaTime } = context;
    
    // Get or create technique
    let technique: MetaballTechnique;
    if (!node.state.technique) {
      technique = new MetaballTechnique(node.state.techniqueId);
      node.state.technique = technique;
    } else {
      technique = node.state.technique;
    }
    
    // Update metaballs if count changed
    if (node.params.count !== node.state.metaballs.length) {
      const metaballs: IMetaball[] = [];
      const count = node.params.count || 3;
      
      // Keep existing metaballs if possible
      for (let i = 0; i < count; i++) {
        if (i < node.state.metaballs.length) {
          metaballs.push(node.state.metaballs[i]);
        } else {
          metaballs.push({
            position: new THREE.Vector2(Math.random(), Math.random()),
            radius: 0.1 + Math.random() * 0.1,
            strength: 0.5 + Math.random() * 0.5
          });
        }
      }
      
      node.state.metaballs = metaballs;
    }
    
    // Animate metaballs
    for (let i = 0; i < node.state.metaballs.length; i++) {
      const ball = node.state.metaballs[i];
      
      // Simple circular motion
      const angle = (time / 1000) * (0.2 + i * 0.1);
      const radius = 0.2 + (i % 3) * 0.1;
      
      ball.position.x = 0.5 + Math.cos(angle) * radius;
      ball.position.y = 0.5 + Math.sin(angle) * radius;
    }
    
    // Create params object
    const params = {
      metaballs: node.state.metaballs,
      threshold: node.params.threshold,
      colorMapping: node.params.colorMapping,
      customColorA: new THREE.Color(node.params.colorA),
      customColorB: new THREE.Color(node.params.colorB)
    };
    
    // Update material if it exists
    if (node.state.technique.material) {
      node.state.technique.updateParams(params);
    }
    
    // Get viewport dimensions
    const width = renderer.domElement.width;
    const height = renderer.domElement.height;
    
    // Create or get render target
    let renderTarget = node.state.renderTarget;
    if (!renderTarget || renderTarget.width !== width || renderTarget.height !== height) {
      // Create new render target
      const rtOptions = {
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter
      };
      
      // If using renderer from context, assume it has a resource pool
      if (renderer.resourcePool) {
        renderTarget = renderer.resourcePool.acquireRenderTarget(
          node.state.renderTargetId,
          width,
          height,
          rtOptions
        );
      } else {
        renderTarget = new THREE.WebGLRenderTarget(
          width,
          height,
          rtOptions
        );
      }
      
      node.state.renderTarget = renderTarget;
    }
    
    // Render to target
    technique.render(renderer, renderTarget);
    
    // Set output
    node.outputs.output.data = {
      texture: renderTarget.texture,
      width,
      height
    };
  }
};
```

### 11.2 Audio Node Implementation Example

```typescript
// src/core/nodes/audio/OscillatorNode.ts

import { INodeDefinition, INode, ProcessContext } from '../../types/node';
import { PortType } from '../../types/node';

export const OscillatorNode: INodeDefinition = {
  type: 'oscillator',
  category: 'source',
  system: 'audio',
  
  inputs: [
    {
      id: 'frequency',
      name: 'Frequency',
      type: PortType.FLOAT,
      nodeId: '',
      connected: false,
      defaultValue: 440
    },
    {
      id: 'amplitude',
      name: 'Amplitude',
      type: PortType.FLOAT,
      nodeId: '',
      connected: false,
      defaultValue: 0.5
    }
  ],
  
  outputs: [
    {
      id: 'output',
      name: 'Output',
      type: PortType.AUDIO_NODE,
      nodeId: '',
      connections: []
    }
  ],
  
  params: [
    {
      id: 'type',
      name: 'Wave Type',
      type: 'select',
      defaultValue: 'sine',
      options: [
        { label: 'Sine', value: 'sine' },
        { label: 'Square', value: 'square' },
        { label: 'Sawtooth', value: 'sawtooth' },
        { label: 'Triangle', value: 'triangle' }
      ]
    },
    {
      id: 'detune',
      name: 'Detune',
      type: 'float',
      defaultValue: 0,
      min: -1200,
      max: 1200,
      step: 1
    },
    {
      id: 'playing',
      name: 'Playing',
      type: 'boolean',
      defaultValue: true
    }
  ],
  
  initialize: (node: INode) => {
    // Node gets initialized but actual AudioNodes are created in process
    // to ensure proper AudioContext existence
    node.state.created = false;
  },
  
  process: (node: INode, context: ProcessContext) => {
    const { audioContext } = context;
    
    // Handle first-time creation
    if (!node.state.created) {
      try {
        // Create oscillator
        const oscillator = audioContext.createOscillator();
        oscillator.type = node.params.type;
        oscillator.frequency.value = node.inputs.frequency.connected ? 
          node.inputs.frequency.data : node.inputs.frequency.defaultValue;
        oscillator.detune.value = node.params.detune;
        
        // Create gain node
        const gainNode = audioContext.createGain();
        gainNode.gain.value = node.inputs.amplitude.connected ? 
          node.inputs.amplitude.data : node.inputs.amplitude.defaultValue;
        
        // Connect
        oscillator.connect(gainNode);
        
        // Start oscillator if playing
        if (node.params.playing) {
          oscillator.start();
        }
        
        // Store references
        node.state.oscillator = oscillator;
        node.state.gain = gainNode;
        node.state.created = true;
        node.state.playing = node.params.playing;
        
        // Set output
        node.outputs.output.data = {
          audioNode: gainNode,
          params: {
            frequency: oscillator.frequency,
            detune: oscillator.detune,
            gain: gainNode.gain
          }
        };
      } catch (error) {
        console.error('Failed to create oscillator node:', error);
      }
    }
    
    // Update oscillator parameters
    if (node.state.created) {
      const oscillator = node.state.oscillator;
      const gainNode = node.state.gain;
      
      // Update frequency if input connected
      if (node.inputs.frequency.connected && node.inputs.frequency.data !== undefined) {
        const targetFreq = node.inputs.frequency.data;
        oscillator.frequency.setValueAtTime(targetFreq, audioContext.currentTime);
      }
      
      // Update amplitude if input connected
      if (node.inputs.amplitude.connected && node.inputs.amplitude.data !== undefined) {
        const targetAmp = node.inputs.amplitude.data;
        gainNode.gain.setValueAtTime(targetAmp, audioContext.currentTime);
      }
      
      // Update wave type if changed
      if (oscillator.type !== node.params.type) {
        oscillator.type = node.params.type;
      }
      
      // Update detune if changed
      if (oscillator.detune.value !== node.params.detune) {
        oscillator.detune.setValueAtTime(
          node.params.detune, 
          audioContext.currentTime
        );
      }
      
      // Handle play/stop state changes
      if (node.params.playing !== node.state.playing) {
        if (node.params.playing) {
          // Need a new oscillator, since stopped ones can't restart
          const newOsc = audioContext.createOscillator();
          newOsc.type = oscillator.type;
          newOsc.frequency.value = oscillator.frequency.value;
          newOsc.detune.value = oscillator.detune.value;
          
          // Connect and start
          newOsc.connect(gainNode);
          newOsc.start();
          
          // Replace old oscillator
          node.state.oscillator = newOsc;
          
          // Update output
          node.outputs.output.data.params.frequency = newOsc.frequency;
          node.outputs.output.data.params.detune = newOsc.detune;
        } else {
          // Stop oscillator
          try {
            oscillator.stop();
          } catch (error) {
            // Ignore errors if already stopped
          }
        }
        
        node.state.playing = node.params.playing;
      }
    }
  }
};
```

## 12. Implementation Challenges & Solutions

### 12.1 Preventing Memory Leaks

```typescript
// src/core/utils/MemoryMonitor.ts

export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private gcTriggerLevel: number = 0.8; // 80% of max memory
  private disposed: boolean = false;
  private checkIntervalId: number | null = null;
  private listeners: Array<() => void> = [];
  
  private constructor() {
    // Start monitoring if supported
    if (window.performance && window.performance.memory) {
      this.startMonitoring();
    }
  }
  
  public static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }
  
  public addListener(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  public getMemoryInfo(): { current: number, max: number, percent: number } | null {
    if (!window.performance || !window.performance.memory) {
      return null;
    }
    
    const memory = window.performance.memory;
    return {
      current: memory.usedJSHeapSize,
      max: memory.jsHeapSizeLimit,
      percent: memory.usedJSHeapSize / memory.jsHeapSizeLimit
    };
  }
  
  private startMonitoring(): void {
    this.checkIntervalId = window.setInterval(() => {
      this.checkMemory();
    }, 10000); // Check every 10 seconds
  }
  
  private checkMemory(): void {
    if (this.disposed) return;
    
    const memory = this.getMemoryInfo();
    if (!memory) return;
    
    if (memory.percent > this.gcTriggerLevel) {
      console.warn(`Memory usage high: ${Math.round(memory.percent * 100)}%`);
      
      // Notify listeners of high memory usage
      this.notifyListeners();
    }
  }
  
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in memory listener:', error);
      }
    });
  }
  
  public dispose(): void {
    if (this.checkIntervalId !== null) {
      window.clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    this.disposed = true;
    this.listeners = [];
  }
}

// Usage in main engine:
// engine.ts

private initializeMemoryMonitor(): void {
  const monitor = MemoryMonitor.getInstance();
  
  monitor.addListener(() => {
    // Clean up resource pools
    this.visualSystem.cleanResourcePools();
    
    // Force garbage collection hint
    this.forceGarbageCollectionHint();
  });
}

private forceGarbageCollectionHint(): void {
  // Create and release large temporary arrays to hint at GC
  let largeArray: number[] | null = new Array(10000000);
  largeArray.fill(0);
  largeArray = null;
}
```

### 12.2 Performance Profiling

```typescript
// src/core/utils/Profiler.ts

export interface ProfilerMark {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  parent?: string;
}

export class Profiler {
  private static instance: Profiler;
  private marks: Map<string, ProfilerMark> = new Map();
  private activeMarks: Set<string> = new Set();
  private history: ProfilerMark[] = [];
  private historyLimit: number = 1000;
  private enabled: boolean = false;
  
  private constructor() {}
  
  public static getInstance(): Profiler {
    if (!Profiler.instance) {
      Profiler.instance = new Profiler();
    }
    return Profiler.instance;
  }
  
  public enable(): void {
    this.enabled = true;
  }
  
  public disable(): void {
    this.enabled = false;
    this.clear();
  }
  
  public start(name: string, parent?: string): void {
    if (!this.enabled) return;
    
    const mark: ProfilerMark = {
      name,
      startTime: performance.now(),
      parent
    };
    
    this.marks.set(name, mark);
    this.activeMarks.add(name);
  }
  
  public end(name: string): ProfilerMark | null {
    if (!this.enabled) return null;
    
    const mark = this.marks.get(name);
    if (!mark) {
      console.warn(`No mark found with name: ${name}`);
      return null;
    }
    
    mark.endTime = performance.now();
    mark.duration = mark.endTime - mark.startTime;
    
    this.activeMarks.delete(name);
    
    // Add to history
    this.history.push({...mark});
    
    // Trim history if needed
    if (this.history.length > this.historyLimit) {
      this.history = this.history.slice(-this.historyLimit);
    }
    
    return mark;
  }
  
  public getActiveMarks(): ProfilerMark[] {
    return Array.from(this.activeMarks).map(name => {
      const mark = this.marks.get(name)!;
      return {
        ...mark,
        duration: performance.now() - mark.startTime
      };
    });
  }
  
  public getHistory(): ProfilerMark[] {
    return [...this.history];
  }
  
  public getSummary(): Record<string, { count: number, totalTime: number, avgTime: number }> {
    const summary: Record<string, { count: number, totalTime: number, avgTime: number }> = {};
    
    for (const mark of this.history) {
      if (!mark.duration) continue;
      
      if (!summary[mark.name]) {
        summary[mark.name] = {
          count: 0,
          totalTime: 0,
          avgTime: 0
        };
      }
      
      summary[mark.name].count++;
      summary[mark.name].totalTime += mark.duration;
    }
    
    // Calculate averages
    for (const name in summary) {
      summary[name].avgTime = summary[name].totalTime / summary[name].count;
    }
    
    return summary;
  }
  
  public clear(): void {
    this.marks.clear();
    this.activeMarks.clear();
    this.history = [];
  }
}

// Usage:
// In node processor:
process(node: INode, context: ProcessContext): void {
  const profiler = Profiler.getInstance();
  profiler.start(`process-node-${node.type}-${node.id}`);
  
  // ... node processing logic
  
  profiler.end(`process-node-${node.type}-${node.id}`);
}
```

## 13. Conclusion

This implementation guide provides a detailed roadmap for junior engineers to build the audiovisual node playground. The key architectural decisions include:

1. **Modular, Component-Based Design**: Separate systems for visuals, audio, and bridging, allowing each to be developed and tested independently.

2. **Type-Safe Design**: Comprehensive TypeScript interfaces ensure proper component integration and prevent runtime errors.

3. **Efficient Resource Management**: Pooling systems for WebGL resources, careful texture management, and minimized GPU readbacks.

4. **Real-Time Performance**: Frame scheduling, optimized rendering pipeline, and efficient audio processing.

5. **Robustness**: Comprehensive error handling, memory monitoring, and performance profiling.

This architecture allows for future expansion and optimization while maintaining a solid foundation. The node-based approach provides flexibility for users to create complex combinations of visual and audio effects without requiring them to write code.
