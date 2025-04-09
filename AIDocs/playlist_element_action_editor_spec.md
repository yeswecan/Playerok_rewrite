# Specification: Playerok - Action Editor Component for Playlist Editor

**1. Goal:**
Provide an inline editor experience within a larger application context (e.g., a playlist track) for creating and managing "Action Words". These words represent specific events or actions (incoming triggers, outgoing commands, scheduled events) associated with the track. They reflect the name of the MQTT topic the Playerok will either broadcast or react to. 
The component facilitates typing a word, converting it into a distinct visual element (`ActionNode`), selecting suggestions, and configuring an associated "qualifier".

**2. Component Hierarchy:**
*   **`TextEditorPage` (`frontend/src/pages/test_TextEditorPage.jsx`):**
    *   Test page that demonstrates and validates the Action Editor functionality.
    *   Provides test data (`registeredActions`, `qualifierOptions`).
    *   Handles callbacks from the editor (`onActionCreated`, etc.).
*   **`ActionEditorComponent` (`frontend/src/components/ActionEditorComponent.jsx`):**
    *   Main component that implements the Action Editor functionality.
    *   Manages the Tiptap editor instance and suggestion state.
    *   Coordinates between the extension, suggestion list, and action nodes.
    *   Exposes the required callbacks to parent components.

**3. Core Components:**
*   **`ActionNode`:** A custom Tiptap element visually representing an action word (e.g., a chip/tag).
    *   Displays the `word`.
    *   (TODO) The `word` text displayed within the node *must be editable* (e.g., clicking into it allows modification).
    *   Contains a dropdown/selector to choose a `qualifier`.
    *   Includes an "x" button (icon) to the right of the word text, within the node boundary, to delete the node.
*   **`WordSuggestionExtension`:** A Tiptap extension that:
    *   Detects when the user's cursor is inside a potential action word.
    *   Manages the suggestion menu's state (visibility, items, selection, position).
    *   Handles keyboard navigation (Up, Down, Enter, Escape) for the menu.
    *   Handles selection updates to keep the menu positioned correctly.
*   **`SuggestionList`:** A React component that renders the suggestion menu based on state provided by the extension. Handles click selection.
*   **Conversion Logic (`turnTextIntoActionNode` + Space/Blur/Move handlers):** Logic that automatically converts the currently edited word into an `ActionNode` when the editing context ends for that word.

**4. Functionality:**

*   **Editing Context & Suggestion Triggering:**
    *   Whenever the Tiptap editor has focus (cursor is active), the **Suggestion Menu** appears.
    *   The `WordSuggestionExtension` (`onUpdate`) constantly checks the word the cursor is currently *on* or *inside*.
    *   A "word" is defined as a sequence of letters/numbers.
    *   The currently detected word (`currentQuery`) is used to filter/highlight suggestions.
*   **Suggestion Menu Behavior:**
    *   **Appearance:** Appears automatically when the editor gains focus. Displays a list based on `registeredActions` provided externally. Words matching the `currentQuery` (if any) are visually highlighted (e.g., bolded).
    *   **Position:** Appears near the current cursor position. It dynamically adjusts to stay within the viewport (e.g., appears above if the cursor is near the bottom, left if near the right). It *must* follow the cursor precisely as it moves.
    *   **Disappearance:** Disappears *and editor focus is lost (blurred)* when:
        *   The user selects an item (Enter or Click).
        *   The user presses `Escape`.
        *   The user clicks outside the editor area.
    *   **Reappearance:** Appears again when the editor regains focus.
*   **Suggestion Menu Interaction:**
    *   **Keyboard:**
        *   `ArrowDown`/`ArrowUp`: Changes the highlighted item in the list, wrapping around. (Handled by `WordSuggestionExtension`).
        *   `Enter`: Selects the currently highlighted item, triggering the `turnTextIntoActionNode` function for that item, replacing the typed text. Closes menu and blurs editor. (Handled by `WordSuggestionExtension`).
        *   `Escape`: Closes the menu without selection. Blurs editor. (Handled by `WordSuggestionExtension`).
    *   **Mouse:** Clicking an item selects it, triggering the `turnTextIntoActionNode` function for that item, replacing the typed text. Closes menu and blurs editor. (Handled by `SuggestionList`).
*   **Word-to-Action Conversion (Automatic):**
    *   **Trigger:** Happens when the user stops editing a specific word by:
        1.  Pressing `Space`.
        2.  Moving the cursor *away* from the current word (e.g., clicking elsewhere in the text, using arrow keys to leave the word boundaries).
        3.  The editor loses focus (`Blur` event), *if* an item wasn't explicitly selected from the menu.
    *   **Action:**
        1.  The word the user was just editing is identified.
        2.  It doesn't matter if this word exists in `registeredActions` or not.
        3.  An `ActionNode` is created using the typed `word` and a default `qualifier`.
        4.  The original word text is replaced by the new `ActionNode`.
        5.  The `onActionCreated(word, qualifier)` callback *must* be triggered, allowing the parent to update `registeredActions` if needed.
