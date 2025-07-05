# Playerok project

## Specification: Action Editor Component for Playlist Editor

**1. Goal:**
Provide an inline editor experience within a larger application context (e.g., a playlist track) for creating and managing "Actions". These actions consist of names (which are MQTT topic names), **an equation (determining some numerical condition for the action),** and qualifiers (input, output or scheduled) and represent specific events or actions (incoming triggers, outgoing commands, scheduled events) associated with the track. They reflect the name of the MQTT topic the Playerok will either broadcast or react to, **potentially under conditions defined by the equation.**
The component facilitates typing a word, converting it into a distinct visual element (`ActionNode`), allows selecting suggestions via a suggestion menu to help user type in case they want
to enter one of the name that the backend has already observed,
and configuring an associated "qualifier" **and "equation"** for every action node.

**2. Component Hierarchy:**
*   **`ActionEditorTestPage` (`frontend/src/pages/ActionEditorTestPage.jsx`):**
    *   Test page that demonstrates and validates the Action Editor functionality.
    *   Provides test data (`registeredActions`, `qualifierOptions`).
    *   Handles callbacks from the editor (`onActionCreated`, etc.).
    *   Is not part of the component, it's an environment to test it
*   **`ActionEditorComponent` (`frontend/src/components/ActionEditor/ActionEditorComponent.jsx`, re-exported via `src/components/ActionEditor/index.jsx`):**
    *   Main component that implements the Action Editor functionality.
    *   **Manages the internal state (`actionsState` array) which serves as the single source of truth for the actions, including their name, qualifier, and equation.**
    *   Manages the Tiptap editor instance and suggestion menu state.
    *   **Synchronizes the Tiptap editor view FROM the internal `actionsState` using a debounced mechanism to handle rapid state changes efficiently.**
    *   **Synchronizes changes made in the Tiptap editor (like node deletions) BACK TO the internal `actionsState`.**
    *   Coordinates between the extension, suggestion list, and action nodes.
    *   Exposes the required callbacks to parent components.
    *   **Passes update functions (like `updateActionWord`, `updateActionQualifier`, `updateActionEquation`) down to `ActionNodeView` via `HintContext`.**

**3. Core Components:**
*   **`ActionNode`:** A custom Tiptap element visually representing an action word (e.g., a chip/tag).
    *   Displays the `word` (action name).
    *   **Displays the `equation` text visually separated from the `word` by a vertical divider.**
    *   Double-clicking the `word` text enters inline edit mode for the name.
    *   **Single-clicking the `equation` text enters inline edit mode for the equation.**
    *   Contains a dropdown/selector to choose a `qualifier`.
    *   Contains a dropdown/selector to choose an `actionId` (e.g., 'Start', 'Stop'), whose options depend on the node's type.
    *   Includes an "x" button (icon) to the right of the qualifier, within the node boundary, to delete the node.
    *   **Has state for tracking equation validity (`hasEquationError`) and inline editing state (`isEditing`, `isEditingEquation`).**
    *   **Uses refs (`inputRef`, `equationInputRef`, `originalWordRef`, `originalEquationRef`) for managing inline inputs and reverting edits.**
*   **`WordSuggestionExtension`:** A Tiptap extension that:
    *   Detects user input and cursor position relevant to *name* suggestions.
    *   Manages the suggestion menu's state (visibility, items, selection, position) for name editing.
    *   Handles keyboard navigation (Up, Down, Enter, Escape) for the menu.
    *   **Communicates events (like selection, implicit creation triggers) back to `ActionEditorComponent` to update the primary `actionsState`.**
*   **`SuggestionMenu` (`src/components/ActionEditor/components/SuggestionMenu.jsx`):** Renders the suggestion dropdown (items, highlights, selection handlers).
*   **Conversion Logic:** Logic within `ActionEditorComponent` that identifies raw text input and triggers updates to the `actionsState` array, which then causes the Tiptap editor to re-render with the new `ActionNode`.

**4. Functionality:**

*   **Placeholder Text:**
    *   When the main Tiptap editor area is *not* focused (no text cursor active) *and* no `ActionNode` is currently being edited inline, a light gray placeholder text ("Type here to add action...") appears visually appended *after* all existing content (including `ActionNode`s).
    *   It renders on the same line as the last piece of content if space allows.
    *   This placeholder is purely visual (implemented via CSS) and does not affect the actual editor content.
    *   The placeholder disappears as soon as the editor gains focus or an `ActionNode` enters its inline editing state.
*   **Editing Context & Suggestion Triggering:**
    *   Whenever the Tiptap editor gains focus (cursor is active) *and* no inline editing is active, the **Suggestion Menu** appears for adding new actions.
    *   The `WordSuggestionExtension` (`onUpdate`) constantly checks the word the cursor is currently *on* or *inside*.
    *   A "word" is defined as a sequence of letters/numbers.
    *   The currently detected word (`currentQuery`) is used to filter/highlight suggestions.
