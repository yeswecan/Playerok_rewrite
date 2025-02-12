# Playerok Rewrite Project Summary

## Overview
A web-based playlist management system with a React frontend and Express backend, designed to manage video playlists with advanced control features.

## Architecture

### Backend (`/backend`)
- **Server**: Express.js server (`test_server.js`)
- **Port**: 3000
- **Key Features**:
  - CORS enabled for specific origins (`localhost:5173` and `192.168.1.5:5173`)
  - File upload handling with Multer (500MB limit)
  - Static video serving
  - Playlist management API
  - Detailed request logging

#### Directory Structure:
```
/backend
├── /src
│   ├── test_server.js         # Main server file
│   ├── /models
│   │   ├── test_Playlist.js   # Playlist model
│   │   └── test_PlaylistItem.js # Playlist item model
│   └── /tests
└── /playlists                 # JSON storage for playlists
```

#### Storage:
- Playlists are stored as JSON files in `/playlists`
- Videos are stored in `/payload` directory
- Both directories are auto-created if missing

### Frontend (`/frontend`)
- **Framework**: React with Vite
- **Port**: 5173
- **Key Dependencies**:
  - `@hello-pangea/dnd` for drag-and-drop
  - `framer-motion` for animations
  - TailwindCSS for styling

#### Key Components:
1. **PlaylistsPage** (`/src/pages/test_PlaylistsPage.jsx`)
   - Lists all playlists
   - Create/Delete playlist functionality
   - Shows debug information

2. **PlaylistEditorPage** (`/src/pages/test_PlaylistEditorPage.jsx`)
   - Full playlist editing capabilities
   - Video upload with progress tracking
   - Video preview with download options
   - Command management (ingoing/outgoing)
   - Loop control
   - Position reordering

3. **Modal** (`/src/components/test_Modal.jsx`)
   - Reusable modal component
   - Used for uploads, previews, and confirmations

## API Endpoints

### Playlist Management
```
GET    /api/listPlaylists         # List all playlists
GET    /api/getPlaylist/:name     # Get specific playlist
DELETE /api/removePlaylist/:name  # Delete playlist
POST   /api/addToPlaylist/:name   # Add item to playlist
DELETE /api/removeFromPlaylist/:name/:index  # Remove item
POST   /api/moveItem/:name/:index/:toIndex   # Reorder items
```

### Video Management
```
GET  /api/listVideos   # List available videos
POST /api/upload       # Upload new video (multipart/form-data)
GET  /videos/*         # Static video serving
```

### Item Updates
```
POST /api/changeFilename/:name/:index
POST /api/changeOutgoingCommands/:name/:index
POST /api/changeIngoingCommands/:name/:index
POST /api/toggleLoop/:name/:index
```

## Configuration
- API URL configured in `/frontend/src/config.js`
- Currently set to `http://192.168.1.5:3000`
- CORS allows both localhost and local IP access

## Data Models

### Playlist Item
```javascript
{
  filename: string,
  index: number,
  isPartOfLoop: boolean,
  outgoingCommands: string[],
  ingoingCommands: string[]
}
```

### Playlist
```javascript
{
  name: string,
  items: PlaylistItem[]
}
```

## Known Implementation Details/Limitations

1. **File Upload**:
   - 500MB size limit
   - Only video files accepted
   - Uses XMLHttpRequest for progress tracking
   - Files stored with sanitized original names

2. **Video Compatibility**:
   - Some mobile uploads may have progress tracking issues
   - Some video formats may not play in browser but work in VLC
   - Direct download links provided for compatibility

3. **Commands**:
   - Stored as arrays of strings
   - Can be entered comma-separated or line-by-line
   - No validation on command format

4. **Mobile Access**:
   - Requires proper local IP configuration
   - May have video playback limitations
   - Download links provided for offline viewing

## Development Notes

1. **Starting the Project**:
   ```bash
   # Backend
   cd backend
   npm run dev

   # Frontend
   cd frontend
   npm run dev
   ```

2. **Testing**:
   - Test files prefixed with `test_`
   - Mocha/Chai testing framework
   - Run tests with `npm test`

3. **Debug Features**:
   - Detailed console logging
   - Debug info section in UI
   - Upload progress tracking
   - Error state handling

4. **Future Considerations**:
   - Better mobile upload handling
   - Video format validation
   - Command validation/standardization
   - Progress tracking improvements
   - Enhanced error reporting 