import { useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { calculateHintPosition } from '../utils/actionEditorUtils';

const HintTooltip = ({ hintState }) => {
    const { visible, content, targetRect, hintType } = hintState;
    const hintRef = useRef(null);
    const [position, setPosition] = useState({ top: -9999, left: -9999 });
  
    useEffect(() => {
      if (visible && targetRect && hintRef.current) {
        const hintRect = hintRef.current.getBoundingClientRect();
        setPosition(calculateHintPosition(targetRect, hintRect, hintType));
      } else {
        setPosition({ top: -9999, left: -9999 });
      }
    }, [visible, targetRect, hintType]); // Recalculate when these change
  
    if (!visible || !content) return null;
  
    return (
      <div
        ref={hintRef}
        className="hint-tooltip"
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          zIndex: 1003, // Above suggestion menu
          background: 'rgba(0, 0, 0, 0.75)',
          color: 'white',
          padding: '5px 10px',
          borderRadius: '4px',
          fontSize: '0.8em',
          whiteSpace: 'pre-wrap', // Keep newlines from hint content
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.2s ease-in-out',
          pointerEvents: 'none', // Allow clicks to pass through
        }}
      >
        {content}
      </div>
    );
  };
  
  // PropTypes for HintTooltip
  HintTooltip.propTypes = {
    hintState: PropTypes.shape({
      visible: PropTypes.bool.isRequired,
      content: PropTypes.string.isRequired,
      targetRect: PropTypes.object,
      hintType: PropTypes.string
    }).isRequired
  };

  export default HintTooltip; 