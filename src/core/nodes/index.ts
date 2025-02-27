// Export node system components
export { NodeRegistry } from './NodeRegistry';

// Export node definitions
export * from './definitions';

// Initialize node registry
import { NodeRegistry } from './NodeRegistry';
import * as visualNodes from './definitions/visual';

// Get instance
const registry = NodeRegistry.getInstance();

// Register visual nodes when imported
function registerVisualNodes() {
  // Get all exports from visual nodes
  const nodes = Object.values(visualNodes);
  
  // Register each node
  nodes.forEach(node => {
    if (node && typeof node === 'object' && 'type' in node) {
      registry.register(node);
    }
  });
}

// Register visual nodes
registerVisualNodes(); 