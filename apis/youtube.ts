
const { default: axios } = require('axios');
const { singleDBQuery } = require('../db/connect');
const {google} = require('googleapis');
// const {OAuth2Client} = require('google-auth-library');
const { tryOperation } = require('../helpers/tryOperation');
const { youtube } = require('googleapis/build/src/apis/youtube');

require('dotenv').config();

function parseCredentials({access_token, refresh_token, time}){
    return {
        expiry_date: time,
        access_token: access_token,
        refresh_token: refresh_token,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/youtube'
    }
}

// EXTRACT (EPOCH FROM DateTime);

class Youtube{
    oauth2Client: any;
    
    constructor(){ 

        this.oauth2Client = new google.auth.OAuth2(
            process.env.YOUTUBE_CLIENT_ID,
            process.env.YOUTUBE_CLIENT_SECRET,
            process.env.YOUTUBE_REDIRECT_URI,
        );
    }

    createNewClient(refreshToken, accessToken){
        const OAuth2Client = new google.auth.OAuth2(
            process.env.YOUTUBE_CLIENT_ID,
            process.env.YOUTUBE_CLIENT_SECRET,
            process.env.YOUTUBE_REDIRECT_URI,
        )
        client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken
        });
        const youtube = new google.youtube('v3');

        return
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

    async refreshToken(uid, refreshToken){
        let access_token = await tryOperation(async () => {

            if (!refreshToken){
                let result = await singleDBQuery(`SELECT youtube_refresh_token FROM public."${Youtube.tableName}" WHERE uid = $1 `,
                    [uid]
                );
                refreshToken = result.rows[0].spotify_refresh_token;   
            }

            const creds = await axios.post('https://oauth2.googleapis.com/token', 
            {
                client_id: process.env.YOUTUBE_CLIENT_ID,
                client_secret: process.env.YOUTUBE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            });

            const {access_token} = creds.data;
            await singleDBQuery(`UPDATE public."${this.tableName}" SET spotify_access_token = $1, expiration_time = now()::timestamp + interval '1 hour';`,
                [access_token]
            );

            return access_token;

        });

        return access_token;
    }
}
module.exports = new Youtube()