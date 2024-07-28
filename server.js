
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const cors = require('cors');
const { User } = require('./db/user');
const errorHandleWrapper = require('./helpers/errorHandleWrapper');
const userRouter = require('./userRouter');
const crypto = require("crypto");
const { createClient } = require('./db/dynamo-client');
const {rateLimit} = require('express-rate-limit');
require('dotenv').config();

const app = express();
const secret = crypto.createHmac("sha256", crypto.randomBytes(64)).digest('hex');
const cookieSecret = crypto.createHmac("sha256", crypto.randomBytes(64)).digest('hex');
const DynamoDBStore = require("connect-dynamodb")(session);

const loginLimiter = rateLimit({
    windowMs: 1 * 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    message: (req, res) => {
        return 'Too many failed login attempts'
    },
    legacyHeaders: false,
    skipSuccessfulRequests: true
});

const signUpLimiter = rateLimit({
    windowMs: 1 * 60 * 60 * 1000,
    limit: 2,
    message: (req, res) => {
        return 'Too many signups'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: true
});

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
            secure: false,
            signed: true,
            // domain: '.flowlist.co'
        },
        saveUninitialized: false,
        resave: false,
        proxy: false
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

app.use('/signup', signUpLimiter);

app.post('/signup', errorHandleWrapper(async (req, res) => {
    // console.log(req.body);
    let result = await User.insertAccount(req.body);
    return {};
}));

app.use('/login', loginLimiter);

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

// app.post('/reset-password', errorHandleWrapper(async (req, res) => {
//     await User.sendPasswordResetEmail(req.body)
// }))

app.post('/logout', errorHandleWrapper(async(req, res) => {
    res.clearCookie('loggedIn');
    res.clearCookie('spotify_auth');
    res.clearCookie('youtube_auth');
    res.clearCookie('connect.sid');
    req?.session.destroy();
    return {};
}));

app.listen(process.env.SERVER_PORT, () => {
    console.log(`Server running on port ${process.env.SERVER_PORT}`);
})