*   **Suggestion Menu Behavior (for Name):**
    *   **Appearance:** Appears automatically when the editor gains focus (unless inline editing is active). Displays a list based on `registeredActions` provided externally.
        *   **"Add new" Item:** If the current typed text (`currentQuery`) is not empty and is not an exact match for any item in `registeredActions`, a special item is prepended to the list. It displays as "`{currentQuery}` (Add new action)", with the "(Add new action)" part visually distinct (e.g., lighter gray). Selecting this item adds an action with the text from `currentQuery`.
        *   **Highlighting:** Words matching the `currentQuery` (if any) are visually highlighted (given a yellow background).
    *   **Position:** Appears near the current cursor position or below the inline name input. It dynamically adjusts to stay within the viewport. It *must* follow the cursor precisely during general editing. During inline editing of an `ActionNode`'s *name*, the suggestion menu appears positioned directly below the inline input field.
    *   **Disappearance:** Disappears *and editor focus is lost (blurred)* when:
        *   The user selects an item (Enter or Click).
        *   The user opens a dropdown list of qualifiers inside an item.
        *   The user presses `Escape`.
        *   The user clicks outside the editor area.
*   **Suggestion Menu Interaction (for Name):**
    *   **Keyboard:**
        *   `ArrowDown`/`ArrowUp`: Moves the selection cursor in the list. Selection wraps.
        *   `Enter`: Selects the currently selected item.
            *   If "Add new", creates an action with the current query text.
            *   If regular, **triggers update to `ActionEditorComponent`'s `actionsState`**. Component re-renders Tiptap, replacing text with node.
            *   Closes menu and blurs editor.
        *   `Escape`: Closes the menu without selection. Blurs editor.
        *   Typing keys: Highlights words starting with the query. Selection cursor jumps to the first highlight. If no match, jumps to "Add new" if present.
    *   **Mouse:** Clicking an item selects it. **Triggers update to `ActionEditorComponent`'s `actionsState`**. Component re-renders Tiptap. Closes menu and blurs editor.
*   **Word-to-Action Conversion (Automatic):**
    *   **Trigger:** Happens when the user stops editing a specific word by `Space`, cursor move, or `Blur` (if no menu selection).
    *   **Action:**
        1.  Identifies the word.
        2.  **`ActionEditorComponent` updates `actionsState`** (with default qualifier and equation '=1').
        3.  Component re-renders Tiptap, replacing text with `ActionNode`.
        4.  `onActionCreated` callback is triggered.
        5.  Editor blurs, suggestion menu hides.
*   **`ActionNode` Interaction:**
    *   **Editing Name:** Double-clicking the word text enters inline edit mode for the name. Suggestion menu appears positioned below the input. Saving (Enter/blur) **triggers update to `ActionEditorComponent`'s `actionsState`** via context (`updateActionWord`) and triggers `onActionWordChanged`. Escape cancels. Blur editor afterwards.
    *   **Editing Equation:** Single-clicking the equation text enters inline edit mode for the equation. **No suggestion menu appears for equation editing.** Saving (Enter/blur) **triggers update to `ActionEditorComponent`'s `actionsState`** via context (`updateActionEquation`) and triggers `onActionEquationChanged`. Escape cancels. Editor focus remains (or blurs depending on subsequent action).
        *   **Validation:** On commit (Enter/blur), the equation is validated against `/^[=<>]\d+(\.\d+)?$/`. If invalid:
            *   Node gets a thick red border (`hasEquationError` state is true).
            *   A red hint appears on hover: "Error: wrong equation.\nIt should be a =, < or > and then a number".
        *   If valid, red border/hint removed.
    *   **Changing Qualifier:** Clicking the dropdown opens the list. Selecting **triggers update to `ActionEditorComponent`'s `actionsState`** via context (`updateActionQualifier`) and triggers `onQualifierChanged`. Closes suggestion menu if open.
    *   **Selecting (Single Click):** Single-clicking node selects it (border) but does *not* enter edit mode or trigger suggestion menu. Typing or blur deselects.
    *   **Deleting:** Clicking "x" or selecting + Delete/Backspace **triggers update to `ActionEditorComponent`'s `actionsState`** and triggers `onActionDeleted`. Responsibility for actual state removal may lie with parent based on callback response (e.g., confirmation modal). `ActionEditorComponent` updates internal `actionsState` immediately upon Tiptap deletion event.

**5. Key Data & Configuration:**
*   `registeredActions`: List of known action words for name suggestions.
*   `qualifierOptions`: Static list of available qualifiers.
*   `suggestionState`: Internal React state for *name* suggestion menu.
*   **`actionsState`:** **Primary source of truth array in `ActionEditorComponent`: `[{ id: string, word: string, qualifier: string, equation: string, actionNodeType: string, actionId: string }, ...]`.**
*   **ActionNodeView State/Refs:** Internal state (`isEditing`, `isEditingEquation`, `localEquation`, `hasEquationError`) and refs (`inputRef`, `equationInputRef`, `originalWordRef`, `originalEquationRef`) manage the inline editing UI within each node instance.
*   **External state:** Changes to props like `initialActions` correctly update internal `actionsState` and editor view.
*   **Synchronization:** Uses `requestAnimationFrame` for efficient `actionsState` -> Tiptap view updates. Listens for Tiptap editor updates (deletions) to sync back to `actionsState`.

**6. Context Note:**
This component configures actions (outgoing commands, incoming events, scheduled events) for a single playlist track. The equation adds a conditional layer to these actions.

**Current Implementation:** Tested in `frontend/src/pages/ActionEditorTestPage.jsx`, developed primarily in `frontend/src/components/ActionEditor/ActionEditorComponent.jsx`.

