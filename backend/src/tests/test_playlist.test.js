const fs = require('fs').promises;
const path = require('path');
const { expect } = require('chai');
const Playlist = require('../models/test_Playlist');
const PlaylistItem = require('../models/test_PlaylistItem');

const TEST_DIR = path.join(__dirname, '../data/test');
const TEST_VIDEOS_DIR = path.join(TEST_DIR, 'videos');
const TEST_PLAYLISTS_DIR = path.join(TEST_DIR, 'playlists');

describe('Playlist Management', () => {
    before(async () => {
        // Create test directories
        await fs.mkdir(TEST_VIDEOS_DIR, { recursive: true });
        await fs.mkdir(TEST_PLAYLISTS_DIR, { recursive: true });

        // Create some test video files
        const testVideos = ['video1.mp4', 'video2.mp4', 'video3.mp4'];
        for (const video of testVideos) {
            await fs.writeFile(path.join(TEST_VIDEOS_DIR, video), '');
        }
    });

    after(async () => {
        // Cleanup test directories
        await fs.rm(TEST_DIR, { recursive: true, force: true });
    });

    describe('PlaylistItem', () => {
        it('should create a playlist item with correct defaults', () => {
            const item = new PlaylistItem('test.mp4', 0);
            expect(item.filename).to.equal('test.mp4');
            expect(item.index).to.equal(0);
            expect(item.previewFilename).to.equal('test_preview.jpg');
            expect(item.outgoingCommands).to.be.an('array').that.is.empty;
            expect(item.ingoingCommands).to.be.an('array').that.is.empty;
            expect(item.isPartOfLoop).to.be.false;
        });

        it('should serialize and deserialize correctly', () => {
            const original = new PlaylistItem('test.mp4', 0);
            original.outgoingCommands = ['cmd1', 'cmd2'];
            original.ingoingCommands = ['cmd3'];
            original.isPartOfLoop = true;

            const json = original.toJSON();
            const deserialized = PlaylistItem.fromJSON(json);

            expect(deserialized).to.deep.equal(original);
        });
    });

    describe('Playlist', () => {
        let playlist;

        beforeEach(() => {
            playlist = new Playlist('test-playlist');
        });

        it('should create an empty playlist', () => {
            expect(playlist.name).to.equal('test-playlist');
            expect(playlist.items).to.be.an('array').that.is.empty;
        });

        it('should add items correctly', () => {
            const item = playlist.addItem('test.mp4', true);
            expect(playlist.items).to.have.lengthOf(1);
            expect(item.filename).to.equal('test.mp4');
            expect(item.isPartOfLoop).to.be.true;
            expect(item.index).to.equal(0);
        });

        it('should remove items and reindex correctly', () => {
            playlist.addItem('test1.mp4');
            playlist.addItem('test2.mp4');
            playlist.addItem('test3.mp4');

            playlist.removeItem(1);
            expect(playlist.items).to.have.lengthOf(2);
            expect(playlist.items[0].index).to.equal(0);
            expect(playlist.items[1].index).to.equal(1);
            expect(playlist.items[1].filename).to.equal('test3.mp4');
        });

        it('should update items correctly', () => {
            const item = playlist.addItem('test.mp4');
            const updates = {
                outgoingCommands: ['cmd1'],
                ingoingCommands: ['cmd2'],
                isPartOfLoop: true
            };

            const updated = playlist.updateItem(0, updates);
            expect(updated.outgoingCommands).to.deep.equal(['cmd1']);
            expect(updated.ingoingCommands).to.deep.equal(['cmd2']);
            expect(updated.isPartOfLoop).to.be.true;
        });

        it('should move items correctly', () => {
            playlist.addItem('test1.mp4');
            playlist.addItem('test2.mp4');
            playlist.addItem('test3.mp4');

            playlist.moveItem(0, 2);
            expect(playlist.items[2].filename).to.equal('test1.mp4');
            expect(playlist.items.map(item => item.index)).to.deep.equal([0, 1, 2]);
        });

        it('should generate playlist from folder', async () => {
            const playlist = await Playlist.generateFromFolder('test-playlist', TEST_VIDEOS_DIR);
            expect(playlist.items).to.have.lengthOf(3);
            expect(playlist.items.map(item => item.filename)).to.include('video1.mp4');
        });

        it('should save and load playlist correctly', async () => {
            const original = new Playlist('test-playlist');
            original.addItem('test1.mp4', true);
            original.addItem('test2.mp4', false);

            const savePath = path.join(TEST_PLAYLISTS_DIR, 'test-playlist.json');
            await original.save(savePath);

            const loaded = await Playlist.load(savePath);
            expect(loaded.name).to.equal(original.name);
            expect(loaded.items).to.deep.equal(original.items);
        });
    });
}); 