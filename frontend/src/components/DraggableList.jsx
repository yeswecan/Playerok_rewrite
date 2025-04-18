import React, { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Checkbox } from './ui/checkbox';
import { cn } from '../utils';
import { GripVertical, Play } from 'lucide-react';
import ActionEditorComponent from './ActionEditorComponent';

const DraggableList = ({ items, onItemMove, onItemLoopToggle, onItemClick, onItemActionsUpdate, registeredActions, qualifierOptions }) => {
  // Track if we're currently in a drag operation
  const isDragging = useRef(false);
  // Track if we're in a checkbox-triggered animation
  const isAnimating = useRef(false);
  // Store the current animation frame request
  const animationRef = useRef(null);

  const checkedItems = items.filter((item) => item.isPartOfLoop);
  const uncheckedItems = items.filter((item) => !item.isPartOfLoop);

  // Refs to store the DOM elements
  const itemRefs = useRef({});
  const listRefs = useRef({
    "checked-list": null,
    "unchecked-list": null,
  });

  function handleDragStart() {
    isDragging.current = true;
  }

  function handleDragEnd(result) {
    if (!result.destination) {
      isDragging.current = false;
      return;
    }

    const { source, destination } = result;
    
    console.log('Drag end event:', {
      source: { droppableId: source.droppableId, index: source.index },
      destination: { droppableId: destination.droppableId, index: destination.index }
    });
    
    // Find the item being dragged
    const sourceKey = source.droppableId;
    const destKey = destination.droppableId;
    
    const sourceItems = sourceKey === "checked-list" ? checkedItems : uncheckedItems;
    const destItems = destKey === "checked-list" ? checkedItems : uncheckedItems;
    
    const sourceItem = sourceItems[source.index];
    
    if (!sourceItem) {
      isDragging.current = false;
      return;
    }

    console.log('Moving item:', {
      id: sourceItem.id,
      filename: sourceItem.filename,
      originalIndex: sourceItem.originalIndex,
      isPartOfLoop: sourceItem.isPartOfLoop
    });

    // Determine if we're changing checked status (moving between lists)
    const isSwitchingLists = sourceKey !== destKey;
    const newIsPartOfLoop = destKey === "checked-list";
    
    // Get the original index to pass to the move handler
    const originalIndex = sourceItem.originalIndex;
    
    // Calculate the target index based on the destination
    let targetIndex;
    
    if (isSwitchingLists) {
      // Moving between different lists
      if (destKey === "checked-list") {
        // Moving from unchecked to checked list (lower to upper)
        if (destination.index === 0) {
          // Moving to beginning of checked list
          targetIndex = 0;
        } else if (destination.index >= checkedItems.length) {
          // Moving to end of checked list
          targetIndex = checkedItems.length > 0 
            ? checkedItems[checkedItems.length - 1].originalIndex + 1
            : 0;
        } else {
          // Moving to specific position in checked list
          targetIndex = checkedItems[destination.index].originalIndex;
        }
      } else {
        // Moving from checked to unchecked list (upper to lower)
        if (uncheckedItems.length === 0) {
          // If there are no unchecked items yet, place at the end
          targetIndex = items.length;
        } else if (destination.index === 0) {
          // Moving to beginning of unchecked list
          // This needs special handling to ensure it goes to the first position in the unchecked list
          targetIndex = uncheckedItems[0].originalIndex;
          
          // If the item being moved is before the first unchecked item,
          // we need to adjust to ensure it really goes first
          if (originalIndex < targetIndex) {
            targetIndex--;
          }
        } else if (destination.index >= uncheckedItems.length) {
          // Moving to end of unchecked list
          targetIndex = items.length;
        } else {
          // Moving to specific position in unchecked list
          targetIndex = uncheckedItems[destination.index].originalIndex;
          
          // If the item being moved is before the target position,
          // adjust to ensure correct placement
          if (originalIndex < targetIndex) {
            targetIndex--;
          }
        }
      }
    } else {
      // Moving within the same list
      const list = sourceKey === "checked-list" ? checkedItems : uncheckedItems;
      if (destination.index < list.length) {
        // Insert before the existing item at destination
        targetIndex = list[destination.index].originalIndex;
      } else {
        // Dropped beyond last element: insert after the last
        const lastItem = list[list.length - 1];
        const lastIndex = lastItem ? lastItem.originalIndex : items.length - 1;
        targetIndex = lastIndex + 1;
      }
    }
    
    console.log(`Calculated target index: ${targetIndex} (from original index ${originalIndex})`);
    
    // Only make the API call if we have valid indices
    if (originalIndex !== undefined && targetIndex !== undefined) {
      // For switching lists, always toggle the loop status
      const shouldToggleLoop = isSwitchingLists;
      
      onItemMove(originalIndex, targetIndex, shouldToggleLoop);
    }

    // Reset dragging state
    setTimeout(() => {
      isDragging.current = false;
    }, 50);
  }

  const handleCheckboxChange = useCallback((id) => {
    if (isDragging.current || isAnimating.current) return;

    // Find the item
    const item = items.find((item) => item.id === id);
    if (!item) return;

    // Get the DOM elements
    const itemElement = itemRefs.current[id];
    const sourceList = listRefs.current[item.isPartOfLoop ? "checked-list" : "unchecked-list"];
    const targetList = listRefs.current[item.isPartOfLoop ? "unchecked-list" : "checked-list"];

    if (!itemElement || !sourceList || !targetList) {
      // If we can't find elements, just update directly
      onItemLoopToggle(item.originalIndex);
      return;
    }

    // Mark that we're animating
    isAnimating.current = true;

    // Create a clone for animation
    const clone = itemElement.cloneNode(true);
    const sourceRect = itemElement.getBoundingClientRect();
    const targetRect = targetList.getBoundingClientRect();

    // Position clone absolutely
    clone.style.position = "fixed";
    clone.style.top = `${sourceRect.top}px`;
    clone.style.left = `${sourceRect.left}px`;
    clone.style.width = `${sourceRect.width}px`;
    clone.style.height = `${sourceRect.height}px`;
    clone.style.margin = "0";
    clone.style.zIndex = "9999";
    clone.style.transition = "all 300ms cubic-bezier(0.4, 0.0, 0.2, 1.0)";
    clone.style.pointerEvents = "none";

    // Add clone to body
    document.body.appendChild(clone);

    // Hide original item
    itemElement.style.opacity = "0";

    // Create placeholder in target list
    const targetPlaceholder = document.createElement("div");
    targetPlaceholder.style.height = "0";
    targetPlaceholder.style.overflow = "hidden";
    targetPlaceholder.style.transition = "height 300ms cubic-bezier(0.4, 0.0, 0.2, 1.0)";
    targetPlaceholder.style.backgroundColor = "rgba(0, 0, 0, 0.05)";
    targetPlaceholder.style.borderRadius = "6px";
    targetPlaceholder.style.margin = "0 0 8px 0";

    // Create placeholder in source list
    const sourcePlaceholder = document.createElement("div");
    sourcePlaceholder.style.height = `${sourceRect.height}px`;
    sourcePlaceholder.style.overflow = "hidden";
    sourcePlaceholder.style.transition = "height 300ms cubic-bezier(0.4, 0.0, 0.2, 1.0)";
    sourcePlaceholder.style.backgroundColor = "rgba(0, 0, 0, 0.05)";
    sourcePlaceholder.style.borderRadius = "6px";
    sourcePlaceholder.style.margin = "0 0 8px 0";

    // Replace original item with source placeholder
    itemElement.parentNode?.insertBefore(sourcePlaceholder, itemElement);
    itemElement.style.display = "none";

    // Add target placeholder to target list
    targetList.insertBefore(targetPlaceholder, targetList.firstChild);

    // Force reflow
    targetPlaceholder.offsetHeight;
    sourcePlaceholder.offsetHeight;

    // Expand target and shrink source
    targetPlaceholder.style.height = `${sourceRect.height}px`;
    sourcePlaceholder.style.height = "0";

    // Calculate target position
    const targetY = targetRect.top;

    // Animate clone
    requestAnimationFrame(() => {
      clone.style.transform = `translateY(${targetY - sourceRect.top}px)`;
      clone.style.opacity = "0.8";

      // After animation completes
      setTimeout(() => {
        // Remove clone and placeholders
        clone.remove();
        targetPlaceholder.remove();
        sourcePlaceholder.remove();

        // Restore original item
        if (itemElement) {
          itemElement.style.opacity = "1";
          itemElement.style.display = "";
        }

        // Update through parent handler - always toggle here since that's the checkbox's purpose
        onItemLoopToggle(item.originalIndex);

        // Reset animation flag
        isAnimating.current = false;
      }, 300);
    });
  }, [items, onItemLoopToggle]);

  return (
    <div className="p-1 max-w-3xl mx-auto">
      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          {/* Idle tracks list (checked items) */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <h2 className="text-xl font-semibold mb-3">Idle mode tracks</h2>
            <Droppable droppableId="checked-list" isDropDisabled={isAnimating.current}>
              {(provided, snapshot) => (
                <ul
                  {...provided.droppableProps}
                  ref={(el) => {
                    provided.innerRef(el);
                    listRefs.current["checked-list"] = el;
                  }}
                  className={cn(
                    "min-h-[4.5rem] bg-white rounded-md border border-gray-200",
                    snapshot.isDraggingOver && "bg-gray-50",
                    checkedItems.length === 0 && !snapshot.isDraggingOver && "border-2 border-dashed border-gray-200"
                  )}
                >
                  {checkedItems.map((item, index) => (
                    <Draggable 
                      key={item.id} 
                      draggableId={item.id} 
                      index={index} 
                      isDragDisabled={isAnimating.current}
                    >
                      {(provided, snapshot) => (
                        <li
                          ref={(el) => { provided.innerRef(el); itemRefs.current[item.id] = el; }}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={cn(
                            "p-3 mb-2 flex flex-col min-h-[4.5rem] bg-white hover:bg-gray-50 transition-colors rounded-md border border-gray-200 cursor-pointer",
                            snapshot.isDragging && "shadow-lg ring-2 ring-blue-500 bg-blue-50"
                          )}
                          onClick={(e) => {
                            if (isDragging.current) return;
                            // Skip clicks on action editor, its nodes, or UI controls
                            if (e.target.closest('input, button, .action-node-view, .ProseMirror, .action-editor-wrapper, .suggestion-list-portal')) return;
                            onItemClick(item);
                          }}
                        >
                          {/* Header row: drag handle, index/play, loop, preview, metadata */}
                          <div className="flex items-center h-[4.5rem]">
                            <div className="cursor-grab text-gray-500 mr-3 flex items-center justify-center">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="flex items-center mr-4 flex-shrink-0">
                              <div className="w-8 h-8 flex items-center justify-center">
                                {item.isPlaying
                                  ? <Play size={28} className="text-gray-700" />
                                  : <span className="text-gray-700 font-semibold text-lg">{item.index}</span>
                                }
                              </div>
                              <Checkbox
                                className="ml-2"
                                id={`check-${item.id}`}
                                checked={item.isPartOfLoop}
                                onCheckedChange={() => onItemLoopToggle(item.originalIndex)}
                                disabled={isAnimating.current}
                              />
                            </div>
                            {item.previewUrl && (
                              <img
                                src={item.previewUrl}
                                alt={`${item.filename} preview`}
                                className="w-32 h-full object-cover rounded mr-4 flex-shrink-0"
                              />
                            )}
                            <div className="flex flex-col justify-between flex-1 h-full overflow-hidden">
                              <span className="text-gray-700 font-medium break-words">{item.filename}</span>
                              <span className="text-gray-400 text-sm">{item.duration ?? '??:??'}</span>
                            </div>
                          </div>
                          {/* Actions row */}
                          <div className="mt-2">
                            <ActionEditorComponent
                              key={`${item.id}-editor`}
                              initialActions={item.actions || []}
                              registeredActions={registeredActions}
                              qualifierOptions={qualifierOptions}
                              defaultQualifier="outgoing"
                              onActionCreated={(id, word, qualifier) => {
                                const newActions = [...(item.actions||[]), { id, word, qualifier }];
                                onItemActionsUpdate(item.originalIndex, { actions: newActions });
                              }}
                              onActionDeleted={(nid) => {
                                const newActions = (item.actions||[]).filter(a => a.id !== nid);
                                onItemActionsUpdate(item.originalIndex, { actions: newActions });
                              }}
                              onQualifierChanged={(nid, q) => {
                                const newActions = (item.actions||[]).map(a => a.id === nid ? { ...a, qualifier: q } : a);
                                onItemActionsUpdate(item.originalIndex, { actions: newActions });
                              }}
                              onActionWordChanged={(nid, w) => {
                                const newActions = (item.actions||[]).map(a => a.id === nid ? { ...a, word: w } : a);
                                onItemActionsUpdate(item.originalIndex, { actions: newActions });
                              }}
                              readOnly={false}
                            />
                          </div>
                        </li>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </ul>
              )}
            </Droppable>
          </div>

          {/* Interactive tracks list (unchecked items) */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-xl font-semibold mb-3">Interactive tracks</h2>
            <Droppable droppableId="unchecked-list" isDropDisabled={isAnimating.current}>
              {(provided, snapshot) => (
                <ul
                  {...provided.droppableProps}
                  ref={(el) => {
                    provided.innerRef(el);
                    listRefs.current["unchecked-list"] = el;
                  }}
                  className={cn(
                    "min-h-[4.5rem] bg-white rounded-md border border-gray-200",
                    snapshot.isDraggingOver && "bg-gray-50",
                    uncheckedItems.length === 0 && !snapshot.isDraggingOver && "border-2 border-dashed border-gray-200"
                  )}
                >
                  {uncheckedItems.map((item, index) => (
                    <Draggable 
                      key={item.id} 
                      draggableId={item.id} 
                      index={index} 
                      isDragDisabled={isAnimating.current}
                    >
                      {(provided, snapshot) => (
                        <li
                          ref={(el) => { provided.innerRef(el); itemRefs.current[item.id] = el; }}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={cn(
                            "p-3 mb-2 flex flex-col min-h-[4.5rem] bg-white hover:bg-gray-50 transition-colors rounded-md border border-gray-200 cursor-pointer",
                            snapshot.isDragging && "shadow-lg ring-2 ring-blue-500 bg-blue-50"
                          )}
                          onClick={(e) => {
                            if (isDragging.current) return;
                            // Skip clicks on action editor, its nodes, or UI controls
                            if (e.target.closest('input, button, .action-node-view, .ProseMirror, .action-editor-wrapper, .suggestion-list-portal')) return;
                            onItemClick(item);
                          }}
                        >
                          {/* Header row: drag handle, index/play, loop, preview, metadata */}
                          <div className="flex items-center h-[4.5rem]">
                            <div className="cursor-grab text-gray-500 mr-3 flex items-center justify-center">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="flex items-center mr-4 flex-shrink-0">
                              <div className="w-8 h-8 flex items-center justify-center">
                                {item.isPlaying
                                  ? <Play size={28} className="text-gray-700" />
                                  : <span className="text-gray-700 font-semibold text-lg">{item.index}</span>
                                }
                              </div>
                              <Checkbox
                                className="ml-2"
                                id={`check-${item.id}`}
                                checked={item.isPartOfLoop}
                                onCheckedChange={() => handleCheckboxChange(item.id)}
                                disabled={isAnimating.current}
                              />
                            </div>
                            {item.previewUrl && (
                              <img
                                src={item.previewUrl}
                                alt={`${item.filename} preview`}
                                className="w-32 h-full object-cover rounded mr-4 flex-shrink-0"
                              />
                            )}
                            <div className="flex flex-col justify-between flex-1 h-full overflow-hidden">
                              <span className="text-gray-700 font-medium break-words">{item.filename}</span>
                              <span className="text-gray-400 text-sm">{item.duration ?? '??:??'}</span>
                            </div>
                          </div>
                          {/* Actions row */}
                          <div className="mt-2">
                            <ActionEditorComponent
                              key={`${item.id}-editor`}
                              initialActions={item.actions || []}
                              registeredActions={registeredActions}
                              qualifierOptions={qualifierOptions}
                              defaultQualifier="outgoing"
                              onActionCreated={(id, word, qualifier) => {
                                const newActions = [...(item.actions||[]), { id, word, qualifier }];
                                onItemActionsUpdate(item.originalIndex, { actions: newActions });
                              }}
                              onActionDeleted={(nid) => {
                                const newActions = (item.actions||[]).filter(a => a.id !== nid);
                                onItemActionsUpdate(item.originalIndex, { actions: newActions });
                              }}
                              onQualifierChanged={(nid, q) => {
                                const newActions = (item.actions||[]).map(a => a.id === nid ? { ...a, qualifier: q } : a);
                                onItemActionsUpdate(item.originalIndex, { actions: newActions });
                              }}
                              onActionWordChanged={(nid, w) => {
                                const newActions = (item.actions||[]).map(a => a.id === nid ? { ...a, word: w } : a);
                                onItemActionsUpdate(item.originalIndex, { actions: newActions });
                              }}
                              readOnly={false}
                            />
                          </div>
                        </li>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </ul>
              )}
            </Droppable>
          </div>
        </div>
      </DragDropContext>
    </div>
  );
};

DraggableList.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    filename: PropTypes.string.isRequired,
    index: PropTypes.number.isRequired,
    isPartOfLoop: PropTypes.bool.isRequired,
    isPlaying: PropTypes.bool.isRequired,
    originalIndex: PropTypes.number.isRequired,
    originalData: PropTypes.object.isRequired,
    actions: PropTypes.array,
  })).isRequired,
  onItemMove: PropTypes.func.isRequired,
  onItemLoopToggle: PropTypes.func.isRequired,
  onItemClick: PropTypes.func.isRequired,
  onItemActionsUpdate: PropTypes.func.isRequired,
  registeredActions: PropTypes.array.isRequired,
  qualifierOptions: PropTypes.array.isRequired,
};

export default DraggableList; 