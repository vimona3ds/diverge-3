import React, { useRef, useEffect, useState } from 'react';
import { IConnection, INode } from '../../core/types/node';

interface ConnectionProps {
  connection: IConnection;
  nodes: Record<string, INode>;
  selected: boolean;
  onSelect: (connectionId: string) => void;
  onDelete: (connectionId: string) => void;
}

interface Point {
  x: number;
  y: number;
}

const Connection: React.FC<ConnectionProps> = ({
  connection,
  nodes,
  selected,
  onSelect,
  onDelete
}) => {
  const [path, setPath] = useState<string>('');
  const [midPoint, setMidPoint] = useState<Point>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Calculate the path between two ports whenever nodes or connection changes
  useEffect(() => {
    calculatePath();
  }, [connection, nodes]);

  const calculatePath = () => {
    const sourceNode = nodes[connection.sourceNodeId];
    const targetNode = nodes[connection.targetNodeId];

    if (!sourceNode || !targetNode) return;

    // Get source and target port positions
    // These calculations can be improved by getting actual DOM positions
    // For now, we'll use approximations based on node positions
    const sourcePort = {
      x: sourceNode.position.x + 150, // Assuming node width is ~150px
      y: sourceNode.position.y + 30 + (Object.keys(sourceNode.outputs).indexOf(connection.sourcePortId) * 25) // Approx port vertical position
    };

    const targetPort = {
      x: targetNode.position.x,
      y: targetNode.position.y + 30 + (Object.keys(targetNode.inputs).indexOf(connection.targetPortId) * 25) // Approx port vertical position
    };

    // Calculate control points for the bezier curve
    const dx = Math.abs(targetPort.x - sourcePort.x) * 0.5;
    const controlPoint1 = {
      x: sourcePort.x + dx,
      y: sourcePort.y
    };
    
    const controlPoint2 = {
      x: targetPort.x - dx,
      y: targetPort.y
    };

    // Create cubic bezier path
    const pathString = `M ${sourcePort.x} ${sourcePort.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${targetPort.x} ${targetPort.y}`;
    setPath(pathString);
    
    // Calculate midpoint for the delete button
    const midpoint = {
      x: (sourcePort.x + targetPort.x) / 2,
      y: (sourcePort.y + targetPort.y) / 2
    };
    setMidPoint(midpoint);
  };

  // Handle connection selection
  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(connection.id);
  };

  // Handle delete button click
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(connection.id);
  };

  return (
    <svg 
      ref={svgRef}
      className="connection-svg"
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {/* Connection path */}
      <path
        d={path}
        stroke={selected ? '#FF9800' : '#FFFFFF'}
        strokeWidth={selected ? 3 : 2}
        fill="none"
        strokeDasharray={selected ? "5,5" : ""}
        onClick={handleSelect}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
      />
      
      {/* Delete button shown when connection is selected */}
      {selected && (
        <g 
          transform={`translate(${midPoint.x}, ${midPoint.y})`}
          onClick={handleDelete}
          style={{ pointerEvents: 'all', cursor: 'pointer' }}
        >
          <circle cx="0" cy="0" r="10" fill="#F44336" />
          <text 
            x="0" 
            y="0" 
            textAnchor="middle" 
            dominantBaseline="middle" 
            fill="#FFFFFF" 
            fontSize="14px"
          >
            ×
          </text>
        </g>
      )}
    </svg>
  );
};

export default Connection; 