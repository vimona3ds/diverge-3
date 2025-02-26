import React, { useState, useEffect } from 'react';
import { NodeRegistry } from '../../core/nodes/NodeRegistry';
import { INodeDefinition } from '../../core/types/node';

interface NodeLibraryProps {
  onSelectNodeType: (type: string) => void;
  onClose: () => void;
}

interface CategoryMap {
  [category: string]: INodeDefinition[];
}

const NodeLibrary: React.FC<NodeLibraryProps> = ({ 
  onSelectNodeType, 
  onClose 
}) => {
  const [nodesByCategory, setNodesByCategory] = useState<CategoryMap>({});
  const [filter, setFilter] = useState('');
  
  useEffect(() => {
    const registry = NodeRegistry.getInstance();
    const definitions = registry.getAllDefinitions();
    
    // Group nodes by category
    const categorized: CategoryMap = {};
    
    for (const def of definitions) {
      if (!categorized[def.category]) {
        categorized[def.category] = [];
      }
      categorized[def.category].push(def);
    }
    
    // Sort categories and nodes within categories
    const sorted: CategoryMap = {};
    
    // Determine display order of categories
    const categoryOrder = [
      'source', 
      'process', 
      'parameter', 
      'bridge', 
      'output'
    ];
    
    // Sort categories by the predefined order
    for (const category of categoryOrder) {
      if (categorized[category]) {
        sorted[category] = categorized[category].sort((a, b) => 
          a.type.localeCompare(b.type)
        );
      }
    }
    
    // Add any remaining categories
    for (const category in categorized) {
      if (!sorted[category]) {
        sorted[category] = categorized[category].sort((a, b) => 
          a.type.localeCompare(b.type)
        );
      }
    }
    
    setNodesByCategory(sorted);
  }, []);
  
  const handleNodeSelect = (type: string) => {
    onSelectNodeType(type);
  };
  
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value.toLowerCase());
  };
  
  // Formats a type or category string for display
  const formatLabel = (str: string) => {
    return str
      .replace(/([A-Z])/g, ' $1') // Insert a space before all capital letters
      .replace(/^./, (str) => str.toUpperCase()); // Uppercase the first letter
  };
  
  return (
    <div className="node-library">
      <div className="node-library-header">
        <div className="node-library-title">Node Library</div>
        <button 
          className="node-library-close-btn"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      
      <div className="node-library-search">
        <input
          type="text"
          placeholder="Search nodes..."
          value={filter}
          onChange={handleFilterChange}
          className="node-library-search-input"
        />
      </div>
      
      <div className="node-library-categories">
        {Object.entries(nodesByCategory).map(([category, nodes]) => {
          // Filter nodes based on search term
          const filteredNodes = filter 
            ? nodes.filter(node => 
                node.type.toLowerCase().includes(filter)
              )
            : nodes;
          
          // Skip empty categories after filtering
          if (filteredNodes.length === 0) return null;
          
          return (
            <div key={category} className="node-category">
              <div className="node-category-title">
                {formatLabel(category)}
              </div>
              <div className="node-type-list">
                {filteredNodes.map(node => (
                  <div 
                    key={node.type} 
                    className="node-type-item"
                    onClick={() => handleNodeSelect(node.type)}
                  >
                    {formatLabel(node.type)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NodeLibrary; 