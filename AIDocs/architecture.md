# Architecture: `src/components/ActionEditor`

```
src/components/ActionEditor/
├── index.jsx
│   Re‑exports the main `ActionEditorComponent`.
├── ActionEditorComponent.jsx
│   Orchestrates TipTap setup, HintContext provider, extensions, and renders the editor wrapper.
├── context/
│   └── HintContext.jsx
│       React context for exposing hint tooltip controls and action‑update callbacks.
├── components/
│   ├── ActionNodeView.jsx
│   │   React NodeView rendering each action: word + equation + qualifier + delete.
│   └── SuggestionMenu.jsx
│       Renders the suggestion dropdown (items, highlights, selection handlers).
├── extensions/
│   ├── actionNodeExtension.js
│   │   Defines the Tiptap `ActionNode` schema and NodeViewRenderer integration.
│   └── wordSuggestionExtension.js
│       Defines the Tiptap suggestion plugin (query logic, key handlers).
├── hooks/
│   ├── useActionsStateSync.js
│   │   Custom hook synchronizing React `actionsState` ↔ Tiptap document content.
│   └── useSuggestionPosition.js
│       Hook to calculate and request updates for suggestion/hint coordinates.
└── utils/
    ├── filterSuggestions.js
    │   Pure helper to filter `registeredActions` by substring match.
    └── calculateCoords.js
        Helpers for on‑screen positioning of menus and tooltips.
``` 