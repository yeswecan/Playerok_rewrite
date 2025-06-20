import React from 'react';

const ActionNodeDndContext = React.createContext({
  currentlyDraggedItemId: null,
  setCurrentlyDraggedItemId: (id) => {},
});

export default ActionNodeDndContext; 