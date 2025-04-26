import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ActionNodeView from '../components/ActionNodeView'; // Import the React component

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
      equation: {
        default: '=1',
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
          const equation = domNode.getAttribute('data-equation') || '=1';
          if (!id || !qualifier) return false;
          return { qualifier, nodeId: id, equation };
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
       'data-equation': node.attrs.equation,
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
                return false; // Allow default backspace (delete node).
            }
             return true; // Prevent default backspace.
        }
        return false;
      },
    };
  },

  atom: true,
});

export default ActionNode;
