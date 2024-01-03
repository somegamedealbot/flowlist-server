
const { default: axios } = require('axios');
const { singleDBQuery } = require('../db/connect');
const {google} = require('googleapis');
// const {OAuth2Client} = require('google-auth-library');
const { tryOperation } = require('../helpers/tryOperation');

require('dotenv').config();

function parseCredentials(access_token, time){
    return {
        expiry_date: time,
        access_token: access_token,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/youtube'
    }
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

    createNewClient(){
        return new google.auth.OAuth2(
            process.env.YOUTUBE_CLIENT_ID,
            process.env.YOUTUBE_CLIENT_SECRET,
            process.env.YOUTUBE_REDIRECT_URI,
        ); 
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
        // const codes = await this.oauth2Client.generateCodeVerifierAsync();
        const authroizeUrl = this.oauth2Client.generateAuthUrl({
            // access_type: 'offline',
            scope: 'https://www.googleapis.com/auth/youtube',
            // code_challenge_method: 'S256',
            // code_challenge: codes.codeChallenge
            prompt: 'consent'
        });
        // codes.codeVerifier

        // await tryOperation(async () => {
        //     return await singleDBQuery(`UPDATE public."${Youtube.tableName}" SET code = $1, code_verifier = $2 WHERE uid = $3`,
        //         [codes.codeChallenge, codes.codeVerifier, uid]);
        // }, 'Something went wrong when communicating with database');

        return authroizeUrl;
    }

    async callbackHandle(queryData, uid){
        const code = queryData.code || null;
        // const state = req.query.state || null;

        await tryOperation(async () => {
            // let result = await singleDBQuery(`SELECT $1 FROM public."${Youtube.tableName}" WHERE code = $2`, 
            // [uid, code]);

            // if (result.rowCount === 0){
            //     const err = new Error('Invalid state given from request');
            //     err.status = 403;
            //     throw err;
            // }
            // let uid = result.rows[0].uid;
            // request spotify for fresh refresh token
            let credentials = await this.oauth2Client.getToken(code);
            // console.log(tokens);
            // let client = this.createNewClient();
            // client.setCredentials(credentials);
            // var options = {
            //     method: 'post', 
            //     url: 'https://accounts.spotify.com/api/token',
            //     data: new URLSearchParams({
            //         code: code,
            //         redirect_uri: process.env.SPOTIFY_CALLBACK_URL,
            //         grant_type: 'authorization_code'
            //     }),
            //     headers: {
            //         'Authorization': 'Basic ' + btoa(process.env.SPOTIFY_CLIENT_ID + 
            //             ':' + process.env.SPOTIFY_CLIENT_SECRET)
            //     },
            //     json: true
            // };
            // const tokens = (await axios(options)).data;
            
            await singleDBQuery(`UPDATE public."${Youtube.tableName}" SET youtube_access_token = $1, expiration_time = TO_TIMESTAMP($2) WHERE uid = $3`,
                [credentials.tokens.access_token, Math.round(credentials.tokens.expiry_date / 1000), uid]
            );

        }, 'Unable to complete callback transaction with YouTube Data API');

    }

}
module.exports = new Youtube()