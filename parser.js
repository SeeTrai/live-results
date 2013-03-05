var fs = require('fs');

var parseTimes = []
    , running = false
    , doAnother = false
    , tokens= ['run', 'class', 'number', 'tm', 'penalty', 'driver', 'car', 'cc', 'pos', 'tod', 'paxed']
    ,data = {
        runs: []
        , ttod: []
        , drivers: []
        , driverIdSeed:1
        , poller: { lastpoll: new Date() }
    }
    , useTod = true;


function doit(datafile, usetod)
{
    if (usetod == null || usetod == undefined) {
        useTod = true;
    } else { useTod = usetod; }

 console.log('\nSTARTING PARSE...'.yellow);
    //sleep(5000);
    var start = new Date().getMilliseconds();
    var s = null;
    try {
        s = fs.readFileSync(datafile, 'utf8');
    }
    catch (err) {
        console.log('***************************************************************'.red);
        console.log('ERROR CONNECTING TO AXWARE FILE'.red.bold);
        console.log(err.toString().red.bold);
        console.log('***************************************************************'.red);
        //settings.timerId = setTimeout(doit, settings.interval);
        running = false;
        return data;
    }
    //var s = fs.readFileSync('w:\pcalast.st1', 'utf8');
    var rows = s.split('\n');
    console.log(('\tROWS to parse: ' + rows.length));
    //data.runs = [];
    runs = [];
    for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var runParsed = parse(r);
        if (runParsed != null) {
            // data.runs.push(runParsed);
            runs.push(runParsed);
//            if (runParsed.tod > settings.lasttod) {
//                settings.lasttod = runParsed.tod;
//            }
        }
        else {
            //console.log('RUN = NULL');
            //console.log(r);
        }
    }
    //var rnt = runs.length;
    //var prnt = data.runs.length;
    data.runs = runs;
    data.poller.lastpoll = new Date();
    console.log('\tRUNS COUNT: ' + data.runs.length);

    var stop = new Date().getMilliseconds();
    parseTimes.push({ date: new Date(), ms: stop - start });

    console.log('\tgenerating stats...');
    genstats();
  
    console.log('\t' + new Date());
    console.log(('FINISHED PARSE in ' + (stop - start) + 'ms\n').yellow);
    //settings.timerId = setTimeout(doit, settings.interval);
    running = false;

    return data;

//    if (doAnother) {
//        running = true;
//        setTimeout(doit, 500);
//        doAnother = false;
//    }
}


function parse(line) {

    var r = new run();
    //var tokens = settings.tokens;
    if (line.substring(0, 4) == '_run' || line.substring(0, 6) == '_class') {

        var todFound = false;
        var s = line.split('_');

        if (s.length > 1) {
            for (var i = 0; i < s.length; i++) {
                var z = s[i];
                for (var t = 0; t < tokens.length; t++) {
                    if (z == tokens[t]) {

                        var v = s[i + 1];
                        if (z == 'run') { r.n = parseInt(v); }
                        else if (z == 'class') { r.axclass = v; }
                        else if (z == 'number') { r.car.number = v; }
                        else if (z == 'tm') { r.rawtime = parseFloat(v); }
                        else if (z == 'penalty') {
                            if (v == 'DNF') { r.isDnf = true; }
                            else if (v == 'RRN') { r.getRerun = true; }
                            else { r.cones = parseInt(v); }
                        }
                        else if (z == 'driver') { r.driver = v; }
                        else if (z == 'car') { r.car.description = v; }
                        else if (z == 'cc') { r.car.color = v; }
                        else if (z == 'tod') {
                            if (v.indexOf('-')) {
                                v = v.split(' - ')[0];
                            }
                            r.tod = parseInt(v);
                            todFound = true;
                        }
                        else if (z == 'paxed') { r.timepaxed = parseFloat(v); }
                    }
                }
            }
            r.time = r.cones + r.rawtime;
            if (r.timepaxed == NaN || r.timepaxed == null) { r.timepaxed = r.time; }
            if (!todFound && !useTod) { return null; }
            if (r.driver.length == 0) { return null; }
            if (r.rawtime == 0 && !r.isDnf && !r.getRerun){return null;}
            return r;
        }
    }
    return null;
}

