import React, { useState, useCallback, useEffect, createContext, useContext, useRef, useMemo } from 'react';
import { EditorProvider, useCurrentEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Node, mergeAttributes, Extension } from '@tiptap/core';
import { ChevronDown } from 'lucide-react';
import SuggestionList from './SuggestionList.jsx';
import { TextSelection } from '@tiptap/pm/state';
import { Plugin, PluginKey } from 'prosemirror-state';

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
  atom: false,
  selectable: false,
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
  const originalWordRef = useRef(node.textContent);
  const { qualifier, nodeId } = node.attrs;
  const { showHint, hideHint, onActionWordChanged, onActionDeleted } = useContext(HintContext);
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
      // Update React state immediately
      setIsOpen(false);
      // Delay the Tiptap attribute update slightly
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

  const handleContentBlur = (event) => {
      const currentWord = node.textContent;
      console.log(`ActionNode Blur: Node ID '${nodeId}', New Word: '${currentWord}'`);
      if (nodeId && currentWord && currentWord !== originalWordRef.current) {
          console.log(`Word changed for node ${nodeId}: '${originalWordRef.current}' -> '${currentWord}'`);
          onActionWordChanged(nodeId, currentWord);
      }
  };

  return (
    <NodeViewWrapper
        ref={wrapperRef}
        className={`action-node-view not-prose relative inline-flex items-center align-baseline mx-0.5 ${selected ? 'outline outline-2 outline-blue-400 rounded' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
    >
        <NodeViewContent
            ref={ref}
            className="action-word-content px-1.5 py-0.5 rounded-l bg-yellow-200"
            onBlur={handleContentBlur}
            onFocus={() => {
                originalWordRef.current = node.textContent;
                console.log(`ActionNode Focus: Node ID '${nodeId}', Original Word: '${originalWordRef.current}'`);
            }}
        />
        <button
            onClick={toggleDropdown}
            className="flex items-center px-1 py-0.5 bg-yellow-200 border-l border-yellow-300 hover:bg-yellow-300 transition-colors"
            aria-haspopup="true"
            aria-expanded={isOpen}
        >
            <span className="mr-0.5">{selectedOptionLabel}</span>
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
        </button>
        {isOpen && (
            <div className="absolute top-full left-0 mt-1 w-32 bg-white shadow-lg rounded-md border border-gray-200 z-50">
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
            content: [{ type: 'text', text: word }]
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
    query: ''
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
    setSuggestionState(prev => ({
      ...prev,
      selectedIndex: prev.selectedIndex < prev.items.length - 1 ? prev.selectedIndex + 1 : 0
    }));
  }, []);

  const handleClose = useCallback(() => {
    setSuggestionState(prev => ({ ...prev, visible: false }));
  }, []);

  // Selection handler
  const handleSelect = useCallback((selectedItemFromClick = null) => {
    // Prevent re-entrancy
    if (isSelectingRef.current) {
      console.warn('[ActionEditorComponent:handleSelect] Re-entrancy detected, aborting.');
      return;
    }
    isSelectingRef.current = true; // Set lock
    console.count('[ActionEditorComponent] handleSelect entry');
    console.log('[ActionEditorComponent] Handling suggestion:select');

    // Get latest state directly using the ref
    const currentState = suggestionStateRef.current;
    const { visible, items, selectedIndex, query } = currentState;
    console.log('[ActionEditorComponent:handleSelect] Current State from Ref:', { visible, selectedIndex, query });

    // Determine the item to use: from click OR from state index (Enter key)
    const itemToInsert = selectedItemFromClick ?? (selectedIndex >= 0 ? items[selectedIndex] : null);

    if (!visible || !itemToInsert || !editorInstance) {
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
    // Calculate the position after the inserted node
    const currentPosition = editorInstance.state.selection.$from;
    const insertPos = (query.length > 0) ? currentPosition.pos - query.length : currentPosition.pos;
    // The length of the inserted node is 1 (the node itself) + text length. Tiptap handles node size internally.
    // We just need to set cursor after the node. Tiptap's insertContentAt often does this, but let's be explicit.
    // Get the position immediately after the potential replacement/insertion range.
    const positionAfterInsertion = (query.length > 0) ? currentPosition.pos - query.length + 1 : currentPosition.pos + 1;

    console.log('[ActionEditorComponent:handleSelect] Running chain...');
    // chain.run(); // Don't run yet, add cursor positioning

    // After initial insertion, get the updated position after the inserted node
    chain.run();

    const newPos = editorInstance.state.selection.to; // Position after inserted node
    console.log('[ActionEditorComponent:handleSelect] Position after node insertion:', newPos);

    // Insert a space after the node and move cursor after the space
    editorInstance.chain().focus()
      .insertContentAt(newPos, ' ')
      .setTextSelection(newPos + 1)
      .run();

    // Now Update React State & Blur
    console.log('[ActionEditorComponent:handleSelect] Hiding menu and blurring...');
    setSuggestionState(prev => ({ ...prev, visible: false, query: '' })); // Reset query
    // Don't blur, keep focus for continued typing editorInstance?.commands.blur();

    try {
      if (typeof onActionCreated === 'function' && itemToInsert) {
        console.log('[ActionEditorComponent:handleSelect] Calling onActionCreated callback');
        onActionCreated(itemToInsert, defaultQualifier);
      }
    } catch (err) {
      console.error('[ActionEditorComponent:handleSelect] Error in onActionCreated callback:', err);
    }

    // Release lock AFTER all actions
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
          content: [{ type: 'text', text: prevQuery }]
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

    if (
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

        highlightedItems = registeredActions.filter(item =>
          item.toLowerCase().includes(query.toLowerCase())
        );

        selectedIndex = highlightedItems.length > 0 ? 0 : -1;

        const pos = selection.$head.pos;
        const absoluteCoords = view.coordsAtPos(pos);
        const containerRect = editorContainerRef.current.getBoundingClientRect();

        coords = {
          x: absoluteCoords.left - containerRect.left,
          y: absoluteCoords.bottom - containerRect.top - 30,
        };
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
      if (
        prev.visible === shouldBeVisible &&
        (!shouldBeVisible ||
          (prev.query === query &&
            prev.selectedIndex === selectedIndex &&
            JSON.stringify(prev.coords) === JSON.stringify(coords) &&
            JSON.stringify(prev.highlightedItems) === JSON.stringify(highlightedItems)))
      ) {
        return prev;
      }

      if (shouldBeVisible) {
        console.log('[Centralized useEffect] Showing menu with query:', query);
        return {
          ...prev,
          visible: true,
          query,
          highlightedItems,
          selectedIndex,
          coords,
          items: registeredActions,
        };
      } else {
        console.log('[Centralized useEffect] Hiding menu');
        return {
          ...prev,
          visible: false,
          query: '',
          highlightedItems: [],
          selectedIndex: 0,
          coords: null,
          items: registeredActions,
        };
      }
    });
  }, [coordUpdateNonce, registeredActions, editorInstance]);

  // --- Effect to calculate coordinates AFTER menu becomes visible ---
  useEffect(() => {
    if (suggestionState.visible) {
        console.log('[ActionEditorComponent useEffect] Running effect. Visible:', suggestionState.visible, 'Query:', suggestionState.query);
        if (!editorInstance || !editorContainerRef.current) { 
            console.warn('[ActionEditorComponent useEffect] Aborting coord calculation: instance or ref not available.');
            return;
        }
        const { view } = editorInstance;
        const { selection } = view.state;

        if (!selection || selection.$head === null || typeof selection.$head.pos !== 'number') {
            console.warn('[ActionEditorComponent useEffect] Invalid selection state.');
            return;
        }
        console.log('[ActionEditorComponent useEffect] Current selection head pos:', selection.$head.pos);

        const absoluteCoords = view.coordsAtPos(selection.$head.pos);
        console.log('[ActionEditorComponent useEffect] Result of coordsAtPos:', absoluteCoords);
        const containerRect = editorContainerRef.current.getBoundingClientRect();

        if (!absoluteCoords || typeof absoluteCoords.left !== 'number' || typeof absoluteCoords.top !== 'number') {
            console.warn('[ActionEditorComponent useEffect] coordsAtPos returned invalid data:', absoluteCoords);
            return;
        }

        const relativeCoords = {
            x: absoluteCoords.left - containerRect.left,
            // Adjust offset
            y: absoluteCoords.bottom - containerRect.top - 30, 
        };

        console.log('[ActionEditorComponent useEffect] Calculated Coords:', { absoluteCoords, containerRect, relativeCoords });

        // Update coords state directly
        setSuggestionState(prev => {
             if (!prev.visible) {
                 console.log('[ActionEditorComponent useEffect setState] Prev state not visible, bailing.');
                 return prev; 
             }
             const coordsChanged = prev.coords?.x !== relativeCoords.x || prev.coords?.y !== relativeCoords.y;
             console.log('[ActionEditorComponent useEffect setState] Coords changed:', coordsChanged, 'Prev:', prev.coords, 'New:', relativeCoords);
             if (coordsChanged) {
                 console.log('[ActionEditorComponent useEffect setState] Updating coords state.');
                 return { ...prev, coords: relativeCoords };
             }
             return prev;
        });
    } else if (suggestionState.coords !== null) {
        // If menu becomes hidden, clear coords immediately
        console.log('[ActionEditorComponent useEffect] Visible is false, clearing coords.');
        setSuggestionState(prev => ({ ...prev, coords: null }));
    }
  }, [suggestionState.visible, editorInstance, suggestionState.query, suggestionState.selectedIndex, coordUpdateNonce]);

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
    }}>
      <div className="relative" ref={editorContainerRef}>
        <EditorProvider
          slotBefore={null}
          slotAfter={null}
          extensions={extensions}
          content={initialContent}
          editorProps={{
            attributes: {
              class: 'prose max-w-full focus:outline-none min-h-[100px] px-4 py-2',
            },
          }}
        >
          <TipTapEditorComponent setEditor={setEditorInstance} />
        </EditorProvider>

        {/* Restore original render condition */}
        {suggestionState.visible && suggestionState.coords && (
          <div
            className="absolute z-50"
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
          </div>
        )}
      </div>
    </HintContext.Provider>
  );
};

export default ActionEditorComponent; 