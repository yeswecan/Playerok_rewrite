import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import Modal from '../components/test_Modal';

// Example dictionary - in real app this would come from your backend/config
const HIGHLIGHT_DICTIONARY = {
  'react': { 
    description: 'A JavaScript library for building user interfaces',
    hint: 'React.js - Build amazing UIs'
  },
  'redux': {
    description: 'A predictable state container for JavaScript apps',
    hint: 'Redux - State management for React'
  },
  'router': {
    description: 'A routing library for React applications',
    hint: 'React Router - Navigation made easy'
  },
  'quill': { 
    description: 'A modern WYSIWYG editor built for compatibility and extensibility',
    hint: 'Quill.js - Rich text editing'
  },
  'query': {
    description: 'A data-fetching and state management library',
    hint: 'React Query - Powerful data synchronization'
  },
  'editor': { 
    description: 'A program for editing and manipulating text',
    hint: 'Text Editor - Create and modify content'
  },
  'element': {
    description: 'A basic unit of UI in React applications',
    hint: 'React Element - Building blocks of UI'
  },
  'highlight': { 
    description: 'To emphasize or make prominent',
    hint: 'Highlight - Draw attention to text'
  },
  'hook': {
    description: 'A function that lets you use state and other React features',
    hint: 'React Hook - Function-based state management'
  },
  'component': {
    description: 'A reusable piece of UI in React',
    hint: 'React Component - Building blocks of applications'
  },
  'state': {
    description: 'Data that can change over time in React',
    hint: 'React State - Dynamic data management'
  },
  'props': {
    description: 'Properties passed to React components',
    hint: 'React Props - Component configuration'
  },
  'effect': {
    description: 'Side effects in React components',
    hint: 'React Effect - Handle side effects'
  },
  'context': {
    description: 'Global state management in React',
    hint: 'React Context - Share data between components'
  },
  'reducer': {
    description: 'A function that determines state changes',
    hint: 'Redux Reducer - State update logic'
  },
  'action': {
    description: 'A description of state changes in Redux',
    hint: 'Redux Action - Trigger state updates'
  },
  'middleware': {
    description: 'Functions that intercept Redux actions',
    hint: 'Redux Middleware - Custom action handling'
  },
  'selector': {
    description: 'Functions to extract data from Redux state',
    hint: 'Redux Selector - Access state data'
  },
  'dispatch': {
    description: 'Function to send actions to Redux store',
    hint: 'Redux Dispatch - Trigger state changes'
  }
};

// Default content with dictionary words
const DEFAULT_CONTENT = `This is a React-based text editor using Quill. You can highlight specific words in this editor. Try typing or editing this text to see how the highlighting works.`;

