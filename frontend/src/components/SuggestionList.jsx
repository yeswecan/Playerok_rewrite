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
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0 && selectedIndex < itemsToRender.length) {
      requestAnimationFrame(() => {
        if (!listRef.current) return;
        const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
        if (selectedElement) {
          selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      });
    }
  }, [selectedIndex, itemsToRender]);

  // Render the list
  return (
    <div ref={listRef} className="suggestion-list bg-white border border-gray-300 rounded shadow-lg z-50 max-h-40 overflow-y-auto p-1 text-sm">
      {!isEmpty ? (
        itemsToRender.map((item, index) => {
            const isSelected = index === selectedIndex;
            const shouldHighlight = query && highlightedItems.includes(item);
            let className = 'px-3 py-1 cursor-pointer rounded ';
            if (isSelected) {
              className += 'bg-blue-500 text-white';
            } else if (shouldHighlight) {
              className += 'bg-yellow-100';
            } else {
              className += 'hover:bg-gray-100';
            }

            if (index < 5 || isSelected || shouldHighlight) { // Log more verbosely
                 console.log(`[SuggestionList Item ${index}] selectedIndex: ${selectedIndex}, isSelected: ${isSelected}, shouldHighlight: ${shouldHighlight}, item: ${item}, className: ${className}`);
            }

            return (
              <div
                key={item}
                data-index={index}
                className={className}
                onMouseDown={(e) => {
                    e.preventDefault();
                    selectItem(index);
                }}
              >
                {item}
              </div>
            );
        })
      ) : (
        <div className="px-3 py-1 text-gray-500">No results</div>
      )}
    </div>
  );
});

export default SuggestionList;
