const PlaylistItem = require('./PlaylistItem');
const fs = require('fs').promises;
const path = require('path');

class Playlist {
    constructor(name) {
        this.name = name;
        this.items = [];
    }

    addItem(filename, isPartOfLoop = false) {
        const index = this.items.length;
        const item = new PlaylistItem(filename, index);
        item.isPartOfLoop = isPartOfLoop;
        this.items.push(item);
        return item;
    }

    removeItem(index) {
        this.items = this.items.filter(item => item.index !== index);
        // Reindex remaining items
        this.items.forEach((item, idx) => item.index = idx);
    }

    getItem(index) {
        return this.items.find(item => item.index === index);
    }

    updateItem(index, updates) {
        const item = this.getItem(index);
        if (!item) return null;
        Object.assign(item, updates);
        return item;
    }

    moveItem(fromIndex, toIndex) {
        const item = this.items.find(item => item.index === fromIndex);
        if (!item) return;
        
        this.items = this.items.filter(item => item.index !== fromIndex);
        this.items.splice(toIndex, 0, item);
        // Reindex all items
        this.items.forEach((item, idx) => item.index = idx);
    }

    toJSON() {
        return {
            name: this.name,
            items: this.items.map(item => item.toJSON())
        };
    }

    static async fromJSON(json) {
        const playlist = new Playlist(json.name);
        playlist.items = json.items.map(itemJson => PlaylistItem.fromJSON(itemJson));
        return playlist;
    }

    static async generateFromFolder(name, folderPath) {
        const playlist = new Playlist(name);
        const files = await fs.readdir(folderPath);
        
        // Filter for video files (add more extensions if needed)
        const videoFiles = files.filter(file => 
            /\.(mp4|avi|mkv|mov|wmv)$/i.test(file)
        );

        for (const file of videoFiles) {
            playlist.addItem(file);
        }

        return playlist;
    }

    async save(outputPath) {
        const json = JSON.stringify(this.toJSON(), null, 2);
        await fs.writeFile(outputPath, json, 'utf8');
    }

    static async load(filePath) {
        const json = JSON.parse(await fs.readFile(filePath, 'utf8'));
        return Playlist.fromJSON(json);
    }
}

module.exports = Playlist; 