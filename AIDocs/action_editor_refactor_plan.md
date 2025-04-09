**Overall Assessment:**

1.  **Fragility Confirmed:** The current implementation suffers from tight coupling and race conditions. State updates are likely happening from multiple places (extension event handlers, React effects) without proper synchronization, leading to the observed fragility where fixing one bug introduces another.
2.  **State Ownership Unclear:** It's ambiguous whether the Tiptap extension or the React component "owns" the suggestion menu's state (visibility, items, coordinates). This ambiguity is a major source of problems.
3.  **Timing Issues:** Relying on refs (`editorContainerRef`) or React state (`suggestionStateRef.current`) directly within asynchronous Tiptap event handlers (`onFocus`, `onUpdate`, etc.) is inherently risky due to the timing differences between Tiptap's transaction processing and React's render/commit cycle.
4.  **Complexity:** The desired features (suggestions, automatic node conversion, inline node editing, qualifier dropdown) create a complex UI state that needs careful management.

**Proposed Architecture (Reinforcing the Developer's Plan):**

1.  **React Owns UI State:** The `ActionEditorComponent` will be the *single source of truth* for the `suggestionState` (visibility, items, highlighted items, selected index, coordinates, query).
2.  **Tiptap Extension Signals:** The `WordSuggestionExtension`'s role is primarily to:
    *   Detect potential suggestion contexts based on editor state (`apply` method in plugin state).
    *   Store minimal, temporary state *within the Tiptap plugin state* if needed for decoration rendering (like the `range` and `decorationId`).
    *   Handle keyboard shortcuts (`handleKeyDown`) *only* to emit custom events (e.g., `suggestion:nav_up`, `suggestion:select`) or return `false` to allow default Tiptap behavior. It should *not* directly manipulate React state.
    *   Use Tiptap lifecycle hooks (`onFocus`, `onBlur`, `onSelectionUpdate`, `onUpdate` *within the extension's `view()`*) to trigger a *single, generic* update signal to the React component (like `requestStateUpdate`).
3.  **React Controller (`useEffect`):** A central `useEffect` hook in `ActionEditorComponent`, triggered by the generic signal (e.g., `updateRequestNonce`), will:
    *   Read the *current* Tiptap editor state (`editorInstance.state`).
    *   Determine if the suggestion menu *should* be visible based on focus, selection, composing state, and whether the cursor is in a position to trigger suggestions (not inside an `ActionNode`).
    *   If visible, calculate the `query`, `highlightedItems`, `selectedIndex`, and `coords`.
    *   Call `setSuggestionState` *once* with the complete, new state object.
4.  **NodeView Isolation:** The `ActionNodeView` component manages its *internal* UI state (like the dropdown's `isOpen` state) independently. It interacts with Tiptap via `updateAttributes` and communicates outwards via the provided callbacks (`onQualifierChanged`, `onActionDeleted`, `onActionWordChanged`). `forwardRef` is essential.
5.  **Clear Conversion Triggers:** Define explicit logic for when text converts to an `ActionNode`:
    *   **Explicit:** User presses `Enter` or clicks an item in the suggestion list.
    *   **Implicit:** User presses `Space` after a potential action word, or the editor loses focus (`blur`), or the cursor moves significantly away *after* typing a potential action word.

**Refactoring Steps:**

Here’s a meticulous plan for the new developer. Each step aims to isolate changes and includes specific testing instructions. Assume the developer uses VIM (or any editor) to modify the files.

**Setup:**

*   Ensure the developer has the project checked out, dependencies installed (`npm install` or equivalent in the `frontend` directory), and can run the development server (`npm run dev`).
*   Direct them to the primary files:
    *   `frontend/src/pages/ActionEditorTestPage.jsx` (Testing ground)
    *   `frontend/src/components/ActionEditorComponent.jsx` (Main component, contains Tiptap setup, extensions)
    *   `frontend/src/components/SuggestionList.jsx` (UI for suggestions)
    *   `frontend/src/spec/playlist_element_action_editor_spec.md` (The requirements)

---

**Step 1: Prepare for Uni-directional Flow**

*   **Goal:** Remove direct React state setting from the Tiptap extension and ensure the extension only signals the need for an update.
*   **Tasks:**
    1.  **Edit `ActionEditorComponent.jsx`:**
        *   Remove the `setSuggestionState` prop from the `WordSuggestionExtension.configure` call.
    2.  **Edit `ActionEditorComponent.jsx` (inside `WordSuggestionExtension` definition):**
        *   Remove the `setSuggestionState` parameter from the `addOptions` return object and its usage.
        *   In `onFocus`, `onUpdate`, `onSelectionUpdate`, `onBlur` within the extension: Replace any direct calls related to setting suggestion state (if any existed beyond the prop) with ONLY `this.options.requestStateUpdate('reason')`, where 'reason' describes the event (e.g., 'focus', 'update', 'selection', 'blur'). *Ensure these handlers still exist and call `requestStateUpdate`*.
        *   In the extension's `state.apply` method: Remove any logic that directly calculated or set visibility/coordinates/items based on `prev` state. Focus *only* on determining `next.active`, `next.range`, `next.query`, `next.text`, `next.decorationId`, and `next.composing` based on the current `transaction` and Tiptap `state`.
        *   In the extension's `props.handleKeyDown`: Ensure it only `editor.emit`s custom events or returns `false`. Remove any state manipulation logic.
*   **Testing:**
    1.  **Run:** `npm run dev` in the `frontend` directory.
    2.  **Open:** The `/test-editor` page in your browser.
    3.  **Test:**
        *   Click into the editor. **Expect:** The suggestion menu *does not* appear yet (we broke visibility intentionally).
        *   Type some letters (e.g., "re"). **Expect:** No suggestion menu.
        *   Focus in and out of the editor. **Expect:** No errors in the console related to state updates from the extension. Check console logs for `[requestStateUpdate]` calls triggered by focus/blur/update/selection.
        *   Press ArrowUp/Down/Enter/Escape. **Expect:** Console logs showing `[WordSuggestionExtension:...] Emitting event.` for each key press. The menu won't react yet.

---

**Step 2: Centralize State Calculation in React `useEffect` (Initial Draft)**

*   **Goal:** *Temporarily* make the main `useEffect` responsible for calculating suggestion state based on Tiptap's state, triggered by `updateRequestNonce`. *Note: This step reflects the original plan but is known to have timing issues that Step 3.1 will fix.*
*   **Tasks:**
    1.  **Edit `ActionEditorComponent.jsx`:**
        *   Locate or create a main `useEffect` hook that depends on `[updateRequestNonce, registeredActions, editorInstance]`.
        *   Add state for `updateRequestNonce` and the `requestStateUpdate` callback (which increments the nonce) to `WordSuggestionExtension.configure` options.
        *   **Inside the effect:**
            *   Get current editor state (`state`, `selection`, `view.composing`).
            *   Get suggestion plugin state (`suggestionPluginKey.getState(state)`).
            *   Determine `shouldBeVisible` based on `isFocused`, `selection.empty`, `!isNodeSelection`, `!composing`, `pluginState?.active`.
            *   If `shouldBeVisible`, calculate `query` (from plugin state or text), `highlightedItems`, `selectedIndex` (e.g., reset to 0), and `relativeCoords` (using `view.coordsAtPos`). Handle coord calculation errors.
            *   Call `setSuggestionState` *once* with the full state object (`{ visible: true/false, ... }`).
*   **Testing:**
    1.  **Run:** `npm run dev`.
    2.  **Open:** `/test-editor`.
    3.  **Test:**
        *   Focus editor. **Expect:** Menu *might* appear inconsistently due to timing issues.
        *   Type "re". **Expect:** Menu *should* update and filter.
        *   Blur/Refocus. **Expect:** Menu *might* disappear/reappear inconsistently.
        *   *Focus on verifying basic state reading and calculation, acknowledging potential instability.* Console logs for `shouldBeVisible` and coord calculation are key.

---

**Step 3: Implement Explicit Suggestion Selection**

*   **Goal:** Ensure `Enter` key and mouse clicks on the suggestion list correctly insert an `ActionNode` and close the menu.
*   **Tasks:**
    1.  **Edit `ActionEditorComponent.jsx` (`handleSelect` function):**
        *   Verify it uses `suggestionStateRef.current` to get the *latest* state when triggered.
        *   Use `editorInstance.state.selection.$from` to determine the *current* position for replacement calculations, *not* a potentially stale position from when the menu appeared.
        *   Calculate `replaceFrom` and `replaceTo` based on the *current* position and the `query` length from `suggestionStateRef.current`.
        *   Keep the two-step Tiptap chain:
            1.  `insertContentAt({ from: replaceFrom, to: replaceTo }, contentToInsert)`
            2.  Get the position *after* insertion (`editorInstance.state.selection.to`).
            3.  `insertContentAt(positionAfterNode, ' ')`.
            *   **Important:** Inserting a space immediately after the `ActionNode` ensures the cursor is placed *outside* the node. This prevents subsequent explicit or implicit insertions from nesting inside the previous `ActionNode`, avoiding nested nodes and maintaining a flat structure.
        *   Ensure the final step is `setSuggestionState(prev => ({ ...prev, visible: false, query: '' }))` to hide the menu via React state.
        *   Make sure the `isSelectingRef` lock is used correctly at the beginning and released at the very end (in a `finally` block if using async/await, although it's synchronous here).
        *   **Crucially:** Add the `onActionCreated(itemToInsert, defaultQualifier)` call *after* the Tiptap commands complete successfully but *before* releasing the lock.
    2.  **Edit `SuggestionList.jsx`:**
        *   Ensure the `onMouseDown` handler correctly calls `onSelect(item)` and includes `e.preventDefault()`.
*   **Testing:**
    1.  **Run:** `npm run dev`.
    2.  **Open:** `/test-editor`.
    3.  **Test (Enter):**
        *   Type "re".
        *   Press `ArrowDown` once (highlight 'redux').
        *   Press `Enter`.
        *   **Expect:** The text "re" is replaced by an ActionNode containing "redux", followed by a space. The suggestion menu disappears. The editor loses focus. Check the browser console for the `onActionCreated` log message with "redux".
    4.  **Test (Click):**
        *   Focus the editor again.
        *   Type "com".
        *   Click on "component" in the suggestion list.
        *   **Expect:** The text "com" is replaced by an ActionNode containing "component", followed by a space. The menu disappears. The editor loses focus. Check console for `onActionCreated` log.
    5.  **Test (Empty):**
        *   Focus editor.
        *   Press `Enter` without typing anything (assuming index 0 is 'react').
        *   **Expect:** An ActionNode "react" is inserted at the cursor, followed by a space. Menu disappears. Editor blurs. Check console for `onActionCreated`.
    6.  **Regression:** Retest basic typing, menu appearance/disappearance on focus/blur, arrow key navigation within the menu.

---

**Step 3.1: Implement Event-Driven State Machine for Suggestions**

*   **Goal:** Refactor the suggestion state management in `ActionEditorComponent` to use `useReducer` and listen for specific custom events emitted by `WordSuggestionExtension`, making state transitions more predictable and less prone to timing issues.
*   **Tasks:**
    1.  **Edit `ActionEditorComponent.jsx`:**
        *   **Define State Structure:** Solidify the `initialSuggestionState` object structure (e.g., `{ visible: false, items: [], highlightedItems: [], selectedIndex: 0, query: '', coords: null, editingNodeId: null }`).
        *   **Define Reducer Actions:** Define action types as constants or an enum (e.g., `UPDATE_CONTEXT`, `NAVIGATE`, `SELECT_START`, `SELECT_COMPLETE`, `HIDE`, `SET_COORDS`, `EDIT_NODE_START`, `EDIT_NODE_END`).
        *   **Implement `suggestionReducer`:**
            *   Create the reducer function `(state, action) => { switch(action.type) { ... } }`.
            *   Handle `UPDATE_CONTEXT`: Takes `{ isActive, range, query }` payload. Sets `visible = isActive`, `query = action.payload.query`, resets `selectedIndex`, potentially clears `coords` (to be recalculated). If `!isActive`, sets `visible = false`. Filters `registeredActions` based on `query` to update `highlightedItems`.
            *   Handle `NAVIGATE`: Takes `{ direction: 'up' | 'down' }` payload. Calculates new `selectedIndex` based on `state.highlightedItems`.
            *   Handle `HIDE`: Sets `visible = false`.
            *   Handle `SET_COORDS`: Takes `{ coords }` payload. Updates `state.coords`.
            *   Handle `EDIT_NODE_START`: Takes `{ nodeId }` payload. Sets `visible = false`, `editingNodeId = action.payload.nodeId`.
            *   Handle `EDIT_NODE_END`: Sets `editingNodeId = null`.
            *   *(SELECT actions are handled directly via the `handleSelect` callback)*.
        *   **Use the Reducer:** Replace `useState(initialSuggestionState)` with `const [suggestionState, dispatch] = useReducer(suggestionReducer, initialSuggestionState);`. Remove `setSuggestionState`.
    2.  **Edit `ActionEditorComponent.jsx` (WordSuggestionExtension definition):**
        *   **Modify Plugin `apply`:** Instead of just returning state, the plugin's `apply` method should determine `isActive`, `range`, `query`. If these values *change* compared to the previous state, it should `this.editor.emit('suggestion:contextChange', { isActive, range, query })`. Remove any direct calls to `requestStateUpdate` from `apply`. Ensure `isActive` logic handles empty lines on focus.
        *   **Modify Event Handlers (`onFocus`, `onBlur`, `onSelectionUpdate`, `onUpdate`):** These should trigger the plugin's `apply` logic implicitly (via state changes). Remove calls to `requestStateUpdate`. Focus/Blur could emit `editor:focused`/`editor:blurred` if extra handling needed.
        *   **Modify Keyboard Shortcuts:**
            *   ArrowUp/Down: `this.editor.emit('suggestion:navigate', { direction: 'up' / 'down' })`. Return `true`.
            *   Enter: `this.editor.emit('suggestion:select')`. Return `true`.
            *   Escape: `this.editor.emit('suggestion:hide')`. Return `true`.
    3.  **Edit `ActionEditorComponent.jsx` (React Component):**
        *   **Remove `updateRequestNonce` & `lastUpdateReason`:** No longer needed for core suggestion flow.
        *   **Remove Main `useEffect` for State Calculation (from Step 2):** Delete the large `useEffect` hook.
        *   **Add Event Listeners (`useEffect`):**
            *   Create a `useEffect` hook that runs once on editor instance creation `[editorInstance]`.
            *   Inside, set up listeners (`editorInstance.on(...)`) for the custom events:
                *   `'suggestion:contextChange'`: Calls `dispatch({ type: 'UPDATE_CONTEXT', payload: eventData })`.
                *   `'suggestion:navigate'`: Calls `dispatch({ type: 'NAVIGATE', payload: eventData })`.
                *   `'suggestion:hide'`: Calls `dispatch({ type: 'HIDE' })`.
                *   `'suggestion:select'`: Calls the existing `handleSelect` callback.
            *   Return a cleanup function that calls `editorInstance.off(...)` for all listeners.
        *   **Add Coordinate Calculation Effect (`useEffect`):**
            *   Create a separate `useEffect` that depends on `[suggestionState.visible, suggestionState.query, editorInstance]` (or state parts implying coords are needed & range available).
            *   If `suggestionState.visible` is true, calculate `relativeCoords` using `editorInstance.view.coordsAtPos`. Get the `range` from the plugin state (`suggestionPluginKey.getState(editorInstance.state)?.range`) or store it temporarily from the `UPDATE_CONTEXT` payload if needed.
            *   Call `dispatch({ type: 'SET_COORDS', payload: { coords: relativeCoords } })`. Handle errors.
        *   **Update `HintContext`:** Pass `dispatch` down if `ActionNodeView` needs it (e.g., for `EDIT_NODE_START`/`END`).
        *   **Modify `handleSelect`:** Remove direct `setSuggestionState` calls. The state should update naturally via the `suggestion:contextChange` event triggered by the content insertion.
*   **Testing:**
    1.  **Run:** `npm run dev`.
    2.  **Open:** `/test-editor`.
    3.  **Test:**
        *   Focus editor. **Expect:** Menu appears reliably. Console shows `UPDATE_CONTEXT` dispatch, then `SET_COORDS` dispatch.
        *   Type "re". **Expect:** Menu filters correctly via `UPDATE_CONTEXT`.
        *   Blur editor. **Expect:** Menu disappears reliably via `UPDATE_CONTEXT`.
        *   Navigate (Arrow keys), Escape, Enter/Click. **Expect:** Correct dispatches (`NAVIGATE`, `HIDE`) or callbacks (`handleSelect`) are triggered, and state updates predictably.
    4.  **Verify:** Confirm no timing issues. Check console logs for event emission and reducer action handling.

---

**Step 4 (Rewritten): Implement Implicit Conversion (Space Key) via Events**

*   **Goal:** Convert the word before the cursor into an `ActionNode` when the spacebar is pressed, using the event-driven architecture.
*   **Tasks:**
    1.  **Edit `ActionEditorComponent.jsx` (inside `WordSuggestionExtension`):**
        *   Locate the `Space` key shortcut in `addKeyboardShortcuts`.
        *   **Inside the shortcut handler `({ editor }) => { ... }`:**
            *   Perform checks: `selection.empty`, not inside `actionNode`.
            *   Get `textBefore` and find the `word` using regex.
            *   **If a word is found:**
                *   Calculate `start` and `end` range.
                *   Create `nodeContent` for the `ActionNode`.
                *   Execute Tiptap chain: `insertContentAt({ from: start, to: end }, nodeContent)`, `insertContentAt(posAfterNode, ' ')`. **Crucially, insert the space *after* the node here.**
                *   **Emit Event:** Instead of calling callbacks directly, emit a specific event: `this.editor.emit('action:createdImplicitly', { word: match[1], qualifier: this.options.defaultQualifier });`
                *   Return `true`.
            *   **If no word/conditions not met:** Return `false`.
    2.  **Edit `ActionEditorComponent.jsx` (React Component):**
        *   **Add Event Listener (`useEffect`):** In the same effect where other editor listeners are set up, add:
            *   `editorInstance.on('action:createdImplicitly', handleImplicitCreate);`
        *   **Implement `handleImplicitCreate`:**
            *   Define a callback function `handleImplicitCreate = ({ word, qualifier }) => { ... }`.
            *   Inside, log the event: `console.log('[Implicit Action Create]:', word, qualifier);`.
            *   Call the prop callback: `onActionCreated(word, qualifier);`.
            *   *(Optional: Dispatch an action like `HIDE` if the menu needs explicit hiding, though context change should ideally handle it)*.
        *   **Cleanup:** Add `editorInstance.off('action:createdImplicitly', handleImplicitCreate)` in the `useEffect` cleanup.
*   **Testing:**
    1.  **Run:** `npm run dev`.
    2.  **Open:** `/test-editor`.
    3.  **Test:**
        *   Type "testword". Press `Space`. **Expect:** "testword" becomes an `ActionNode`, followed by a space. Console logs `action:createdImplicitly` event emission and the `handleImplicitCreate` log in React. `onActionCreated` prop callback is triggered. Suggestion menu state should update correctly based on the new context after the space (likely hiding).
        *   Type " another ". Press `Space`. **Expect:** Only "another" becomes an `ActionNode`, followed by a space.
        *   Click inside an existing `ActionNode`. Type text. Press `Space`. **Expect:** Space is inserted normally, no conversion, no event emitted.
    4.  **Regression:** Retest explicit selection (Enter/Click), focus/blur behavior, menu navigation.

---

**Step 5: Implement Implicit Conversion (Cursor Move / Blur) - *Advanced***

*   **Goal:** Convert the word the cursor *was just in* into an `ActionNode` if the cursor moves away or the editor blurs, *unless* an explicit selection or Space conversion just happened. This is the most complex part due to state tracking.
*   **Tasks:**
    1.  **Edit `ActionEditorComponent.jsx` (Tiptap Plugin State in `WordSuggestionExtension`):**
        *   Modify the plugin's state (`init`, `apply`) to track not just the *current* potential suggestion (`active`, `range`, `query`) but also the *previous* state relevant for this conversion. Add `prevRange`, `prevQuery`.
        *   In `apply`, before updating `next.active`, `next.range`, etc., copy the *current* `prev.range` and `prev.query` into `next.prevRange` and `next.prevQuery` *if* `prev.active` was true.
    2.  **Edit `ActionEditorComponent.jsx` (Main `useEffect`):**
        *   **Inside the effect, after getting current Tiptap state:**
            *   Access the *previous* range/query from the plugin state: `const { prevRange, prevQuery } = editorInstance.state.plugins.find(p => p.key === wordSuggestionExtension.key)?.getState(editorInstance.state) ?? {};` (Adjust key access as needed).
            *   **Conversion Condition:** Check if:
                *   `prev.active` was true (meaning the cursor *was* in a suggestion context).
                *   `next.active` is now false OR (`next.active` is true BUT `next.range.from !== prevRange.from`) (meaning the cursor moved *out* of the previous suggestion range).
                *   The reason for the update (`lastUpdateReason.current`) is 'selection' or 'blur' (or maybe 'update' if carefully handled).
                *   An explicit selection or Space conversion didn't *just* happen (this might require adding another flag to the plugin state temporarily set by those handlers, or checking transaction metadata if possible). This prevents double conversion.
            *   **If Condition Met:**
                *   Get the `word` from `prevQuery`.
                *   Calculate the `start` and `end` from `prevRange`.
                *   Perform the replacement *if the range is still valid in the current doc*: `editorInstance.chain().insertContentAt({ from: start, to: end }, nodeContent).run();` (Wrap in focus if needed).
                *   Trigger the callback: `onActionCreated(word, defaultQualifier);`
*   **Testing:**
    1.  **Run:** `npm run dev`.
    2.  **Open:** `/test-editor`.
    3.  **Test (Cursor Move):**
        *   Type "moveword".
        *   Click somewhere else in the editor *without* pressing Space/Enter.
        *   **Expect:** "moveword" becomes an `ActionNode`. Check console for `onActionCreated`.
        *   Type "arrowword". Use the right arrow key to move the cursor just past the 'd'. **Expect:** "arrowword" becomes an `ActionNode`.
    4.  **Test (Blur):**
        *   Type "blurword".
        *   Click *outside* the editor area to make it lose focus.
        *   **Expect:** "blurword" becomes an `ActionNode`. Check console for `onActionCreated`.
    5.  **Test (No Double Conversion):**
        *   Type "selectword". Press `Enter` to select it from the menu. **Expect:** Node is created, `onActionCreated` fires once. No second conversion on blur.
        *   Type "spaceword". Press `Space`. **Expect:** Node is created, `onActionCreated` fires once. No second conversion on subsequent blur/move.
    6.  **Regression:** Retest all previous functionalities.

---

**Step 6: Refine `ActionNodeView` Interaction (Qualifier Dropdown)**

*   **Goal:** Ensure the qualifier dropdown within the `ActionNode` works correctly and communicates changes.
*   **Tasks:**
    1.  **Edit `ActionEditorComponent.jsx` (`ActionNodeView` component):**
        *   Ensure `React.forwardRef` is used and the `ref` is correctly passed to the `NodeViewContent`.
        *   Manage the `isOpen` state using `useState`.
        *   Implement `toggleDropdown` using `setIsOpen`.
        *   Implement `selectQualifier`:
            *   Call `updateAttributes({ qualifier: id })`.
            *   Call `setIsOpen(false)`.
            *   Call the `onQualifierChanged(nodeId, id)` callback passed via `HintContext`.
        *   Implement the `useEffect` for closing the dropdown on clicks outside, ensuring the listener is added/removed based on `isOpen`.
*   **Testing:**
    1.  **Run:** `npm run dev`.
    2.  **Open:** `/test-editor`.
    3.  **Test:**
        *   Create an `ActionNode` (e.g., type "test" and press space).
        *   Click the dropdown part of the node (right side with qualifier/arrow). **Expect:** Dropdown menu appears with `qualifierOptions`.
        *   Click outside the dropdown. **Expect:** Dropdown closes.
        *   Click the dropdown again. Select a different qualifier (e.g., "Outgoing"). **Expect:** Dropdown closes, the qualifier label on the node updates, console logs the `onQualifierChanged` message with the correct node ID and new qualifier ID.
        *   Verify the node visually reflects the change (if styling is applied).
    4.  **Regression:** Retest node creation, suggestion menu interactions.

---

**Step 7: Implement `ActionNode` Deletion**

*   **Goal:** Allow users to delete `ActionNode`s using a dedicated button within the node.
*   **Tasks:**
    1.  **Edit `ActionEditorComponent.jsx` (`ActionNodeView` component):**
        *   Add a small "x" button (e.g., using an SVG icon or text) inside the `NodeViewWrapper`, positioned appropriately (e.g., absolutely top-right, or inline after the qualifier).
        *   Add an `onClick` handler to this button.
        *   **Inside the delete handler:**
            *   Call `deleteNode()`. This function is provided by the `NodeViewProps`.
            *   Call the `onActionDeleted(nodeId)` callback passed via `HintContext`.
*   **Testing:**
    1.  **Run:** `npm run dev`.
    2.  **Open:** `/test-editor`.
    3.  **Test:**
        *   Create several `ActionNode`s.
        *   Hover over one. **Expect:** The "x" delete button appears.
        *   Click the "x" button. **Expect:** The `ActionNode` is removed from the editor. Check the console for the `onActionDeleted` log message with the correct node ID.
    4.  **Regression:** Test node creation, qualifier changes, suggestion interactions.

---

**Step 8: Address `ActionNode` Word Editing (TODO)**

*   **Goal:** Allow the text content *inside* the `ActionNode` to be edited. (Marked as TODO in spec, complex).
*   **Tasks (Conceptual - Requires more Tiptap NodeView expertise):**
    1.  **Ensure `NodeViewContent` allows editing:** The setup with `content: 'inline*'` and `<NodeViewContent className="action-word-content" />` *should* theoretically allow this.
    2.  **Detect Changes:** Add an `onBlur` handler to the `NodeViewContent` element within `ActionNodeView`.
    3.  **Inside `onBlur`:**
        *   Get the current text content of the node (`node.textContent`).
        *   Compare it to the word it *should* represent (this might require storing the original word or deriving it).
        *   If it changed, call the `onActionWordChanged(nodeId, newWord)` callback.
    4.  **Potential Issues:** Tiptap might automatically handle text changes within the `NodeViewContent`. The main challenge is reliably triggering the *callback* when the edit is "committed" (e.g., on blur or maybe debounced keyup). Need to prevent the callback firing on every keystroke. Need to ensure Tiptap's internal state and the DOM remain synchronized.
*   **Testing:**
    1.  **Run:** `npm run dev`.
    2.  **Open:** `/test-editor`.
    3.  **Test:**
        *   Create an `ActionNode`.
        *   Click *directly* on the word text inside the node. **Expect:** Cursor appears inside the word.
        *   Edit the word (e.g., change "react" to "reactor").
        *   Click outside the node or press Enter/Tab. **Expect:** The node now displays "reactor". Check the console for the `onActionWordChanged` log with the node ID and "reactor".
    4.  **Regression:** Test all other features.


**Step 9: Add a selector border around an ActionNode**

*   **Goal:** Add a selector border in blue that allows to see which nodes we select, so that when we interact with a specific node, we can press backspace or delete and that deletes the node. And the user would know which specific node will get deleted if and when we either change open the menu or edit the text inside the action node. When we start typing outside of the actionnode or blur, the selection border disappears.

Modify the spec to reflect this addition.

---

**Information for the New Developer:**

1.  **Goal:** You are refactoring the `ActionEditorComponent` (`frontend/src/components/ActionEditorComponent.jsx`) to be more robust and align with the provided specification (`playlist_element_action_editor_spec.md`). The goal is an inline editor where users type text, potentially select suggestions, and have words automatically converted into special "Action" nodes with configurable properties.
2.  **Core Technologies:**
    *   **React:** Functional components, Hooks (`useState`, `useEffect`, `useCallback`, `useRef`, `useContext`).
    *   **Tiptap:** A headless editor framework built on ProseMirror. We use `EditorProvider`, `useCurrentEditor`, `EditorContent`, custom Nodes (`ActionNode`), and custom Extensions (`WordSuggestionExtension`). Familiarity with Tiptap's core concepts (state, transactions, nodes, marks, extensions, plugins) is crucial.
    *   **TailwindCSS:** For styling.
3.  **Key Concepts:**
    *   **ActionNode:** A custom Tiptap inline node representing a configured action word.
    *   **WordSuggestionExtension:** A Tiptap extension managing the suggestion popup's logic and interaction.
    *   **Event-Driven State:** The suggestion UI state (`suggestionState`) is managed in React using `useReducer`. Tiptap extensions emit specific events (e.g., `suggestion:contextChange`, `suggestion:navigate`, `action:createdImplicitly`). React listens for these events and dispatches actions to the reducer, ensuring predictable state updates.
    *   **Explicit vs. Implicit Conversion:** Understand the difference between selecting a suggestion (explicit) and having text convert automatically on space/blur/move (implicit).
4.  **Development & Testing:**
    *   Run the frontend dev server: `cd frontend && npm run dev`.
    *   Access the test page at `http://localhost:5173/test-editor`.
    *   Follow the **Refactoring Steps** above *sequentially*.
    *   **After each step**, perform *all* the tests listed for that step using your browser and check the browser's developer console for logs.
    *   **Crucially, also re-test key features from previous steps** to catch regressions (e.g., after implementing Space conversion, re-test Enter selection).
    *   Pay close attention to console logs – they are essential for understanding the flow and confirming callbacks fire correctly.
    *   Use your editor (VIM) to modify the specified files.
5.  **Focus on Robustness:** Avoid quick fixes like `setTimeout` unless absolutely necessary and documented. The goal is a predictable flow based on clear state ownership and event handling.

This structured approach, combined with meticulous testing after each step, should lead to a much more stable and maintainable component.