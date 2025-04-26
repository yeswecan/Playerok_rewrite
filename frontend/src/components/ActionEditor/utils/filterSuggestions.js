export function filterSuggestions(query, registeredActions) {
  if (!registeredActions) return [];
  // Ensure query is a string before calling toLowerCase
  const lowerCaseQuery = String(query || '').toLowerCase();
  return registeredActions.filter(action =>
    // Ensure action.word is a string
    typeof action.word === 'string' && action.word.toLowerCase().includes(lowerCaseQuery)
  );
}
