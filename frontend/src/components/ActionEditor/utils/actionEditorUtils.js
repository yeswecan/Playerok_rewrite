export function calculateHintPosition(targetRect, hintRect, hintType = 'node') {
    if (!targetRect || !hintRect) {
      return { top: -9999, left: -9999 };
    }
    const PADDING = 8;
    const ARROW_OFFSET = 10;
  
    let top, left;
  
    if (hintType === 'node') {
      // Position below the node, centered horizontally
      top = targetRect.bottom + PADDING;
      left = targetRect.left + targetRect.width / 2 - hintRect.width / 2;
  
      // Adjust if hint goes off-screen horizontally
      if (left < PADDING) {
        left = PADDING;
      } else if (left + hintRect.width > window.innerWidth - PADDING) {
        left = window.innerWidth - hintRect.width - PADDING;
      }
  
      // Adjust if hint goes off-screen vertically (try positioning above)
      if (top + hintRect.height > window.innerHeight - PADDING) {
        top = targetRect.top - hintRect.height - PADDING;
        // Add logic here to handle case where it also doesn't fit above
        if (top < PADDING) {
          // Fallback or alternative positioning if needed
          top = PADDING;
        }
      }
  
    } else { // hintType === 'suggestion'
      // Position below the suggestion item, slightly offset
      top = targetRect.bottom + PADDING;
      left = targetRect.left + ARROW_OFFSET; // Align near the start
  
      // Adjust if hint goes off-screen horizontally
      if (left < PADDING) {
        left = PADDING;
      } else if (left + hintRect.width > window.innerWidth - PADDING) {
        left = window.innerWidth - hintRect.width - PADDING;
      }
  
      // Adjust if hint goes off-screen vertically (try positioning above)
      if (top + hintRect.height > window.innerHeight - PADDING) {
        top = targetRect.top - hintRect.height - PADDING;
        if (top < PADDING) {
          top = PADDING;
        }
      }
    }
  
  
    return {
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
    };
  } 