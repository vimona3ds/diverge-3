import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  separator?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number, y: number };
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ 
  items, 
  position, 
  onClose 
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Close the context menu when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    // Add event listeners
    document.addEventListener('mousedown', handleClickOutside);
    
    // Clean up on unmount
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);
  
  // Adjust position to ensure menu stays within viewport
  useEffect(() => {
    if (!menuRef.current) return;
    
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    
    // Check if menu extends beyond viewport
    if (position.x + rect.width > window.innerWidth) {
      menu.style.left = `${position.x - rect.width}px`;
    }
    
    if (position.y + rect.height > window.innerHeight) {
      menu.style.top = `${position.y - rect.height}px`;
    }
  }, [position]);
  
  return (
    <div 
      ref={menuRef}
      className="context-menu"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
    >
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {item.separator && <div className="context-menu-separator" />}
          <div 
            className="context-menu-item"
            onClick={() => {
              item.onClick();
              onClose();
            }}
          >
            {item.label}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

export default ContextMenu; 