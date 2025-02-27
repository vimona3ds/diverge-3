import * as THREE from 'three';
import { INode, INodeDefinition, PortType, ProcessContext } from '../../../types/node';
import { Metaballs, IMetaball } from '../../../../systems/visual/techniques/Metaballs';
import { VisualSystem } from '../../../../systems/visual/VisualSystem';

/**
 * Extended ProcessContext with input/output methods
 */
interface VisualProcessContext extends ProcessContext {
  getInputData: (nodeId: string, portId: string) => any;
  setOutputData: (nodeId: string, portId: string, data: any) => void;
}

/**
 * Node definition for Metaballs visual effect
 */
export const MetaballsNode: INodeDefinition = {
  type: 'metaballs',
  category: 'source',
  system: 'visual',
  
  inputs: [
    {
      id: 'mask',
      name: 'Mask',
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
      id: 'threshold',
      name: 'Threshold',
      type: 'float',
      defaultValue: 0.65,
      min: 0.01,
      max: 2.0,
      step: 0.01
    },
    {
      id: 'colorMapping',
      name: 'Color Mapping',
      type: 'select',
      defaultValue: 'custom',
      options: [
        { label: 'Grayscale', value: 'grayscale' },
        { label: 'Heatmap', value: 'heatmap' },
        { label: 'Custom', value: 'custom' }
      ]
    },
    {
      id: 'customColorA',
      name: 'Color A',
      type: 'color',
      defaultValue: new THREE.Color(0x0088ff)
    },
    {
      id: 'customColorB',
      name: 'Color B',
      type: 'color',
      defaultValue: new THREE.Color(0xff8800)
    }
  ],
  
  /**
   * Initialize the Metaballs node
   * @param node The node instance to initialize
   */
  initialize: (node: INode) => {
    // Create metaballs array with random positions
    const metaballs: IMetaball[] = Array.from({ length: 8 }, () => ({
      position: new THREE.Vector2(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ),
      radius: 0.1 + Math.random() * 0.2,
      strength: 0.5 + Math.random() * 0.5
    }));
    
    // Store metaballs in node state
    node.state.metaballs = metaballs;
    
    // Set initialized flag
    node.state.initialized = true;
    
    // Create a disposal function
    node.state.dispose = () => {
      if (node.state.technique) {
        (node.state.technique as Metaballs).dispose();
        node.state.technique = null;
      }
    };
  },
  
  /**
   * Process the Metaballs node
   * @param node The node instance to process
   * @param context The processing context
   */
  process: (node: INode, context: ProcessContext) => {
    const visualContext = context as VisualProcessContext;
    
    // Create or get technique instance
    if (!node.state.technique) {
      const technique = new Metaballs(node.id);
      
      // Initialize the technique with WebGL renderer
      technique.initialize(visualContext.renderer);
      
      // Store in node state
      node.state.technique = technique;
    }
    
    const technique = node.state.technique as Metaballs;
    
    // Update technique parameters from node params
    technique.updateParams({
      metaballs: node.state.metaballs as IMetaball[],
      threshold: node.params.threshold as number,
      colorMapping: node.params.colorMapping as 'grayscale' | 'heatmap' | 'custom',
      customColorA: node.params.customColorA as THREE.Color,
      customColorB: node.params.customColorB as THREE.Color
    });
    
    // Render the technique to its internal target
    technique.render(visualContext.renderer);
    
    // Get the output texture from technique (BaseTechnique should have this method)
    // TODO: Implement getOutputTexture() in BaseTechnique if it doesn't exist
    const outputTexture = (technique as any).getOutputTexture();
    
    // Set output data
    if (outputTexture) {
      visualContext.setOutputData(node.id, 'output', outputTexture);
    }
  }
}; 