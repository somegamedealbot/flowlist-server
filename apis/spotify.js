const { default: axios } = require('axios');
const { singleDBQuery } = require('../db/connect');
const { tryOperation, refreshWrapper } = require('../helpers/tryOperation');
const apiPlaylistURI = 'https://api.spotify.com/v1/me/playlists?';

require('dotenv').config();


function generateAuthKey(length){ // MAKE SURE THAT IT DOES NOT GENERATE A DUPLICATE AUTH KEY BY CHECKING IT AGAINST THE DATABASe ISSUED ONES
    var selection = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
    var string = [];
    var rand;
    while(string.length < length){
      rand = Math.floor(Math.random() * selection.length + 1);
      string.push(selection[rand]);
    }
    return string.join("");
}

class Spotify{

    static tableName = 'spotifyInfo'

    static async generateUrl(uid){
        let scope = 'playlist-read-private user-read-private user-read-email user-library-read user-library-modify playlist-modify-public playlist-modify-private';
        const state = generateAuthKey(16);
        console.log(state);
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: process.env.SPOTIFY_CLIENT_ID,
            scope: scope,
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
            state: state
        });
        
        await tryOperation(async () => {
            return await singleDBQuery(`UPDATE public."${this.tableName}" SET state = $1 WHERE uid = $2`,
                [state, uid]);
        }, 'Something went wrong when communicating with database');

        const url = "https://accounts.spotify.com/authorize?" + params.toString();
        console.log(url);
        return url;
    }

    static async getAccessToken(uid){
        return await tryOperation(async () => {
            let creds = await singleDBQuery(`SELECT spotify_access_token FROM public."${this.tableName}" WHERE uid = $1`, 
                [uid]
            );
            
            return creds.rows[0].spotify_access_token;
        });
    }

    static async callbackHandle(queryData, uid){
        const code = queryData.code || null;
        const state = queryData.state || null;

        await tryOperation(async () => {
            let result = await singleDBQuery(`SELECT uid FROM public."${this.tableName}" WHERE state = $1`,
            [state]);

            if (result.rowCount === 0){
                const err = new Error('Invalid state given from request');
                err.status = 403;
                throw err;
            }
            // let uid = result.rows[0].uid;
            // request spotify for fresh refresh token
    
            var options = {
                method: 'post', 
                url: 'https://accounts.spotify.com/api/token',
                data: new URLSearchParams({
                    code: code,
                    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
                    grant_type: 'authorization_code'
                }),
                headers: {
                    'Authorization': 'Basic ' + btoa(process.env.SPOTIFY_CLIENT_ID + 
                        ':' + process.env.SPOTIFY_CLIENT_SECRET)
                },
                json: true
            };
            const tokens = (await axios(options)).data;
            
            await singleDBQuery(`UPDATE public."${this.tableName}" SET spotify_access_token = $1, spotify_refresh_token = $2 WHERE uid = $3`,
                [tokens.access_token, tokens.refresh_token, uid]
            );

        }, 'Unable to complete callback transaction with Spotify API');

    }

    static async refreshToken(uid, req){
        let access_token = await tryOperation(async () => {
            // if (!refreshToken){
            let result = await singleDBQuery(`SELECT spotify_refresh_token FROM public."${this.tableName}" WHERE uid = $1 `,
                [uid]
            );
            let refreshToken = result.rows[0].spotify_refresh_token;
                
            // }

            const creds = await axios.post('https://accounts.spotify.com/api/token', 
            {
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            },
            {
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + btoa(process.env.SPOTIFY_CLIENT_ID + 
                        ':' + process.env.SPOTIFY_CLIENT_SECRET),
                }
            });

            const {access_token} = creds.data;
            req.session.spotify_access_token = access_token;
            await singleDBQuery(`UPDATE public."${this.tableName}" SET spotify_access_token = $1, expiration_time = now()::timestamp + interval '1 hour';`,
                [access_token]
            );

            return access_token;

        });

        return access_token;
    }

    static async getPlaylists(uid, accessToken, req){
        
        let playlistsData = refreshWrapper(async (newAccessToken) => {
            if (newAccessToken){
                accessToken = newAccessToken
            }
            
            let response = await axios({
                method: 'get',
                url: apiPlaylistURI + new URLSearchParams({
                    limit: '50'
                }),
                headers: { 'Authorization': 'Bearer ' + accessToken},
                json: true
            })
            return response.data;
        }
        , uid, Spotify, req);

        return playlistsData
    }

}

module.exports = Spotify;