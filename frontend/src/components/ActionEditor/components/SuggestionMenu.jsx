import React, { useRef, useEffect, useLayoutEffect, useState, useContext } from 'react';
import ActionNodeContext from '../context/ActionNodeContext'; // RENAMED

const SuggestionMenu = ({ items = [], highlightedIndices = [], selectedIndex, onSelect, query }) => {
    const listRef = useRef(null);
    const [hasHighlighted, setHasHighlighted] = useState(false);
    const { showHint, hideHint } = useContext(ActionNodeContext); // RENAMED

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
            className="suggestion-list bg-white rounded-md shadow-lg overflow-y-auto max-h-60 w-48 border border-gray-200 text-sm"
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
                `.trim();

                const itemStyle = {};
                if (isSelected) {
                  itemStyle.backgroundColor = '#dbeafe'; // Tailwind blue-100
                } else if (shouldHighlight) {
                  itemStyle.backgroundColor = '#fef9c3'; // yellow-100
                  itemStyle.fontWeight = '600'; // font-semibold
                }

                return (
                    <div
                        key={index} // Use index as key for now, consider stable IDs if possible
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
                            // Only show hint for existing actions (objects with hints)
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
                            item.word // Display the word property for existing action objects
                        ) : (
                            item // Fallback for simple string items if any
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default SuggestionMenu;
