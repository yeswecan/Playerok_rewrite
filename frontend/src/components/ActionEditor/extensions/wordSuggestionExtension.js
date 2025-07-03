import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection, NodeSelection } from 'prosemirror-state';

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
      requestStateUpdate: (reason) => {}, // Quieten this
      handleImplicitCreate: (word, reason) => false, // Placeholder
      showSuggestionsOnFocus: () => {}, // Placeholder
      hideSuggestionsOnBlur: () => {}, // Placeholder
      onNavUp: () => {}, // Placeholder
      onNavDown: () => {}, // Placeholder
      onCloseSuggestion: () => {}, // Placeholder
      onSelectByIndex: () => false, // Placeholder
    };
  },

  addStorage() {
    return {
      key: null,
    };
  },

  addProseMirrorPlugins() {
    const ext = this;
    const suggestionPluginKey = new PluginKey('wordSuggestionPlugin');
    this.storage.key = suggestionPluginKey;

    return [
      new Plugin({
        key: suggestionPluginKey,
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
            const isSyncingContent = tr.getMeta('isSyncingContent') === true;
            const next = { ...prev };

            if (!isSyncingContent) {
                const { selection } = newState;
                const isNodeSelection = selection instanceof NodeSelection && selection.node.type.name === 'actionNode';

                next.active = false;
                next.range = null;
                next.query = '';

                if (selection.empty && !isNodeSelection) {
                    const $from = selection.$from;
                    if ($from.parent && $from.parent.content) {
                        let possible = true;
                        const nodeBefore = $from.nodeBefore;
                        if (nodeBefore && nodeBefore.type.name === 'actionNode') {
                            possible = false;
                        }

                        if (possible) {
                            const currentPos = $from.pos;
                            let startPos = $from.start();
                            const resolvedPos = newState.doc.resolve(currentPos);
                            let nodeFoundStart = false;

                            for (let i = resolvedPos.depth; i >= 0; i--) {
                                let currentParent = resolvedPos.node(i);
                                if (currentParent.childCount === 0) continue;
                                for (let j = resolvedPos.index(i) - 1; j >= 0; j--) {
                                    if (j < 0 || j >= currentParent.childCount) continue;
                                    const childNode = currentParent.child(j);
                                    let childNodePos;
                                    try {
                                      if (typeof resolvedPos.posAtIndex !== 'function') break;
                                      childNodePos = resolvedPos.posAtIndex(j, i);
                                    } catch (e) {
                                        if (e instanceof RangeError) continue;
                                        throw e;
                                    }

                                    if (childNodePos < currentPos) {
                                        if (childNode.type.name === 'actionNode') {
                                            startPos = childNodePos + childNode.nodeSize;
                                            nodeFoundStart = true;
                                            break;
                                        } else if (childNode.isText) {
                                            const text = childNode.text || '';
                                            const lastSpaceInText = text.lastIndexOf(' ');
                                            if (lastSpaceInText !== -1) {
                                                startPos = childNodePos + lastSpaceInText + 1;
                                                nodeFoundStart = true;
                                                break;
                                            } else {
                                                startPos = childNodePos;
                                            }
                                        }
                                    }
                                }
                                if (nodeFoundStart) break;
                            }

                            if (!nodeFoundStart && resolvedPos.parent.isTextblock) {
                                const textNodeBefore = resolvedPos.textOffset > 0 ? resolvedPos.parent.textBetween(0, resolvedPos.parentOffset, '\0') : '';
                                const lastSpace = textNodeBefore.lastIndexOf(' ');
                                if (lastSpace !== -1) {
                                    startPos = $from.start() + lastSpace + 1;
                                } else {
                                    startPos = $from.start();
                                }
                            }

                            if (currentPos >= startPos) {
                                next.range = { from: startPos, to: currentPos };
                                next.query = newState.doc.textBetween(startPos, currentPos, '\0');
                                if (next.query && next.query.trim() !== '') {
                                    next.active = true;
                                } else {
                                    next.active = false;
                                }
                            }
                        }
                    }
                }

                if (prev.active && !next.active && next.query !== '' && prev.query && prev.query.trim() &&
                    !isNodeSelection && !meta.fromSuggestionSelect && !meta.justConvertedExplicitOrSpace && !meta.justConvertedImplicit
                ) {
                    const trimmedPrevQuery = prev.query.trim();
                    const created = ext.options.handleImplicitCreate(trimmedPrevQuery, 'selection');
                    if (created) {
                        tr.setMeta('wordSuggestionPlugin', { ...meta, justConvertedImplicit: true });
                    }
                }

                if (next.active) {
                    next.prevRange = next.range;
                    next.prevQuery = next.query;
                } else {
                     next.prevRange = null;
                     next.prevQuery = '';
                }
            }

            next.justConvertedExplicitOrSpace = meta.justConvertedExplicitOrSpace || meta.justConvertedImplicit || false;
            return next;
          },
        },
        props: {
          handleTextInput(view, from, to, text) { return false; },
        },
      }),
    ];
  },

  onFocus({ editor }) {
    // DO NOTHING HERE.
    // The suggestion visibility should be controlled by the plugin state ('apply' function)
    // based on the current query and selection, not just on focus events.
    // This prevents the suggestion menu from appearing inappropriately,
    // such as when a node is dragged and dropped.
  },

  onUpdate({ editor }) {
    const pluginState = this.storage.key.getState(editor.state);
    if (pluginState) {
      this.options.requestStateUpdate(pluginState.query);
    }
    this.options.requestCoordUpdate();
  },

  addKeyboardShortcuts() {
    return {
      ArrowUp: () => {
        const { visible } = this.options.getSuggestionState();
        if (!visible) return false;
        this.options.onNavUp();
        return true;
      },
      ArrowDown: () => {
        const { visible } = this.options.getSuggestionState();
        if (!visible) return false;
        this.options.onNavDown();
        return true;
      },
      Enter: () => {
        const { visible, selectedIndex } = this.options.getSuggestionState();
        if (visible && selectedIndex >= 0) {
            return this.options.onSelectByIndex();
        }
        else {
            const created = this.options.handleImplicitCreate(null, 'enter');
            return created;
        }
      },
      Escape: () => {
        const { visible } = this.options.getSuggestionState();
        if (!visible) return false;
        this.options.onCloseSuggestion();
        return true;
      },
      Space: () => {
          const { visible, selectedIndex } = this.options.getSuggestionState();
          // Only consume space if suggestions are not visible or nothing is selected
          if (visible && selectedIndex >= 0) {
            return false; // Allow space insertion
          }
          const created = this.options.handleImplicitCreate(null, 'space');
          return created;
      },
    };
  },

  onSelectionUpdate({ editor }) {
    const pluginState = this.storage.key.getState(editor.state);
    if (pluginState) {
      this.options.requestStateUpdate(pluginState.query);
    }
    this.options.requestCoordUpdate();
  },

  onBlur({ editor, event }) {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget && (relatedTarget.closest('.suggestion-list') || relatedTarget.closest('.inline-block[data-node-id]'))) {
        // Don't hide if focus moves to suggestion list or node
    } else {
      this.options.hideSuggestionsOnBlur();
      this.options.handleImplicitCreate(null, 'blur');
    }
  },
});

export default WordSuggestionExtension;
