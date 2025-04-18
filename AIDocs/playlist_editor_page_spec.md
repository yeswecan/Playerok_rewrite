 ### Playlist Editor Page Specification

## 1. Playlist Editor Component Overview

The Playlist Editor is a drag-and-drop interface that allows users to manage and organize playlist items between two distinct lists: "Looped Items" and "Actionable Items". The component enables seamless reordering within each list and movement of items between lists through both drag-and-drop operations and checkbox toggling.

## 2. Playlist Item Structure

Each Playlist Item consists of:

- **Drag Handle**: A vertical grip icon positioned on the left side of the item that serves as the interaction point for drag operations
- **Track number that turns into play button or indicator**: depending on whether the playlist is playing and the item is playing,
numerical index may turn into a play indicator (telling the user this track is playing). If the user hovers the index, it turns into
play indicator but not in "playing" color.
- **Loop Checkbox**: A toggle control that determines whether the item is looped (checked) or actionable (unchecked)
- **Image preview**: A preview for the video that the playlist item represents, fetched from the server
- **Video length info**: A line that says how long the video is
- **Action editor**: Action Editor that is a custom made component for this playlist editor that has its own spec in the file "AIDocs/playlist_element_action_editor_spec.md"


Playlist item has different visual states for default, hover, dragging, and disabled conditions. TODO: specify which ones


## 3. List Structure

The Playlist Editor contains two vertically stacked lists:

- **Looped Items List**: Contains all items with their Loop checkbox checked
- **Actionable Items List**: Contains all items with their Loop checkbox unchecked


Each list maintains its own independent scrolling context when content exceeds the visible area, and displays a dashed border placeholder when empty.

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
- **Hover State**: Items provide visual feedback when hovered to indicate interactivity


## 5. Animation Behavior

### 5.1 Checkbox Toggle Animation

- **Animation Curve**: Uses cubic-bezier(0.4, 0.0, 0.2, 1.0) for smooth acceleration and deceleration without overshoot
- **Animation Duration**: 500ms for a balance between visual clarity and responsiveness
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