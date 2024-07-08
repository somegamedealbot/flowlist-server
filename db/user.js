const bcrypt = require('bcrypt');
const connection = require('./connect');
const { PutItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { createClient } = require('./dynamo-client')
let { uuidv7 } = require('uuidv7')
// import { uuidv7 } from 'uuidv7';
require('dotenv').config();

TABLE_NAME = process.env.TABLE_NAME

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

    static async verifyAccountInfo(accountInfo){
        return await this.tryOperation(async () => {

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
            })

            let queryRes = await client.send(query)
            
            if (queryRes.Count == 0){
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