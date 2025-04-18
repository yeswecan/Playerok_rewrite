 ### Playlist Editor Page Specification

## 1. Playlist Editor Component Overview

The Playlist Editor is a drag-and-drop interface that allows users to manage and organize playlist items between two distinct lists: "Looped Items" and "Actionable Items". The component enables seamless reordering within each list and movement of items between lists through both drag-and-drop operations and checkbox toggling.

## 2. Playlist Item Structure

Each Playlist Item is rendered as two stacked rows:

• A fixed-height header (4.5 rem) containing:
  - **Drag Handle**: vertical grip icon for drag operations
  - **Index / Play Indicator**: shows the track number or a large play icon when hovered or playing
  - **Loop Checkbox**: toggles looped vs actionable state
  - **Image Preview**: fixed-height thumbnail aligned top
  - **Filename**: first-line text to the right of the preview
  - **Video Length**: second-line text beneath filename in lighter color, defaults to "??:??" if unknown

Playlist item has defined visual states:
  - Default: white background
  - Hover: bg-gray-50
  - Dragging: shadow-lg ring-2 ring-blue-500 bg-blue-50
  - Disabled (during animation): opacity-70, pointer-events-none
  - Cursor States: track rows use `cursor-grab` by default, switch to `cursor-grabbing` while dragging, and use `cursor-pointer` on hover; inside the Actions row (ActionEditorComponent), always use `cursor-default`.

• Actions row beneath the header that contains the ActionEditorComponent and expands the item height as needed

• Actions row uses ActionEditorComponent styled with light-gray bg, 1px border (#ccc), 6px radius, inset shadow (0 1px 2px rgba(0,0,0,0.1)), min-height 1.5em, auto-expanding.

## 3. List Structure

The Playlist Editor contains two vertically stacked lists:

- **Looped Items List**: Contains all items with their Loop checkbox checked
- **Actionable Items List**: Contains all items with their Loop checkbox unchecked

Lists live in the global page scroll; when a list is empty it displays a dashed-border placeholder to indicate emptiness.

## 4. Interaction Patterns

### 4.1 Drag and Drop Operations

- **Within-List Reordering**: Users can drag items to reorder them within the same list

- The dragged item receives a shadow effect for visual feedback
- Other items smoothly animate to make space for the dragged item
- The list maintains its structure during and after the drag operation



- **Between-List Movement**: Users can drag items between the Looped Items and Actionable Items lists

- When an item is dragged from one list to another, its Loop checkbox state automatically updates
- The source list smoothly collapses to fill the vacated space
- The target list smoothly expands to accommodate the new item
- The dragged item maintains visual continuity throughout the transition





### 4.2 Checkbox Toggling

- **Loop Status Change**: Toggling the Loop checkbox moves the item between lists

- The item animates smoothly from its current position to the target list
- The animation follows a natural easing curve with subtle acceleration and deceleration
- The source list smoothly collapses as the item leaves
- The target list smoothly expands as the item arrives
- The entire transition completes in approximately 500ms





### 4.3 Interaction States

- **Disabled State**: During animations, both dragging and checkbox interactions are temporarily disabled to prevent conflicting operations
- **Drag Feedback**: When dragging, the item appears slightly elevated with a shadow effect
- Items provide visual feedback when hovered; clicking any empty area of a track row opens its ActionEditor modal
- **Cursor Behavior**: track rows show hand/pointer and grab/grabbing cursors as appropriate for hover and drag; the ActionEditorComponent area within each row always displays the standard arrow cursor (cursor-default).


## 5. Animation Behavior

### 5.1 Checkbox Toggle Animation

- **Animation Curve**: Uses cubic-bezier(0.4, 0.0, 0.2, 1.0) for smooth acceleration and deceleration without overshoot
- **Animation Duration**: 300ms (cubic-bezier(0.4, 0.0, 0.2, 1.0))
- **Visual Continuity**: The item appears to physically move from one list to the other
- **List Transitions**: Both source and target lists animate simultaneously:

- Source list smoothly collapses to fill the vacated space
- Target list smoothly expands to accommodate the incoming item
- Both transitions use the same easing curve and duration





### 5.2 Drag Animation

- **Real-time Feedback**: During dragging, the item follows the cursor/pointer with minimal lag
- **Drop Animation**: When released, the item smoothly animates to its final position
- **List Adjustment**: Lists smoothly expand or contract to accommodate changes in their content


## 6. State Management

- **Item State**: Each item maintains its Loop status (checked/unchecked)
- **List Composition**: The component automatically sorts items into the appropriate list based on their Loop status
- **Animation State**: The component tracks when animations are in progress to prevent conflicting interactions
- **Drag State**: The component manages drag operations and updates item positions accordingly


## 7. Edge Cases and Error Handling

- **Empty Lists**: When a list becomes empty, it displays a dashed border placeholder
- **Animation Interruption**: If a new interaction is attempted during an animation, it is ignored until the current animation completes
- **Failed Drag Operations**: If a drag operation is canceled or fails, the item returns to its original position with a smooth animation

## Global Header Controls
- Back button ("<") on left: blue bg (bg-blue-500), rounded, hover darker
- "+" add-video button: blue bg, rounded, opens Add menu
- "Playlist actions" button: blue bg, rounded, launches Playlist Actions modal

## Playlist Actions Modal
- Title bar: back "<" button (blue), title "Playlist actions"
- Four sections with headings and ActionEditorComponent:
  1) Actions that move it to previous track
  2) Actions that move it to next track
  3) Actions that make it pause
  4) Actions that make it play
- Scrollable if content >70vh; auto-expands vertically
- Footer: "Save & quit" blue button closes modal and persists