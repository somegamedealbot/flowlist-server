import { CreateTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";

export default client = new DynamoDBClient({
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