function run() {

    return {
        n: 0, axclass: '', driver: '', car: { description: '', number: '', year: 0, color: '' }, rawtime: 0.0, cones: 0, isDnf: false, getRerun: false, tod: 0, time: 0, timepaxed: 0
    };
}

function ttoditem(dr, car, axclass, v, cat) {
    var cr = car == null ? { description: '', number: '', year: 0, color: ''} : car;
    return { driver: dr, car: cr, axclass: axclass, value: v, category: cat };
}

//
// Alerts: 
// Top time, new person and old person
// class position change
//
function genAlerts(prev, curr) {
    var changes = [];
    var log = '';
    for (var i = 0; i < curr.length; i++) {
        var d = curr[i];
        for (var b = 0; b < prev.length; b++) {
            var p = prev[b];
            if (p.car.number == d.car.number && p.name==d.name && p.axclass==d.axclass) {
                if (p.ranko != d.ranko || p.rankc != d.rankc || p.rankp != d.rankp) {
                    changes.push(p, d);
                    if (p.ranko != d.ranko){
                        log += p.name + ' moved from ' + p.ranko + ' to ' + d.ranko + ' overall, ';
                    }
                    if (p.rankc != d.rankc) {
                        log += p.name + ' moved from ' + p.rankc + ' to ' + d.rankc + ' in ' + d.axclass + ', ';
                    }
                    if (p.rankp != d.rankp) {
                        log += p.name + ' moved from ' + p.rankp + ' to ' + d.rankp + ' PAX, ';
                    }
                }
                //if (p.runCount < d.runCount) {
                //    changes.push(p, d);
                //}
                break;
            }
        }
    }

    //console.log(('Changes detected: ' + changes.length).yellow);
    console.log(log.bold.yellow);

}


