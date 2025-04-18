const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const Playlist = require('./models/test_Playlist');
// Add ffmpeg for thumbnail generation
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

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
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS', 'PATCH', 'PUT'],
    allowedHeaders: ['Content-Type'],
    credentials: true
}));

app.use(express.json());

// Storage configuration
const PLAYLISTS_DIR = path.join(__dirname, '../../playlists');
const VIDEOS_DIR = path.join(__dirname, '../../payload');

// Serve video files statically
app.use('/videos', express.static(VIDEOS_DIR));

// Serve preview images statically
const PREVIEWS_DIR = path.join(__dirname, '../../previews');
app.use('/previews', express.static(PREVIEWS_DIR));

// Ensure directories exist
async function ensureDirectories() {
    await fs.mkdir(PLAYLISTS_DIR, { recursive: true });
    await fs.mkdir(VIDEOS_DIR, { recursive: true });
    await fs.mkdir(PREVIEWS_DIR, { recursive: true });
    console.log('Directories ensured:', {
        PLAYLISTS_DIR,
        VIDEOS_DIR,
        PREVIEWS_DIR
    });
}

// Generate preview images for all videos without existing thumbnails
async function generatePreviews() {
  const files = await fs.readdir(VIDEOS_DIR);
  const videoFiles = files.filter(f => /\.(mp4|avi|mkv|mov|wmv)$/i.test(f));
  for (const file of videoFiles) {
    const previewPath = path.join(PREVIEWS_DIR, `${file}.jpg`);
    try {
      await fs.access(previewPath);
    } catch {
      console.log(`[generatePreviews] Creating preview for ${file}`);
      // Compute midpoint timestamp with ffprobe
      const inputPath = path.join(VIDEOS_DIR, file);
      let durationData;
      try {
        durationData = await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(inputPath, (err, data) => err ? reject(err) : resolve(data));
        });
      } catch (probeErr) {
        console.error(`Error probing duration for ${file}, defaulting to 0:`, probeErr);
        durationData = { format: { duration: 0 } };
      }
      const totalSeconds = durationData.format.duration || 0;
      const midpoint = totalSeconds > 0 ? totalSeconds / 2 : 0;
      // Generate a single padded screenshot using scale+pad filters
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .seekInput(midpoint)
          .videoFilters([
            'scale=iw*min(320/iw\\,240/ih):ih*min(320/iw\\,240/ih)',
            'pad=320:240:(320-iw*min(320/iw\\,240/ih))/2:(240-ih*min(320/iw\\,240/ih))/2:black'
          ])
          .outputOptions(['-vframes', '1'])
          .output(previewPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
    }
  }
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
        // Append duration to each item via ffprobe
        await Promise.all(playlist.items.map(async (item) => {
            const videoPath = path.join(VIDEOS_DIR, item.filename);
            try {
                const metadata = await new Promise((resolve, reject) => {
                    ffmpeg.ffprobe(videoPath, (err, data) => err ? reject(err) : resolve(data));
                });
                const totalSeconds = Math.floor(metadata.format.duration || 0);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                item.duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            } catch (probeError) {
                console.error(`Error probing duration for ${item.filename}:`, probeError);
                item.duration = null;
            }
        }));
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

// Update item actions
app.put('/api/updateActions/:name/:index', async (req, res) => {
    try {
        const { name, index } = req.params;
        const { actions } = req.body;

        // Validate actions input
        if (!Array.isArray(actions)) {
            return res.status(400).json({ error: 'Invalid actions format. Expected an array.' });
        }
        // Optional: Add more validation for the content of the actions array if needed

        const playlistPath = path.join(PLAYLISTS_DIR, `${name}.json`);
        const playlist = await Playlist.load(playlistPath);

        const itemIndex = parseInt(index);
        if (isNaN(itemIndex)) {
            return res.status(400).json({ error: 'Invalid item index.' });
        }

        // Use the existing updateItem method (assuming it can handle the 'actions' key)
        // Ensure Playlist.js's updateItem method correctly handles/validates the 'actions' field.
        const updatedItem = playlist.updateItem(itemIndex, { actions: actions });

        if (!updatedItem) {
            return res.status(404).json({ error: 'Item not found at the specified index.' });
        }

        await playlist.save(playlistPath);
        console.log(`[updateActions] Successfully updated actions for item ${itemIndex} in playlist ${name}`);
        res.json(updatedItem); // Send back the updated item

    } catch (error) {
        if (error.code === 'ENOENT') { // Handle playlist not found specifically
            return res.status(404).json({ error: 'Playlist not found' });
        }
        console.error(`[updateActions] Error updating actions for playlist ${req.params.name}, index ${req.params.index}:`, error);
        res.status(500).json({ error: 'Failed to update actions: ' + error.message });
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
        await generatePreviews();
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