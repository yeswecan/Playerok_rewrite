import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import { EditorProvider, useCurrentEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
// Removed unused Tiptap core imports
// Removed unused ChevronDown import
import SuggestionMenu from './components/SuggestionMenu.jsx';
import { TextSelection, NodeSelection } from 'prosemirror-state';
// Removed unused debounce import
import { cn } from '../../utils';
import ActionNodeContext from './context/ActionNodeContext'; // RENAMED
import ActionNode from './extensions/actionNodeExtension'; // Import the extracted node
import WordSuggestionExtension from './extensions/wordSuggestionExtension'; // Import the extension
import { filterSuggestions } from './utils/filterSuggestions'; // Added Import
import useActionNodeDnd from './hooks/useActionNodeDnd'; // Import DND hook
import './ActionEditorComponent.css'; // <-- ADDED CSS Import

// --- TipTap Editor Component ---
const TipTapEditorComponent = ({ setEditor, editorInstanceRef }) => {
  const { editor } = useCurrentEditor();

  useEffect(() => {
    if (editor) {
      // console.log('[TipTapEditorComponent] Editor instance from provider:', editor);
      setEditor(editor);
      if (editorInstanceRef) {
        editorInstanceRef.current = editor;
      }
    }
    // Cleanup ref on component unmount or editor change
    return () => {
      if (!editor && editorInstanceRef) {
        editorInstanceRef.current = null;
      }
    };
  }, [editor, setEditor, editorInstanceRef]);

  return <EditorContent />;
};

// --- Main Action Editor Component ---
const ActionEditorComponent = ({
  registeredActions,
  qualifierOptions,
  defaultQualifier,
  onActionCreated,
  onActionDeleted,
  onQualifierChanged,
  onActionWordChanged,
  onActionEquationChanged = () => {},
  initialContent = '',
  initialActions = [],
  readOnly = false, // Add readOnly prop with default false
  nodeType, // <-- ADDED: Required prop
  editorId, // Added for DND
  onActionDrop, // Added for DND
  className = '',
  style = {},
  placeholderText = 'Type here to add action...',
}) => {
  // Log incoming props at the start of the component
  // console.log('[ActionEditorComponent] Received Props:', { qualifierOptions, registeredActions, initialActions, nodeType });

  // Define actionIdOptions based on nodeType
  const actionIdOptions = useMemo(() => {
    if (nodeType === 'ItemActionNode') {
      return [
        { id: 'Start', label: 'Start' },
        { id: 'Stop', label: 'Stop' }
      ];
    } else if (nodeType === 'PlaylistActionNode') {
      return [
        { id: 'previous', label: 'Previous' },
        { id: 'next', label: 'Next' },
        { id: 'play', label: 'Play' },
        { id: 'pause', label: 'Pause' },
        { id: 'volume', label: 'Volume' }
      ];
    }
    return []; // Default empty if nodeType is unexpected
  }, [nodeType]);

  const [editorInstance, setEditorInstance] = useState(null);
  const [actionsState, setActionsState] = useState(() => initialActions || []);
  const actionsStateRef = useRef(actionsState); // Ref to hold current actionsState for closures
  const editorInstanceRef = useRef(null); // Ref to hold the editor instance
  const defaultQualifierRef = useRef(defaultQualifier); // Ref for default qualifier
  const preventImplicitCreationRef = useRef(false); // Ref to control implicit creation during sync
  const editorContainerRef = useRef(null); // Define the container ref
  // Note: updateRequestNonce and isEditorFocused were removed as they were unused
  const [suggestionState, setSuggestionState] = useState({
    visible: false,
    forceVisible: false, // New flag to keep menu open during inline edit
    query: '',
    items: [],
    coords: { top: 0, left: 0 },
    selectedIndex: -1,
    editingNodeId: null, // Track which node is being edited inline
    inserting: false,
  });
  const suggestionStateRef = useRef(suggestionState); // Ref for suggestion state
  const [openQualifierNodeId, setOpenQualifierNodeId] = useState(null); // <-- Add state for open qualifier
  const [openActionIdNodeId, setOpenActionIdNodeId] = useState(null); // <-- ADDED state for ActionId dropdown
  const [isNodeInternalUIActive, setIsNodeInternalUIActive] = useState(false); // <<< NEW STATE for child UI interaction
  const isNodeInternalUIActiveRef = useRef(isNodeInternalUIActive); // Ref for a stable reference in callbacks
  // --- Hint State ---
  const [hintState, setHintState] = useState({
    visible: false,
    content: '',
    targetRect: null, // Store the bounding rect of the target element
    targetElement: null, // Store the actual target element for recalculation
    hintType: 'node', // Add type: 'node' or 'suggestion'
  });
  // === DND Hook ===
  const dndHookResult = useActionNodeDnd({
    nodeType,
    editorId,
    onActionDrop,
    actionsState,
    actionsStateRef,
    editorInstanceRef
  });
  const { canDrop, isOver, dropRef, actionsToRender } = dndHookResult;

  const onActionWordChangedRef = useRef(onActionWordChanged);
  const onQualifierChangedRef = useRef(onQualifierChanged);
  const onActionDeletedRef = useRef(onActionDeleted);
  const onActionCreatedRef = useRef(onActionCreated);
  const onActionEquationChangedRef = useRef(onActionEquationChanged);
  useEffect(() => { onActionEquationChangedRef.current = onActionEquationChanged; }, [onActionEquationChanged]);

  const suggestionListRef = useRef(null); // Define the ref for the suggestion list container

  // NEW: Function to update Tiptap attribute via command
  const setNodeDragState = useCallback((nodeId, isDragging) => {
    const editor = editorInstanceRef.current;
    if (!editor || editor.isDestroyed || !nodeId) return;

    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'actionNode' && node.attrs.nodeId === nodeId) {
        // Found the node, update its attribute
        editor.view.dispatch(
          editor.state.tr.setNodeAttribute(pos, 'isBeingDragged', isDragging)
        );
        return false; // Stop searching
      }
    });
  }, []); // Dependency on editorInstanceRef implicitly handled by its usage



  // --- Step 3: Analytical Comparison Function ---
  const findUntrackedTextSegments = useCallback((editorJson, currentActionsState) => {
    const untrackedSegments = [];
    const knownNodeIds = new Set(currentActionsState.map(a => a.id));

    const paragraphContent = editorJson?.content?.[0]?.content || [];
    let currentTextSegment = '';
    let segmentStartIndex = -1; // Simplified position tracking

    paragraphContent.forEach((node, index) => {
        // Simplified position tracking for now
        const nodeStartPosition = index;

        if (node.type === 'actionNode') {
            if (currentTextSegment) {
                const trimmedText = currentTextSegment.trim();
                if (trimmedText) {
                    untrackedSegments.push({ text: trimmedText, startPos: segmentStartIndex, endPos: nodeStartPosition });
                }
                currentTextSegment = '';
                segmentStartIndex = -1;
            }
            if (!knownNodeIds.has(node.attrs?.nodeId)) {
                // This actionNode exists in editor but not in our state - could be a stale node
                // For now, we'll leave it as is rather than auto-removing
            }
        } else if (node.type === 'text') {
            if (segmentStartIndex === -1) {
                segmentStartIndex = nodeStartPosition;
            }
            currentTextSegment += node.text;
        } else {
            // Handle other node types if necessary, finalizing text segment
            if (currentTextSegment) {
                 const trimmedText = currentTextSegment.trim();
                 if (trimmedText) {
                    untrackedSegments.push({ text: trimmedText, startPos: segmentStartIndex, endPos: nodeStartPosition });
                }
            }
            currentTextSegment = '';
            segmentStartIndex = -1;
        }
    });

    if (currentTextSegment) {
        const trimmedText = currentTextSegment.trim();
        if (trimmedText) {
            untrackedSegments.push({ text: trimmedText, startPos: segmentStartIndex, endPos: paragraphContent.length });
        }
    }
    return untrackedSegments;
  }, []); // No dependencies, relies on arguments

  useEffect(() => { onActionWordChangedRef.current = onActionWordChanged; }, [onActionWordChanged]);
  useEffect(() => { onQualifierChangedRef.current = onQualifierChanged; }, [onQualifierChanged]);
  useEffect(() => { onActionDeletedRef.current = onActionDeleted; }, [onActionDeleted]);
  useEffect(() => { onActionCreatedRef.current = onActionCreated; }, [onActionCreated]);

  // Keep actionsStateRef updated
  useEffect(() => {
    actionsStateRef.current = actionsState;
  }, [actionsState]);

  // Keep suggestionStateRef updated
  useEffect(() => {
    suggestionStateRef.current = suggestionState;
  }, [suggestionState]);

  // --- Step 8: Add Effect to sync actionsState with initialActions prop ---
  useEffect(() => {
    if (initialActions !== actionsStateRef.current) { // Basic check
        setActionsState(initialActions || []);
    }
  }, [initialActions]); // Dependency array includes initialActions

  // Placeholder hint functions (implement actual logic if needed)
  const showHint = useCallback((rect, hintContent, element, type = 'node') => {
    setHintState({
      visible: true,
      content: hintContent,
      targetRect: rect,
      targetElement: element, // Store the element
      hintType: type, // Store the type
    });
  }, []); // Empty dependency array

  const hideHint = useCallback(() => {
    setHintState(prev => ({ ...prev, visible: false, targetElement: null })); // Clear target element too
  }, []); // Empty dependency array

  // --- State Update Functions ---

  const addAction = useCallback((word, qualifier) => {
    if (!word) return;
    preventImplicitCreationRef.current = true; // Prevent sync loop
    const uniqueId = `action_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const defaultActionId = actionIdOptions.length > 0 ? actionIdOptions[0].id : 'defaultActionId'; // Fallback if needed

    const newAction = {
        id: uniqueId,
        word,
        qualifier: qualifier || defaultQualifierRef.current,
        actionNodeType: nodeType, // <-- ADDED: Set nodeType from prop
        actionId: defaultActionId, // <-- ADDED: Set default actionId
        equation: ''
    };
    setActionsState(prev => [...prev, newAction]);
    onActionCreatedRef.current?.(newAction);
    setSuggestionState(prev => ({ ...prev, visible: false, query: '', items: [], selectedIndex: -1, editingNodeId: null, inserting: false }));
    setTimeout(() => preventImplicitCreationRef.current = false, 0);
  }, [defaultQualifierRef, nodeType, actionIdOptions]); // <-- ADDED nodeType and actionIdOptions dependencies


  const updateActionQualifier = useCallback((nodeId, newQualifier) => {
    preventImplicitCreationRef.current = true; // Prevent sync loop
    setActionsState(prev => {
      const newState = prev.map(action =>
        action.id === nodeId ? { ...action, qualifier: newQualifier } : action
      );
      return newState;
    });

    onQualifierChangedRef.current?.(nodeId, newQualifier);
    setOpenQualifierNodeId(null); // Close the qualifier dropdown immediately

    setTimeout(() => {
        preventImplicitCreationRef.current = false; // Delay releasing the lock slightly
    }, 50);
  }, []); // Empty dependency array as it doesn't depend on changing props/state

  const updateActionId = useCallback((nodeId, newActionId) => {
    preventImplicitCreationRef.current = true; // Prevent sync loop
    setActionsState(prev => {
      const newState = prev.map(action =>
        action.id === nodeId ? { ...action, actionId: newActionId } : action
      );
      return newState;
    });
    setOpenActionIdNodeId(null); // Close the actionId dropdown

    setTimeout(() => {
        preventImplicitCreationRef.current = false;
    }, 50);
  }, []); // Empty dependency for now, add callbacks if needed

  const updateActionWord = useCallback((nodeId, newWord) => {
    if (!newWord) return; // Don't update to an empty word
    preventImplicitCreationRef.current = true; // Prevent sync loop
    setActionsState(prev => prev.map(action =>
        action.id === nodeId ? { ...action, word: newWord } : action
    ));
    onActionWordChangedRef.current?.(nodeId, newWord);
    // Clear suggestion state after committing inline edit
    setSuggestionState(prev => ({ ...prev, visible: false, forceVisible: false, editingNodeId: null }));
    setTimeout(() => preventImplicitCreationRef.current = false, 0);
  }, []);

  // New: handle equation updates
  const updateActionEquation = useCallback((nodeId, newEquation) => {
    setActionsState(prev => prev.map(action =>
      action.id === nodeId ? { ...action, equation: newEquation } : action
    ));
    onActionEquationChangedRef.current?.(nodeId, newEquation);
  }, []);

  // --- Step 4: Tiptap Editor Content Generation ---
  const generateTiptapContent = useCallback(() => {
    // Use actionsToRender from the DND hook, which already includes placeholder logic
    if (!actionsToRender || actionsToRender.length === 0) {
      return { type: 'doc', content: [{ type: 'paragraph' }] };
    }

    const content = actionsToRender.flatMap((action, index) => {
      if (!action || !action.id || typeof action.word !== 'string') {
          return []; 
      }
      const nodeAttrs = {
        nodeId: action.id,
        qualifier: action.qualifier,
        equation: action.equation || '', 
        actionNodeType: action.actionNodeType || nodeType, 
        actionId: action.actionId,
        isDragPlaceholder: !!action.isDragPlaceholder, 
      };
      const node = {
        type: 'actionNode',
        attrs: nodeAttrs,
        content: [{ type: 'text', text: action.word }],
      };
      const spaceNode = index < actionsToRender.length - 1 ? { type: 'text', text: ' ' } : null;
      return spaceNode ? [node, spaceNode] : [node];
    });

    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: content.length > 0 ? content : undefined }],
    };
    return doc;
  }, [actionsToRender, nodeType]); // Updated dependencies


  // --- Effect to Synchronize React State -> Tiptap ---
  useEffect(() => {
    const currentEditor = editorInstanceRef.current;
    if (currentEditor && !currentEditor.isDestroyed && actionsStateRef.current) {
      // Generate content using the DND hook's actionsToRender
      const generatedContent = generateTiptapContent();

      requestAnimationFrame(() => {
          if (currentEditor && !currentEditor.isDestroyed && currentEditor.isEditable) {
              currentEditor.commands.setContent(generatedContent, false, {
                preserveWhitespace: 'full',
              });
        }
      });
    }
  // Updated dependencies based on DND hook usage
  }, [actionsState, editorInstance, generateTiptapContent]);

  // --- Effect to Synchronize Deletions from Tiptap -> React State ---
  useEffect(() => {
    const currentEditor = editorInstanceRef.current;
    if (!currentEditor || currentEditor.isDestroyed) {
      return;
    }

    const handleDocumentChange = ({ transaction }) => {
      if (transaction.getMeta('isSyncingContent') || !transaction.docChanged) {
          return;
      }

      const currentEditorNodeIds = new Set();
      currentEditor.state.doc.descendants((node) => {
        if (node.type.name === 'actionNode') {
            // Only consider actual nodes from Tiptap, not the placeholder
            if (node.attrs.nodeId && !node.attrs.isDragPlaceholder) {
                 currentEditorNodeIds.add(node.attrs.nodeId);
            }
        }
      });

      // actionsStateRef.current is the React state, which should only contain actual items.
      const currentStateIds = new Set(actionsStateRef.current.map(a => a.id));

      const deletedIds = [...currentStateIds].filter(id => !currentEditorNodeIds.has(id));

      if (deletedIds.length > 0) {
        preventImplicitCreationRef.current = true; // Prevent potential race condition with implicit creation
        setActionsState(prev => prev.filter(action => currentEditorNodeIds.has(action.id)));
        deletedIds.forEach(id => {
            onActionDeletedRef.current?.(id);
        });
        setTimeout(() => {
            preventImplicitCreationRef.current = false;
            editorInstanceRef.current?.commands.blur(); // Blur the editor
        }, 50);
      }
    };

    currentEditor.on('update', handleDocumentChange);

    return () => {
        if (currentEditor && !currentEditor.isDestroyed) {
             currentEditor.off('update', handleDocumentChange);
        }
    };
  }, [editorInstance]); // Rerun if editorInstance changes

  // --- Handle Suggestion Selection ---
  const handleSelect = useCallback((selectedItem) => {
    if (!selectedItem) {
      return;
    }

    const currentSuggestionState = suggestionStateRef.current;
    const currentQuery = currentSuggestionState.query || '';

    if (typeof selectedItem === 'object' && selectedItem.type === 'new') {
        if (currentQuery) {
            addAction(currentQuery, defaultQualifierRef.current);
        }
    }
    else if (currentSuggestionState.editingNodeId) {
      const wordToUse = typeof selectedItem === 'object' ? selectedItem.word : selectedItem;
      updateActionWord(currentSuggestionState.editingNodeId, wordToUse);
    } else {
      if (typeof selectedItem === 'object' && selectedItem.word) {
        addAction(selectedItem.word, defaultQualifierRef.current);
      }
    }

    editorInstanceRef.current?.commands.blur(); // Blur editor after selection/creation
  }, [addAction, updateActionWord]); // Add updateActionWord dependency


  // --- Step 3: Central Trigger Handler ---
  const checkAndTriggerImplicitCreation = useCallback(() => {
    const currentEditor = editorInstanceRef.current;
    if (!currentEditor || currentEditor.isDestroyed || preventImplicitCreationRef.current) {
        return false;
    }

    const currentJson = currentEditor.getJSON();
    const currentActions = actionsStateRef.current; // Use ref for current state

    const untracked = findUntrackedTextSegments(currentJson, currentActions);

    const wordToConvert = untracked.length > 0 ? untracked[untracked.length - 1].text : null;

    if (wordToConvert) {
        addAction(wordToConvert, defaultQualifierRef.current); // Use the existing addAction
        setSuggestionState(prev => ({ ...prev, visible: false, query: '', items: [], selectedIndex: -1, editingNodeId: null, inserting: false }));
        return true; // Indicate creation happened
    } else {
        return false;
    }
  }, [addAction, findUntrackedTextSegments, defaultQualifierRef]); // Added dependencies


  // --- NEW: Function to show suggestions specifically on focus ---
  const showSuggestionsOnFocus = useCallback(() => {
    console.log('[ActionEditorComponent showSuggestionsOnFocus] Entered. isNodeInternalUIActive state:', isNodeInternalUIActive, 'isNodeInternalUIActiveRef:', isNodeInternalUIActiveRef.current, 'Timestamp:', Date.now());
    if (isNodeInternalUIActive) { 
      console.log('[ActionEditorComponent showSuggestionsOnFocus] Blocked by isNodeInternalUIActive state. Timestamp:', Date.now());
      return;
    }
    if (suggestionStateRef.current.editingNodeId) {
      return;
    }
    const currentEditor = editorInstanceRef.current;
    if (!currentEditor || currentEditor.isDestroyed || currentEditor.isFocused === false) {
        return; 
    }
    const { state } = currentEditor;
    const { selection } = state;
    const isNodeSelection = selection instanceof NodeSelection && selection.node.type.name === 'actionNode';
    const composing = currentEditor.view.composing;

    if (selection.empty && !isNodeSelection && !composing) {
      const { $head } = selection;
      if ($head) {
        // NEW: Check if the direct parent of the cursor is a placeholder node
        if ($head.parent && $head.parent.type.name === 'actionNode' && $head.parent.attrs.isDragPlaceholder) {
          // console.log('[showSuggestionsOnFocus] Cursor is inside a placeholder, returning.');
          return; 
        }

        const pos = $head.pos;
        // Check node before cursor (existing adjacency check)
        if (pos > 0) {
          try {
            const nodeBefore = $head.doc.nodeAt(pos - 1);
            if (nodeBefore && nodeBefore.type.name === 'actionNode' && nodeBefore.attrs.isDragPlaceholder) {
              // console.log('[showSuggestionsOnFocus] Cursor is after a placeholder, returning.');
              return; 
            }
          } catch (e) { /* ignore error if pos-1 is not valid */ }
        }
        // Check node after cursor (existing adjacency check)
        if (pos < $head.doc.content.size) {
           try {
            const nodeAfter = $head.doc.nodeAt(pos); 
            if (nodeAfter && nodeAfter.type.name === 'actionNode' && nodeAfter.attrs.isDragPlaceholder) {
              // console.log('[showSuggestionsOnFocus] Cursor is before a placeholder, returning.');
              return; 
            }
          } catch (e) { /* ignore error if pos is not valid */ }
        }
      }

      try {
        const cursorPos = selection.$head.pos;
        const absoluteCoords = currentEditor.view.coordsAtPos(cursorPos);
        const coords = {
          x: absoluteCoords.left,
          y: absoluteCoords.bottom + 5,
          inputBottom: absoluteCoords.bottom,
          inputTop: absoluteCoords.top,
          inputLeft: absoluteCoords.left,
        };
        const finalPosition = calculateSuggestionPosition(coords);
        const highlightedIndices = registeredActions.map((_, index) => index);
        setSuggestionState(prev => ({
          ...prev,
          visible: true,
          query: '',
          items: registeredActions,
          highlightedIndices: highlightedIndices,
          coords: coords,
          selectedIndex: -1,
          editingNodeId: null,
          forceVisible: false,
          finalPosition: finalPosition,
        }));
      } catch (e) {
          setSuggestionState(prev => ({ ...prev, visible: false }));
      }
    }
  }, [registeredActions, isNodeInternalUIActive]); // <<< ADDED isNodeInternalUIActive to deps


  // --- NEW: Function to hide suggestions on blur (if not inline editing) ---
  const hideSuggestionsOnBlur = useCallback(() => {
    // if (isNodeInternalUIActiveRef.current) return; // Optional: May not be needed here if blur is managed correctly
    setTimeout(() => {
      if (suggestionStateRef.current.editingNodeId === null) {
        setSuggestionState(prev => ({ ...prev, visible: false }));
      }
    }, 100); // Small delay
  }, []); // No dependencies needed


  // --- Suggestion Navigation Handlers ---
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
    editorInstanceRef.current?.commands.blur(); // Blur editor instead
  }, []);

  const handleSelectByIndex = useCallback(() => {
    const { selectedIndex, items, visible } = suggestionStateRef.current;
    if (visible && selectedIndex >= 0 && items && items.length > selectedIndex) {
      const selectedItem = items[selectedIndex];
      const selectionHappened = handleSelect(selectedItem);
      if (selectionHappened) {
        hideHint(); // Hide hint after successful keyboard selection
      }
      return selectionHappened; // Return actual result
    }
    return false; // Indicate no selection happened
  }, [handleSelect, hideHint]);


  // --- Inline Edit State Management ---
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
    // Removed updateRequestNonce trigger as it was unused
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


  // --- Effect to handle scroll and update hint position ---
  useEffect(() => {
    const handleScroll = () => {
      if (hintState.visible && hintState.targetElement) {
        setHintState(prev => ({
          ...prev,
          targetRect: prev.targetElement.getBoundingClientRect(),
        }));
      }
    };

    if (hintState.visible) {
      window.addEventListener('scroll', handleScroll, true); // Use capture phase
    } else {
      window.removeEventListener('scroll', handleScroll, true);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [hintState.visible, hintState.targetElement]); // Depend on visibility and target element

  // Provide context value
  const hintContextValue = useMemo(() => ({
    showHint,
    hideHint,
    updateActionQualifier,
    updateActionWord,
    updateActionEquation,
    onActionDeleted: onActionDeletedRef.current,
    onActionCreated: onActionCreatedRef.current,
    onQualifierChanged: onQualifierChangedRef.current,
    setSuggestionState,
    registeredActions,
    suggestionStateRef,
    qualifierOptions: qualifierOptions,
    actionsState,
    editorContainerRef,
    openQualifierNodeId,
    setOpenQualifierNodeId,
    editingNodeId: suggestionState.editingNodeId,
    startInlineEdit,
    stopInlineEdit,
    requestStateUpdate: () => {
      // Removed updateRequestNonce as it was unused
    },
    checkAndTriggerImplicitCreation,
    readOnly,
    actionIdOptions,
    updateActionId,
    openActionIdNodeId,
    setOpenActionIdNodeId,
    setNodeDragState,
    editorInstanceRef,
    hideSuggestionsOnBlur,
    isNodeInternalUIActive, // <<< ADD to context
    setIsNodeInternalUIActive, // <<< ADD to context
  }), [
    showHint, hideHint,
    updateActionQualifier, updateActionWord, updateActionEquation,
    setSuggestionState, registeredActions, suggestionStateRef,
    qualifierOptions,
    actionsState,
    editorContainerRef, openQualifierNodeId, setOpenQualifierNodeId,
    suggestionState.editingNodeId, startInlineEdit, stopInlineEdit,
    checkAndTriggerImplicitCreation,
    readOnly,
    actionIdOptions,
    updateActionId,
    openActionIdNodeId,
    setOpenActionIdNodeId,
    setNodeDragState,
    editorInstanceRef,
    hideSuggestionsOnBlur,
    isNodeInternalUIActive, // <<< ADD to context dependencies
    setIsNodeInternalUIActive, // <<< ADD to context dependencies
  ]);

  // Log the value being passed to the provider
  // console.log('[ActionEditorComponent] HintContext value BEFORE Provider:', hintContextValue);

  // Context for DND state
  // const dndContextValue = useMemo(() => ({ ... }), []); // REMOVED DND Context

  // --- Configure Extensions ---
  const wordSuggestionExtension = useMemo(() => {
    return WordSuggestionExtension.configure({
      getSuggestionState: () => suggestionStateRef.current,
      requestCoordUpdate: () => {
        // Removed updateRequestNonce as it was unused
      },
      registeredActions,
      defaultQualifier: defaultQualifierRef.current,
      editorContainerRef,
      handleImplicitCreate: () => checkAndTriggerImplicitCreation(),
      showSuggestionsOnFocus: showSuggestionsOnFocus, // <<< MODIFIED: Pass the main callback directly
      hideSuggestionsOnBlur: hideSuggestionsOnBlur,
      onNavUp: handleNavUp,
      onNavDown: handleNavDown,
      onCloseSuggestion: handleCloseSuggestion,
      onSelectByIndex: handleSelectByIndex,
    });
  }, [
    registeredActions, defaultQualifierRef, editorContainerRef,
    handleNavUp, handleNavDown, handleCloseSuggestion, handleSelectByIndex,
    showSuggestionsOnFocus, // <<< Now depends on the main showSuggestionsOnFocus which captures isNodeInternalUIActive
    hideSuggestionsOnBlur,
    checkAndTriggerImplicitCreation,
  ]);

  const actionNodeExtension = useMemo(() => {
    return ActionNode.configure({
    });
  }, []); // No dependencies needed if options are removed

  const extensions = useMemo(() => [
    StarterKit.configure({ history: true }),
    Placeholder.configure({ placeholder: '' }),
    actionNodeExtension,
    wordSuggestionExtension,
  ], [actionNodeExtension, wordSuggestionExtension]);

  // === Render ===
  const wrapperClasses = [
    'action-editor-wrapper',
    className,
    suggestionState.visible && 'has-suggestion-menu-open',
    !editorInstance?.isFocused && !suggestionState.editingNodeId && 'show-placeholder',
    isOver && 'is-drag-over',
    isOver && canDrop && 'can-drop',
    isOver && !canDrop && 'cannot-drop',
  ].filter(Boolean).join(' ');

  // Connect dropRef to the main wrapper div
  const connectRefs = (node) => {
    dropRef(node);
    editorContainerRef.current = node; // Also keep track of the container node
  };

  useEffect(() => {
    console.log('[ActionEditorComponent useEffect] Updating isNodeInternalUIActiveRef.current to:', isNodeInternalUIActive, 'Timestamp:', Date.now());
    isNodeInternalUIActiveRef.current = isNodeInternalUIActive;
  }, [isNodeInternalUIActive]);

  return (
    // <ActionNodeDndContext.Provider value={dndContextValue}> // REMOVED
      <ActionNodeContext.Provider value={hintContextValue}>
        <div
          ref={connectRefs}
          className={wrapperClasses}
          style={{ ...style, position: 'relative' }} // Ensure wrapper has relative positioning
          data-placeholder={placeholderText}
          onClick={(e) => e.stopPropagation()}
        >
          <EditorProvider
            slotBefore={null}
            slotAfter={null}
            extensions={extensions}
            content={initialContent || generateTiptapContent()}
            editable={!readOnly}
            onFocus={() => {
                // Focus handler - functionality moved to extension
            }}
            onBlur={() => {
                // Blur handler - functionality moved to extension  
            }}
            editorProps={{
              attributes: {
                class: cn(
                  'tiptap ProseMirror'
                ),
              },
              handleDOMEvents: {
                blur: (view) => {
                  if (readOnly) return true;
                  const { state } = view;
                  const { selection } = state;
                  if (selection instanceof NodeSelection) {
                      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, selection.from)));
                  }
                  setOpenQualifierNodeId(null);
                  return false;
                },
              },
            }}
          >
            <TipTapEditorComponent setEditor={setEditorInstance} editorInstanceRef={editorInstanceRef} />
          </EditorProvider>

          {/* DND Drop Placeholder (REMOVED - Now handled by temporary Tiptap node) */}
          {/* {isOver && canDrop && placeholderPosition && (
            <div
              className="dnd-drop-placeholder"
              style={{
                position: 'absolute',
                top: `${placeholderPosition.top}px`,
                left: `${placeholderPosition.left}px`,
                pointerEvents: 'none',
              }}
            />
          )} */}

          {suggestionState.visible && suggestionState.coords &&
            ReactDOM.createPortal(
              <div
                className="suggestion-list-portal fixed"
                style={{
                   zIndex: 1002,
                   top: suggestionState.coords?.y || 0,
                   left: suggestionState.coords?.x || 0,
                   opacity: suggestionState.visible ? 1 : 0,
                   pointerEvents: suggestionState.visible ? 'auto' : 'none'
                }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={(e) => e.stopPropagation()}
                ref={suggestionListRef}
              >
                <SuggestionMenu
                  items={suggestionState.items}
                  selectedIndex={suggestionState.selectedIndex}
                  highlightedIndices={suggestionState.highlightedIndices || []}
                  onSelect={handleSelect}
                  coords={suggestionState.coords}
                  showHint={showHint}
                  hideHint={hideHint}
                />
              </div>,
              document.body
            )
          }
          {ReactDOM.createPortal(
            <HintTooltip hintState={hintState} />,
            document.body
          )}
        </div>
      </ActionNodeContext.Provider>
    // </ActionNodeDndContext.Provider> // REMOVED
  );
};

// PropTypes validation
ActionEditorComponent.propTypes = {
  registeredActions: PropTypes.arrayOf(PropTypes.shape({
    word: PropTypes.string.isRequired,
    hint: PropTypes.string
  })).isRequired,
  qualifierOptions: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired
  })).isRequired,
  defaultQualifier: PropTypes.string,
  onActionCreated: PropTypes.func.isRequired,
  onActionDeleted: PropTypes.func.isRequired,
  onQualifierChanged: PropTypes.func.isRequired,
  onActionWordChanged: PropTypes.func.isRequired,
  onActionEquationChanged: PropTypes.func,
  initialContent: PropTypes.string,
  initialActions: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    word: PropTypes.string.isRequired,
    qualifier: PropTypes.string.isRequired,
    equation: PropTypes.string,
    actionNodeType: PropTypes.string,
    actionId: PropTypes.string
  })),
  readOnly: PropTypes.bool,
  nodeType: PropTypes.string.isRequired,
  editorId: PropTypes.string.isRequired,
  onActionDrop: PropTypes.func.isRequired,
  className: PropTypes.string,
  style: PropTypes.object,
  placeholderText: PropTypes.string
};

// Also add PropTypes for TipTapEditorComponent
TipTapEditorComponent.propTypes = {
  setEditor: PropTypes.func.isRequired,
  editorInstanceRef: PropTypes.shape({
    current: PropTypes.object
  }).isRequired
};

export default ActionEditorComponent;


// Helper outside component to avoid re-creation
const SUGGESTION_LIST_MAX_HEIGHT = 240;
const SUGGESTION_LIST_MARGIN = 10;

function calculateSuggestionPosition(coords) {
  if (!coords) return { top: 0, left: 0 };

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
}

function calculateHintPosition(targetRect, hintRect, hintType = 'node') {
  if (!targetRect || !hintRect) {
    return { top: -9999, left: -9999 };
  }
  const PADDING = 8;
  const ARROW_OFFSET = 10;

  let top, left;

  if (hintType === 'node') {
    // Position below the node, centered horizontally
    top = targetRect.bottom + PADDING;
    left = targetRect.left + targetRect.width / 2 - hintRect.width / 2;

    // Adjust if hint goes off-screen horizontally
    if (left < PADDING) {
      left = PADDING;
    } else if (left + hintRect.width > window.innerWidth - PADDING) {
      left = window.innerWidth - hintRect.width - PADDING;
    }

    // Adjust if hint goes off-screen vertically (try positioning above)
    if (top + hintRect.height > window.innerHeight - PADDING) {
      top = targetRect.top - hintRect.height - PADDING;
      // Add logic here to handle case where it also doesn't fit above
      if (top < PADDING) {
        // Fallback or alternative positioning if needed
        top = PADDING;
      }
    }

  } else { // hintType === 'suggestion'
    // Position below the suggestion item, slightly offset
    top = targetRect.bottom + PADDING;
    left = targetRect.left + ARROW_OFFSET; // Align near the start

    // Adjust if hint goes off-screen horizontally
    if (left < PADDING) {
      left = PADDING;
    } else if (left + hintRect.width > window.innerWidth - PADDING) {
      left = window.innerWidth - hintRect.width - PADDING;
    }

    // Adjust if hint goes off-screen vertically (try positioning above)
    if (top + hintRect.height > window.innerHeight - PADDING) {
      top = targetRect.top - hintRect.height - PADDING;
      if (top < PADDING) {
        top = PADDING;
      }
    }
  }


  return {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
  };
}

const HintTooltip = ({ hintState }) => {
  const { visible, content, targetRect, hintType } = hintState;
  const hintRef = useRef(null);
  const [position, setPosition] = useState({ top: -9999, left: -9999 });

  useEffect(() => {
    if (visible && targetRect && hintRef.current) {
      const hintRect = hintRef.current.getBoundingClientRect();
      setPosition(calculateHintPosition(targetRect, hintRect, hintType));
    } else {
      setPosition({ top: -9999, left: -9999 });
    }
  }, [visible, targetRect, hintType]); // Recalculate when these change

  if (!visible || !content) return null;

  return (
    <div
      ref={hintRef}
      className="hint-tooltip"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 1003, // Above suggestion menu
        background: 'rgba(0, 0, 0, 0.75)',
        color: 'white',
        padding: '5px 10px',
        borderRadius: '4px',
        fontSize: '0.8em',
        whiteSpace: 'pre-wrap', // Keep newlines from hint content
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease-in-out',
        pointerEvents: 'none', // Allow clicks to pass through
      }}
    >
      {content}
    </div>
  );
};

// PropTypes for HintTooltip
HintTooltip.propTypes = {
  hintState: PropTypes.shape({
    visible: PropTypes.bool.isRequired,
    content: PropTypes.string.isRequired,
    targetRect: PropTypes.object,
    hintType: PropTypes.string
  }).isRequired
};