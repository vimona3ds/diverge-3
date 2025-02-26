import React, { useState, useEffect } from 'react';
import { Engine } from '../../core/engine/Engine';
import { INode, INodeParam } from '../../core/types/node';
import { NodeRegistry } from '../../core/nodes/NodeRegistry';
import './Sidebar.css';

interface SidebarProps {
  engine: Engine;
  selectedNodeId: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({ engine, selectedNodeId }) => {
  const [selectedNode, setSelectedNode] = useState<INode | null>(null);
  const [nodeParams, setNodeParams] = useState<INodeParam[]>([]);
  
  // Get node registry to fetch node definitions
  const nodeRegistry = NodeRegistry.getInstance();
  
  // Update selected node when selectedNodeId changes
  useEffect(() => {
    if (selectedNodeId) {
      const graph = engine.getGraph();
      const node = graph.nodes[selectedNodeId];
      setSelectedNode(node);
      
      if (node) {
        const definition = nodeRegistry.getDefinition(node.type);
        if (definition) {
          setNodeParams(definition.params);
        } else {
          setNodeParams([]);
        }
      }
    } else {
      setSelectedNode(null);
      setNodeParams([]);
    }
  }, [selectedNodeId, engine, nodeRegistry]);
  
  if (!selectedNode) {
    return (
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Node Properties</h2>
        </div>
        <div className="sidebar-content">
          <p className="sidebar-empty-message">Select a node to view and edit its properties.</p>
        </div>
      </div>
    );
  }
  
  const handleParamChange = (paramId: string, value: any) => {
    if (!selectedNode) return;
    
    const graph = engine.getGraph();
    const node = graph.nodes[selectedNode.id];
    if (!node) return;
    
    // Update the node param
    node.params[paramId] = value;
    
    // Update the graph
    engine.setGraph(graph);
  };
  
  const renderParamControl = (param: INodeParam) => {
    const value = selectedNode?.params[param.id];
    
    switch (param.type) {
      case 'float':
      case 'int':
        return (
          <div className="param-control" key={param.id}>
            <label htmlFor={param.id}>{param.name}</label>
            <div className="param-control-row">
              <input
                id={param.id}
                type="range"
                min={param.min ?? 0}
                max={param.max ?? 100}
                step={param.type === 'int' ? 1 : (param.step ?? 0.01)}
                value={value}
                onChange={(e) => handleParamChange(param.id, param.type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value))}
              />
              <input
                type="number"
                min={param.min}
                max={param.max}
                step={param.type === 'int' ? 1 : (param.step ?? 0.01)}
                value={value}
                onChange={(e) => handleParamChange(param.id, param.type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value))}
                className="param-number-input"
              />
            </div>
          </div>
        );
        
      case 'boolean':
        return (
          <div className="param-control" key={param.id}>
            <div className="param-control-checkbox">
              <input
                id={param.id}
                type="checkbox"
                checked={value}
                onChange={(e) => handleParamChange(param.id, e.target.checked)}
              />
              <label htmlFor={param.id}>{param.name}</label>
            </div>
          </div>
        );
        
      case 'select':
        return (
          <div className="param-control" key={param.id}>
            <label htmlFor={param.id}>{param.name}</label>
            <select
              id={param.id}
              value={value}
              onChange={(e) => handleParamChange(param.id, e.target.value)}
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
          <div className="param-control" key={param.id}>
            <label htmlFor={param.id}>{param.name}</label>
            <div className="param-control-color">
              <input
                id={param.id}
                type="color"
                value={value}
                onChange={(e) => handleParamChange(param.id, e.target.value)}
              />
              <input
                type="text"
                value={value}
                onChange={(e) => handleParamChange(param.id, e.target.value)}
                className="param-color-text"
              />
            </div>
          </div>
        );
        
      case 'string':
        return (
          <div className="param-control" key={param.id}>
            <label htmlFor={param.id}>{param.name}</label>
            <input
              id={param.id}
              type="text"
              value={value}
              onChange={(e) => handleParamChange(param.id, e.target.value)}
            />
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>{selectedNode.type}</h2>
        <div className="sidebar-node-id">ID: {selectedNode.id}</div>
      </div>
      
      <div className="sidebar-content">
        <div className="param-section">
          <h3>Parameters</h3>
          {nodeParams.length > 0 ? (
            nodeParams.map((param) => renderParamControl(param))
          ) : (
            <p className="sidebar-empty-message">This node has no parameters.</p>
          )}
        </div>
        
        <div className="param-section">
          <h3>Inputs</h3>
          <div className="port-list">
            {Object.values(selectedNode.inputs).map((input) => (
              <div key={input.id} className={`port-item ${input.connected ? 'connected' : ''}`}>
                <div className="port-name">{input.name}</div>
                <div className="port-type">{input.type}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="param-section">
          <h3>Outputs</h3>
          <div className="port-list">
            {Object.values(selectedNode.outputs).map((output) => (
              <div key={output.id} className={`port-item ${output.connections.length > 0 ? 'connected' : ''}`}>
                <div className="port-name">{output.name}</div>
                <div className="port-type">{output.type}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar; 