import { useState, useEffect } from 'react';

const ContentEditor = () => {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/content');
      const data = await res.json();
      setContent(data.content);
    } catch (err) {
      setStatus('Failed to fetch content');
    }
  };

  const updateContent = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      await res.json();
      setStatus('Saved!');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      setStatus('Failed to save');
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full h-48 p-2 border rounded"
      />
      <div className="mt-2 flex justify-between">
        <button
          onClick={updateContent}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Save
        </button>
        <span className="py-2 text-gray-600">{status}</span>
      </div>
    </div>
  );
};

export default ContentEditor;