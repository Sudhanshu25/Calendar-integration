const express = require('express');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const CLIENT_ID = '900634394608-vmf5md0966tc6gmosluo8ll0ocfed76d.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Route to serve the index.html file at the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// OAuth2 callback route
app.get('/oauth2callback', async (req, res) => {
    try {
        const { code } = req.query;
        const { tokens } = await oAuth2Client.getToken(code);
        req.session.tokens = tokens;
        oAuth2Client.setCredentials(tokens);
        res.redirect('/');
    } catch (error) {
        console.error('Error during OAuth callback:', error);
        res.status(500).send('Authentication failed');
    }
});

// Middleware to ensure user is authenticated
app.use((req, res, next) => {
    if (!req.session.tokens) {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });
        return res.redirect(authUrl);
    }
    oAuth2Client.setCredentials(req.session.tokens);
    next();
});

// Route to handle appointment scheduling
app.post('/schedule', async (req, res) => {
    const { name, email, date, time, message } = req.body;

    const event = {
        summary: `Appointment with ${name}`,
        description: message,
        start: {
            dateTime: new Date(`${date}T${time}:00`).toISOString(),
            timeZone: 'America/Los_Angeles',
        },
        end: {
            dateTime: new Date(new Date(`${date}T${time}:00`).getTime() + 30 * 60000).toISOString(), // 30 minutes duration
            timeZone: 'America/Los_Angeles',
        },
        attendees: [{ email: email }],
    };

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    try {
        await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error scheduling appointment:', error);
        res.json({ success: false, error: error.message });
    }
});

app.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});
