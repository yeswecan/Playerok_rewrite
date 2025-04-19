import React, { useState, useEffect } from 'react';
import ActionEditorComponent from '../components/ActionEditor';

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
  { id: "scheduled", label: "Scheduled" },
];

const ActionEditorTestPage = () => {
  // Use the formatted array for initial state
  const [registeredActions, setRegisteredActions] = useState(initialRegisteredActions);

  // --- Step 8: Define meaningful initial state --- 
  const [testActions, setTestActions] = useState([
    { id: 'init1', word: 'startup', qualifier: 'outgoing', hint: `Hint: ${Math.random().toFixed(3)}` },
    { id: 'init2', word: 'another', qualifier: 'scheduled', hint: `Hint: ${Math.random().toFixed(3)}` }
  ]);

  // --- Step 8: Function to add an action externally ---
  const addExternalAction = () => {
    const newAction = {
      id: `external_${Date.now()}`,
      word: 'externalAction',
      qualifier: 'incoming',
      hint: `Hint: ${Math.random().toFixed(3)}`
    };
    setTestActions(prev => [...prev, newAction]);
    console.log('[ActionEditorTestPage] Added external action. New state:', [...testActions, newAction]);
  };

  // --- Step 8: Function to remove an action externally ---
  const removeExternalAction = () => {
    if (testActions.length > 0) {
        const idToRemove = testActions[0].id;
        setTestActions(prev => prev.filter(action => action.id !== idToRemove));
        console.log(`[ActionEditorTestPage] Removed external action (ID: ${idToRemove}). New state:`, testActions.filter(action => action.id !== idToRemove));
    } else {
        console.log('[ActionEditorTestPage] No actions to remove.');
    }
  };

  // Callback handlers
  const handleActionCreated = (id, word, qualifier) => {
    console.log(`[ActionEditorTestPage] Action created: ${word} (${qualifier}) - ID: ${id}`);
    // Update local state ONLY if the action isn't already there (handles sync)
    const newHint = `Hint: ${Math.random().toFixed(3)}`;
    setTestActions(prev => {
        if (prev.some(a => a.id === id)) {
            return prev; // Already exists, likely from initial state or external add
        }
        return [...prev, { id, word, qualifier, hint: newHint }];
    });
    // Update registered actions if the word is new
    if (!registeredActions.some(action => action.word === word)) {
      setRegisteredActions(prev => [...prev, { word: word, hint: `Hint for new: ${word}` }]);
    }
  };

  const handleActionDeleted = (nodeId) => {
    console.log(`[ActionEditorTestPage] Action deleted callback: ${nodeId}`);
    // Update local state to remove the action
    setTestActions(prev => prev.filter(action => action.id !== nodeId));
  };

  const handleQualifierChanged = (nodeId, newQualifier) => {
    console.log(`[ActionEditorTestPage] Qualifier changed for ${nodeId}: ${newQualifier}`);
    // Update local state
    setTestActions(prev => prev.map(action =>
        action.id === nodeId ? { ...action, qualifier: newQualifier } : action
    ));
  };

  const handleActionWordChanged = (nodeId, newWord) => {
    console.log(`[DEBUG][ActionEditorTestPage] handleActionWordChanged called for nodeId: ${nodeId}, newWord: ${newWord}`);
    // Update local state
    setTestActions(prev => prev.map(action =>
        action.id === nodeId ? { ...action, word: newWord } : action
    ));
  };

  // --- Add a useEffect to log when testActions changes --- 
  useEffect(() => {
    console.log('[ActionEditorTestPage] testActions state updated:', testActions);
  }, [testActions]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Action Editor Test Page</h1>

      {/* --- Step 8: Add buttons for external control --- */}
      <div className="mb-4 space-x-2">
          <button
              onClick={addExternalAction}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
              Add action node
          </button>
          <button
              onClick={removeExternalAction}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          >
              Remove first action node
          </button>
      </div>

      <div className="border rounded-lg shadow-sm">
        <ActionEditorComponent
          registeredActions={registeredActions} // Pass the dynamic list of objects
          qualifierOptions={qualifierOptions}
          defaultQualifier="incoming"
          onActionCreated={handleActionCreated}
          onActionDeleted={handleActionDeleted}
          onQualifierChanged={handleQualifierChanged}
          onActionWordChanged={handleActionWordChanged}
          placeholder="Type to add actions..."
          initialActions={testActions} // Pass the state variable
        />
      </div>

      {/* Optional: Display current state for debugging */}
      <div className="mt-4 p-2 border bg-gray-50 rounded">
          <h2 className="text-lg font-semibold">Current Parent State (testActions):</h2>
          <pre className="text-xs">{JSON.stringify(testActions, null, 2)}</pre>
      </div>
    </div>
  );
};

export default ActionEditorTestPage; 