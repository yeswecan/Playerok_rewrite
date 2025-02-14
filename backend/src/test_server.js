const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const Playlist = require('./models/test_Playlist');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for video upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../payload'));
    },
    filename: (req, file, cb) => {
        // Keep original filename but ensure it's safe
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, safeName);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Accept only video files
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'));
        }
    },
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit
    }
});

// Detailed request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    next();
});

// CORS configuration
app.use(cors({
    origin: ['http://localhost:5173', 'http://192.168.1.5:5173'],
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type'],
    credentials: true
}));

app.use(express.json());

// Storage configuration
const PLAYLISTS_DIR = path.join(__dirname, '../../playlists');
const VIDEOS_DIR = path.join(__dirname, '../../payload');

// Serve video files statically
app.use('/videos', express.static(VIDEOS_DIR));

// Ensure directories exist
async function ensureDirectories() {
    await fs.mkdir(PLAYLISTS_DIR, { recursive: true });
    await fs.mkdir(VIDEOS_DIR, { recursive: true });
    console.log('Directories ensured:', {
        PLAYLISTS_DIR,
        VIDEOS_DIR
    });
}

// List all available playlists
app.get('/api/listPlaylists', async (req, res) => {
    try {
        console.log('Listing playlists from directory:', PLAYLISTS_DIR);
        const files = await fs.readdir(PLAYLISTS_DIR);
        console.log('Found files:', files);
        
        const playlists = await Promise.all(
            files
                .filter(file => file.endsWith('.json'))
                .map(async file => {
                    console.log('Loading playlist:', file);
                    const playlist = await Playlist.load(path.join(PLAYLISTS_DIR, file));
                    return { name: playlist.name, itemCount: playlist.items.length };
                })
        );
        
        console.log('Sending playlists:', playlists);
        res.json(playlists);
    } catch (error) {
        console.error('Error in listPlaylists:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get playlist contents
app.get('/api/getPlaylist/:name', async (req, res) => {
    try {
        const playlist = await Playlist.load(path.join(PLAYLISTS_DIR, `${req.params.name}.json`));
        res.json(playlist);
    } catch (error) {
        res.status(404).json({ error: 'Playlist not found' });
    }
});

// Delete a playlist
app.delete('/api/removePlaylist/:name', async (req, res) => {
    try {
        await fs.unlink(path.join(PLAYLISTS_DIR, `${req.params.name}.json`));
        res.status(204).send();
    } catch (error) {
        res.status(404).json({ error: 'Playlist not found' });
    }
});

// Create a new empty playlist
app.post('/api/createPlaylist/:name', async (req, res) => {
    try {
        const playlistPath = path.join(PLAYLISTS_DIR, `${req.params.name}.json`);
        
        // Check if playlist already exists
        try {
            await fs.access(playlistPath);
            return res.status(400).json({ error: 'Playlist already exists' });
        } catch (err) {
            // File doesn't exist, we can proceed
        }

        // Create a new empty playlist
        const playlist = new Playlist(req.params.name);
        await playlist.save(playlistPath);
        
        res.status(201).json(playlist);
    } catch (error) {
        console.error('Error creating playlist:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add item to playlist
app.post('/api/addToPlaylist/:name', async (req, res) => {
    try {
        const { filename, isPartOfLoop } = req.body;
        const playlist = await Playlist.load(path.join(PLAYLISTS_DIR, `${req.params.name}.json`));
        const item = playlist.addItem(filename, isPartOfLoop);
        await playlist.save(path.join(PLAYLISTS_DIR, `${req.params.name}.json`));
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remove item from playlist
app.delete('/api/removeFromPlaylist/:name/:index', async (req, res) => {
    try {
        const playlist = await Playlist.load(path.join(PLAYLISTS_DIR, `${req.params.name}.json`));
        playlist.removeItem(parseInt(req.params.index));
        await playlist.save(path.join(PLAYLISTS_DIR, `${req.params.name}.json`));
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Change item filename
app.post('/api/changeFilename/:name/:index', async (req, res) => {
    try {
        const { filename } = req.body;
        const playlist = await Playlist.load(path.join(PLAYLISTS_DIR, `${req.params.name}.json`));
        const item = playlist.updateItem(parseInt(req.params.index), { filename });
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        await playlist.save(path.join(PLAYLISTS_DIR, `${req.params.name}.json`));
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Change outgoing commands
app.post('/api/changeOutgoingCommands/:name/:index', async (req, res) => {
    try {
        const { commands } = req.body;
        const playlist = await Playlist.load(path.join(PLAYLISTS_DIR, `${req.params.name}.json`));
        const item = playlist.updateItem(parseInt(req.params.index), { outgoingCommands: commands });
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        await playlist.save(path.join(PLAYLISTS_DIR, `${req.params.name}.json`));
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Change ingoing commands
app.post('/api/changeIngoingCommands/:name/:index', async (req, res) => {
    try {
        const { commands } = req.body;
        const playlist = await Playlist.load(path.join(PLAYLISTS_DIR, `${req.params.name}.json`));
        const item = playlist.updateItem(parseInt(req.params.index), { ingoingCommands: commands });
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        await playlist.save(path.join(PLAYLISTS_DIR, `${req.params.name}.json`));
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Move item to new position
app.post('/api/moveItem/:name/:index/:toIndex', async (req, res) => {
    try {
        const playlist = await Playlist.load(path.join(PLAYLISTS_DIR, `${req.params.name}.json`));
        playlist.moveItem(
            parseInt(req.params.index),
            parseInt(req.params.toIndex)
        );
        await playlist.save(path.join(PLAYLISTS_DIR, `${req.params.name}.json`));
        res.json(playlist);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Toggle loop status
app.post('/api/toggleLoop/:name/:index', async (req, res) => {
    try {
        const playlist = await Playlist.load(path.join(PLAYLISTS_DIR, `${req.params.name}.json`));
        const item = playlist.getItem(parseInt(req.params.index));
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        item.isPartOfLoop = !item.isPartOfLoop;
        await playlist.save(path.join(PLAYLISTS_DIR, `${req.params.name}.json`));
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List available videos
app.get('/api/listVideos', async (req, res) => {
    try {
        const files = await fs.readdir(VIDEOS_DIR);
        const videoFiles = files.filter(file => 
            /\.(mp4|avi|mkv|mov|wmv)$/i.test(file)
        );
        res.json(videoFiles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload video endpoint
app.post('/api/upload', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file uploaded' });
        }

        // Return the filename and other relevant info
        res.json({
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: error.message });
    }
});

// Mock endpoint for getting currently playing track
// In production, this would be connected to the actual player
app.get('/api/getCurrentTrack', async (req, res) => {
  try {
    const files = await fs.readdir(PLAYLISTS_DIR);
    if (files.length === 0) return res.json({ filename: null });
    
    const firstPlaylist = await Playlist.load(path.join(PLAYLISTS_DIR, files[0]));
    const currentTrack = firstPlaylist.items[1] || firstPlaylist.items[0] || null;
    res.json({ filename: currentTrack ? currentTrack.filename : null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handler for multer errors
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 500MB' });
        }
        return res.status(400).json({ error: err.message });
    }
    next(err);
});

// Start server
async function start() {
    try {
        await ensureDirectories();
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT}`);
            console.log('CORS enabled for:', ['http://localhost:5173', 'http://192.168.1.5:5173']);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

start(); 