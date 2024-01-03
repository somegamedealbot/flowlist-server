
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const cors = require('cors');
const { User } = require('./db/user');
const errorHandleWrapper = require('./helpers/errorHandleWrapper');
const userRouter = require('./userRouter');
const Spotify = require('./apis/spotify');
require('./db/connect');
const Youtube = require('./apis/youtube');
// const bcrypt = require('bcrypt');

const app = express();
const port = 3000;

// let secret = bcrypt.genSaltSync(10);
// secret = bcrypt.hashSync(secret, 10);

app.use(cors({
    credentials: true,
    origin: 'http://localhost:5173'
    }))
    .use(session({
        // secret: secret,
        secret: 'hello',
        cookie: {maxAge: 84000000, sameSite: 'lax'},
        saveUninitialized: false,
        resave: false,
    }))
    .use(express.json())
    .use(cookieParser());

app.use('/user', userRouter);

app.get('/', (req, res) => {
    res.send('service');
    // req.session.true = true;
})

app.post('/signup', errorHandleWrapper(async (req, res) => {
    console.log(req.body);
    let result = await User.insertAccount(req.body);
    return {};
}));

app.post('/login', errorHandleWrapper(async (req, res) => {
    console.log(req.body);
    console.log(req.session);
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
    console.log(`Server running on port ${port}`);
})

