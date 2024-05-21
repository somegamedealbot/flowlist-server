import { CreateTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({
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
});

const createTable = async () => {
    /**
     *  Uid
        Email
        Password
        Spotify:
            AccessToken
            RefreshToken
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