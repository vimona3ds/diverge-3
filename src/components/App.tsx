import React, { useEffect, useState } from 'react';
import NodeEditor from './node-editor/NodeEditor';
import Viewport from './viewport/Viewport';
import Toolbar from './ui/Toolbar';
import Sidebar from './ui/Sidebar';
import { Engine } from '../core/engine/Engine';
import '../styles/app.css';

const App: React.FC = () => {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Initialize engine when component mounts
  useEffect(() => {
    const newEngine = new Engine();
    setEngine(newEngine);
    
    // Clean up engine when component unmounts
    return () => {
      newEngine.dispose();
    };
  }, []);
  
  const handleInitializeAudio = async () => {
    if (!engine || audioInitialized) return;
    
    try {
      await engine.initialize();
      setAudioInitialized(true);
      engine.start();
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  };
  
  const handleNodeSelect = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  };
  
  if (!engine) {
    return <div className="loading">Loading...</div>;
  }
  
  return (
    <div className="app">
      {!audioInitialized && (
        <div className="audio-init-overlay">
          <div className="audio-init-container">
            <h2>Audiovisual Node Playground</h2>
            <p>Click the button below to enable audio and start the application.</p>
            <button onClick={handleInitializeAudio}>Start</button>
          </div>
        </div>
      )}
      
      <Toolbar engine={engine} />
      
      <div className="main-content">
        <NodeEditor 
          engine={engine} 
          onNodeSelect={handleNodeSelect}
          selectedNodeId={selectedNodeId}
        />
        
        <Viewport engine={engine} />
      </div>
      
      <Sidebar 
        engine={engine} 
        selectedNodeId={selectedNodeId}
      />
    </div>
  );
};

export default App; 