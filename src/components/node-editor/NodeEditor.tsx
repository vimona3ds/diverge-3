import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Engine } from '../../core/engine/Engine';
import { IConnection, INode, INodeDefinition } from '../../core/types/node';
import { NodeRegistry } from '../../core/nodes/NodeRegistry';
import Node from './Node';
import Connection from './Connection';
import ContextMenu from './ContextMenu';
import NodeLibrary from './NodeLibrary';
import NodeGroup, { INodeGroup } from './NodeGroup';
import './NodeEditor.css';
import { v4 as uuidv4 } from 'uuid';

interface NodeEditorProps {
  engine: Engine;
  onNodeSelect: (nodeId: string | null) => void;
  selectedNodeId: string | null;
}

// History action types for undo/redo
interface HistoryAction {
  type: 'ADD_NODE' | 'DELETE_NODE' | 'MOVE_NODE' | 'ADD_CONNECTION' | 'DELETE_CONNECTION' | 'UPDATE_PARAM' | 'ADD_GROUP' | 'DELETE_GROUP' | 'MOVE_GROUP' | 'RESIZE_GROUP' | 'UPDATE_GROUP_TITLE' | 'TOGGLE_GROUP_COLLAPSE' | 'UPDATE_GROUP_COLOR' | 'ADD_NODE_TO_GROUP' | 'REMOVE_NODE_FROM_GROUP';
  data: any;
  inverse: () => void;
}

