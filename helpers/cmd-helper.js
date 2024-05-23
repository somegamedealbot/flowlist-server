/**
 * Helpers for AWS Dynamodb SDK commands
 */

const { UpdateItemCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb')
const { createClient } = require('../db/dynamo-client');
require('dotenv').config();
const TABLE_NAME = process.env.TABLE_NAME

const InfoMapping = {
    'RefreshToken': [':r', 'S', '#RT'],
    'AccessToken': [':a', 'S', '#AT'],
    'ExpirationTime': [':e', 'N', '#ET'],
    'State': [':s', 'S', '#S'],
    'Id': [':i', 'S', '#I']
}

/**
 * Builds values used in creating a UpdateItemCommand
 * @param {*} tokenInfo infomation about tokens
 * @param {*} service service name
 * @returns values for building a UpdateItemCommand
 */
const buildUpdateAttributes = (tokenInfo, service) => {
    let expAttrName = {}
    let expAttrValues = {}
    let updateExpArr = []
    
    for (info in tokenInfo){
        if (info !== null){
            let [valueName, type, attrName] = InfoMapping[info]
            expAttrName[attrName] = service.concat('.',info)
            let attrValue = {}
            attrValue[type] = tokenInfo[info]
            expAttrValues[valueName] = attrValue
            updateExpArr.push(' '.concat(attrName, ' = ', valueName))
        }
    }
    
    let updateExp = 'set'.concat(updateExpArr.join(','))

    return [expAttrName, expAttrValues, updateExp]
}

/**
 * Updates the tokens accordingly from the tokenInfo object
 * @param {*} uid unique user id to get info about user
 * @param {*} service service name
 * @param {*} tokenInfo infomation about tokens
 */
const updateTokens = async (uid, service, tokenInfo={RefreshToken: null, AccessToken: null, ExpirationTime: null, State: null}) => {
    console.log(uid)
    let [names, values, updateExp] = buildUpdateAttributes(tokenInfo, service)    
    let client = createClient()
    
    let cmd = new UpdateItemCommand({
        TableName: TABLE_NAME,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        UpdateExpression: updateExp,
        Key: {
            "Uid": {
                "S": uid
            }
        },
        ReturnValues: "UPDATED_NEW"
    })
    console.log(cmd)

    await client.send(cmd)
}

/**
 * Retrieves the specified token, by default: "AccessToken"
 * 
 * @param {*} uid unique user id to get info about user
 * @param {*} service service name
 * @param {*} type "AccessToken" by default, or "RefreshToken"
 * @returns token specified by type
 */
const retrieveToken = async (uid, service, type="AccessToken") => {
    let client = createClient()
    let tokenName = service.concat('.', type)

    let cmd = new GetItemCommand({
        TableName: TABLE_NAME,
        Key: {
            "Uid": {
                "S": uid
            }
        },
        AttributesToGet: [tokenName]
    })

    let res = await client.send(cmd)
    console.log
    return res.Item[tokenName] ? res.Item[tokenName].S : undefined
}

module.exports = {
    buildUpdateAttributes,
    updateTokens,
    retrieveToken
}
