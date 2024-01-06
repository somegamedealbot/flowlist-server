
async function tryOperation(op, errMessage){
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

async function refreshWrapper(apiCall, uid, service, req){
    try {
        let data = await apiCall();
        return data;
    }
    catch(err){
        try {
            let access_token = await service.refreshToken(uid, req)
            let data = await apiCall(access_token);
            return data;
        }
        catch{
            throw err;
        }
    }
}

module.exports = {
    tryOperation, 
    refreshWrapper
}