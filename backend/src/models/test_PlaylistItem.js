class PlaylistItem {
    constructor(filename, index) {
        this.index = index;
        this.filename = filename;
        this.previewFilename = filename.replace(/\.[^/.]+$/, '_preview.jpg'); // Default preview name
        this.outgoingCommands = [];
        this.ingoingCommands = [];
        this.isPartOfLoop = false;
    }

    toJSON() {
        return {
            index: this.index,
            filename: this.filename,
            previewFilename: this.previewFilename,
            outgoingCommands: this.outgoingCommands,
            ingoingCommands: this.ingoingCommands,
            isPartOfLoop: this.isPartOfLoop
        };
    }

    static fromJSON(json) {
        const item = new PlaylistItem(json.filename, json.index);
        item.previewFilename = json.previewFilename;
        item.outgoingCommands = json.outgoingCommands;
        item.ingoingCommands = json.ingoingCommands;
        item.isPartOfLoop = json.isPartOfLoop;
        return item;
    }
}

module.exports = PlaylistItem; 