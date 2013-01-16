
var settings = {
    lasttod: 0
    , lastpoll: new Date()
    , datafile: ''//'Z:\PCA-GGR AX10 11-17-2012.st1'
    , port: 3000
    , parseTimes: []
    , tokens: ['run', 'class', 'number', 'tm', 'penalty', 'driver', 'car', 'cc', 'pos', 'tod', 'paxed']
    , interval: 30000
    , isStarted: false
    , timerId: 0
    , configOk: false
    , debug: false
    , activeSockets: 0
    , version: '0.9.2'
    , useTod:true
};

var express = require('express')
, app = express.createServer()
, io = require('socket.io').listen(app)
, fs = require('fs')
, colors = require('./color')
, dates = require('./dates')
, parser = require('./parser')
, config = require('./config');

// do configs from file
if (config.datafile) { settings.datafile = config.datafile; }
if (config.port) { settings.port = config.port; }
if (config.useTod) { settings.useTod = config.useTod; }

app.use(express.static(__dirname + '/jquery'));
app.listen(settings.port);

console.log(('Started server on port ' + settings.port + '...').green);



app.get('/driverdata', function (req, res) {
    var cn = req.param('cn',null)
        , dn = req.param('dn',null)
        , driver = null
        , truns = [];
    for (var i = 0; i < data.drivers.length; i++) {
        if (data.drivers[i].car.number == cn && data.drivers[i].name == dn) {
            driver = data.drivers[i];
            break;
        }
    }
    for (var i = 0; i < data.runs.length; i++) {
        if (data.runs[i].car.number == cn && data.runs[i].driver == dn) {
            truns.push(data.runs[i]);
        }
    }

    res.send({ driver: driver, runs: truns, lastupdated:data.poller.lastpoll.formatDate('HH:mm:ss'), runcount:data.runs.length });
});

//app.get('/driver', function (req, res) {
//    res.sendfile(__dirname + '/driver.html');
//});

//app.get('/results', function (req, res) {
//    res.sendfile(__dirname + '/results.html');
//});
//app.get('/index', function (req, res) {
//    res.sendfile(__dirname + '/index.html');
//});
//app.get('/runs', function (req, res) {
//    res.sendfile(__dirname + '/runs.html');
//});

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/results.html');
});


var running = false, doAnother = false;


var data = {
    runs: []
    , poller: {}
    , drivers: []
    , ttod: []
    , connectedDrivers: []
};


data = parser.doit(settings.datafile);

//fs.writeFile('ttod.json', JSON.stringify(data.ttod));
//fs.writeFile('drivers.json', JSON.stringify(data.drivers));
//fs.writeFile('runs.json', JSON.stringify(data.runs));

fs.watch(settings.datafile, function (ev, fn) {
    if (running) {
        doAnother = true;
        console.log('already running'.red);
    }
    else {
        data = parser.doit(settings.datafile);

        io.sockets.emit('ttod', { ttod: data.ttod, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: data.runs.length });
        io.sockets.emit('results', { drivers: data.drivers, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: data.runs.length });
        io.sockets.emit('runs', { runs: data.runs, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: data.runs.length });

    }
});
console.log(('Watching file ' + settings.datafile + ' for changes').green.bold);

io.set('log level', 1);

io.sockets.on('connection', function (socket) {
    //socket.emit('ttod', { ttod: data.ttod, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: data.runs.length });
    //socket.emit('results', { drivers: data.drivers, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: data.runs.length });
    settings.activeSockets++;
		console.log('Connected: ' + settings.activeSockets);
    socket.on('ttod', function (d) {
        socket.emit('ttod', { ttod: data.ttod, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: data.runs.length });
    });
    socket.on('results', function (d) {
        socket.emit('results', { drivers: data.drivers, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: data.runs.length });
    });
    socket.on('runs', function (d) {
        socket.emit('runs', { runs: data.runs, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: data.runs.length });
    });

    socket.on('disconnect', function () {
        settings.activeSockets--;
		console.log('Disconnect: ' + settings.activeSockets);
    });
});


