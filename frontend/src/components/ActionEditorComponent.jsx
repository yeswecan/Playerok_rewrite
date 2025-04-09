import React, { useState, useCallback, useEffect, createContext, useContext, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { EditorProvider, useCurrentEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Node, mergeAttributes, Extension } from '@tiptap/core';
import { ChevronDown } from 'lucide-react';
import SuggestionList from './SuggestionList.jsx';
import { TextSelection } from '@tiptap/pm/state';
import { Plugin, PluginKey, NodeSelection } from 'prosemirror-state';

// --- Hint Context ---
export const HintContext = createContext({
    showHint: (rect, word) => {},
    hideHint: () => {},
    onActionWordChanged: (nodeId, newWord) => {},
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
        tag: 'span[data-type="action-node"]',
        getAttrs: domNode => {
            if (!(domNode instanceof Element)) return false;
            const id = domNode.getAttribute('data-node-id') || `action_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            return {
              qualifier: domNode.getAttribute('data-qualifier'),
              nodeId: id,
            };
        },
        contentElement: 'span.action-word-content',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
     return [
        'span',
        mergeAttributes(HTMLAttributes, { 'data-type': 'action-node' }),
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
                console.log('[ActionNode Backspace Shortcut] Node is empty, allowing default backspace (delete node).');
                return false;
            }
             console.log('[ActionNode Backspace Shortcut] Cursor at start of non-empty node, preventing default backspace.');
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
    console.log(`Qualifier changed for ${nodeId} to ${newQualifierId}`)
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
      handleQualifierChange(id);
      onQualifierChanged(nodeId, id);
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
    // This function hides the suggestion menu by setting visible to false
    editor?.commands?.focus?.();
    editor?.chain()?.focus()?.run();
    if (editor?.view?.dispatch) {
      editor.view.dispatch(editor.state.tr.setMeta('suggestion-hide', true));
    }
    // Also, if suggestion state is in context or prop, set it hidden here
    // For now, assume menu hides on blur or explicit hide elsewhere
  }
function handleCommitEdit(eventOrValue) {
  const newWord = (typeof eventOrValue === 'string' ? eventOrValue : eventOrValue.target.value).trim();
  console.log('[DEBUG][handleCommitEdit] Received value:', newWord);
    console.log('[handleCommitEdit] Received value:', newWord);
    if (newWord && newWord !== node.textContent) {
      try {
        const pos = getPos();
        if (typeof pos === 'number') {
          editor
            .chain()
            .focus()
            .insertContentAt(
              { from: pos + 1, to: pos + node.nodeSize - 1 },
              { type: 'text', text: newWord }
            )
            .run();
          console.log('[DEBUG][handleCommitEdit] Tiptap chain executed.');
        }
        onActionWordChanged(node.attrs.nodeId, newWord);
      } catch (err) {
        console.error('Error updating ActionNode word:', err);
      }
    }
    setIsEditing(false);
    setSuggestionState(prev => ({ ...prev, visible: false, forceVisible: false }));
    hideSuggestionMenu();
    editor?.commands?.blur();
  }

  function handleKeyDown(e) {
    const key = e.key;
    const refState = suggestionStateRef.current || { highlightedItems: [], selectedIndex: -1, items: registeredActions || [] }; // Get current state from ref
    const fullItems = refState.items || []; // Full list of actions
    const maxIndex = fullItems.length > 0 ? fullItems.length - 1 : -1;

    if (key === 'ArrowDown' || key === 'Down') {
      e.preventDefault();
      setSuggestionState(prev => {
        const currentMaxIndex = (prev.items || []).length - 1;
        const newIndex = prev.selectedIndex < currentMaxIndex ? prev.selectedIndex + 1 : 0;
        console.log('[InlineInput] ArrowDown, newIndex:', newIndex, 'maxIndex:', currentMaxIndex);
        return { ...prev, selectedIndex: newIndex };
      });
    } else if (key === 'ArrowUp' || key === 'Up') {
      e.preventDefault();
      setSuggestionState(prev => {
        const currentMaxIndex = (prev.items || []).length - 1;
        const newIndex = prev.selectedIndex > 0 ? prev.selectedIndex - 1 : currentMaxIndex;
        console.log('[InlineInput] ArrowUp, newIndex:', newIndex, 'maxIndex:', currentMaxIndex);
        return { ...prev, selectedIndex: newIndex };
      });
    } else if (key === 'Enter') {
      e.preventDefault();
      const { selectedIndex } = refState; // Use index from ref
      const currentItems = refState.items || []; // Use full list
      console.log('[DEBUG][handleKeyDown] Enter pressed, state:', { currentItems, selectedIndex });
      if (selectedIndex >= 0 && currentItems && currentItems.length > selectedIndex) {
        const selectedWord = currentItems[selectedIndex];
        console.log('[DEBUG][handleKeyDown] Enter pressed, attempting to insert selection:', selectedWord);
        if (inputRef.current) {
          inputRef.current.value = selectedWord;
          console.log('[DEBUG][handleKeyDown] Set input value to:', selectedWord);
        }
        handleCommitEdit(selectedWord);
      } else {
        console.log('[DEBUG][handleKeyDown] Enter pressed, committing current input from event:', e.target.value);
        handleCommitEdit(e);
      }
    } else if (key === 'Escape') {
      e.preventDefault();
      console.log('[InlineInput] Escape pressed, cancelling edit');
      setIsEditing(false);
      setSuggestionState(prev => ({ ...prev, visible: false, forceVisible: false }));
      hideSuggestionMenu();
      editor?.commands?.blur();
    }
  }

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className={`action-node-view not-prose relative inline-flex items-center align-baseline mx-0.5 ${selected ? 'border-2 border-blue-500 rounded' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span
        onDoubleClick={() => {
          setIsEditing(true);
          setTimeout(() => {
            if (!inputRef.current) return;
            inputRef.current.focus();
            inputRef.current.select();
            const query = inputRef.current.value;
            const highlightedItems = filterSuggestions(query, registeredActions);
            const selectedIndex = highlightedItems.length > 0 ? 0 : -1;
            setSuggestionState(prev => ({
              ...prev,
              visible: true,
              forceVisible: true,
              query,
              highlightedItems,
              selectedIndex,
              coords: calculateCoordsForInput(inputRef.current),
            }));
          }, 0);
        }}
        className="action-word-content px-1.5 py-0.5 rounded-l bg-yellow-200"
      >
        {isEditing ? (
          <input
            ref={inputRef}
            defaultValue={node.textContent}
            onBlur={handleCommitEdit}
            onKeyDown={(e) => {
              console.log('[InlineInput] KeyDown:', e.key);
              handleKeyDown(e);
            }}
            onChange={(e) => {
              const query = e.target.value;
              const newHighlightedItems = filterSuggestions(query, registeredActions);

              // Find the index of the first highlighted item in the *full* list
              let newSelectedIndex = -1;
              if (newHighlightedItems.length > 0) {
                const firstHighlighted = newHighlightedItems[0];
                newSelectedIndex = (registeredActions || []).findIndex(item => item === firstHighlighted);
              }
              if (newSelectedIndex === -1 && query && (registeredActions || []).length > 0) {
                // If no highlight but there's a query, keep selection at 0 or -1 if no items
                 newSelectedIndex = 0;
              } else if (!query && (registeredActions || []).length > 0) {
                 // If query is cleared, reset to 0
                 newSelectedIndex = 0;
              }

              console.log('[DEBUG][onChange] Before update:', { query, newHighlightedItems, selectedIndex: suggestionStateRef.current?.selectedIndex });

              setSuggestionState(prev => {
                // Always use the full list for 'items'
                const fullItems = registeredActions || [];
                const newState = {
                  ...prev,
                  visible: true,
                  query,
                  highlightedItems: newHighlightedItems,
                  selectedIndex: newSelectedIndex, // Set based on first highlighted item's index in full list
                  coords: calculateCoordsForInput(inputRef.current),
                  items: fullItems, // Ensure full list is passed
                };
                console.log('[DEBUG][onChange] After update (new state):', newState);
                return newState;
              });
            }}
            className="px-1 py-0.5 rounded border border-gray-300"
          />
        ) : (
          <NodeViewContent
            ref={ref}
            className="inline"
          />
        )}
      </span>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleDropdown}
        className="flex items-center px-1 py-0.5 bg-yellow-200 border-l border-yellow-300 hover:bg-yellow-300 transition-colors"
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
              onClick={(e) => selectQualifier(e, option.id)}
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
    </NodeViewWrapper>
  );
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
});

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
      requestStateUpdate: (reason) => { console.log('[WordSuggestionExtension] requestStateUpdate called:', reason); },
    };
  },

  addProseMirrorPlugins() {
    const ext = this;
    return [
      new Plugin({
        key: new PluginKey('wordSuggestionPlugin'),
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
            const next = { ...prev };

            // Reset explicit/space conversion flag if transaction is not marked as such
            if (!meta.justConvertedExplicitOrSpace) {
              next.justConvertedExplicitOrSpace = false;
            }

            // Save previous active context if it was active
            if (prev.active) {
              next.prevRange = prev.range;
              next.prevQuery = prev.query;
            }

            // Default: inactive
            next.active = false;
            next.range = null;
            next.query = '';

            const { selection } = newState;
            if (
              selection.empty &&
              selection.$from.parent.type.name !== 'actionNode'
            ) {
              const $from = selection.$from;
              const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
              const match = textBefore.match(/(\S+)$/);
              if (match) {
                const word = match[1];
                const end = $from.pos;
                const start = end - word.length;
                next.active = true;
                next.range = { from: start, to: end };
                next.query = word;
              }
            }

            return next;
          },
        },
        props: {},
      }),
    ];
  },

  onFocus({ editor }) {
    console.log('[WordSuggestionExtension:onFocus] Fired.');
    this.options.requestStateUpdate('focus');
  },

  onUpdate({ editor }) {
    console.log('[WordSuggestionExtension:onUpdate] Fired.');
    this.options.requestStateUpdate('update');
  },

  addKeyboardShortcuts() {
    return {
      'ArrowUp': () => {
        console.log('[WordSuggestionExtension:ArrowUp] Emitting event.');
        this.editor.emit('suggestion:nav_up');
        return true;
      },
      'ArrowDown': () => {
        console.log('[WordSuggestionExtension:ArrowDown] Emitting event.');
        this.editor.emit('suggestion:nav_down');
        return true;
      },
      'Enter': () => {
        console.log('[WordSuggestionExtension:Enter] Emitting event.');
        this.editor.emit('suggestion:select');
        // Mark transaction to avoid implicit conversion
        const tr = this.editor.state.tr.setMeta('wordSuggestionPlugin', { justConvertedExplicitOrSpace: true });
        this.editor.view.dispatch(tr);
        return true;
      },
      'Escape': () => {
        console.log('[WordSuggestionExtension:Escape] Emitting event.');
        this.editor.emit('suggestion:close');
        return true;
      },
      'Space': () => {
        const { state } = this.editor;
        const { selection } = state;

        if (!selection.empty || selection.$from.parent.type.name === 'actionNode') {
          return false;
        }

        const textBefore = selection.$from.parent.textBetween(
          Math.max(0, selection.$from.parentOffset - 50),
          selection.$from.parentOffset,
          ' ',
          '\ufffc'
        );

        const match = textBefore.match(/(\S+)$/);
        if (match) {
          const word = match[1];
          const end = selection.$from.pos;
          const start = end - word.length;

          const nodeContent = [{
            type: this.editor.schema.nodes.actionNode.name,
            attrs: { qualifier: this.options.defaultQualifier },
            content: [{ type: 'text', text: word }],
          }];

          this.editor.chain().focus().insertContentAt({ from: start, to: end }, nodeContent).run();

          const posAfterNode = this.editor.state.selection.to;

          this.editor.chain().focus().insertContentAt(posAfterNode, ' ').run();

          this.editor.emit('action-created-implicit', { word, qualifier: this.options.defaultQualifier });

          // Mark transaction to avoid implicit conversion on blur/move
          const tr = this.editor.state.tr.setMeta('wordSuggestionPlugin', { justConvertedExplicitOrSpace: true });
          this.editor.view.dispatch(tr);

          return true;
        }

        return false;
      },
    };
  },

  onSelectionUpdate({ editor }) {
    console.log('[WordSuggestionExtension:onSelectionUpdate] Fired.');
    this.options.requestStateUpdate('selection');
    this.options.requestCoordUpdate();
  },

  onBlur({ editor }) {
    console.log('[WordSuggestionExtension:onBlur] BLUR EVENT DETECTED!');
    this.options.requestStateUpdate('blur');
  },
});

