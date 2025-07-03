import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useCurrentEditor, EditorContent } from '@tiptap/react';

const TipTapEditorComponent = ({ setEditor, editorInstanceRef }) => {
  const { editor } = useCurrentEditor();

  useEffect(() => {
    if (editor) {
      setEditor(editor);
      if (editorInstanceRef) {
        editorInstanceRef.current = editor;
      }
    }
    return () => {
      if (!editor && editorInstanceRef) {
        editorInstanceRef.current = null;
      }
    };
  }, [editor, setEditor, editorInstanceRef]);

  return <EditorContent />;
};

TipTapEditorComponent.propTypes = {
  setEditor: PropTypes.func.isRequired,
  editorInstanceRef: PropTypes.shape({
    current: PropTypes.object
  }).isRequired
};

export default TipTapEditorComponent; 