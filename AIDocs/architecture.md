# Architecture: `src/components/ActionEditor`

This document outlines the hook-centric architecture of the Action Editor. The logic is decoupled into specific, reusable hooks, with the main component acting as an orchestrator.

```
src/components/ActionEditor/
│
├── ActionEditorComponent.jsx
│   Orchestrates all hooks, manages top-level UI state (e.g., dropdown visibility), and provides the ActionNodeContext.
│
├── components/
│   ├── ActionNodeView.jsx
│   │   The React component that renders each `actionNode`. Handles local UI interactions like inline editing and dropdowns.
│   ├── SuggestionMenu.jsx
│   │   Renders the suggestion list popup.
│   ├── TipTapEditorComponent.jsx
│   │   A wrapper component that contains the Tiptap `EditorContent`.
│   └── HintTooltip.jsx
│       Renders a tooltip for hints (e.g., equation errors).
│
├── context/
│   └── ActionNodeContext.jsx
│       React context for providing all necessary data (e.g., `qualifierOptions`) and callbacks from the main component down to the `ActionNodeView`.
│
├── extensions/
│   ├── actionNodeExtension.js
│   │   Defines the Tiptap `ActionNode` schema, attributes, and its link to the `ActionNodeView` React component.
│   └── wordSuggestionExtension.js
│       Tiptap extension that manages suggestion logic, keyboard shortcuts (Space, Enter), and focus/blur events to trigger actions.
│
├── hooks/
│   ├── useActionManagement.js
│   │   **Core State Hook.** The single source of truth for action data. Manages the `actionsState` array and exposes functions like `addAction`, `removeAction`, `reorderActions`, and `updateAction...`.
│   │
│   ├── useActionNodeDnd.js
│   │   Manages all `react-dnd` drag-and-drop logic for action nodes, including inter-editor drops and intra-editor reordering.
│   │
│   ├── useSuggestionManagement.js
│   │   Manages the state and behavior of the suggestion menu, including its visibility, item filtering, and selection handling.
│   │
│   └── useTiptapSync.js
│       Synchronizes the React `actionsState` with the Tiptap editor. It renders the React state to Tiptap and analytically detects deletions in Tiptap to sync them back.
│
└── utils/
    ├── filterSuggestions.js
    │   Helper function to filter suggestion items based on a query.
    └── ... (other helpers)

``` 