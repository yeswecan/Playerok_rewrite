import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Modal from '../components/test_Modal';
import DraggableList from '../components/DraggableList';
import { API_URL } from '../config';
// --- Action Editor Imports ---
import ActionEditorComponent from '../components/ActionEditor/ActionEditorComponent.jsx';
import { ChevronLeft, Plus, Settings } from 'lucide-react';
// --- DND Imports ---
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { SelectionProvider, SelectionContext } from '../context/SelectionContext';
import SelectionHighlighter from '../components/ui/SelectionHighlighter';

// --- Mock Data for Action Editor ---
const MOCK_HIGHLIGHT_DICTIONARY = {
  'play': { hint: 'Starts playback' },
  'stop': { hint: 'Stops playback' },
  'pause': { hint: 'Pauses playback' },
  'light_on': { hint: 'Turns light on' },
  'light_off': { hint: 'Turns light off' },
  'scene_change': { hint: 'Changes the scene' },
};

const initialRegisteredActions = Object.entries(MOCK_HIGHLIGHT_DICTIONARY).map(([word, data]) => ({
  word: word,
  hint: data.hint || `Hint for ${word}` // Add default hint
}));

const qualifierOptions = [
  { id: "incoming", label: "Incoming" },
  { id: "outgoing", label: "Outgoing" },
  { id: "scheduled", label: "Scheduled" },
];
// --- End Mock Data ---

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
  const [editingTrackActions, setEditingTrackActions] = useState([]); // State for modal editor
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newItem, setNewItem] = useState({
    filename: '',
    isPartOfLoop: false,
    actions: [], // Replaced outgoing/ingoingCommands
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
  const [showPlaylistActionsModal, setShowPlaylistActionsModal] = useState(false);
  const [playlistActionsSettings, setPlaylistActionsSettings] = useState({
    prevTrack: [],
    nextTrack: [],
    pause: [],
    play: [],
  });

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
        actions: [],
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
        case 'isPartOfLoop':
          apiEndpoint = 'toggleLoop';
          body = {};
          break;
        case 'actions': 
            // Now we handle the actual update
            console.log(`[handleUpdateItem] Updating actions for index ${index}:`, updates.actions);
            // Optimistically update local playlist state so inline edits reflect immediately
            setPlaylist(prev => ({
              ...prev,
              items: prev.items.map((item, idx) =>
                idx === index ? { ...item, actions: updates.actions } : item
              ),
            }));
            apiEndpoint = 'updateActions'; // Hypothetical endpoint
            body = { actions: updates.actions };
            // Note: Backend needs to implement PUT /api/updateActions/:playlistName/:itemIndex
            // to receive and save the entire actions array.
            break; // Proceed with the fetch below
        default:
          console.warn(`[handleUpdateItem] Unknown update key: ${endpoint}`);
          return;
      }

      // Use PUT for updates that replace data (like the actions array)
      const method = (endpoint === 'actions' || endpoint === 'filename') ? 'PUT' : 'POST';

      const response = await fetch(`${API_URL}/api/${apiEndpoint}/${name}/${index}`, {
        method: method, // Use PUT or POST appropriately
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Try to parse error
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }

      // Refresh playlist after successful update (skip for actions optimistic update)
      if (Object.keys(updates)[0] !== 'actions') {
        fetchPlaylist();
      }
    } catch (error) {
      console.error('Error updating item:', error);
      setError(`Failed to update item: ${error.message}`);
      // Optionally, fetch playlist again on error to ensure UI consistency
      // fetchPlaylist(); 
    }
  };

  const handleMoveItem = async (fromIndex, toIndex, shouldToggleLoop = false) => {
    // Optimistically update playlist order and loop status locally
    setPlaylist(prev => {
      if (!prev) return prev;
      const itemsCopy = [...prev.items];
      // Remove moved item
      const [movedItem] = itemsCopy.splice(fromIndex, 1);
      // Toggle loop status if needed
      if (shouldToggleLoop) movedItem.isPartOfLoop = !movedItem.isPartOfLoop;
      // Insert at new position
      itemsCopy.splice(toIndex, 0, movedItem);
      // Reindex items
      itemsCopy.forEach((item, idx) => item.index = idx);
      return { ...prev, items: itemsCopy };
    });
    try {
      console.log(`Moving item from index ${fromIndex} to index ${toIndex}, toggle loop: ${shouldToggleLoop}`);
      
      // Toggle loop status via API if needed
      if (shouldToggleLoop) {
        console.log(`Toggling loop status for item at original index ${fromIndex}`);
        const toggleResponse = await fetch(`${API_URL}/api/toggleLoop/${name}/${fromIndex}`, { method: 'POST' });
        if (!toggleResponse.ok) throw new Error(`Failed to toggle loop status: ${toggleResponse.statusText}`);
      }

      // Move the item via API
      const moveResponse = await fetch(`${API_URL}/api/moveItem/${name}/${fromIndex}/${toIndex}`, { method: 'POST' });
      if (!moveResponse.ok) throw new Error(`Failed to move item: ${moveResponse.statusText}`);
      console.log('Move API succeeded');
    } catch (error) {
      console.error('Error moving/updating item:', error);
      setError(`Failed to update playlist: ${error.message}`);
      // Restore from server on error
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
          actions: newItem.actions,
        }),
      });
      setShowUploadModal(false);
      setShowSettingsAfterUpload(false);
      setUploadedFile(null);
      setNewItem({
        filename: '',
        isPartOfLoop: false,
        actions: [],
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
    if (!items) return { looped: [], actionable: [] };
    
    const transformItem = (item, idx, isLooped) => {
      const originalIndexNum = typeof item.index === 'number' ? item.index : parseInt(item.index, 10);
      if (isNaN(originalIndexNum)) {
        console.error(`[transformItems] Invalid original index found for ${isLooped ? 'looped' : 'interactive'} item:`, item);
      }
      const previewUrl = item.previewUrl || item.preview_url || `${API_URL}/previews/${item.filename}.jpg`;
      
      // --- Add default actionNodeType and actionId to actions ---
      const processedActions = (item.actions || []).map(action => ({
        ...action,
        // Default to 'ItemActionNode' for actions within playlist items
        actionNodeType: action.actionNodeType || 'ItemActionNode', 
        // Default actionId - 'Start' seems reasonable for an item action
        actionId: action.actionId || 'Start', 
      }));
      // --- End modification ---

      return {
        id: `${isLooped ? 'looped' : 'interactive'}-${item.index}`,
        filename: item.filename,
        previewUrl,
        index: idx + 1,
        originalIndex: isNaN(originalIndexNum) ? -1 : originalIndexNum,
        isPartOfLoop: isLooped,
        isPlaying: item.filename === currentTrack,
        actions: processedActions, // Use processed actions
        duration: item.duration,
        originalData: item
      };
    };
    
    const looped = items.filter(item => item.isPartOfLoop).map((item, idx) => transformItem(item, idx, true));
    const actionable = items.filter(item => !item.isPartOfLoop).map((item, idx) => transformItem(item, idx, false));
    return { looped, actionable };
  };

  // --- Callbacks for ActionEditorComponent within the Modal ---
  const handleModalActionCreated = (id, word, qualifier, equation = '=1', actionNodeType, actionId) => { // Added default equation & type/id
    console.log(`[handleModalActionCreated] Action created:`, { id, word, qualifier, equation, actionNodeType, actionId });
    setEditingTrackActions(prevActions => [...prevActions, { id, word, qualifier, equation, actionNodeType, actionId }]); // Include type/id
  };

  const handleModalActionDeleted = (nodeId) => {
    console.log(`[Modal Editor] Action deleted: ${nodeId}`);
    setEditingTrackActions(prev => prev.filter(action => action.id !== nodeId));
  };

  const handleModalQualifierChanged = (nodeId, newQualifier) => {
    console.log(`[Modal Editor] Qualifier changed for ${nodeId}: ${newQualifier}`);
    setEditingTrackActions(prev => prev.map(action =>
        action.id === nodeId ? { ...action, qualifier: newQualifier } : action
    ));
  };

  const handleModalActionWordChanged = (nodeId, newWord) => {
    console.log(`[Modal Editor] Word changed for ${nodeId}: ${newWord}`);
    // Add hint if it exists in our mock dictionary
    const newHint = MOCK_HIGHLIGHT_DICTIONARY[newWord]?.hint || `Hint for ${newWord}`;
    setEditingTrackActions(prev => prev.map(action =>
        action.id === nodeId ? { ...action, word: newWord, hint: newHint } : action
    ));
  };

  const handleModalActionEquationChanged = (nodeId, newEquation) => {
    console.log(`[Modal Editor] Equation changed for ${nodeId}: ${newEquation}`);
    setEditingTrackActions(prev => prev.map(action =>
        action.id === nodeId ? { ...action, equation: newEquation } : action
    ));
  };
  // --- End Modal Callbacks ---

  const handleSavePlaylistActions = async () => {
    try {
      console.log("Saving Playlist Actions:", playlistActionsSettings);
      // You'll need a backend endpoint to save these playlist-level actions
      const response = await fetch(`${API_URL}/api/updatePlaylistSettings/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playlistActionsSettings),
      });
      if (!response.ok) throw new Error('Failed to save playlist actions');
      setShowPlaylistActionsModal(false);
      // Maybe refetch playlist if settings affect general playlist data
      // fetchPlaylist();
    } catch (error) {
      console.error('Error saving playlist actions:', error);
      // Display error to user
    }
  };

  const handleSaveTrackSettings = async () => {
    try {
      console.log(`[handleSaveTrackSettings] Saving actions for track index ${selectedTrack.index}:`, editingTrackActions);
      // Call handleUpdateItem which now knows how to handle 'actions'
      await handleUpdateItem(selectedTrack.index, { actions: editingTrackActions });
      setIsTrackModalOpen(false);
      setSelectedTrack(null);
      setEditingTrackActions([]); // Clear modal state
    } catch (error) {
      console.error('Error saving track settings:', error);
      // Optionally display an error message to the user
    }
  };

  const PageWrapper = () => {
    const { clearSelection } = useContext(SelectionContext);

    const handlePageClick = (e) => {
      // If the click happened outside of any component that should maintain selection
      // (i.e., not within an editor), clear the global selection.
      if (!e.target.closest('.action-editor-wrapper')) {
        console.log('[PlaylistEditorPage] Clicked outside all editors. Clearing selection.');
        clearSelection();
      }
    };

  return (
      <div className="p-4 bg-gray-50 min-h-screen" onClick={handlePageClick}>
        <SelectionHighlighter />
        <div className="max-w-7xl mx-auto">
    <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => navigate('/')}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full flex items-center"
            aria-label="Go back to playlists"
          >
            <ChevronLeft size={20} className="mr-1" />
            Back
          </button>
          <h1 className="text-2xl font-bold">{playlist.name}</h1>
          <div className="relative flex space-x-2">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full flex items-center"
              aria-label="Add video item"
            >
              <Plus size={20} className="mr-1" /> Add Video
            </button>
            <button
              onClick={() => {
                setPlaylistActionsSettings(playlist.settings || { prevTrack: [], nextTrack: [], pause: [], play: [] });
                setShowPlaylistActionsModal(true);
              }}
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full flex items-center"
              aria-label="Playlist actions"
            >
              <Settings size={20} className="mr-1" />
              Playlist actions
            </button>
            {showAddMenu && (
              <div ref={menuRef} className="absolute right-0 mt-10 w-48 bg-white rounded-md shadow-lg z-10">
                <ul className="py-1">
                  <li>
                    <button
                      onClick={() => { setShowUploadModal(true); setShowAddMenu(false); }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Upload New Video
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => { setIsAddModalOpen(true); setShowAddMenu(false); }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Add Existing Video
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
          <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError(null)}>
            <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
          </span>
        </div>}

        <DraggableList
          loopedItems={looped}
          actionableItems={actionable}
          onMoveItem={handleMoveItem}
          onToggleLoop={handleToggleLoop}
          onUpdateItem={handleUpdateItem}
          currentTrack={currentTrack}
          onEditActions={(track) => {
              console.log("[PlaylistEditorPage] onEditActions called for:", track);
              setSelectedTrack(track);
              setEditingTrackActions(JSON.parse(JSON.stringify(track.actions || [])));
              setIsTrackModalOpen(true);
          }}
          onDeleteTrack={(track) => {
            setTrackToDelete(track);
            setShowDeleteConfirmation(true);
          }}
              onSave={handleSavePlaylistActions}
        />
          </div>

      <Modal
        isOpen={isTrackModalOpen}
        onClose={() => { setIsTrackModalOpen(false); setSelectedTrack(null); setEditingTrackActions([]); }}
        title={
          <> 
            <button
              onClick={() => setIsTrackModalOpen(false)}
              className="mr-2 p-1 text-gray-600 hover:text-gray-800"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            Track Settings
          </>
        }
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
              onClick={handleSaveTrackSettings}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save & Close
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
                Actions (Incoming/Outgoing/Scheduled)
              </label>
              <div className="border rounded-lg p-2 bg-gray-50">
                <ActionEditorComponent
                  key={selectedTrack.id}
                  initialActions={editingTrackActions}
                  registeredActions={initialRegisteredActions}
                  qualifierOptions={qualifierOptions}
                  nodeType="ItemActionNode"
                  onActionsChange={(updatedActions) => {
                     console.log("[Track Settings Modal] onActionsChange:", updatedActions);
                     setEditingTrackActions(updatedActions);
                   }}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

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
              onChange={(e) => setNewItem({ ...newItem, filename: e.target.value, actions: [] })}
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
        </div>
      </Modal>

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

      <Modal
        isOpen={showPlaylistActionsModal}
        onClose={() => setShowPlaylistActionsModal(false)}
        title={
          <div className="flex items-center">
            <button onClick={() => setShowPlaylistActionsModal(false)} className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg p-2 mr-2">
              <ChevronLeft className="w-6 h-6" />
            </button>
            Playlist actions
          </div>
        }
        footer={
          <button onClick={handleSavePlaylistActions} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg">
            Save & quit
          </button>
        }
      >
        <div className="space-y-6 overflow-auto max-h-[70vh] p-4">
          {['prevTrack','nextTrack','pause','play'].map(key => (
            <div key={key} className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-2">
                {key === 'prevTrack' && 'Actions that move it to previous track'}
                {key === 'nextTrack' && 'Actions that move it to next track'}
                {key === 'pause' && 'Actions that make it pause'}
                {key === 'play' && 'Actions that make it play'}
              </h3>
              <ActionEditorComponent
                key={`${key}-actions`}
                initialActions={playlistActionsSettings[key]}
                registeredActions={initialRegisteredActions}
                qualifierOptions={qualifierOptions}
                nodeType="PlaylistActionNode"
                onActionsChanged={(newActions) =>
                  setPlaylistActionsSettings(prev => ({ ...prev, [key]: newActions }))
                }
              />
            </div>
          ))}
        </div>
      </Modal>
        </div>
    </div>
    );
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

  const { looped, actionable } = transformItems(playlist.items);

  return (
    <DndProvider backend={HTML5Backend}>
      <SelectionProvider>
        <PageWrapper />
      </SelectionProvider>
    </DndProvider>
  );
};

export default PlaylistEditorPage; 