*   **`ActionNode` Interaction:**
    *   **Editing Name:** (TODO) Clicking the word text within the `ActionNode` should allow the user to edit it directly. This might involve temporarily replacing the node with a text input or using Tiptap's contenteditable features carefully. Saving the edit *must* trigger the `onActionWordChanged(nodeId, newWord)` callback.
    *   **Changing Qualifier:** Clicking the `ActionNode`'s dropdown area opens a list of `qualifierOptions`. Selecting a qualifier updates the node's internal state and *must trigger an external event/callback* provided by the parent component (`onQualifierChanged(nodeId, newQualifier)`), passing the node identifier and the new qualifier.
    *   **Deleting:** Clicking the "x" button (located to the right of the word within the node) removes the `ActionNode` from the editor content and *must* trigger the `onActionDeleted(nodeId)` callback.

**5. Key Data & Configuration:**
*   `registeredActions`: A list/map of known action words, provided and potentially updated by the parent component/external system. Used to populate/filter the suggestion list.
*   `qualifierOptions`: Static list of available qualifiers (e.g., `[{ id: 'todo', label: 'To Do' }, ...]`). Provided by the parent.
*   `suggestionState`: Internal React state (`useState`) holding menu data (`visible`, `items`, `highlightedItems`, `coords`, `selectedIndex`, `query`).
*   **External Callbacks:** The component needs to accept callbacks from its parent for:
    *   `onActionCreated(word, qualifier)`
    *   `onActionDeleted(nodeId)`
    *   `onQualifierChanged(nodeId, newQualifier)`
    *   `onActionWordChanged(nodeId, newWord)`

**6. Context Note:**
This component is intended for use within a larger system managing playlists. The "Actions" typically represent outgoing commands triggered when a track plays, incoming events that trigger a track, or scheduled playback times. This component allows configuration of these actions for a single track element.

**(Current Implementation:** This specification is being implemented and tested in `frontend/src/pages/test_TextEditorPage.jsx`.)

---

## Development Rules (Based on Experience)

1.  **Prefer Extensions for Core Logic:** For complex, state-dependent editor behaviors (suggestions, custom commands, focus/blur side effects), favor creating custom Tiptap Extensions over relying solely on handlers passed via `editorProps`. Extension lifecycle hooks (`onUpdate`, `onFocus`, `onBlur`, `addKeyboardShortcuts`) integrate more reliably.
2.  **Isolate State Updates from Keyboard Shortcuts:** Avoid directly reading or setting rapidly changing React state within `addKeyboardShortcuts` closures, as they often capture stale state.
    *   **Use Event Emitters:** The most robust pattern is for shortcuts to `editor.emit('custom-event')` and `return true`. Have a React `useEffect` listen via `editor.on('custom-event', handler)` where `handler` accesses current state and calls setters.
    *   *(Alternative, Use Refs Carefully):* Passing a `ref` containing state (`ref.current`) *can* work for *reading* state in shortcuts, but setting state from shortcuts this way remains tricky. The event emitter pattern is generally safer.
3.  **Sequence Tiptap Commands and State Updates:** When a single user action needs to modify Tiptap content *and* React state (e.g., selecting a suggestion):
    *   Execute the Tiptap command chain (`editor.chain()...run()`) *first*.
    *   *Then*, update the React state (`setState`).
    *   If `flushSync` or timing warnings occur, *cautiously* consider deferring the `setState` call slightly (e.g., `requestAnimationFrame`), but be aware this can introduce its own complexities if not managed carefully.
4.  **Manage Focus with `onMouseDown`:** For UI elements outside Tiptap that interact with the editor state (like suggestion list items), use `onMouseDown={(e) => e.preventDefault(); /* handle action */}` instead of `onClick` to prevent the editor from losing focus prematurely before your action handler runs.
5.  **Stable Handlers with `useCallback`:** Ensure any handlers passed down as props (like `handleSelect` passed to `SuggestionList`) or used in `useEffect` dependencies are memoized with `useCallback` and have correct dependency arrays to prevent unnecessary re-renders or stale closures.
6.  **Verify Extension Dependencies:** When using `useMemo` for the `extensions` array, be mindful of dependencies. Including frequently changing React state can cause unnecessary extension re-initialization, potentially breaking internal extension state or listeners. Use refs or stable accessors (`getSomethingRef.current()`) passed via `configure` where possible.
7.  **Thorough Logging:** When debugging complex interactions, log state *at the point of use* within handlers/effects (both in React and the Extension) to verify you're not operating on stale data. Log event triggers (`onFocus`, `onUpdate`, shortcut handlers) to confirm they are firing as expected.