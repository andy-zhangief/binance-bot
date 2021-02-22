#!/usr/bin/env node

var log = require('simple-node-logger').createSimpleLogger(),
    SocketModel = require('../lib/SocketModel'),
    server,
    opts = {
        socketFile:'/tmp/logger-server.sock',
        log:log
    };
    
// don't log anything from the socket service
log.setLevel('error');
server = SocketModel.createServer( opts );

console.log( 'log server listening at file ', opts.socketFile );
server.start();

server.onMessage(function(msg) {
    log.info(' <<< Client Message: ', JSON.stringify( msg ));
    console.log( msg.message );
});

server.onClientConnection(function(socket) {
    console.log('new client connection: ', socket.id);
    server.getWriter().send('client connection accepted for id: ' + socket.id, socket);
});

