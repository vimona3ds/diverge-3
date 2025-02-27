import * as THREE from 'three';
import { INode, INodeDefinition, PortType, ProcessContext } from '../../../types/node';
import { FractalNoise } from '../../../../systems/visual/techniques/FractalNoise';
import { VisualSystem } from '../../../../systems/visual/VisualSystem';

/**
 * Extended ProcessContext with input/output methods
 */
interface VisualProcessContext extends ProcessContext {
  getInputData: (nodeId: string, portId: string) => any;
  setOutputData: (nodeId: string, portId: string, data: any) => void;
}

/**
 * Node definition for FractalNoise visual effect
 */
export const FractalNoiseNode: INodeDefinition = {
  type: 'fractalNoise',
  category: 'source',
  system: 'visual',
  
  inputs: [],
  
  outputs: [
    {
      id: 'output',
      name: 'Output',
      type: PortType.TEXTURE
    }
  ],
  
  params: [
    {
      id: 'scale',
      name: 'Scale',
      type: 'float',
      defaultValue: 3.0,
      min: 0.1,
      max: 10.0,
      step: 0.1
    },
    {
      id: 'octaves',
      name: 'Octaves',
      type: 'int',
      defaultValue: 5,
      min: 1,
      max: 8,
      step: 1
    },
    {
      id: 'persistence',
      name: 'Persistence',
      type: 'float',
      defaultValue: 0.5,
      min: 0.0,
      max: 1.0,
      step: 0.01
    },
    {
      id: 'lacunarity',
      name: 'Lacunarity',
      type: 'float',
      defaultValue: 2.0,
      min: 1.0,
      max: 3.0,
      step: 0.01
    },
    {
      id: 'noiseType',
      name: 'Noise Type',
      type: 'select',
      defaultValue: 'simplex',
      options: [
        { label: 'Simplex', value: 'simplex' },
        { label: 'Perlin', value: 'perlin' },
        { label: 'Worley', value: 'worley' },
        { label: 'Value', value: 'value' }
      ]
    },
    {
      id: 'domain',
      name: 'Domain',
      type: 'select',
      defaultValue: 'normal',
      options: [
        { label: 'Normal', value: 'normal' },
        { label: 'Ridged', value: 'ridged' },
        { label: 'Turbulent', value: 'turbulent' },
        { label: 'Terraced', value: 'terraced' }
      ]
    },
    {
      id: 'colorMode',
      name: 'Color Mode',
      type: 'select',
      defaultValue: 'grayscale',
      options: [
        { label: 'Grayscale', value: 'grayscale' },
        { label: 'Colorful', value: 'colorful' },
        { label: 'Custom', value: 'custom' }
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
      defaultValue: new THREE.Color(0xffffff)
    },
    {
      id: 'timeScale',
      name: 'Time Scale',
      type: 'float',
      defaultValue: 0.1,
      min: 0.0,
      max: 1.0,
      step: 0.01
    },
    {
      id: 'seed',
      name: 'Seed',
      type: 'float',
      defaultValue: 123.456,
      min: 0.0,
      max: 1000.0,
      step: 0.001
    }
  ],
  
  /**
   * Initialize the FractalNoise node
   * @param node The node instance to initialize
   */
  initialize: (node: INode) => {
    // Set initialized flag
    node.state = node.state || {};
    node.state.initialized = true;
    
    // Create a disposal function
    node.state.dispose = () => {
      if (node.state && node.state.technique) {
        (node.state.technique as FractalNoise).dispose();
        node.state.technique = null;
      }
    };
  },
  
  /**
   * Process the FractalNoise node
   * @param node The node instance to process
   * @param context The processing context
   */
  process: (node: INode, context: ProcessContext) => {
    const visualContext = context as VisualProcessContext;
    
    if (!node.state) {
      node.state = {};
    }
    
    // Create or get technique instance
    if (!node.state.technique) {
      const technique = new FractalNoise(node.id);
      
      // Initialize the technique with WebGL renderer
      technique.initialize(visualContext.renderer);
      
      // Store in node state
      node.state.technique = technique;
    }
    
    const technique = node.state.technique as FractalNoise;
    
    // Update technique parameters from node params
    technique.updateParams({
      scale: node.params.scale as number,
      octaves: node.params.octaves as number,
      persistence: node.params.persistence as number,
      lacunarity: node.params.lacunarity as number,
      noiseType: node.params.noiseType as 'simplex' | 'perlin' | 'worley' | 'value',
      domain: node.params.domain as 'normal' | 'ridged' | 'turbulent' | 'terraced',
      colorMode: node.params.colorMode as 'grayscale' | 'colorful' | 'custom',
      colorA: node.params.colorA as THREE.Color,
      colorB: node.params.colorB as THREE.Color,
      timeScale: node.params.timeScale as number,
      seed: node.params.seed as number
    });
    
    // Render the technique to its internal target
    technique.render(visualContext.renderer);
    
    // Get the output texture from technique - use any casting as the method comes from BaseTechnique
    const outputTexture = (technique as any).getOutputTexture();
    
    // Set output data
    if (outputTexture) {
      visualContext.setOutputData(node.id, 'output', outputTexture);
    }
  }
}; 