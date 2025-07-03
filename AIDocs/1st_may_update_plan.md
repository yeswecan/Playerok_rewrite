# Plan: Action Node Enhancements (May 1st)

This document outlines the plan for implementing `ActionNodeType`, `ActionId`, layout changes, and inter-editor drag-and-drop for Action Nodes.

## Phase 1: Data Model, Core Components & Context Updates

**Goal:** Integrate the new `actionNodeType` and `actionId` fields into the data model and core components, including context renaming and updates, without implementing drag-and-drop yet.

**Steps:**

1.  **Modify `actionsState` Structure:**
    *   **File:** `frontend/src/pages/PlaylistEditorPage.jsx` (and potentially where `initialActions` are passed to modals/lists).
    *   **Action:** Update the structure of objects within the `actionsState` array (and related state like `editingTrackActions`, `playlistActionsSettings`) to include:
        *   `actionNodeType: string` ('ItemActionNode' or 'PlaylistActionNode')
        *   `actionId: string` (e.g., "Start", "Stop", "previous", etc.)
    *   **Defaulting:** Ensure loading logic (if playlist is fetched) handles missing fields gracefully (backend migration is preferred, but frontend might need initial defaults).
    *   **Result:** Modified `frontend/src/pages/PlaylistEditorPage.jsx`. Specifically, updated the `transformItems` function to add default `actionNodeType` and `actionId` when processing items fetched from the backend, and updated the `handleModalActionCreated` and the playlist actions modal's `onActionCreated` callback to include these fields when new actions are created. This ensures all action objects managed within this page now conform to the new structure.

