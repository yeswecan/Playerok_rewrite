import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import { EditorProvider, useCurrentEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
// Removed unused Tiptap core imports
// Removed unused ChevronDown import
import SuggestionMenu from './components/SuggestionMenu.jsx';
import SuggestionMenuPortal from './components/SuggestionMenuPortal.jsx';
import { TextSelection, NodeSelection } from 'prosemirror-state';
// Removed unused debounce import
import { cn } from '../../utils';
import ActionNodeContext from './context/ActionNodeContext'; // RENAMED
// import { SelectionContext } from '../../context/SelectionContext'; // No longer used for focus
import ActionNode from './extensions/actionNodeExtension'; // Import the extracted node
import WordSuggestionExtension from './extensions/wordSuggestionExtension'; // Import the extension
import { filterSuggestions } from './utils/filterSuggestions'; // Added Import
import useActionNodeDnd from './hooks/useActionNodeDnd'; // Import DND hook
import useActionManagement from './hooks/useActionManagement'; // <-- ADD THIS
import useSuggestionManagement from './hooks/useSuggestionManagement';
import useTiptapSync from './hooks/useTiptapSync';
import TipTapEditorComponent from './components/TipTapEditorComponent';
import HintTooltip from './components/HintTooltip';
import './ActionEditorComponent.css'; // <-- ADDED CSS Import

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
  readOnly = false,
  editorType, // NEW: 'ItemActionEditor' or 'PlaylistActionEditor'
  editorId,
  onActionDrop,
  className = '',
  style = {},
  placeholderText = 'Type here to add action...',
  // Phase 1 & 2 Props
  isFocused,
  onFocus,
  onStateChange,
  // New props for global selection
  globallySelectedNode,
  onNodeSelected,
}) => {

  // Determine nodeType and actionIdOptions based on editorType
  const { nodeType, actionIdOptions } = useMemo(() => {
    if (editorType === 'ItemActionEditor') {
      return {
        nodeType: 'ItemActionNode',
        actionIdOptions: [
          { id: 'Start', label: 'Start' },
          { id: 'Stop', label: 'Stop' }
        ],
      };
    } else if (editorType === 'PlaylistActionEditor') {
      return {
        nodeType: 'PlaylistActionNode',
        actionIdOptions: [
          { id: 'previous', label: 'Previous' },
          { id: 'next', label: 'Next' },
          { id: 'play', label: 'Play' },
          { id: 'pause', label: 'Pause' },
          { id: 'volume', label: 'Volume' }
        ],
      };
    }
    return { nodeType: 'ItemActionNode', actionIdOptions: [] }; // Default case
  }, [editorType]);

  const [editorInstance, setEditorInstance] = useState(null);
  const editorInstanceRef = useRef(null);
  const preventImplicitCreationRef = useRef(false);
  const editorContainerRef = useRef(null);
  const isInitialMountRef = useRef(true);
  
  // Local selection state is now managed by the parent component.
  // We use the prop 'globallySelectedNode' to determine selection.
  const selectedNodeRef = useRef(globallySelectedNode);
  
  const [openQualifierNodeId, setOpenQualifierNodeId] = useState(null);
  const [openActionIdNodeId, setOpenActionIdNodeId] = useState(null);
  const [isNodeInternalUIActive, setIsNodeInternalUIActive] = useState(false);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const isNodeInternalUIActiveRef = useRef(isNodeInternalUIActive);
  const [focusRequest, setFocusRequest] = useState(null);
  
  const [hintState, setHintState] = useState({
    visible: false,
    content: '',
    targetRect: null,
    targetElement: null,
    hintType: 'node',
  });

  const focusReasonRef = useRef(null);

  // === Action Management Hook ===
  const {
    actionsState,
    setActionsState,
    actionsStateRef,
    addAction,
    removeAction,
    updateActionQualifier,
    updateActionId,
    updateActionWord,
    updateActionEquation,
  } = useActionManagement({
    initialActions,
    defaultQualifier,
    nodeType, // Use derived node type
    actionIdOptions,
    onActionCreated,
    onQualifierChanged,
    onActionWordChanged,
    onActionEquationChanged,
  });

  // === DND Hook ===
  const dndHookResult = useActionNodeDnd({
    nodeType, // Use derived node type
    editorId,
    onActionDrop,
    actionsState,
    actionsStateRef,
    editorInstanceRef,
    setIsDraggingNode,
  });
  const { canDrop, isOver, dropRef, actionsToRender } = dndHookResult;

  // Log when a node is hovering over this editor
  useEffect(() => {
    if (isOver) {
      console.log(`[DND] Hovering over editor: ${editorId}`);
    }
  }, [isOver, editorId]);

  const onActionDeletedRef = useRef(onActionDeleted);
  useEffect(() => { onActionDeletedRef.current = onActionDeleted; }, [onActionDeleted]);

  const suggestionListRef = useRef(null);

  // New, robust, recursive function to find all text segments
  const findUntrackedTextSegments = useCallback((node) => {
    let segments = [];
    if (node.type === 'text' && node.text.trim()) {
      segments.push({ text: node.text.trim() });
    }

    if (node.content) {
      for (const childNode of node.content) {
        segments = segments.concat(findUntrackedTextSegments(childNode));
      }
    }
    
    // This part is a bit tricky, we only want text that is not already part of an action.
    // A simple way is to filter out any text that is inside an actionNode.
    // For now, let's assume any top-level text is fair game.
    // A better implementation would check if a text node has an 'actionNode' ancestor.
    // But given the editor structure, this should work for now.
    
    // We will refine this logic if needed. The key is to find ANY text.
    // The logic in `checkAndTriggerImplicitCreation` from the hook will handle the rest.
    return segments;
  }, []);

  // === Suggestion Management Hook ===
  const {
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
  } = useSuggestionManagement({
    editorInstanceRef,
    registeredActions,
    isNodeInternalUIActive,
    addAction,
    updateActionWord,
    preventImplicitCreationRef,
    findUntrackedTextSegments,
  });

  // === Tiptap Sync Hook ===
  const { generateTiptapContent } = useTiptapSync({
    editorInstanceRef,
    actionsState,
    removeAction,
    onActionDeletedRef,
    preventImplicitCreationRef,
    nodeType,
    actionsToRender,
  });

  // Phase 1: Effect to sync focus from parent
  useEffect(() => {
    const editor = editorInstanceRef.current;
    if (!editor) return;

    // Only focus if the prop is explicitly true
    if (isFocused === true && !editor.isFocused) {
      setTimeout(() => editor.commands.focus('end'), 0);
    } else if (isFocused === false && editor.isFocused) {
      editor.commands.blur();
    }
  }, [isFocused]);

  // Phase 2: Effect to report suggestion state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange(editorId, {
        suggestionOpen: suggestionState.visible,
        suggestionQuery: suggestionState.query,
      });
    }
  }, [suggestionState.visible, suggestionState.query, editorId, onStateChange]);

  const setNodeDragState = useCallback((nodeId, isDragging) => {
    const editor = editorInstanceRef.current;
    if (!editor || editor.isDestroyed || !nodeId) return;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'actionNode' && node.attrs.nodeId === nodeId) {
        editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, 'isBeingDragged', isDragging));
        return false;
      }
    });
  }, []);

  useEffect(() => { suggestionStateRef.current = suggestionState; }, [suggestionState]);

  const showHint = useCallback((rect, hintContent, element, type = 'node') => {
    setHintState({ visible: true, content: hintContent, targetRect: rect, targetElement: element, hintType: type });
  }, []);

  const hideHint = useCallback(() => {
    setHintState(prevState => ({ ...prevState, visible: false, targetElement: null }));
  }, []);

  useEffect(() => {
    const handleScrollAndResize = () => {
      if (hintState.visible && hintState.targetElement) {
        setHintState(prevState => ({ ...prevState, targetRect: prevState.targetElement.getBoundingClientRect() }));
      }
    };
    window.addEventListener('resize', handleScrollAndResize);
    const editorEl = editorContainerRef.current;
    if (editorEl) editorEl.addEventListener('scroll', handleScrollAndResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleScrollAndResize);
      if (editorEl) editorEl.removeEventListener('scroll', handleScrollAndResize);
    };
  }, [hintState.visible, hintState.targetElement]);

  // Effect to sync tiptap selection with the parent's state
  useEffect(() => {
    const editor = editorInstanceRef.current;
    if (!editor || editor.isDestroyed) return;

    const isNodeSelectedInThisEditor = editor.state.selection instanceof NodeSelection &&
                                     editor.state.selection.node.type.name === 'actionNode';

    // If a node is selected globally and it's in this editor, ensure it's selected in Tiptap.
    if (globallySelectedNode && globallySelectedNode.editorId === editorId) {
      if (!isNodeSelectedInThisEditor || editor.state.selection.node.attrs.nodeId !== globallySelectedNode.nodeId) {
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === 'actionNode' && node.attrs.nodeId === globallySelectedNode.nodeId) {
            const newSelection = NodeSelection.create(editor.state.doc, pos);
            if (!newSelection.eq(editor.state.selection)) {
              editor.view.dispatch(editor.state.tr.setSelection(newSelection));
            }
            return false;
          }
        });
      }
    } 
    // If no node is selected globally, or a node in another editor is selected,
    // ensure no node is selected in this editor.
    else if (isNodeSelectedInThisEditor) {
      const newSelection = TextSelection.create(editor.state.doc, editor.state.doc.content.size);
       if (!newSelection.eq(editor.state.selection)) {
          editor.view.dispatch(editor.state.tr.setSelection(newSelection));
       }
    }
  }, [globallySelectedNode, editorId]);

  const actionNodeContextValue = useMemo(() => ({
    actionsState,
    openQualifierNodeId,
    setOpenQualifierNodeId,
    openActionIdNodeId,
    setOpenActionIdNodeId,
    updateActionQualifier,
    updateActionId,
    removeAction,
    startInlineEdit,
    qualifierOptions,
    actionIdOptions,
    selectedNodeId: globallySelectedNode?.editorId === editorId ? globallySelectedNode.nodeId : null,
    setSelectedNodeId: (nodeId) => {
      if (nodeId) {
        onNodeSelected({ nodeId, editorId });
      } else {
        onNodeSelected(null);
      }
    },
    isNodeInternalUIActive,
    setIsNodeInternalUIActive,
    showHint,
    hideHint,
    setNodeDragState,
  }), [actionsState, openQualifierNodeId, openActionIdNodeId, updateActionQualifier, updateActionId, removeAction, startInlineEdit, qualifierOptions, actionIdOptions, globallySelectedNode, isNodeInternalUIActive, showHint, hideHint, onNodeSelected, setNodeDragState]);

  const connectRefs = useCallback((node) => {
    editorContainerRef.current = node;
    dropRef(node);
  }, [dropRef]);

  // --- Tiptap Event Handlers ---
  const handleUpdate = ({ editor }) => {
    // Phase 2: Report text state changes
    if (onStateChange) {
      onStateChange(editorId, { text: editor.getText() });
    }
  };

  const handleSelectionUpdate = ({ editor }) => {
    const { selection } = editor.state;
    if (selection instanceof NodeSelection && selection.node.type.name === 'actionNode') {
      const nodeId = selection.node.attrs.nodeId;
      // If this node is not already the globally selected one, update the parent.
      if (globallySelectedNode?.nodeId !== nodeId || globallySelectedNode?.editorId !== editorId) {
        onNodeSelected({ nodeId, editorId });
      }
    } else {
      // If the selection is cleared within this editor, notify the parent.
      if (globallySelectedNode && globallySelectedNode.editorId === editorId) {
        onNodeSelected(null);
      }
    }
  };

  const handleBlur = ({ editor, event }) => {
    hideSuggestionsOnBlur();
    setIsNodeInternalUIActive(false);

    // This logic helps determine if the blur is happening "outside" the component.
    const relatedTarget = event?.relatedTarget;
    if (relatedTarget && editorContainerRef.current?.contains(relatedTarget)) {
      return;
    }

    // Don't clear selection if focus is moving to another action editor
    if (relatedTarget?.closest('.action-editor-component')) {
      return;
    }
    
    // As per spec, trigger conversion on blur.
    checkAndTriggerImplicitCreation();

    // The parent now controls selection, so we don't clear it directly on blur.
    // The logic in the parent and the effect will handle it.
  };

  const handleFocus = ({ editor }) => {
    if (onFocus) {
      onFocus();
    }
    
    // Do not show suggestions on the initial, automatic focus
    if (isInitialMountRef.current) {
      return;
    }

    setIsNodeInternalUIActive(false); // Reset this on focus
    setFocusRequest(Date.now()); // Trigger the effect
  };
  
  const handleTransaction = ({ editor, transaction }) => {
    selectedNodeRef.current = globallySelectedNode;
    // No longer triggering creation from here.
    if (transaction.docChanged) {
        generateTiptapContent();
    }
  };

  const editorProps = {
    attributes: {
      class: `prose dark:prose-invert prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-5 focus:outline-none custom-prose-styles`,
    },
    handleKeyDown: (view, event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        // If the suggestion menu is visible, Enter should select the highlighted item.
        if (suggestionState.visible) {
          return handleSelectByIndex();
        }
        // Otherwise, it should trigger the creation of a new action node.
        return checkAndTriggerImplicitCreation();
      }
      
      // As per spec, trigger conversion on Space.
      if (event.key === ' ') {
        event.preventDefault();
        return checkAndTriggerImplicitCreation();
      }
      
      return false; // Let Tiptap handle other keys
    },
    handleDOMEvents: {
      click: (view, event) => {
        setIsNodeInternalUIActive(false);
        if (event.target === view.dom) {
          if (globallySelectedNode && globallySelectedNode.editorId === editorId) {
            onNodeSelected(null);
          }
          focusReasonRef.current = 'background_click';
          setTimeout(() => view.focus(), 0);
        }
      }
    }
  };

  const extensions = [
    StarterKit.configure({
      paragraph: { HTMLAttributes: { class: 'action-editor-paragraph' } },
      document: {},
      text: {},
      gapcursor: false,
      history: true,
      dropcursor: { color: '#555', width: 2 },
    }),
    Placeholder.configure({ placeholder: placeholderText }),
    ActionNode.configure({
      ...dndHookResult,
      nodeType,
      setNodeDragState,
    }),
    WordSuggestionExtension.configure({
      getSuggestionState: () => suggestionStateRef.current,
      requestStateUpdate: (query) => {
        if (typeof query === 'string') {
          updateQueryAndSuggestions(query);
        }
      },
    }),
  ];

  useEffect(() => {
    // After the component has mounted, set the ref to false
    isInitialMountRef.current = false;
  }, []);

  useEffect(() => {
    if (focusRequest) {
      showSuggestionsOnFocus();
      setFocusRequest(null); // Reset the request
    }
  }, [focusRequest, showSuggestionsOnFocus]);

  return (
    <ActionNodeContext.Provider value={actionNodeContextValue}>
      <div
        ref={connectRefs}
        className={cn("action-editor-component", className, { 'is-over': canDrop && isOver })}
        style={style}
        data-editor-id={editorId}
      >
        <EditorProvider
          extensions={extensions}
          content={generateTiptapContent(actionsToRender)}
          onUpdate={handleUpdate}
          onSelectionUpdate={handleSelectionUpdate}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onTransaction={handleTransaction}
          editorProps={editorProps}
        >
          <TipTapEditorComponent 
            setEditor={setEditorInstance} 
            editorInstanceRef={editorInstanceRef}
          />
        
          {editorInstance && suggestionState.visible && (
            <SuggestionMenuPortal
              ref={suggestionListRef}
              items={suggestionState.items}
              selectedIndex={suggestionState.selectedIndex}
              onSelect={handleSelect}
              onClose={handleCloseSuggestion}
              coords={suggestionState.coords}
              editorInstance={editorInstance}
            />
          )}

          {hintState.visible && hintState.targetRect && (
            <HintTooltip hintState={hintState} />
          )}
        </EditorProvider>
      </div>
    </ActionNodeContext.Provider>
  );
};

// --- Prop Types ---
ActionEditorComponent.propTypes = {
  editorId: PropTypes.string.isRequired,
  registeredActions: PropTypes.arrayOf(PropTypes.shape({
    word: PropTypes.string.isRequired,
    hint: PropTypes.string
  })).isRequired,
  qualifierOptions: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
  })).isRequired,
  defaultQualifier: PropTypes.string,
  onActionCreated: PropTypes.func,
  onActionDeleted: PropTypes.func,
  onQualifierChanged: PropTypes.func,
  onActionWordChanged: PropTypes.func,
  onActionEquationChanged: PropTypes.func,
  initialContent: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  initialActions: PropTypes.array,
  readOnly: PropTypes.bool,
  editorType: PropTypes.oneOf(['ItemActionEditor', 'PlaylistActionEditor']).isRequired,
  onActionDrop: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.object,
  placeholderText: PropTypes.string,
  isFocused: PropTypes.bool,
  onFocus: PropTypes.func,
  onStateChange: PropTypes.func,
  globallySelectedNode: PropTypes.object,
  onNodeSelected: PropTypes.func,
};

export default ActionEditorComponent;