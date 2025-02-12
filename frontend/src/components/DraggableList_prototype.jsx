import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion, LayoutGroup } from 'framer-motion';

const initialLists = {
  active: [
    { id: 'item-1', content: 'Task 1: Review Code', checked: true },
    { id: 'item-2', content: 'Task 2: Update Tests', checked: true },
  ],
  inactive: [
    { id: 'item-3', content: 'Task 3: Deploy', checked: false },
    { id: 'item-4', content: 'Task 4: Document', checked: false },
  ],
};

const DraggableList = () => {
  const [lists, setLists] = React.useState(initialLists);

  // Toggle an item's checkbox by moving it between lists.
  const handleCheckboxChange = (itemId, sourceKey) => {
    const sourceItems = [...lists[sourceKey]];
    const itemIndex = sourceItems.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;

    const [movedItem] = sourceItems.splice(itemIndex, 1);
    const targetKey = sourceKey === 'active' ? 'inactive' : 'active';
    // Toggle the 'checked' status to match the new list
    movedItem.checked = targetKey === 'active';

    setLists({
      ...lists,
      [sourceKey]: sourceItems,
      [targetKey]: [...lists[targetKey], movedItem],
    });
  };

  // Handle reordering within the same list or moving between lists
  const onDragEnd = ({ source, destination }) => {
    if (!destination) return;

    const sourceKey = source.droppableId;
    const destKey = destination.droppableId;

    // Moving within the same list
    if (sourceKey === destKey) {
      const items = Array.from(lists[sourceKey]);
      const [movedItem] = items.splice(source.index, 1);
      items.splice(destination.index, 0, movedItem);
      setLists({ ...lists, [sourceKey]: items });
    }
    // Moving between lists
    else {
      const sourceItems = Array.from(lists[sourceKey]);
      const destItems = Array.from(lists[destKey]);
      const [movedItem] = sourceItems.splice(source.index, 1);
      movedItem.checked = destKey === 'active'; // Update status based on destination
      destItems.splice(destination.index, 0, movedItem);
      setLists({ ...lists, [sourceKey]: sourceItems, [destKey]: destItems });
    }
  };

  // A generic container for either list with a title.
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
                      <div className="text-gray-400">⋮⋮</div>
                      <motion.input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => handleCheckboxChange(item.id, id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        onClick={e => e.stopPropagation()}
                        whileTap={{ scale: 0.9 }}
                      />
                      <span className="text-gray-700">{item.content}</span>
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
          <ListContainer id="active" items={lists.active} title="Active Tasks" />
          <ListContainer id="inactive" items={lists.inactive} title="Inactive Tasks" />
        </DragDropContext>
      </LayoutGroup>
    </div>
  );
};

export default DraggableList;