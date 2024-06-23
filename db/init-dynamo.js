const { CreateTableCommand, DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { UpdateTableCommand } = require("@aws-sdk/client-dynamodb/dist-cjs");
const { fromSSO } = require("@aws-sdk/credential-providers");

require('dotenv').config();

const client = new DynamoDBClient({
    // use for local database development
    region: process.env.DB_REGION,
    // credentials: {
    //     accessKeyId: 'FakeKey',
    //     secretAccessKey: 'FakeAccessKey',
    // },
    // endpoint: 'http://localhost:8000'
      
      // region: REGION,
    credentials: fromSSO({
        profile: "bill-dev"
    })
});

const createTable = async () => {
    /**
     *  Uid
        Email
        Password
        Spotify:
            AccessToken
            RefreshToken
            State
        Youtube:
            AccessToken
            RefreshToken
            Expiration
     */

    const command = new CreateTableCommand({
        TableName: "UserInfo",
        // For more information about data types,
        // see https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.NamingRulesDataTypes.html#HowItWorks.DataTypes and
        // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Programming.LowLevelAPI.html#Programming.LowLevelAPI.DataTypeDescriptors
        AttributeDefinitions: [
          {
            AttributeName: "Uid",
            AttributeType: "S"
          },
          {
            AttributeName: "Email",
            AttributeType: "S",
          },
        ],
        KeySchema: [
          {
            AttributeName: "Uid",
            KeyType: "HASH",
          },
        ],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
        GlobalSecondaryIndexes: [
          {
            IndexName: process.env.INDEX_NAME, 
            KeySchema: [
              {
                AttributeName: 'Email',
                KeyType: "HASH"
              }
            ],
            Projection: {
              ProjectionType: "INCLUDE",
              NonKeyAttributes: ['Password']
            },
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            }
          }
        ],
    });

    try {
        const response = await client.send(command);
        console.log(response)
    }
    catch (err){
        console.log(err)
    }
}

createTable()