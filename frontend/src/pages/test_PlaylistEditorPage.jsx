import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Modal from '../components/test_Modal';
import { API_URL } from '../config';

const PlaylistEditorPage = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState(null);
  const [availableVideos, setAvailableVideos] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newItem, setNewItem] = useState({
    filename: '',
    isPartOfLoop: false,
    outgoingCommands: [],
    ingoingCommands: []
  });

  useEffect(() => {
    fetchPlaylist();
    fetchAvailableVideos();
  }, [name]);

  const fetchPlaylist = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('Fetching playlist:', name);
      const response = await fetch(`${API_URL}/api/getPlaylist/${name}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load playlist: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Received playlist:', data);
      setPlaylist(data);
    } catch (error) {
      console.error('Error fetching playlist:', error);
      setError(`Failed to load playlist: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableVideos = async () => {
    try {
      const response = await fetch(`${API_URL}/api/listVideos`);
      if (!response.ok) {
        throw new Error(`Failed to load videos: ${response.statusText}`);
      }
      const data = await response.json();
      setAvailableVideos(data);
    } catch (error) {
      console.error('Error fetching videos:', error);
      setError(`Failed to load videos: ${error.message}`);
    }
  };

  const handleAddItem = async () => {
    try {
      await fetch(`${API_URL}/api/addToPlaylist/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });
      setIsAddModalOpen(false);
      setNewItem({
        filename: '',
        isPartOfLoop: false,
        outgoingCommands: [],
        ingoingCommands: []
      });
      fetchPlaylist();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handleUpdateItem = async (index, updates) => {
    try {
      const endpoint = Object.keys(updates)[0];
      let apiEndpoint;
      let body;

      switch (endpoint) {
        case 'filename':
          apiEndpoint = 'changeFilename';
          body = { filename: updates.filename };
          break;
        case 'outgoingCommands':
          apiEndpoint = 'changeOutgoingCommands';
          body = { commands: updates.outgoingCommands };
          break;
        case 'ingoingCommands':
          apiEndpoint = 'changeIngoingCommands';
          body = { commands: updates.ingoingCommands };
          break;
        case 'isPartOfLoop':
          apiEndpoint = 'toggleLoop';
          body = {};
          break;
        default:
          return;
      }

      await fetch(`${API_URL}/api/${apiEndpoint}/${name}/${index}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      fetchPlaylist();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleRemoveItem = async (index) => {
    try {
      await fetch(`${API_URL}/api/removeFromPlaylist/${name}/${index}`, {
        method: 'DELETE',
      });
      fetchPlaylist();
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  const handleMoveItem = async (index, newIndex) => {
    try {
      await fetch(`${API_URL}/api/moveItem/${name}/${index}/${newIndex}`, {
        method: 'POST',
      });
      fetchPlaylist();
    } catch (error) {
      console.error('Error moving item:', error);
    }
  };

  if (isLoading) return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Loading playlist...</h1>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Back to Playlists
        </button>
      </div>
      <div className="bg-gray-100 p-4 rounded">
        <p>Loading playlist data...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Error</h1>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Back to Playlists
        </button>
      </div>
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    </div>
  );

  if (!playlist) return null;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Editing: {name}</h1>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Back to Playlists
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Index</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filename</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loop</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outgoing Commands</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ingoing Commands</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {playlist.items.map((item, index) => (
              <tr key={index}>
                <td className="px-6 py-4">
                  <select
                    value={item.index}
                    onChange={(e) => handleMoveItem(index, parseInt(e.target.value))}
                    className="w-20 px-2 py-1 border border-gray-300 rounded"
                  >
                    {playlist.items.map((_, i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => {
                      setSelectedVideo(item.filename);
                      setIsVideoModalOpen(true);
                    }}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {item.filename}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={item.isPartOfLoop}
                    onChange={() => handleUpdateItem(index, { isPartOfLoop: !item.isPartOfLoop })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </td>
                <td className="px-6 py-4">
                  <textarea
                    value={item.outgoingCommands.join('\n')}
                    onChange={(e) => handleUpdateItem(index, { outgoingCommands: e.target.value.split('\n') })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    rows="3"
                  />
                </td>
                <td className="px-6 py-4">
                  <textarea
                    value={item.ingoingCommands.join('\n')}
                    onChange={(e) => handleUpdateItem(index, { ingoingCommands: e.target.value.split('\n') })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    rows="3"
                  />
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => setIsAddModalOpen(true)}
        className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Add New Track
      </button>

      {/* Add Track Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Track"
        footer={
          <>
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleAddItem}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Video
            </label>
            <select
              value={newItem.filename}
              onChange={(e) => setNewItem({ ...newItem, filename: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Select a video...</option>
              {availableVideos.map((video) => (
                <option key={video} value={video}>
                  {video}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={newItem.isPartOfLoop}
              onChange={(e) => setNewItem({ ...newItem, isPartOfLoop: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-900">
              Part of Loop
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Outgoing Commands
            </label>
            <textarea
              value={newItem.outgoingCommands.join('\n')}
              onChange={(e) => setNewItem({ ...newItem, outgoingCommands: e.target.value.split('\n') })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows="3"
              placeholder="One command per line"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ingoing Commands
            </label>
            <textarea
              value={newItem.ingoingCommands.join('\n')}
              onChange={(e) => setNewItem({ ...newItem, ingoingCommands: e.target.value.split('\n') })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows="3"
              placeholder="One command per line"
            />
          </div>
        </div>
      </Modal>

      {/* Video Preview Modal */}
      <Modal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        title="Video Preview"
        footer={
          <button
            onClick={() => setIsVideoModalOpen(false)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Close
          </button>
        }
      >
        <video
          src={`${API_URL}/videos/${selectedVideo}`}
          controls
          className="w-full"
        >
          Your browser does not support the video tag.
        </video>
      </Modal>
    </div>
  );
};

export default PlaylistEditorPage; 