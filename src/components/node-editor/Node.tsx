import React from 'react';
import { INode, IInputPort, IOutputPort } from '../../core/types/node';
import NodeParameters from './NodeParameters';

interface NodeProps {
  node: INode;
  selected: boolean;
  onSelect: (nodeId: string, e: React.MouseEvent) => void;
  onDragStart: (nodeId: string, e: React.MouseEvent) => void;
  onConnectionStart: (nodeId: string, portId: string, e: React.MouseEvent) => void;
  onConnectionEnd: (nodeId: string, portId: string) => void;
  onDelete: (nodeId: string) => void;
  onParamChange: (nodeId: string, paramId: string, value: any) => void;
}

const Node: React.FC<NodeProps> = ({
  node,
  selected,
  onSelect,
  onDragStart,
  onConnectionStart,
  onConnectionEnd,
  onDelete,
  onParamChange
}) => {
  // Get node title from type, formatted with spaces
  const getNodeTitle = () => {
    return node.type
      .replace(/([A-Z])/g, ' $1') // Insert a space before all capital letters
      .replace(/^./, (str) => str.toUpperCase()); // Uppercase the first letter
  };

  // Define category-based colors for nodes
  const getCategoryColor = () => {
    const categoryColors: Record<string, string> = {
      source: '#4CAF50',      // Green
      process: '#2196F3',     // Blue
      parameter: '#9C27B0',   // Purple
      bridge: '#FF9800',      // Orange
      output: '#F44336'       // Red
    };
    
    // Extract category from node definition (stored somewhere in the system)
    // For now, just use a simple mapping based on node type
    const typeToCategory: Record<string, string> = {
      oscillator: 'source',
      filter: 'process',
      amplifier: 'process',
      output: 'output',
      // Add more mappings as needed
    };
    
    const category = typeToCategory[node.type] || 'process';
    return categoryColors[category] || '#607D8B'; // Default to gray if not found
  };

  // Render input port
  const renderInputPort = (portId: string, port: IInputPort) => (
    <div 
      key={portId}
      className={`node-port node-input-port ${port.connected ? 'connected' : ''}`}
      onMouseUp={() => onConnectionEnd(node.id, portId)}
    >
      <div className="port-point" />
      <div className="port-label">{port.name}</div>
    </div>
  );

  // Render output port
  const renderOutputPort = (portId: string, port: IOutputPort) => (
    <div 
      key={portId}
      className={`node-port node-output-port ${port.connections.length > 0 ? 'connected' : ''}`}
    >
      <div className="port-label">{port.name}</div>
      <div 
        className="port-point" 
        onMouseDown={(e) => onConnectionStart(node.id, portId, e)}
      />
    </div>
  );

  // Handle delete button click
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(node.id);
  };

  return (
    <div 
      className={`node ${selected ? 'selected' : ''}`}
      style={{
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        backgroundColor: getCategoryColor()
      }}
      onClick={(e) => onSelect(node.id, e)}
      onMouseDown={(e) => {
        // Only start dragging on the header
        if ((e.target as HTMLElement).closest('.node-header')) {
          onDragStart(node.id, e);
        }
      }}
    >
      <div className="node-header">
        <div className="node-title">{getNodeTitle()}</div>
        <button className="node-delete-btn" onClick={handleDelete}>×</button>
      </div>
      
      <div className="node-content">
        <div className="node-ports">
          <div className="node-inputs">
            {Object.entries(node.inputs).map(([portId, port]) => 
              renderInputPort(portId, port)
            )}
          </div>
          
          <div className="node-outputs">
            {Object.entries(node.outputs).map(([portId, port]) => 
              renderOutputPort(portId, port)
            )}
          </div>
        </div>
        
        <NodeParameters 
          node={node} 
          onParamChange={onParamChange} 
        />
      </div>
    </div>
  );
};

export default Node; 