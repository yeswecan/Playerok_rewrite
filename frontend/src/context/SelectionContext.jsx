import React, { createContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { TextSelection } from 'prosemirror-state';

export const SelectionContext = createContext({
  selectedNode: null, // Will be an object like { nodeId, editorId, nodeRect }
  setSelectedNode: () => {},
  clearSelection: () => {},
  registerEditor: () => {},
  unregisterEditor: () => {},
});

export const SelectionProvider = ({ children }) => {
  const [selectedNode, setSelectedNodeState] = useState(null);
  const selectedNodeRef = useRef(null); // Ref to hold the current selected node
  const editorsRef = useRef(new Map()); // Map of editorId -> editor instance

  // Keep the ref updated
  useEffect(() => {
    selectedNodeRef.current = selectedNode;
  }, [selectedNode]);

  const registerEditor = useCallback((editorId, editorInstance) => {
    console.log('[SelectionContext] ACTION: registerEditor', { editorId });
    editorsRef.current.set(editorId, editorInstance);
  }, []);

  const unregisterEditor = useCallback((editorId) => {
    console.log('[SelectionContext] ACTION: unregisterEditor', { editorId });
    editorsRef.current.delete(editorId);
  }, []);

  const setSelectedNode = useCallback((nodeInfo) => {
    console.log('[SelectionContext] ACTION: setSelectedNode', { nodeInfo });

    const previouslySelectedNode = selectedNodeRef.current;

    // If a new node is being selected and there was a different node previously selected in another editor...
    if (nodeInfo && previouslySelectedNode && previouslySelectedNode.editorId !== nodeInfo.editorId) {
      const previousEditor = editorsRef.current.get(previouslySelectedNode.editorId);
      if (previousEditor && !previousEditor.isDestroyed) {
        console.log(`[SelectionContext] Deselecting node in editor "${previouslySelectedNode.editorId}" because a new node was selected in editor "${nodeInfo.editorId}".`);
        // Set a collapsed text selection at the end of the document to clear the NodeSelection
        const pos = previousEditor.state.doc.content.size;
        const tr = previousEditor.state.tr.setSelection(TextSelection.create(previousEditor.state.doc, pos));
        previousEditor.view.dispatch(tr);
      }
    }

    setSelectedNodeState(nodeInfo);
  }, []);

  const clearSelection = useCallback(() => {
    console.log('[SelectionContext] ACTION: clearSelection');
    // console.trace('[SelectionContext] Stack trace for clearSelection');

    const nodeToDeselect = selectedNodeRef.current;
    if (nodeToDeselect) {
      const editor = editorsRef.current.get(nodeToDeselect.editorId);
      if (editor && !editor.isDestroyed) {
        console.log(`[SelectionContext] ACTION: Programmatically clearing selection in editor "${nodeToDeselect.editorId}"`);
        // Set a collapsed text selection at the end of the document to clear the NodeSelection
        const pos = editor.state.doc.content.size;
        const tr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos));
        editor.view.dispatch(tr);
      }
    }
    
    setSelectedNodeState(null);
  }, []);

  const contextValue = useMemo(() => ({
    selectedNode,
    setSelectedNode,
    clearSelection,
    registerEditor,
    unregisterEditor,
  }), [selectedNode, setSelectedNode, clearSelection, registerEditor, unregisterEditor]);

  return (
    <SelectionContext.Provider value={contextValue}>
      {children}
    </SelectionContext.Provider>
  );
}; 
 