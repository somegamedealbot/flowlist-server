// import { CreateTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";

let {DynamoDBClient} = require('@aws-sdk/client-dynamodb')

const createClient = () => {
    return new DynamoDBClient({
        // use for local database development
        region: 'us-east-2',
        credentials: {
            accessKeyId: 'FakeKey',
            secretAccessKey: 'FakeAccessKey',
        },
        endpoint: 'http://localhost:8000'
          
          // region: REGION,
          // credentials: fromSSO({
          //     profile: "bill-dev"
          // })
    }) 
}

module.exports = {
    createClient
}