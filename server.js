'use strict';

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fccTesting = require('./freeCodeCamp/fcctesting.js');
const mongo = require('mongodb').MongoClient;
const passport = require('passport');
const cookieParser = require('cookie-parser')
const pug = require('pug');
const passportSocketIo = require('passport.socketio');
const cors = require('cors');

const routes = require('./app/github/routes.js');
const auth = require('./app/github/auth.js');

const app = express();

const http = require('http').Server(app);
const sessionStore = new session.MemoryStore();
const io = require('socket.io')(http);

require('dotenv').config();

fccTesting(app); //For FCC testing purposes
app.use('/public', express.static(process.cwd() + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.set('view engine', 'pug');

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    useNewUrlParser: true
}));


if (process.env.ENABLE_DELAYS) app.use((req, res, next) => {
    switch (req.method) {
        case 'GET':
            switch (req.url) {
                case '/logout':
                    return setTimeout(() => next(), 500);
                case '/profile':
                    return setTimeout(() => next(), 700);
                default:
                    next();
            }
            break;
        case 'POST':
            switch (req.url) {
                case '/login':
                    return setTimeout(() => next(), 900);
                default:
                    next();
            }
            break;
        default:
            next();
    }
});

mongo.connect(process.env.DATABASE, (err, db) => {
    if (err) console.log('Database error: ' + err);

    auth(app, db);
    routes(app, db);

    http.listen(process.env.PORT || 3000);

    //start socket.io code  
    var currentUsers = 0;

    io.on('connection', socket => {
        ++currentUsers;
        io.emit('user count', currentUsers);
        io.emit('user', { name: socket.request.user.name, currentUsers, connected: true });
        socket.on('chat message', (message) => {
            io.emit('chat message', { name: socket.request.user.name, message });
        });
        socket.on('disconnect', () => {
            --currentUsers;
            io.emit('user count', currentUsers);
            io.emit('user', { name: socket.request.user.name, currentUsers, connected: true });
        });
    });

    io.use(passportSocketIo.authorize({
        cookieParser: cookieParser,
        key: 'express.sid',
        secret: process.env.SESSION_SECRET,
        store: sessionStore
    }));

    //end socket.io code
});