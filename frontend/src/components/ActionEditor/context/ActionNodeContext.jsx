import React from 'react';

const ActionNodeContext = React.createContext({
  showHint: () => {},
  hideHint: () => {},
  updateActionWord: (nodeId, word) => {},
  updateActionQualifier: (nodeId, qualifier) => {},
  updateActionEquation: (nodeId, equation) => {},
  updateActionId: (nodeId, newActionId) => {},
  deleteAction: (nodeId) => {},
  setSuggestionState: (state) => {},
  registeredActions: [],
  qualifierOptions: [],
  actionIdOptions: [],
  suggestionStateRef: { current: null },
  openQualifierNodeId: null,
  setOpenQualifierNodeId: (nodeId) => {},
  openActionIdNodeId: null,
  setOpenActionIdNodeId: (nodeId) => {},
  editingNodeId: null,
});

export default ActionNodeContext;
