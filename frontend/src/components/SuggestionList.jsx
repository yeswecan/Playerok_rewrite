import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';

// Assuming HIGHLIGHT_DICTIONARY is accessible or passed if hints are needed here
// import { HIGHLIGHT_DICTIONARY } from '../path/to/dictionary';

const SuggestionList = ({ items = [], highlightedIndices = [], selectedIndex, onSelect, query, showHint, hideHint }) => {
    const listRef = useRef(null);
    const [hasHighlighted, setHasHighlighted] = useState(false);

    // console.log('[SuggestionList] Rendered with state:', { items, selectedIndex, highlightedIndices, query });

    useEffect(() => {
        setHasHighlighted(highlightedIndices.length > 0);
    }, [highlightedIndices]);

    useLayoutEffect(() => {
        if (selectedIndex >= 0 && listRef.current && listRef.current.children[selectedIndex]) {
            const item = listRef.current.children[selectedIndex];
            item.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
            });
        }
    }, [selectedIndex]);

    const itemsToDisplay = items;

    if (!itemsToDisplay || itemsToDisplay.length === 0) {
        return null;
    }

    return (
        <div
            ref={listRef}
            className="bg-white rounded-md shadow-lg overflow-y-auto max-h-60 w-48 border border-gray-200 text-sm"
            style={{ zIndex: 1000 }}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} // Prevent blur and event propagation
            onClick={(e) => e.stopPropagation()} // Prevent click from bubbling
        >
            {itemsToDisplay.map((item, index) => {
                const isSelected = index === selectedIndex;
                const shouldHighlight = highlightedIndices.includes(index);

                const className = `
                    px-3 py-1 cursor-pointer rounded
                    ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'}
                    ${shouldHighlight ? 'highlighted' : ''} 
                `.trim(); // Ensure trailing space is handled

                // console.log(`[SuggestionList Item ${index}] Render props:`, { isSelected, shouldHighlight, className });

                // --- Temporary Inline Styles for Debugging Highlighting ---
                const itemStyle = {};
                if (isSelected) {
                  // Selection style takes precedence
                  itemStyle.backgroundColor = '#dbeafe'; // Tailwind blue-100
                } else if (shouldHighlight) {
                  // Apply highlight style only if not selected
                  itemStyle.backgroundColor = '#fef9c3'; // yellow-100
                  itemStyle.fontWeight = '600'; // font-semibold
                }
                // --- End Temporary Styles ---

                return (
                    <div
                        key={index}
                        className={className}
                        style={itemStyle}
                        onClick={() => {
                            onSelect(item);
                            hideHint(); // Hide hint immediately on click
                        }}
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={(e) => {
                            const targetElement = e.currentTarget;
                            if (typeof item === 'object' && item.type !== 'new' && item.hint && targetElement) {
                                const rect = targetElement.getBoundingClientRect();
                                showHint(rect, item.hint, targetElement, 'suggestion');
                            }
                        }}
                        onMouseLeave={hideHint}
                    >
                        {/* --- Render Logic for Add New vs Regular Item --- */}
                        {typeof item === 'object' && item.type === 'new' ? (
                            <>
                                {item.word}
                                <span className="text-gray-500 ml-1"> (Add new action)</span>
                            </>
                        ) : typeof item === 'object' ? (
                            item.word
                        ) : (
                            item
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default SuggestionList;
