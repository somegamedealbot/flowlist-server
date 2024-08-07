
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const cors = require('cors');
const { User } = require('./db/user');
const errorHandleWrapper = require('./helpers/errorHandleWrapper');
const userRouter = require('./userRouter');
const crypto = require("crypto");
const { createClient } = require('./db/dynamo-client');
require('dotenv').config();

const app = express();
const secret = crypto.createHmac("sha256", crypto.randomBytes(64)).digest('hex');
const cookieSecret = crypto.createHmac("sha256", crypto.randomBytes(64)).digest('hex');
const DynamoDBStore = require("connect-dynamodb")(session);

app.use(cors({
    credentials: true,
    origin: ['http://flowlist-lb-1186874570.us-east-2.elb.amazonaws.com', 'http://localhost:5173', 'https://flowlist.co']
    }))
    .use(session({
        secret: secret,
        store: new DynamoDBStore({
            table: "flowlist-sessions",
            client: createClient(),
            readCapacityUnits: 5,
            writeCapacityUnits: 5
        }),
        cookie: {
            maxAge: 86400000,
            sameSite: 'none',
            secure: true,
            signed: true,
            // domain: '.flowlist.co'
        },
        saveUninitialized: false,
        resave: false,
        proxy: true
    }))
    .use(cookieParser(cookieSecret))
    .use(express.json())

app.use('/user', userRouter);

app.get('/', (req, res) => {
    res.send('service');
});

app.get('/health-check', (req, res) => {
    res.status(200);
    res.send('healthy');
});

app.post('/signup', errorHandleWrapper(async (req, res) => {
    // console.log(req.body);
    let result = await User.insertAccount(req.body);
    return {};
}));

app.post('/login', errorHandleWrapper(async (req, res) => {
    let result = await User.verifyAccountInfo(req.body);
    res.cookie('loggedIn', true, {
        maxAge: 86400000,
        signed: true,
        sameSite: 'strict',
    });
    req.session.uid = result;
    return {
        uid: result
    };
}))

app.get('/logout', errorHandleWrapper(async(req, res) => {
    req?.session.destroy();
    req.clearCookie('loggedIn');
    req.clearCookie('spotify_auth_token');
    req.clearCookie('youtube_auth_token');
    return {};
}));

app.listen(process.env.SERVER_PORT, () => {
    console.log(`Server running on port ${process.env.SERVER_PORT}`);
})

