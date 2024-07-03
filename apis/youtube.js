
const { default: axios } = require('axios');
const {google} = require('googleapis');
const { tryOperation, refreshWrapper } = require('../helpers/tryOperation');
const { youtube_v3 } = require('googleapis/build/src/apis/youtube');
const { getSongInfo } = require('./youtubeSearch');
const { retrieveToken, updateTokens } = require('../helpers/cmd-helper');
const crypto = require("crypto");
require('dotenv').config();

function parseCredentials({access_token, refresh_token, time}){
    return {
        expiry_date: time,
        access_token: access_token,
        refresh_token: refresh_token,
        token_type: 'Bearer',
        scope: 'https://youtube.googleapis.com/youtube/v3/playlists?'
    }
}

function axiosSetup(accessToken){
    return axios.create({
        baseURL: 'https://youtube.googleapis.com/youtube/v3/playlists?',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    })
}

// EXTRACT (EPOCH FROM DateTime);

class Youtube{
    service = 'Youtube'
    constructor(){ 

        this.oauth2Client = new google.auth.OAuth2(
            process.env.YOUTUBE_CLIENT_ID,
            process.env.YOUTUBE_CLIENT_SECRET,
            process.env.YOUTUBE_REDIRECT_URI,
        );
    }

    createO2AuthClient(uid, access_token, req){
        const OAuth2Client = new google.auth.OAuth2(
            process.env.YOUTUBE_CLIENT_ID,
            process.env.YOUTUBE_CLIENT_SECRET,
            process.env.YOUTUBE_REDIRECT_URI,
        );
        OAuth2Client.setCredentials({
            access_token: access_token
        });
        OAuth2Client.refreshHandler = () => {
            return this.refreshToken(uid, req)
        };
        return OAuth2Client;
    }

    /**
     * 
     * @returns {youtube_v3.Youtube}
     */
    youtubeAPI(){
        const youtube = new google.youtube('v3');
        return youtube;
    }

    createNewClient(accessToken){
        const OAuth2Client = new google.auth.OAuth2(
            process.env.YOUTUBE_CLIENT_ID,
            process.env.YOUTUBE_CLIENT_SECRET,
            process.env.YOUTUBE_REDIRECT_URI,
        );

        OAuth2Client.setCredentials({
            access_token: accessToken
        });
        const youtube = new google.youtube('v3');
        

        return {youtube, OAuth2Client};
    }

    static tableName = 'googleInfo'

