import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PlaylistsPage from './pages/test_PlaylistsPage';
import PlaylistEditorPage from './pages/test_PlaylistEditorPage';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PlaylistsPage />} />
        <Route path="/playlist/:name" element={<PlaylistEditorPage />} />
      </Routes>
    </Router>
  );
};

export default App;