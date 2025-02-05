import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/test_Modal';

const API_URL = 'http://192.168.1.5:3000'; // Change from localhost to IP

const PlaylistsPage = () => {
  const [playlists, setPlaylists] = useState([]);
  const [error, setError] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    try {
      console.log('Fetching playlists...');
      const response = await fetch(`${API_URL}/api/listPlaylists`);
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received playlists:', data);
      setPlaylists(data);
      setError(null);
    } catch (error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        type: error.name
      });
      setError(`Failed to load playlists: ${error.message}`);
    }
  };

  const handleDelete = async () => {
    try {
      await fetch(`${API_URL}/api/removePlaylist/${selectedPlaylist.name}`, {
        method: 'DELETE',
      });
      setIsDeleteModalOpen(false);
      setSelectedPlaylist(null);
      fetchPlaylists();
    } catch (error) {
      console.error('Error deleting playlist:', error);
    }
  };

  const handleAdd = async () => {
    if (!newPlaylistName.trim()) return;

    try {
      const response = await fetch(`${API_URL}/api/addToPlaylist/${newPlaylistName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename: '', isPartOfLoop: false }),
      });
      
      if (response.ok) {
        setIsAddModalOpen(false);
        setNewPlaylistName('');
        fetchPlaylists();
      }
    } catch (error) {
      console.error('Error creating playlist:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Playlists</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Debug info */}
      <div className="bg-gray-100 p-4 mb-4 rounded text-sm font-mono">
        <p>API URL: {API_URL}</p>
        <p>Playlists count: {playlists.length}</p>
        <p>Raw playlists data: {JSON.stringify(playlists)}</p>
      </div>
      
      <div className="bg-white rounded-lg shadow-md">
        {playlists.map((playlist) => (
          <div
            key={playlist.name}
            className="flex items-center justify-between p-4 border-b border-gray-200 last:border-b-0"
          >
            <button
              onClick={() => navigate(`/playlist/${playlist.name}`)}
              className="text-lg text-blue-600 hover:text-blue-800"
            >
              {playlist.name} ({playlist.itemCount} items)
            </button>
            <button
              onClick={() => {
                setSelectedPlaylist(playlist);
                setIsDeleteModalOpen(true);
              }}
              className="px-4 py-2 text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => setIsAddModalOpen(true)}
        className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Add New Playlist
      </button>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Delete"
        footer={
          <>
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete
            </button>
          </>
        }
      >
        <p>Are you sure you want to delete playlist "{selectedPlaylist?.name}"?</p>
      </Modal>

      {/* Add Playlist Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Playlist"
        footer={
          <>
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add
            </button>
          </>
        }
      >
        <input
          type="text"
          value={newPlaylistName}
          onChange={(e) => setNewPlaylistName(e.target.value)}
          placeholder="Enter playlist name"
          className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Modal>
    </div>
  );
};

export default PlaylistsPage; 