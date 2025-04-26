import React, { useState, useRef, useEffect, useContext } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { ChevronDown } from 'lucide-react';
import HintContext from '../context/HintContext';
import { cn } from '../../../utils'; // Adjusted path for utils
import { filterSuggestions } from '../utils/filterSuggestions'; // Import filterSuggestions

// Moved icon imports and map here
import incomingIcon from '../../../assets/Incoming.png'; // Adjusted path
import outgoingIcon from '../../../assets/Outgoing.png'; // Adjusted path

const qualifierIconMap = {
  incoming: incomingIcon,
  outgoing: outgoingIcon,
};

// --- React Component for the Action Node View ---
const ActionNodeView = React.forwardRef(({ node, updateAttributes, editor, selected, getPos, deleteNode }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef(null);
  const originalWordRef = useRef(node.textContent);
  const [isEditingEquation, setIsEditingEquation] = useState(false);
  const equationInputRef = useRef(null);
  const originalEquationRef = useRef(node.attrs.equation || '');
  const [localEquation, setLocalEquation] = useState(node.attrs.equation || '');
  const [hasEquationError, setHasEquationError] = useState(false);
  const { qualifier, nodeId, equation } = node.attrs || {};
  const hintContext = useContext(HintContext);
  const {
    showHint,
    hideHint,
    // onActionDeleted, // Not used directly, deleteNode prop is used
    setSuggestionState,
    registeredActions,
    suggestionStateRef,
    updateActionQualifier,
    updateActionWord,
    updateActionEquation,
    qualifierOptions = [],
    editingNodeId,
    startInlineEdit,
    stopInlineEdit,
    actionsState,
    editorContainerRef,
    openQualifierNodeId,
    setOpenQualifierNodeId
  } = hintContext;
  const wrapperRef = useRef(null);
  // Equation validation
  const equationPattern = /^[=<>]\d+(\.\d+)?$/;
  const isEquationValid = (value) => equationPattern.test(value);

  console.log(`[ActionNodeView ${nodeId}] Render. Qualifier:`, qualifier, "Options from context:", qualifierOptions);

  useEffect(() => {
    if (isEditingEquation && equationInputRef.current) {
      equationInputRef.current.focus();
    }
  }, [isEditingEquation]);

  function handleEquationCommit(value) {
    const trimmed = value.trim();
    updateActionEquation(nodeId, trimmed);
    setIsEditingEquation(false);
    if (!isEquationValid(trimmed)) {
      setHasEquationError(true);
      if (equationInputRef.current) {
        const rect = equationInputRef.current.getBoundingClientRect();
        showHint(rect, 'Error: wrong equation.\n It should be a =, < or > and then a number', equationInputRef.current, 'error');
      }
    } else {
      setHasEquationError(false);
      hideHint();
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setOpenQualifierNodeId(null); // Close dropdown on outside click
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setOpenQualifierNodeId]);

  useEffect(() => {
    if (isOpen && openQualifierNodeId !== nodeId) {
      setIsOpen(false);
    }
  }, [isOpen, openQualifierNodeId, nodeId]);

  useEffect(() => {
    if (isEditing && inputRef.current && editorContainerRef?.current) {
      const inputRect = inputRef.current.getBoundingClientRect();
      const containerRect = editorContainerRef.current.getBoundingClientRect();
      const portalCoords = {
        x: inputRect.left + window.scrollX,
        y: inputRect.bottom + window.scrollY + 5,
        inputBottom: inputRect.bottom,
        inputTop: inputRect.top,
        inputLeft: inputRect.left,
      };
      setSuggestionState(prev => ({ ...prev, coords: portalCoords, visible: true }));
    }
  }, [isEditing, editorContainerRef, setSuggestionState]);

  useEffect(() => {
    if (isEditing && editingNodeId !== nodeId) {
      setIsEditing(false);
    }
  }, [isEditing, editingNodeId, nodeId]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      const timeoutId = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [isEditing, nodeId]);

  const displayQualifierOptions = (qualifierOptions || []).filter(opt => opt.id !== 'scheduled');
  const selectedOptionLabel = displayQualifierOptions.find(opt => opt.id === qualifier)?.label || displayQualifierOptions[0]?.label || '';
  const selectedOptionIcon = qualifierIconMap[qualifier] || null;

  console.log(`[ActionNodeView ${nodeId}] Display Options:`, displayQualifierOptions, "Selected Label:", selectedOptionLabel);

  const toggleDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`[ActionNodeView ${nodeId}] toggleDropdown called. Current isOpen: ${isOpen}`);
    const nextIsOpen = !isOpen;
    setIsOpen(nextIsOpen);
    if (nextIsOpen) {
      hideHint();
      setOpenQualifierNodeId(nodeId);
      setSuggestionState(prev => ({ ...prev, visible: false }));
    } else {
      setOpenQualifierNodeId(null);
    }
  };

  const handleMouseEnter = (e) => {
    if (hasEquationError) {
      const targetEl = e.currentTarget;
      const rect = targetEl.getBoundingClientRect();
      showHint(rect, 'Error: wrong equation.\nIt should be a =, < or > and then a number', targetEl, 'error');
      return;
    }
    const actionData = actionsState?.find(a => a.id === nodeId) || {};
    let hintContent = actionData.hint || registeredActions?.find(r => r.word === actionData.word)?.hint;
    if (!hintContent) hintContent = 'Hint';
    if (!isOpen) {
      const targetEl = e.currentTarget;
      const rect = targetEl.getBoundingClientRect();
      showHint(rect, hintContent, targetEl, 'node');
    }
  };

  const handleMouseLeave = hideHint;

  function handleCommitEdit(value) {
    const newWord = value.trim();
    if (newWord && newWord !== originalWordRef.current) {
      updateActionWord(node.attrs.nodeId, newWord);
    } else if (!newWord) {
      // Optionally delete node if word becomes empty, or just cancel edit
    }
    setIsEditing(false);
    setSuggestionState(prev => ({ ...prev, visible: false, forceVisible: false, editingNodeId: null, coords: null, query: '', items: [], selectedIndex: -1 }));
    setTimeout(() => editor?.commands.blur(), 0);
  }

  function handleKeyDown(e) {
    const key = e.key;
    const refState = suggestionStateRef?.current || {};
    const fullItems = refState.items || [];
    const maxIndex = fullItems.length > 0 ? fullItems.length - 1 : -1;

    if (key === 'ArrowDown' || key === 'Down') {
      e.preventDefault();
      setSuggestionState(prev => {
        const currentMaxIndex = (prev.items || []).length - 1;
        const newIndex = prev.selectedIndex < currentMaxIndex ? prev.selectedIndex + 1 : 0;
        return { ...prev, selectedIndex: newIndex };
      });
    } else if (key === 'ArrowUp' || key === 'Up') {
      e.preventDefault();
      setSuggestionState(prev => {
        const currentMaxIndex = (prev.items || []).length - 1;
        const newIndex = prev.selectedIndex > 0 ? prev.selectedIndex - 1 : currentMaxIndex;
        return { ...prev, selectedIndex: newIndex };
      });
    } else if (key === 'Enter') {
      e.preventDefault();
      const { selectedIndex = -1, items = [] } = refState;
      if (refState.visible && selectedIndex >= 0 && items && items.length > selectedIndex) {
        const selectedItem = items[selectedIndex]; // Get the full item object
        const wordToUpdate = typeof selectedItem === 'object' ? selectedItem.word : selectedItem;
        updateActionWord(node.attrs.nodeId, wordToUpdate);
      } else {
        handleCommitEdit(e.target.value);
      }
    } else if (key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
      setSuggestionState(prev => ({ ...prev, visible: false, forceVisible: false, editingNodeId: null }));
      setTimeout(() => editor?.commands.blur(), 0);
    }
  }

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className={`action-node-view inline-block bg-yellow-100 hover:bg-yellow-200 rounded px-2 py-1 mx-px text-sm cursor-pointer ${hasEquationError ? 'border-2 border-red-500' : 'border border-yellow-300'}`}
      data-node-id={nodeId}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <NodeViewContent className="hidden" ref={ref} />
      {isEditing ? (
        <span className="inline-flex items-center relative z-[1003]">
            <input
                ref={inputRef}
                defaultValue={originalWordRef.current}
                onBlur={(e) => handleCommitEdit(e.target.value)}
                onKeyDown={handleKeyDown}
                onChange={(e) => {
                    const query = e.target.value;
                    setSuggestionState(prev => {
                        const filtered = filterSuggestions(query, registeredActions);
                        const highlightedIndices = filtered.map(item => registeredActions.indexOf(item)).filter(i => i !== -1);
                        return {
                            ...prev,
                            query,
                            items: registeredActions, // Show all registered
                            highlightedIndices: highlightedIndices,
                            selectedIndex: highlightedIndices.length > 0 ? registeredActions.indexOf(filtered[0]) : -1,
                        };
                    });
                }}
                className="bg-white border border-blue-300 rounded px-1 outline-none"
                style={{ minWidth: '50px' }}
            />
        </span>
      ) : (
        <span className="inline-flex items-center relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          <span
            className="action-word-content inline mr-1"
            contentEditable="false"
            suppressContentEditableWarning={true}
            onDoubleClick={e => {
              e.preventDefault();
              e.stopPropagation();
              originalWordRef.current = node.textContent;
              startInlineEdit(nodeId, node.textContent);
              setIsEditing(true);
            }}
            onMouseDown={e => e.preventDefault()}
          >
            {node.textContent || '...'}
          </span>
          <div className="flex items-center">
            <span className="self-stretch border-l border-gray-500 mx-1" aria-hidden="true" />
            {isEditingEquation ? (
              <input
                ref={equationInputRef}
                value={localEquation}
                onChange={e => setLocalEquation(e.target.value)}
                onBlur={() => handleEquationCommit(localEquation)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); handleEquationCommit(localEquation); }
                  else if (e.key === 'Escape') { setLocalEquation(originalEquationRef.current); setIsEditingEquation(false); hideHint(); }
                }}
                className="bg-white border border-blue-300 rounded px-1 outline-none text-sm"
                style={{ minWidth: '50px' }}
              />
            ) : (
              <span
                className="inline cursor-pointer text-gray-600 px-1"
                onClick={e => { e.preventDefault(); e.stopPropagation(); originalEquationRef.current = equation; setLocalEquation(equation); setIsEditingEquation(true); }}
                onMouseDown={e => e.preventDefault()}
              >
                {equation}
              </span>
            )}
          </div>
          <button
            onMouseDown={e => e.preventDefault()} // Prevent editor blur
            onClick={toggleDropdown}
            className="flex items-center px-1 py-0.5 bg-yellow-200 border-l border-yellow-300 hover:bg-yellow-300 transition-colors relative"
            aria-haspopup="true"
            aria-expanded={isOpen}
            contentEditable="false"
            suppressContentEditableWarning
          >
            {selectedOptionIcon && (
              <img src={selectedOptionIcon} alt={selectedOptionLabel} className="h-4 w-auto mr-1 inline-block" />
            )}
            <span className="mr-0.5">{selectedOptionLabel}</span>
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          </button>
          {isOpen && (
              <div
                className="absolute top-full left-0 mt-1 w-32 bg-white shadow-lg rounded-md border border-gray-200 z-50"
                onMouseDown={(e) => { e.preventDefault(); }}
              >
                {displayQualifierOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsOpen(false);
                      updateActionQualifier(nodeId, option.id);
                      setOpenQualifierNodeId(null); // Ensure dropdown state is reset
                    }}
                    className="flex items-center block w-full text-left px-4 py-2 hover:bg-gray-100 first:rounded-t-md last:rounded-b-md"
                  >
                    <img src={qualifierIconMap[option.id]} alt={option.label} className="h-4 w-auto mr-2 inline-block" />
                    {option.label}
                  </button>
                ))}
              </div>
          )}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteNode(); /* Call deleteNode prop */ }}
            className="flex items-center justify-center px-1 py-0.5 bg-yellow-300 hover:bg-yellow-400 text-gray-800 border-l border-yellow-300 rounded-r transition-colors"
            title="Delete action"
            contentEditable="false"
            suppressContentEditableWarning
          >
            ×
          </button>
        </span>
      )}
    </NodeViewWrapper>
  );
});

export default ActionNodeView;
