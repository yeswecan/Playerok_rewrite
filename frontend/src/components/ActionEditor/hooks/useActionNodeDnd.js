import { useState, useEffect, useMemo, useRef } from 'react';
import { useDrop, useDragLayer } from 'react-dnd';
import { ItemTypes } from '../../../dndTypes';

const DND_PLACEHOLDER_ID = 'DND_PLACEHOLDER_ACTION_NODE';

/**
 * Custom hook that manages drag and drop functionality for ActionNodes
 * @param {Object} params
 * @param {string} params.nodeType - The type of nodes this editor accepts (ItemActionNode, PlaylistActionNode)
 * @param {string} params.editorId - Unique identifier for this editor instance
 * @param {Function} params.onActionDrop - Callback when an action is dropped FROM ANOTHER editor.
 * @param {Function} params.onReorder - Callback to reorder actions WITHIN THIS editor.
 * @param {Array} params.actionsState - Current state of actions
 * @param {Object} params.editorInstanceRef - Ref to the Tiptap editor instance
 * @param {Function} params.setIsDraggingNode - Callback to set the dragging state globally
 * @returns {Object} DND-related state and functions
 */
export const useActionNodeDnd = ({
  nodeType,
  editorId,
  onActionDrop,
  onReorder,
  actionsState,
  editorInstanceRef,
  setIsDraggingNode,
}) => {
  const [draggedOverIndex, setDraggedOverIndex] = useState(null);
  const actionsStateRef = useRef(actionsState);
  useEffect(() => {
    actionsStateRef.current = actionsState;
  }, [actionsState]);

  // Use drag layer to monitor global drag state
  const { isDragging } = useDragLayer(monitor => ({
    isDragging: monitor.isDragging() && monitor.getItemType() === ItemTypes.ACTION_NODE,
  }));

  // Update parent component about drag state
  useEffect(() => {
    if (setIsDraggingNode) {
      setIsDraggingNode(isDragging);
    }
  }, [isDragging, setIsDraggingNode]);

  // Setup the drop target
  const [{ canDrop, isOver }, dropRef] = useDrop(() => ({
    accept: ItemTypes.ACTION_NODE,
    canDrop: (item) => item.actionNodeType === nodeType,
    hover: (item, monitor) => {
      if (!monitor.canDrop() || !monitor.isOver()) {
        if (draggedOverIndex !== null) setDraggedOverIndex(null);
        return;
      }

      const editorView = editorInstanceRef.current?.view;
      const clientOffset = monitor.getClientOffset();

      if (!editorView || !clientOffset) {
        if (draggedOverIndex !== null) setDraggedOverIndex(null);
        return;
      }

      const coords = { left: clientOffset.x, top: clientOffset.y };
      const posDetails = editorView.posAtCoords(coords);

      if (posDetails) {
        const resolvedPos = editorView.state.doc.resolve(posDetails.pos);
        const nodeNearCursor = resolvedPos.nodeAfter || resolvedPos.nodeBefore || editorView.state.doc.nodeAt(resolvedPos.pos);
        
        if (nodeNearCursor && nodeNearCursor.type.name === 'actionNode' && nodeNearCursor.attrs.isDragPlaceholder) {
          // If hovering directly over the visual placeholder node in Tiptap, do nothing.
          return;
        }
      }

      const currentActualActions = actionsStateRef.current.filter(a => a.id !== DND_PLACEHOLDER_ID && !a.isDragPlaceholder);
      let newTargetIndex = currentActualActions.length; // Default to inserting at the end
      let foundSpecificTargetNode = false;

      if (posDetails) {
        editorView.state.doc.descendants((node, posInDoc) => {
          if (foundSpecificTargetNode) return false;
          if (node.type.name !== 'actionNode' || node.attrs.isDragPlaceholder) {
            return true;
          }

          const nodeStartPos = posInDoc;
          const nodeEndPos = posInDoc + node.nodeSize;
          const actionIndexInActualState = currentActualActions.findIndex(a => a.id === node.attrs.nodeId);

          if (actionIndexInActualState === -1) return true;

          if (posDetails.pos >= nodeStartPos && posDetails.pos <= nodeEndPos) {
            const domNode = editorView.nodeDOM(nodeStartPos);
            if (domNode instanceof HTMLElement) {
              const nodeRect = domNode.getBoundingClientRect();
              const midX = nodeRect.left + nodeRect.width / 2;
              newTargetIndex = (clientOffset.x < midX) ? actionIndexInActualState : actionIndexInActualState + 1;
            } else {
              const nodeMidPosInDoc = nodeStartPos + node.nodeSize / 2;
              newTargetIndex = (posDetails.pos <= nodeMidPosInDoc) ? actionIndexInActualState : actionIndexInActualState + 1;
            }
            foundSpecificTargetNode = true;
            return false;
          }
          return true;
        });
      }

      // Additional logic for fallback positioning (simplified for now)
      if (!foundSpecificTargetNode && posDetails) {
        const resolvedPos = editorView.state.doc.resolve(posDetails.pos);
        if (resolvedPos.parentOffset === 0 && resolvedPos.depth > 0) {
          let isEffectivelyAtStart = true;
          editorView.state.doc.descendants((node, pos) => {
            if (node.type.name === 'actionNode' && !node.attrs.isDragPlaceholder) {
              if (pos < resolvedPos.pos) {
                isEffectivelyAtStart = false;
                return false; 
              }
            }
            return true;
          });
          if (isEffectivelyAtStart) {
            newTargetIndex = 0;
          }
        }
      }

      if (draggedOverIndex !== newTargetIndex) {
        setDraggedOverIndex(newTargetIndex);
      }
    },
    drop: (item, monitor) => {
      if (!monitor.canDrop() || draggedOverIndex === null) {
        setDraggedOverIndex(null);
        return;
      }
      
      // If the item came from the same editor, it's a reorder.
      if (item.editorId === editorId) {
        // Adjust index if dragging downwards past the original position
        const dragIndex = item.index;
        let hoverIndex = draggedOverIndex;
        if (dragIndex < hoverIndex) {
            // Because we show a placeholder, the index can sometimes be off by one
            // when dragging downwards. We might need to adjust it.
            // Let's assume for now the index is correct and see.
        }
        onReorder(dragIndex, hoverIndex);

      } else { // Otherwise, it's a new item being dropped in.
        onActionDrop(item, editorId, draggedOverIndex);
      }
      
      setDraggedOverIndex(null);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [nodeType, editorId, onActionDrop, onReorder, actionsState, draggedOverIndex]);

  // Clean up drag state when not over
  useEffect(() => {
    if (!isOver && draggedOverIndex !== null) {
      setDraggedOverIndex(null);
    }
  }, [isOver, draggedOverIndex]);

  // Generate actions to render with placeholder
  const actionsToRender = useMemo(() => {
    const currentActionsState = actionsState || [];
    let actionsToRender = currentActionsState.filter(a => a.id !== DND_PLACEHOLDER_ID && !a.isDragPlaceholder);
    
    if (isOver && canDrop && draggedOverIndex !== null && draggedOverIndex >= 0) {
      const placeholderAction = {
        id: DND_PLACEHOLDER_ID,
        word: 'Drop here',
        qualifier: 'incoming',
        equation: '=1',
        actionNodeType: nodeType,
        actionId: null,
        isDragPlaceholder: true,
      };
      
      const insertAt = Math.max(0, Math.min(draggedOverIndex, actionsToRender.length));
      actionsToRender.splice(insertAt, 0, placeholderAction);
    }
    
    return actionsToRender;
  }, [actionsState, isOver, canDrop, draggedOverIndex, nodeType]);

  return {
    draggedOverIndex,
    canDrop,
    isOver,
    dropRef,
    actionsToRender,
    DND_PLACEHOLDER_ID
  };
};

export default useActionNodeDnd;




