
const { default: axios } = require('axios');
const { singleDBQuery } = require('../db/connect');
const {google} = require('googleapis');
const { tryOperation, refreshWrapper } = require('../helpers/tryOperation');
const { youtube_v3 } = require('googleapis/build/src/apis/youtube');

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

    async generateUrl(){
        const authroizeUrl = this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: 'https://www.googleapis.com/auth/youtube',
            prompt: 'consent'
        });

        return authroizeUrl;
    }

    async callbackHandle(queryData, uid){
        const code = queryData.code || null;
        // const state = req.query.state || null;

        await tryOperation(async () => {

            let credentials = await this.oauth2Client.getToken(code);
            
            await singleDBQuery(`UPDATE public."${Youtube.tableName}" SET youtube_access_token = $1, youtube_refresh_token = $2, expiration_time = TO_TIMESTAMP($3) WHERE uid = $4`,
                [credentials.tokens.access_token, credentials.tokens.refresh_token, Math.round(credentials.tokens.expiry_date / 1000), uid]
            );

        }, 'Unable to complete callback transaction with YouTube Data API');

    }

    async getAccessToken(uid){
        return await tryOperation(async () => {
            let creds = await singleDBQuery(`SELECT youtube_access_token FROM public."${Youtube.tableName}" WHERE uid = $1`, 
                [uid]
            );
            
            return creds.rows[0].youtube_access_token;
        })
    }

    async refreshToken(uid, req){
        let access_token = await tryOperation(async () => {

            // if (!refreshToken){
            let result = await singleDBQuery(`SELECT youtube_refresh_token FROM public."${Youtube.tableName}" WHERE uid = $1 `,
                [uid]
            );
            console.log(result.rows[0], uid);
            let refreshToken = result.rows[0].youtube_refresh_token;   
            // }

            const creds = await axios.post('https://oauth2.googleapis.com/token', 
            {
                client_id: process.env.YOUTUBE_CLIENT_ID,
                client_secret: process.env.YOUTUBE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            });

            const {access_token} = creds.data;
            await singleDBQuery(`UPDATE public."${Youtube.tableName}" SET youtube_access_token = $1, expiration_time = now()::timestamp + interval '1 hour';`,
                [access_token]
            );
            console.log(access_token);
            req.session.youtube_access_token = access_token;
            return creds.data;

        });

        return access_token;
    }

    // let playlistData = await refreshWrapper(async () => {
    //     let axios = axiosSetup(accessToken);
    //     let response = await axios.get(new URLSearchParams({
    //         part: 'snippet,contentDetails',
    //         maxResults: '50',
    //         mine: true,
    //         key: process.env.YOUTUBE_API_KEY
    //     }).toString());
    //     return response.data;
    // }, uid, this, req)
    // return playlistData;
    async getPlaylists(uid, accessToken, req){
        let client = this.createO2AuthClient(uid, accessToken, req);
        let youtubeAPI = this.youtubeAPI();
        let response = await youtubeAPI.playlists.list({
            auth: client,
            part: 'snippet,contentDetails',
            maxResults: '50',
            mine: true,
            key: process.env.YOUTUBE_API_KEY,
            access_token: accessToken // comment this out to test refresh
        });
        // console.log(response.data);
        return response.data;
    }
}

module.exports = new Youtube();