2.  **Rename `HintContext` to `ActionNodeContext**:**
    *   **Files:**
        *   `frontend/src/components/ActionEditor/context/HintContext.jsx` -> `ActionNodeContext.jsx`
        *   `frontend/src/components/ActionEditor/ActionEditorComponent.jsx`
        *   `frontend/src/components/ActionEditor/components/ActionNodeView.jsx`
        *   `frontend/src/components/ActionEditor/components/SuggestionMenu.jsx`
    *   **Action:** Rename the file, the `React.createContext` object itself, and update all `import` statements and `useContext` calls.

3.  **Update `ActionNodeContext`:**
    *   **File:** `frontend/src/components/ActionEditor/context/ActionNodeContext.jsx`
    *   **Action:**
        *   Review existing fields – rename or generalize if purely hint-related and no longer primary.
        *   Add `actionIdOptions: string[]` (or `Array<{id: string, label: string}>`) to the default context value type.
        *   Add `updateActionId: (nodeId: string, newActionId: string) => void` to the default context value type.
    *   **Result:** Modified `frontend/src/components/ActionEditor/context/ActionNodeContext.jsx`. Added `actionIdOptions: []` (expecting `Array<{id: string, label: string}>`), `updateActionId: (nodeId, newActionId) => {}`, `openActionIdNodeId: null`, and `setOpenActionIdNodeId: (nodeId) => {}` to the default context object. Existing fields like `showHint` and `hideHint` were kept for now.

4.  **Update `ActionEditorComponent.jsx`:**
    *   **Prop:** Add a required `nodeType: 'ItemActionNode' | 'PlaylistActionNode'` prop.
    *   **State/Derived Values:** Define `actionIdOptions` array based on the `props.nodeType`. Use initial lists:
        *   `ItemActionNode`: `["Start", "Stop"]`
        *   `PlaylistActionNode`: `["previous", "next", "play", "pause", "volume"]`
    *   **Context Provider:** Pass the derived `actionIdOptions` and implement/pass the `updateActionId` function in the `ActionNodeContext.Provider` value. `updateActionId` should modify the component's `actionsState`.
    *   **Node Creation:** Modify `addAction` (and any implicit creation logic) to:
        *   Include `actionNodeType: props.nodeType` in the new action object.
        *   Include `actionId: actionIdOptions[0].id` (default to the first option's ID) in the new action object.
    *   **Synchronization:** Update `generateTiptapContent` to read `actionNodeType` and `actionId` from `actionsState` items and set them as attributes on the created Tiptap nodes.
    *   **Result:** Modified `frontend/src/components/ActionEditor/ActionEditorComponent.jsx`. Added the `nodeType` prop. Introduced a `useMemo` hook to derive `actionIdOptions` (as `Array<{id: string, label: string}>`) based on `nodeType`. Added `openActionIdNodeId` state. Implemented the `updateActionId` callback function to update the `actionsState` and added it along with `actionIdOptions`, `openActionIdNodeId`, and `setOpenActionIdNodeId` to the `ActionNodeContext.Provider` value. Updated the `addAction` callback to include `actionNodeType` (from props) and a default `actionId` (first from derived options) in newly created action objects. Updated the `generateTiptapContent` function to read `actionNodeType` and `actionId` from the `actionsState` and set them as corresponding attributes (`data-node-type`, `data-action-id`) when generating Tiptap node JSON.

5.  **Update `actionNodeExtension.js`:**
    *   **Attributes:** Add `actionNodeType` and `actionId` to the return value of `addAttributes()`. Set appropriate defaults (e.g., `null` or `''`).
    *   **HTML Parsing/Rendering:** Update `parseHTML` and `renderHTML` to correctly read/write `data-node-type` and `data-action-id` attributes.
    *   **Result:** Modified `frontend/src/components/ActionEditor/extensions/actionNodeExtension.js`. Added `actionNodeType` and `actionId` to `addAttributes` with `null` defaults. Updated `parseHTML` to read these attributes (defaulting to `null` if missing) and `renderHTML` to write `data-node-type` and `data-action-id` attributes, filtering out null/undefined values before rendering.

6.  **Update `ActionNodeView.jsx`:**
    *   **Context:** Ensure it uses the renamed `ActionNodeContext`.
    *   **Attributes:** Read `actionNodeType` and `actionId` from `node.attrs`.
    *   **Context Data:** Get `actionIdOptions` and `updateActionId` from the context.
    *   **Layout:** Rearrange the JSX structure to: `QualifierMenu | Name | Equation | ActionIdMenu`. Use `flex` and potentially `order` utilities if needed.
    *   **Create `ActionIdMenu`:**
        *   Duplicate the structure/styling of the existing qualifier dropdown button and list.
        *   Populate the dropdown list using `actionIdOptions`.
        *   Determine the `selectedOptionLabel` based on matching `node.attrs.actionId` with an option ID/value.
        *   **Default Handling:** If `node.attrs.actionId` doesn't match any option in `actionIdOptions`, visually select/display the *first* option from `actionIdOptions`. Consider if this default should be persisted back immediately via `updateActionId` or only on user interaction. (Initial plan: just display default, save on interaction).
        *   Bind the `onClick` handler of dropdown items to call `updateActionId(nodeId, option.id)`.
    *   **Result:** Modified `frontend/src/components/ActionEditor/components/ActionNodeView.jsx`. Fetched `actionNodeType`, `actionId`, `actionIdOptions`, `updateActionId`, and associated state for managing dropdown visibility from `ActionNodeContext` and `node.attrs`. Rearranged the JSX layout using `inline-flex` on the wrapper to achieve the `QualifierMenu | Name | Equation | ActionIdMenu` order. Implemented the `ActionIdMenu` as a dropdown similar to the existing qualifier menu, populating it with `actionIdOptions`, displaying the label matching `node.attrs.actionId` (or the first option as a default), and calling `updateActionId` from context on item selection. Added logic to ensure only one dropdown (qualifier or action ID) is open at a time.

7.  **Update Parent Components:**
    *   **File:** `frontend/src/pages/PlaylistEditorPage.jsx`, `frontend/src/components/DraggableList.jsx`
    *   **Action:**
        *   Locate all instances where `ActionEditorComponent` is rendered.
        *   Pass the correct `nodeType` prop:
            *   Inside `DraggableList` (item actions): `nodeType="ItemActionNode"`
            *   Inside `PlaylistEditorPage` modals (Track Settings, Playlist Actions): Determine the correct type based on the modal's purpose (likely `ItemActionNode` for Track Settings, `PlaylistActionNode` for Playlist Actions).
        *   Ensure state update logic (e.g., `handleUpdateItem`, modal save handlers) correctly passes/receives the full action object including `actionNodeType` and `actionId`.
    *   **Result:** Modified `frontend/src/pages/PlaylistEditorPage.jsx` and `frontend/src/components/DraggableList.jsx`. In `DraggableList.jsx`, passed `nodeType="ItemActionNode"` to the `ActionEditorComponent` used for each list item. In `PlaylistEditorPage.jsx`, passed `nodeType="ItemActionNode"` to the `ActionEditorComponent` within the Track Settings modal and `nodeType="PlaylistActionNode"` to the four `ActionEditorComponent` instances within the Playlist Actions modal. Verified that the state update handlers (`handleUpdateItem`, `handleSaveTrackSettings`, `handleSavePlaylistActions`) already pass the entire action object array, which now includes `actionNodeType` and `actionId`, ensuring these new fields are correctly propagated during updates and saves.

## Phase 2: Inter-Editor Drag and Drop

**Goal:** Enable dragging `ActionNode` instances between different `ActionEditorComponent` instances using `react-dnd`.

**Steps:**

8.  **Install Dependencies:**
    *   **Command:** `npm install react-dnd react-dnd-html5-backend`
    *   **Action:** Run the command in the `frontend` directory.
    *   **Result:** Executed `npm install react-dnd react-dnd-html5-backend` in the `frontend` directory. Updated `frontend/package.json` and `frontend/package-lock.json` to include these dependencies.

9.  **Setup DND Context:**
    *   **File:** `frontend/src/pages/PlaylistEditorPage.jsx`
    *   **Action:**
        *   Import `DndProvider` from `react-dnd` and `HTML5Backend` from `react-dnd-html5-backend`.
        *   Wrap the main layout section containing the `DraggableList` and the Playlist Actions modal's container/trigger with `<DndProvider backend={HTML5Backend}>`.
    *   **Result:** Modified `frontend/src/pages/PlaylistEditorPage.jsx`. Imported `DndProvider` and `HTML5Backend`. Wrapped the main content `div` (the one directly inside the component's return statement, containing the header, error message, `DraggableList`, and modal triggers/buttons) with `<DndProvider backend={HTML5Backend}>` to establish the drag-and-drop context for all draggable/droppable components within this page.
    *   **(Optional) Create DND State Context:** If shared DND state (like isDragging) is needed across components, create a simple `ActionNodeDndContext.jsx`. Provide it within the `DndProvider`.

10. **Make `ActionNodeView` Draggable (`useDrag`) and add an additional action node editor to an Action Node Editor Test page (for testing):**
    *   **File:** `frontend/src/components/ActionEditor/components/ActionNodeView.jsx` and `frontend/src/pages/ActionEditorTestPage.jsx`
    *   **Action:**
        *   Create an additional Action Node Editor on the Action Node Editor test page, to test moving elements between the two
        *   Import `useDrag` from `react-dnd`.
        *   Inside the component, call `useDrag`:
            *   `type`: Define a constant string, e.g., `'ActionNodeItem'`.
            *   `item`: Return the full action data: `{ id: nodeId, word: node.textContent, qualifier: node.attrs.qualifier, equation: node.attrs.equation, actionNodeType: node.attrs.actionNodeType, actionId: node.attrs.actionId }`.
            *   `collect`: Monitor `isDragging`.
        *   Connect the drag source ref (`dragRef`) returned by `useDrag` to the main `NodeViewWrapper` element.
        *   Apply conditional styling based on `isDragging` (e.g., reduced opacity).
    *   **(Optional) Custom Drag Preview:** Import and use `useDragLayer` to render a custom, detached preview element while dragging instead of the default browser snapshot.

11. **Make `ActionEditorComponent` Droppable (`useDrop`):**
    *   **File:** `frontend/src/components/ActionEditor/ActionEditorComponent.jsx`
    *   **Action:**
        *   Import `useDrop` from `react-dnd`.
        *   Inside the component, call `useDrop` on the main container div (`action-editor-wrapper`).
            *   `accept`: `'ActionNodeItem'`.
            *   `canDrop(item, monitor)`: Return `item.actionNodeType === props.nodeType`.
            *   `hover(item, monitor)`:
                *   If not `canDrop`, return.
                *   Get client offset: `monitor.getClientOffset()`.
                *   Get editor container rect: `editorContainerRef.current.getBoundingClientRect()`.
                *   Calculate relative coordinates within the editor container.
                *   Use `editorInstanceRef.current.view.posAtCoords({ left: relativeX, top: relativeY })` to find the ProseMirror position. Handle potential errors.
                *   **(Placeholder Logic):** Determine the visual position for the "[drop here]" placeholder based on the ProseMirror position (this is tricky; might involve finding the nearest node boundary or line position). Update state to show/position an absolutely positioned placeholder `div` overlaying the editor.
            *   `drop(item, monitor)`:
                *   Check `monitor.didDrop()` to prevent handling by nested targets.
                *   Get the dropped `item` data.
                *   Get the drop position calculated during hover (or recalculate).
                *   **Crucially:** Do *not* modify Tiptap state directly. Instead, call a *new prop function* passed down from the parent (`PlaylistEditorPage` or `DraggableList`), e.g., `onActionDrop(droppedActionData, targetIndex)`. This parent function will be responsible for:
                    *   Finding the source `actionsState` and removing the item.
                    *   Finding the target `actionsState` and inserting the item at the `targetIndex`.
                    *   Updating the React state in the parent, triggering re-renders of the involved `ActionEditorComponent` instances with updated `initialActions`.
            *   `collect`: Monitor `isOver` and `canDrop` for styling the drop target (e.g., border change).
        *   Connect the drop target ref (`dropRef`) to the `action-editor-wrapper` div.
    *   **Result:** Created `frontend/src/dndTypes.js` for the `'ActionNodeItem'` constant. Modified `frontend/src/components/ActionEditor/ActionEditorComponent.jsx` to add the `editorId` and `onActionDrop` props, implement `useDrop` (accepting `'ActionNodeItem'`, checking `item.actionNodeType === props.nodeType` in `canDrop`, calling `onActionDrop` in `drop`), connect `dropRef`, and add CSS classes for `isOver`/`canDrop`/`cannotDrop` states. Added corresponding styling for these states in `frontend/src/components/ActionEditor/ActionEditorComponent.css`.
        *   **Note (Regression Fix):** During the implementation and debugging of this step, the `import './ActionEditorComponent.css';` statement was accidentally removed from `ActionEditorComponent.jsx`. This caused all component-specific styles, including the background and border defined in the CSS file, to disappear. The import was added back to resolve this. Ensure component CSS imports are present if styling issues arise.
        *   **Note (Styling Fix):** Initial attempts to style the editor border via `ActionEditorComponent.css` were unsuccessful because default Tailwind utility classes (`prose`, `px-*`, `py-*`) applied via `editorProps.attributes.class` were overriding the CSS file rules. These conflicting Tailwind classes were removed from `editorProps` to allow the dedicated CSS styles to take effect.

12. **Implement Parent Drop Handling:**
    *   **Files:** `frontend/src/pages/PlaylistEditorPage.jsx`, `frontend/src/components/DraggableList.jsx`
    *   **Action:**
        *   Define the `handleActionDrop(droppedActionData, targetEditorId, targetIndex)` function in `PlaylistEditorPage`.
        *   This function needs access to the state setters for *all* potential source/target `actionsState` arrays (inline items, playlist action settings).
        *   It will perform the state updates described in the `useDrop -> drop` step above.
        *   Pass this handler function down as a prop (e.g., `