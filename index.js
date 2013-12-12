#!/bin/env node

"use strict";

var cluster = require('cluster'),
    http = require('http'),
    dns = require('dns'),
    numCPUs = Math.max(require('os').cpus().length + 1, 4),
    ip = process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0",
    port = process.env.VMC_APP_PORT || process.env.OPENSHIFT_NODEJS_PORT || process.env.HTTP_PORT || 8080,

    fs = require("fs"),
    cachedFrontpage = fs.readFileSync(__dirname + "/views/front.html", "utf-8"),
    cached404 = fs.readFileSync(__dirname + "/views/404.html");

if (cluster.isMaster) {
    for (var i = 0; i < numCPUs; i++){
        cluster.fork();
    }

    cluster.on('exit', function(){
        setTimeout(function(){
            cluster.fork();
        }, 1000);
    });

    console.log("Forking workers");
}else{

    http.createServer(function(req, res) {
        var remoteAddress = (req.headers['x-forwarded-for'] || '').split(',')[0] ||
            req.connection.remoteAddress;

        switch(req.url){

            case "/":
                dns.reverse(remoteAddress, function(err, domains){
                    res.writeHead(200, {'Content-Type': 'text/html'});
                    res.end(cachedFrontpage.replace(/%RESPONSE%/, JSON.stringify({
                            address: remoteAddress,
                            hostname: domains && domains[0] || false
                        }, false, 4)));
                });
                break;

            case "/api/ip":
                dns.reverse(remoteAddress, function(err, domains){
                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({
                            address: remoteAddress,
                            hostname: domains && domains[0] || undefined
                        }, false, 4) + "\n");
                });
                break;

            default:
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end(cached404);
                break;
        }

    }).listen(port, ip, function(){
        console.log("[%s %s] Server listening on port %s", process.pid, Date(), port);
    });

}
