import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PlaylistsPage from './pages/test_PlaylistsPage';
import PlaylistEditorPage from './pages/PlaylistEditorPage';
import TextEditorPage from './pages/test_TextEditorPage';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PlaylistsPage />} />
        <Route path="/playlist/:name" element={<PlaylistEditorPage />} />
        <Route path="/test-editor" element={<TextEditorPage />} />
      </Routes>
    </Router>
  );
};

export default App;