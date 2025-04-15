# Playerok project

## Specification: Action Editor Component for Playlist Editor

**1. Goal:**
Provide an inline editor experience within a larger application context (e.g., a playlist track) for creating and managing "Actions". These action consist of names (which are MQTT topic names) and qualifiers (input, output or scheduled) and represent specific events or actions (incoming triggers, outgoing commands, scheduled events) associated with the track. They reflect the name of the MQTT topic the Playerok will either broadcast or react to. 
The component facilitates typing a word, converting it into a distinct visual element (`ActionNode`), allows selecting suggestions via a suggestion menu to help user type in case they want
to enter one of the name that the backend has already observed, 
and configuring an associated "qualifier" for every action node.

**2. Component Hierarchy:**
*   **`TextEditorPage` (`frontend/src/pages/test_TextEditorPage.jsx`):**
    *   Test page that demonstrates and validates the Action Editor functionality.
    *   Provides test data (`registeredActions`, `qualifierOptions`).
    *   Handles callbacks from the editor (`onActionCreated`, etc.).
    *   Is not part of the component, it's an environment to test it
*   **`ActionEditorComponent` (`frontend/src/components/ActionEditorComponent.jsx`):**
    *   Main component that implements the Action Editor functionality.
    *   **Manages the internal state (`actionsState` array) which serves as the single source of truth for the actions.**
    *   Manages the Tiptap editor instance and suggestion menu state.
    *   **Synchronizes the Tiptap editor view FROM the internal `actionsState` using a debounced mechanism to handle rapid state changes efficiently.**
    *   **Synchronizes changes made in the Tiptap editor (like node deletions) BACK TO the internal `actionsState`.**
    *   Coordinates between the extension, suggestion list, and action nodes.
    *   Exposes the required callbacks to parent components.

**3. Core Components:**
*   **`ActionNode`:** A custom Tiptap element visually representing an action word (e.g., a chip/tag).
    *   Displays the `word`.
    *   Double-clicking the word text enters inline edit mode with an input field.
    *   Contains a dropdown/selector to choose a `qualifier`.
    *   Includes an "x" button (icon) to the right of the word text, within the node boundary, to delete the node.
*   **`WordSuggestionExtension`:** A Tiptap extension that:
    *   Detects user input and cursor position relevant to suggestions.
    *   Manages the suggestion menu's state (visibility, items, selection, position).
    *   Handles keyboard navigation (Up, Down, Enter, Escape) for the menu.
    *   **Communicates events (like selection, implicit creation triggers) back to `ActionEditorComponent` to update the primary `actionsState`.**
*   **`SuggestionList`:** A React component that renders the suggestion menu based on state provided by the extension. Handles click selection.
*   **Conversion Logic:** Logic within `ActionEditorComponent` that identifies raw text input and triggers updates to the `actionsState` array, which then causes the Tiptap editor to re-render with the new `ActionNode`.

**4. Functionality:**

*   **Placeholder Text:**
    *   When the main Tiptap editor area is *not* focused (no text cursor active) *and* no `ActionNode` is currently being edited inline, a light gray placeholder text ("Type here to add action...") appears visually appended *after* all existing content (including `ActionNode`s).
    *   It renders on the same line as the last piece of content if space allows.
    *   This placeholder is purely visual (implemented via CSS) and does not affect the actual editor content.
    *   The placeholder disappears as soon as the editor gains focus or an `ActionNode` enters its inline editing state.
*   **Editing Context & Suggestion Triggering:**
    *   Whenever the Tiptap editor gains focus (cursor is active), the **Suggestion Menu** appears.
    *   The `WordSuggestionExtension` (`onUpdate`) constantly checks the word the cursor is currently *on* or *inside*.
    *   A "word" is defined as a sequence of letters/numbers.
    *   The currently detected word (`currentQuery`) is used to filter/highlight suggestions.
*   **Suggestion Menu Behavior:**
    *   **Appearance:** Appears automatically when the editor gains focus. Displays a list based on `registeredActions` provided externally. 
        *   **"Add new" Item:** If the current typed text (`currentQuery`) is not empty and is not an exact match for any item in `registeredActions`, a special item is prepended to the list. It displays as "`{currentQuery}` (Add new action)", with the "(Add new action)" part visually distinct (e.g., lighter gray). Selecting this item adds an action with the text from `currentQuery`.
        *   **Highlighting:** Words matching the `currentQuery` (if any) are visually highlighted (given a yellow background).
    *   **Position:** Appears near the current cursor position. It dynamically adjusts to stay within the viewport (e.g., appears above if the cursor is near the bottom, left if near the right), but never obscures the text the user is editing. It *must* follow the cursor precisely as it moves. (TODO: Implement full dynamic viewport adjustment). During inline editing of an `ActionNode`'s word, the suggestion menu appears positioned directly below the inline input field.
    *   **Disappearance:** Disappears *and editor focus is lost (blurred)* when:
        *   The user selects an item (Enter or Click).
        *   The user opens a dropdown list of qualifiers inside an item (even though 
        this should select an item too, still applies to menu behavior)
        *   The user presses `Escape`.
        *   The user clicks outside the editor area.
