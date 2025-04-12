import React, { useState, useCallback, useEffect, createContext, useContext, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { EditorProvider, useCurrentEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Node, mergeAttributes, Extension } from '@tiptap/core';
import { ChevronDown } from 'lucide-react';
import SuggestionList from './SuggestionList.jsx';
import { TextSelection, NodeSelection, Plugin, PluginKey } from 'prosemirror-state';
import { debounce } from 'lodash-es';

// --- Hint Context ---
export const HintContext = createContext({
    showHint: (rect, word) => {},
    hideHint: () => {},
    onActionWordChanged: (nodeId, newWord) => {},
    updateActionQualifier: (nodeId, newQualifier) => {},
    updateActionWord: (nodeId, newWord) => {},
    deleteAction: (nodeId) => {},
    setSuggestionState: () => {},
    registeredActions: [],
    suggestionStateRef: { current: null },
});

// --- Custom TipTap Node for Actions ---
const ActionNode = Node.create({
  name: 'actionNode',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  content: 'inline*',
  code: true,

  addAttributes() {
    return {
      qualifier: {
        default: null, // Will be set from props
      },
      nodeId: {
          default: null,
          parseHTML: element => element.getAttribute('data-node-id'),
          renderHTML: attributes => {
              if (!attributes.nodeId) {
                return { 'data-node-id': `action_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` };
              }
              return { 'data-node-id': attributes.nodeId };
          },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="action-node"][data-node-id]',
        getAttrs: domNode => {
            if (!(domNode instanceof Element)) return false;
            const id = domNode.getAttribute('data-node-id');
            const qualifier = domNode.getAttribute('data-qualifier');
            if (!id || !qualifier) return false;
            return { qualifier, nodeId: id };
        },
        contentElement: 'span.action-word-content',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
     const mergedAttrs = mergeAttributes(HTMLAttributes, {
       'data-type': 'action-node',
       'data-node-id': node.attrs.nodeId,
       'data-qualifier': node.attrs.qualifier,
     });
     return [
        'span',
        mergedAttrs,
        ['span', { class: 'action-word-content' }, 0]
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ActionNodeView);
  },

  addKeyboardShortcuts() {
    return {
      'Backspace': () => {
        const { editor } = this;
        const { selection } = editor.state;

        if (selection.empty && selection.$from.parent.type === this.type && selection.$from.parentOffset === 0) {
            if (selection.$from.parent.content.size === 0) {
                // console.log('[ActionNode Backspace Shortcut] Node is empty, allowing default backspace (delete node).');
                return false;
            }
             // console.log('[ActionNode Backspace Shortcut] Cursor at start of non-empty node, preventing default backspace.');
             return true;
        }

        return false;
      },
    };
  },
});

// --- React Component for the Action Node View ---
// Wrap with forwardRef
const ActionNodeView = React.forwardRef(({ node, updateAttributes, editor, selected, getPos, deleteNode }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef(null);
  const originalWordRef = useRef(node.textContent);
  const { qualifier, nodeId } = node.attrs || {};
  const hintContext = useContext(HintContext);
  const { showHint, hideHint, onActionWordChanged, onActionDeleted, onQualifierChanged, setSuggestionState, registeredActions, suggestionStateRef } = hintContext;
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Get qualifierOptions from props via context
  const { qualifierOptions } = useContext(HintContext);
  const selectedOptionLabel = qualifierOptions.find(opt => opt.id === qualifier)?.label || qualifierOptions[0].label;

  const handleQualifierChange = (newQualifierId) => {
    updateAttributes({ qualifier: newQualifierId });
    // console.log(`Qualifier changed for ${nodeId} to ${newQualifierId}`)
  };

  const toggleDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const selectQualifier = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(false);
    setTimeout(() => {
      hintContext.updateActionQualifier(nodeId, id);
    }, 0);
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

  function hideSuggestionMenu() {
    editor?.commands?.focus?.();
    editor?.chain()?.focus()?.run();
    if (editor?.view?.dispatch) {
      editor.view.dispatch(editor.state.tr.setMeta('suggestion-hide', true));
    }
  }

  function handleCommitEdit(value) {
    const newWord = value.trim();
    // console.log('[handleCommitEdit] Attempting to commit value:', newWord, 'Original:', originalWordRef.current);
    if (newWord && newWord !== originalWordRef.current) {
      try {
        const pos = getPos();
        if (typeof pos === 'number') {
          const from = pos + 1;
          const to = from + originalWordRef.current.length;
          // console.log(`[handleCommitEdit] Replacing range: from=${from}, to=${to} with text: "${newWord}"`);

          editor
            .chain()
            .insertContentAt({ from, to }, newWord )
            .run();

          // console.log('[handleCommitEdit] Tiptap chain executed.');
          onActionWordChanged(node.attrs.nodeId, newWord);
        } else {
          console.error('[handleCommitEdit] Invalid position:', pos); // Keep error logs? Maybe.
        }
      } catch (err) {
        console.error('[handleCommitEdit] Error updating ActionNode word:', err); // Keep error logs? Maybe.
      }
    } else {
      // console.log('[handleCommitEdit] No changes detected or word is empty. Reverting or keeping original.');
    }
    setIsEditing(false);
    setSuggestionState(prev => ({ ...prev, visible: false, forceVisible: false, editingNodeId: null }));
  }

  function handleKeyDown(e) {
    const key = e.key;
    const refState = suggestionStateRef.current || { highlightedItems: [], selectedIndex: -1, items: registeredActions || [] };
    const fullItems = refState.items || [];
    const maxIndex = fullItems.length > 0 ? fullItems.length - 1 : -1;

    if (key === 'ArrowDown' || key === 'Down') {
      e.preventDefault();
      setSuggestionState(prev => {
        const currentMaxIndex = (prev.items || []).length - 1;
        const newIndex = prev.selectedIndex < currentMaxIndex ? prev.selectedIndex + 1 : 0;
        // console.log('[InlineInput] ArrowDown, newIndex:', newIndex, 'maxIndex:', currentMaxIndex);
        return { ...prev, selectedIndex: newIndex };
      });
    } else if (key === 'ArrowUp' || key === 'Up') {
      e.preventDefault();
      setSuggestionState(prev => {
        const currentMaxIndex = (prev.items || []).length - 1;
        const newIndex = prev.selectedIndex > 0 ? prev.selectedIndex - 1 : currentMaxIndex;
        // console.log('[InlineInput] ArrowUp, newIndex:', newIndex, 'maxIndex:', currentMaxIndex);
        return { ...prev, selectedIndex: newIndex };
      });
    } else if (key === 'Enter') {
      e.preventDefault();
      const refState = suggestionStateRef.current || {};
      const { selectedIndex = -1, items = [] } = refState;
      // console.log('[InlineInput Enter Key] State from ref:', refState);

      if (refState.visible && selectedIndex >= 0 && items && items.length > selectedIndex) {
        const selectedWord = items[selectedIndex];
        // console.log('[InlineInput Enter Key] Selecting suggestion:', selectedWord);
        handleCommitEdit(selectedWord);
      } else {
        // console.log('[InlineInput Enter Key] Committing current input value:', e.target.value);
        handleCommitEdit(e.target.value);
      }
    } else if (key === 'Escape') {
      e.preventDefault();
      // console.log('[InlineInput Escape Key] Cancelling edit.');
      setIsEditing(false);
      setSuggestionState(prev => ({ ...prev, visible: false, forceVisible: false, editingNodeId: null }));
      editor?.chain().focus().run();
    }
  }

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className={`inline-block bg-gray-100 rounded px-2 py-1 mx-px text-sm border border-gray-300 cursor-pointer ${selected ? 'ring-2 ring-blue-500' : ''}`}
      data-node-id={nodeId}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <NodeViewContent className="hidden" ref={ref} />
      {isEditing ? (
        <span className="inline-flex items-center">
            <input
                ref={inputRef}
                defaultValue={originalWordRef.current}
                onBlur={(e) => handleCommitEdit(e.target.value)}
                onKeyDown={handleKeyDown}
                onChange={(e) => {
                    const query = e.target.value;
                    setSuggestionState(prev => {
                        const filtered = filterSuggestions(query, registeredActions);
                        const coords = calculateCoordsForInput(inputRef.current);
                        // console.log('[InlineInput onChange] Updating suggestions:', { query, filtered, coords });
                        return {
                            ...prev,
                            visible: true,
                            forceVisible: true,
                            query,
                            highlightedItems: filtered,
                            selectedIndex: filtered.length > 0 ? 0 : -1,
                            coords,
                            editingNodeId: nodeId
                        };
                    });
                }}
                className="bg-white border border-blue-300 rounded px-1 outline-none"
                style={{ minWidth: '50px' }}
            />
        </span>
      ) : (
        <span className="inline-flex items-center relative">
          <span
            className="action-word-content inline mr-1"
            onDoubleClick={() => {
              // console.log('[DoubleClick] Entering edit mode for node:', nodeId, 'word:', node.textContent);
              originalWordRef.current = node.textContent;
              setIsEditing(true);
              setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
                const initialQuery = node.textContent;
                const initialFiltered = filterSuggestions(initialQuery, registeredActions);
                const initialCoords = calculateCoordsForInput(inputRef.current);
                // console.log('[DoubleClick] Setting initial suggestion state:', { initialQuery, initialFiltered, initialCoords });
                setSuggestionState(prev => ({
                    ...prev,
                    visible: true,
                    forceVisible: true,
                    query: initialQuery,
                    items: registeredActions,
                    highlightedItems: initialFiltered,
                    selectedIndex: initialFiltered.length > 0 ? 0 : -1,
                    coords: initialCoords,
                    editingNodeId: nodeId
                }));
              }, 0);
            }}
          >
            {node.textContent || '...'}
          </span>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleDropdown}
            className="flex items-center px-1 py-0.5 bg-yellow-200 border-l border-yellow-300 hover:bg-yellow-300 transition-colors relative"
            aria-haspopup="true"
            aria-expanded={isOpen}
          >
            <span className="mr-0.5">{selectedOptionLabel}</span>
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          </button>
          {isOpen && (
              <div
                className="absolute top-full left-0 mt-1 w-32 bg-white shadow-lg rounded-md border border-gray-200 z-50"
                onMouseDown={(e) => e.preventDefault()}
              >
                {qualifierOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsOpen(false);
                      hintContext.updateActionQualifier(nodeId, option.id);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 first:rounded-t-md last:rounded-b-md"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
          )}
          <button
            onClick={() => {
              deleteNode();
              onActionDeleted(node.attrs.nodeId);
            }}
            className="flex items-center justify-center px-1 py-0.5 bg-yellow-300 hover:bg-yellow-400 text-gray-800 border-l border-yellow-300 rounded-r transition-colors"
            title="Delete action"
          >
            ×
          </button>
        </span>
      )}
    </NodeViewWrapper>
  );
});

