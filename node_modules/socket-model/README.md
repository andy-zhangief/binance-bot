# Socket Model
- - -
A small unix socket framework to support inter-process communications.

[![NPM version](https://badge.fury.io/js/socket-model.svg)](http://badge.fury.io/js/socket-model)
[![Build Status](https://travis-ci.org/darrylwest/socket-model.svg?branch=master)](https://travis-ci.org/darrylwest/socket-model)
[![Dependency Status](https://david-dm.org/darrylwest/socket-model.svg)](https://david-dm.org/darrylwest/socket-model)

## Overview

Socket Model is a set of server/client reader/writer objects that provide a framework for inter-process communications based on unix sockets.  Communications exchange JSON messages delimited by CR (\n).  Messages can be read and written from either client or server using send() and read() where the message is either a string or a complex object.  Servers have the ability to broadcast messages to all active clients.  

Each message is wrapped in an object with the message id (mid), time stamp (ts) and the message.  Messages are parsed by the receiver (either client or server).  Message helpers include MessageWriter and MessageReader.  These classes may be swapped out or extended to provide additional capabilities.  They are injected to SocketServer and SocketClient when invoked through SocketModel's create methods.

For most applications using the server and client provide all thats required to exchange messages.  But, since the reader and writer are separate objects injected into the server and client, these objects my be swapped or overriden to provide extra processing including authentication, message digest, priority, etc.

## Installation

	npm install socket-model --save

## Use

// server process

    const SocketModel = require('socket-model');

    const server = SocketModel.createServer( { socketFile:'/tmp/test.sock' } );

    server.onMessage(function(obj) {
    	console.log(' <<< Client Message: ', obj.message);
    	server.broadcast('echo: ', obj.message);
    });
    
    server.start();

// cleient process

    const SocketModel = require('socket-model');

    const client = SocketModel.createClient( { socketFile:'/tmp/test.sock' } );

	client.onMessage(function(obj) {
		console.log(' <<< Server Message: ', obj.message);
	});
	
    client.start();
    client.send('hello socket model!');
    
    // send more messages, then end the connection with an optional message..
    client.stop('bye');


## Examples

See the examples folder for server and client message examples.


## API

### SocketModel

The socket model object contains two factory methods to create server and client objects.  They can be invoked with preset options to set socket file, reader, writer, and other options.  The client must be created with a specified socket file (see examples).

- SocketModel.createServer(options)
- SocketModel.createClient(options)

### SocketServer

Once the socket server has be created it can be started to listen for client connections.  The broadcast method is used to send a wrapped, stringified JSON message to all clients in the list.  If the list is null, then the message is sent to all clients.

Incoming messages can be listened to by assigning a callback to onMessage().  Incoming JSON strings are parsed by the reader then sent as objects to handlers.  Message objects have a message id, timestamp, and message payload.

- server.start()
- server.broadcast( obj, clientList )
- server.onMessage( messageHandler )
- server.getClients()
- server.onClientConnection( clientConnectionHandler )
- event: client - fired when a new client connects

### SocketClient

One a socket client is created it may be started to attempt connection to the server.  If the server is unavailable, the client will continue to attempt to connect (set by options).  If a server connection drops, the client will again attempt to connect.

- client.start()
- client.send(obj)
- client.onMessage(callback)
- client.stop()

### MessageWriter

The message writer is responsible for wrapping outgoing messages with a message id, timestamp and the message.  The wrapped object is then stringified and sent to the specified client.

- writer.send(obj, socket)
- writer.wrapMessage()

### MessageReader

The message reader is responsible for parsing the incoming message and firing a 'message' event with the parsed object.

- reader.lineHandler(callback)
- event: message - fired when a new messages is received

- - -
_<small>Copyright © 2014-2016, rain city software | Version 00.92.10</small>_
