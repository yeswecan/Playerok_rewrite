import { useState, useRef, useCallback } from 'react';
import { filterSuggestions } from '../utils/filterSuggestions';
import { NodeSelection } from 'prosemirror-state';

const useSuggestionManagement = ({
  editorInstanceRef,
  registeredActions,
  isNodeInternalUIActive,
  addAction,
  updateActionWord,
  preventImplicitCreationRef,
  findUntrackedTextSegments,
}) => {
  const [suggestionState, setSuggestionState] = useState({
    visible: false,
    forceVisible: false,
    query: '',
    items: [],
    coords: { top: 0, left: 0 },
    selectedIndex: -1,
    editingNodeId: null,
    inserting: false,
  });
  const suggestionStateRef = useRef(suggestionState);

  const calculateSuggestionPosition = (coords) => {
    if (!coords) return { top: 0, left: 0 };
    const SUGGESTION_LIST_MAX_HEIGHT = 240;
    const SUGGESTION_LIST_MARGIN = 10;
    const spaceBelow = window.innerHeight - coords.inputBottom;
    const spaceAbove = coords.inputTop;
    let top;
    if (spaceBelow >= SUGGESTION_LIST_MAX_HEIGHT + SUGGESTION_LIST_MARGIN || spaceBelow >= spaceAbove) {
      top = coords.y;
    } else {
      top = coords.top - SUGGESTION_LIST_MAX_HEIGHT;
    }
    return {
      top: `${Math.max(0, top)}px`,
      left: `${coords.x}px`,
    };
  };

  const updateQueryAndSuggestions = useCallback((query) => {
    const editor = editorInstanceRef.current;
    if (!editor || editor.isDestroyed) return;

    if (query === '') {
      setSuggestionState(prev => ({ ...prev, visible: false, items: [], query: '' }));
      return;
    }

    const filtered = filterSuggestions(query, registeredActions);
    const { selection } = editor.state;
    
    let coords = null;
    try {
      coords = editor.view.coordsAtPos(selection.$head.pos);
    } catch (e) {
      // Could be out of bounds, etc.
      console.warn("Could not calculate coords for suggestion menu.");
      return;
    }
    
    const absoluteCoords = { left: coords.left, bottom: coords.bottom, top: coords.top };
    const finalPosition = calculateSuggestionPosition(absoluteCoords);

    setSuggestionState(prev => ({
      ...prev,
      visible: true,
      query: query,
      items: filtered,
      coords: { x: absoluteCoords.left, y: absoluteCoords.bottom + 5, ...absoluteCoords },
      finalPosition,
      selectedIndex: 0, // Reset selection
    }));
  }, [registeredActions, editorInstanceRef]);

  const showSuggestionsOnFocus = useCallback(() => {
    if (isNodeInternalUIActive || suggestionStateRef.current.editingNodeId) return;

    const editor = editorInstanceRef.current;
    if (!editor || editor.isDestroyed || !editor.isFocused) return;
    
    const { selection } = editor.state;
    if (selection.empty && !(selection instanceof NodeSelection) && !editor.view.composing) {
      try {
        const coords = editor.view.coordsAtPos(selection.$head.pos);
        const absoluteCoords = { left: coords.left, bottom: coords.bottom, top: coords.top };
        const finalPosition = calculateSuggestionPosition(absoluteCoords);
        setSuggestionState(prev => ({
          ...prev,
          visible: true,
          query: '',
          items: registeredActions,
          coords: { x: absoluteCoords.left, y: absoluteCoords.bottom + 5, ...absoluteCoords },
          selectedIndex: -1,
          editingNodeId: null,
          forceVisible: false,
          finalPosition,
        }));
      } catch (e) {
        setSuggestionState(prev => ({ ...prev, visible: false }));
      }
    }
  }, [registeredActions, isNodeInternalUIActive, editorInstanceRef]);

  const hideSuggestionsOnBlur = useCallback(() => {
    setTimeout(() => {
      if (suggestionStateRef.current.editingNodeId === null) {
        setSuggestionState(prev => ({ ...prev, visible: false }));
      }
    }, 100);
  }, []);

  const handleNavUp = useCallback(() => {
    setSuggestionState(prev => {
      if (!prev.visible || !prev.items || prev.items.length === 0) return prev;
      const newIndex = prev.selectedIndex <= 0 ? prev.items.length - 1 : prev.selectedIndex - 1;
      return { ...prev, selectedIndex: newIndex };
    });
  }, []);

  const handleNavDown = useCallback(() => {
    setSuggestionState(prev => {
      if (!prev.visible || !prev.items || prev.items.length === 0) return prev;
      const newIndex = prev.selectedIndex >= prev.items.length - 1 ? 0 : prev.selectedIndex + 1;
      return { ...prev, selectedIndex: newIndex };
    });
  }, []);

  const handleCloseSuggestion = useCallback(() => {
    setSuggestionState(prev => ({ ...prev, visible: false, query: '', selectedIndex: -1, highlightedIndices: [] }));
    editorInstanceRef.current?.commands.blur();
  }, [editorInstanceRef]);

  const handleSelect = useCallback((selectedItem) => {
    if (!selectedItem) return false;
    
    const { query, editingNodeId } = suggestionStateRef.current;

    const executeAction = (actionFn, ...args) => {
      if (preventImplicitCreationRef) preventImplicitCreationRef.current = true;
      actionFn(...args);
      setSuggestionState(prev => ({ ...prev, visible: false, query: '', items: [], selectedIndex: -1, editingNodeId: null, inserting: false }));
      if (preventImplicitCreationRef) {
        setTimeout(() => { preventImplicitCreationRef.current = false; }, 0);
      }
    };

    if (typeof selectedItem === 'object' && selectedItem.type === 'new') {
        if (query) {
            executeAction(addAction, query, null);
        }
    } else if (editingNodeId) {
      const wordToUse = typeof selectedItem === 'object' ? selectedItem.word : selectedItem;
      executeAction(updateActionWord, editingNodeId, wordToUse);
    } else if (typeof selectedItem === 'object' && selectedItem.word) {
      executeAction(addAction, selectedItem.word, null);
    } else {
      return false; // No action taken
    }

    editorInstanceRef.current?.commands.blur();
    return true; // Action was taken
  }, [addAction, updateActionWord, preventImplicitCreationRef, editorInstanceRef]);

  const handleSelectByIndex = useCallback(() => {
    const { selectedIndex, items, visible } = suggestionStateRef.current;
    if (visible && selectedIndex >= 0 && items && items.length > selectedIndex) {
      return handleSelect(items[selectedIndex]);
    }
    return false;
  }, [handleSelect]);

  const startInlineEdit = useCallback((nodeId, initialQuery) => {
    setSuggestionState(prev => ({
      ...prev,
      editingNodeId: nodeId,
      query: initialQuery,
      visible: false,
      forceVisible: true,
      coords: null,
      items: registeredActions,
      highlightedIndices: filterSuggestions(initialQuery, registeredActions).map(item => registeredActions.indexOf(item)).filter(i => i !== -1),
      selectedIndex: filterSuggestions(initialQuery, registeredActions).map(item => registeredActions.indexOf(item)).filter(i => i !== -1)[0] ?? -1,
    }));
  }, [registeredActions]);

  const stopInlineEdit = useCallback(() => {
    setSuggestionState(prev => ({
      ...prev,
      editingNodeId: null,
      visible: false,
      forceVisible: false,
      coords: null,
      query: '',
    }));
  }, []);
  
  const checkAndTriggerImplicitCreation = useCallback(() => {
    const editor = editorInstanceRef.current;
    if (!editor || editor.isDestroyed || preventImplicitCreationRef.current) return false;

    const untracked = findUntrackedTextSegments(editor.getJSON(), editor.state.doc.toJSON().content);
    const wordToConvert = untracked.length > 0 ? untracked[untracked.length - 1].text : null;

    if (wordToConvert) {
      if (preventImplicitCreationRef) preventImplicitCreationRef.current = true;
      addAction(wordToConvert, null);
      setSuggestionState(prev => ({ ...prev, visible: false, query: '', items: [], selectedIndex: -1, editingNodeId: null, inserting: false }));
      if (preventImplicitCreationRef) {
          setTimeout(() => { preventImplicitCreationRef.current = false; }, 0);
      }
      return true;
    }
    return false;
  }, [addAction, findUntrackedTextSegments, preventImplicitCreationRef, editorInstanceRef]);

  return {
    suggestionState,
    setSuggestionState,
    suggestionStateRef,
    showSuggestionsOnFocus,
    hideSuggestionsOnBlur,
    handleNavUp,
    handleNavDown,
    handleCloseSuggestion,
    handleSelect,
    handleSelectByIndex,
    startInlineEdit,
    stopInlineEdit,
    checkAndTriggerImplicitCreation,
    updateQueryAndSuggestions,
  };
};

export default useSuggestionManagement; 