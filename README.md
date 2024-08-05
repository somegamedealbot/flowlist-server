
# Flowlist server
## Overview

The backend express server providing logic and session management to the web app for converting playlists between music streaming platforms.

#### Supported Platforms
| Platforms| Convert To | Convert From |
| :---:   | :---: | :---: |
| YouTube |✔️|✔️|
| Spotify |✔️|✔️|


Currently, only Spotify and YouTube conversions are supported. More platforms might be added in the future.

## Built with
- Express: Structuring the API to be used by the React app 
- AWS DynamoDB: Session managment and storing credentials (Authorization tokens, user information). Maintains data consistency across Express servers.
- Docker: containerize Express servers to be deployed on EC2s using AWS ECS

## Running test server

1. Configure an `.env` file with Spotify and YouTube credentials.

2. Create a IAM profile in AWS and sign into the profile using AWS cli. Make sure the region is set to where the DynamoDB is located.

```
aws sso login --profile <profile-name>
```


3. Install necessary packages and run server

```
npm install
node server.js 
```
