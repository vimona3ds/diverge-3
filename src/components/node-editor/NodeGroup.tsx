import React, { useState } from 'react';
import './NodeEditor.css';

export interface INodeGroup {
  id: string;
  title: string;
  position: { x: number, y: number };
  size: { width: number, height: number };
  color: string;
  nodeIds: string[];
  collapsed: boolean;
}

interface NodeGroupProps {
  group: INodeGroup;
  selected: boolean;
  onSelect: (groupId: string, e: React.MouseEvent) => void;
  onDragStart: (groupId: string, e: React.MouseEvent) => void;
  onResize: (groupId: string, newSize: { width: number, height: number }) => void;
  onDelete: (groupId: string) => void;
  onTitleChange: (groupId: string, title: string) => void;
  onToggleCollapse: (groupId: string) => void;
  onColorChange: (groupId: string, color: string) => void;
}

const NodeGroup: React.FC<NodeGroupProps> = ({
  group,
  selected,
  onSelect,
  onDragStart,
  onResize,
  onDelete,
  onTitleChange,
  onToggleCollapse,
  onColorChange
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(group.title);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0 });

  const handleStartTitleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditedTitle(group.title);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedTitle(e.target.value);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishTitleEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditedTitle(group.title);
    }
  };

  const finishTitleEdit = () => {
    setIsEditing(false);
    if (editedTitle.trim() !== '') {
      onTitleChange(group.id, editedTitle);
    } else {
      setEditedTitle(group.title);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(group.id);
  };

  const handleToggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCollapse(group.id);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    setInitialSize({ width: group.size.width, height: group.size.height });
  };

  const handleResizeMove = (e: React.MouseEvent) => {
    if (!isResizing) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    const dx = e.clientX - resizeStartPos.x;
    const dy = e.clientY - resizeStartPos.y;
    
    onResize(group.id, {
      width: Math.max(200, initialSize.width + dx),
      height: Math.max(100, initialSize.height + dy)
    });
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
  };

  return (
    <div
      className={`node-group ${selected ? 'selected' : ''} ${group.collapsed ? 'collapsed' : ''}`}
      style={{
        left: `${group.position.x}px`,
        top: `${group.position.y}px`,
        width: `${group.size.width}px`,
        height: `${group.size.height}px`,
        backgroundColor: `${group.color}20`, // 20% opacity
        borderColor: group.color,
      }}
      onClick={(e) => onSelect(group.id, e)}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('.node-group-header')) {
          onDragStart(group.id, e);
        }
      }}
      onMouseMove={isResizing ? handleResizeMove : undefined}
      onMouseUp={isResizing ? handleResizeEnd : undefined}
      onMouseLeave={isResizing ? handleResizeEnd : undefined}
    >
      <div className="node-group-header" style={{ backgroundColor: group.color }}>
        {isEditing ? (
          <input
            className="node-group-title-input"
            value={editedTitle}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            onBlur={finishTitleEdit}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="node-group-title" onDoubleClick={handleStartTitleEdit}>
            {group.title}
          </div>
        )}
        <div className="node-group-controls">
          <button className="node-group-collapse-btn" onClick={handleToggleCollapse}>
            {group.collapsed ? '▼' : '▲'}
          </button>
          <button className="node-group-delete-btn" onClick={handleDelete}>×</button>
        </div>
      </div>
      
      <div className="node-group-content"></div>
      
      <div 
        className="node-group-resize-handle"
        onMouseDown={handleResizeStart}
      />
      
      <div className="node-group-color-picker">
        <input
          type="color"
          value={group.color}
          onChange={(e) => onColorChange(group.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
};

export default NodeGroup; 