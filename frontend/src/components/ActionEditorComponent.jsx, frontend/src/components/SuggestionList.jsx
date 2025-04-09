import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';

// Assuming HIGHLIGHT_DICTIONARY is accessible or passed if hints are needed here
// import { HIGHLIGHT_DICTIONARY } from '../path/to/dictionary';

const SuggestionList = forwardRef((props, ref) => {
  console.log('[SuggestionList] Rendered with state:', props);
  const { selectedIndex, items = [], highlightedItems = [], onSelect, query, editingNodeId } = props; // Destructure editingNodeId
  const listRef = useRef(null);

  // Always use the full list
  const itemsToRender = items;
  const isEmpty = itemsToRender.length === 0;

  const selectItem = index => {
    console.log(`[SuggestionList:selectItem] Called for index: ${index}`);
    // Get the item from the full list being rendered
    const item = itemsToRender[index];
    if (item) {
      console.log(`[SuggestionList:selectItem] Found item: ${item}. Calling onSelect...`);
      console.log(`[SuggestionList:selectItem] typeof onSelect: ${typeof onSelect}`);
      onSelect(item, editingNodeId); // Pass editingNodeId to onSelect
      console.log(`[SuggestionList:selectItem] Called onSelect for item: ${item} (editingNodeId: ${editingNodeId})`);
    } else {
      console.warn(`[SuggestionList:selectItem] No item found at index: ${index} in itemsToRender:`, itemsToRender);
    }
  };

  // Effect to scroll the selected item into view
// ... existing code ...
                className={className}
                onMouseDown={(e) => {
                    e.preventDefault();
                    selectItem(index); // Use the index within the full list
                }}
              >
// ... existing code ...
``` 