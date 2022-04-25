const express = require('express');
const cors = require('cors');
const randomWords = require('random-words');
const bodyParser = require('body-parser');
const Influx = require('influx');
require('dotenv').config();
const client = new Influx.InfluxDB({
    database: 'ocean_tides',
    username: process.env.USERNAME,
    password: process.env.PASSWORD,
    hosts: [
        { host: process.env.DB },
    ],
});

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/status', (request, response) => response.json({ clients: clients.length }));

const PORT = 3000;

let clients = [];
let emojiClient = [];
let facts = [];
let ongoingEvents = new Map();

app.listen(PORT, () => {
    console.log(`Facts Events service listening at http://localhost:${PORT}`)
});

/// Listen to stream of emojis here
app.get('/emojis', emojiHandler);

/// Root of API
app.get('/', apiHome);

/// Create a new API where emojis will be put
app.post('/newEvent', addNewEvent);

/// Remove the event
app.post('/deleteEvent', removeExistingEvent);

/// Add emoji to the event
app.post('/addEmoji', postEmoji);


function apiHome(request, response, next) {
    response.send('Udao!');
}

function addNewEvent(request, response, next) {
    const eventId = request.body.event;
    const key = request.body.key;
    if (key === process.env.RANDOMKEY) { /// If event does not already exist, only then proceed with it.
        if (!ongoingEvents.has(eventId)) {
            ongoingEvents.set(eventId, []);
            readEmoji(eventId);
            console.log(ongoingEvents, 'body is ', eventId);
            response.sendStatus(200);
        } else {
            /// Send appropriate error. This is not it.
            response.sendStatus(501);
        }
    } else {
        response.sendStatus(401);
    }
}

function removeExistingEvent(request, response, next) {
    const eventId = request.body.event;
    const key = request.body.key; {
        if (key === process.env.RANDOMKEY) { /// Remove event only if it is already existing
            if (ongoingEvents.has(eventId)) {
                ongoingEvents.delete(eventId);
                client.dropMeasurement(eventId);
                response.sendStatus(200);
            } else {
                response.sendStatus(404);
            }
        } else {
            response.sendStatus(401);
        }
    }
}


function postEmoji(request, response, next) {
    const eventId = request.body.event;
    const emojiId = request.body.emoji;
    /// Add to write emoji only if event is already live
    if (ongoingEvents.has(eventId)) {
        writeEmojis(eventId, emojiId);
        response.sendStatus(200);

    } else {
        response.sendStatus(404);

    }
}


// app.post('/fact', addFact);




function emojiHandler(request, response, next) {
    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
    };
    const eventId = request.query.event;

    response.writeHead(200, headers);

    const data = `data: ${0}\n\n`;

    response.write(data);

    const clientId = Date.now();

    const newClient = {
        id: clientId,
        response
    };
    /// Adding the current client to a map. This map contains keys of event ids. Corresponding to each client,
    /// is a list of events where the stream has to be sent
    ongoingEvents.set(eventId, [...ongoingEvents.get(eventId), newClient]);



    request.on('close', () => {
        console.log(`${clientId} Connection closed on emoji`);
        try {
            ongoingEvents.set(eventId, ongoingEvents.get(eventId).filter(client => client.id != clientId));
            // ongoingEvents[eventId] = ongoingEvents[eventId].filter(client => client.id != clientId);

        } catch (e) {

        }
        // emojiClient = emojiClient.filter(client => client.id !== clientId);
    });
}

// writeEmojis();
// readEmoji();
let messageCount = 0;
let emojiCount = 0;

function writeEmojis(eventId, emojiId) {
    const point = {
        measurement: eventId,
        fields: { emoji_id: emojiId },
    }
    client.writePoints([point]);
    console.log('Written emoji', emojiId, 'for event id', eventId);
}


function readEmoji(eventId) {
    setInterval(function() {
        if (ongoingEvents.has(eventId) && ongoingEvents.get(eventId).length > 0)
            client.query(`select * from ${eventId} where time > now() - 1s`)
            .then(function(result) {
                console.log(result);
                result.forEach(e => {
                    const message = {
                        "data": e.emoji_id,
                        "count": emojiCount++,
                        "live_clients": ongoingEvents.get(eventId).length
                    };
                    ongoingEvents.get(eventId).forEach(client => client.response.write(`data: ${JSON.stringify(message)}\n\n`));
                });

            });

    }, 1200);
}