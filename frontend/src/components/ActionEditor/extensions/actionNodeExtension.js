import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ActionNodeView from '../components/ActionNodeView'; // Import the React component

// --- Custom TipTap Node for Actions ---
const ActionNode = Node.create({
  name: 'actionNode',
  group: 'inline',
  inline: true,
  selectable: true,
  draggable: false,
  atom: true,
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
            return {};
          }
          return {
            'data-node-id': attributes.nodeId,
          };
        },
      },
      equation: {
        default: '',
        parseHTML: element => element.getAttribute('data-equation'),
        renderHTML: attributes => ({
          'data-equation': attributes.equation,
        }),
      },
      actionNodeType: {
        default: null,
        parseHTML: element => element.getAttribute('data-node-type'),
        renderHTML: attributes => {
          if (!attributes.actionNodeType) return {};
          return { 'data-node-type': attributes.actionNodeType };
        },
      },
      actionId: {
        default: null,
        parseHTML: element => element.getAttribute('data-action-id'),
        renderHTML: attributes => {
          if (!attributes.actionId) return {};
          return { 'data-action-id': attributes.actionId };
        },
      },
      isDragPlaceholder: {
        default: false,
        parseHTML: element => element.hasAttribute('data-is-drag-placeholder'),
        renderHTML: attributes => {
          if (!attributes.isDragPlaceholder) return {};
          return { 'data-is-drag-placeholder': 'true' };
        },
      },
      isBeingDragged: {
        default: false,
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
          const actionNodeType = domNode.getAttribute('data-node-type');
          const actionId = domNode.getAttribute('data-action-id');
          if (!id || !qualifier) return false;
          return {
            qualifier,
            nodeId: id,
            equation,
            actionNodeType: actionNodeType || null,
            actionId: actionId || null,
          };
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
       'data-node-type': node.attrs.actionNodeType,
       'data-action-id': node.attrs.actionId,
       'contenteditable': 'false',
     });
     return [
        'span',
        Object.fromEntries(Object.entries(mergedAttrs).filter(([_, v]) => v != null)),
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
});

export default ActionNode;
