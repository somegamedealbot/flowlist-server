const bcrypt = require('bcrypt');
const { PutItemCommand, QueryCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { createClient } = require('./dynamo-client')
const crypto = require('crypto')
let { uuidv7 } = require('uuidv7');
require('dotenv').config();

const TABLE_NAME = process.env.TABLE_NAME

async function hashPassword(password){
    let salt = await bcrypt.genSalt(10);
    let result = bcrypt.hash(password, salt)
    .then(hash => {
        return hash;
    })
    .catch(err => {
        throw err;
    });
    return await result;
}

class User{

    static invalidLogin(){
        const err = new Error('Incorrect email or password given');
        err.status = 403;
        return err;
    }

    static errorMapping = {
        'invalid_login': ['Incorrect email or password given', 400],
        'email_exists': ['Email already in use', 400],
        default: ['Internal server error', 500]
    }

    static errorHandle(errStr){
        let [errMsg, status] = this.errorMapping[errStr];
        let error = new Error(errMsg);
        error.status = status;
        throw error;
    }

    static async tryOperation(op, errMessage){
        try {
            let res = await op();
            return res;
        }
        catch(err){
            errMessage ? console.log(`${this.errPrefix}: ${errMessage}`) :
            console.log(`${this.errPrefix}: ${err.message}`);
            console.log(err.stack);
            
            throw err;
        }
    }

    static async insertAccount(accountInfo){
        let password = await hashPassword(accountInfo.password);
        
        let result = await this.tryOperation(async () => {
            
            let client = createClient();
            let checkQuery = new QueryCommand({
                TableName: TABLE_NAME,
                IndexName: process.env.INDEX_NAME,
                KeyConditionExpression: "Email = :e",
                ExpressionAttributeValues: {
                    ":e": {
                        "S": accountInfo.email
                    }
                }
            })
            
            let checkRes = await client.send(checkQuery)
            if (checkRes.Count > 0){
                this.errorHandle('email_exists')
            }

            let cmd = new PutItemCommand({
                TableName: TABLE_NAME,
                Item: {
                    "Uid": {
                        S: uuidv7()
                    },
                    "Email": {
                        S: accountInfo.email
                    },
                    "Password": {
                        S: password
                    },
                    "Youtube": {
                        M: {
                            "AccessToken": null,
                            "RefreshToken": null
                        }
                    },
                    "Spotify": {
                        M: {
                            "AccessToken": null,
                            "RefreshToken": null
                        }
                    }
                }
            })

            client.send(cmd)
            return

        });
        return result;
    }

    static async findAccount(accountInfo){
        let client = createClient();
        let query = new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: process.env.INDEX_NAME,
            KeyConditionExpression: 'Email = :e',
            ExpressionAttributeValues: {
                ":e": {
                    "S": accountInfo.email
                }
            }
        });

        let queryRes = await client.send(query);
        return [queryRes, client];
    }

    static async passwordResetRequest(accountInfo){
        return await this.tryOperation(async () => { 
            let [queryRes, client] = await this.findAccount(accountInfo);

            if (queryRes.Count === 1){
                let resetToken = crypto.randomBytes(16).toString('hex');
                let resetTokenExpiration = new Date().toISOString();

                let item = queryRes.Items[0]
                let uid = item.Uid.S

                let update = new UpdateItemCommand({
                    TableName: TABLE_NAME,
                    Key: {
                        'Uid': {
                            S: uid
                        }
                    },
                    UpdateExpression: 'SET #RT = :rt, #RTE = :rte',
                    ExpressionAttributeNames: {
                        '#RT': 'ResetToken',
                        '#RTE': 'ResetTokenExpiration'
                    },
                    ExpressionAttributeValues: {
                        ':rt': {
                            S: resetToken
                        },
                        ':rte': {
                            S: resetTokenExpiration
                        }
                    }
                });

                await client.send(update);

            }
        })
    }

    static async verifyResetToken(accountInfo){
        return await this.tryOperation(async () => {
            let resetToken = accountInfo.resetToken;
            let email = accountInfo.email;
    
            let [queryRes, client] = await this.findAccount(accountInfo)
    
            if (!queryRes.Count || queryRes.Count === 0){
                throw new Error('Reset token does not exist or has expired');
            }

            let item = queryRes.Items[0];
            let uid = item.Uid.S
            let expiration = item.ResetTokenExpiration.S

            if (new Date(expiration) > new Date.now()){
                throw new Error('Reset token does not exist or has expired');
            }

            return [uid, client];

        }, 'Failed to verify reset password token ')

    }

    static async resetPassword(accountInfo) {
        return await this.tryOperation(async () => {
            let [uid, client] = await this.verifyResetToken(accountInfo);

            if (uid){
                let newHashedPassword = await hashPassword(accountInfo.password);
                
                let update = new UpdateItemCommand({
                    TableName: TABLE_NAME,
                    Key: {
                        'Uid': {
                            S: uid
                        }
                    },
                    UpdateExpression: 'SET #P = :p',
                    ExpressionAttributeNames: {
                        '#P': 'Password'
                    },
                    ExpressionAttributeValues: {
                        ':p': {
                            S: newHashedPassword
                        }
                    }
                });
                await client.send(update);
            }
        }, 'Failed to renew password')
    }

    static async verifyAccountInfo(accountInfo){
        return await this.tryOperation(async () => {

            let [queryRes, _ ] = await this.findAccount(accountInfo);
        
            if (!queryRes.Count || queryRes.Count === 0){
                this.errorHandle('invalid_login')
            }
            let item = queryRes.Items[0]
            let uid = item.Uid.S
            let password = item.Password.S
            let equal = await bcrypt.compare(accountInfo.password, password);
            if (!equal){
                this.errorHandle('invalid_login')
            }

            return uid
        })
        
    }

    static checkAuths(uid){
        this.tryOperation(async () => {
            await connection.singleDBQuery(`SELECT `)
        }, 'Could not check accounts linked')
    }

    static errPrefix = '[Error occured in User operation]'
}

module.exports = {
    User
}