    static async tryOperation(op, errMessage){
        try {
            let res = await op();
            return res;
        }
        catch(err){
            errMessage ? console.log(`${this.errPrefix}: ${errMessage}`) :
            console.log(`${this.errPrefix}: ${err.message}`);
            console.log(err.stack);
            
            if (!err.status){
                err.status = 500;
            }
            
            throw err;
        }
    }

    
    async generateUrl(uid){
        const state = crypto.randomBytes(32).toString('hex');

        const authroizeUrl = this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: 'https://www.googleapis.com/auth/youtube',
            prompt: 'consent',
            state: state 
        });

        await updateTokens(uid, this.service, {
            State: state,
        })
        // add to code_challenge to user id

        return authroizeUrl;
    }

    async callbackHandle(queryData, uid){
        const code = queryData.code || null;
        const state = queryData.state || null;

        await tryOperation(async () => {

            let retrievedState = await retrieveToken(uid, this.service, "State");

            if (state != retrievedState){
                const err = new Error('state does not match from request')
                throw err;
            }

            await updateTokens(uid, this.service, {
                State: ""
            });

            let credentials = await this.oauth2Client.getToken(code);
            
            await updateTokens(uid, this.service, {
                RefreshToken: credentials.tokens.refresh_token,
                AccessToken: credentials.tokens.access_token,
                ExpirationTime: `${credentials.tokens.expiry_date}`
            });

        }, 'Unable to complete callback transaction with YouTube Data API');

    }

    async getAccessToken(uid){
        return await tryOperation(async () => {
            let accessToken = await retrieveToken(uid, this.service)
            // console.log('Retrieved Token:' + accessToken)
            return accessToken
        })
    }

    async refreshToken(uid, req){
        let access_token = await tryOperation(async () => {

            let refreshToken = await retrieveToken(uid, this.service, "RefreshToken")   
            // console.log("Refresh Token:" + refreshToken)
            const creds = await axios.post('https://oauth2.googleapis.com/token', 
            {
                client_id: process.env.YOUTUBE_CLIENT_ID,
                client_secret: process.env.YOUTUBE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            });

            const {access_token} = creds.data;

            await updateTokens(uid, this.service, {
                AccessToken: access_token
            });

            console.log(access_token);
            req.session.youtube_access_token = access_token;
            return creds.data;

        });

        return access_token;
    }

    async getPlaylists(uid, accessToken, req, pageToken){
        let client = this.createO2AuthClient(uid, accessToken, req);
        let youtubeAPI = this.youtubeAPI();
        let response = await youtubeAPI.playlists.list({
            auth: client,
            part: 'snippet,contentDetails',
            maxResults: '50',
            mine: true,
            pageToken: pageToken,
            key: process.env.YOUTUBE_API_KEY,
            access_token: accessToken // comment this out to test refresh
        });
        return response.data;
    }

    async getPlaylist(uid, accessToken, req, playlistId){
        let client = this.createO2AuthClient(uid, accessToken, req);
        let youtubeAPI = this.youtubeAPI();
        const playlistParams = {
            auth: client,
            part: 'snippet',
            id: playlistId,
            key: process.env.YOUTUBE_API_KEY,
            access_token: accessToken // comment this out to test refresh      
        }
        
        const listRequestParams = {
            auth: client,
            part: 'snippet,contentDetails,id',
            maxResults: '50',
            playlistId: playlistId,
            key: process.env.YOUTUBE_API_KEY,
            access_token: accessToken // comment this out to test refresh
        }
        
        let [playlistRes, playlistItemsRes] = await Promise.all(
            [
                youtubeAPI.playlists.list(playlistParams),
                youtubeAPI.playlistItems.list(listRequestParams)
            ]
        );
        
        const combinedResponse = playlistRes.data.items[0];
        combinedResponse.items = playlistItemsRes.data.items;
        
        const total = combinedResponse.total;
        let count = combinedResponse.total < 50 ? combinedResponse.total : 50;
        
        while (count < total){
            listRequestParams.pageToken = response.nextPageToken;
            response = (await youtubeAPI.playlistItems.list(
                listRequestParams
            )).data;
                
            combinedResponse.items.push(...response.items)
            count += 50
        }
        return combinedResponse;
    }

    async singleSearch(searchToken, accessToken, alts){
        const res = await tryOperation(async () => {
            const combinedResult = {
                tracks: []
            }
            const reqs = []
            let data = await getSongInfo(searchToken, alts);
    
            combinedResult.tracks = data
            return combinedResult;

        }, 'Unable to complete youtube search');

        return res; 
    }

    async search(searchTokens, accessToken, alts){

        const res = await tryOperation(async () => {
            const combinedResult = {
                tracks: []
            }
            const reqs = []
            for (let token of searchTokens){
                let data = getSongInfo(token, alts);
                reqs.push(data);
            }
    
            combinedResult.tracks = await Promise.all(reqs);
            console.log(combinedResult)
            return combinedResult;

        }, 'Unable to complete youtube search');

        return res; 
    }

    async searchTracks(uid, accessToken, req, tracksData, alts=1){
        // tracksData.searchTokens;
        const searchTokens = tracksData.searchTokens;
        // for (const track of tracksData){
        //     if (!track.deleted)
        //     searchTokens.push(track.searchToken)
        // }
        let data = await this.search(searchTokens, accessToken, alts);
        // let data = await pool.exec('youtubeSearchSongs', [searchTokens]);
        return data;
    }

    async createPlaylist(uid, accessToken, req, playlistData){
        let client = this.createO2AuthClient(uid, accessToken, req);
        let youtubeAPI = this.youtubeAPI();

        const trackIds = [];
        for (const track of playlistData.tracks){
            if (track.deleted === false){
                trackIds.push(track.convertToken);
            }
        }

        console.log(playlistData.tracks);
        console.log(trackIds);

        const playlistId = (await youtubeAPI.playlists.insert({
            auth: client,
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title: playlistData.title,
                    description: playlistData.description
                },
                status : {
                    privacyStatus: playlistData.private ? 'private' : 'public'
                }
            },
            key: process.env.YOUTUBE_API_KEY,
            access_token: accessToken // comment this out to test refresh    
        })).data.id;
        
        for (let id of trackIds){
            await youtubeAPI.playlistItems.insert({
                auth: client,
                part: 'snippet',
                requestBody: {
                    snippet: {
                        playlistId: playlistId,
                        resourceId: {
                            kind: 'youtube#video',
                            videoId: id
                        }
                    }
                },
                key: process.env.YOUTUBE_API_KEY,
                access_token: accessToken // comment this out to test refresh    
            });
        }
        return playlistId;
    }

    async lookup(uid, accessToken, req, id){
        let client = this.createO2AuthClient(uid, accessToken, req);
        let youtubeAPI = this.youtubeAPI();

        return (await youtubeAPI.videos.list({
            part: 'id',
            id: id,
            keyey: process.env.YOUTUBE_API_KEY,
            access_token: accessToken // comment this out to test refresh    
        })).data
    }
}

module.exports = new Youtube();