// --- TipTap Editor Component ---
const TipTapEditorComponent = ({ setEditor }) => {
  const { editor } = useCurrentEditor(); // Get editor from provider context

  useEffect(() => {
    if (editor) {
      console.log('[TipTapEditorComponent] Editor instance from provider:', editor);
      setEditor(editor); // Pass the actual editor instance
    }
    // No cleanup needed here, provider manages editor lifecycle
  }, [editor, setEditor]);

  // EditorContent gets the editor instance from the provider context automatically
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
  placeholder = 'Type to add actions...'
}) => {
  // State for suggestion menu
  const [suggestionState, setSuggestionState] = useState({
    visible: false,
    items: registeredActions, // Store the full list
    highlightedItems: [],   // Store items matching the query
    selectedIndex: 0,
    coords: null, // Restore coords to initial state
    query: '',
    forceVisible: false, // override flag for inline editing
  });
  const [coordUpdateNonce, setCoordUpdateNonce] = useState(0);

  // Refs for state access in extension
  const suggestionStateRef = useRef(suggestionState);
  const isSelectingRef = useRef(false);
  const editorContainerRef = useRef(null);

  // Update ref when state changes
  useEffect(() => {
    suggestionStateRef.current = suggestionState;
  }, [suggestionState]);

  // Editor instance ref
  const [editorInstance, setEditorInstance] = useState(null);
  // Listen for implicit action creation event
  useEffect(() => {
    if (!editorInstance) return;
    const handleImplicitCreate = ({ word, qualifier }) => {
      console.log(`[Implicit Action Create]: ${word}, ${qualifier}`);
      onActionCreated(word, qualifier);
    };
    editorInstance.on('action-created-implicit', handleImplicitCreate);
    return () => {
      editorInstance.off('action-created-implicit', handleImplicitCreate);
    };
  }, [editorInstance, onActionCreated]);
  

  // --- Callback for Extension to Request Coordinate Update ---
  const requestCoordUpdate = useCallback(() => {
    console.log('[requestCoordUpdate] Triggering nonce increment.');
    setCoordUpdateNonce(n => n + 1);
  }, []);

  // Create the Word Suggestion Extension with current state
  const wordSuggestionExtension = useMemo(() => {
    return WordSuggestionExtension.configure({
      getSuggestionState: () => suggestionStateRef.current,
      requestCoordUpdate,
      registeredActions,
      defaultQualifier,
      editorContainerRef,
      requestStateUpdate: (reason) => {
        console.log('[ActionEditorComponent] requestStateUpdate called:', reason);
        setCoordUpdateNonce(n => n + 1); // trigger React effect
      },
    });
  }, [registeredActions, defaultQualifier, editorContainerRef, setSuggestionState, requestCoordUpdate]);

  // Configure the Action Node with qualifiers
  const actionNodeExtension = useMemo(() => {
    return ActionNode.configure({
      qualifierOptions,
      defaultQualifier
    });
  }, [qualifierOptions, defaultQualifier]);

  // Create extensions array
  const extensions = useMemo(() => [
    StarterKit.configure({ history: true }),
    Placeholder.configure({ placeholder }),
    actionNodeExtension,
    wordSuggestionExtension,
  ], [actionNodeExtension, wordSuggestionExtension, placeholder]);

  // Navigation handlers
  const handleNavUp = useCallback(() => {
    setSuggestionState(prev => ({
      ...prev,
      selectedIndex: prev.selectedIndex > 0 ? prev.selectedIndex - 1 : prev.items.length - 1
    }));
  }, []);

  const handleNavDown = useCallback(() => {
    console.log('[handleNavDown] Before update:', { selectedIndex: suggestionStateRef.current.selectedIndex, highlightedItems: suggestionStateRef.current.highlightedItems });
    setSuggestionState(prev => {
      const maxIndex = (prev.highlightedItems && prev.highlightedItems.length > 0) ? prev.highlightedItems.length - 1 : -1;
      const newIndex = (prev.selectedIndex < maxIndex && prev.selectedIndex >= 0) ? prev.selectedIndex + 1 : 0;
      console.log('[handleNavDown] After update:', { newIndex, maxIndex });
      return {
        ...prev,
        selectedIndex: newIndex
      };
    });
  }, []);

  const handleClose = useCallback(() => {
    setSuggestionState(prev => ({ ...prev, visible: false }));
  }, []);

  // Selection handler
  const handleSelect = useCallback((selectedItemFromClick = null) => {
    console.log('[handleSelect] called with', selectedItemFromClick);
    // Prevent re-entrancy
    if (isSelectingRef.current) {
      console.warn('[ActionEditorComponent:handleSelect] Re-entrancy detected, aborting.');
      return;
    }
    isSelectingRef.current = true; // Set lock
    console.count('[ActionEditorComponent] handleSelect entry');

    // Get latest state directly using the ref
    const currentState = suggestionStateRef.current;
    const { visible, items, selectedIndex, query, highlightedItems } = currentState;
    console.log('[ActionEditorComponent:handleSelect] Current State from Ref:', { visible, selectedIndex, query, highlightedItems });

    if (!visible) {
      console.log('[ActionEditorComponent:handleSelect] Menu not visible, aborting.');
      isSelectingRef.current = false;
      return;
    }

    if (selectedItemFromClick === null && (selectedIndex === -1 || highlightedItems.length === 0)) {
      console.log('[ActionEditorComponent:handleSelect] No suggestion selected, should commit input instead.');
      isSelectingRef.current = false;
      return;
    }

    // Determine the item to use: from click OR from state index (Enter key)
    const itemToInsert = selectedItemFromClick ?? (selectedIndex >= 0 ? items[selectedIndex] : null);

    if (!itemToInsert || !editorInstance) {
      console.log('[ActionEditorComponent:handleSelect] Invalid state for selection, bailing out.');
      isSelectingRef.current = false; // Release lock
      return;
    }

    console.log(`[ActionEditorComponent:handleSelect] Executing insert/replace for item: '${itemToInsert}', Original Query: '${query}'`);

    // Create the content to insert: an ActionNode containing the text
    const contentToInsert = [{
        type: editorInstance.state.schema.nodes.actionNode.name, // Use node name
        attrs: { qualifier: defaultQualifier },
        content: [{ type: 'text', text: itemToInsert }]
    }];

    // Execute Tiptap Command Chain Directly
    const chain = editorInstance.chain().focus();

    if (query.length > 0) {
      const currentPosition = editorInstance.state.selection.$from;
      const replaceFrom = currentPosition.pos - query.length;
      const replaceTo = currentPosition.pos;
      console.log(`[ActionEditorComponent:handleSelect] Replacing range (${replaceFrom} - ${replaceTo})`);
      chain.insertContentAt({ from: replaceFrom, to: replaceTo }, contentToInsert);
    } else {
      const currentPosition = editorInstance.state.selection.$from;
      console.log(`[ActionEditorComponent:handleSelect] Inserting at pos ${currentPosition.pos}`);
      chain.insertContentAt(currentPosition.pos, contentToInsert);
    }

    // Ensure the cursor is placed *after* the inserted node
    const currentPosition = editorInstance.state.selection.$from;
    const insertPos = (query.length > 0) ? currentPosition.pos - query.length : currentPosition.pos;
    const positionAfterInsertion = (query.length > 0) ? currentPosition.pos - query.length + 1 : currentPosition.pos + 1;

    console.log('[ActionEditorComponent:handleSelect] Running chain...');
    chain.run();

    const newPos = editorInstance.state.selection.to; // Position after inserted node
    console.log('[ActionEditorComponent:handleSelect] Position after node insertion:', newPos);

    editorInstance.chain().focus()
      .insertContentAt(newPos, ' ')
      .setTextSelection(newPos + 1)
      .run();

    console.log('[ActionEditorComponent:handleSelect] Hiding menu and blurring...');
    setSuggestionState(prev => ({ ...prev, visible: false, query: '' }));

    try {
      if (typeof onActionCreated === 'function' && itemToInsert) {
        console.log('[ActionEditorComponent:handleSelect] Calling onActionCreated callback');
        onActionCreated(itemToInsert, defaultQualifier);
      }
    } catch (err) {
      console.error('[ActionEditorComponent:handleSelect] Error in onActionCreated callback:', err);
    }

    isSelectingRef.current = false;
  }, [editorInstance, defaultQualifier]);

  // Set up event listeners when editor is available
  useEffect(() => {
    if (!editorInstance) {
      console.log('[ActionEditorComponent] Editor instance not yet available for listeners.');
      return;
    }

    console.log('[ActionEditorComponent] Setting up suggestion event listeners...');
    const editor = editorInstance;

    editor.on('suggestion:nav_up', handleNavUp);
    editor.on('suggestion:nav_down', handleNavDown);
    editor.on('suggestion:select', handleSelect);
    editor.on('suggestion:close', handleClose);

    return () => {
      editor.off('suggestion:nav_up', handleNavUp);
      editor.off('suggestion:nav_down', handleNavDown);
      editor.off('suggestion:select', handleSelect);
      editor.off('suggestion:close', handleClose);
    };
  }, [editorInstance, handleNavUp, handleNavDown, handleSelect, handleClose]);
  // --- Centralized suggestion state calculation ---
  useEffect(() => {
    if (!editorInstance || !editorContainerRef.current) {
      console.warn('[Centralized useEffect] Editor instance or container ref missing.');
      return;
    }

    const { state, isFocused, view } = editorInstance;
    const { selection } = state;
    const composing = view.composing;

    // Access plugin state
    const pluginKey = editorInstance.view.state.plugins.find(p => p.key?.key === 'wordSuggestionPlugin')?.key;
    const pluginState = pluginKey ? pluginKey.getState(state) : null;

    if (pluginState) {
      const { active, range, query: currentQuery, prevRange, prevQuery, justConvertedExplicitOrSpace } = pluginState;

      const movedOutOfPrev =
        prevRange &&
        (!active || !range || range.from !== prevRange.from || range.to !== prevRange.to);

      if (
        movedOutOfPrev &&
        !justConvertedExplicitOrSpace &&
        prevQuery &&
        prevRange &&
        prevRange.from != null &&
        prevRange.to != null
      ) {
        console.log('[Centralized useEffect] Implicit conversion triggered on move/blur for word:', prevQuery);

        const nodeContent = [{
          type: editorInstance.state.schema.nodes.actionNode.name,
          attrs: { qualifier: defaultQualifier },
          content: [{ type: 'text', text: prevQuery }],
        }];

        const docSize = state.doc.content.size;
        const from = Math.max(0, Math.min(prevRange.from, docSize));
        const to = Math.max(0, Math.min(prevRange.to, docSize));

        editorInstance.chain().focus().insertContentAt({ from, to }, nodeContent).run();

        const posAfterNode = editorInstance.state.selection.to;
        editorInstance.chain().focus().insertContentAt(posAfterNode, ' ').run();

        onActionCreated(prevQuery, defaultQualifier);

        const tr = editorInstance.state.tr.setMeta('wordSuggestionPlugin', { justConvertedExplicitOrSpace: true });
        editorInstance.view.dispatch(tr);
      }
    }

    let shouldBeVisible = false;
    let query = '';
    let highlightedItems = [];
    let selectedIndex = 0;
    let coords = null;

    const inlineInputEl = document.querySelector('input[type="text"]');
    if (inlineInputEl) {
      try {
        const inputRect = inlineInputEl.getBoundingClientRect();
        console.log('[DEBUG] Inline input bounding rect:', inputRect);
        coords = {
          x: inputRect.left,
          y: inputRect.bottom,
        };
        console.log('[DEBUG] Final coords for menu (based on input rect):', coords);
      } catch (e) {
        console.warn('[DEBUG] Error overriding coords for inline input:', e);
      }
    } else if (suggestionState.forceVisible) {
      // Override coords during inline editing

      function getCaretCoordinates(input) {
        const div = document.createElement('div');
        const style = getComputedStyle(input);
        for (const prop of style) {
          div.style[prop] = style[prop];
        }
        div.style.position = 'absolute';
        div.style.visibility = 'hidden';
        div.style.whiteSpace = 'pre-wrap';
        div.style.wordWrap = 'break-word';
        div.style.overflow = 'hidden';
        div.style.height = `${input.offsetHeight}px`;
        div.style.width = `${input.offsetWidth}px`;
        div.style.padding = style.padding;
        div.style.border = style.border;
        div.style.font = style.font;
        div.style.lineHeight = style.lineHeight;
        div.style.letterSpacing = style.letterSpacing;
        console.log('[getCaretCoordinates] input value:', input.value, 'selectionStart:', input.selectionStart);

        const value = input.value;
        const selectionStart = input.selectionStart;

        const before = document.createTextNode(value.substring(0, selectionStart));
        const span = document.createElement('span');
        span.textContent = '|'; // caret marker
        const after = document.createTextNode(value.substring(selectionStart));

        div.appendChild(before);
        div.appendChild(span);
        div.appendChild(after);

        document.body.appendChild(div);
        const rect = span.getBoundingClientRect();
        document.body.removeChild(div);

        return rect;
      }

      try {
        const inputEl = document.querySelector('input[type="text"]:focus');
        if (inputEl) {
          const rect = inputEl.getBoundingClientRect();
          const containerRect = editorContainerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
          coords = {
            x: rect.left - containerRect.left,
            y: rect.bottom - containerRect.top,
          };
          console.log('[Centralized useEffect] Overriding coords for inline input:', coords);
        }
      } catch (e) {
        console.warn('[Centralized useEffect] Error overriding coords for inline input:', e);
      }
      console.log('[Centralized useEffect] Forcing menu visible due to inline editing.');
      shouldBeVisible = true;
    } else if (
      isFocused &&
      selection &&
      selection.empty &&
      selection.$head &&
      selection.$head.parent.type.name !== 'actionNode' &&
      !composing
    ) {
      shouldBeVisible = true;
    }

    if (shouldBeVisible) {
      try {
        const $from = selection.$from;
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
        const match = textBefore.match(/(\S+)$/);
        query = match ? match[1] : '';

        highlightedItems = query ? registeredActions.filter(item =>
          item.toLowerCase().includes(query.toLowerCase())
        ) : []; // Only highlight if query is non-empty

        if (highlightedItems.length > 0) {
          selectedIndex = 0;
        } else {
          selectedIndex = -1;
        }
        console.log('[DEBUG] Filtering query:', query, 'highlightedItems:', highlightedItems, 'selectedIndex:', selectedIndex);

        const pos = selection.$head.pos;
        const absoluteCoords = view.coordsAtPos(pos);
        const containerRect = editorContainerRef.current.getBoundingClientRect();

        coords = {
          x: absoluteCoords.left - containerRect.left,
          y: absoluteCoords.bottom - containerRect.top - 30,
        };

        console.log('[Centralized useEffect] Menu visible:', {
          query,
          highlightedItems,
          selectedIndex,
          coords,
          forceVisible: suggestionState.forceVisible,
        });
      } catch (e) {
        console.warn('[Centralized useEffect] Error during calculation:', e);
        shouldBeVisible = false;
        query = '';
        highlightedItems = [];
        selectedIndex = 0;
        coords = null;
      }
    }

    setSuggestionState(prev => {
      // Calculate new state based on current logic results
      const newHighlightedItems = shouldBeVisible ? highlightedItems : [];

      // Preserve selectedIndex if possible, otherwise reset
      let newSelectedIndex = -1;
      if (shouldBeVisible && newHighlightedItems.length > 0) {
        // If the query changed OR the previous index is now invalid, reset to 0
        if (prev.query !== query || !(prev.selectedIndex >= 0 && prev.selectedIndex < newHighlightedItems.length)) {
           newSelectedIndex = 0;
        } else {
           // Otherwise, keep the previous index
           newSelectedIndex = prev.selectedIndex;
        }
      } else {
         newSelectedIndex = -1; // No items or not visible
      }

      const newCoords = shouldBeVisible ? coords : null;
      const newQuery = shouldBeVisible ? query : '';

      const newState = {
        ...prev,
        visible: shouldBeVisible,
        query: newQuery,
        highlightedItems: newHighlightedItems,
        selectedIndex: newSelectedIndex,
        coords: newCoords,
        items: registeredActions, // Keep full list
      };

      // Log comparison for debugging, but always return newState to force update
      const needsUpdate =
        prev.visible !== shouldBeVisible ||
        prev.query !== newQuery ||
        prev.selectedIndex !== newSelectedIndex ||
        JSON.stringify(prev.coords) !== JSON.stringify(newCoords) ||
        JSON.stringify(prev.highlightedItems) !== JSON.stringify(newHighlightedItems);

      if (!needsUpdate) {
         console.log('[DEBUG] State appears unchanged, but forcing update anyway.');
      }

      console.log('[DEBUG] Updating state:', newState);

      // If forceVisible is true (inline editing), only update coords and items, preserve the rest from prev state
      if (prev.forceVisible) {
        // Only allow coordinate updates if they actually changed
        const coordsChanged = JSON.stringify(prev.coords) !== JSON.stringify(newCoords);
        return {
          ...prev, // Keep previous query, highlightedItems, selectedIndex, visible, forceVisible
          coords: coordsChanged ? newCoords : prev.coords, // Update coords only if changed
          items: registeredActions, // Ensure items list is up-to-date
        };
      }

      return newState; // Otherwise, apply the calculated state (normal suggestion mode)
    });
  }, [coordUpdateNonce, registeredActions, editorInstance, suggestionState.forceVisible]);

  // --- Effect to calculate coordinates AFTER menu becomes visible ---
  useEffect(() => {
    if (suggestionState.visible) {
        console.log('[Coords Effect] Running. Visible:', suggestionState.visible, 'Query:', suggestionState.query);
        if (!editorInstance) {
            console.warn('[Coords Effect] Aborting: instance not available.');
            return;
        }

        let newCoords = null;
        const inlineInputEl = document.querySelector('input[type="text"]');

        if (inlineInputEl) {
          // Calculate coords based on inline input
          try {
            const inputRect = inlineInputEl.getBoundingClientRect();
            newCoords = {
              x: inputRect.left,
              y: inputRect.bottom,
            };
            console.log('[Coords Effect] Calculated coords for inline input:', newCoords);
          } catch (e) {
            console.warn('[Coords Effect] Error calculating coords for inline input:', e);
          }
        } else {
          // Calculate coords based on ProseMirror selection
          if (!editorContainerRef.current) {
            console.warn('[Coords Effect] Aborting: container ref not available.');
            return;
          }
          const { view } = editorInstance;
          const { selection } = view.state;

          if (!selection || selection.$head === null || typeof selection.$head.pos !== 'number') {
              console.warn('[Coords Effect] Invalid selection state.');
              return;
          }
          console.log('[Coords Effect] Current selection head pos:', selection.$head.pos);

          const absoluteCoords = view.coordsAtPos(selection.$head.pos);
          console.log('[Coords Effect] Result of coordsAtPos:', absoluteCoords);
          const containerRect = editorContainerRef.current.getBoundingClientRect();

          if (!absoluteCoords || typeof absoluteCoords.left !== 'number' || typeof absoluteCoords.top !== 'number') {
              console.warn('[Coords Effect] coordsAtPos returned invalid data:', absoluteCoords);
              return;
          }

          newCoords = {
              x: absoluteCoords.left, // Use absolute screen coords
              y: absoluteCoords.bottom, // Use absolute screen coords
          };
          console.log('[Coords Effect] Calculated coords for ProseMirror selection:', newCoords);
        }

        // Update coords state directly
        setSuggestionState(prev => {
            if (!prev.visible) {
                console.log('[Coords Effect setState] Prev state not visible, bailing.');
                return prev;
            }
            const coordsChanged = JSON.stringify(prev.coords) !== JSON.stringify(newCoords);
            console.log('[Coords Effect setState] Coords changed:', coordsChanged, 'Prev:', prev.coords, 'New:', newCoords);
            if (coordsChanged) {
                console.log('[Coords Effect setState] Updating coords state.');
                return { ...prev, coords: newCoords };
            }
            return prev;
        });
    } else if (suggestionState.coords !== null) {
        // If menu becomes hidden, clear coords immediately
        console.log('[Coords Effect] Visible is false, clearing coords.');
        setSuggestionState(prev => ({ ...prev, coords: null }));
    }
  }, [suggestionState.visible, editorInstance, suggestionState.query, suggestionState.selectedIndex, coordUpdateNonce]); // Dependencies remain the same

  // --- Add logging right before render return ---
  console.log('[ActionEditorComponent Render] State:', {
    visible: suggestionState.visible,
    coords: suggestionState.coords, 
    itemsLength: suggestionState.items.length,
    selectedIndex: suggestionState.selectedIndex,
    highlightedItems: suggestionState.highlightedItems,
    query: suggestionState.query,
  });

  return (
    <HintContext.Provider value={{
      qualifierOptions,
      showHint: () => {}, // TODO: Implement hint system
      hideHint: () => {},
      onActionWordChanged,
      onQualifierChanged,
      setSuggestionState,
      registeredActions,
      suggestionStateRef,
    }}>
      <div className="relative" ref={editorContainerRef}>
        <EditorProvider
          slotBefore={null}
          slotAfter={null}
          extensions={extensions}
          content={`<p><span data-type="action-node" data-node-id="init1" data-qualifier="incoming"><span class="action-word-content">testaction</span></span></p>`}
          editorProps={{
            attributes: {
              class: 'prose max-w-full focus:outline-none min-h-[100px] px-4 py-2',
            },
            handleDOMEvents: {
              blur: (view, event) => {
                // Clear node selection by setting a text selection at the current position
                const { state } = view;
                const { selection } = state;
                // Only clear if it's currently a NodeSelection
                if (selection instanceof NodeSelection) {
                    // Set text selection at the start of the previously selected node
                    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, selection.from)));
                    console.log('Node selection cleared on blur');
                }
                return false; // Allow other handlers to run
              },
            },
          }}
        >
          <TipTapEditorComponent setEditor={setEditorInstance} />
        </EditorProvider>

        {/* Restore original render condition */}
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
                highlightedItems={suggestionState.highlightedItems}
                onSelect={handleSelect}
                coords={suggestionState.coords}
                query={suggestionState.query}
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