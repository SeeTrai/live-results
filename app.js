﻿
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
    , version: '2.0.0'
    , useTod: true
    , maxRunsCounted: 0
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
if (config.maxRunsCounted) { settings.maxRunsCounted = config.maxRunsCounted; }

app.use(express.static(__dirname + '/jquery'));
app.listen(settings.port);

console.log(('Started server on port ' + settings.port + '...').green);


app.get('/historical', function (req, res) {
    fs.readFile('data.json', 'utf8', function (err, djson) {
        var dt = new Date();
        var evs = dt.getFullYear() + '_' + (dt.getMonth() + 1) + '_' + dt.getDate();
        var dd = {};
        if (!err) {
            dd = JSON.parse(djson);

        }
        dd[evs] = data;
        res.send(dd);
    });
});

app.get('/driverruns/:id', function (req, res) {
    var id = parseInt(req.params.id);

    var n = [];
    for (var i = 0; i < data.runs.length; i++) {
        if (data.runs[i].driverId == id) {
            n.push(data.runs[i]);
        }
    }

    res.send(n);
});

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
    res.sendfile(__dirname + '/results-incremental.html');
});


var running = false, doAnother = false;


var data = {
    runs: []
    , poller: {}
    , drivers: []
    , ttod: []
    , connectedDrivers: []
};


data = parser.doit(settings.datafile, settings);

//fs.writeFile('ttod.json', JSON.stringify(data.ttod));
//fs.writeFile('drivers.json', JSON.stringify(data.drivers));
//fs.writeFile('runs.json', JSON.stringify(data.runs));

fs.watch(settings.datafile, function (ev, fn) {
    if (running) {
        doAnother = true;
        console.log('already running'.red);
    }
    else {
        data = parser.doit(settings.datafile, settings);
        var runCount = data.runs.length;
        io.sockets.emit('changes', { drivers: data.changes, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: runCount });
        io.sockets.emit('ttod', { ttod: data.ttod, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: runCount });
        //io.sockets.emit('results', { drivers: data.drivers, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: runCount });
        var last20 = [];
        for (var i = (runCount < 21 ? 0 : (runCount - 21)) ; i < runCount; i++) {
            last20.push(data.runs[i]);
        }
        io.sockets.in('runs').emit('runs', { runs: last20, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: runCount });

    }
});
console.log(('Watching file ' + settings.datafile + ' for changes').green.bold);

io.set('log level', 1);

io.sockets.on('connection', function (socket) {
    //socket.emit('ttod', { ttod: data.ttod, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: data.runs.length });
    //socket.emit('results', { drivers: data.drivers, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: data.runs.length });
    settings.activeSockets++;
    console.log('Connected: ' + settings.activeSockets);
    
    //socket.emit('init-results', { drivers: data.drivers, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: data.runs.length });

    socket.on('join-runs', function (d) {
        socket.join('runs');
        var last20 = [], runCount = data.runs.length;

        for (var i = (runCount < 21 ? 0 : (runCount - 21)) ; i < runCount; i++) {
            last20.push(data.runs[i]);
        }
        socket.emit('runs', { runs: last20, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: runCount });
    });
    socket.on('leave-runs', function (data) { socket.leave('runs'); });

    socket.on('ttod', function (d) {
        socket.emit('ttod', { ttod: data.ttod, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: data.runs.length });
    });
    socket.on('init-results', function (d) {
        socket.emit('init-results', { drivers: data.drivers, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: data.runs.length });
    });
    socket.on('results', function (d) {
        socket.emit('results', { drivers: data.drivers, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: data.runs.length });
    });
    socket.on('init-runs', function (d) {
        socket.emit('init-runs', { runs: data.runs, lastpoll: data.poller.lastpoll.formatDate('HH:mm:ss'), runcount: data.runs.length });
    });

    socket.on('disconnect', function () {
        settings.activeSockets--;
		console.log('Disconnect: ' + settings.activeSockets);
    });
});


