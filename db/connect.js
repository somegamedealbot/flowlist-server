/**
 * Run this file from the root folder
 * relative path: server\db\connect.js
 */
const {Pool} = require('pg');
const path = require('path')
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    connectionString: process.env.DB_CONNECTION_STRING,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    max: 5,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    allowExitOnIdle: false
})


// test connection
// console.log(process.env);
// console.log({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     connectionString: process.env.DB_CONNECTION_STRING,
//     port: process.env.DB_PORT,
//     database: process.env.DB_NAME,
//     password: process.env.DB_PASSWORD,
//     max: 5,
//     connectionTimeoutMillis: 30000,
//     idleTimeoutMillis: 30000,
//     allowExitOnIdle: false
// });


async function singleDBQuery(dbQueryString, values){
    return await pool.query(dbQueryString, values);
}

async function MultipleDBQueries(dbOperations){
    const client = await pool.connect();
    await dbOperations(client);
    client.query()
    client.release();
}

async function transaction(dbOperations){
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await dbOperations(client);
        await client.query('COMMIT');
    }
    catch(err) {
        await client.query('ROLLBACK');
        console.log(err);
        throw err;
    }
    finally {
        client.release();
    }
}

module.exports = {
    singleDBQuery,
    MultipleDBQueries,
    transaction
}
