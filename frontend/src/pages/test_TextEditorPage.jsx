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
  'quill': { 
    description: 'A modern WYSIWYG editor built for compatibility and extensibility',
    hint: 'Quill.js - Rich text editing'
  },
  'editor': { 
    description: 'A program for editing and manipulating text',
    hint: 'Text Editor - Create and modify content'
  },
  'highlight': { 
    description: 'To emphasize or make prominent',
    hint: 'Highlight - Draw attention to text'
  }
};

// Default content with dictionary words
const DEFAULT_CONTENT = `This is a React-based text editor using Quill. You can highlight specific words in this editor. Try typing or editing this text to see how the highlighting works.`;

const TextEditorPage = () => {
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [selectedWord, setSelectedWord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hint, setHint] = useState({ visible: false, text: '', x: 0, y: 0 });
  const quillRef = useRef(null);
  const highlightTimeoutRef = useRef(null);

  const highlightWords = useCallback(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    // Clear previous timeout if it exists
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    // Store current selection
    const selection = editor.getSelection();
    const text = editor.getText();

    // Remove existing highlights
    editor.formatText(0, text.length, 'background', false);

    // Add new highlights
    Object.keys(HIGHLIGHT_DICTIONARY).forEach(word => {
      let index = 0;
      const lowerText = text.toLowerCase();
      const lowerWord = word.toLowerCase();

      while ((index = lowerText.indexOf(lowerWord, index)) !== -1) {
        const prevChar = index > 0 ? lowerText[index - 1] : ' ';
        const nextChar = index + word.length < lowerText.length ? 
          lowerText[index + word.length] : ' ';

        if (!/[a-zA-Z0-9]/.test(prevChar) && !/[a-zA-Z0-9]/.test(nextChar)) {
          editor.formatText(index, word.length, { 
            background: '#FFE082',
            'data-word': word
          });
        }
        index += word.length;
      }
    });

    // Restore selection
    if (selection) {
      editor.setSelection(selection);
    }
  }, []);

  const handleChange = useCallback((value) => {
    setContent(value);
    
    // Clear previous timeout
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    
    // Set new timeout for highlighting
    highlightTimeoutRef.current = setTimeout(highlightWords, 100);
  }, [highlightWords]);

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
    
    // Only hide hint if we're not moving to another highlighted word
    if (!relatedTarget || relatedTarget.tagName !== 'SPAN' || 
        !relatedTarget.style.backgroundColor.includes('255, 224, 130')) {
      setHint(prev => ({ ...prev, visible: false }));
    }
  }, []);

  useEffect(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    // Initial highlight
    highlightWords();

    const editorRoot = editor.root;
    editorRoot.addEventListener('mouseover', handleMouseOver);
    editorRoot.addEventListener('mouseout', handleMouseOut);

    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      editorRoot.removeEventListener('mouseover', handleMouseOver);
      editorRoot.removeEventListener('mouseout', handleMouseOut);
    };
  }, [highlightWords, handleMouseOver, handleMouseOut]);

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
            'background',
            'data-word'
          ]}
        />
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

      <div className="mt-4 space-y-2">
        <div className="text-sm text-gray-600">
          Available highlighted words:
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.keys(HIGHLIGHT_DICTIONARY).map(word => (
            <span
              key={word}
              style={{ backgroundColor: '#FFE082' }}
              className="cursor-pointer px-2 py-1 rounded transition-colors hover:bg-[#FFD54F]"
              onClick={() => {
                setSelectedWord(word);
                setIsModalOpen(true);
              }}
            >
              {word}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TextEditorPage; 