import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PlaylistsPage from './pages/test_PlaylistsPage';
import PlaylistEditorPage from './pages/PlaylistEditorPage';
import ActionEditorTestPage from './pages/ActionEditorTestPage';
import MqttLogViewerPage from './pages/MqttLogViewerPage';
import MqttTestSenderPage from './pages/MqttTestSenderPage';
import NotificationManager from './components/Notifications/NotificationManager';

const App = () => {
  return (
    <Router>
      <NotificationManager />
      <Routes>
        <Route path="/" element={<PlaylistsPage />} />
        <Route path="/playlist/:name" element={<PlaylistEditorPage />} />
        <Route path="/test-editor" element={<ActionEditorTestPage />} />
        <Route path="/mqtt-log" element={<MqttLogViewerPage />} />
        <Route path="/mqtt-test" element={<MqttTestSenderPage />} />
      </Routes>
    </Router>
  );
};

export default App;