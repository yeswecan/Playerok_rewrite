import React, { useState, useCallback, useContext } from 'react';
// import { ActionEditorComponent } from '../components/ActionEditor'; // Assuming index export was incorrect
import ActionEditorComponent from '../components/ActionEditor/ActionEditorComponent.jsx'; // Direct import
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
// import { SelectionProvider, SelectionContext } from '../context/SelectionContext'; // This context is no longer used here.
// import SelectionHighlighter from '../components/ui/SelectionHighlighter'; // This component is no longer used here.

// Example dictionary - in real app this would come from your backend/config
const HIGHLIGHT_DICTIONARY = {
  'react': { 
    hint: 'React.js - Build amazing UIs'
  },
  'redux': {
    hint: 'Redux - State management for React'
  },
  'router': {
    hint: 'React Router - Navigation made easy'
  },
  'quill': { 
    hint: 'Quill.js - Rich text editing'
  },
  'query': {
    hint: 'React Query - Powerful data synchronization'
  },
  'editor': { 
    hint: 'Text Editor - Create and modify content'
  },
  'element': {
    hint: 'React Element - Building blocks of UI'
  },
  'highlight': { 
    hint: 'Highlight - Draw attention to text'
  },
  'hook': {
    hint: 'React Hook - Function-based state management'
  },
  'component': {
    hint: 'React Component - Building blocks of applications'
  },
  'state': {
    hint: 'React State - Dynamic data management'
  },
  'props': {
    hint: 'React Props - Component configuration'
  },
  'effect': {
    hint: 'React Effect - Handle side effects'
  },
  'context': {
    hint: 'React Context - Share data between components'
  },
  'reducer': {
    hint: 'Redux Reducer - State update logic'
  },
  'action': {
    hint: 'Redux Action - Trigger state updates'
  },
  'middleware': {
    hint: 'Redux Middleware - Custom action handling'
  },
  'selector': {
    hint: 'Redux Selector - Access state data'
  },
  'dispatch': {
    hint: 'Redux Dispatch - Trigger state changes'
  },
  'example': {
    hint: 'Example - Illustrative item'
  },
  'действие': {
    hint: 'Действие - Action in Russian'
  }
};

// Convert dictionary to the desired array format
const initialRegisteredActions = Object.entries(HIGHLIGHT_DICTIONARY).map(([word, data]) => ({
  word: word,
  hint: data.hint
}));

// Re-define qualifier options 
const qualifierOptions = [
  { id: "incoming", label: "Incoming" },
  { id: "outgoing", label: "Outgoing" },
  // { id: "scheduled", label: "Scheduled" }, // Removed as per user feedback
];

// Initial state for the editors
const initialActions1 = [
  { id: 'item-act-1', word: 'start_playback', qualifier: 'incoming', equation: '=1', actionNodeType: 'ItemActionNode', actionId: 'Start' },
  { id: 'item-act-2', word: 'set_volume', qualifier: 'outgoing', equation: '>50', actionNodeType: 'ItemActionNode', actionId: 'Stop' },
];

const initialActions2 = [
  { id: 'pl-act-1', word: 'next_track', qualifier: 'incoming', equation: '=1', actionNodeType: 'PlaylistActionNode', actionId: 'next' },
  { id: 'pl-act-2', word: 'pause_all', qualifier: 'scheduled', equation: '<10', actionNodeType: 'PlaylistActionNode', actionId: 'pause' },
];

// Initial state for the third editor (same type as editor 1)
const initialActions3 = [
  { id: 'item-act-3', word: 'another_item_action', qualifier: 'scheduled', equation: '=0', actionNodeType: 'ItemActionNode', actionId: 'Start' },
];

