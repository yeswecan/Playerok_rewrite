const PlaylistItem = require('./test_PlaylistItem');
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
        // Validate indices
        if (fromIndex < 0 || fromIndex >= this.items.length) {
            throw new Error(`Invalid fromIndex: ${fromIndex}. Must be between 0 and ${this.items.length - 1}`);
        }
        if (toIndex < 0 || toIndex > this.items.length) {
            throw new Error(`Invalid toIndex: ${toIndex}. Must be between 0 and ${this.items.length}`);
        }

        const item = this.items.find(item => item.index === fromIndex);
        if (!item) {
            throw new Error(`Item not found at index ${fromIndex}`);
        }
        
        // Remove item from current position
        this.items = this.items.filter(i => i.index !== fromIndex);
        
        // Adjust indices for items between old and new positions
        if (fromIndex < toIndex) {
            // Moving forward: decrease indices of items between fromIndex and toIndex
            this.items.forEach(i => {
                if (i.index > fromIndex && i.index <= toIndex) {
                    i.index--;
                }
            });
        } else if (fromIndex > toIndex) {
            // Moving backward: increase indices of items between toIndex and fromIndex
            this.items.forEach(i => {
                if (i.index >= toIndex && i.index < fromIndex) {
                    i.index++;
                }
            });
        }
        
        // Insert item at new position
        item.index = toIndex;
        this.items.push(item);
        
        // Sort items by index to maintain order
        this.items.sort((a, b) => a.index - b.index);
        
        // Validate final state
        const indices = this.items.map(i => i.index);
        const uniqueIndices = new Set(indices);
        if (indices.length !== uniqueIndices.size) {
            throw new Error('Duplicate indices detected after move operation');
        }
    }

    toJSON() {
        return {
            name: this.name,
            items: this.items.map(item => item.toJSON())
        };
    }

    static async fromJSON(json) {
        if (!json || typeof json !== 'object') {
            throw new Error('Invalid playlist data: not an object');
        }
        if (!json.name || typeof json.name !== 'string') {
            throw new Error('Invalid playlist data: missing or invalid name');
        }
        if (!Array.isArray(json.items)) {
            throw new Error('Invalid playlist data: items is not an array');
        }

        const playlist = new Playlist(json.name);
        playlist.items = json.items.map(itemJson => PlaylistItem.fromJSON(itemJson));
        
        // Validate and fix indices
        playlist.items.forEach((item, idx) => item.index = idx);
        
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
        try {
            // Create a backup of the existing file if it exists
            try {
                const exists = await fs.access(outputPath).then(() => true).catch(() => false);
                if (exists) {
                    const backupPath = `${outputPath}.backup`;
                    await fs.copyFile(outputPath, backupPath);
                }
            } catch (error) {
                console.warn('Failed to create backup:', error);
            }

            // Validate and fix indices before saving
            this.items.forEach((item, idx) => item.index = idx);
            
            // Convert to JSON and validate structure
            const data = this.toJSON();
            if (!data.name || !Array.isArray(data.items)) {
                throw new Error('Invalid playlist structure');
            }
            
            // Stringify with proper formatting and ensure no trailing characters
            const json = JSON.stringify(data, null, 2).trim();
            await fs.writeFile(outputPath, json, 'utf8');
            
            // Verify the file was written correctly
            const content = await fs.readFile(outputPath, 'utf8');
            try {
                JSON.parse(content.trim()); // Parse trimmed content to catch any trailing characters
            } catch (parseError) {
                throw new Error(`File validation failed: ${parseError.message}`);
            }
        } catch (error) {
            // If save fails, try to restore from backup
            const backupPath = `${outputPath}.backup`;
            try {
                const exists = await fs.access(backupPath).then(() => true).catch(() => false);
                if (exists) {
                    await fs.copyFile(backupPath, outputPath);
                }
            } catch (backupError) {
                console.error('Failed to restore from backup:', backupError);
            }
            throw error;
        }
    }

    static async load(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const json = JSON.parse(content);
            return await Playlist.fromJSON(json);
        } catch (error) {
            // Try to load from backup if main file fails
            const backupPath = `${filePath}.backup`;
            try {
                const backupContent = await fs.readFile(backupPath, 'utf8');
                const json = JSON.parse(backupContent);
                const playlist = await Playlist.fromJSON(json);
                // Save the restored version back to the main file
                await playlist.save(filePath);
                return playlist;
            } catch (backupError) {
                throw error; // If backup also fails, throw the original error
            }
        }
    }
}

module.exports = Playlist; 