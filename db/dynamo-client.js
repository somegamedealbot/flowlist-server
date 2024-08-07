// import { CreateTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
const { fromSSO, fromContainerMetadata } = require("@aws-sdk/credential-providers");
const {DynamoDBClient} = require('@aws-sdk/client-dynamodb')

const createClient = () => {
    return new DynamoDBClient({
        // use for local database development
        // credentials: {
        //     accessKeyId: 'FakeKey',
        //     secretAccessKey: 'FakeAccessKey',
        // },
        // endpoint: 'http://localhost:8000'
        
        region: process.env.DB_REGION,  
        credentials: fromContainerMetadata({
            maxRetries: 3
        }),
        
    }) 
}

module.exports = {
    createClient
}