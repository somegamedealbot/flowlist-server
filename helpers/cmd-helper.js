/**
 * Helpers for AWS Dynamodb SDK commands
 */

const { UpdateItemCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb')
const createClient = require('../db/dynamo-client').default
require('dotenv').config();
const TABLE_NAME = process.env.TABLE_NAME

const InfoMapping = {
    'RefreshToken': [':rt', 'S', '#RT'],
    'AccessToken': [':at', 'S', '#AT'],
    'ExpirationTime': [':et', 'N', '#ET']
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
    let updateExp = 'set'
    for (info in tokenInfo){
        if (info !== null){
            let valueName, type, attrName = InfoMapping[item]
            expAttrName[attrName] = info
            ExpressionAttrValues[valueName] = {}[type] = tokenInfo[info]
            updateExp = updateExp.concat(' ', attrName, ' = ', valueName)
        }
    }
    
    return expAttrName, expAttrValues, updateExp
}

/**
 * Updates the tokens accordingly from the tokenInfo object
 * @param {*} uid unique user id to get info about user
 * @param {*} service service name
 * @param {*} tokenInfo infomation about tokens
 */
const updateTokens = async (uid, service, tokenInfo={RefreshToken, AccessToken: null, ExpirationTime: null}) => {

    let names, values, updateExp = buildUpdateAttributes(tokenInfo, service)    
    let client = createClient()

    let cmd = new UpdateItemCommand({
        TableName: TABLE_NAME,
        ExpressionAttributeNames: names,
        ExpressionAttrValues: values,
        UpdateExpression: updateExp,
        Key: {
            "Uid": uid
        },
        ReturnValues: "UPDATED_NEW"
    })
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
    return res.Item[tokenName]
}

module.exports = {
    buildUpdateAttributes,
    updateTokens,
    retrieveToken
}
