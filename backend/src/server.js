const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const Playlist = require('./models/Playlist');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Storage configuration
const PLAYLISTS_DIR = path.join(__dirname, '../../playlists');
const VIDEOS_DIR = path.join(__dirname, '../../payload');

// Ensure directories exist
async function ensureDirectories() {
    await fs.mkdir(PLAYLISTS_DIR, { recursive: true });
    await fs.mkdir(VIDEOS_DIR, { recursive: true });
}

// List all available playlists
app.get('/api/listPlaylists', async (req, res) => {
    try {
        const files = await fs.readdir(PLAYLISTS_DIR);
        const playlists = await Promise.all(
            files
                .filter(file => file.endsWith('.json'))
                .map(async file => {
                    const playlist = await Playlist.load(path.join(PLAYLISTS_DIR, file));
                    return { name: playlist.name, itemCount: playlist.items.length };
                })
        );
        res.json(playlists);
    } catch (error) {
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

// Start server
async function start() {
    await ensureDirectories();
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

start(); 