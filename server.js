const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const randomWords = require('random-words');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.get('/status', (request, response) => response.json({clients: clients.length}));

const PORT = 3000;

let clients = [];
let facts = [];

app.listen(PORT, () => {
  console.log(`Facts Events service listening at http://localhost:${PORT}`)
});

app.get('/events', eventsHandler);

// app.post('/fact', addFact);




function eventsHandler(request, response, next) {
    const headers = {
      'Content-Type': 'text/event-stream',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache'
    };
    response.writeHead(200, headers);
  
    const data = `data: ${JSON.stringify(facts)}\n\n`;
  
    response.write(data);
  
    const clientId = Date.now();
  
    const newClient = {
      id: clientId,
      response
    };
  
    clients.push(newClient);
  
    request.on('close', () => {
      console.log(`${clientId} Connection closed`);
      clients = clients.filter(client => client.id !== clientId);
    });
  }


function sendEventsToAll(message) {
    clients.forEach(client => client.response.write(`data: ${JSON.stringify(message)}\n\n`))
  }
let messageCount=0;
setInterval(function (){
    sendEventsToAll({
        "data":randomWords(),
        "count":messageCount++,
        "live_clients":clients.length
    });
}, 1000);
  
//   async function addFact(request, respsonse, next) {
//     const newFact = request.body;
//     facts.push(newFact);
//     respsonse.json(newFact)
//     return sendEventsToAll(newFact);
//   }
  
  