const express = require('express');
const errorHandleWrapper = require('./helpers/errorHandleWrapper');
const Spotify = require('./apis/spotify');
const Youtube = require('./apis/youtube');
const {rateLimit} = require('express-rate-limit');
const userRouter = express.Router();

const generalLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    message: (req, res) => { 
        return 'Too many requests'
    },
    skipFailedRequests: true,
    legacyHeaders: false
});

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

userRouter.use((err, req, res, next) => {
    console.error(err);
    res.status(500)
    res.send('Internal Server Error');
})

userRouter.use(generalLimiter);

userRouter.use('/', async (req, res, next) => {
    if (!req.session.uid){
        res.status(403);
        res.json({
            error: {
                message: 'Session does not exist'
            },
            sessionTimedOut: true
        })
    }
    else {
        const spotify_access_token = await Spotify.getAccessToken(req.session.uid) || undefined;
        const youtube_access_token = await Youtube.getAccessToken(req.session.uid) || undefined;

        req.session.spotify_access_token = spotify_access_token;
        req.session.youtube_access_token = youtube_access_token;

        res.cookie('spotify_auth', spotify_access_token ? "true" : "false", {
            maxAge: 86400000,
            signed: true,
            sameSite: 'strict',
            domain: process.env.CLIENT_DOMAIN_NAME
        });

        res.cookie('youtube_auth', youtube_access_token ? "true" : "false", {
            maxAge: 86400000,
            signed: true,
            sameSite: 'strict',
            domain: process.env.CLIENT_DOMAIN_NAME
        });

        next();
    }
});

userRouter.get('/', errorHandleWrapper((req, res, next) => {
    return {};
}));

userRouter.get('/spotify-url', errorHandleWrapper(async (req, res, next) => {
    // console.log(req.session);
    return {
        url: await Spotify.generateUrl(req.session.uid)
    }
}));


userRouter.get('/youtube-url', errorHandleWrapper(async (req, res, next) => {
    return {
        url: await Youtube.generateUrl(req.session.uid)
    }
}));


userRouter.get('/spotify-callback', async (req, res, next) => {

    try { 
        await Spotify.callbackHandle(req.query, req.session.uid);
    }
    catch (err){ 
        console.error(err);
        res.send(`unable to connect spotify account`)
    }

    res.redirect(`${process.env.CLIENT_DOMAIN + '/home'}`);
});

userRouter.get('/youtube-callback', async (req, res, next) => {

    try { 
        await Youtube.callbackHandle(req.query, req.session.uid);
    }
    catch (err){ 
        console.error(err);
        res.send(`unable to connect youtube account`)
    }
    res.redirect(`${process.env.CLIENT_DOMAIN + '/home'}`);
});

userRouter.get('/spotify-playlists/', errorHandleWrapper(async (req, res, next) => {
    const pageToken = req.query.pageToken ? req.query.pageToken + '&' + req.query.limit : undefined
    let playlistData = await Spotify.getPlaylists(req.session.uid, 
        req.session.spotify_access_token, req, pageToken);
    return playlistData;
}));

userRouter.get('/youtube-playlists/', errorHandleWrapper(async(req, res, next) => {
    const pageToken = req.query.pageToken;   
    let playlistData = await Youtube.getPlaylists(req.session.uid, 
        req.session.youtube_access_token, req, pageToken);
    return playlistData;
}));

userRouter.get('/playlist', errorHandleWrapper(async(req, res, next) => {
    const originType = req.query.type;
    const playlistId = req.query.playlistId;
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

    let result = await services[service].searchTracks(
        req.session.uid, 
        serviceAccessToken(service, req.session), 
        req, 
        tracksData
    );
    return result;

}));

userRouter.get('/search', errorHandleWrapper(async(req, res, next) => {
    const type = req.query.type;
    const term = req.query.term;
    let track = await services[type].singleSearch(
        term,
        serviceAccessToken(type, req.session),
        5
    );

    return track
}));

userRouter.get('/lookup', errorHandleWrapper(async(req, res, next) => {
    const type = req.query.type;
    const id = req.query.id;

    let track = await services[type].searchTracks(
        req.session.uid,
        serviceAccessToken(type, req.session),
        req,
        id
    )

    return track
}));

userRouter.post('/convert', errorHandleWrapper(async(req, res, next) => {
    const type = req.query.type;
    const convertData = req.body;

    let id = await services[type].createPlaylist(
        req.session.uid, 
        serviceAccessToken(type, req.session), 
        req, convertData
    );

    return {
        id: id
    };
}))

module.exports = userRouter;