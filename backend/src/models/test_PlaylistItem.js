class PlaylistItem {
    constructor(filename, index) {
        this.index = index;
        this.filename = filename;
        this.previewFilename = filename.replace(/\.[^/.]+$/, '_preview.jpg'); // Default preview name
        this.outgoingCommands = [];
        this.ingoingCommands = [];
        this.isPartOfLoop = false;
        this.actions = []; // New field for combined actions
        this.duration = ''; // New field for duration
    }

    toJSON() {
        return {
            index: this.index,
            filename: this.filename,
            previewFilename: this.previewFilename,
            outgoingCommands: this.outgoingCommands,
            ingoingCommands: this.ingoingCommands,
            isPartOfLoop: this.isPartOfLoop,
            actions: this.actions, // Include actions in JSON
            duration: this.duration // Add duration (format MM:SS) for UI display
        };
    }

    static fromJSON(json) {
        const item = new PlaylistItem(json.filename, json.index);
        item.previewFilename = json.previewFilename;
        item.outgoingCommands = json.outgoingCommands;
        item.ingoingCommands = json.ingoingCommands;
        item.isPartOfLoop = json.isPartOfLoop;
        item.actions = Array.isArray(json.actions)
            ? json.actions.map(act => ({ ...act, equation: act.equation || '=1' }))
            : [];
        item.duration = json.duration; // Restore duration
        return item;
    }
}

module.exports = PlaylistItem; 