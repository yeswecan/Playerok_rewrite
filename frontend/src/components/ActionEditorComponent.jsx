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
       'contenteditable': 'false',
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

  // Ensure it's treated as a single block
  atom: true,
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
  const { showHint, hideHint, updateActionWord, onActionDeleted, updateActionQualifier, setSuggestionState, registeredActions, suggestionStateRef, editorContainerRef, editingNodeId } = hintContext;
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

  // --- Add Effect to calculate and set coords for inline editing ---
  useEffect(() => {
      if (isEditing && inputRef.current && editorContainerRef?.current) {
          const inputRect = inputRef.current.getBoundingClientRect();
          const containerRect = editorContainerRef.current.getBoundingClientRect();

          // Calculate position relative to the document body for the portal
          const portalCoords = {
              x: inputRect.left + window.scrollX,
              y: inputRect.bottom + window.scrollY + 5, // Position below the input
              // Additional coords if needed for positioning logic (like calculateSuggestionPosition)
              inputBottom: inputRect.bottom,
              inputTop: inputRect.top,
              inputLeft: inputRect.left,
          };

          // console.log('[ActionNodeView Effect] Calculated inline edit coords:', portalCoords);

          // Update suggestion state with new coords and make visible
          setSuggestionState(prev => ({
              ...prev,
              coords: portalCoords,
              visible: true, // Make visible now that coords are calculated
          }));
      }
  }, [isEditing, editorContainerRef, setSuggestionState]); // Dependencies

  // --- Add Effect to automatically close editor if context changes ---
  useEffect(() => {
    if (isEditing && editingNodeId !== nodeId) {
      // console.log(`[ActionNodeView Effect] Context changed editingNodeId (${editingNodeId}), closing editor for node ${nodeId}`);
      setIsEditing(false);
      // Optionally reset internal suggestion state if needed, although handleCommitEdit/updateActionWord should handle central state
    }
  }, [isEditing, editingNodeId, nodeId]);

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
      hintContext.updateActionWord(node.attrs.nodeId, newWord); // Use context function
      // console.log('[handleCommitEdit] Called hintContext.updateActionWord');
    } else {
      // console.log('[handleCommitEdit] No changes detected or word is empty. Reverting or keeping original.');
      // If the word is empty, maybe delete the node? Or revert? For now, just close editing.
      if (!newWord) {
//        console.warn('[handleCommitEdit] Word is empty. Edit cancelled.');
      }
    }
    setIsEditing(false);
    // Clear suggestion state fully when editing stops
    setSuggestionState(prev => ({ ...prev, visible: false, forceVisible: false, editingNodeId: null, coords: null, query: '', items: [], selectedIndex: -1 }));
    editor?.chain()?.focus()?.run(); // Refocus editor after commit
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
        // Directly update state via context, which will also clear editingNodeId
        updateActionWord(nodeId, selectedWord);
        // setIsEditing(false); // Let the useEffect handle closing based on context change
      } else {
        // console.log('[InlineInput Enter Key] Committing current input value:', e.target.value);
        handleCommitEdit(e.target.value); // Commit current input if no suggestion selected
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
      className="action-node-view inline-block bg-gray-100 rounded px-2 py-1 mx-px text-sm border border-gray-300 cursor-pointer"
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
                    // Don't recalculate coords here, rely on the useEffect
                    // console.log('[InlineInput onChange] Updating suggestions query:', query);
                    setSuggestionState(prev => {
                        const filtered = filterSuggestions(query, registeredActions);
                        // Keep existing coords, just update query/items/index
                        return {
                            ...prev,
                            // visible: true, // Keep visibility managed by useEffect/blur
                            // forceVisible: true, // Keep visibility managed by useEffect/blur
                            query,
                            items: registeredActions, // Show all items
                            highlightedItems: filtered, // Keep track of items matching query
                            highlightedIndices: filtered.map(item => registeredActions.indexOf(item)).filter(i => i !== -1), // Calculate indices to highlight
                            selectedIndex: filtered.length > 0 ? registeredActions.indexOf(filtered[0]) : -1, // Select first match
                            // coords: prev.coords, // Keep existing coords from effect
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
            contentEditable="false"
            suppressContentEditableWarning={true}
            onDoubleClick={() => {
              // console.log('[DoubleClick] Entering edit mode for node:', nodeId, 'word:', node.textContent);
              originalWordRef.current = node.textContent;
              setIsEditing(true);
              // We need to set the state immediately to trigger the useEffect in ActionNodeView
              const initialQuery = node.textContent;
              setSuggestionState(prev => ({
                  ...prev,
                  editingNodeId: nodeId,
                  query: initialQuery,
                  visible: false, // Initially hidden until coords are calculated
                  forceVisible: true, // Flag to indicate inline edit mode
                  coords: null, // Reset coords
                  items: registeredActions,
                  highlightedIndices: filterSuggestions(initialQuery, registeredActions).map(item => registeredActions.indexOf(item)).filter(i => i !== -1),
                  selectedIndex: filterSuggestions(initialQuery, registeredActions).map(item => registeredActions.indexOf(item)).filter(i => i !== -1)[0] ?? -1,
              }));

              // Focus the input after the state update allows it to render
              setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
                // Coords are calculated in the useEffect now
              }, 0);
            }}
            onMouseDown={(e) => {
                // Prevent single click from placing cursor or triggering unwanted focus inside the text span
                // Ensure no preventDefault() here
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
            contentEditable="false"
            suppressContentEditableWarning={true}
          >
            <span className="mr-0.5">{selectedOptionLabel}</span>
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          </button>
          {isOpen && (
              <div
                className="absolute top-full left-0 mt-1 w-32 bg-white shadow-lg rounded-md border border-gray-200 z-50"
                onMouseDown={(e) => {
                  // No preventDefault() here
                }}
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
              // Deletion is now handled by handleDocumentChange synchronizing state
              deleteNode(); // Still need this to trigger the update event for handleDocumentChange
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
      // handleImplicitCreate: (word, reason) => { console.warn('[WordSuggestionExtension] handleImplicitCreate not configured!', word, reason); return false; }, // Keep warn?
      showSuggestionsOnFocus: () => {}, // New function to show suggestions on focus
      hideSuggestionsOnBlur: () => {}, // New function to hide suggestions on blur
      onNavUp: () => {}, // Placeholder
      onNavDown: () => {}, // Placeholder
      onCloseSuggestion: () => {}, // Placeholder
      onSelectByIndex: () => false, // Placeholder, return false
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
                        // Log warning only if necessary, maybe add details
                        // console.warn("[WordSuggestionPlugin apply] Skipping range calculation: $from.parent is missing or has no content.", { fromPos: $from.pos, parentExists: !!$from.parent });
                        next.active = false;
                        next.range = null;
                    }
                }
                // --- End Refined State Logic ---

                // --- Implicit creation on move/selection --- 
                if (prev.active && 
                    !next.active && 
                    next.query !== '' && // Add check: Only trigger if the *resulting* query is NOT empty
                    prev.query && 
                    prev.query.trim() && 
                    !isNodeSelection && 
                    !meta.fromSuggestionSelect && 
                    !meta.justConvertedExplicitOrSpace && 
                    !meta.justConvertedImplicit 
                ) {
                    const trimmedPrevQuery = prev.query.trim();
                    // console.log(`[WordSuggestionExtension Apply] Implicit Create Triggered (Move/Selection Change): Word='${trimmedPrevQuery}'`);
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
                // console.log('[WordSuggestionExtension Apply] Skipping core logic due to isSyncingContent meta flag.');
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
        props: {
          // We need to listen to transactions to catch implicit creation confirmations
          handleTextInput(view, from, to, text) {
            // Allow default behavior
            return false;
          },
        },
      }),
    ];
  },

  onFocus({ editor }) {
    // console.log('[WordSuggestionExtension:onFocus] Fired.');
    this.options.showSuggestionsOnFocus(); // Call the function passed from ActionEditorComponent
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
        if (visible && selectedIndex >= 0) {
            return this.options.onSelectByIndex();
        }
        // Otherwise (not visible or no selection), attempt implicit creation
        else {
            const created = this.options.handleImplicitCreate(null, 'enter'); // Pass null for word, handler will extract
            return created; // Consume Enter only if creation happened
        }
      },
      Escape: () => {
        const { visible } = this.options.getSuggestionState();
        if (!visible) return false;
        this.options.onCloseSuggestion();
        return true; // Consume event
      },
      // Previous Space shortcut logic (handleImplicitCreate) needs to be reimplemented here in Step 3
      Space: () => {
//          console.log('[WordSuggestionExtension Space Shortcut] Entered.');
          // Check the REACT state for suggestion visibility
          const { visible, selectedIndex } = this.options.getSuggestionState();
//          console.log('[WordSuggestionExtension Space Shortcut] Suggestion state:', { visible, selectedIndex });

          // If suggestions are visible AND an item is selected, don't trigger implicit creation
          if (visible && selectedIndex >= 0) {
//              console.log('[WordSuggestionExtension Space Shortcut] Suggestions visible and item selected, but prioritizing implicit creation.');
              // No longer returning false here. Proceed to attempt creation.
          }

          // Otherwise, attempt implicit creation
//          console.log('[WordSuggestionExtension Space Shortcut] Attempting implicit creation...');

          // Pass null for word, handler will extract
          const created = this.options.handleImplicitCreate(null, 'space');
//          console.log('[WordSuggestionExtension Space Shortcut] handleImplicitCreate returned:', created);
          // Consume space ONLY if creation happened.
          // If created is false, return false to allow default space insertion.
          return created;
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

    // Check if blur is going towards the suggestion list or an action node's interactive parts
    if (relatedTarget && (relatedTarget.closest('.suggestion-list') || relatedTarget.closest('.inline-block[data-node-id]'))) {
        // console.log('[WordSuggestionExtension:onBlur] Blur target is suggestion list or node view, not hiding.');
        // Don't hide if focus is moving to the suggestion list or node itself
    } else {
      // Otherwise, call the dedicated hide function
      // console.log('[WordSuggestionExtension:onBlur] Calling hideSuggestionsOnBlur.');
      this.options.hideSuggestionsOnBlur();

      // Implicit creation logic might still be needed here, depending on requirements
      // For now, focus is on fixing the hide-on-blur behavior.
      this.options.handleImplicitCreate(null, 'blur');
    }
    // Remove unconditional state updates
    // this.options.requestStateUpdate('blur_event');
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

  const suggestionListRef = useRef(null); // Define the ref for the suggestion list container

  // --- Step 3: Analytical Comparison Function ---
  const findUntrackedTextSegments = useCallback((editorJson, currentActionsState) => {
//    console.log('[findUntrackedTextSegments] Comparing Tiptap JSON:', JSON.stringify(editorJson), 'against actionsState:', currentActionsState);
    const untrackedSegments = [];
    const knownNodeIds = new Set(currentActionsState.map(a => a.id));

    const paragraphContent = editorJson?.content?.[0]?.content || [];
//    console.log('[findUntrackedTextSegments] Raw Paragraph Content:', JSON.stringify(paragraphContent));

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
//                    console.log(`[findUntrackedTextSegments] Found untracked segment (before node): "${trimmedText}"`);
                }
                currentTextSegment = '';
                segmentStartIndex = -1;
            }
            if (!knownNodeIds.has(node.attrs?.nodeId)) {
//                console.warn(`[findUntrackedTextSegments] Found unknown actionNode in Tiptap content: ID ${node.attrs?.nodeId}`);
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
//                    console.log(`[findUntrackedTextSegments] Found untracked segment (trailing): "${trimmedText}"`);
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
//            console.log(`[findUntrackedTextSegments] Found untracked segment (trailing): "${trimmedText}"`);
        }
    }
//    console.log('[findUntrackedTextSegments] Final Identified Segments:', untrackedSegments);
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
//    console.log('[ActionEditorComponent] Adding action:', newAction);
    setActionsState(prev => [...prev, newAction]);
    onActionCreatedRef.current?.(newAction.id, newAction.word, newAction.qualifier);
    // Clear suggestion state after adding
    setSuggestionState(prev => ({ ...prev, visible: false, query: '', items: [], selectedIndex: -1, editingNodeId: null, inserting: false }));
    setTimeout(() => preventImplicitCreationRef.current = false, 0);
  }, [defaultQualifierRef]); // Dependencies: only things that don't change often


  const updateActionQualifier = useCallback((nodeId, newQualifier) => {
    preventImplicitCreationRef.current = true; // Prevent sync loop
//    console.log('[ActionEditorComponent] Updating qualifier for node:', nodeId, 'to:', newQualifier);
    setActionsState(prev => prev.map(action =>
        action.id === nodeId ? { ...action, qualifier: newQualifier } : action
    ));
    onQualifierChangedRef.current?.(nodeId, newQualifier);
    setTimeout(() => preventImplicitCreationRef.current = false, 0);
  }, []); // Empty dependency array as it doesn't depend on changing props/state


  const updateActionWord = useCallback((nodeId, newWord) => {
    if (!newWord) return; // Don't update to an empty word
    preventImplicitCreationRef.current = true; // Prevent sync loop
//    console.log('[ActionEditorComponent] Updating word for node:', nodeId, 'to:', newWord);
    setActionsState(prev => prev.map(action =>
        action.id === nodeId ? { ...action, word: newWord } : action
    ));
    onActionWordChangedRef.current?.(nodeId, newWord);
    // Clear suggestion state after committing inline edit
    setSuggestionState(prev => ({ ...prev, visible: false, forceVisible: false, editingNodeId: null }));
    setTimeout(() => preventImplicitCreationRef.current = false, 0);
  }, []); // Empty dependency array


  // --- Helper: Convert actionsState to Tiptap content ---
  const generateTiptapContent = useCallback((actions) => {
    const actionNodesContent = (actions || []).flatMap((action) => {
       if (!action || typeof action.word !== 'string' || typeof action.id !== 'string' || typeof action.qualifier !== 'string') {
//           console.warn('[generateTiptapContent] Skipping invalid action state item:', action);
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

  // --- Effect to Synchronize Deletions from Tiptap -> React State ---
  useEffect(() => {
    const currentEditor = editorInstanceRef.current;
    if (!currentEditor || currentEditor.isDestroyed) {
      return;
    }

    const handleDocumentChange = ({ transaction }) => {
      // Ignore transactions triggered by our own state sync or those without doc changes
      if (transaction.getMeta('isSyncingContent') || !transaction.docChanged) {
          // console.log('[handleDocumentChange] Skipping sync transaction or no doc change.');
        return;
      }

      // console.log('[handleDocumentChange] Doc changed, checking for deletions...');

      const currentEditorNodeIds = new Set();
      currentEditor.state.doc.descendants((node) => {
        if (node.type.name === 'actionNode') {
            if (node.attrs.nodeId) {
                 currentEditorNodeIds.add(node.attrs.nodeId);
            } else {
//                console.warn('[handleDocumentChange] Found actionNode without nodeId attribute.');
            }
        }
      });
      // console.log('[handleDocumentChange] Node IDs currently in editor:', currentEditorNodeIds);

      const currentStateIds = new Set(actionsStateRef.current.map(a => a.id));
      // console.log('[handleDocumentChange] Node IDs currently in React state:', currentStateIds);

      const deletedIds = [...currentStateIds].filter(id => !currentEditorNodeIds.has(id));

      if (deletedIds.length > 0) {
//        console.log('[handleDocumentChange] Detected deleted action node IDs:', deletedIds);
        preventImplicitCreationRef.current = true; // Prevent potential race condition with implicit creation
        setActionsState(prev => prev.filter(action => currentEditorNodeIds.has(action.id)));
        deletedIds.forEach(id => {
            onActionDeletedRef.current?.(id);
        });
        // Release the lock shortly after
        setTimeout(() => preventImplicitCreationRef.current = false, 50); 
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
//    console.log(`[handleSelect] Selecting item: ${selectedItem}`);
    if (!selectedItem) return;

    const currentSuggestionState = suggestionStateRef.current;
    if (currentSuggestionState.editingNodeId) {
      // If editing inline, commit the edit with the selected word
      // Find the ActionNodeView's handleCommitEdit function instance? This is tricky.
      // For now, directly update the state, assuming handleCommitEdit in NodeView will handle the visual part if needed (or sync takes over)
      // console.log(`[handleSelect] Inline edit mode. Updating word for node ${currentSuggestionState.editingNodeId} to ${selectedItem}`);
      // updateActionWord(currentSuggestionState.editingNodeId, selectedItem); // Requires updateActionWord to be defined
      // console.warn('[handleSelect] Inline edit selection handling needs updateActionWord (Step 5)');
      updateActionWord(currentSuggestionState.editingNodeId, selectedItem); // Use the newly defined function
       setSuggestionState(prev => ({ ...prev, visible: false, forceVisible: false, editingNodeId: null }));
    } else {
      // If not editing inline, add a new action
      addAction(selectedItem, defaultQualifierRef.current);
    }

    // Focus editor after selection
    editorInstanceRef.current?.commands.blur(); // Blur editor after selection/creation
  }, [addAction, updateActionWord]); // Add updateActionWord dependency


  // --- Step 3: Central Trigger Handler ---
  const checkAndTriggerImplicitCreation = useCallback((triggerReason = 'unknown') => {
    const currentEditor = editorInstanceRef.current;
    if (!currentEditor || currentEditor.isDestroyed || preventImplicitCreationRef.current) {
//        console.log('[checkAndTriggerImplicitCreation] Skipped: Editor not ready, destroyed, or prevention flag set.');
        return false;
    }

    const currentJson = currentEditor.getJSON();
    const currentActions = actionsStateRef.current; // Use ref for current state

//    console.log('[checkAndTriggerImplicitCreation] Triggered by:', triggerReason);
    const untracked = findUntrackedTextSegments(currentJson, currentActions);

    // Simplification: Assume the last untracked text segment is the one to convert.
    // Refine later with cursor position if needed.
    const wordToConvert = untracked.length > 0 ? untracked[untracked.length - 1].text : null;

    if (wordToConvert) {
//        console.log('[checkAndTriggerImplicitCreation] Decided to convert word:', wordToConvert);
        addAction(wordToConvert, defaultQualifierRef.current); // Use the existing addAction
        // Ensure suggestion state is cleared after implicit creation
        setSuggestionState(prev => ({ ...prev, visible: false, query: '', items: [], selectedIndex: -1, editingNodeId: null, inserting: false }));
        return true; // Indicate creation happened
    } else {
//        console.log('[checkAndTriggerImplicitCreation] No conversion needed.');
        return false;
    }
  }, [addAction, findUntrackedTextSegments, defaultQualifierRef]); // Added dependencies


  // --- NEW: Function to show suggestions specifically on focus ---
  const showSuggestionsOnFocus = useCallback(() => {
    const currentEditor = editorInstanceRef.current;
    if (!currentEditor || currentEditor.isDestroyed || currentEditor.isFocused === false) {
//        console.log('[showSuggestionsOnFocus] Editor not ready or not focused.');
        return; // Don't show if not focused
    }

    const { state } = currentEditor;
    const { selection } = state;
    const isNodeSelection = selection instanceof NodeSelection && selection.node.type.name === 'actionNode';
    const composing = currentEditor.view.composing;

    // Only proceed if cursor is empty, not selecting node, not composing
    if (selection.empty && !isNodeSelection && !composing) {
      // console.log('[showSuggestionsOnFocus] Conditions met, calculating coords...');
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
          const highlightedIndices = registeredActions.map((_, index) => index); // Highlight all initially

          setSuggestionState(prev => ({
            ...prev,
            visible: true,
            query: '', // No query on initial focus
            items: registeredActions,
            highlightedIndices: highlightedIndices,
            coords: coords,
            selectedIndex: -1, // No initial selection
            editingNodeId: null,
            forceVisible: false,
            finalPosition: finalPosition,
          }));
          // console.log('[showSuggestionsOnFocus] Suggestion state updated.');
      } catch (e) {
//          console.warn('[showSuggestionsOnFocus] Error calculating coords:', e);
          setSuggestionState(prev => ({ ...prev, visible: false })); // Hide on error
      }
    } else {
//        console.log('[showSuggestionsOnFocus] Conditions not met (selection not empty, node selected, or composing).');
    }
  }, [registeredActions]); // Dependencies


  // --- NEW: Function to hide suggestions on blur (if not inline editing) ---
  const hideSuggestionsOnBlur = useCallback(() => {
    // Use timeout to allow potential focus shifts (e.g., to suggestion list) to register first
    setTimeout(() => {
      if (suggestionStateRef.current.editingNodeId === null) {
        // console.log('[hideSuggestionsOnBlur] Hiding suggestions (not inline editing).');
        setSuggestionState(prev => ({ ...prev, visible: false }));
      } else {
        // console.log('[hideSuggestionsOnBlur] Not hiding (inline editing active).');
      }
    }, 100); // Small delay
  }, []); // No dependencies needed


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


  // --- Inline Edit State Management ---
  const startInlineEdit = useCallback((nodeId, initialQuery) => {
//    console.log(`[ActionEditorComponent] Starting inline edit for node ${nodeId}`);
    // Need to calculate coords *after* NodeView renders input
    setSuggestionState(prev => ({
      ...prev,
      editingNodeId: nodeId,
      query: initialQuery,
      visible: false, // Keep hidden until coords are calculated
      forceVisible: true,
      coords: null, // Reset coords
      items: registeredActions, // Pre-populate items
      highlightedIndices: filterSuggestions(initialQuery, registeredActions).map(item => registeredActions.indexOf(item)).filter(i => i !== -1),
      selectedIndex: filterSuggestions(initialQuery, registeredActions).map(item => registeredActions.indexOf(item)).filter(i => i !== -1)[0] ?? -1,
    }));
    // Trigger effect update to calculate coords
    setUpdateRequestNonce(n => n + 1);
  }, [registeredActions]);

  const stopInlineEdit = useCallback(() => {
//    console.log(`[ActionEditorComponent] Stopping inline edit`);
    setSuggestionState(prev => ({
      ...prev,
      editingNodeId: null,
      visible: false,
      forceVisible: false,
      coords: null,
      query: '',
    }));
  }, []);


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
    editorContainerRef, // Pass the editor container ref down
    onQualifierChanged: onQualifierChangedRef.current, // Pass stable ref
    onActionDeleted: onActionDeletedRef.current,     // Pass stable ref
    defaultQualifier: defaultQualifierRef.current,   // Pass stable ref
    // --- New additions for state management ---
    actionsState: actionsStateRef.current, // Provide current state via ref if needed downstream (use cautiously)
    addAction,
    updateActionQualifier,
    updateActionWord,
    // --- Inline Edit Management ---
    editingNodeId: suggestionState.editingNodeId, // Pass current editing ID
    startInlineEdit,
    stopInlineEdit,
    requestStateUpdate: (reason) => setUpdateRequestNonce(n => n + 1), // Pass nonce trigger
    checkAndTriggerImplicitCreation, // Pass the new handler
  }), [
    showHint, hideHint, registeredActions, qualifierOptions,
    suggestionStateRef, setSuggestionState,
    actionsStateRef, addAction, updateActionQualifier, updateActionWord,
    suggestionState.editingNodeId, startInlineEdit, stopInlineEdit,
    editorContainerRef,
    onQualifierChangedRef, onActionDeletedRef, defaultQualifierRef,
    checkAndTriggerImplicitCreation
  ]);

  // --- Configure Extensions ---
  const wordSuggestionExtension = useMemo(() => {
    return WordSuggestionExtension.configure({
      getSuggestionState: () => suggestionStateRef.current,
      requestCoordUpdate: () => { setUpdateRequestNonce(n => n + 1); },
      registeredActions,
      defaultQualifier: defaultQualifierRef.current,
      editorContainerRef,
      handleImplicitCreate: (word, reason) => checkAndTriggerImplicitCreation(reason), // Correctly map args
      showSuggestionsOnFocus: showSuggestionsOnFocus, // Pass the new function
      hideSuggestionsOnBlur: hideSuggestionsOnBlur, // Pass the blur handler
      // --- Pass Navigation Handlers ---
      onNavUp: handleNavUp,
      onNavDown: handleNavDown,
      onCloseSuggestion: handleCloseSuggestion,
      onSelectByIndex: handleSelectByIndex,
      // onSelectSuggestion: handleSelect, // If needed for direct item click selection
    });
  }, [
    registeredActions, defaultQualifierRef, editorContainerRef,
    handleNavUp, handleNavDown, handleCloseSuggestion, handleSelectByIndex,
    showSuggestionsOnFocus, hideSuggestionsOnBlur, // Add new dependency
    checkAndTriggerImplicitCreation // Add the new handler
  ]);

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

    const pluginKey = currentEditor.storage?.wordSuggestion?.key;
    const pluginState = pluginKey ? pluginKey.getState(state) : null;

    let shouldBeVisible = false;
    let query = '';
    let coords = null;
    const currentEditingNodeId = suggestionStateRef.current.editingNodeId;
    const currentCoords = suggestionStateRef.current.coords;
    let forceVisible = suggestionStateRef.current.forceVisible; // Get current forceVisible state

    // --- Refined Visibility Logic ---
    if (currentEditingNodeId) {
      // --- Inline edit mode ---
      query = suggestionStateRef.current.query || '';
      coords = currentCoords; // Coords set by ActionNodeView effect
      shouldBeVisible = forceVisible && !!coords;
       // console.log(`[Suggestion Effect - Inline] Node: ${currentEditingNodeId}, Coords: ${!!coords}, forceVisible: ${forceVisible}, shouldBeVisible: ${shouldBeVisible}`);

    } else if (isFocused && !composing) {
      // --- Regular editor mode (focused, not composing) ---
      // Check if selection is inside or is an action node
      const pluginIsActive = pluginState?.active === true;
      const parentIsAction = !selection.empty && selection.$head.parent.type.name === 'actionNode';

      if (isNodeSelection || parentIsAction) {
          // Don't show suggestions if node is selected or cursor is inside one
          shouldBeVisible = false;
          coords = null;
          forceVisible = false;
          query = '';
      } else if (selection.empty) {
          // Show suggestions if cursor is empty and not in/selecting a node
          shouldBeVisible = true;
          query = pluginState?.query || ''; // Use plugin query if available (empty if just placed cursor)
          coords = null; 
          // Try calculating coords
          try {
              const cursorPos = selection.$head.pos;
              const absoluteCoords = currentEditor.view.coordsAtPos(cursorPos);
              coords = {
                  x: absoluteCoords.left,
                  y: absoluteCoords.bottom + 5,
                  inputBottom: absoluteCoords.bottom,
                  inputTop: absoluteCoords.top,
                  inputLeft: absoluteCoords.left,
              };
          } catch (e) {
              // console.warn('[Suggestion Effect] Error calculating coords:', e);
              shouldBeVisible = false; // Hide if coords fail
              coords = null;
          }
          forceVisible = false;
      } else {
          // Selection is not empty (text range selected), hide suggestions
          shouldBeVisible = false;
          coords = null;
          forceVisible = false;
          query = '';
      }
    } else {
      // --- Hide (Not focused, or composing, and not inline editing) ---
      shouldBeVisible = false;

    }
    // --- End Refined Visibility Logic ---

    // --- Calculate highlighted indices based on query ---
    let highlightedIndices = [];
    if (shouldBeVisible) {
      const lowerCaseQuery = String(query || '').toLowerCase();
      registeredActions.forEach((item, index) => {
          if (item.toLowerCase().includes(lowerCaseQuery)) {
              highlightedIndices.push(index);
          }
      });
    }
    // console.log('[Suggestion Effect] Calculated highlightedIndices:', highlightedIndices);

    const itemsToShow = registeredActions;

    const finalPosition = calculateSuggestionPosition(coords);

    // --- Update State (Removed skip logic) ---
    setSuggestionState(prev => {
        const queryChanged = prev.query !== query;
        const visibilityChanged = prev.visible !== shouldBeVisible;
        const highlightedIndicesChanged = JSON.stringify(prev.highlightedIndices) !== JSON.stringify(highlightedIndices);
        const coordsChanged = JSON.stringify(prev.coords) !== JSON.stringify(coords);
        const editingNodeChanged = prev.editingNodeId !== currentEditingNodeId;
        const finalPositionChanged = JSON.stringify(prev.finalPosition) !== JSON.stringify(finalPosition);
        const currentForceVisible = !!currentEditingNodeId && forceVisible;
        const forceVisibleChanged = prev.forceVisible !== currentForceVisible;

        if (!visibilityChanged && !highlightedIndicesChanged && !coordsChanged && !editingNodeChanged && !queryChanged && !finalPositionChanged && !forceVisibleChanged) {
            // console.log('[Suggestion Effect] No change detected');
            return prev;
        }

        let newSelectedIndex = prev.selectedIndex;
        if (visibilityChanged || (shouldBeVisible && (queryChanged || highlightedIndicesChanged))) {
             newSelectedIndex = highlightedIndices.length > 0 ? highlightedIndices[0] : -1;
             // console.log(`[Suggestion Effect] Visibility/Query/Highlight Changed: Setting selectedIndex to: ${newSelectedIndex}`);
        } else if (!shouldBeVisible) {
            newSelectedIndex = -1;
        }

        // console.log(`[Suggestion Effect] Updating State: visible=${shouldBeVisible}, query="${query}", itemsCount=${itemsToShow.length}, highlightedCount=${highlightedIndices.length}, selectedIndex=${newSelectedIndex}, editingNodeId=${currentEditingNodeId}, forceVisible=${currentForceVisible}`);

        return {
            ...prev,
            visible: shouldBeVisible,
            query: query,
            items: itemsToShow,
            highlightedIndices: highlightedIndices,
            coords: coords,
            selectedIndex: newSelectedIndex,
            editingNodeId: currentEditingNodeId,
            forceVisible: currentForceVisible,
            finalPosition: finalPosition,
        };
    });

  }, [editorInstance, registeredActions, updateRequestNonce]); // Removed startInlineEdit dependency


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
              className="suggestion-list-portal fixed z-50"
              style={{
                 top: suggestionState.coords?.y || 0, // Revert to using coords directly
                 left: suggestionState.coords?.x || 0, // Revert to using coords directly
                 opacity: suggestionState.visible ? 1 : 0, // Control visibility via opacity
                 pointerEvents: suggestionState.visible ? 'auto' : 'none' // Control interaction
              }}
              onMouseDown={(e) => e.preventDefault()}
              ref={suggestionListRef} // Add a ref to the list container
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


// Helper outside component to avoid re-creation
const SUGGESTION_LIST_MAX_HEIGHT = 240; // Corresponds to max-h-60 in Tailwind
const SUGGESTION_LIST_MARGIN = 10; // Extra margin for spacing

function calculateSuggestionPosition(coords) {
  if (!coords) return { top: 0, left: 0 };

  const spaceBelow = window.innerHeight - coords.inputBottom;
  const spaceAbove = coords.inputTop;

  let top;
  if (spaceBelow >= SUGGESTION_LIST_MAX_HEIGHT + SUGGESTION_LIST_MARGIN || spaceBelow >= spaceAbove) {
    // Position below
    top = coords.y; // Already includes small offset
  } else {
    // Position above
    top = coords.top - SUGGESTION_LIST_MAX_HEIGHT; // Use the calculated 'top' coord and subtract estimated height
  }

  return {
    top: `${Math.max(0, top)}px`, // Ensure it doesn't go off-screen top
    left: `${coords.x}px`,
  };
} 