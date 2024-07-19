function errorHandleWrapper(routeHandler){
    return async (req, res, next) => {
        try {
            let response = await routeHandler(req, res, next);
            response.success = true;
            res.json(response);
        }
        catch(err) {
            console.log(err);
            res.status(err.status ? err.status : 500)
            console.log(err)
            res.json({
                message: err.message
            });
        }
    }
}
module.exports = errorHandleWrapper;