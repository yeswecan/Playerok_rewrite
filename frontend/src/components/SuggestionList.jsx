import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';

// Assuming HIGHLIGHT_DICTIONARY is accessible or passed if hints are needed here
// import { HIGHLIGHT_DICTIONARY } from '../path/to/dictionary';

const SuggestionList = forwardRef((props, ref) => {
  // Destructure new highlightedItems prop
  const { selectedIndex, setSelectedIndex, items, highlightedItems = [], onSelect, query } = props;
  const listRef = useRef(null); // Ref for the list container div

  const selectItem = index => {
    console.log(`[SuggestionList:selectItem] Called for index: ${index}`);
    const item = items[index];
    if (item) {
      console.log(`[SuggestionList:selectItem] Found item: ${item}. Calling onSelect...`);
      // Log if onSelect is a function before calling
      console.log(`[SuggestionList:selectItem] typeof onSelect: ${typeof onSelect}`);
      onSelect(item);
      console.log(`[SuggestionList:selectItem] Called onSelect for item: ${item}`);
    } else {
      console.warn(`[SuggestionList:selectItem] No item found at index: ${index}`);
    }
  };

  // Effect to scroll the selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0 && selectedIndex < items.length) {
      // Defer scroll slightly to ensure DOM is updated
      requestAnimationFrame(() => {
        if (!listRef.current) return; // Check ref again inside animation frame
        // Find the element by its data-index attribute
        const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
        if (selectedElement) {
          // Scroll into view, block: 'nearest' avoids unnecessary scrolling if already visible
          selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      });
    }
  }, [selectedIndex, items]); // Run when index or items change

  // Render the list
  return (
    // Attach listRef to the main div
    <div ref={listRef} className="suggestion-list bg-white border border-gray-300 rounded shadow-lg z-50 max-h-40 overflow-y-auto p-1 text-sm">
      {items.length ? (
        items.map((item, index) => {
            // Check if the current item should be highlighted based on the passed prop
            const isHighlighted = highlightedItems.includes(item);
            return (
              <div
                key={item}
                data-index={index}
                // Add background highlight if item is in highlightedItems
                className={`px-3 py-1 cursor-pointer rounded ${index === selectedIndex ? 'bg-blue-100' : isHighlighted ? 'bg-yellow-100' : 'hover:bg-gray-100'}`}
                // Use onMouseDown to prevent editor blur before selection happens
                onMouseDown={(e) => {
                    e.preventDefault(); // Prevent default blur/focus behaviour
                    selectItem(index);
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
