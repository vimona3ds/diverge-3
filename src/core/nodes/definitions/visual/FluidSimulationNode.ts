import * as THREE from 'three';
import { INode, INodeDefinition, PortType, ProcessContext } from '../../../types/node';
import { FluidSimulation, FluidSimulationParams } from '../../../../systems/visual/techniques/FluidSimulation';

/**
 * Extended ProcessContext with input/output methods
 */
interface VisualProcessContext extends ProcessContext {
  getInputData: (nodeId: string, portId: string) => any;
  setOutputData: (nodeId: string, portId: string, data: any) => void;
}

/**
 * Node definition for Fluid Simulation visual effect
 */
export const FluidSimulationNode: INodeDefinition = {
  type: 'fluidSimulation',
  category: 'source',
  system: 'visual',
  
  inputs: [
    {
      id: 'input',
      name: 'Input',
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
      id: 'resolution',
      name: 'Resolution',
      type: 'int',
      defaultValue: 128,
      min: 32,
      max: 512,
      step: 32
    },
    {
      id: 'dyeResolution',
      name: 'Dye Resolution',
      type: 'int',
      defaultValue: 512,
      min: 128,
      max: 1024,
      step: 32
    },
    {
      id: 'densityDissipation',
      name: 'Density Dissipation',
      type: 'float',
      defaultValue: 0.98,
      min: 0.9,
      max: 1.0,
      step: 0.005
    },
    {
      id: 'velocityDissipation',
      name: 'Velocity Dissipation',
      type: 'float',
      defaultValue: 0.98,
      min: 0.9,
      max: 1.0,
      step: 0.005
    },
    {
      id: 'pressureIterations',
      name: 'Pressure Iterations',
      type: 'int',
      defaultValue: 20,
      min: 1,
      max: 50,
      step: 1
    },
    {
      id: 'curl',
      name: 'Curl (Vorticity)',
      type: 'float',
      defaultValue: 30,
      min: 0,
      max: 50,
      step: 1
    },
    {
      id: 'splatRadius',
      name: 'Splat Radius',
      type: 'float',
      defaultValue: 0.25,
      min: 0.01,
      max: 1.0,
      step: 0.01
    },
    {
      id: 'colorMode',
      name: 'Color Mode',
      type: 'select',
      defaultValue: 'rainbow',
      options: [
        { label: 'Rainbow', value: 'rainbow' },
        { label: 'Custom', value: 'custom' },
        { label: 'Monochrome', value: 'monochrome' }
      ]
    },
    {
      id: 'colorA',
      name: 'Color A',
      type: 'color',
      defaultValue: new THREE.Color(0x00ffff)
    },
    {
      id: 'colorB',
      name: 'Color B',
      type: 'color',
      defaultValue: new THREE.Color(0xff0000)
    }
  ],
  
  /**
   * Initialize the Fluid Simulation node
   * @param node The node instance to initialize
   */
  initialize: (node: INode) => {
    // Set initialized flag
    node.state.initialized = true;
    
    // Create a disposal function
    node.state.dispose = () => {
      if (node.state.technique) {
        (node.state.technique as FluidSimulation).dispose();
        node.state.technique = null;
      }
    };
  },
  
  /**
   * Process the Fluid Simulation node
   * @param node The node instance to process
   * @param context The processing context
   */
  process: (node: INode, context: ProcessContext) => {
    const visualContext = context as VisualProcessContext;
    
    // Create or get technique instance
    if (!node.state.technique) {
      const technique = new FluidSimulation(node.id);
      
      // Initialize the technique with WebGL renderer
      technique.initialize(visualContext.renderer);
      
      // Store in node state
      node.state.technique = technique;
    }
    
    const technique = node.state.technique as FluidSimulation;
    
    // Get input texture if connected
    const inputTexture = node.inputs.input.connected ? 
      visualContext.getInputData(node.id, 'input') : null;
    
    // Update technique parameters from node params
    technique.updateParams({
      resolution: node.params.resolution as number,
      dyeResolution: node.params.dyeResolution as number,
      densityDissipation: node.params.densityDissipation as number,
      velocityDissipation: node.params.velocityDissipation as number,
      pressureIterations: node.params.pressureIterations as number,
      curl: node.params.curl as number,
      splatRadius: node.params.splatRadius as number,
      colorA: node.params.colorA as THREE.Color,
      colorB: node.params.colorB as THREE.Color,
      colorMode: node.params.colorMode as 'rainbow' | 'custom' | 'monochrome'
    });
    
    // Add forces or dye if input texture is provided
    if (inputTexture) {
      // TODO: Convert input texture to forces or dye based on its content
      // This would depend on the specific implementation needs
    }
    
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