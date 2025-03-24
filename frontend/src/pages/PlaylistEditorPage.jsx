import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Modal from '../components/test_Modal';
import DraggableList from '../components/DraggableList';
import { API_URL } from '../config';

const PlaylistEditorPage = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [availableVideos, setAvailableVideos] = useState([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newItem, setNewItem] = useState({
    filename: '',
    isPartOfLoop: false,
    outgoingCommands: [],
    ingoingCommands: []
  });
  const [uploadError, setUploadError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [showSettingsAfterUpload, setShowSettingsAfterUpload] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [trackToDelete, setTrackToDelete] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    fetchPlaylist();
    fetchAvailableVideos();
    fetchCurrentTrack();
  }, [name]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowAddMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchCurrentTrack = async () => {
    try {
      const response = await fetch(`${API_URL}/api/getCurrentTrack`);
      const data = await response.json();
      setCurrentTrack(data.filename);
    } catch (error) {
      console.error('Error fetching current track:', error);
    }
  };

  const fetchPlaylist = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/api/getPlaylist/${name}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load playlist: ${response.statusText}`);
      }
      
      const data = await response.json();
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

  const handleMoveItem = async (fromIndex, toIndex, shouldToggleLoop = false) => {
    try {
      console.log(`Moving item from index ${fromIndex} to index ${toIndex}, toggle loop: ${shouldToggleLoop}`);
      
      // First move the item to its new position
      const moveResponse = await fetch(`${API_URL}/api/moveItem/${name}/${fromIndex}/${toIndex}`, {
        method: 'POST',
      });

      if (!moveResponse.ok) {
        throw new Error(`Failed to move item: ${moveResponse.statusText}`);
      }
      
      // If we need to toggle the loop status, do it after moving the item
      if (shouldToggleLoop) {
        console.log(`Toggling loop status for item at index ${toIndex}`);
        
        const toggleResponse = await fetch(`${API_URL}/api/toggleLoop/${name}/${toIndex}`, {
          method: 'POST',
        });

        if (!toggleResponse.ok) {
          throw new Error(`Failed to toggle loop status: ${toggleResponse.statusText}`);
        }
      }
      
      // Refresh the playlist to show the updated order and status
      await fetchPlaylist();
      console.log('Playlist refreshed after move and toggle operations');
    } catch (error) {
      console.error('Error moving/updating item:', error);
      // Show the error to the user
      setError(`Failed to update playlist: ${error.message}`);
      // Fetch the playlist again to restore the correct state
      fetchPlaylist();
    }
  };

  const handleToggleLoop = async (index) => {
    try {
      console.log(`Toggling loop status for item at index ${index}`);
      
      const toggleResponse = await fetch(`${API_URL}/api/toggleLoop/${name}/${index}`, {
        method: 'POST',
      });

      if (!toggleResponse.ok) {
        throw new Error(`Failed to toggle loop status: ${toggleResponse.statusText}`);
      }
      
      // Refresh the playlist to show the updated status
      await fetchPlaylist();
    } catch (error) {
      console.error('Error toggling loop status:', error);
      setError(`Failed to toggle loop status: ${error.message}`);
      fetchPlaylist();
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    setUploadedFile(null);

    const formData = new FormData();
    formData.append('video', file);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/api/upload`, true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(Math.round(percentComplete));
        }
      };

      xhr.onerror = () => {
        setUploadError('Network error occurred during upload');
        setIsUploading(false);
      };

      const uploadPromise = new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve(result);
            } catch (e) {
              reject(new Error('Invalid response format'));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.error || 'Upload failed'));
            } catch (e) {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        };
      });

      xhr.send(formData);
      const result = await uploadPromise;

      setUploadedFile(result);
      setShowSettingsAfterUpload(true);
      await fetchAvailableVideos();
      setUploadProgress(100);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddUploadedVideo = async () => {
    if (!uploadedFile) return;

    try {
      await fetch(`${API_URL}/api/addToPlaylist/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: uploadedFile.filename,
          isPartOfLoop: newItem.isPartOfLoop,
          outgoingCommands: newItem.outgoingCommands,
          ingoingCommands: newItem.ingoingCommands
        }),
      });
      setShowUploadModal(false);
      setShowSettingsAfterUpload(false);
      setUploadedFile(null);
      setNewItem({
        filename: '',
        isPartOfLoop: false,
        outgoingCommands: [],
        ingoingCommands: []
      });
      fetchPlaylist();
    } catch (error) {
      console.error('Error adding uploaded video:', error);
      setUploadError('Failed to add video to playlist');
    }
  };

  const handleDeleteTrack = async (index) => {
    try {
      await fetch(`${API_URL}/api/removeFromPlaylist/${name}/${index}`, {
        method: 'DELETE',
      });
      setShowDeleteConfirmation(false);
      setTrackToDelete(null);
      setIsTrackModalOpen(false);
      fetchPlaylist();
    } catch (error) {
      console.error('Error deleting track:', error);
    }
  };

  const transformItems = (items) => {
    if (!items) return [];
    
    console.log('Transforming items:', items);
    
    // Separate items into two lists
    const loopedItems = items.filter(item => item.isPartOfLoop);
    const interactiveItems = items.filter(item => !item.isPartOfLoop);
    
    console.log(`Found ${loopedItems.length} looped items and ${interactiveItems.length} interactive items`);
    
    // Transform looped items with their own index sequence
    const transformedLooped = loopedItems.map((item, idx) => ({
      id: `looped-${item.index}`,
      filename: item.filename,
      index: idx + 1, // UI index starting from 1
      originalIndex: item.index, // Keep original index for API calls
      isPartOfLoop: true,
      isPlaying: item.filename === currentTrack,
      originalData: item
    }));
    
    // Transform interactive items with their own index sequence
    const transformedInteractive = interactiveItems.map((item, idx) => ({
      id: `interactive-${item.index}`,
      filename: item.filename,
      index: idx + 1, // UI index starting from 1
      originalIndex: item.index, // Keep original index for API calls
      isPartOfLoop: false,
      isPlaying: item.filename === currentTrack,
      originalData: item
    }));
    
    // Return combined array
    return [...transformedLooped, ...transformedInteractive];
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

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Editing playlist: {name}</h1>
        <div className="flex items-center gap-4">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              +
            </button>
            {showAddMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
                <button
                  onClick={() => { setShowAddMenu(false); setIsAddModalOpen(true); }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Add new video from Player
                </button>
                <button
                  onClick={() => { setShowAddMenu(false); setShowUploadModal(true); }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Upload a new video
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Back to Playlists
          </button>
        </div>
      </div>

      {playlist && (
        <DraggableList
          items={transformItems(playlist.items)}
          onItemMove={handleMoveItem}
          onItemLoopToggle={handleToggleLoop}
          onItemClick={(item) => {
            setSelectedTrack(item);
            setIsTrackModalOpen(true);
          }}
        />
      )}

      {/* Track Edit Modal */}
      <Modal
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
        title="Track Settings"
        footer={
          <div className="flex justify-between w-full">
            <button
              onClick={() => {
                setTrackToDelete(selectedTrack);
                setShowDeleteConfirmation(true);
              }}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete Track
            </button>
            <button
              onClick={() => setIsTrackModalOpen(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        }
      >
        {selectedTrack && (
          <div className="space-y-6">
            <div>
              <video
                src={`${API_URL}/videos/${selectedTrack.filename}`}
                controls
                className="w-full rounded mb-4"
              >
                Your browser does not support the video tag.
              </video>
              <div className="text-sm text-gray-600">
                <p>Direct link: <a href={`${API_URL}/videos/${selectedTrack.filename}`} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">{selectedTrack.filename}</a></p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Outgoing Commands
              </label>
              <textarea
                value={selectedTrack.outgoingCommands.join('\n')}
                onChange={(e) => handleUpdateItem(selectedTrack.index, {
                  outgoingCommands: e.target.value.split('\n').filter(cmd => cmd.trim())
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                rows="3"
                placeholder="Enter commands (one per line)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ingoing Commands
              </label>
              <textarea
                value={selectedTrack.ingoingCommands.join('\n')}
                onChange={(e) => handleUpdateItem(selectedTrack.index, {
                  ingoingCommands: e.target.value.split('\n').filter(cmd => cmd.trim())
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                rows="3"
                placeholder="Enter commands (one per line)"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        title="Confirm Delete"
        footer={
          <>
            <button
              onClick={() => setShowDeleteConfirmation(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={() => handleDeleteTrack(trackToDelete?.index)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-gray-700">
          Are you sure you want to delete this track? This action cannot be undone.
        </p>
      </Modal>

      {/* Add Track Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Track"
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
              className={`px-4 py-2 bg-blue-600 text-white rounded ${!newItem.filename ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
              disabled={!newItem.filename}
            >
              Add
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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

          {newItem.filename && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preview
              </label>
              <video
                src={`${API_URL}/videos/${newItem.filename}`}
                controls
                className="w-full rounded mb-4"
                style={{ maxHeight: '200px' }}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}
          
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Outgoing Commands
            </label>
            <textarea
              value={newItem.outgoingCommands.join('\n')}
              onChange={(e) => setNewItem({
                ...newItem,
                outgoingCommands: e.target.value.split('\n').filter(cmd => cmd.trim())
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows="3"
              placeholder="Enter commands (one per line)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ingoing Commands
            </label>
            <textarea
              value={newItem.ingoingCommands.join('\n')}
              onChange={(e) => setNewItem({
                ...newItem,
                ingoingCommands: e.target.value.split('\n').filter(cmd => cmd.trim())
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows="3"
              placeholder="Enter commands (one per line)"
            />
          </div>
        </div>
      </Modal>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setShowSettingsAfterUpload(false);
          setUploadedFile(null);
          setUploadError(null);
        }}
        title={showSettingsAfterUpload ? "Video Settings" : "Upload Video"}
        footer={
          <>
            <button
              onClick={() => {
                setShowUploadModal(false);
                setShowSettingsAfterUpload(false);
                setUploadedFile(null);
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            {showSettingsAfterUpload && (
              <button
                onClick={handleAddUploadedVideo}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={!uploadedFile}
              >
                Add to Playlist
              </button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {uploadError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {uploadError}
            </div>
          )}
          
          {!showSettingsAfterUpload ? (
            <>
              <input
                type="file"
                accept="video/*"
                onChange={handleUpload}
                disabled={isUploading}
                className="mb-4"
              />
              {isUploading && (
                <div className="w-full bg-gray-200 rounded">
                  <div
                    className="bg-blue-500 text-xs leading-none py-1 text-center text-white rounded"
                    style={{ width: `${uploadProgress}%` }}
                  >
                    {uploadProgress}%
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">Uploaded File:</span>
                <span className="text-sm text-gray-600">{uploadedFile.filename}</span>
              </div>
              
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newItem.isPartOfLoop}
                    onChange={(e) => setNewItem({...newItem, isPartOfLoop: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium">Include in Loop</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Outgoing Commands</label>
                <textarea
                  value={newItem.outgoingCommands.join('\n')}
                  onChange={(e) => setNewItem({
                    ...newItem,
                    outgoingCommands: e.target.value.split('\n').filter(cmd => cmd.trim())
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows="3"
                  placeholder="Enter commands (one per line)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Ingoing Commands</label>
                <textarea
                  value={newItem.ingoingCommands.join('\n')}
                  onChange={(e) => setNewItem({
                    ...newItem,
                    ingoingCommands: e.target.value.split('\n').filter(cmd => cmd.trim())
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows="3"
                  placeholder="Enter commands (one per line)"
                />
              </div>

              {uploadedFile && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Preview</h3>
                  <video
                    src={`${API_URL}/videos/${uploadedFile.filename}`}
                    controls
                    className="w-full rounded"
                    style={{ maxHeight: '200px' }}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default PlaylistEditorPage; 