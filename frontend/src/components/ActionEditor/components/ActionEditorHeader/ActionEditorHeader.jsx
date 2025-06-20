import React from 'react';
import PropTypes from 'prop-types';
import styles from './ActionEditorHeader.module.css';

// Simple X icon SVG for the close button
const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
  </svg>
);

/**
 * Header component for the Action Editor panel.
 * Displays the action type/title, an icon, and a close button.
 */
const ActionEditorHeader = ({ title, ActionIconComponent, onClose }) => {
  return (
    <div className={styles.headerContainer}>
      <div className={styles.titleContainer}>
        {ActionIconComponent && <ActionIconComponent className={styles.actionIcon} />}
        <h3 className={styles.title}>{title}</h3>
      </div>
      <button
        className={styles.closeButton}
        onClick={onClose}
        aria-label="Close Action Editor"
        title="Close Action Editor"
      >
        <CloseIcon />
      </button>
    </div>
  );
};

ActionEditorHeader.propTypes = {
  /** The title to display in the header */
  title: PropTypes.string.isRequired,
  /** Optional: A React component to render as the icon */
  ActionIconComponent: PropTypes.elementType,
  /** Callback function triggered when the close button is clicked */
  onClose: PropTypes.func.isRequired,
};

ActionEditorHeader.defaultProps = {
  ActionIconComponent: null,
};

export default ActionEditorHeader; 