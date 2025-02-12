import React from 'react';
import PropTypes from 'prop-types';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion, LayoutGroup } from 'framer-motion';

const DraggableList = ({ items, onItemMove, onItemLoopToggle, onItemClick }) => {
  const lists = {
    idleTracks: items.filter(item => item.isPartOfLoop),
    interactiveTracks: items.filter(item => !item.isPartOfLoop)
  };

  // Handle reordering within the same list or moving between lists
  const onDragEnd = ({ source, destination }) => {
    if (!destination) return;

    console.log('=== Drag Operation Debug Info ===');
    
    // First, get a clear picture of the current state
    const allItemsSorted = [...items].sort((a, b) => a.originalIndex - b.originalIndex);
    console.log('All Items in Order:', allItemsSorted.map(item => ({
      filename: item.filename,
      originalIndex: item.originalIndex,
      isLoop: item.isPartOfLoop
    })));

    const sourceKey = source.droppableId;
    const destKey = destination.droppableId;
    const sourceItems = lists[sourceKey];
    const destItems = lists[destKey];

    // Get the actual item being moved
    const sourceItem = sourceItems[source.index];
    console.log('Moving Item Details:', {
      filename: sourceItem.filename,
      listPosition: source.index, // Position in source list (0-based)
      uiIndex: sourceItem.index, // UI display index (1-based)
      originalIndex: sourceItem.originalIndex, // Global index
      isLoop: sourceItem.isPartOfLoop,
      movingTo: {
        list: destKey,
        position: destination.index
      }
    });

    // Get all items in their current lists (excluding the moving item)
    const currentLoopedItems = items
      .filter(item => item.isPartOfLoop && item.originalIndex !== sourceItem.originalIndex)
      .sort((a, b) => a.originalIndex - b.originalIndex);
    
    const currentInteractiveItems = items
      .filter(item => !item.isPartOfLoop && item.originalIndex !== sourceItem.originalIndex)
      .sort((a, b) => a.originalIndex - b.originalIndex);

    console.log('Current Lists State:', {
      looped: currentLoopedItems.map(i => ({
        filename: i.filename,
        originalIndex: i.originalIndex,
        uiIndex: i.index
      })),
      interactive: currentInteractiveItems.map(i => ({
        filename: i.filename,
        originalIndex: i.originalIndex,
        uiIndex: i.index
      }))
    });

    // Calculate the target index based on the destination
    let targetOriginalIndex;
    const targetItems = destKey === 'idleTracks' ? currentLoopedItems : currentInteractiveItems;

    if (targetItems.length === 0) {
      // If target list is empty, find the first available index
      const usedIndices = new Set(items.map(item => item.originalIndex));
      targetOriginalIndex = 0;
      while (usedIndices.has(targetOriginalIndex)) targetOriginalIndex++;
      
      console.log('Moving to Empty List:', {
        targetOriginalIndex,
        reason: 'First available index'
      });
    } else if (destination.index === 0) {
      // Moving to start of list - insert before first item
      targetOriginalIndex = Math.max(0, targetItems[0].originalIndex - 1);
      console.log('Moving to Start:', {
        targetOriginalIndex,
        firstItem: targetItems[0].filename,
        firstItemIndex: targetItems[0].originalIndex
      });
    } else if (destination.index >= targetItems.length) {
      // Moving to end of list - insert after last item
      const lastItem = targetItems[targetItems.length - 1];
      targetOriginalIndex = lastItem.originalIndex + 1;
      console.log('Moving to End:', {
        targetOriginalIndex,
        lastItem: lastItem.filename,
        lastItemIndex: lastItem.originalIndex
      });
    } else {
      // Moving between items - insert between them
      const beforeItem = targetItems[destination.index - 1];
      const afterItem = targetItems[destination.index];
      targetOriginalIndex = afterItem.originalIndex;
      
      // Shift all items after this point
      const itemsToShift = items.filter(item => 
        item.originalIndex >= targetOriginalIndex && 
        item.originalIndex !== sourceItem.originalIndex
      );
      
      console.log('Moving Between Items:', {
        targetOriginalIndex,
        beforeItem: {
          filename: beforeItem.filename,
          index: beforeItem.originalIndex
        },
        afterItem: {
          filename: afterItem.filename,
          index: afterItem.originalIndex
        },
        itemsToShift: itemsToShift.map(i => i.filename)
      });
    }

    console.log('Final Move Operation:', {
      item: sourceItem.filename,
      fromIndex: sourceItem.originalIndex,
      toIndex: targetOriginalIndex,
      fromList: sourceKey,
      toList: destKey,
      shouldToggleLoop: sourceKey !== destKey
    });
    console.log('========================');

    // First move the item
    onItemMove(sourceItem.originalIndex, targetOriginalIndex);
    
    // Then toggle loop status if moving between lists
    if (sourceKey !== destKey) {
      setTimeout(() => {
        onItemLoopToggle(sourceItem.originalIndex);
      }, 0);
    }
  };

  // A generic container for either list with a title
  const ListContainer = ({ id, items, title }) => (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">{title}</h2>
      <Droppable droppableId={id}>
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="flex flex-col gap-3"
          >
            {items.map((item, index) => (
              <Draggable key={item.id} draggableId={item.id} index={index}>
                {(provided, snapshot) => (
                  <motion.div
                    layoutId={snapshot.isDragging ? '' : item.id}
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`
                      relative p-4 rounded-lg 
                      bg-white shadow-sm
                      border border-gray-200
                      ${snapshot.isDragging ? 'shadow-xl ring-2 ring-blue-500' : ''}
                    `}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-600 w-8">{item.index}</span>
                      <span className="ml-1"><i>loop:</i></span>
                      <motion.input
                        type="checkbox"
                        checked={item.isPartOfLoop}
                        onChange={() => onItemLoopToggle(item.originalIndex)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        onClick={e => e.stopPropagation()}
                        whileTap={{ scale: 0.9 }}
                      />
                      <button
                        onClick={() => onItemClick(item.originalData)}
                        className="text-gray-700 hover:text-blue-600 flex items-center"
                      >
                        {item.isPlaying && <span className="mr-2">▶️</span>}
                        <span className="ml-1"><i>Filename:  </i></span>
                        {item.filename}
                      </button>
                    </div>
                  </motion.div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );

  return (
    <div className="p-1 max-w-3xl mx-auto">
      <LayoutGroup>
        <DragDropContext onDragEnd={onDragEnd}>
          <ListContainer id="idleTracks" items={lists.idleTracks} title="Idle mode tracks" />
          <ListContainer id="interactiveTracks" items={lists.interactiveTracks} title="Interactive tracks" />
        </DragDropContext>
      </LayoutGroup>
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
    originalData: PropTypes.object.isRequired
  })).isRequired,
  onItemMove: PropTypes.func.isRequired,
  onItemLoopToggle: PropTypes.func.isRequired,
  onItemClick: PropTypes.func.isRequired
};

export default DraggableList; 