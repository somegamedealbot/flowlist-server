// import { CreateTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
const { fromSSO, fromContainerMetadata } = require("@aws-sdk/credential-providers");
const {DynamoDBClient} = require('@aws-sdk/client-dynamodb')

const createClient = () => {
    return new DynamoDBClient({
        region: process.env.DB_REGION,  

        credentials: fromSSO({ // use for local database development
            profile: "bill-dev"
        })
    }) 
}

module.exports = {
    createClient
}