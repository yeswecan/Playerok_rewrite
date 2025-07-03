import React, { forwardRef, useLayoutEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import SuggestionMenu from './SuggestionMenu';

const SuggestionMenuPortal = forwardRef((props, ref) => {
  const { coords } = props;
  const portalElementRef = useRef(document.createElement('div'));

  useLayoutEffect(() => {
    const portalNode = portalElementRef.current;
    // Apply styles to make it a positioned overlay
    portalNode.style.position = 'absolute';
    portalNode.style.zIndex = '5000'; // High z-index to appear on top
    document.body.appendChild(portalNode);

    return () => {
      // Clean up the portal element from the DOM
      document.body.removeChild(portalNode);
    };
  }, []);

  // Effect to update position when coords change
  useLayoutEffect(() => {
    if (coords && portalElementRef.current) {
        // The coords from Tiptap are viewport-relative, so they can be applied directly
        portalElementRef.current.style.left = `${coords.x}px`;
        portalElementRef.current.style.top = `${coords.y}px`;
    }
  }, [coords]);

  // Don't render the portal if there are no items to show
  if (!props.items || props.items.length === 0) {
    return null;
  }

  // Use the portal to render the SuggestionMenu outside the normal component tree
  return ReactDOM.createPortal(
    <SuggestionMenu {...props} ref={ref} />,
    portalElementRef.current
  );
});

SuggestionMenuPortal.displayName = 'SuggestionMenuPortal';

export default SuggestionMenuPortal; 