const NodeEditor: React.FC<NodeEditorProps> = ({ engine, onNodeSelect, selectedNodeId }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [graph, setGraph] = useState<{ nodes: Record<string, INode>, connections: Record<string, IConnection> }>({ nodes: {}, connections: {} });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [connectingInfo, setConnectingInfo] = useState<{
    sourceNodeId: string;
    sourcePortId: string;
    mousePosition: { x: number, y: number };
  } | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number, y: number };
    items: Array<{ label: string, onClick: () => void, separator?: boolean }>;
  } | null>(null);
  const [showNodeLibrary, setShowNodeLibrary] = useState(false);
  const [libraryPosition, setLibraryPosition] = useState({ x: 0, y: 0 });
  
  // Undo/redo history
  const [history, setHistory] = useState<HistoryAction[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Node registry for obtaining node definitions
  const nodeRegistry = NodeRegistry.getInstance();
  
  // Add new states to the component (inside the NodeEditor component)
  const [groups, setGroups] = useState<Record<string, INodeGroup>>({});
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [draggingGroup, setDraggingGroup] = useState<string | null>(null);
  const [dragGroupOffset, setDragGroupOffset] = useState({ x: 0, y: 0 });
  
  // Get graph from engine on mount or when engine updates
  useEffect(() => {
    const graph = engine.getGraph();
    setGraph(graph);
    
    // Setup graph change listener
    const handler = () => {
      setGraph(engine.getGraph());
    };
    
    // TODO: Add listener when engine supports it
    // For now, we'll just update the graph ourselves
    
    return () => {
      // TODO: Remove listener
    };
  }, [engine]);
  
  // Add action to history
  const addToHistory = useCallback((action: HistoryAction) => {
    // Truncate future history if we're not at the end
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(action);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);
  
  // Undo last action
  const undo = useCallback(() => {
    if (historyIndex >= 0) {
      const action = history[historyIndex];
      action.inverse();
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);
  
  // Redo next action
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const action = history[historyIndex + 1];
      // Execute the original action again
      switch (action.type) {
        case 'ADD_NODE':
          addNode(action.data.type, action.data.position);
          break;
        case 'DELETE_NODE':
          handleDeleteNode(action.data.nodeId);
          break;
        case 'MOVE_NODE':
          handleMoveNode(action.data.nodeId, action.data.newPosition);
          break;
        case 'ADD_CONNECTION':
          handleAddConnection(
            action.data.sourceNodeId,
            action.data.sourcePortId,
            action.data.targetNodeId,
            action.data.targetPortId
          );
          break;
        case 'DELETE_CONNECTION':
          handleDeleteConnection(action.data.connectionId);
          break;
        case 'UPDATE_PARAM':
          handleUpdateParam(
            action.data.nodeId,
            action.data.paramId,
            action.data.newValue
          );
          break;
        case 'ADD_GROUP':
          handleCreateGroup(action.data.group.position);
          break;
        case 'DELETE_GROUP':
          handleDeleteGroup(action.data.id);
          break;
        case 'MOVE_GROUP':
          handleGroupMove(action.data.groupId, action.data.newPosition);
          break;
        case 'RESIZE_GROUP':
          handleGroupResize(action.data.groupId, action.data.newSize);
          break;
        case 'UPDATE_GROUP_TITLE':
          handleGroupTitleChange(action.data.groupId, action.data.newTitle);
          break;
        case 'TOGGLE_GROUP_COLLAPSE':
          handleGroupToggleCollapse(action.data.groupId);
          break;
        case 'UPDATE_GROUP_COLOR':
          handleGroupColorChange(action.data.groupId, action.data.newColor);
          break;
        case 'ADD_NODE_TO_GROUP':
          addNodeToGroup(action.data.nodeId, action.data.groupId);
          break;
        case 'REMOVE_NODE_FROM_GROUP':
          removeNodeFromGroup(action.data.nodeId, action.data.groupId);
          break;
      }
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      // Delete: Delete key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          handleDeleteNode(selectedNodeId);
        } else if (selectedConnection) {
          handleDeleteConnection(selectedConnection);
        }
      }
      // Escape: Close context menu or cancel connection
      if (e.key === 'Escape') {
        if (contextMenu) {
          setContextMenu(null);
        } else if (connectingInfo) {
          setConnectingInfo(null);
        } else if (showNodeLibrary) {
          setShowNodeLibrary(false);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo, selectedNodeId, selectedConnection, contextMenu, connectingInfo, showNodeLibrary]);
  
  // Handle mouse wheel for zooming
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(2, scale * delta));
    
    // Calculate zoom point (mouse position)
    const rect = editorRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate new position to zoom towards mouse
    setPosition({
      x: mouseX - (mouseX - position.x) * (newScale / scale),
      y: mouseY - (mouseY - position.y) * (newScale / scale)
    });
    
    setScale(newScale);
  };
  
  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    // Ignore if right-click (we handle that separately)
    if (e.button === 2) return;
    
    // Middle button or left without connecting
    if (e.button === 1 || (e.button === 0 && !connectingInfo)) {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      
      // Close context menu if open
      if (contextMenu) {
        setContextMenu(null);
      }
    }
  };
  
  // Handle mouse move for dragging nodes or canvas
  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNode) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPosition({
        x: position.x + dx,
        y: position.y + dy
      });
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (draggingGroup) {
      // Calculate new position based on mouse position and drag offset
      const newPosition = {
        x: e.clientX - dragGroupOffset.x,
        y: e.clientY - dragGroupOffset.y
      };
      
      // Update the group's position directly for smooth movement
      const groupsCopy = { ...groups };
      if (groupsCopy[draggingGroup]) {
        groupsCopy[draggingGroup].position = newPosition;
        
        // Also move all nodes in the group
        const group = groupsCopy[draggingGroup];
        const originalPosition = groups[draggingGroup].position;
        const deltaX = newPosition.x - originalPosition.x;
        const deltaY = newPosition.y - originalPosition.y;
        
        const graphCopy = { ...graph };
        group.nodeIds.forEach(nodeId => {
          const node = graphCopy.nodes[nodeId];
          if (node) {
            node.position = {
              x: node.position.x + deltaX,
              y: node.position.y + deltaY
            };
          }
        });
        
        setGraph(graphCopy);
      }
      
      setGroups(groupsCopy);
    } else if (isDraggingCanvas) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPosition({
        x: position.x + dx,
        y: position.y + dy
      });
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (connectingInfo) {
      setConnectingInfo({
        ...connectingInfo,
        mousePosition: { x: e.clientX, y: e.clientY }
      });
    }
  };
  
  // Handle mouse up for stopping drag
  const handleMouseUp = (e: React.MouseEvent) => {
    if (draggingNode) {
      // Save the node position if we were dragging a node
      const node = graph.nodes[draggingNode];
      if (node) {
        // Add move to history for undo/redo
        const oldPosition = { ...node.position };
        const newPosition = { ...node.position };
        
        addToHistory({
          type: 'MOVE_NODE',
          data: {
            nodeId: draggingNode,
            oldPosition,
            newPosition
          },
          inverse: () => {
            handleMoveNode(draggingNode, oldPosition);
          }
        });
      }
    } else if (draggingGroup) {
      // Handle group movement
      if (groups[draggingGroup]) {
        handleGroupMove(draggingGroup, groups[draggingGroup].position);
      }
      
      setDraggingGroup(null);
    } else if (isDraggingCanvas) {
      setIsDraggingCanvas(false);
      setDraggingNode(null);
    } else if (connectingInfo) {
      // Connection dropped in empty space - do nothing
      setConnectingInfo(null);
    }
  };
  
  // Handle node selection
  const handleNodeSelect = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeSelect(nodeId);
    setSelectedConnection(null);
  };
  
  // Handle connection selection
  const handleConnectionSelect = (connectionId: string) => {
    setSelectedConnection(connectionId);
    onNodeSelect(null);
  };
  
  // Handle node drag start
  const handleNodeDragStart = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const editorRect = editorRef.current?.getBoundingClientRect();
    if (editorRect) {
      const node = graph.nodes[nodeId];
      const mouseX = (e.clientX - editorRect.left - position.x) / scale;
      const mouseY = (e.clientY - editorRect.top - position.y) / scale;
      
      setDraggingNode(nodeId);
      setDragOffset({
        x: mouseX - node.position.x,
        y: mouseY - node.position.y
      });
    }
  };
  
  // Handle connection drag start
  const handleConnectionStart = (nodeId: string, portId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    setConnectingInfo({
      sourceNodeId: nodeId,
      sourcePortId: portId,
      mousePosition: { x: e.clientX, y: e.clientY }
    });
  };
  
  // Handle connection drag end
  const handleConnectionEnd = (targetNodeId: string, targetPortId: string) => {
    if (!connectingInfo) return;
    
    handleAddConnection(
      connectingInfo.sourceNodeId,
      connectingInfo.sourcePortId,
      targetNodeId,
      targetPortId
    );
    
    // Reset connecting info
    setConnectingInfo(null);
  };
  
  // Handle right click for context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Get mouse position in editor space
    const rect = editorRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = (e.clientX - rect.left - position.x) / scale;
    const y = (e.clientY - rect.top - position.y) / scale;
    
    const items = [
      {
        label: 'Add Node',
        onClick: () => {
          setLibraryPosition({ x, y });
          setShowNodeLibrary(true);
        }
      },
      {
        label: 'Create Group',
        onClick: () => {
          handleCreateGroup({ x, y });
        }
      }
    ];
    
    if (selectedNodeId) {
      items.push(
        {
          label: 'Delete Node',
          onClick: () => handleDeleteNode(selectedNodeId)
        }
      );
      
      // Add option to assign to group if not in one already
      const nodeInGroup = Object.values(groups).some(
        group => group.nodeIds.includes(selectedNodeId)
      );
      
      if (!nodeInGroup && Object.keys(groups).length > 0) {
        items.push(
          {
            label: 'Add to Group',
            onClick: () => {
              // Show sub menu with available groups
              const groupItems = Object.values(groups).map(group => ({
                label: group.title,
                onClick: () => addNodeToGroup(selectedNodeId, group.id)
              }));
              
              setContextMenu({
                position: { x: e.clientX, y: e.clientY },
                items: groupItems
              });
            }
          }
        );
      }
      
      if (nodeInGroup) {
        items.push(
          {
            label: 'Remove from Group',
            onClick: () => {
              const groupId = Object.keys(groups).find(
                id => groups[id].nodeIds.includes(selectedNodeId)
              );
              
              if (groupId) {
                removeNodeFromGroup(selectedNodeId, groupId);
              }
            }
          }
        );
      }
    }
    
    if (selectedGroupId) {
      items.push(
        {
          label: 'Delete Group',
          onClick: () => handleDeleteGroup(selectedGroupId)
        }
      );
    }
    
    if (selectedConnection) {
      items.push(
        {
          label: 'Delete Connection',
          onClick: () => handleDeleteConnection(selectedConnection)
        }
      );
    }
    
    setContextMenu({
      position: { x: e.clientX, y: e.clientY },
      items
    });
  };
  
  // Handle adding a node from library
  const handleNodeTypeSelect = (type: string) => {
    // Close the library
    setShowNodeLibrary(false);
    
    // Add the node at the saved position
    addNode(type, libraryPosition);
  };
  
  // Add a node at the specified position
  const addNode = (type: string, pos: { x: number, y: number }) => {
    const definition = nodeRegistry.getDefinition(type);
    if (!definition) {
      console.error(`Node definition for type "${type}" not found`);
      return;
    }
    
    // Create a node with default values
    const newNode: INode = {
      id: uuidv4(),
      type,
      position: { ...pos },
      inputs: {},
      outputs: {},
      params: {},
      state: {},
      processed: false
    };
    
    // Set up inputs based on definition
    for (const input of definition.inputs) {
      newNode.inputs[input.id] = {
        ...input,
        nodeId: newNode.id,
        connected: false
      };
    }
    
    // Set up outputs based on definition
    for (const output of definition.outputs) {
      newNode.outputs[output.id] = {
        ...output,
        nodeId: newNode.id,
        connections: []
      };
    }
    
    // Set default params
    for (const param of definition.params) {
      newNode.params[param.id] = param.defaultValue;
    }
    
    // Initialize the node
    if (definition.initialize) {
      definition.initialize(newNode);
    }
    
    // Update graph
    const graphCopy = { ...graph };
    graphCopy.nodes[newNode.id] = newNode;
    setGraph(graphCopy);
    engine.setGraph(graphCopy);
    
    // Add to history
    addToHistory({
      type: 'ADD_NODE',
      data: {
        nodeId: newNode.id,
        type,
        position: { ...pos }
      },
      inverse: () => {
        handleDeleteNode(newNode.id);
      }
    });
    
    // Select the new node
    onNodeSelect(newNode.id);
  };
  
  // Handle deleting a connection
  const handleDeleteConnection = (connectionId: string) => {
    const connection = graph.connections[connectionId];
    if (!connection) return;
    
    const graphCopy = { ...graph };
    
    // Store connection data for undo
    const connectionData = { ...connection };
    
    // Update source and target nodes
    const sourceNode = graphCopy.nodes[connection.sourceNodeId];
    const targetNode = graphCopy.nodes[connection.targetNodeId];
    
    if (sourceNode && sourceNode.outputs[connection.sourcePortId]) {
      sourceNode.outputs[connection.sourcePortId].connections = 
        sourceNode.outputs[connection.sourcePortId].connections.filter(id => id !== connectionId);
    }
    
    if (targetNode && targetNode.inputs[connection.targetPortId]) {
      targetNode.inputs[connection.targetPortId].connected = false;
    }
    
    // Delete the connection
    delete graphCopy.connections[connectionId];
    
    // Update graph
    setGraph(graphCopy);
    engine.setGraph(graphCopy);
    
    // Clear selection if selected
    if (connectionId === selectedConnection) {
      setSelectedConnection(null);
    }
    
    // Add to history
    addToHistory({
      type: 'DELETE_CONNECTION',
      data: {
        connectionId,
        sourceNodeId: connection.sourceNodeId,
        sourcePortId: connection.sourcePortId,
        targetNodeId: connection.targetNodeId,
        targetPortId: connection.targetPortId
      },
      inverse: () => {
        handleAddConnection(
          connectionData.sourceNodeId,
          connectionData.sourcePortId,
          connectionData.targetNodeId,
          connectionData.targetPortId
        );
      }
    });
  };
  
  // Handle deleting a node
  const handleDeleteNode = (nodeId: string) => {
    const node = graph.nodes[nodeId];
    if (!node) return;
    
    const graphCopy = { ...graph };
    
    // Store node data for undo
    const nodeData = JSON.parse(JSON.stringify(node));
    const nodeConnections: IConnection[] = [];
    
    // Delete all connections to/from this node
    for (const connId in graphCopy.connections) {
      const conn = graphCopy.connections[connId];
      if (conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId) {
        // Store for undo
        nodeConnections.push({ ...conn });
        handleDeleteConnection(connId);
      }
    }
    
    // Delete the node
    delete graphCopy.nodes[nodeId];
    
    // Update graph
    setGraph(graphCopy);
    engine.setGraph(graphCopy);
    
    // Clear selection if selected
    if (nodeId === selectedNodeId) {
      onNodeSelect(null);
    }
    
    // Add to history
    addToHistory({
      type: 'DELETE_NODE',
      data: {
        nodeId,
        node: nodeData,
        connections: nodeConnections
      },
      inverse: () => {
        // Re-add the node
        const graphCopy = { ...graph };
        graphCopy.nodes[nodeId] = nodeData;
        setGraph(graphCopy);
        engine.setGraph(graphCopy);
        
        // Re-add the connections
        for (const conn of nodeConnections) {
          handleAddConnection(
            conn.sourceNodeId,
            conn.sourcePortId,
            conn.targetNodeId,
            conn.targetPortId
          );
        }
      }
    });
  };
  
  // Handle moving a node directly (for undo/redo)
  const handleMoveNode = (nodeId: string, newPosition: { x: number, y: number }) => {
    const graphCopy = { ...graph };
    const node = graphCopy.nodes[nodeId];
    
    if (node) {
      node.position = { ...newPosition };
      setGraph(graphCopy);
      engine.setGraph(graphCopy);
    }
  };
  
  // Handle updating a node parameter
  const handleUpdateParam = (nodeId: string, paramId: string, value: any) => {
    const graphCopy = { ...graph };
    const node = graphCopy.nodes[nodeId];
    
    if (node) {
      // Store old value for undo
      const oldValue = node.params[paramId];
      
      // Update param
      node.params[paramId] = value;
      
      // Update graph
      setGraph(graphCopy);
      engine.setGraph(graphCopy);
      
      // Add to history
      addToHistory({
        type: 'UPDATE_PARAM',
        data: {
          nodeId,
          paramId,
          oldValue,
          newValue: value
        },
        inverse: () => {
          handleUpdateParam(nodeId, paramId, oldValue);
        }
      });
    }
  };
  
  // Handle editor canvas click
  const handleEditorClick = () => {
    onNodeSelect(null);
    setSelectedConnection(null);
    setSelectedGroupId(null);
    setContextMenu(null);
  };
  
  // Render nodes
  const renderNodes = () => {
    return Object.values(graph.nodes).map(node => (
      <Node
        key={node.id}
        node={node}
        selected={selectedNodeId === node.id}
        onSelect={handleNodeSelect}
        onDragStart={handleNodeDragStart}
        onConnectionStart={handleConnectionStart}
        onConnectionEnd={handleConnectionEnd}
        onDelete={handleDeleteNode}
        onParamChange={handleUpdateParam}
      />
    ));
  };
  
  // Render connections
  const renderConnections = () => {
    return Object.entries(graph.connections).map(([connectionId, connection]) => (
      <Connection
        key={connectionId}
        connection={connection}
        nodes={graph.nodes}
        selected={connectionId === selectedConnection}
        onSelect={handleConnectionSelect}
        onDelete={handleDeleteConnection}
      />
    ));
  };
  
  // Render temporary connection when dragging
  const renderTempConnection = () => {
    if (!connectingInfo) return null;
    
    const editorRect = editorRef.current?.getBoundingClientRect();
    if (!editorRect) return null;
    
    const sourceNode = graph.nodes[connectingInfo.sourceNodeId];
    if (!sourceNode) return null;
    
    // Get source port position
    // This calculation can be improved by getting actual DOM positions
    const sourcePort = {
      x: (sourceNode.position.x + 150) * scale + position.x, // Assuming node width is ~150px
      y: (sourceNode.position.y + 30 + (Object.keys(sourceNode.outputs).indexOf(connectingInfo.sourcePortId) * 25)) * scale + position.y // Approx port vertical position
    };
    
    const targetPos = {
      x: connectingInfo.mousePosition.x,
      y: connectingInfo.mousePosition.y
    };
    
    // Calculate control points for bezier curve
    const dx = Math.abs(targetPos.x - sourcePort.x) * 0.5;
    const controlPoint1 = {
      x: sourcePort.x + dx,
      y: sourcePort.y
    };
    
    const controlPoint2 = {
      x: targetPos.x - dx,
      y: targetPos.y
    };
    
    // Create cubic bezier path
    const pathString = `M ${sourcePort.x} ${sourcePort.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${targetPos.x} ${targetPos.y}`;
    
    return (
      <svg 
        className="connection-svg"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        <path
          d={pathString}
          className="temp-connection"
          fill="none"
        />
      </svg>
    );
  };
  
  // Render zoom controls
  const renderZoomControls = () => {
    return (
      <div className="zoom-controls">
        <button 
          className="zoom-btn" 
          onClick={() => setScale(Math.min(2, scale * 1.2))}
        >
          +
        </button>
        <div className="zoom-divider" />
        <button 
          className="zoom-btn" 
          onClick={() => setScale(Math.max(0.1, scale / 1.2))}
        >
          -
        </button>
        <div className="zoom-divider" />
        <button 
          className="zoom-btn" 
          onClick={() => {
            setScale(1);
            setPosition({ x: 0, y: 0 });
          }}
        >
          ⟲
        </button>
      </div>
    );
  };
  
  // Render groups
  const renderGroups = () => {
    return Object.values(groups).map(group => (
      <NodeGroup
        key={group.id}
        group={group}
        selected={selectedGroupId === group.id}
        onSelect={handleGroupSelect}
        onDragStart={handleGroupDragStart}
        onResize={handleGroupResize}
        onDelete={handleDeleteGroup}
        onTitleChange={handleGroupTitleChange}
        onToggleCollapse={handleGroupToggleCollapse}
        onColorChange={handleGroupColorChange}
      />
    ));
  };
  
  return (
    <div 
      ref={editorRef}
      className="node-editor"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      onClick={handleEditorClick}
    >
      <div 
        className="node-editor-canvas"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`
        }}
      >
        {/* Render groups first (so they're behind nodes) */}
        {renderGroups()}
        
        {/* Render nodes */}
        {renderNodes()}
      </div>
      
      {connectingInfo && renderTempConnection()}
      
      {/* Zoom controls */}
      {renderZoomControls()}
      
      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          items={contextMenu.items}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}
      
      {/* Node library */}
      {showNodeLibrary && (
        <NodeLibrary
          onSelectNodeType={handleNodeTypeSelect}
          onClose={() => setShowNodeLibrary(false)}
        />
      )}
    </div>
  );
};

export default NodeEditor; 