const TextEditorPage = () => {
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [selectedWord, setSelectedWord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hint, setHint] = useState({ visible: false, text: '', x: 0, y: 0 });
  const [suggestions, setSuggestions] = useState({ visible: false, items: [], highlightedItems: [], x: 0, y: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isManuallyNavigating, setIsManuallyNavigating] = useState(false);
  const quillRef = useRef(null);
  const highlightTimeoutRef = useRef(null);

  const getCurrentWord = useCallback(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return '';

    const selection = editor.getSelection();
    if (!selection) return '';

    const text = editor.getText();
    const cursorPosition = selection.index;
    
    let start = cursorPosition;
    while (start > 0 && /[a-zA-Z]/.test(text[start - 1])) {
      start--;
    }
    
    let end = cursorPosition;
    while (end < text.length && /[a-zA-Z]/.test(text[end])) {
      end++;
    }

    return text.slice(start, end);
  }, []);

  const highlightWords = useCallback(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    const selection = editor.getSelection();
    const text = editor.getText();

    editor.formatText(0, text.length, 'background', false);

    Object.keys(HIGHLIGHT_DICTIONARY).forEach(word => {
      let index = 0;
      const lowerText = text.toLowerCase();
      const lowerWord = word.toLowerCase();

      while ((index = lowerText.indexOf(lowerWord, index)) !== -1) {
        const prevChar = index > 0 ? lowerText[index - 1] : ' ';
        const nextChar = index + word.length < lowerText.length ? 
          lowerText[index + word.length] : ' ';

        if (!/[a-zA-Z0-9]/.test(prevChar) && !/[a-zA-Z0-9]/.test(nextChar)) {
          editor.formatText(index, word.length, { background: '#FFE082' });
        }
        index += word.length;
      }
    });

    if (selection) {
      editor.setSelection(selection);
    }
  }, []);

  const handleChange = useCallback((value) => {
    setContent(value);
    
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    const currentWord = getCurrentWord();
    const selection = editor.getSelection();
    if (!selection) return;

    const bounds = editor.getBounds(selection.index);
    const editorBounds = editor.root.getBoundingClientRect();

    // Show suggestions only when there's a current word
    if (!currentWord) {
      setSuggestions(prev => ({ ...prev, visible: false }));
      setIsManuallyNavigating(false);
      return;
    }

    // Show all words but highlight matching ones
    const allWords = Object.keys(HIGHLIGHT_DICTIONARY);
    const matchingWords = currentWord ? 
      allWords.filter(word => word.toLowerCase().startsWith(currentWord.toLowerCase())) : 
      [];

    setSuggestions({
      visible: true,
      items: allWords, // Show all words
      highlightedItems: matchingWords, // Highlight only matching ones
      x: bounds.left + editorBounds.left,
      y: bounds.top + editorBounds.top - 5
    });
    
    // Only set selected index to first match if not manually navigating
    if (!isManuallyNavigating) {
      const firstMatchIndex = allWords.findIndex(word => 
        matchingWords.includes(word)
      );
      setSelectedIndex(firstMatchIndex >= 0 ? firstMatchIndex : 0);
    }

    // Delay highlighting to avoid performance issues
    highlightTimeoutRef.current = setTimeout(highlightWords, 100);
  }, [getCurrentWord, highlightWords, isManuallyNavigating]);

  const handleSelectionChange = useCallback((range) => {
    if (!range) {
      setSuggestions(prev => ({ ...prev, visible: false }));
      return;
    }
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (!suggestions.visible) return true;

    const editor = quillRef.current?.getEditor();
    if (!editor) return true;

    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowDown': {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setIsManuallyNavigating(true);
        
        const delta = e.key === 'ArrowUp' ? -1 : 1;
        setSelectedIndex(prev => {
          const newIndex = (prev + delta + suggestions.items.length) % suggestions.items.length;
          requestAnimationFrame(() => {
            const element = document.getElementById(`suggestion-${newIndex}`);
            if (element) {
              element.scrollIntoView({ block: 'nearest', behavior: 'auto' });
            }
          });
          return newIndex;
        });
        return false;
      }

      case 'Enter': {
        // Stop the event immediately
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const selection = editor.getSelection();
        if (!selection) return false;

        const text = editor.getText();
        const cursorPosition = selection.index;
        
        let start = cursorPosition;
        while (start > 0 && /[a-zA-Z]/.test(text[start - 1])) {
          start--;
        }

        const selectedWord = suggestions.items[selectedIndex];
        const formats = editor.getFormat(start, cursorPosition - start);
        
        // Delete and insert atomically to prevent cursor jumping
        editor.deleteText(start, cursorPosition - start, 'user');
        editor.insertText(start, selectedWord, formats, 'user');
        editor.insertText(start + selectedWord.length, ' ', formats, 'user');
        editor.setSelection(start + selectedWord.length + 1, 0, 'user');
        
        setSuggestions(prev => ({ ...prev, visible: false }));
        setIsManuallyNavigating(false);
        
        // Prevent any default handling
        return false;
      }

      case 'Escape':
        setSuggestions(prev => ({ ...prev, visible: false }));
        setIsManuallyNavigating(false);
        return false;

      case ' ':
        if (!getCurrentWord()) {
          setSuggestions(prev => ({ ...prev, visible: false }));
          setIsManuallyNavigating(false);
        }
        return true;

      default:
        setIsManuallyNavigating(false);
        return true;
    }
  }, [suggestions.visible, suggestions.items, selectedIndex, getCurrentWord]);

  const handleMouseOver = useCallback((e) => {
    const target = e.target;
    if (!target || target.tagName !== 'SPAN') return;

    const bgColor = target.style.backgroundColor;
    const isHighlighted = bgColor === 'rgb(255, 224, 130)' || bgColor === '#ffe082';
    
    if (isHighlighted) {
      const word = target.textContent.toLowerCase().trim();
      const hintText = HIGHLIGHT_DICTIONARY[word]?.hint;
      
      if (hintText) {
        const rect = target.getBoundingClientRect();
        setHint({
          visible: true,
          text: hintText,
          x: rect.left + (rect.width / 2),
          y: rect.top
        });
      }
    }
  }, []);

  const handleMouseOut = useCallback((e) => {
    const target = e.target;
    const relatedTarget = e.relatedTarget;
    
    if (!relatedTarget || relatedTarget.tagName !== 'SPAN' || 
        !relatedTarget.style.backgroundColor.includes('255, 224, 130')) {
      setHint(prev => ({ ...prev, visible: false }));
    }
  }, []);

  useEffect(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    // Initial highlighting
    highlightWords();

    const handleKeyDownCapture = (e) => {
      if (!suggestions.visible) return;

      const result = handleKeyDown(e);
      if (result === false) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    const editorElement = editor.root;
    editorElement.addEventListener('keydown', handleKeyDownCapture, { capture: true });
    
    editor.on('selection-change', handleSelectionChange);
    editorElement.addEventListener('mouseover', handleMouseOver);
    editorElement.addEventListener('mouseout', handleMouseOut);

    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      editorElement.removeEventListener('keydown', handleKeyDownCapture, { capture: true });
      editor.off('selection-change', handleSelectionChange);
      editorElement.removeEventListener('mouseover', handleMouseOver);
      editorElement.removeEventListener('mouseout', handleMouseOut);
    };
  }, [highlightWords, handleKeyDown, handleMouseOver, handleMouseOut, handleSelectionChange, suggestions.visible]);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Enhanced Text Editor</h1>
      
      {hint.visible && (
        <div
          style={{
            position: 'fixed',
            left: `${hint.x}px`,
            top: `${hint.y - 28}px`,
            transform: 'translate(-50%, -100%)',
            backgroundColor: '#FFE082',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            zIndex: 1000,
            pointerEvents: 'none',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            opacity: hint.visible ? 1 : 0,
            transition: 'opacity 0.15s ease-in-out'
          }}
        >
          {hint.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-4">
        <style>
          {`
            .ql-editor span[style*="background-color: rgb(255, 224, 130)"],
            .ql-editor span[style*="background-color: #ffe082"] {
              cursor: pointer;
              padding: 2px 4px;
              border-radius: 3px;
              background-color: #FFE082 !important;
              will-change: transform, background-color;
              transition: transform 0.15s ease-in-out;
            }

            .ql-editor span[style*="background-color: rgb(255, 224, 130)"]:hover,
            .ql-editor span[style*="background-color: #ffe082"]:hover {
              background-color: #FFA000 !important;
              transform: scale(1.05);
            }

            .ql-editor {
              min-height: 300px;
            }

            /* Add styles for suggestion items */
            .group:last-child {
              border-bottom: none !important;
            }

            .group:hover {
              background-color: #EBF5FF !important;
            }

            .group:hover span {
              color: #1a56db !important;
            }

            .bg-blue-50 span {
              color: #1a56db !important;
            }

            /* Scrollbar styles */
            .suggestions-menu::-webkit-scrollbar {
              width: 8px;
            }

            .suggestions-menu::-webkit-scrollbar-track {
              background: #E2E8F0;
              border-radius: 4px;
            }

            .suggestions-menu::-webkit-scrollbar-thumb {
              background: #94A3B8;
              border-radius: 4px;
            }

            .suggestions-menu::-webkit-scrollbar-thumb:hover {
              background: #64748B;
            }
          `}
        </style>
        <ReactQuill
          ref={quillRef}
          value={content}
          onChange={handleChange}
          theme="snow"
          modules={{
            toolbar: [
              [{ 'header': [1, 2, false] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
              ['clean']
            ]
          }}
          formats={[
            'header',
            'bold', 'italic', 'underline', 'strike',
            'list', 'bullet',
            'background'
          ]}
        />
      </div>

      {suggestions.visible && (
        <div
          style={{
            position: 'fixed',
            left: `${suggestions.x}px`,
            top: `${suggestions.y}px`,
            transform: 'translateY(-100%)',
            backgroundColor: 'white',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: '250px',
            maxHeight: '160px',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: '#94A3B8 #E2E8F0',
            outline: 'none'
          }}
          className="suggestions-menu"
          tabIndex={-1}
        >
          {suggestions.items.map((word, index) => {
            const isHighlighted = suggestions.highlightedItems.includes(word);
            const isSelected = index === selectedIndex;
            return (
              <div
                id={`suggestion-${index}`}
                key={word}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const editor = quillRef.current?.getEditor();
                  if (!editor) return;

                  const selection = editor.getSelection();
                  if (!selection) return;

                  const text = editor.getText();
                  const cursorPosition = selection.index;
                  
                  let start = cursorPosition;
                  while (start > 0 && /[a-zA-Z]/.test(text[start - 1])) {
                    start--;
                  }

                  editor.deleteText(start, cursorPosition - start);
                  editor.insertText(start, word + ' ');
                  editor.setSelection(start + word.length + 1, 0);
                  setSuggestions(prev => ({ ...prev, visible: false }));
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                style={{
                  padding: '8px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? '#EBF5FF' : 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderBottom: '1px solid #eee',
                  transition: 'all 0.15s ease-in-out',
                  position: 'relative'
                }}
                className={`group hover:bg-blue-50 ${isSelected ? 'bg-blue-50' : ''}`}
              >
                {isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '0',
                      top: '0',
                      bottom: '0',
                      width: '3px',
                      backgroundColor: '#2563EB',
                      borderRadius: '2px'
                    }}
                  />
                )}
                <span style={{ 
                  backgroundColor: isHighlighted ? '#FFE082' : 'transparent',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  flex: '0 0 auto',
                  transition: 'all 0.15s ease-in-out'
                }}>
                  {word}
                </span>
                <span className={`text-sm flex-1 ${isSelected ? 'text-blue-700' : 'text-gray-600'} group-hover:text-blue-700`}>
                  {HIGHLIGHT_DICTIONARY[word].hint}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 space-y-2">
        <div className="text-sm text-gray-600">
          Available words:
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.keys(HIGHLIGHT_DICTIONARY).map(word => (
            <span
              key={word}
              style={{ backgroundColor: '#FFE082' }}
              className="px-2 py-1 rounded"
            >
              {word}
            </span>
          ))}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedWord || ''}
      >
        <div className="p-4">
          <p>{selectedWord && HIGHLIGHT_DICTIONARY[selectedWord]?.description}</p>
        </div>
      </Modal>
    </div>
  );
};

export default TextEditorPage; 