const {URL} = require("url");
const userAgents = require("user-agents");
const { default: axios } = require('axios');

function randUserAgent(){
    const userAgent = new userAgents({ deviceCategory: 'desktop'});
    return userAgent.toString();
}

function checkRenderers(renderers){
    for (let j = 0; j < renderers.length; j++) {
        let renderer = renderers[j];
        let tempRender = renderer.itemSectionRenderer;
        if (tempRender !== undefined){
            for (let i = 0; i < tempRender.contents.length; i++){
                if (tempRender.contents[i].videoRenderer !== undefined){
                    return tempRender.contents;
                }
            }
        }
    }
    return [];
}

async function getSongInfo(term, alterantives){
    // return new Promise ((resolve, rejects) => {
        
    const searchUrl = new URL("results?", "https://www.youtube.com/");

    const params = new URLSearchParams({
        search_query: term,
        sp: "EgIQAQ%253D%253D"
    })
    const url = searchUrl.toString() + params.toString();
    const options = {
        headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "User-Agent" : randUserAgent()
        }
    }
    let response = await axios.get(url, options);
    // console.log(response.data);
    const document = response.data;
    // var content = document.match(/var ytInitialData = {.*\"sectionListRenderer\":({\"contents\":\[{.*},.*\]}).*};</)[1];
    var content = document.match(/var ytInitialData = ({.*});</)[1];
    // var content = document.match(/var ytInitialData = {.*\"contents\":({.*}).*};</)[1];
    // await fs.promises.writeFile('searchData.json', content, {
    //     encoding: 'utf-8'
    // });
    let data = JSON.parse(content)

    // content = content.substring(20, content.length - 2);
    var renderers = data.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents;

    let videosData = checkRenderers(renderers);
    
    var filteredData = []
    for (let x = 0, i = 0; i < videosData.length && x < alterantives; i++){  /// FIX BUG INVOLVING WHERE PLAYLISTS AND RADIO RENDERES END UP WITH VIDEO RENDERERS THANK YOU
        if (videosData[i] !== undefined){
            if (videosData[i].videoRenderer !== undefined){
                filteredData.push(videosData[i]);
                x++;
            }
        }
    }

    // await fs.promises.writeFile('searchData.json', JSON.stringify(filteredData[0]), {
    //     encoding: 'utf-8'
    // });

    return filteredData;
}

// (async () => {
//     console.log('run')
//     console.log(await getSongInfo('drake', 1));
// })()

module.exports = {
    getSongInfo
}