const ActionEditorTestPage = () => {
  const [actionsState1, setActionsState1] = useState(initialActions1);
  const [actionsState2, setActionsState2] = useState(initialActions2);
  const [actionsState3, setActionsState3] = useState(initialActions3);

  // Lifted state for global selection
  const [globallySelectedNode, setGloballySelectedNode] = useState(null);

  // Phase 1: Global focus state
  const [focusedEditor, setFocusedEditor] = useState(null);

  // Phase 2: Debug state
  const [editorsDebugState, setEditorsDebugState] = useState({
    editor1: { text: '', suggestionOpen: false, suggestionQuery: '' },
    editor2: { text: '', suggestionOpen: false, suggestionQuery: '' },
    editor3: { text: '', suggestionOpen: false, suggestionQuery: '' },
  });

  const handleEditorStateChange = useCallback((editorId, newState) => {
    setEditorsDebugState(prev => ({
      ...prev,
      [editorId]: { ...prev[editorId], ...newState },
    }));
  }, []);

  // --- Callbacks for Editor 1 --- //
  const handleActionCreated1 = useCallback((action) => {
    console.log('Action created in Editor 1:', action);
    setActionsState1(prev => [...prev, action]);
  }, []);

  const handleActionDeleted1 = useCallback((actionId) => {
    console.log('Action deleted in Editor 1:', actionId);
    setActionsState1(prev => prev.filter(a => a.id !== actionId));
  }, []);

  const handleActionWordChanged1 = useCallback((actionId, newWord) => {
    console.log('Editor 1 Word Change:', actionId, newWord);
  }, []);

  const handleActionQualifierChanged1 = useCallback((actionId, newQualifier) => {
    console.log('Editor 1 Qualifier Change:', actionId, newQualifier);
  }, []);

  const handleActionEquationChanged1 = useCallback((actionId, newEquation) => {
    console.log('Editor 1 Equation Change:', actionId, newEquation);
  }, []);

  // --- Callbacks for Editor 2 --- //
  const handleActionCreated2 = useCallback((action) => {
    console.log('Action created in Editor 2:', action);
    setActionsState2(prev => [...prev, action]);
  }, []);

  const handleActionDeleted2 = useCallback((actionId) => {
    console.log('Action deleted in Editor 2:', actionId);
    setActionsState2(prev => prev.filter(a => a.id !== actionId));
  }, []);

  const handleActionWordChanged2 = useCallback((actionId, newWord) => {
    console.log('Editor 2 Word Change:', actionId, newWord);
  }, []);

  const handleActionQualifierChanged2 = useCallback((actionId, newQualifier) => {
    console.log('Editor 2 Qualifier Change:', actionId, newQualifier);
  }, []);

  const handleActionEquationChanged2 = useCallback((actionId, newEquation) => {
    console.log('Editor 2 Equation Change:', actionId, newEquation);
  }, []);

  // --- Callbacks for Editor 3 --- //
  const handleActionCreated3 = useCallback((action) => {
    console.log('Action created in Editor 3:', action);
    setActionsState3(prev => [...prev, action]);
  }, []);

  const handleActionDeleted3 = useCallback((actionId) => {
    console.log('Action deleted in Editor 3:', actionId);
    setActionsState3(prev => prev.filter(a => a.id !== actionId));
  }, []);

  const handleActionWordChanged3 = useCallback((actionId, newWord) => {
    console.log('Editor 3 Word Change:', actionId, newWord);
  }, []);

  const handleActionQualifierChanged3 = useCallback((actionId, newQualifier) => {
    console.log('Editor 3 Qualifier Change:', actionId, newQualifier);
  }, []);

  const handleActionEquationChanged3 = useCallback((actionId, newEquation) => {
    console.log('Editor 3 Equation Change:', actionId, newEquation);
  }, []);

  // --- Unified Drop Handler --- //
  const handleActionDrop = useCallback((droppedActionData, targetEditorId, targetIndex) => {
    console.log(`Action dropped:`, droppedActionData, `Target Editor:`, targetEditorId, `Target Index:`, targetIndex);

    // Determine source and target states/setters
    let sourceSetter;
    let targetSetter;

    // Find which state array contains the dropped item's ID
    const isInEditor1 = actionsState1.some(action => action.id === droppedActionData.id);
    const isInEditor2 = actionsState2.some(action => action.id === droppedActionData.id);
    const isInEditor3 = actionsState3.some(action => action.id === droppedActionData.id);

    if (isInEditor1) {
      sourceSetter = setActionsState1;
    } else if (isInEditor2) {
      sourceSetter = setActionsState2;
    } else if (isInEditor3) {
      sourceSetter = setActionsState3;
    } else {
      console.error("Could not find source editor for dropped item:", droppedActionData.id);
      return; // Should not happen if item is dragged from one of the editors
    }

    if (targetEditorId === 'editor1') {
      targetSetter = setActionsState1;
    } else if (targetEditorId === 'editor2') {
      targetSetter = setActionsState2;
    } else if (targetEditorId === 'editor3') {
      targetSetter = setActionsState3;
    } else {
      console.error("Invalid target editor ID:", targetEditorId);
      return;
    }

    // Remove from source
    if (sourceSetter) {
        sourceSetter(prevState => prevState.filter(action => action.id !== droppedActionData.id));
    }

    // Add to target (at specified index or end if null/undefined)
    if (targetSetter) {
        targetSetter(prevState => {
            const newArray = [...prevState];
            // Ensure the dropped data matches the target editor's nodeType structure if necessary
            // (Here, assuming the drop is allowed, so types are compatible)
            const itemToAdd = { ...droppedActionData }; // Create a copy

            if (targetIndex !== null && targetIndex !== undefined && targetIndex >= 0 && targetIndex <= newArray.length) {
                newArray.splice(targetIndex, 0, itemToAdd);
            } else {
                newArray.push(itemToAdd); // Add to end if index is invalid or not provided
            }
            return newArray;
        });
    }

  }, [actionsState1, actionsState2, actionsState3]); // Depend on all states

  // --- Functions for external control buttons (Optional, kept for testing) --- //
  const addExternalAction = () => {
    const newAction = {
      id: `ext-${Date.now()}`,
      word: `ExternalAction${Math.floor(Math.random() * 100)}`,
      qualifier: qualifierOptions[Math.floor(Math.random() * qualifierOptions.length)].id,
      equation: `=${Math.floor(Math.random() * 100)}`,
      actionNodeType: 'ItemActionNode', // Default to item for external add
      actionId: 'Start' // Default actionId
    };
    setActionsState1(prev => [...prev, newAction]);
    console.log('Added external action to Editor 1');
  };

  const removeExternalAction = () => {
    if (actionsState1.length > 0) {
      setActionsState1(prev => prev.slice(0, -1));
      console.log('Removed last action from Editor 1');
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>Action Editor Test Page</h1>

        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
          <button onClick={addExternalAction}>Add Action to Editor 1</button>
          <button onClick={removeExternalAction}>Remove Action from Editor 1</button>
           <button
            onClick={() => setFocusedEditor(null)}
            style={{ padding: '10px', backgroundColor: '#f0f0f0' }}
          >
            Deselect / Blur All Editors
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'stretch' }}>

          {/* Editor Instance 1 */}
          <div style={{ border: '2px solid #ccc', padding: '10px', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
            <h2>Editor 1 (Item Actions)</h2>
            <ActionEditorComponent
              editorId="editor1"
              initialActions={actionsState1}
              registeredActions={initialRegisteredActions}
              qualifierOptions={qualifierOptions}
              onActionCreated={handleActionCreated1}
              onActionDeleted={handleActionDeleted1}
              onActionWordChanged={handleActionWordChanged1}
              onActionQualifierChanged={handleActionQualifierChanged1}
              onActionEquationChanged={handleActionEquationChanged1}
              onActionDrop={handleActionDrop}
              isFocused={focusedEditor === 'editor1'}
              onFocus={() => setFocusedEditor('editor1')}
              onStateChange={handleEditorStateChange}
              editorType="ItemActionEditor"
              globallySelectedNode={globallySelectedNode}
              onNodeSelected={setGloballySelectedNode}
            />
          </div>

          {/* Editor Instance 2 */}
          <div style={{ border: '2px solid #ccc', padding: '10px', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
            <h2>Editor 2 (Playlist Actions)</h2>
            <ActionEditorComponent
              editorId="editor2"
              initialActions={actionsState2}
              registeredActions={initialRegisteredActions} // Using same dictionary for now
              qualifierOptions={qualifierOptions}
              onActionCreated={handleActionCreated2}
              onActionDeleted={handleActionDeleted2}
              onActionWordChanged={handleActionWordChanged2}
              onActionQualifierChanged={handleActionQualifierChanged2}
              onActionEquationChanged={handleActionEquationChanged2}
              onActionDrop={handleActionDrop}
              isFocused={focusedEditor === 'editor2'}
              onFocus={() => setFocusedEditor('editor2')}
              onStateChange={handleEditorStateChange}
              editorType="PlaylistActionEditor"
              globallySelectedNode={globallySelectedNode}
              onNodeSelected={setGloballySelectedNode}
            />
          </div>

          {/* Editor Instance 3 */}
          <div style={{ border: '2px solid #ccc', padding: '10px', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
            <h2>Editor 3 (Another Item Editor)</h2>
            <ActionEditorComponent
              editorId="editor3"
              initialActions={actionsState3}
              registeredActions={initialRegisteredActions}
              qualifierOptions={qualifierOptions}
              onActionCreated={handleActionCreated3}
              onActionDeleted={handleActionDeleted3}
              onActionWordChanged={handleActionWordChanged3}
              onActionQualifierChanged={handleActionQualifierChanged3}
              onActionEquationChanged={handleActionEquationChanged3}
              onActionDrop={handleActionDrop}
              isFocused={focusedEditor === 'editor3'}
              onFocus={() => setFocusedEditor('editor3')}
              onStateChange={handleEditorStateChange}
              editorType="ItemActionEditor"
              globallySelectedNode={globallySelectedNode}
              onNodeSelected={setGloballySelectedNode}
            />
          </div>
        </div>
        
        {/* Phase 2: Debug Display */}
        <div style={{ marginTop: '20px', fontFamily: 'monospace', backgroundColor: '#eee', padding: '10px', borderRadius: '8px' }}>
          <h3>Global and Local Editor State</h3>
          <pre><b>Focused Editor:</b> {focusedEditor || 'none'}</pre>
          <pre>{JSON.stringify(editorsDebugState, null, 2)}</pre>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h2>Current Actions State</h2>
          <pre className="state-display" style={{ background: '#f0f0f0', padding: '10px', fontSize: '0.8em', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(actionsState1, null, 2)}
          </pre>
          <pre className="state-display" style={{ background: '#f0f0f0', padding: '10px', fontSize: '0.8em', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(actionsState2, null, 2)}
          </pre>
          <pre className="state-display" style={{ background: '#f0f0f0', padding: '10px', fontSize: '0.8em', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(actionsState3, null, 2)}
          </pre>
        </div>
      </div>
    </DndProvider>
  );
};

export default ActionEditorTestPage; 