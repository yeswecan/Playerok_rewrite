import React, { useState } from 'react';
import ActionEditorComponent from '../components/ActionEditorComponent';

// Example dictionary - in real app this would come from your backend/config
const HIGHLIGHT_DICTIONARY = {
  'react': { 
    description: 'A JavaScript library for building user interfaces',
    hint: 'React.js - Build amazing UIs'
  },
  'redux': {
    description: 'A predictable state container for JavaScript apps',
    hint: 'Redux - State management for React'
  },
  'router': {
    description: 'A routing library for React applications',
    hint: 'React Router - Navigation made easy'
  },
  'quill': { 
    description: 'A modern WYSIWYG editor built for compatibility and extensibility',
    hint: 'Quill.js - Rich text editing'
  },
  'query': {
    description: 'A data-fetching and state management library',
    hint: 'React Query - Powerful data synchronization'
  },
  'editor': { 
    description: 'A program for editing and manipulating text',
    hint: 'Text Editor - Create and modify content'
  },
  'element': {
    description: 'A basic unit of UI in React applications',
    hint: 'React Element - Building blocks of UI'
  },
  'highlight': { 
    description: 'To emphasize or make prominent',
    hint: 'Highlight - Draw attention to text'
  },
  'hook': {
    description: 'A function that lets you use state and other React features',
    hint: 'React Hook - Function-based state management'
  },
  'component': {
    description: 'A reusable piece of UI in React',
    hint: 'React Component - Building blocks of applications'
  },
  'state': {
    description: 'Data that can change over time in React',
    hint: 'React State - Dynamic data management'
  },
  'props': {
    description: 'Properties passed to React components',
    hint: 'React Props - Component configuration'
  },
  'effect': {
    description: 'Side effects in React components',
    hint: 'React Effect - Handle side effects'
  },
  'context': {
    description: 'Global state management in React',
    hint: 'React Context - Share data between components'
  },
  'reducer': {
    description: 'A function that determines state changes',
    hint: 'Redux Reducer - State update logic'
  },
  'action': {
    description: 'A description of state changes in Redux',
    hint: 'Redux Action - Trigger state updates'
  },
  'middleware': {
    description: 'Functions that intercept Redux actions',
    hint: 'Redux Middleware - Custom action handling'
  },
  'selector': {
    description: 'Functions to extract data from Redux state',
    hint: 'Redux Selector - Access state data'
  },
  'dispatch': {
    description: 'Function to send actions to Redux store',
    hint: 'Redux Dispatch - Trigger state changes'
  },
  'example': {
      description: 'A thing characteristic of its kind or illustrating a general rule',
      hint: 'Example - Illustrative item'
  },
  'действие': {
      description: 'Process of doing something',
      hint: 'Действие - Action in Russian'
  }
};

// Re-define qualifier options 
const qualifierOptions = [
  { id: "incoming", label: "Incoming" },
  { id: "outgoing", label: "Outgoing" },
  { id: "scheduled", label: "Scheduled" },
];

// Default content with dictionary words
const DEFAULT_CONTENT = `Edit input or output actions here. Try typing action, component, or state.`;

const ActionEditorTestPage = () => {
  const [registeredActions, setRegisteredActions] = useState(Object.keys(HIGHLIGHT_DICTIONARY));

  // Callback handlers
  const handleActionCreated = (word, qualifier) => {
    console.log(`[ActionEditorTestPage] Action created: ${word} (${qualifier})`);
    if (!registeredActions.includes(word)) {
      setRegisteredActions(prev => [...prev, word]);
    }
  };

  const handleActionDeleted = (nodeId) => {
    console.log(`[ActionEditorTestPage] Action deleted: ${nodeId}`);
  };

  const handleQualifierChanged = (nodeId, newQualifier) => {
    console.log(`[ActionEditorTestPage] Qualifier changed for ${nodeId}: ${newQualifier}`);
  };

  const handleActionWordChanged = (nodeId, newWord) => {
    console.log(`[DEBUG][ActionEditorTestPage] handleActionWordChanged called for nodeId: ${nodeId}, newWord: ${newWord}`);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Action Editor Test Page</h1>
      <div className="border rounded-lg shadow-sm">
        <ActionEditorComponent
          registeredActions={Object.keys(HIGHLIGHT_DICTIONARY)}
          qualifierOptions={qualifierOptions}
          defaultQualifier="incoming"
          onActionCreated={handleActionCreated}
          onActionDeleted={handleActionDeleted}
          onQualifierChanged={handleQualifierChanged}
          onActionWordChanged={handleActionWordChanged}
          initialContent={''}
          placeholder="Type to add actions..."
        />
      </div>
    </div>
  );
};

export default ActionEditorTestPage; 