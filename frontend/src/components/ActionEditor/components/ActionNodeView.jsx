import React, { useState, useRef, useEffect, useContext, useCallback } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
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

// Define the drag item type
// REMOVED: const ItemTypes = {
//   ACTION_NODE: 'ActionNodeItem',
// };

// --- React Component for the Action Node View ---
// Restore React.memo
const ActionNodeView = React.memo(({ node, updateAttributes, editor, selected, getPos, deleteNode }, ref) => {
  // Destructure ALL necessary attributes and content here
  const { nodeId: id, qualifier, equation, actionNodeType, actionId, isDragPlaceholder, isBeingDragged } = node.attrs;
  const word = node.textContent; // Capture textContent here

  // === DND Context === REMOVED
  // const { currentlyDraggedItemId, setCurrentlyDraggedItemId } = useContext(ActionNodeDndContext);

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
  const toggleQualifierDropdown = useCallback((e) => {
    e.stopPropagation();
    if (readOnly) return;
    
    const currentlyOpen = openQualifierNodeId === id;
    if (!currentlyOpen) {
      setIsNodeInternalUIActive(true); // <<< Set flag when opening
    } else {
      setIsNodeInternalUIActive(false); // <<< Reset flag if explicitly closing by toggle
    }

    // Close other dropdown (Action ID)
    setOpenActionIdNodeId(null);

    const newOpenState = currentlyOpen ? null : id;
    setOpenQualifierNodeId(newOpenState);

    // Explicitly hide suggestion menu
    setSuggestionState(prev => ({ ...prev, visible: false, forceVisible: false, editingNodeId: null }));

    if (editorInstanceRef?.current && !editorInstanceRef.current.isDestroyed) {
      editorInstanceRef.current.commands.blur();
    }
    
    if (currentlyOpen) {
        stopInlineEdit(); 
    }

  }, [readOnly, id, openQualifierNodeId, setOpenQualifierNodeId, setOpenActionIdNodeId, setSuggestionState, editorInstanceRef, stopInlineEdit, setIsNodeInternalUIActive]);

  const handleQualifierSelect = useCallback((value) => {
    updateActionQualifier(id, value);
    setSuggestionState(prev => ({ ...prev, visible: false, forceVisible: false, editingNodeId: null }));
    if (editorInstanceRef?.current && !editorInstanceRef.current.isDestroyed) {
      editorInstanceRef.current.commands.blur();
    }
    stopInlineEdit(); 
    setIsNodeInternalUIActive(false); // <<< Reset flag after selection

  }, [id, updateActionQualifier, setSuggestionState, editorInstanceRef, stopInlineEdit, setIsNodeInternalUIActive]);

  // --- Action ID Dropdown --- // Added
  const toggleActionIdDropdown = useCallback((e) => {
    e.stopPropagation();
    if (readOnly) return;

    const currentlyOpen = openActionIdNodeId === id;
    if (!currentlyOpen) {
      setIsNodeInternalUIActive(true); // <<< Set flag when opening
    } else {
      setIsNodeInternalUIActive(false); // <<< Reset flag if explicitly closing by toggle
    }

    setOpenQualifierNodeId(null); // Close other dropdown
    setOpenActionIdNodeId(prev => (prev === id ? null : id));

    // Similar logic for suggestion menu and blur if needed for ActionID dropdown
    setSuggestionState(prev => ({ ...prev, visible: false, forceVisible: false, editingNodeId: null }));
    if (editorInstanceRef?.current && !editorInstanceRef.current.isDestroyed) {
      editorInstanceRef.current.commands.blur();
    }
    if (openActionIdNodeId === id && !(newOpenState === id)) { // If closing
        stopInlineEdit();
    }

  }, [readOnly, id, openActionIdNodeId, setOpenActionIdNodeId, setOpenQualifierNodeId, setIsNodeInternalUIActive, setSuggestionState, editorInstanceRef, stopInlineEdit]);

  const handleActionIdSelect = useCallback((value) => {
    updateActionId(id, value);
    setIsNodeInternalUIActive(false); // <<< Reset flag after selection
    // Ensure suggestion menu is hidden and editor is blurred, similar to qualifier select
    setSuggestionState(prev => ({ ...prev, visible: false, forceVisible: false, editingNodeId: null }));
    if (editorInstanceRef?.current && !editorInstanceRef.current.isDestroyed) {
      editorInstanceRef.current.commands.blur();
    }
    stopInlineEdit();
  }, [id, updateActionId, setIsNodeInternalUIActive, setSuggestionState, editorInstanceRef, stopInlineEdit]);


  // === DND Drag Source Setup ===
  // Disable drag for the placeholder node itself
  const [{ isDragging }, dragRef, dragPreview] = useDrag(() => ({
    type: ItemTypes.ACTION_NODE,
    item: {
      id: id,
      word: word,
      qualifier: qualifier,
      equation: equation,
      actionNodeType: actionNodeType,
      actionId: actionId
    },
    canDrag: !isDragPlaceholder, // Prevent dragging the placeholder
    // Use drag and end to update Tiptap attribute via context function
    drag: (item, monitor) => {
      // Set state only once when drag starts
      if (monitor.isDragging() && !isBeingDragged) {
         setNodeDragState(id, true); 
      }
    },
    end: (item, monitor) => {
      // Always clear state when drag ends
      setNodeDragState(id, false);
    },
    collect: monitor => ({
      // Still collect isDragging for potential use (e.g., preview), but don't use for hiding
      isDragging: monitor.isDragging(),
    })
  }), [
      id, word, qualifier, equation, actionNodeType, actionId, 
      isDragPlaceholder, setNodeDragState, isBeingDragged // Add dependencies
  ]);

  // Determine if this node should be hidden based on TIPTAP ATTRIBUTE
  const shouldBeHidden = isBeingDragged;

  // Combine drag refs
  const connectRefs = (el) => {
    dragRef(el);
    wrapperRef.current = el; // Assign to wrapperRef
  };

  // Log isDragging state just before applying class
  // console.log(`[ActionNodeView render ${id}] shouldBeHidden (from attr): ${shouldBeHidden}, isPlaceholder: ${isDragPlaceholder}`);

  // === Define labels needed for rendering regular nodes ===
  // Find label for selected qualifier
  const selectedQualifierLabel = qualifierOptions.find(opt => opt.id === qualifier)?.label || 'Select';
  // Find label for selected action ID
  const selectedActionIdObj = actionIdOptions?.find(opt => opt.id === actionId);
  let selectedActionIdLabel = 'Select Action';
  if (selectedActionIdObj) {
    selectedActionIdLabel = selectedActionIdObj.label;
  } else if (actionIdOptions && actionIdOptions.length > 0) {
    selectedActionIdLabel = actionIdOptions[0].label; // Default to first option's label if no match
    // Optionally, update the state if the current actionId is invalid for the options
    // useEffect(() => { updateActionId(id, actionIdOptions[0].id); }, []); // Example: Run once on mount
  }

  // === Conditional classes ===
  const wrapperClasses = cn(
    'action-node-view',
    'inline-flex items-center p-1 border rounded-md shadow-sm bg-white mx-0.5 min-h-[36px]',
    readOnly && 'opacity-80 bg-gray-50',
    selected && !isDragPlaceholder && 'ring-2 ring-blue-500 outline-none',
    isBeingDragged && 'opacity-30', // Style for the original node being dragged
    isDragPlaceholder && 'border-dashed border-blue-500 bg-blue-50 opacity-70', 
    hasEquationError && 'border-red-500'
  );

  if (isDragPlaceholder) {
    // Simplified rendering for placeholder
    return (
      <NodeViewWrapper
        ref={wrapperRef} // Keep ref for potential size calculations or other needs
        className={wrapperClasses}
        draggable={false} // Placeholder itself should not be draggable again
        data-node-id={id}
        onClick={handlePlaceholderClick} // Add the click handler here
      >
        <span className="text-sm text-gray-600 px-2">{word}</span>
      </NodeViewWrapper>
    );
  }

  // Default rendering for actual action nodes
  return (
    <NodeViewWrapper
       ref={connectRefs} // Use combined ref
       className={wrapperClasses}
       draggable={!isDragPlaceholder} 
       data-drag-handle 
    >
      {/* Don't render interactive elements for placeholder */}
      {isDragPlaceholder ? (
        <span className="italic px-1">{word}</span> 
      ) : (
        <>
          {/* Optional: Drag Handle (uncomment if needed) */}
          {/* <GripVertical
             ref={dragRef} // Attach drag ref here if using handle
             className="h-4 w-4 mr-1.5 text-gray-400 cursor-grab active:cursor-grabbing"
             aria-label="Drag action"
          /> */}

          {/* --- Qualifier Dropdown --- */}
          {!readOnly && (
              <div className="relative inline-block text-left mr-1.5">
            <button
                      ref={qualifierButtonRef}
              onClick={toggleQualifierDropdown}
                      className={cn(
                          "inline-flex justify-center items-center w-full rounded-md border border-gray-300 shadow-sm px-1.5 py-0.5 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-indigo-500",
                          isQualifierDropdownOpen && 'ring-2 ring-indigo-500'
                      )}
              aria-haspopup="true"
                      aria-expanded={isQualifierDropdownOpen}
            >
                      {qualifierIconMap[qualifier] && (
                          <img src={qualifierIconMap[qualifier]} alt={selectedQualifierLabel} className="w-3 h-3 mr-1.5" style={{ pointerEvents: 'none' }} />
                      )}
                      <span style={{ userSelect: 'none', pointerEvents: 'none' }}>{selectedQualifierLabel}</span>
                      <ChevronDown className="-mr-0.5 ml-1 h-3 w-3" aria-hidden="true" style={{ pointerEvents: 'none' }} />
            </button>
                {isQualifierDropdownOpen && (
                    <div
                       ref={qualifierListRef}
                       className={cn("origin-top-right absolute right-0 mt-1 w-36 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10")}
                       role="menu"
                       aria-orientation="vertical"
                       aria-labelledby="options-menu"
                    >
                        <div className="py-1" role="none">
                            {qualifierOptions.map((option) => (
                  <button
                                    key={option.id}
                                    onClick={(e) => { e.stopPropagation(); handleQualifierSelect(option.id); }}
                                    className={cn(
                                        "flex items-center w-full text-left px-3 py-1 text-xs",
                                        qualifier === option.id ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                                        'hover:bg-gray-100 hover:text-gray-900'
                                    )}
                                    role="menuitem"
                                >
                                    {qualifierIconMap[option.id] && (
                                        <img src={qualifierIconMap[option.id]} alt={option.label} className="w-3 h-3 mr-2" />
                                    )}
                                    {option.label}
                  </button>
              ))}
                        </div>
                    </div>
            )}
          </div>
          )}
          {readOnly && <span className="text-xs mr-1.5 px-1.5 py-0.5 text-gray-600">{selectedQualifierLabel}:</span>}

          {/* --- Name Section --- */}
          <div className="flex items-center flex-grow min-w-0" onDoubleClick={handleDoubleClick}>
              {!isEditing ? (
                  <span
                      className={cn(
                          "flex-grow px-1 truncate",
                          readOnly ? 'cursor-default' : 'cursor-text'
                      )}
                  >
                    {word}
                  </span>
              ) : (
                <input
                    ref={inputRef}
                      type="text"
                      defaultValue={word || ''}
                      onChange={handleNameChange}
                      onKeyDown={handleNameKeyDown}
                      onBlur={handleNameBlur}
                      className={cn("flex-grow px-1 bg-white border border-blue-400 rounded outline-none focus:ring-1 focus:ring-blue-500")}
                      autoFocus
                  />
              )}
          </div>

          {/* --- Equation Section --- */}
          <div className="flex items-center ml-1.5 border-l border-gray-300 pl-1.5">
              {!isEditingEquation ? (
                  <span
                      onClick={handleEquationClick}
                      className={cn(
                        "text-xs text-gray-600 px-1 min-w-[20px] text-center",
                        readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-gray-200 rounded',
                        hasEquationError && 'text-red-600 font-semibold'
                      )}
                  >
                      {localEquation || '-'}
            </span>
          ) : (
                <input
                    ref={equationInputRef}
                    type="text"
                    value={localEquation}
                      onChange={handleEquationChange}
                      onKeyDown={handleEquationKeyDown}
                      onBlur={handleEquationBlur}
                    className={cn(
                          "w-16 px-1 text-xs bg-white border border-blue-400 rounded outline-none focus:ring-1 focus:ring-blue-500",
                          hasEquationError && 'border-red-500'
                      )}
                      autoFocus
                  />
              )}
          </div>

            {/* --- Action ID Dropdown --- */}
           {!readOnly && (
               <div className="relative inline-block text-left ml-1.5 border-l border-gray-300 pl-1.5">
                   <button
                       ref={actionIdButtonRef}
                       onClick={toggleActionIdDropdown}
                       className={cn(
                          "inline-flex justify-center items-center w-full rounded-md border border-gray-300 shadow-sm px-1.5 py-0.5 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-indigo-500",
                          isActionIdDropdownOpen && 'ring-2 ring-indigo-500'
                       )}
                aria-haspopup="true"
                       aria-expanded={isActionIdDropdownOpen}
             >
                       {selectedActionIdLabel}
                       <ChevronDown className="-mr-0.5 ml-1 h-3 w-3" aria-hidden="true" />
             </button>
                   {isActionIdDropdownOpen && (
                       <div
                          ref={actionIdListRef}
                          className={cn("origin-top-right absolute right-0 mt-1 w-36 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10")}
                          role="menu"
                          aria-orientation="vertical"
                       >
                           <div className="py-1" role="none">
                               {actionIdOptions?.map((option) => (
              <button
                                   key={option.id}
                                   onClick={(e) => { e.stopPropagation(); handleActionIdSelect(option.id); }}
                                   className={cn(
                                      "block w-full text-left px-3 py-1 text-xs",
                                      actionId === option.id ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                                      'hover:bg-gray-100 hover:text-gray-900'
                                   )}
                                   role="menuitem"
              >
                 {option.label}
               </button>
           ))}
                           </div>
                       </div>
              )}
            </div>
          )}
           {readOnly && <span className="text-xs ml-1.5 pl-1.5 border-l border-gray-300 px-1 py-0.5 text-gray-600">{selectedActionIdLabel}</span>}


          {/* --- Delete Button --- */}
          {!readOnly && (
          <button
                  onClick={(e) => { e.stopPropagation(); deleteNode(); }}
                  className="ml-1.5 p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 focus:outline-none focus:ring-1 focus:ring-red-500"
                  aria-label="Delete action"
            title="Delete action"
          >
                  <X size={14} />
          </button>
          )}
        </>
      )}
    </NodeViewWrapper>
  );
}); // End React.memo wrapper

// Helper function for equation validation
const validateEquation = (eq) => {
  if (eq === '' || eq === null) return true; // Empty is valid
  return /^[=<>](?!0\d)\d*(\.\d+)?$/.test(eq.trim());
};

export default ActionNodeView;
