import React, { useState, useRef, useEffect, useContext, useCallback } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { ChevronDown, GripVertical, X } from 'lucide-react';
import ActionNodeContext from '../context/ActionNodeContext';
import { cn } from '../../../utils'; // Adjusted path for utils
import { filterSuggestions } from '../utils/filterSuggestions'; // Import filterSuggestions
import { useDrag, useDrop } from 'react-dnd'; // Added for DND
import { ItemTypes } from '../../../dndTypes'; // Added for DND

// Moved icon imports and map here
import incomingIcon from '../../../assets/Incoming.png'; // Adjusted path
import outgoingIcon from '../../../assets/Outgoing.png'; // Adjusted path

const qualifierIconMap = {
  incoming: incomingIcon,
  outgoing: outgoingIcon,
};

const colorClasses = {
  incoming: 'bg-green-100 border-green-200 text-green-800',
  outgoing: 'bg-yellow-100 border-yellow-200 text-yellow-800',
  default: 'bg-gray-100 border-gray-200 text-gray-800',
};

// Define the drag item type
// REMOVED: const ItemTypes = {
//   ACTION_NODE: 'ActionNodeItem',
// };

// --- React Component for the Action Node View ---
// Restore React.memo
const ActionNodeView = React.memo(({ node, updateAttributes, editor, selected, getPos, deleteNode }, ref) => {
  // Destructure ALL necessary attributes and content here
  const { nodeId: id, qualifier, equation, actionNodeType, actionId, isDragPlaceholder, isBeingDragged, word } = node.attrs;

  // === Main Context ===
  const {
    showHint,
    hideHint,
    setSuggestionState,
    registeredActions,
    suggestionStateRef,
    updateActionQualifier,
    updateActionWord,
    updateActionEquation,
    qualifierOptions,
    editingNodeId, // Use this from context
    startInlineEdit, // Use this from context
    stopInlineEdit, // Use this from context
    actionsState,
    editorContainerRef,
    openQualifierNodeId,
    setOpenQualifierNodeId,
    readOnly, // Get from context
    actionIdOptions = [], // Get from context, default to empty array
    updateActionId,      // Get from context
    openActionIdNodeId,  // Get from context
    setOpenActionIdNodeId, // Get from context
    setNodeDragState, // <-- Get the new function from context
    editorInstanceRef, // <<< ADD this if not already present, or ensure it's available via context
    hideSuggestionsOnBlur, // Make sure this is available from context
    isNodeInternalUIActive, // Already present from previous step but ensure it's used if needed
    setIsNodeInternalUIActive, // <<< Get setter from context
    removeAction, // Get from context
    editorId, // Get from context
  } = useContext(ActionNodeContext);

  // === State for UI ===
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingEquation, setIsEditingEquation] = useState(false);
  const [localEquation, setLocalEquation] = useState(equation || '');
  const [hasEquationError, setHasEquationError] = useState(false);
  const [isQualifierDropdownOpen, setIsQualifierDropdownOpen] = useState(false);
  const [isActionIdDropdownOpen, setIsActionIdDropdownOpen] = useState(false); // Added for Action ID

  // === Refs ===
  const inputRef = useRef(null);
  const equationInputRef = useRef(null);
  const originalWordRef = useRef(word);
  const originalEquationRef = useRef(equation);
  const qualifierButtonRef = useRef(null);
  const qualifierListRef = useRef(null);
  const actionIdButtonRef = useRef(null); // Added for Action ID
  const actionIdListRef = useRef(null); // Added for Action ID
  const wrapperRef = useRef(null); // Ref for the main wrapper

  // --- Find selected labels ---
  const selectedQualifierLabel = qualifierOptions.find(opt => opt.id === qualifier)?.label || 'Unknown';
  const selectedActionIdLabel = actionIdOptions.find(opt => opt.id === actionId)?.label || 'Select';

  // Prevent clicks from placing a cursor inside the placeholder node
  const handlePlaceholderClick = useCallback((event) => {
    if (isDragPlaceholder) {
      event.preventDefault();
      event.stopPropagation();
      // Optionally, ensure the editor doesn't try to select this node if not desired
      // For instance, if the editor is available and has focus command:
      // editor?.chain().focus().run(); // Or blur, or do nothing specific to selection
    }
  }, [isDragPlaceholder]);

  // Log the values captured during render
  useEffect(() => {
    // More detailed log:
    // console.log(`[ActionNodeView Render Scope] node.attrs:`, JSON.parse(JSON.stringify(node.attrs)), `node.textContent: ${node.textContent}`);
  }, [node.attrs, node.textContent]); // Log when attrs or textContent change

  // === Close dropdowns when editing starts ===
  useEffect(() => {
    if (isEditing || isEditingEquation) {
      setIsQualifierDropdownOpen(false);
      setIsActionIdDropdownOpen(false);
      setOpenQualifierNodeId(null);
      setOpenActionIdNodeId(null);
    }
  }, [isEditing, isEditingEquation, setOpenQualifierNodeId, setOpenActionIdNodeId]);

  // === Sync internal state with props ===
  useEffect(() => {
    setLocalEquation(equation || '');
    // Check equation validity on prop change too
    setHasEquationError(!validateEquation(equation || ''));
  }, [equation]);

  useEffect(() => {
    originalWordRef.current = word;
  }, [word]);

  // === Focus input when editing starts ===
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select(); // Select text
      // Notify parent editor that inline edit started
      startInlineEdit(id, word || '');
    } else if (!isEditing && editingNodeId === id) {
      // If editing stopped externally, ensure local state reflects it
      stopInlineEdit();
    }
  }, [isEditing, id, startInlineEdit, stopInlineEdit, editingNodeId, word]);

  useEffect(() => {
    if (isEditingEquation && equationInputRef.current) {
      equationInputRef.current.focus();
      equationInputRef.current.select();
    }
  }, [isEditingEquation]);

  // === Open/Close Dropdown Logic ===
  useEffect(() => {
    setIsQualifierDropdownOpen(openQualifierNodeId === id);
  }, [openQualifierNodeId, id]);

  useEffect(() => {
    setIsActionIdDropdownOpen(openActionIdNodeId === id); // Added for Action ID
  }, [openActionIdNodeId, id]);

  // === Close Dropdowns on Outside Click ===
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close Qualifier Dropdown
      if (qualifierListRef.current && !qualifierListRef.current.contains(event.target) &&
          qualifierButtonRef.current && !qualifierButtonRef.current.contains(event.target)) {
        if (openQualifierNodeId === id) {
           setOpenQualifierNodeId(null);
           setIsNodeInternalUIActive(false); // <<< Reset flag when closing
        }
      }
      // Close Action ID Dropdown
      if (actionIdListRef.current && !actionIdListRef.current.contains(event.target) &&
          actionIdButtonRef.current && !actionIdButtonRef.current.contains(event.target)) {
          if (openActionIdNodeId === id) {
            setOpenActionIdNodeId(null);
            setIsNodeInternalUIActive(false); // <<< Reset flag when closing
          }
        }

      // Handle Click Outside for Inline Name Edit
      if (isEditing && inputRef.current && !inputRef.current.contains(event.target) && wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        // Check if click was outside the suggestion menu portal as well
        const portal = document.querySelector('.suggestion-list-portal');
        if (!portal || !portal.contains(event.target)) {
          handleNameBlur(); // Commit changes on outside click if not clicking suggestion
        }
      }

      // Handle Click Outside for Inline Equation Edit
      if (isEditingEquation && equationInputRef.current && !equationInputRef.current.contains(event.target) && wrapperRef.current && !wrapperRef.current.contains(event.target)) {
         handleEquationBlur();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, isEditingEquation, id, openQualifierNodeId, openActionIdNodeId, setOpenQualifierNodeId, setOpenActionIdNodeId, setIsNodeInternalUIActive]); // Added Action ID dependencies

  // === Event Handlers ===

  // --- Name Editing --- 
  const handleDoubleClick = useCallback(() => {
    if (readOnly) return;
    originalWordRef.current = word;
    setIsEditing(true);
  }, [readOnly, word]);

  const handleNameChange = (event) => {
    // Directly update suggestion query via context if editing inline
    if (isEditing && startInlineEdit) {
       startInlineEdit(id, event.target.value);
    }
  };

  const commitNameChange = () => {
    const currentVal = inputRef.current?.value.trim();
    if (currentVal && currentVal !== originalWordRef.current) {
      updateActionWord(id, currentVal);
    } else if (!currentVal) {
      // Revert if empty
      if (inputRef.current) inputRef.current.value = originalWordRef.current;
    }
    setIsEditing(false);
    stopInlineEdit(); // Notify parent editor
  };

  const handleNameKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitNameChange();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (inputRef.current) inputRef.current.value = originalWordRef.current;
      setIsEditing(false);
      stopInlineEdit();
    }
  };

  const handleNameBlur = () => {
    // Delay blur handling slightly to allow click on suggestion menu
    setTimeout(() => {
        const portal = document.querySelector('.suggestion-list-portal');
        // Check if focus moved to the suggestion portal or its children
        if (!portal || !portal.contains(document.activeElement)) {
             commitNameChange();
        }
    }, 0);
  };

  // --- Equation Editing --- 
  const handleEquationClick = useCallback(() => {
    if (readOnly) return;
    originalEquationRef.current = localEquation;
    setIsEditingEquation(true);
  }, [readOnly, localEquation]);

  const handleEquationChange = (event) => {
    setLocalEquation(event.target.value);
  };

  const commitEquationChange = () => {
    const trimmedEquation = localEquation.trim();
    const isValid = validateEquation(trimmedEquation);
    setHasEquationError(!isValid);

    if (isValid) {
      if (trimmedEquation !== equation) {
        updateActionEquation(id, trimmedEquation);
      }
    } else {
      // Optionally revert or keep invalid input? Keeping for now.
      // setLocalEquation(equation || '');
      // setHasEquationError(false);
    }
    setIsEditingEquation(false);
  };

  const handleEquationKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitEquationChange();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setLocalEquation(equation || ''); // Revert
      setHasEquationError(false);
      setIsEditingEquation(false);
    }
  };

  const handleEquationBlur = () => {
      commitEquationChange();
  };

  // --- Qualifier Dropdown --- 
  const handleQualifierToggle = useCallback(() => {
    setOpenQualifierNodeId(prev => (prev === id ? null : id));
    setIsNodeInternalUIActive(true); // Signal that a child UI is active
  }, [id, setOpenQualifierNodeId, setIsNodeInternalUIActive]);

  const handleQualifierSelect = useCallback((value) => {
    updateActionQualifier(id, value);
    setOpenQualifierNodeId(null);
    setSuggestionState(prev => ({ ...prev, visible: false, forceVisible: false, editingNodeId: null }));
    if (editorInstanceRef?.current && !editorInstanceRef.current.isDestroyed) {
      editorInstanceRef.current.commands.blur();
    }
    stopInlineEdit(); 
    setIsNodeInternalUIActive(false); // <<< Reset flag after selection

  }, [id, updateActionQualifier, setSuggestionState, editorInstanceRef, stopInlineEdit, setIsNodeInternalUIActive]);

  // --- Action ID Dropdown --- // Added
  const handleActionIdToggle = useCallback(() => {
    setOpenActionIdNodeId(prev => (prev === id ? null : id));
    setIsNodeInternalUIActive(true);
  }, [id, setIsNodeInternalUIActive]);

  const handleActionIdSelect = (newActionId) => {
    updateActionId(id, newActionId);
    setOpenActionIdNodeId(null);
  };

  // === DND Drag Source Setup ===
  const [{ isDragging }, drag, preview] = useDrag({
    type: ItemTypes.ACTION_NODE,
    item: (monitor) => {
      // Announce drag start to the editor component
      setNodeDragState(id, true);
      const clientOffset = monitor.getClientOffset();
      const rect = wrapperRef.current?.getBoundingClientRect();
      console.log(`[DND] Drag Start`, JSON.stringify({
        nodeId: id,
        word: word,
        sourceEditorId: editorId,
        mousePosition: clientOffset,
        nodeBoundaries: rect,
      }, null, 2));
      return { id, originalIndex: actionsState.findIndex(a => a.id === id), sourceEditorId: editorId };
    },
    end: (item, monitor) => {
      // Announce drag end
      setNodeDragState(id, false);
      const dropResult = monitor.getDropResult();
      const clientOffset = monitor.getClientOffset();
      console.log(`[DND] Drag End`, JSON.stringify({
        nodeId: item.id,
        sourceEditorId: item.sourceEditorId,
        targetEditorId: dropResult?.droppedOnEditorId,
        dropResult: dropResult,
        mousePosition: clientOffset,
        didDrop: monitor.didDrop()
      }, null, 2));
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Attach drag and drop refs to the same node
  const dndRef = (node) => {
    wrapperRef.current = node;
    preview(node); // The whole node is the preview
    // Note: The drag handle is a separate element inside
  };

  const currentColorClass = colorClasses[qualifier] || colorClasses.default;

  if (isDragPlaceholder) {
    return (
      <NodeViewWrapper as="span" className="action-node-view inline-flex items-center rounded-lg px-2 py-1 text-sm bg-blue-100 border-dashed border-2 border-blue-400 mx-1">
        <span className="text-sm text-blue-600">{word}</span>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      ref={dndRef}
      as="span"
      className={cn(
        'action-node-view',
        'inline-flex items-center rounded-lg px-2 py-1 text-sm transition-shadow border',
        'mx-1', // Spacing
        'cursor-default', // Set default cursor for the node
        currentColorClass,
        {
          // State-based styles
          'opacity-50': isDragging,
          'ring-2 ring-blue-500 ring-offset-1': selected,
          'shadow-lg scale-105': isEditing || isEditingEquation,
          'shadow-red-500/50 shadow-md': hasEquationError,
        }
      )}
      onClick={handlePlaceholderClick}
    >
      <div
        ref={drag} // Apply drag handle only to the grip icon
        className="inline-flex items-center justify-center flex-grow"
        contentEditable={false}
        draggable="true"
        onMouseDown={(event) => {
          const rect = wrapperRef.current?.getBoundingClientRect();
          console.log(`[DND] Mouse Down`, JSON.stringify({
            nodeId: id,
            editorId: editorId,
            mousePosition: { x: event.clientX, y: event.clientY },
            nodeBoundaries: rect,
          }, null, 2));
        }}
        data-drag-handle
      >
        <GripVertical className="h-5 w-5 cursor-grab text-gray-400 mr-2" />

        {/* --- Restored Qualifier Dropdown with Label --- */}
        {!isEditing && !isEditingEquation && (
          <div className="relative inline-flex items-center" ref={qualifierButtonRef}>
            <button
              onClick={handleQualifierToggle}
                className="flex items-center justify-center p-1 rounded-md hover:bg-gray-200/50"
              aria-haspopup="true"
              aria-expanded={isQualifierDropdownOpen}
            >
              <img src={qualifierIconMap[qualifier] || incomingIcon} alt={selectedQualifierLabel} className="w-4 h-4" />
                <span className="ml-1 font-medium">{selectedQualifierLabel}</span>
            </button>
            {isQualifierDropdownOpen && (
              <div
                ref={qualifierListRef}
                className="absolute z-10 w-32 py-1 mt-1 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5"
                style={{ top: '100%', left: 0 }}
              >
                {qualifierOptions.map(option => (
                       <a key={option.id} href="#" 
                          onMouseDown={(e) => { e.preventDefault(); handleQualifierSelect(option.id); }}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {option.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Word/Name (Display or Edit) */}
        {!isDragPlaceholder && (
          isEditing ? (
            <input
              ref={inputRef}
              type="text"
              defaultValue={word}
              onChange={handleNameChange}
              onKeyDown={handleNameKeyDown}
              onBlur={handleNameBlur}
              className="mx-1 text-sm bg-white border border-blue-400 rounded-md shadow-inner focus:outline-none"
              style={{ minWidth: '50px', flexShrink: 1 }}
              size={word.length || 10}
            />
          ) : (
            <span
              onDoubleClick={handleDoubleClick}
              className="mx-1 text-sm text-gray-800 cursor-pointer"
            >
              {word}
            </span>
          )
        )}
        
        {/* Separator */}
        {!isDragPlaceholder && <div className="h-4 mx-1 border-l border-gray-300"></div>}

        {/* Equation (Display or Edit) */}
        {!isDragPlaceholder && (
          isEditingEquation ? (
            <input
              ref={equationInputRef}
              type="text"
              value={localEquation}
              onChange={handleEquationChange}
              onKeyDown={handleEquationKeyDown}
              onBlur={handleEquationBlur}
              className={cn(
                'text-sm bg-white border rounded-md shadow-inner focus:outline-none',
                hasEquationError ? 'border-red-500' : 'border-blue-400'
              )}
              style={{ minWidth: '40px' }}
              size={localEquation.length || 3}
            />
          ) : (
            <span
              onClick={handleEquationClick}
              className="text-sm text-gray-600 cursor-pointer hover:text-blue-600"
            >
              {equation || '...'}
            </span>
          )
        )}

        {/* ActionId Dropdown */}
        {!isDragPlaceholder && !isEditing && !isEditingEquation && (
           <div className="relative inline-flex items-center ml-1" ref={actionIdButtonRef}>
              <button
                onClick={handleActionIdToggle}
                className="flex items-center px-1 py-0.5 text-xs text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                <span>{selectedActionIdLabel}</span>
                <ChevronDown size={14} className="ml-1" />
              </button>
              {isActionIdDropdownOpen && (
                 <div
                    ref={actionIdListRef}
                    className="absolute z-10 w-32 py-1 mt-1 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5"
                    style={{ top: '100%', right: 0 }}
                 >
                    {actionIdOptions.map(option => (
                       <a key={option.id} href="#" onClick={(e) => { e.preventDefault(); handleActionIdSelect(option.id); }}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                       >
                          {option.label}
                       </a>
                    ))}
                 </div>
              )}
           </div>
        )}
        
        {/* Delete Button */}
        {!isDragPlaceholder && (
          <button
            onClick={() => removeAction(id)}
            className="ml-1.5 p-0.5 rounded-full hover:bg-red-100 text-gray-500 hover:text-red-600"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </NodeViewWrapper>
  );
}); // End React.memo wrapper

// Helper function for equation validation
const validateEquation = (eq) => {
  if (eq === '' || eq === null) return true; // Empty is valid
  return /^[=<>](?!0\d)\d*(\.\d+)?$/.test(eq.trim());
};

export default ActionNodeView;
