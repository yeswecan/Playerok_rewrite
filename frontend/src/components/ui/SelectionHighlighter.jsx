import React, { useContext, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { SelectionContext } from '../../context/SelectionContext';

const SelectionHighlighter = () => {
  const { selectedNode } = useContext(SelectionContext);
  const [style, setStyle] = useState({ display: 'none' });
  const [nodeId, setNodeId] = useState(null);

  useEffect(() => {
    if (selectedNode?.nodeId !== nodeId) {
      setNodeId(selectedNode?.nodeId || null);
    }
  }, [selectedNode, nodeId]);

  useEffect(() => {
    let animationFrameId;

    const updateStyle = () => {
      if (selectedNode?.nodeId) {
        const nodeElement = document.querySelector(`[data-node-id="${selectedNode.nodeId}"]`);
        if (nodeElement) {
          const rect = nodeElement.getBoundingClientRect();
          const buffer = 2;
          setStyle({
            display: 'block',
            position: 'fixed',
            top: `${rect.top - buffer}px`,
            left: `${rect.left - buffer}px`,
            width: `${rect.width + buffer * 2}px`,
            height: `${rect.height + buffer * 2}px`,
            boxShadow: `0 0 0 ${buffer}px #3b82f6`,
            borderRadius: '8px',
            pointerEvents: 'none',
            zIndex: 1000,
            transition: 'top 100ms, left 100ms, width 100ms, height 100ms',
          });
        }
      } else {
        setStyle({ display: 'none' });
      }
      animationFrameId = requestAnimationFrame(updateStyle);
    };

    animationFrameId = requestAnimationFrame(updateStyle);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [nodeId, selectedNode]);

  return ReactDOM.createPortal(
    <div style={style} />,
    document.body
  );
};

export default SelectionHighlighter; 
 