import React, { useState } from 'react';
import { Engine } from '../../core/engine/Engine';
import './Toolbar.css';

interface ToolbarProps {
  engine: Engine;
}

const Toolbar: React.FC<ToolbarProps> = ({ engine }) => {
  const [isRunning, setIsRunning] = useState(true);
  
  const handlePlayPause = () => {
    if (isRunning) {
      engine.stop();
    } else {
      engine.start();
    }
    setIsRunning(!isRunning);
  };
  
  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the graph? This cannot be undone.')) {
      engine.setGraph({ nodes: {}, connections: {} });
    }
  };
  
  const handleLoadFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          const graph = JSON.parse(text);
          engine.setGraph(graph);
        } catch (error) {
          console.error('Failed to load graph:', error);
          alert('Failed to load graph file. Please ensure it is a valid JSON file.');
        }
      }
    };
    input.click();
  };
  
  const handleSaveFile = () => {
    const graph = engine.getGraph();
    const json = JSON.stringify(graph, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `audiovisual-graph-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleLoadAsset = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const assetManager = engine.getAssetManager();
          
          if (file.type.startsWith('audio/')) {
            await assetManager.loadAudio(file);
          } else if (file.type.startsWith('image/')) {
            await assetManager.loadImage(file);
          }
        } catch (error) {
          console.error('Failed to load asset:', error);
          alert('Failed to load asset file.');
        }
      }
    };
    input.click();
  };
  
  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <button className="toolbar-button" onClick={handlePlayPause}>
          {isRunning ? '⏸️ Pause' : '▶️ Play'}
        </button>
      </div>
      
      <div className="toolbar-section">
        <button className="toolbar-button" onClick={handleLoadFile}>
          📂 Load Graph
        </button>
        <button className="toolbar-button" onClick={handleSaveFile}>
          💾 Save Graph
        </button>
      </div>
      
      <div className="toolbar-section">
        <button className="toolbar-button" onClick={handleLoadAsset}>
          🔊 Load Asset
        </button>
      </div>
      
      <div className="toolbar-section">
        <button className="toolbar-button danger" onClick={handleClear}>
          🗑️ Clear
        </button>
      </div>
    </div>
  );
};

export default Toolbar; 