function filterSuggestions(query, registeredActions) {
  if (!registeredActions) return [];
  return registeredActions.filter(item =>
    item.toLowerCase().includes(query.toLowerCase())
  );
}

function calculateCoordsForInput(inputEl) {
  if (!inputEl) return null;
  const rect = inputEl.getBoundingClientRect();
  const containerRect = inputEl.closest('.relative')?.getBoundingClientRect() || { left: 0, top: 0 };
  return {
    x: rect.left - containerRect.left,
    y: rect.bottom - containerRect.top,
  };
}

// --- Word Suggestion Extension ---
const WordSuggestionExtension = Extension.create({
  name: 'wordSuggestion',

  addOptions() {
    return {
      getSuggestionState: () => ({ visible: false }),
      requestCoordUpdate: () => {},
      registeredActions: [],
      defaultQualifier: null,
      editorContainerRef: { current: null },
      // requestStateUpdate: (reason) => { console.log('[WordSuggestionExtension] requestStateUpdate called:', reason); },
      requestStateUpdate: (reason) => {}, // Quieten this
      handleImplicitCreate: (word) => { console.warn('[WordSuggestionExtension] handleImplicitCreate not configured!'); }, // Keep warn?
    };
  },

  // Step 1: Add storage to hold the key instance
  addStorage() {
    return {
      key: null,
    };
  },

  addProseMirrorPlugins() {
    const ext = this;
    // Step 2: Create the single key instance
    const suggestionPluginKey = new PluginKey('wordSuggestionPlugin');
    // Step 2: Store it in storage
    this.storage.key = suggestionPluginKey;

    return [
      new Plugin({
        key: suggestionPluginKey, // Use the instance to define the plugin
        state: {
          init(_, instance) {
            return {
              active: false,
              range: null,
              query: '',
              prevRange: null,
              prevQuery: '',
              justConvertedExplicitOrSpace: false,
            };
          },
          apply(tr, prev, oldState, newState) {
            const meta = tr.getMeta('wordSuggestionPlugin') || {};
            const isSyncingContent = tr.getMeta('isSyncingContent') === true; // Check for our new meta flag
            const next = { ...prev };

            // --- Wrap core logic with flag check ---
            if (!isSyncingContent) { // Use the meta flag for the check
                const { selection } = newState;
                const isNodeSelection = selection instanceof NodeSelection && selection.node.type.name === 'actionNode';

                // --- Refined State Logic --- 
                next.active = false; // Reset active state for this run
                next.range = null;
                next.query = '';

                if (selection.empty && !isNodeSelection) {
                    const $from = selection.$from;
                    if ($from.parent && $from.parent.content) {
                        let possible = true;
                        // Check if immediately after an actionNode
                        const nodeBefore = $from.nodeBefore;
                        if (nodeBefore && nodeBefore.type.name === 'actionNode') {
                            possible = false;
                        }

                        if (possible) {
                            const currentPos = $from.pos;
                            let startPos = $from.start(); // Default to block start

                            // Iterate backwards from cursor position within the current parent block
                            // We need the resolved position to query nodes correctly
                            const resolvedPos = newState.doc.resolve(currentPos);
                            let nodeFoundStart = false;

                            for (let i = resolvedPos.depth; i >= 0; i--) { // Iterate through depths
                                let currentParent = resolvedPos.node(i);
                                let offsetInParent = resolvedPos.posAtIndex(i > 0 ? resolvedPos.index(i - 1) : 0);

                                // Iterate nodes within this parent level, before the cursor's relative position
                                for (let j = resolvedPos.index(i) -1 ; j >=0; j--) {
                                    let childNode = currentParent.child(j);
                                    let childNodePos = resolvedPos.posAtIndex(j, i);

                                    if (childNodePos < currentPos) {
                                        if (childNode.type.name === 'actionNode') {
                                            // Boundary is *after* this node
                                            startPos = childNodePos + childNode.nodeSize;
                                            nodeFoundStart = true;
                                            break; // Found boundary
                                        } else if (childNode.isText) {
                                            const text = childNode.text || '';
                                            const lastSpaceInText = text.lastIndexOf(' ');
                                            if (lastSpaceInText !== -1) {
                                                // Boundary is after the last space in this node
                                                startPos = childNodePos + lastSpaceInText + 1;
                                                nodeFoundStart = true;
                                                break;
                                            } else {
                                                // If no space, the word might start at the beginning of this text node
                                                startPos = childNodePos;
                                                // Continue checking further back in case there was an action node
                                            }
                                        }
                                        // Add checks for other potential boundary nodes if needed
                                    }
                                }
                                if (nodeFoundStart) break; // Stop searching depths if boundary found
                                // If loop finishes without finding a node boundary, startPos remains block start (or adjusted by text node checks)
                            }

                            // Final check: Handle text immediately before cursor at the start of the block
                             if (!nodeFoundStart && resolvedPos.parent.isTextblock) {
                                const textNodeBefore = resolvedPos.textOffset > 0 ? resolvedPos.parent.textBetween(0, resolvedPos.parentOffset, '\0') : '';
                                const lastSpace = textNodeBefore.lastIndexOf(' ');
                                if (lastSpace !== -1) {
                                    startPos = $from.start() + lastSpace + 1;
                                } else {
                                    startPos = $from.start();
                                }
                             }

                            // Calculate range and query
                            if (currentPos >= startPos) { // Use >= to allow query at start
                                next.range = { from: startPos, to: currentPos };
                                next.query = newState.doc.textBetween(startPos, currentPos, '\0'); // Use \0 as leaf text separator
                                // console.log(`[Plugin Apply - Revised] Query: "${next.query}" from range ${startPos}-${currentPos}`);
                                if (next.query) { // Don't require trim() here
                                    next.active = true;
                                }
                            }
                        }
                    } else {
                        console.warn("[WordSuggestionPlugin apply] Skipping range calculation: $from.parent is missing or has no content.", { fromPos: $from.pos, parentExists: !!$from.parent });
                        next.active = false;
                        next.range = null;
                    }
                }
                // --- End Refined State Logic ---

                // --- Implicit creation on move/selection --- 
                if (prev.active && 
                    !next.active && 
                    prev.query && 
                    prev.query.trim() && 
                    !isNodeSelection && 
                    !meta.fromSuggestionSelect && 
                    !meta.justConvertedExplicitOrSpace && 
                    !meta.justConvertedImplicit 
                ) {
                    const trimmedPrevQuery = prev.query.trim();
                    console.log(`[WordSuggestionExtension Apply] Implicit Create Triggered (Move/Selection Change): Word='${trimmedPrevQuery}'`);
                    const created = ext.options.handleImplicitCreate(trimmedPrevQuery, 'selection');
                    if (created) {
                        tr.setMeta('wordSuggestionPlugin', { ...meta, justConvertedImplicit: true });
                    }
                }
                // --- End implicit creation ---

                // Update prev state ONLY if calculated state was active inside the block
                if (next.active) { 
                    next.prevRange = next.range;
                    next.prevQuery = next.query;
                } else { // If not active, clear prev state
                     next.prevRange = null;
                     next.prevQuery = '';
                }

            } else {
                console.log('[WordSuggestionExtension Apply] Skipping core logic due to isSyncingContent meta flag.');
                 // If skipping, ensure prev state is cleared if it existed
                 next.active = false;
                 next.range = null;
                 next.query = '';
                 next.prevRange = null;
                 next.prevQuery = '';
            }
            // --- End flag check wrap --- 

            // Reset the flag based on meta from Space/Enter/Select or the implicit flag
            // This needs to happen regardless of the flag check above, using the transaction meta
            next.justConvertedExplicitOrSpace = meta.justConvertedExplicitOrSpace || meta.justConvertedImplicit || false;

            return next;
          },
        },
        props: {},
      }),
    ];
  },

  onFocus({ editor }) {
    // console.log('[WordSuggestionExtension:onFocus] Fired.');
    this.options.requestStateUpdate('focus');
  },

  onUpdate({ editor }) {
    // console.log('[WordSuggestionExtension:onUpdate] Fired.');
    this.options.requestStateUpdate('update');
    this.options.requestCoordUpdate();
  },

  addKeyboardShortcuts() {
    return {
      ArrowUp: () => {
        const { visible } = this.options.getSuggestionState();
        if (!visible) return false;
        this.options.onNavUp();
        return true; // Consume event
      },
      ArrowDown: () => {
        const { visible } = this.options.getSuggestionState();
        if (!visible) return false;
        this.options.onNavDown();
        return true; // Consume event
      },
      Enter: () => {
        const { visible, selectedIndex } = this.options.getSuggestionState();
        if (!visible || selectedIndex < 0) {
           // Allow implicit creation if enabled and no suggestion selected
           // const created = this.options.handleImplicitCreate(this.editor.state.doc.textBetween(this.storage.state.range?.from, this.storage.state.range?.to), 'enter');
           // return created;
           return false; // For now, just allow default Enter if no selection
        }
        // If suggestion is selected, handle selection
        return this.options.onSelectByIndex();
      },
      Escape: () => {
        const { visible } = this.options.getSuggestionState();
        if (!visible) return false;
        this.options.onCloseSuggestion();
        return true; // Consume event
      },
      // Previous Space shortcut logic (handleImplicitCreate) needs to be reimplemented here in Step 3
      Space: () => {
          const { visible } = this.options.getSuggestionState();
          if (visible) return false; // Don't trigger implicit if menu is open
           // const created = this.options.handleImplicitCreate(this.editor.state.doc.textBetween(this.storage.state.range?.from, this.storage.state.range?.to), 'space');
           // return created;
           return false; // For now, disable implicit creation via space
      },
    };
  },

  onSelectionUpdate({ editor }) {
    // console.log('[WordSuggestionExtension:onSelectionUpdate] Fired.');
    this.options.requestStateUpdate('selection');
    this.options.requestCoordUpdate();
    // Implicit creation logic is now handled within the plugin's apply method
  },

  onBlur({ editor, event }) {
    // console.log('[WordSuggestionExtension:onBlur] BLUR EVENT DETECTED!');
    const relatedTarget = event.relatedTarget;
    if (relatedTarget && (relatedTarget.closest('.suggestion-list') || relatedTarget.closest('.inline-block[data-node-id]'))) {
        // console.log('[WordSuggestionExtension:onBlur] Blur target is suggestion list or node view, ignoring implicit create.');
        this.options.requestStateUpdate('blur_to_interactive');
        return;
    }

    // Call the central handler - it will determine if creation is needed based on previous state
    this.options.handleImplicitCreate('blur'); // Pass correct trigger reason

    this.options.requestStateUpdate('blur');
  },
});

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
  initialContent = '',
  placeholder = 'Type to add actions...',
  initialActions = [],
}) => {
  const [editorInstance, setEditorInstance] = useState(null);
  const [actionsState, setActionsState] = useState(() => initialActions || []);
  const actionsStateRef = useRef(actionsState); // Ref to hold current actionsState for closures
  const editorInstanceRef = useRef(null); // Ref to hold the editor instance
  const defaultQualifierRef = useRef(defaultQualifier); // Ref for default qualifier
  const preventImplicitCreationRef = useRef(false); // Ref to control implicit creation during sync
  const editorContainerRef = useRef(null); // Define the container ref
  const [updateRequestNonce, setUpdateRequestNonce] = useState(0); // Nonce to trigger suggestion state updates
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

  const onActionWordChangedRef = useRef(onActionWordChanged);
  const onQualifierChangedRef = useRef(onQualifierChanged);
  const onActionDeletedRef = useRef(onActionDeleted);
  const onActionCreatedRef = useRef(onActionCreated);

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

  // Placeholder hint functions (implement actual logic if needed)
  const showHint = useCallback((rect, word) => {
    // console.log('showHint called:', rect, word);
  }, []);

  const hideHint = useCallback(() => {
    // console.log('hideHint called');
  }, []);

  // --- State Update Functions ---

  const addAction = useCallback((word, qualifier) => {
    if (!word) return;
    preventImplicitCreationRef.current = true; // Prevent sync loop
    const uniqueId = `action_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newAction = { id: uniqueId, word, qualifier: qualifier || defaultQualifierRef.current };
    console.log('[ActionEditorComponent] Adding action:', newAction);
    setActionsState(prev => [...prev, newAction]);
    onActionCreatedRef.current?.(newAction.id, newAction.word, newAction.qualifier);
    // Clear suggestion state after adding
    setSuggestionState(prev => ({ ...prev, visible: false, query: '', items: [], selectedIndex: -1, editingNodeId: null, inserting: false }));
    setTimeout(() => preventImplicitCreationRef.current = false, 0);
  }, [defaultQualifierRef]); // Dependencies: only things that don't change often


  const updateActionQualifier = useCallback((nodeId, newQualifier) => {
    preventImplicitCreationRef.current = true; // Prevent sync loop
    console.log('[ActionEditorComponent] Updating qualifier for node:', nodeId, 'to:', newQualifier);
    setActionsState(prev => prev.map(action =>
        action.id === nodeId ? { ...action, qualifier: newQualifier } : action
    ));
    onQualifierChangedRef.current?.(nodeId, newQualifier);
    setTimeout(() => preventImplicitCreationRef.current = false, 0);
  }, []); // Empty dependency array as it doesn't depend on changing props/state


  // --- Helper: Convert actionsState to Tiptap content ---
  const generateTiptapContent = useCallback((actions) => {
    const actionNodesContent = (actions || []).flatMap((action) => {
       if (!action || typeof action.word !== 'string' || typeof action.id !== 'string' || typeof action.qualifier !== 'string') {
           console.warn('[generateTiptapContent] Skipping invalid action state item:', action);
          return [];
        }
      const nodeJson = {
        type: 'actionNode',
        attrs: { nodeId: action.id, qualifier: action.qualifier },
        content: [{ type: 'text', text: action.word }],
      };
       // Add a space after each node for separation
       return [nodeJson, { type: 'text', text: ' ' }];
     });

     // Remove trailing space if it exists
     if (actionNodesContent.length > 0 && actionNodesContent[actionNodesContent.length - 1].type === 'text') {
       actionNodesContent.pop();
     }

     return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: actionNodesContent.length > 0 ? actionNodesContent : undefined,
        },
      ],
    };
  }, []); // Removed self-dependency and addAction dependency


  // --- Effect to Synchronize React State -> Tiptap ---
  useEffect(() => {
    const currentEditor = editorInstanceRef.current;
    if (currentEditor && !currentEditor.isDestroyed && actionsStateRef.current) {
      // console.log('[SyncEffect] Running. Actions State:', actionsStateRef.current);
      const latestActionsState = actionsStateRef.current;
      const generatedContent = generateTiptapContent(latestActionsState);
      // console.log('[SyncEffect] Generated Tiptap Content:', JSON.stringify(generatedContent));

      // Defer setContent slightly to avoid flushSync warning during render
      requestAnimationFrame(() => {
          if (currentEditor && !currentEditor.isDestroyed && currentEditor.isEditable) {
              // console.log('[SyncEffect RAF] Setting content...');
              currentEditor.commands.setContent(generatedContent, false, {
                preserveWhitespace: 'full',
                // transactionData: { meta: { isSyncingContent: true } }, // Meta might not be needed if deferred
              });
              // console.log('[SyncEffect RAF] setContent command executed.');
        } else {
              // console.warn('[SyncEffect RAF] Editor not ready or editable when RAF fired.');
          }
      });

      // if (currentEditor.isEditable) {
      //     currentEditor.commands.setContent(generatedContent, false, {
      //       preserveWhitespace: 'full',
      //       transactionData: { meta: { isSyncingContent: true } }, // Add meta flag
      //     });
      //     // console.log('[SyncEffect] setContent command executed.');
      // } else {
      //     console.warn('[SyncEffect] Editor not editable, skipping setContent.');
      // }
    }
  }, [actionsState, editorInstance, generateTiptapContent]); // Add generateTiptapContent dependency


  // --- Handle Suggestion Selection ---
  const handleSelect = useCallback((selectedItem) => {
    console.log(`[handleSelect] Selecting item: ${selectedItem}`);
    if (!selectedItem) return;

    const currentSuggestionState = suggestionStateRef.current;
    if (currentSuggestionState.editingNodeId) {
      // If editing inline, commit the edit with the selected word
      // Find the ActionNodeView's handleCommitEdit function instance? This is tricky.
      // For now, directly update the state, assuming handleCommitEdit in NodeView will handle the visual part if needed (or sync takes over)
      // console.log(`[handleSelect] Inline edit mode. Updating word for node ${currentSuggestionState.editingNodeId} to ${selectedItem}`);
      // updateActionWord(currentSuggestionState.editingNodeId, selectedItem); // Requires updateActionWord to be defined
      console.warn('[handleSelect] Inline edit selection handling needs updateActionWord (Step 5)');
       setSuggestionState(prev => ({ ...prev, visible: false, forceVisible: false, editingNodeId: null }));
    } else {
      // If not editing inline, add a new action
      addAction(selectedItem, defaultQualifierRef.current);
    }

    // Focus editor after selection
    editorInstanceRef.current?.commands.blur(); // Blur editor after selection/creation
  }, [addAction]); // Add updateActionWord here when implemented


  // --- Suggestion Navigation Handlers ---
  const handleNavUp = useCallback(() => {
    setSuggestionState(prev => {
      if (!prev.visible || !prev.items || prev.items.length === 0) return prev;
      const newIndex = prev.selectedIndex <= 0 ? prev.items.length - 1 : prev.selectedIndex - 1;
      // console.log('[handleNavUp] New index:', newIndex);
      return { ...prev, selectedIndex: newIndex };
    });
  }, []);

  const handleNavDown = useCallback(() => {
    setSuggestionState(prev => {
      if (!prev.visible || !prev.items || prev.items.length === 0) return prev;
      const newIndex = prev.selectedIndex >= prev.items.length - 1 ? 0 : prev.selectedIndex + 1;
      // console.log('[handleNavDown] New index:', newIndex);
      return { ...prev, selectedIndex: newIndex };
    });
  }, []);

  const handleCloseSuggestion = useCallback(() => {
    // console.log('[handleCloseSuggestion] Hiding suggestions');
    setSuggestionState(prev => ({ ...prev, visible: false, query: '', selectedIndex: -1, highlightedIndices: [] }));
    editorInstanceRef.current?.commands.blur(); // Blur editor instead
  }, []);

  const handleSelectByIndex = useCallback(() => {
    const { selectedIndex, items, visible } = suggestionStateRef.current;
    if (visible && selectedIndex >= 0 && items && items.length > selectedIndex) {
      const selectedItem = items[selectedIndex];
      // console.log(`[handleSelectByIndex] Selecting item at index ${selectedIndex}: ${selectedItem}`);
      handleSelect(selectedItem);
      return true; // Indicate selection happened
    }
    return false; // Indicate no selection happened
  }, [handleSelect]);


  // Provide context value
  const hintContextValue = useMemo(() => ({
    showHint,
    hideHint,
    onActionWordChanged: (nodeId, newWord) => {
      // console.log('Context: onActionWordChanged called', nodeId, newWord);
      // Placeholder: Implement Step 5 later
    },
    updateActionQualifier, // Pass the actual function
    updateActionWord: (nodeId, newWord) => {
        // Placeholder: Implement Step 5 later
    },
    deleteAction: (nodeId) => {
        // Placeholder: Implement Step 6 later
    },
    setSuggestionState,
    registeredActions, // Pass down registered actions for filtering
    suggestionStateRef, // Pass the ref
    qualifierOptions, // Pass qualifier options down
    onQualifierChanged: onQualifierChangedRef.current, // Pass stable ref
    onActionDeleted: onActionDeletedRef.current,     // Pass stable ref
    defaultQualifier: defaultQualifierRef.current,   // Pass stable ref
    // --- New additions for state management ---
    actionsState: actionsStateRef.current, // Provide current state via ref if needed downstream (use cautiously)
    addAction,
    // updateActionQualifier: (nodeId, newQualifier) => {
    //     console.log(\'[HintContext] updateActionQualifier called\', nodeId, newQualifier);
    //     updateActionQualifier(nodeId, newQualifier);
    // },
  }), [
    showHint, hideHint, registeredActions, qualifierOptions,
    suggestionStateRef, setSuggestionState,
    actionsStateRef, addAction, updateActionQualifier // Removed generateTiptapContent
]);

  // --- Configure Extensions ---
  const wordSuggestionExtension = useMemo(() => {
    return WordSuggestionExtension.configure({
      getSuggestionState: () => suggestionStateRef.current,
      requestCoordUpdate: () => { setUpdateRequestNonce(n => n + 1); }, // Trigger state update for coords too
      registeredActions,
      defaultQualifier: defaultQualifierRef.current,
      editorContainerRef,
      requestStateUpdate: (reason) => { setUpdateRequestNonce(n => n + 1); }, // Trigger state update effect
      handleImplicitCreate: (word, reason) => { console.log('Implicit create triggered but not yet implemented:', word, reason); return false; }, // Placeholder for Step 3
      // --- Pass Navigation Handlers ---
      onNavUp: handleNavUp,
      onNavDown: handleNavDown,
      onCloseSuggestion: handleCloseSuggestion,
      onSelectByIndex: handleSelectByIndex,
      // onSelectSuggestion: handleSelect, // If needed for direct item click selection
    });
  }, [
    registeredActions, defaultQualifierRef, editorContainerRef, // Existing deps
    handleNavUp, handleNavDown, handleCloseSuggestion, handleSelectByIndex // Add new handlers
  ]); // Update dependencies

  const actionNodeExtension = useMemo(() => {
    return ActionNode.configure({
      // No qualifier options needed here anymore as handled by context?
      // qualifierOptions, // Removed, handled by context
      // defaultQualifier: defaultQualifierRef.current // Removed, handled by context
    });
  }, []); // No dependencies needed if options are removed

  const extensions = useMemo(() => [
    StarterKit.configure({ history: true }),
    Placeholder.configure({ placeholder }),
    actionNodeExtension,
    wordSuggestionExtension,
  ], [actionNodeExtension, wordSuggestionExtension, placeholder]);

  // --- Effect to update suggestion state based on Tiptap Plugin --- 
  useEffect(() => {
    const currentEditor = editorInstanceRef.current;
    if (!currentEditor || currentEditor.isDestroyed) return;

    const { state } = currentEditor;
    const { selection } = state;
    const isNodeSelection = selection instanceof NodeSelection && selection.node.type.name === 'actionNode';
    const composing = currentEditor.view.composing;
    const isFocused = currentEditor.isFocused; // Get focus state

    // Get plugin state using the stored key
    const pluginKey = currentEditor.storage?.wordSuggestion?.key;
    const pluginState = pluginKey ? pluginKey.getState(state) : null;

    let shouldBeVisible = false;
    let query = '';
    let coords = null;
    const currentEditingNodeId = suggestionStateRef.current.editingNodeId;

    if (currentEditingNodeId) {
        // Inline edit mode
        const inlineInputEl = editorContainerRef.current?.querySelector(`[data-node-id="${currentEditingNodeId}"] input`);
        if (inlineInputEl) {
             query = inlineInputEl.value;
            coords = calculateCoordsForInput(inlineInputEl);
            shouldBeVisible = true;
        } else {
            // Input not found, maybe node was deleted or edit cancelled
            shouldBeVisible = false;
        }
    } else if (pluginState?.active && selection.empty && !isNodeSelection && !composing) {
        // Regular suggestion mode (plugin is active)
        query = pluginState.query || '';
        if (query.trim()) { // Only show if there's a non-whitespace query
            shouldBeVisible = true;
            // Calculate coords based on cursor position
            try {
                const cursorPos = selection.$head.pos;
                const absoluteCoords = currentEditor.view.coordsAtPos(cursorPos);
                coords = {
                  x: absoluteCoords.left,
                  y: absoluteCoords.bottom + 5, // Position slightly below cursor line (absolute)
                };
            } catch (e) {
                console.warn('[Suggestion Effect] Error calculating coords:', e);
                shouldBeVisible = false; // Hide if coords calculation fails
            }
            } else {
            shouldBeVisible = false; // Hide if query is empty/whitespace
        }
    } else if (isFocused && selection.empty && !isNodeSelection && !composing) {
        // --- NEW: Show suggestions on focus even without plugin active/query ---
        // console.log('[Suggestion Effect] Editor focused, showing all suggestions.');
        shouldBeVisible = true;
        query = ''; // No query in this case
        // Calculate coords based on cursor position
        try {
            const cursorPos = selection.$head.pos;
            const absoluteCoords = currentEditor.view.coordsAtPos(cursorPos);
            coords = {
              x: absoluteCoords.left,
              y: absoluteCoords.bottom + 5, // Position slightly below cursor line (absolute)
            };
        } catch (e) {
            console.warn('[Suggestion Effect - Focus] Error calculating coords:', e);
            shouldBeVisible = false; // Hide if coords calculation fails
        }
    }

    // --- Final Visibility Check --- 
    // Ensure menu is hidden if editor loses focus (unless inline editing)
    if (!isFocused && !currentEditingNodeId) {
      shouldBeVisible = false;
    }

    // --- Calculate highlighted indices based on query --- 
    let highlightedIndices = [];
    if (shouldBeVisible && query) {
        const lowerCaseQuery = query.toLowerCase();
        console.log(`[Suggestion Effect] Query: "${lowerCaseQuery}", Checking against:`, registeredActions); // Log query and list
        registeredActions.forEach((item, index) => {
            if (item.toLowerCase().includes(lowerCaseQuery)) {
                highlightedIndices.push(index);
            }
        });
    } else if (shouldBeVisible && !query) {
        // If visible due to focus but no query, technically all are highlighted (but no specific selection jump)
        // highlightedIndices = registeredActions.map((_, index) => index); // Or keep empty?
        // Let's keep it empty for now, as jump-to-first only makes sense with a query.
    }
    console.log('[Suggestion Effect] Calculated highlightedIndices:', highlightedIndices); // Log indices

    const itemsToShow = registeredActions; // Always use the full list for rendering

    setSuggestionState(prev => {
        // Determine if a state update is actually needed
        const queryChanged = prev.query !== query;
        const visibilityChanged = prev.visible !== shouldBeVisible;
        const highlightedIndicesChanged = JSON.stringify(prev.highlightedIndices) !== JSON.stringify(highlightedIndices);
        const coordsChanged = JSON.stringify(prev.coords) !== JSON.stringify(coords);
        const editingNodeChanged = prev.editingNodeId !== currentEditingNodeId;

        if (!visibilityChanged && !highlightedIndicesChanged && !coordsChanged && !editingNodeChanged && !queryChanged) {
            return prev; // No change needed
        }

        let newSelectedIndex = prev.selectedIndex;

        if (shouldBeVisible && (!prev.visible || queryChanged || highlightedIndicesChanged || !(prev.selectedIndex >= 0 && prev.selectedIndex < itemsToShow.length))) {
            newSelectedIndex = highlightedIndices.length > 0 ? highlightedIndices[0] : -1; // Jump to first highlighted item index, or -1
            console.log(`[Suggestion Effect] Query/Highlight Changed: Setting selectedIndex to: ${newSelectedIndex}`); // Log index update
        }

         // Clear index if not visible
        if (!shouldBeVisible) {
            newSelectedIndex = -1;
        }

        return {
            ...prev,
            visible: shouldBeVisible,
            query: query,
            items: itemsToShow, // Full list
            highlightedIndices: highlightedIndices, // Indices of matching items
            coords: coords,
            selectedIndex: newSelectedIndex,
            editingNodeId: currentEditingNodeId, // Reflect current editing node
            forceVisible: !!currentEditingNodeId, // Keep visible if editing inline
        };
    });

  }, [editorInstance, registeredActions, updateRequestNonce]); // Depend on editor, actions, and the nonce


  // --- Render ---
  // ... existing code ...

  return (
    <HintContext.Provider value={hintContextValue}>
      <div className="relative" ref={editorContainerRef}>
        <EditorProvider
          slotBefore={null}
          slotAfter={null}
          extensions={extensions}
          content={`<p></p>`}
          editorProps={{
            attributes: {
              class: 'prose max-w-full focus:outline-none min-h-[100px] px-4 py-2',
            },
            handleDOMEvents: {
              blur: (view, event) => {
                const { state } = view;
                const { selection } = state;
                if (selection instanceof NodeSelection) {
                    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, selection.from)));
                    // console.log('Node selection cleared on blur');
                }
                return false;
              },
            },
          }}
        >
          <TipTapEditorComponent setEditor={setEditorInstance} editorInstanceRef={editorInstanceRef} />
        </EditorProvider>

        {suggestionState.visible && suggestionState.coords &&
          ReactDOM.createPortal(
            <div
              className="fixed z-50"
              style={{
                top: suggestionState.coords.y,
                left: suggestionState.coords.x
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <SuggestionList
                items={suggestionState.items}
                selectedIndex={suggestionState.selectedIndex}
                highlightedIndices={suggestionState.highlightedIndices || []}
                onSelect={handleSelect}
                coords={suggestionState.coords}
              />
            </div>,
            document.body
          )
        }
      </div>
    </HintContext.Provider>
  );
};

export default ActionEditorComponent; 