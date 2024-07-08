
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const cors = require('cors');
const { User } = require('./db/user');
const errorHandleWrapper = require('./helpers/errorHandleWrapper');
const userRouter = require('./userRouter');
const crypto = require("crypto");
const { default: RedisStore } = require('connect-redis');
const { createClient } = require('redis');
require('dotenv').config();
require('./db/connect');

const app = express();
const secret = crypto.createHmac("sha256", crypto.randomBytes(64)).digest('hex');
const cookieSecret = crypto.createHmac("sha256", crypto.randomBytes(64)).digest('hex');

const redisClient = createClient({
    // url: 'redis://127.0.0.1:16380' // local test environment
    url: process.env.REDIS_ENDPOINT, // deployed url
});
redisClient.connect()

app.use(cors({
    credentials: true,
    origin: 'flowlist-lb-1186874570.us-east-2.elb.amazonaws.com'
    }))
    .use(session({
        secret: secret,
        store: new RedisStore({
            client: redisClient,
            prefix: 'flowlist:',
        }),
        cookie: {
            maxAge: 86400000, 
            sameSite: 'lax',
            signed: true
            // signed:
        },
        saveUninitialized: false,
        resave: false,
    }))
    .use(cookieParser(cookieSecret))
    .use(express.json())

app.use('/user', userRouter);

app.get('/', (req, res) => {
    res.send('service');
    // req.session.true = true;
});

app.get('/health-check', (req, res) => {
    res.status(200);
    res.send('healthy');
});

app.post('/signup', errorHandleWrapper(async (req, res) => {
    console.log(req.body);
    let result = await User.insertAccount(req.body);
    return {};
}));

app.post('/login', errorHandleWrapper(async (req, res) => {
    let result = await User.verifyAccountInfo(req.body);
    req.session.loggedIn = true;
    req.session.uid = result;
    return {
        uid: result
    };
}))

app.get('/logout', errorHandleWrapper(async(req, res) => {
    req?.session.destroy();
    return {};
}));

app.listen(port, () => {
    console.log(`Server running on port ${process.env.SERVER_PORT}`);
})

