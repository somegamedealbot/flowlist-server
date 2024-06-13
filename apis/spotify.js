const { default: axios } = require('axios');
const { tryOperation, refreshWrapper } = require('../helpers/tryOperation');
const { retrieveToken, updateTokens } = require('../helpers/cmd-helper');
const apiPlaylistURI = 'https://api.spotify.com/v1/me/playlists?';
const apiGetPlaylistUri = 'https://api.spotify.com/v1/playlists'

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

function seperateIds(ids){
    const bundledIds = [];
    let count = 0;
    const max = 50;

    while (count < ids.length){
        let combined = ids[count];
        count += 1;
        if (count >= ids.length){
            bundledIds.push(combined);
        }
        else {
            for (let i = 1; count < ids.length && i < max; i++, count++){
                combined += ',' + ids[i];
            }
            bundledIds.push(combined);
        }
    }

    return bundledIds;
}

function seperateUris(uris){
    const bundledUris = [];
    let count = 0;
    const max = 100;

    while (count < uris.length){
        // let bundleCount = 0;
        const bundle = [];
        for (let i = 0; i < max && count < uris.length; i++, count++){
            if (!uris[count].deleted){
                bundle.push(uris[count].convertToken);
            }
        }
        bundledUris.push(bundle);
        // let combined = uris[count];
        // count += 1;
        // if (count >= uris.length){
        //     bundledUris.push(combined);
        // }
        // else {
        //     for (let i = 1; count < uris.length && i < max; i++, count++){
        //         combined += ',' + uris[i];
        //     }
        //     bundledUris.push(combined);
        // }
    }

    return bundledUris;
}


class Spotify{

    static tableName = 'spotifyInfo'

    static service = 'Spotify'

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

