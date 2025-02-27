import * as THREE from 'three';
import { INode, INodeDefinition, PortType, ProcessContext } from '../../../types/node';
import { ReactionDiffusion, ReactionDiffusionParams } from '../../../../systems/visual/techniques/ReactionDiffusion';

/**
 * Extended ProcessContext with input/output methods
 */
interface VisualProcessContext extends ProcessContext {
  getInputData: (nodeId: string, portId: string) => any;
  setOutputData: (nodeId: string, portId: string, data: any) => void;
}

/**
 * Node definition for Reaction-Diffusion visual effect
 */
export const ReactionDiffusionNode: INodeDefinition = {
  type: 'reactionDiffusion',
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
      id: 'feed',
      name: 'Feed Rate',
      type: 'float',
      defaultValue: 0.055,
      min: 0.01,
      max: 0.1,
      step: 0.001
    },
    {
      id: 'kill',
      name: 'Kill Rate',
      type: 'float',
      defaultValue: 0.062,
      min: 0.01,
      max: 0.1,
      step: 0.001
    },
    {
      id: 'diffuseA',
      name: 'Diffusion Rate A',
      type: 'float',
      defaultValue: 1.0,
      min: 0.1,
      max: 2.0,
      step: 0.1
    },
    {
      id: 'diffuseB',
      name: 'Diffusion Rate B',
      type: 'float',
      defaultValue: 0.5,
      min: 0.1,
      max: 2.0,
      step: 0.1
    },
    {
      id: 'timestep',
      name: 'Time Step',
      type: 'float',
      defaultValue: 1.0,
      min: 0.1,
      max: 5.0,
      step: 0.1
    },
    {
      id: 'initialPattern',
      name: 'Initial Pattern',
      type: 'select',
      defaultValue: 'random',
      options: [
        { label: 'Random', value: 'random' },
        { label: 'Center', value: 'center' },
        { label: 'Spots', value: 'spots' }
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
      defaultValue: new THREE.Color(0x00ff00)
    }
  ],
  
  /**
   * Initialize the Reaction-Diffusion node
   * @param node The node instance to initialize
   */
  initialize: (node: INode) => {
    // Set initialized flag
    node.state.initialized = true;
    
    // Create a disposal function
    node.state.dispose = () => {
      if (node.state.technique) {
        (node.state.technique as ReactionDiffusion).dispose();
        node.state.technique = null;
      }
    };
  },
  
  /**
   * Process the Reaction-Diffusion node
   * @param node The node instance to process
   * @param context The processing context
   */
  process: (node: INode, context: ProcessContext) => {
    const visualContext = context as VisualProcessContext;
    
    // Create or get technique instance
    if (!node.state.technique) {
      const technique = new ReactionDiffusion(node.id);
      
      // Initialize the technique with WebGL renderer
      technique.initialize(visualContext.renderer);
      
      // Store in node state
      node.state.technique = technique;
    }
    
    const technique = node.state.technique as ReactionDiffusion;
    
    // Get input texture if connected
    const seedTexture = node.inputs.seed.connected ? 
      visualContext.getInputData(node.id, 'seed') : null;
    
    // Update technique parameters from node params
    const params: ReactionDiffusionParams = {
      feed: node.params.feed as number,
      kill: node.params.kill as number,
      diffuseA: node.params.diffuseA as number,
      diffuseB: node.params.diffuseB as number,
      timestep: node.params.timestep as number,
      initialPattern: node.params.initialPattern as 'random' | 'center' | 'spots' | 'custom',
      colorA: node.params.colorA as THREE.Color,
      colorB: node.params.colorB as THREE.Color
    };
    
    // If we have a seed texture, set it as the custom texture
    if (seedTexture) {
      params.initialPattern = 'custom';
      params.customTexture = seedTexture;
    }
    
    technique.updateParams(params);
    
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