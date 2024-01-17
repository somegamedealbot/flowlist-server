const express = require('express');
const errorHandleWrapper = require('./helpers/errorHandleWrapper');
const Spotify = require('./apis/spotify');
const Youtube = require('./apis/youtube');
const workerpool = require('workerpool');
const pool = workerpool.pool('./apis/workerpool.js', {
    minWorkers: 1,
    maxWorkers: 10,
    workerType: 'thread'
});
const userRouter = express.Router();

const services = {
    'youtube': Youtube,
    'spotify': Spotify
};

const serviceAccessToken = (service, session) => {
    if (service === 'spotify'){
        return session.spotify_access_token;
    }
    else {
        return session.youtube_access_token;
    }
}

userRouter.use('/', async (req, res, next) => {
    console.log(req.session.loggedIn)
    if (!req.session.loggedIn){
        res.status(403);
        res.json({
            error: {
                message: 'Session timed out'
            },
            sessionTimedOut: true
        })
    }
    else {
        const spotify_access_token = await Spotify.getAccessToken(req.session.uid) || undefined;
        const youtube_access_token = await Youtube.getAccessToken(req.session.uid) || undefined;

        req.session.spotify_access_token = spotify_access_token;
        req.session.youtube_access_token = youtube_access_token;
        
        res.cookie('loggedIn', true, {
            maxAge: 84000000,
            signed: true,
            sameSite: 'strict'
        });

        res.cookie('spotify_auth', spotify_access_token ? "true" : "false", {
            maxAge: 84000000,
            signed: false,
            sameSite: 'strict'
        });

        res.cookie('youtube_auth', youtube_access_token ? "true" : "false", {
            maxAge: 84000000,
            signed: false,
            sameSite: 'strict'
        });

        next();
    }
});

userRouter.get('/', errorHandleWrapper((req, res, next) => {
    return {};
}));

userRouter.get('/spotify-url', errorHandleWrapper(async (req, res, next) => {
    console.log(req.session);
    return {
        url: await Spotify.generateUrl(req.session.uid)
    }
}));

userRouter.get('/youtube-url', errorHandleWrapper(async (req, res, next) => {
    return {
        url: await Youtube.generateUrl(req.session.uid)
    }
}));

userRouter.post('/spotify-handle', errorHandleWrapper(async (req, res, next) => {
    console.log(req.body);
    await Spotify.callbackHandle(req.body, req.session.uid);
    return {}
}))

userRouter.post('/youtube-handle', errorHandleWrapper(async (req, res, next) => {
    console.log(req.session);
    console.log(req.body);
    await Youtube.callbackHandle(req.body, req.session.uid);
    return {}
}))

userRouter.get('/spotify-playlists/', errorHandleWrapper(async (req, res, next) => {
    const pageToken = req.query.pageToken;
    let playlistData = await Spotify.getPlaylists(req.session.uid, 
        req.session.spotify_access_token, req, pageToken);
    return playlistData;
}));

userRouter.get('/youtube-playlists/', errorHandleWrapper(async(req, res, next) => {
    const pageToken = req.query.pageToken;
    console.log('Provided token', req.session.youtube_access_token);    
    let playlistData = await Youtube.getPlaylists(req.session.uid, 
        req.session.youtube_access_token, req, pageToken);
    return playlistData;

}));

userRouter.get('/playlist', errorHandleWrapper(async(req, res, next) => {
    const originType = req.query.type;
    const playlistId = req.query.playlistId;
    // console.log(req.session);
    if (!(originType && playlistId)){
        throw new Error('Missing parameters type or playlistId');
    }
    let playlistData = await services[originType].getPlaylist(
        req.session.uid, serviceAccessToken(originType, req.session), req, playlistId
    )
    return playlistData
}));

userRouter.post('/convert-data', errorHandleWrapper(async(req, res, next) => {
    const type = req.query.type;
    const tracksData = req.body;
    let service = ''
    if (type === 'spotify'){
        service = 'youtube';
    }
    else {
        service = 'spotify'
    }
    // console.log(pool.stats());
    // let result = await pool.exec(`${service}SearchSongs`, 
    //     [req.session.uid, serviceAccessToken(service, req.session), req, tracksData]
    // );
    let result = await services[service].searchTracks(
        req.session.uid, 
        serviceAccessToken(service, req.session), 
        req, tracksData
    );
    return result;

}))

module.exports = userRouter;