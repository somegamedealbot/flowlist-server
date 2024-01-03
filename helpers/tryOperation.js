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

module.exports = {
    tryOperation
}