import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import Modal from '../components/test_Modal';

// Example dictionary - in real app this would come from your backend/config
const HIGHLIGHT_DICTIONARY = {
  'react': { 
    description: 'A JavaScript library for building user interfaces',
    tooltip: 'React.js - Build amazing UIs'
  },
  'quill': { 
    description: 'A modern WYSIWYG editor built for compatibility and extensibility',
    tooltip: 'Quill.js - Rich text editing'
  },
  'editor': { 
    description: 'A program for editing and manipulating text',
    tooltip: 'Text Editor - Create and modify content'
  },
  'highlight': { 
    description: 'To emphasize or make prominent',
    tooltip: 'Highlight - Draw attention to text'
  }
};

// Default content with dictionary words
const DEFAULT_CONTENT = `This is a React-based text editor using Quill. You can highlight specific words in this editor. Try typing or editing this text to see how the highlighting works.`;

const TextEditorPage = () => {
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [selectedWord, setSelectedWord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const quillRef = useRef(null);

  // Function to highlight all matching words
  const highlightWords = useCallback(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    const text = editor.getText();
    const selection = editor.getSelection();

    // Remove all existing highlights
    editor.formatText(0, text.length, 'background', false);

    // Find and highlight all dictionary words
    Object.keys(HIGHLIGHT_DICTIONARY).forEach(dictWord => {
      let startIndex = 0;
      const lowerText = text.toLowerCase();
      const lowerDictWord = dictWord.toLowerCase();

      while (true) {
        const index = lowerText.indexOf(lowerDictWord, startIndex);
        if (index === -1) break;

        // Check if it's a whole word
        const prevChar = index > 0 ? lowerText[index - 1] : ' ';
        const nextChar = index + dictWord.length < lowerText.length ? 
          lowerText[index + dictWord.length] : ' ';

        if (!/[a-zA-Z0-9]/.test(prevChar) && !/[a-zA-Z0-9]/.test(nextChar)) {
          const tooltip = HIGHLIGHT_DICTIONARY[dictWord].tooltip;
          editor.formatText(index, dictWord.length, { 
            background: '#FFE082',
            'data-tooltip': tooltip
          });
        }
        startIndex = index + 1;
      }
    });

    // Restore selection
    if (selection) {
      editor.setSelection(selection);
    }
  }, []);

  // Set up Quill modules
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ],
    keyboard: {
      bindings: {
        tab: false
      }
    }
  };

  // Handle text changes
  const handleChange = useCallback((value) => {
    setContent(value);
  }, []);

  // Initialize editor and set up event handlers
  useEffect(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    // Apply initial highlights
    highlightWords();

    // Set up text change handler
    const textChangeHandler = () => {
      setTimeout(highlightWords, 0);
    };

    editor.on('text-change', textChangeHandler);

    // Set up click handler for highlighted words
    const editorElement = editor.root;
    const clickHandler = (e) => {
      const target = e.target;
      const style = window.getComputedStyle(target);
      if (style.backgroundColor === 'rgb(255, 224, 130)') { // #FFE082
        const word = target.textContent.toLowerCase().trim();
        if (HIGHLIGHT_DICTIONARY[word]) {
          setSelectedWord(word);
          setIsModalOpen(true);
        }
      }
    };

    editorElement.addEventListener('click', clickHandler);

    // Cleanup
    return () => {
      editor.off('text-change', textChangeHandler);
      editorElement.removeEventListener('click', clickHandler);
    };
  }, [highlightWords]);

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'background'
  ];

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Enhanced Text Editor</h1>
      <div className="bg-white rounded-lg shadow-md p-4">
        <style>
          {`
            .ql-editor span[style*="background-color: rgb(255, 224, 130)"] {
              cursor: pointer;
              padding: 2px 4px;
              border-radius: 3px;
              transition: all 0.2s ease;
              position: relative;
            }
            .ql-editor span[style*="background-color: rgb(255, 224, 130)"]:hover {
              background-color: #FFA000 !important;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .ql-editor span[style*="background-color: rgb(255, 224, 130)"]:hover::before {
              content: attr(data-tooltip);
              position: absolute;
              bottom: 100%;
              left: 50%;
              transform: translateX(-50%);
              padding: 4px 8px;
              background-color: #FFE082;
              border-radius: 4px;
              font-size: 12px;
              white-space: nowrap;
              margin-bottom: 4px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              z-index: 1000;
            }
            .ql-editor span[style*="background-color: rgb(255, 224, 130)"]:hover::after {
              content: '';
              position: absolute;
              bottom: 100%;
              left: 50%;
              transform: translateX(-50%);
              border-width: 4px;
              border-style: solid;
              border-color: #FFE082 transparent transparent transparent;
              margin-bottom: 0px;
              z-index: 1000;
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
          modules={modules}
          formats={formats}
          theme="snow"
          preserveWhitespace
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