*   **Suggestion Menu Interaction:**
    *   **Keyboard:**
        *   `ArrowDown`/`ArrowUp`: Moves the selection cursor in the list, which is not the same as highlighted items. Selection wraps around all the elements of the menu. (Handled by `WordSuggestionExtension`).
        *   `Enter`: Selects the currently selected item. 
            *   If the selected item is the special "Add new" item, it triggers the creation of an action using the current query text.
            *   If the selected item is a regular registered action, **this triggers an update to the `ActionEditorComponent`'s `actionsState`**. The component then re-renders Tiptap, replacing the text with the node.
            *   Closes menu and blurs editor. (Signaled by `WordSuggestionExtension`, handled by `ActionEditorComponent`).
        *   `Escape`: Closes the menu without selection. Blurs editor. (Signaled by `WordSuggestionExtension`).
        *   Typing keys: since suggestion menu follows the cursor and follows the user
        as they type the action name, the list of highlighted words in the menu reflects the words in the `registeredActions` list that have the word the user is entering in the beginning. Each time user types a key,
        the selection cursor jumps to the first of these highlights, and the menu scrolls to
        show that element. 
        *   If no registered action starts with the current query, but the query is not empty, the selection cursor jumps to the special "Add new" item (if present).
        *   Moving up or down after that moves the cursor normally,
        so that synchronisation between highlighted elements and selection cursor only
        happens when the user types a symbol, other than arrow key.
        There's no filtering in the suggestion menu, all the available options are always there.
    *   **Mouse:** Clicking an item selects it. **This triggers an update to the `ActionEditorComponent`'s `actionsState`**. The component then re-renders Tiptap, replacing the text with the node. Closes menu and blurs editor. (Handled by `SuggestionList`, communicated to `ActionEditorComponent`).
*   **Word-to-Action Conversion (Automatic):**
    *   **Trigger:** Happens when the user stops editing a specific word by:
        1.  Pressing `Space` (outside the inline editor).
        2.  Moving the cursor *away* from the current word (e.g., clicking elsewhere in the text, using arrow keys to leave the word boundaries) - **(Note: Cursor move trigger might be less reliable or deferred depending on implementation details)**.
        3.  The editor loses focus (`Blur` event), *if* an item wasn't explicitly selected from the menu.
    *   **Action:**
        1.  The word the user was just editing is identified (via analysis of Tiptap state vs. React state).
        2.  It doesn't matter if this word exists in `registeredActions` or not.
        3.  **The `ActionEditorComponent` updates its `actionsState` array** with the new action (using a default qualifier).
        4.  The component's synchronization logic re-renders the Tiptap editor, replacing the original word text with the new `ActionNode`.
        5.  The `onActionCreated(word, qualifier)` callback *must* be triggered, allowing the parent to update `registeredActions` if needed.
        6.  The editor blurs and the suggestion menu hides.
*   **`ActionNode` Interaction:**
    *   **Editing Name:** Double-clicking the word text within the `ActionNode` enters inline edit mode with an input field. Suggestion menu immediately appears (if it was hidden), moving to a cursor inside the inline editor, but following the placement rules outlined in the section about it. Saving the edit (via Enter or blur) **triggers an update to the `ActionEditorComponent`'s `actionsState`** and triggers the `onActionWordChanged(nodeId, newWord)` callback. Pressing Escape cancels editing. After committing or cancelling, the editor automatically blurs, hiding the suggestion menu.
    *   **Changing Qualifier:** Clicking the `ActionNode`'s dropdown area opens a list of `qualifierOptions`. Selecting a qualifier **triggers an update to the `ActionEditorComponent`'s `actionsState`** and *must trigger* the `onQualifierChanged(nodeId, newQualifier)` callback. There's three possible options - incoming, outgoing and scheduled. Opening qualifier menu closes the suggestion menu if it is open and selects the node on which the qualifier menu is.
    *   **Selecting (Single Click):** Single-clicking anywhere on the `ActionNode` (including the word text or qualifier) selects the node (indicated by a border) but does *not* enter inline edit mode and does *not* trigger the main suggestion menu. Typing before or after the ActionNode or blurring the action editor deselects the node.
    *   **Deleting:** Clicking the "x" button OR selecting the node and pressing Delete/Backspace **triggers an update to the `ActionEditorComponent`'s `actionsState`** and *must* trigger the `onActionDeleted(nodeId)` callback. Another way to delete an ActionNode is to select it, press delete or backspace. A placeholder exists to make it possible to show a modal window prompting the user to ask if they want to delete the action. Therefore the responsibility to modify the state will lie on the parent component.
    `ActionEditorComponent` updates its internal `actionsState` directly upon detecting the deletion. The `onActionDeleted(nodeId)` callback *must* still be triggered, allowing the parent component to react (e.g., show a confirmation modal if desired, or perform other side effects).

**5. Key Data & Configuration:**
*   `registeredActions`: A list/map of known action words, provided and potentially updated by the parent component/external system. Used to populate/filter the suggestion list.
*   `qualifierOptions`: Static list of available qualifiers (e.g., `[{ id: 'todo', label: 'To Do' }, ...]`). Provided by the parent.
*   `suggestionState`: Internal React state (`useState`) holding menu data (`visible`, `items`, `highlightedItems`, `coords`, `selectedIndex`, `query`).
*   **`actionsState`:** **The primary source of truth, an internal React state (`useState`) array in `ActionEditorComponent` like `[{ id: string, word: string, qualifier: string }, ...]`.**
*   **External state:** The component manages the state that it doesn't own. **Changes to props like `initialActions` should correctly re-initialize or update the internal `actionsState` and subsequently the editor view.**
*   **Synchronization:** The component uses **`requestAnimationFrame`** to efficiently synchronize the Tiptap editor view whenever the internal `actionsState` changes, aligning the update with the browser's rendering cycle. It also listens for editor updates to synchronize deletions back to `actionsState`.

**6. Context Note:**
This component is intended for use within a larger system managing playlists. The "Actions" represent outgoing commands triggered when a track plays, incoming events that trigger a track, or scheduled playback times. This component allows configuration of these actions for a single track element.

**Current Implementation:** This specification is being tested in `frontend/src/pages/test_TextEditorPage.jsx` but is developed in [text](../frontend/src/components/ActionEditorComponent.jsx) and other
files included within it.

