// Require Node Modules
var http = require('http'),
    express = require('express');

var app = express();


// New Relic Monitoring
require('newrelic');
app.get('/new_relic_monitor', function (request, response) {
    console.log("new relic");
   response.status(200).send('ALIVE'); 
});

//routers - docker-hub
var moip = require('./dockerhub');
app.use('/dockerhub', moip);

// Catch all unknown routes.
app.all('/', function(request, response) {
  console.log("unknown routes: " + request);
  response.status(405).send('Page not found.');
});

/*
 * Launch the HTTP server
 */
var port = process.env.PORT || 6000;
var server = http.createServer(app);
server.listen(port, function() {
  console.log('Webhooks server running on port ' + port + '.');
});