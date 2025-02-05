const Playlist = require('./models/Playlist');
const path = require('path');

async function generateTestPlaylist() {
    try {
        const VIDEOS_DIR = path.join(__dirname, '../../payload');
        const PLAYLISTS_DIR = path.join(__dirname, '../../playlists');
        
        console.log('Generating playlist from:', VIDEOS_DIR);
        const playlist = await Playlist.generateFromFolder('main', VIDEOS_DIR);
        
        // Set first 3 items as part of loop
        playlist.items.slice(0, 3).forEach(item => {
            item.isPartOfLoop = true;
        });
        
        // Add some test commands
        if (playlist.items.length > 0) {
            playlist.items[0].outgoingCommands = ['start_show'];
            playlist.items[0].ingoingCommands = ['play_intro'];
        }
        
        const outputPath = path.join(PLAYLISTS_DIR, 'main.json');
        await playlist.save(outputPath);
        console.log('Playlist saved to:', outputPath);
        console.log('Playlist contents:', JSON.stringify(playlist, null, 2));
    } catch (error) {
        console.error('Error generating playlist:', error);
    }
}

generateTestPlaylist(); 