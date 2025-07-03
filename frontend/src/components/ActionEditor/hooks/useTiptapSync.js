import { useEffect, useCallback } from 'react';

const useTiptapSync = ({
  editorInstanceRef,
  actionsState,
  removeAction,
  onActionDeletedRef,
  preventImplicitCreationRef,
  nodeType,
  actionsToRender, // from DND hook
}) => {

  const generateTiptapContent = useCallback(() => {
    if (!actionsToRender || actionsToRender.length === 0) {
      return { type: 'doc', content: [{ type: 'paragraph' }] };
    }

    const content = actionsToRender.flatMap((action, index) => {
      if (!action || !action.id || typeof action.word !== 'string') {
        return [];
      }
      const nodeAttrs = {
        word: action.word,
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
      };
      return [node];
    });

    return {
      type: 'doc',
      content: [{ type: 'paragraph', content: content.length > 0 ? content : undefined }],
    };
  }, [actionsToRender, nodeType]);

  // Sync React State -> Tiptap
  useEffect(() => {
    const editor = editorInstanceRef.current;
    if (editor && !editor.isDestroyed && actionsState) {
      const generatedContent = generateTiptapContent();
      if (JSON.stringify(editor.getJSON()) !== JSON.stringify(generatedContent)) {
        requestAnimationFrame(() => {
          if (editor && !editor.isDestroyed && editor.isEditable) {
            editor.commands.setContent(generatedContent, false, {
              preserveWhitespace: 'full',
            });
          }
        });
      }
    }
  }, [actionsState, editorInstanceRef, generateTiptapContent]);

  // Sync Tiptap Deletions -> React State
  useEffect(() => {
    const editor = editorInstanceRef.current;
    if (!editor || editor.isDestroyed) return;

    const handleDocumentChange = ({ transaction }) => {
      if (!transaction.docChanged) return;

      const currentEditorNodeIds = new Set();
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'actionNode' && node.attrs.nodeId && !node.attrs.isDragPlaceholder) {
          currentEditorNodeIds.add(node.attrs.nodeId);
        }
      });

      const currentStateIds = new Set(actionsState.map(a => a.id));
      const deletedIds = [...currentStateIds].filter(id => !currentEditorNodeIds.has(id));

      if (deletedIds.length > 0) {
        if (preventImplicitCreationRef) preventImplicitCreationRef.current = true;
        
        deletedIds.forEach(id => {
          removeAction(id);
          onActionDeletedRef.current?.(id);
        });
        
        if (preventImplicitCreationRef) {
          setTimeout(() => {
            preventImplicitCreationRef.current = false;
            editor.commands.blur();
          }, 50);
        }
      }
    };

    editor.on('update', handleDocumentChange);
    return () => {
      if (editor && !editor.isDestroyed) {
        editor.off('update', handleDocumentChange);
      }
    };
  }, [editorInstanceRef, actionsState, removeAction, onActionDeletedRef, preventImplicitCreationRef]);

  return { generateTiptapContent };
};

export default useTiptapSync; 