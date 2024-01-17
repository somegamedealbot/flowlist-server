const workerpool = require('workerpool');
const Spotify = require('./spotify');
const Youtube = require('./youtube');

workerpool.worker({
    spotifySearchSongs: (uid, accessTokens, req, tracksData) => {
        workerpool.workerEmit('Worker starting spotify search')
        return new Promise((resolve, reject) => {
            Spotify.searchTracks(uid, accessTokens, req, tracksData)
            .then((res) => {
                resolve(res);
            })
            .catch((err) => {
                reject(err);
            })
        })
    },
    youtubeSearchSongs: (uid, accessTokens, req, tracksData) => {
        workerpool.workerEmit('Worker starting youtube search');
        return new Promise((resolve, reject) => {
            Youtube.searchTracks(uid, accessTokens, req, tracksData)
            .then((res) => {
                resolve(res);
            })
            .catch((err) => {
                reject(err);
            })
        })
    } 
});
