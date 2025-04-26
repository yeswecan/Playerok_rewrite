import React from 'react';

const HintContext = React.createContext({
  showHint: () => {},
  hideHint: () => {},
  updateActionWord: (nodeId, word) => {},
  updateActionQualifier: (nodeId, qualifier) => {},
  updateActionEquation: (nodeId, equation) => {},
  deleteAction: (nodeId) => {},
  setSuggestionState: (state) => {},
  registeredActions: [],
  qualifierOptions: [],
  suggestionStateRef: { current: null },
  openQualifierNodeId: null,
  setOpenQualifierNodeId: (nodeId) => {},
  editingNodeId: null,
});

export default HintContext;
