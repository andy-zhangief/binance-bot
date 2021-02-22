#!/usr/bin/env node

var log = require('simple-node-logger').createSimpleLogger(),
    SocketModel = require('../lib/SocketModel'),
    client,
    reader,
    opts = {
        socketFile:'/tmp/test-server.sock',
        log:log
    };

log.setLevel('debug');
client = SocketModel.createClient( opts );
reader = client.getReader();

var interval = Math.round((Math.random() * 10) + 1) * 100;
log.info('interval: ', interval);

client.onMessage(function(obj) {
    log.info(' <<< Server Message: ', obj.message);
    log.info('message count: ', reader.getMessageCount());
});

client.start();

var count = 0;

id = setInterval(function() {
    count++;
    var obj = {
        clientTime:new Date(),
        count:count
    };

    client.send( obj );

    if (count > 3) {
        clearInterval( id );
        client.stop('this is the last message you will get from me for a while...');
    }
}, interval);