            await updateTokens(uid, this.service, {
                State: state,
            })

        }, 'Something went wrong when communicating with database');

        const url = "https://accounts.spotify.com/authorize?" + params.toString();
        console.log(url);
        return url;
    }

    static async getAccessToken(uid){
        return await tryOperation(async () => {            
            let accessToken = await retrieveToken(uid, this.service)
            return accessToken
        });
    }

    static async callbackHandle(queryData, uid){
        const code = queryData.code || null;
        const state = queryData.state || null;

        await tryOperation(async () => {

            let retrievedState = await retrieveToken(uid, this.service, "State")

            // if (result.rowCount === 0){
            //     const err = new Error('Invalid state given from request');
            //     err.status = 403;
            //     throw err;
            // }
            
            if (state != retrievedState){
                const err = new Error('state does not match from request')
                throw err;
            }
                // let uid = result.rows[0].uid;
            // request spotify for fresh refresh token
    
            const options = {
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

            await updateTokens(uid, this.service, {
                AccessToken: tokens.access_token,
                RefreshToken: tokens.refresh_token
            });
            
            // get user id
            options.url = 'https://api.spotify.com/v1/me';
            options.headers = {
                'Authorization': 'Bearer ' + tokens.access_token
            };
            options.method = 'get';
            options.data = undefined;

            const {id} = (await axios(options)).data;
            console.log(id);
            
            await updateTokens(uid, this.service, {
                Id: id
            });

        }, 'Unable to complete callback transaction with Spotify API');

    }

    static async refreshToken(uid, req){
        let access_token = await tryOperation(async () => {
            // if (!refreshToken){

            let refreshToken = await retrieveToken(uid, this.service, "RefreshToken")

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

            await updateTokens(uid, this.service, {
                AccessToken: access_token
            });

            return access_token;

        });

        return access_token;
    }

    static async getPlaylist(uid, accessToken, req, playlistId){
        let playlistsData = refreshWrapper(async (newAccessToken) => {
            if (newAccessToken){
                accessToken = newAccessToken
            }
            let params = new URLSearchParams({
                // 'fields': 'total,items(track(name,href,uri,artists(name),album(images(url))))',
                'limit': 100,
                'offset': 0
            })
            const baseUrl = `https://api.spotify.com/v1/playlists`;
            const axiosInstance = axios.create({
                method: 'get',
                baseURL: baseUrl,
                headers: { 'Authorization': 'Bearer ' + accessToken}
            });

            let playlistData = (await axiosInstance.get(`/${playlistId}`)).data

            let count = playlistData.tracks.total < 100 ? playlistData.tracks.total : 100;            
            const total = playlistData.tracks.total;
            const combinedResponse = playlistData;
            combinedResponse.tracks = playlistData.tracks.items;

            while (count < total){
                params.set('offset', count)
                playlistData = (await axiosInstance.get(`${playlistId}/tracks?${params.toString()}`)).data;
                // console.log(data);
                combinedResponse.tracks.push(...playlistData.tracks.items);
                count += 100;
            }

            return combinedResponse;
        }
               
        , uid, Spotify, req);
        return playlistsData;
    }

    static async getPlaylists(uid, accessToken, req, pageToken){
        
        let playlistsData = refreshWrapper(async (newAccessToken) => {
            if (newAccessToken){
                accessToken = newAccessToken
            }
            console.log('nextPage link:', pageToken)
            let response = await axios({
                method: 'get',
                url: pageToken ? 
                    pageToken : 
                    apiPlaylistURI + new URLSearchParams({
                        limit: '50',
                    }),
                headers: { 'Authorization': 'Bearer ' + accessToken},
                json: true
            })
            return response.data;
        }
        , uid, Spotify, req);

        return playlistsData
    }

    static async search(searchToken, accessToken, limit){
        if (searchToken.match(/deleted video/i)){
            return {
                tracks: {
                    href: undefined,
                    items: []
                },
                deleted: true
            }
        }
        const data = (await axios.get(`https://api.spotify.com/v1/search?${
            new URLSearchParams({
                q: searchToken,
                type: 'track',
                limit: limit
            })
        }`
        , 
        {
            headers: { 'Authorization': 'Bearer ' + accessToken},
        })
        ).data

        return data;
    }

    static async searchTracks(uid, accessToken, req, tracksData){
        const searchTokens = tracksData.searchTokens;
        let results = await refreshWrapper(async (newAccessToken) => {
            if (newAccessToken){
                accessToken = newAccessToken
            }

            const reqs = []
            const combinedResult = {
                tracks: [] 
            };

            for (let token of searchTokens){
                let data = Spotify.search(token, accessToken, 1);
                reqs.push(data);
            }
            combinedResult.tracks = await Promise.all(reqs);
            return combinedResult;
            
        }, uid, Spotify, req);

        return results;
    }

    static async createPlaylist(uid, accessToken, req, playlistData){
        return await refreshWrapper(async (newAccessToken) => {
            if (newAccessToken){
                accessToken = newAccessToken
            };

             
            const spotifyUid = await retrieveToken(uid, this.service, "Id");

            const body = {
                name: playlistData.title,
                description: playlistData.description,
                public: playlistData.private ? false : true,
            }
            
            const axiosInstance = axios.create({
                baseURL: `https://api.spotify.com/v1/users/${spotifyUid}`,
                headers: { 
                    'Authorization': 'Bearer ' + accessToken,
                    'Content-Type': 'application/json'
                }
            });

            const playlistId= (await axiosInstance.post('/playlists', body)).data.id;

            const uriBundles = seperateUris(playlistData.tracks);

            const addAxios = axios.create({
                baseURL: `https://api.spotify.com/v1/playlists/${playlistId}`,
                headers: { 
                    'Authorization': 'Bearer ' + accessToken,
                    'Content-Type': 'application/json'
                }
            });

            for (const bundle of uriBundles){
                await addAxios.post('/tracks', {
                    // playlist_id: playlistId,
                    uris: bundle
                });
            };

            return playlistId;
        }, uid, Spotify, req);
    }

    static async searchTrack(uid, accessToken, req, term){
        let results = await refreshWrapper(async (newAccessToken) => {
            if (newAccessToken){
                accessToken = newAccessToken
            }

            return await this.search(term, accessToken, 5)
        }, uid, Spotify, req);

        return results;
    }

    static async lookup(uid, accessToken, req, id){
        let results = await refreshWrapper(async (newAccessToken) => {
            if (newAccessToken){
                accessToken = newAccessToken
            }

            let data = (await axios.get(`https://api.spotify.com/v1/tracks/${id}`, {
                headers: { 
                    'Authorization': 'Bearer ' + accessToken,
                    'Content-Type': 'application/json'
                }
            })).data

            return data
            
        }, uid, Spotify, req);

        return results;
    }

}

module.exports = Spotify;