function genstats() {
    var classes = [];
    var ttodr = new ttoditem('-', null, '', 99999, 'Raw Time');
    var ttodp = new ttoditem('-', null, '', 99999, 'PAX Time');
    var ttodm = new ttoditem('-', null, '', 99999, "Men's Time");
    var ttodw = new ttoditem('-', null, '', 99999, "Women's Time");
    var ttodss = new ttoditem('-', null, '', 99999, 'Showroom Stock');
    var ttodfun = new ttoditem('-', null, '', 99999, 'Fun');
    var ttodck = new ttoditem('-', null, '', 0, 'Cone Killer');
    var ttodlost = new ttoditem('-', null, '', 0, 'Most DNFs');
    var ttodrr = new ttoditem('-', null, '', 0, 'Most Reruns');

    var ttods = [];
    var drivers = [];


    //TODO remove this and don't regen ID's all the time

    data.driverIdSeed = 1;

    for (var t = 0; t < data.runs.length; t++) {
        var run = data.runs[t], dv = run.driver, cls = run.axclass;

        if (!run.isDnf && !run.getRerun) {
            if (ttodr.value > run.time && run.time > 0) {
                ttodr = new ttoditem(run.driver, run.car, run.axclass, run.time, 'Raw Time');
            }
            if (ttodp.value > run.timepaxed && run.timepaxed > 0) {
                ttodp = new ttoditem(run.driver, run.car, run.axclass, run.timepaxed, 'PAX Time');
            }
            if (run.axclass.indexOf('L') == -1) {
                if (ttodm.value > run.time) {
                    ttodm = new ttoditem(run.driver, run.car, run.axclass, run.time, "Men's Time");
                }
            }
            if (run.axclass.indexOf('L') > -1) {
                if (ttodw.value > run.time) {
                    ttodw = new ttoditem(run.driver, run.car, run.axclass, run.time, "Women's Time");
                }
            }

            if (run.axclass.substr(0, 2) == 'SS') {
                if (ttodss.value > run.time) {
                    ttodss = new ttoditem(run.driver, run.car, run.axclass, run.time, "Showroom Stock");
                }
            }
            if (run.axclass == 'FUN' && ttodfun.value > run.time) {
                ttodfun = new ttoditem(run.driver, run.car, run.axclass, run.time, "Fun");
            }

        }

        //lookup driver
        var driver = null, driverIx = -1, dcnt = -1;
        for (var d = 0; d < drivers.length; d++) {
            dcnt = d;
            if (drivers[d].name == dv && drivers[d].car.number == run.car.number ) { driver = drivers[d]; driverIx = d; break; }
        }

        if (driver == null) {
            
            driver = { id:data.driverIdSeed, name: run.driver, axclass: run.axclass, best: 9999, bestpax: 9999, runCount: 0, dnfCount: 0, cones: 0, reruns: 0, car: run.car, ranko: 0, rankc: 0, rankp: 0, times: [] };
            drivers.push(driver);
            driverIx = (dcnt + 1);
            data.driverIdSeed++;
        }

        if (driver.best > run.time && !run.isDnf && !run.getRerun) {
            driver.best = run.time;
            driver.bestpax = run.timepaxed;
        }
        driver.cones = driver.cones + run.cones;
        if (run.isDnf) {
            driver.dnfCount++;
        }
        if (run.getRerun) {
            driver.reruns++;
        }
        driver.runCount++;
        drivers[driverIx] = driver;

    } //for t

    //update rankings.

    drivers.sort(function (a, b) {
        return a.bestpax - b.bestpax;
    });
    var rank = 1;
    for (var i = 0; i < drivers.length; i++) {
        if (drivers[i].axclass != 'FUN' && drivers[i].bestpax > 0) {
            drivers[i].rankp = rank;
            rank++;
        }
    }

    drivers = rankClass(drivers);

    drivers.sort(function (a, b) {
        return a.best - b.best;
    });
    rank = 1;
    for (var i = 0; i < drivers.length; i++) {
        if (drivers[i].best > 0) {
            drivers[i].ranko = rank;
            rank++;

        }
    }

    // do alerts

    //genAlerts(data.drivers, drivers);


    data.drivers = drivers;

    //loop through
    for (var i = 0; i < drivers.length; i++) {
        var drv = drivers[i];
        if (ttodck.value < drv.cones) {
            ttodck = new ttoditem(drv.name, drv.car, drv.axclass, drv.cones, "Cone Killer");
        }
        if (ttodlost.value < drv.dnfCount) {
            ttodlost = new ttoditem(drv.name, drv.car, drv.axclass, drv.dnfCount, "Lost In the Woods (DNFs)");
        }
        if (ttodrr.value < drv.reruns) {
            ttodrr = new ttoditem(drv.name, drv.car, drv.axclass, drv.reruns, "Got Practice (reruns)");
        }
    }

    data.ttod = [ttodr, ttodp, ttodm, ttodw, ttodss, ttodfun, ttodck, ttodlost, ttodrr];
    fs.readFile('data.json', 'utf8', function (err, djson) {
        var dt = new Date();
        var evs = dt.getFullYear() + '_' + (dt.getMonth()+1) + '_' + dt.getDate();
        var dd = {};
        if (!err) {
            dd = JSON.parse(djson);
            
        } 
        dd[evs] = data;
        fs.writeFile('data.json', JSON.stringify(dd));
    });
    
}

function rankClass(drivers) {
    var dv = drivers, classsort = [], cs = [];

    dv.sort(function (a, b) {
        if (a.axclass == b.axclass) { return 0; }
        return a.axclass < b.axclass ? -1 : 1;
    });

    var cls = '', n = -1;
    for (var i = 0; i < dv.length; i++) {

        if (cls != dv[i].axclass) {
            cls = dv[i].axclass;
            cs.push([dv[i]]);
            n++;
        }
        else {
            cs[n].push(dv[i]);
        }
    }

    for (var b = 0; b < cs.length; b++) {
        cs[b].sort(function (a, b) {
            //if (a.best == b.best) { return 0; }
            return Math.floor(a.best * 1000) < Math.floor(b.best * 1000) ? -1 : 1;
        });
        for (var c = 0; c < cs[b].length; c++) {
            classsort.push(cs[b][c]);

        }
    }
    dv = classsort;
    cls = '';
    var rank = 1;
    for (var i = 0; i < dv.length; i++) {
        if (cls != dv[i].axclass) {
            cls = dv[i].axclass;
            rank = 1;
        }
        dv[i].rankc = rank;
        rank++;
    }
    return dv;
}



exports.doit = doit;
