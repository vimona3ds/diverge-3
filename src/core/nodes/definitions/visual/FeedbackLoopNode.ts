import * as THREE from 'three';
import { INode, INodeDefinition, PortType, ProcessContext } from '../../../types/node';
import { FeedbackLoop, FeedbackLoopParams } from '../../../../systems/visual/techniques/FeedbackLoop';

/**
 * Extended ProcessContext with input/output methods
 */
interface VisualProcessContext extends ProcessContext {
  getInputData: (nodeId: string, portId: string) => any;
  setOutputData: (nodeId: string, portId: string, data: any) => void;
}

/**
 * Node definition for Feedback Loop visual effect
 */
export const FeedbackLoopNode: INodeDefinition = {
  type: 'feedbackLoop',
  category: 'process',
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
      id: 'feedbackStrength',
      name: 'Feedback Strength',
      type: 'float',
      defaultValue: 0.9,
      min: 0.0,
      max: 1.0,
      step: 0.01
    },
    {
      id: 'translateX',
      name: 'Translate X',
      type: 'float',
      defaultValue: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.01
    },
    {
      id: 'translateY',
      name: 'Translate Y',
      type: 'float',
      defaultValue: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.01
    },
    {
      id: 'scale',
      name: 'Scale',
      type: 'float',
      defaultValue: 1.0,
      min: 0.5,
      max: 1.5,
      step: 0.01
    },
    {
      id: 'rotation',
      name: 'Rotation',
      type: 'float',
      defaultValue: 0.0,
      min: -Math.PI,
      max: Math.PI,
      step: 0.01
    },
    {
      id: 'blend',
      name: 'Blend Mode',
      type: 'select',
      defaultValue: 'screen',
      options: [
        { label: 'Add', value: 'add' },
        { label: 'Multiply', value: 'multiply' },
        { label: 'Screen', value: 'screen' },
        { label: 'Overlay', value: 'overlay' }
      ]
    },
    {
      id: 'fadeRate',
      name: 'Fade Rate',
      type: 'float',
      defaultValue: 0.05,
      min: 0.0,
      max: 1.0,
      step: 0.01
    },
    {
      id: 'colorShift',
      name: 'Color Shift',
      type: 'boolean',
      defaultValue: false
    },
    {
      id: 'colorShiftRate',
      name: 'Color Shift Rate',
      type: 'float',
      defaultValue: 0.01,
      min: 0.0,
      max: 0.1,
      step: 0.001
    }
  ],
  
  /**
   * Initialize the Feedback Loop node
   * @param node The node instance to initialize
   */
  initialize: (node: INode) => {
    // Set initialized flag
    node.state.initialized = true;
    
    // Create a disposal function
    node.state.dispose = () => {
      if (node.state.technique) {
        (node.state.technique as FeedbackLoop).dispose();
        node.state.technique = null;
      }
    };

    // Track input connection state
    node.state.wasInputConnected = false;
  },
  
  /**
   * Process the Feedback Loop node
   * @param node The node instance to process
   * @param context The processing context
   */
  process: (node: INode, context: ProcessContext) => {
    const visualContext = context as VisualProcessContext;
    
    // Check if input is connected
    const isInputConnected = node.inputs.input.connected;
    
    // Get input texture if connected
    const inputTexture = isInputConnected ? 
      visualContext.getInputData(node.id, 'input') : null;
    
    // If input is not connected, we can't process
    if (!inputTexture) {
      if (node.state.technique) {
        // Don't render but keep the technique
        return;
      }
    }
    
    // Create or get technique instance
    if (!node.state.technique) {
      const technique = new FeedbackLoop(node.id);
      
      // Initialize the technique with WebGL renderer
      technique.initialize(visualContext.renderer);
      
      // Store in node state
      node.state.technique = technique;
    }
    
    const technique = node.state.technique as FeedbackLoop;
    
    // Check if input connection state changed from disconnected to connected
    // If so, reset the feedback loop to prevent stale data
    if (isInputConnected && !node.state.wasInputConnected) {
      technique.reset();
    }
    
    // Update connection state for next frame
    node.state.wasInputConnected = isInputConnected;
    
    // Update technique parameters from node params
    technique.updateParams({
      feedbackStrength: node.params.feedbackStrength as number,
      translateX: node.params.translateX as number,
      translateY: node.params.translateY as number,
      scale: node.params.scale as number,
      rotation: node.params.rotation as number,
      blend: node.params.blend as 'add' | 'multiply' | 'screen' | 'overlay',
      fadeRate: node.params.fadeRate as number,
      colorShift: node.params.colorShift as boolean,
      colorShiftRate: node.params.colorShiftRate as number,
      feedbackTexture: inputTexture
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