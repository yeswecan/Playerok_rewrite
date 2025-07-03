import { useState, useCallback, useEffect, useRef } from 'react';

const useActionManagement = ({
  initialActions,
  defaultQualifier,
  nodeType,
  actionIdOptions,
  onActionCreated,
  onQualifierChanged,
  onActionWordChanged,
  onActionEquationChanged,
}) => {
  const [actionsState, setActionsState] = useState(() => initialActions || []);
  const actionsStateRef = useRef(actionsState);
  const defaultQualifierRef = useRef(defaultQualifier);

  // Keep refs for callbacks updated
  const onActionCreatedRef = useRef(onActionCreated);
  const onQualifierChangedRef = useRef(onQualifierChanged);
  const onActionWordChangedRef = useRef(onActionWordChanged);
  const onActionEquationChangedRef = useRef(onActionEquationChanged);

  useEffect(() => { onActionCreatedRef.current = onActionCreated; }, [onActionCreated]);
  useEffect(() => { onQualifierChangedRef.current = onQualifierChanged; }, [onQualifierChanged]);
  useEffect(() => { onActionWordChangedRef.current = onActionWordChanged; }, [onActionWordChanged]);
  useEffect(() => { onActionEquationChangedRef.current = onActionEquationChanged; }, [onActionEquationChanged]);


  // Keep actionsStateRef updated
  useEffect(() => {
    actionsStateRef.current = actionsState;
  }, [actionsState]);

  // Sync actionsState with initialActions prop
  useEffect(() => {
    // A simple check to prevent unnecessary re-renders if the prop hasn't actually changed.
    // For a more robust solution, deep equality checks could be used if initialActions were complex.
    if (initialActions !== actionsStateRef.current) {
        setActionsState(initialActions || []);
    }
  }, [initialActions]);

  const addAction = useCallback((word, qualifier) => {
    if (!word) return null;

    const uniqueId = `action_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const defaultActionId = actionIdOptions.length > 0 ? actionIdOptions[0].id : 'defaultActionId';

    const newAction = {
        id: uniqueId,
        word,
        qualifier: qualifier || defaultQualifierRef.current,
        actionNodeType: nodeType,
        actionId: defaultActionId,
        equation: ''
    };
    
    setActionsState(prev => [...prev, newAction]);
    onActionCreatedRef.current?.(newAction);
    
    return newAction; // Return the new action
  }, [nodeType, actionIdOptions]);

  const removeAction = useCallback((nodeId) => {
    setActionsState(prev => prev.filter(action => action.id !== nodeId));
    // Note: The onActionDeleted callback is handled within the TiptapSync hook
    // to ensure it fires only after the editor transaction is complete.
  }, []);

  const reorderActions = useCallback((dragIndex, hoverIndex) => {
    setActionsState(prev => {
      const newActions = [...prev];
      const [draggedItem] = newActions.splice(dragIndex, 1);
      newActions.splice(hoverIndex, 0, draggedItem);
      return newActions;
    });
  }, []);

  const updateActionQualifier = useCallback((nodeId, newQualifier) => {
    setActionsState(prev => {
      const newState = prev.map(action =>
        action.id === nodeId ? { ...action, qualifier: newQualifier } : action
      );
      return newState;
    });
    onQualifierChangedRef.current?.(nodeId, newQualifier);
  }, []);

  const updateActionId = useCallback((nodeId, newActionId) => {
    setActionsState(prev => {
      const newState = prev.map(action =>
        action.id === nodeId ? { ...action, actionId: newActionId } : action
      );
      return newState;
    });
  }, []);

  const updateActionWord = useCallback((nodeId, newWord) => {
    if (!newWord) return;

    setActionsState(prev => prev.map(action =>
        action.id === nodeId ? { ...action, word: newWord } : action
    ));

    onActionWordChangedRef.current?.(nodeId, newWord);
  }, []);

  const updateActionEquation = useCallback((nodeId, newEquation) => {
    setActionsState(prev => prev.map(action =>
      action.id === nodeId ? { ...action, equation: newEquation } : action
    ));
    onActionEquationChangedRef.current?.(nodeId, newEquation);
  }, []);

  return {
    actionsState,
    actionsStateRef,
    addAction,
    removeAction,
    reorderActions,
    updateActionQualifier,
    updateActionId,
    updateActionWord,
    updateActionEquation,
  };
};

export default useActionManagement; 