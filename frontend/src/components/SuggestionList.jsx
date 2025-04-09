import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';

// Assuming HIGHLIGHT_DICTIONARY is accessible or passed if hints are needed here
// import { HIGHLIGHT_DICTIONARY } from '../path/to/dictionary';

const SuggestionList = forwardRef((props, ref) => {
  console.log('[SuggestionList] Rendered with selectedIndex:', props.selectedIndex, 'highlightedItems:', props.highlightedItems);
  // Destructure new highlightedItems prop
  const { selectedIndex, setSelectedIndex, items, highlightedItems = [], onSelect, query } = props;
  const listRef = useRef(null); // Ref for the list container div

  // Determine which list to render based on whether there's a query
  const itemsToRender = query && highlightedItems.length > 0 ? highlightedItems : items;
  const isEmpty = itemsToRender.length === 0;

  const selectItem = index => {
    console.log(`[SuggestionList:selectItem] Called for index: ${index}`);
    // Get the item from the list that is actually being rendered
    const item = itemsToRender[index];
    if (item) {
      console.log(`[SuggestionList:selectItem] Found item: ${item}. Calling onSelect...`);
      console.log(`[SuggestionList:selectItem] typeof onSelect: ${typeof onSelect}`);
      onSelect(item); // Pass the selected item string directly
      console.log(`[SuggestionList:selectItem] Called onSelect for item: ${item}`);
    } else {
      console.warn(`[SuggestionList:selectItem] No item found at index: ${index} in itemsToRender:`, itemsToRender);
    }
  };

  // Effect to scroll the selected item into view
  useEffect(() => {
    // Use itemsToRender.length for the check
    if (listRef.current && selectedIndex >= 0 && selectedIndex < itemsToRender.length) {
      requestAnimationFrame(() => {
        if (!listRef.current) return;
        const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
        if (selectedElement) {
          selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      });
    }
  }, [selectedIndex, itemsToRender]); // Depend on itemsToRender

  // Render the list
  return (
    <div ref={listRef} className="suggestion-list bg-white border border-gray-300 rounded shadow-lg z-50 max-h-40 overflow-y-auto p-1 text-sm">
      {!isEmpty ? (
        // Iterate over itemsToRender
        itemsToRender.map((item, index) => {
            // isHighlighted is implicitly true if we are rendering highlightedItems
            const isHighlighted = true; // Simplified: All rendered items match query if query exists
            const isSelected = index === selectedIndex;
            // Adjusted class logic: highlight based on selection only
            const className = `px-3 py-1 cursor-pointer rounded ${isSelected ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`;

            if (index < 5 || isSelected) {
                 console.log(`[SuggestionList Item ${index}] selectedIndex: ${selectedIndex}, isSelected: ${isSelected}, item: ${item}, className: ${className}`);
            }
            return (
              <div
                key={item} // Use item as key assuming they are unique strings
                data-index={index} // Index within the *rendered* list
                className={className}
                onMouseDown={(e) => {
                    e.preventDefault();
                    selectItem(index); // Use the index within the rendered list
                }}
              >
                {item}
                {/* Optional: Add hint text here if needed */}
                {/* <span className="text-xs text-gray-500 ml-2">{HIGHLIGHT_DICTIONARY[item]?.hint}</span> */}
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
