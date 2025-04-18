import React, { useState, useCallback, useEffect, createContext, useContext, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { EditorProvider, useCurrentEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { ChevronDown } from 'lucide-react';
import incomingIcon from '../assets/Incoming.png';
import outgoingIcon from '../assets/Outgoing.png';

// --- Helpers moved outside component ---
function filterSuggestions(query, registeredActions) {
  if (!registeredActions) return [];
  // Ensure query is treated as a string
  const lowerCaseQuery = String(query || '').toLowerCase();
  return registeredActions.filter(item =>
    item.toLowerCase().includes(lowerCaseQuery)
  );
}

function calculateCoordsForInput(inputEl) {
  if (!inputEl) return null;
  const rect = inputEl.getBoundingClientRect();
  // Return absolute coordinates
  return {
    x: rect.left,          // Use absolute left
    y: rect.bottom + 5,    // Position slightly below input (absolute)
    top: rect.top - 5,     // Position slightly above input (absolute) - might need adjustment based on list height
    inputBottom: rect.bottom,
    inputTop: rect.top,
    inputLeft: rect.left,
  };
}

// --- Hint Context Reference (assuming ActionEditorComponent provides it) ---
import { HintContext } from './ActionEditorComponent'; // Adjust path if necessary

// Map qualifier IDs to their icons
const qualifierIconMap = {
  incoming: incomingIcon,
  outgoing: outgoingIcon,
};

// --- React Component for the Action Node View ---
// Wrap with forwardRef
const ActionNodeView = React.forwardRef(({ node, updateAttributes, editor, selected, getPos, deleteNode }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);
  const originalWordRef = useRef(node.textContent);
  const { qualifier, nodeId } = node.attrs || {};
  const hintContext = useContext(HintContext);
  const {
    showHint,
    hideHint,
    onActionDeleted,
    setSuggestionState,
    registeredActions,
    suggestionStateRef,
    updateActionQualifier,
    updateActionWord,
    qualifierOptions,
    editingNodeId,
    startInlineEdit,
    stopInlineEdit
  } = hintContext;
  const displayQualifierOptions = qualifierOptions.filter(opt => opt.id !== 'scheduled');
  const selectedOptionIcon = qualifierIconMap[qualifier];
  const wrapperRef = useRef(null);

  const isCurrentlyEditing = editingNodeId === nodeId;

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      // Close dropdown if click is outside the node view wrapper
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
         // Also check if the click is inside the suggestion list portal
         const portalElement = document.querySelector('.suggestion-list-portal'); // Use a more specific selector if needed
         if (!portalElement || !portalElement.contains(event.target)) {
            setIsOpen(false);
         }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);


  const selectedOptionLabel = qualifierOptions.find(opt => opt.id === qualifier)?.label || qualifierOptions[0].label;

  const handleQualifierChange = (newQualifierId) => {
    // Call the context function instead, which updates the main state
    updateActionQualifier(nodeId, newQualifierId);
  };

  const toggleDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleMouseEnter = () => {
    if (wrapperRef.current && node.textContent) {
      const rect = wrapperRef.current.getBoundingClientRect();
      showHint(rect, node.textContent);
    }
  };

  const handleMouseLeave = () => {
    hideHint();
  };

  // --- Effect to focus input when this node enters edit mode ---
  useEffect(() => {
    if (isCurrentlyEditing && inputRef.current) {
      // console.log(`[ActionNodeView useEffect isCurrentlyEditing=true] Focusing input for node ${nodeId}`);
      // Focus MUST happen before getBoundingClientRect, but might need timeout
      inputRef.current.focus();
      inputRef.current.select();

      // Calculate coords now that input is likely rendered and focused
      const coords = calculateCoordsForInput(inputRef.current);
      // console.log(`[ActionNodeView useEffect isCurrentlyEditing=true] Calculated Coords:`, coords);

      if (coords) {
        // Update parent state with coords and visibility
        setSuggestionState(prev => ({
          ...prev,
          visible: true, // Now make it visible
          coords: coords, // Pass calculated absolute coords
          // Ensure other relevant state from startInlineEdit is preserved
          editingNodeId: nodeId,
          query: prev.query, // Keep query from startInlineEdit
          forceVisible: true,
          items: registeredActions,
          highlightedIndices: prev.highlightedIndices,
          selectedIndex: prev.selectedIndex,
        }));
        // hintContext.requestStateUpdate?.('inline-edit-coords-ready');
      } else {
        // console.error(`[ActionNodeView useEffect isCurrentlyEditing=true] Failed to calculate coords for ${nodeId}`);
        // Hide suggestions if coords failed
        stopInlineEdit(); // Tell parent to stop if coords fail
      }
    }
  }, [isCurrentlyEditing]); // Runs when this node specifically enters/exits edit mode


  function handleCommitEdit(value) {
    const newWord = value.trim();
    // Don't set isEditing locally, parent controls this via stopInlineEdit

    // Clear parent suggestion state *before* updating word state
    setSuggestionState(prev => ({ ...prev, visible: false, forceVisible: false, editingNodeId: null, query: '' }));

    if (newWord && newWord !== originalWordRef.current) {
      // Call context function to update the main state
      updateActionWord(node.attrs.nodeId, newWord);
      // No direct Tiptap manipulation here! State sync handles it.
    } else {
      // If no change, ensure editor is focused if needed, but state sync should handle the visual reset
      editor?.chain().focus().run(); // Refocus editor might be needed
    }
  }

  function handleKeyDown(e) {
    const key = e.key;
    // Get suggestion state directly from the ref passed via context
    const refState = suggestionStateRef.current || { highlightedItems: [], selectedIndex: -1, items: registeredActions || [] };
    const fullItems = refState.items || [];
    const maxIndex = fullItems.length > 0 ? fullItems.length - 1 : -1;

    // Navigation and selection logic remains, but calls context `setSuggestionState`
    if (key === 'ArrowDown' || key === 'Down') {
      e.preventDefault();
      setSuggestionState(prev => {
        if (!prev.visible) return prev; // Don't change index if not visible
        const currentMaxIndex = (prev.items || []).length - 1;
        const newIndex = prev.selectedIndex < currentMaxIndex ? prev.selectedIndex + 1 : 0;
        return { ...prev, selectedIndex: newIndex };
      });
    } else if (key === 'ArrowUp' || key === 'Up') {
      e.preventDefault();
      setSuggestionState(prev => {
         if (!prev.visible) return prev;
        const currentMaxIndex = (prev.items || []).length - 1;
        const newIndex = prev.selectedIndex > 0 ? prev.selectedIndex - 1 : currentMaxIndex;
        return { ...prev, selectedIndex: newIndex };
      });
    } else if (key === 'Enter') {
      e.preventDefault();
      const { selectedIndex = -1, items = [], visible } = refState;

      if (visible && selectedIndex >= 0 && items && items.length > selectedIndex) {
        const selectedWord = items[selectedIndex];
        // Commit the edit with the selected word
        handleCommitEdit(selectedWord);
      } else {
        // Commit the edit with the current input value
        handleCommitEdit(e.target.value);
      }
    } else if (key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
      stopInlineEdit(); // Tell parent to stop editing
      // Hide suggestions via context
      setSuggestionState(prev => ({ ...prev, visible: false, forceVisible: false, editingNodeId: null, query: '' }));
      editor?.chain().focus().run(); // Focus editor after cancelling
    }
    // Let other keys pass through for typing
  }

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className={`action-node inline-block bg-gray-100 rounded px-2 py-1 mx-px text-sm border border-gray-300 cursor-pointer ${selected ? 'ring-2 ring-blue-500' : ''}`}
      data-node-id={nodeId}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={() => {
        if (!isCurrentlyEditing) { // Only trigger if not already editing
          originalWordRef.current = node.textContent || ''; // Ensure it's a string
          // console.log(`[ActionNodeView onDoubleClick WRAPPER] Setting isEditing=true for node ${nodeId}`);
          startInlineEdit(nodeId, originalWordRef.current); // Tell parent to start editing this node
        }
      }}
      onClick={() => {
          // Temporarily removing onClick to debug double-click issues
          // console.log('[ActionNodeView onClick]');
      }}
    >
      {/* NodeViewContent is often used for editable content within the node managed by Tiptap,
          but since we replace content with an input for editing, keep it minimal or hidden */}
      <NodeViewContent className="hidden" ref={ref} />

      {isCurrentlyEditing ? (
        // Input field for inline editing
        <span className="inline-flex items-center">
            <input
                ref={inputRef}
                defaultValue={originalWordRef.current}
                onBlur={(e) => {
                    // Important: Check if blur is going to the suggestion list
                    const relatedTarget = e.relatedTarget;
                     if (relatedTarget && relatedTarget.closest('.suggestion-list-portal')) {
                         // console.log('Blur to suggestion list, ignoring commit');
                         return; // Don't commit if focus moved to suggestion list
                     }
                    // console.log('Blur detected, committing edit');
                    handleCommitEdit(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                onChange={(e) => {
                    const query = e.target.value;
                    // Update the *main* suggestion state via context
                    setSuggestionState(prev => {
                        if (!prev.editingNodeId) return prev; // Only update if we are in inline edit mode
                        const filtered = filterSuggestions(query, registeredActions);
                        const highlightedIndices = filtered.map(item => registeredActions.indexOf(item)).filter(i => i !== -1);
                        // Don't recalculate coords here, main component handles it
                        // console.log('[InlineInput onChange] Updating suggestions:', { query, filtered });
                        return {
                            ...prev,
                            query,
                            highlightedItems: filtered, // We might not need this if using indices
                            highlightedIndices: highlightedIndices,
                            // Select first match if query changed, otherwise keep current index
                            selectedIndex: prev.query !== query
                                            ? (highlightedIndices.length > 0 ? highlightedIndices[0] : -1)
                                            : prev.selectedIndex,
                            // Keep visible: true, forceVisible: true, editingNodeId: nodeId
                        };
                    });
                }}
                className="bg-white border border-blue-300 rounded px-1 outline-none"
                style={{ minWidth: '50px' }}
            />
        </span>
      ) : (
        // Display view (non-editing)
        <span className="inline-flex items-center relative">
          <span
            className="action-word-content inline mr-1"
          >
            {/* Display node text content */}
            {node.textContent || '...'}
          </span>
          {/* Qualifier Dropdown Button */}
          <button
            onMouseDown={(e) => {e.preventDefault(); e.stopPropagation();}}
            onClick={toggleDropdown}
            className="flex items-center px-1 py-0.5 bg-yellow-200 border-l border-yellow-300 hover:bg-yellow-300 transition-colors relative z-10"
            aria-haspopup="true"
            aria-expanded={isOpen}
          >
            {selectedOptionIcon && <img src={selectedOptionIcon} alt={selectedOptionLabel} className="h-4 w-auto mr-1 inline-block" />}
            <span className="mr-0.5">{selectedOptionLabel}</span>
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          </button>
          {/* Qualifier Dropdown List */}
          {isOpen && (
              <div
                className="absolute top-full right-0 mt-1 w-32 bg-white shadow-lg rounded-md border border-gray-200 z-50"
                onMouseDown={(e) => e.preventDefault()}
              >
                {displayQualifierOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsOpen(false);
                      updateActionQualifier(nodeId, option.id);
                    }}
                    className="flex items-center block w-full text-left px-4 py-2 hover:bg-gray-100 first:rounded-t-md last:rounded-b-md"
                  >
                    <img src={qualifierIconMap[option.id]} alt={option.label} className="h-4 w-auto mr-2 inline-block" />
                    {option.label}
                  </button>
                ))}
              </div>
          )}
          {/* Delete Button */}
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent node selection when clicking delete
              // Call context function for deletion (implement in Step 6)
              // deleteAction(nodeId); // Placeholder for Step 6
              console.warn(`[ActionNodeView] Delete action for ${nodeId} requested (implement Step 6)`);
              // For now, fallback to Tiptap's deleteNode if context function isn't ready
               deleteNode(); // Temporary direct deletion
               onActionDeleted(nodeId); // Call parent callback directly for now
            }}
            className="flex items-center justify-center px-1 py-0.5 bg-red-300 hover:bg-red-400 text-gray-800 border-l border-yellow-300 rounded-r transition-colors z-10" // Style as delete, add z-index
            title="Delete action"
          >
            ×
          </button>
        </span>
      )}
    </NodeViewWrapper>
  );
});

export default ActionNodeView; 