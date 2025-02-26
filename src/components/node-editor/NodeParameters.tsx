import React, { useState } from 'react';
import { INode, INodeParam } from '../../core/types/node';
import { NodeRegistry } from '../../core/nodes/NodeRegistry';
import './NodeEditor.css';

interface NodeParametersProps {
  node: INode;
  onParamChange: (nodeId: string, paramId: string, value: any) => void;
}

const NodeParameters: React.FC<NodeParametersProps> = ({ node, onParamChange }) => {
  const [expanded, setExpanded] = useState(false);
  const nodeRegistry = NodeRegistry.getInstance();
  const nodeDefinition = nodeRegistry.getDefinition(node.type);
  
  if (!nodeDefinition || nodeDefinition.params.length === 0) {
    return null;
  }
  
  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };
  
  const handleParamChange = (paramId: string, value: any) => {
    onParamChange(node.id, paramId, value);
  };
  
  const renderParamControl = (param: INodeParam) => {
    const value = node.params[param.id];
    
    switch (param.type) {
      case 'float':
      case 'int':
        return (
          <div className="node-param-row" key={param.id}>
            <label className="node-param-label">{param.name}</label>
            <input
              className="node-param-slider"
              type="range"
              min={param.min ?? 0}
              max={param.max ?? 100}
              step={param.type === 'int' ? 1 : (param.step ?? 0.01)}
              value={value}
              onChange={(e) => {
                const newValue = param.type === 'int' 
                  ? parseInt(e.target.value) 
                  : parseFloat(e.target.value);
                handleParamChange(param.id, newValue);
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="node-param-value">{value.toFixed(param.type === 'int' ? 0 : 2)}</div>
          </div>
        );
        
      case 'boolean':
        return (
          <div className="node-param-row" key={param.id}>
            <input
              className="node-param-checkbox"
              id={`param-${node.id}-${param.id}`}
              type="checkbox"
              checked={value}
              onChange={(e) => handleParamChange(param.id, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
            />
            <label 
              className="node-param-label checkbox-label" 
              htmlFor={`param-${node.id}-${param.id}`}
              onClick={(e) => e.stopPropagation()}
            >
              {param.name}
            </label>
          </div>
        );
        
      case 'select':
        return (
          <div className="node-param-row" key={param.id}>
            <label className="node-param-label">{param.name}</label>
            <select
              className="node-param-select"
              value={value}
              onChange={(e) => handleParamChange(param.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
            >
              {param.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );
        
      case 'color':
        return (
          <div className="node-param-row" key={param.id}>
            <label className="node-param-label">{param.name}</label>
            <input
              className="node-param-color"
              type="color"
              value={value}
              onChange={(e) => handleParamChange(param.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        );
        
      case 'string':
        return (
          <div className="node-param-row" key={param.id}>
            <label className="node-param-label">{param.name}</label>
            <input
              className="node-param-text"
              type="text"
              value={value}
              onChange={(e) => handleParamChange(param.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="node-parameters" onClick={(e) => e.stopPropagation()}>
      <div className="node-parameters-header" onClick={toggleExpanded}>
        <span className="node-parameters-title">Parameters</span>
        <span className="node-parameters-toggle">
          {expanded ? '▼' : '▶'}
        </span>
      </div>
      
      {expanded && (
        <div className="node-parameters-content">
          {nodeDefinition.params.map(param => renderParamControl(param))}
        </div>
      )}
    </div>
  );
};

export default NodeParameters; 