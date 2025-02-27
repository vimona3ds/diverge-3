import * as THREE from 'three';
import { INode, INodeDefinition, PortType, ProcessContext } from '../../../types/node';
import { Lenia } from '../../../../systems/visual/techniques/Lenia';

/**
 * Extended ProcessContext with input/output methods
 */
interface VisualProcessContext extends ProcessContext {
  getInputData: (nodeId: string, portId: string) => any;
  setOutputData: (nodeId: string, portId: string, data: any) => void;
}

/**
 * Node definition for Lenia visual effect
 */
export const LeniaNode: INodeDefinition = {
  type: 'lenia',
  category: 'process',
  system: 'visual',
  
  inputs: [
    {
      id: 'seed',
      name: 'Seed',
      type: PortType.TEXTURE,
      allowMultiple: false
    }
  ],
  
  outputs: [
    {
      id: 'output',
      name: 'Output',
      type: PortType.TEXTURE
    }
  ],
  
  params: [
    {
      id: 'kernelRadius',
      name: 'Kernel Radius',
      type: 'float',
      defaultValue: 13.0,
      min: 1.0,
      max: 30.0,
      step: 1.0
    },
    {
      id: 'kernelPeak',
      name: 'Kernel Peak',
      type: 'float',
      defaultValue: 0.15,
      min: 0.01,
      max: 1.0,
      step: 0.01
    },
    {
      id: 'growthCenter',
      name: 'Growth Center',
      type: 'float',
      defaultValue: 0.15,
      min: 0.0,
      max: 1.0,
      step: 0.01
    },
    {
      id: 'growthWidth',
      name: 'Growth Width',
      type: 'float',
      defaultValue: 0.015,
      min: 0.001,
      max: 0.1,
      step: 0.001
    },
    {
      id: 'timeStep',
      name: 'Time Step',
      type: 'float',
      defaultValue: 0.1,
      min: 0.01,
      max: 1.0,
      step: 0.01
    },
    {
      id: 'initialPattern',
      name: 'Initial Pattern',
      type: 'select',
      defaultValue: 'random',
      options: [
        { label: 'Random', value: 'random' },
        { label: 'Circle', value: 'circle' },
        { label: 'Glider', value: 'glider' }
      ]
    },
    {
      id: 'colorA',
      name: 'Color A',
      type: 'color',
      defaultValue: new THREE.Color(0x000000)
    },
    {
      id: 'colorB',
      name: 'Color B',
      type: 'color',
      defaultValue: new THREE.Color(0x0088ff)
    }
  ],
  
  /**
   * Initialize the Lenia node
   * @param node The node instance to initialize
   */
  initialize: (node: INode) => {
    // Set initialized flag
    node.state.initialized = true;
    
    // Create a disposal function
    node.state.dispose = () => {
      if (node.state.technique) {
        (node.state.technique as Lenia).dispose();
        node.state.technique = null;
      }
    };
  },
  
  /**
   * Process the Lenia node
   * @param node The node instance to process
   * @param context The processing context
   */
  process: (node: INode, context: ProcessContext) => {
    const visualContext = context as VisualProcessContext;
    
    // Create or get technique instance
    if (!node.state.technique) {
      const technique = new Lenia(node.id);
      
      // Initialize the technique with WebGL renderer
      technique.initialize(visualContext.renderer);
      
      // Store in node state
      node.state.technique = technique;
    }
    
    const technique = node.state.technique as Lenia;
    
    // Get input texture if connected
    const seedTexture = node.inputs.seed.connected ? 
      visualContext.getInputData(node.id, 'seed') : null;
    
    // Update technique parameters from node params
    technique.updateParams({
      kernelRadius: node.params.kernelRadius as number,
      kernelPeak: node.params.kernelPeak as number,
      growthCenter: node.params.growthCenter as number,
      growthWidth: node.params.growthWidth as number,
      timeStep: node.params.timeStep as number,
      initialPattern: node.params.initialPattern as string,
      colorA: node.params.colorA as THREE.Color,
      colorB: node.params.colorB as THREE.Color,
      seedTexture: seedTexture || undefined
    });
    
    // Render the technique to its internal target
    technique.render(visualContext.renderer);
    
    // Get the output texture from technique 
    const outputTexture = (technique as any).getOutputTexture();
    
    // Set output data
    if (outputTexture) {
      visualContext.setOutputData(node.id, 'output', outputTexture);
    }
  }
}; 