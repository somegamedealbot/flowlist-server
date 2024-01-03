const express = require('express');
const errorHandleWrapper = require('./helpers/errorHandleWrapper');
const Spotify = require('./apis/spotify');
const Youtube = require('./apis/youtube');
const userRouter = express.Router();


userRouter.use((req, res, next) => {
    console.log(req.session.loggedIn)
    if (!req.session.loggedIn){
        res.status(403);
        res.json({
            error: {
                message: 'Session timed out'
            }
        })
    }
    else {
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

module.exports = userRouter;