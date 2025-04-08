import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PlaylistsPage from './pages/test_PlaylistsPage';
import PlaylistEditorPage from './pages/PlaylistEditorPage';
import ActionEditorTestPage from './pages/ActionEditorTestPage';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PlaylistsPage />} />
        <Route path="/playlist/:name" element={<PlaylistEditorPage />} />
        <Route path="/test-editor" element={<ActionEditorTestPage />} />
      </Routes>
    </Router>
  );
};

export default App;