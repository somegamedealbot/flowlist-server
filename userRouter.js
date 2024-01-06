const express = require('express');
const errorHandleWrapper = require('./helpers/errorHandleWrapper');
const Spotify = require('./apis/spotify');
const Youtube = require('./apis/youtube');
const userRouter = express.Router();

userRouter.use('/:page', async (req, res, next) => {
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

userRouter.get('/spotify-playlists/:page', errorHandleWrapper(async (req, res, next) => {
    let playlistData = await Spotify.getPlaylists(req.session.uid, req.session.spotify_access_token, req);
    return playlistData;
}))

userRouter.get('/youtube-playlists/:page', errorHandleWrapper(async(req, res, next) => {
    console.log('Provided token', req.session.youtube_access_token);
    let playlistData = await Youtube.getPlaylists(req.session.uid, req.session.youtube_access_token, req);
    return playlistData;
}))

module.exports = userRouter;