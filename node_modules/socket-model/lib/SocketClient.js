/**
 * @class SocketClient
 *
 * @author: darryl.west@roundpeg.com
 * @created: 6/21/14 7:28 PM
 */
const fs = require('fs' ),
    net = require('net'),
    dash = require('lodash' ),
    uuid = require('node-uuid' ),
    carrier = require('carrier');

const SocketClient = function(options) {
    'use strict';

    const client = this,
        log = options.log;

    let socketFile = options.socketFile,
        id = options.id || uuid.v4(),
        separator = options.separator || '\n',
        socket = null,
        writer = options.writer,
        reader = options.reader,
        connected = false,
        sendWelcomeMessage = options.sendWelcomeMessage,
        reconnect = dash.isBoolean(options.reconnect ) ? options.reconnnect : true ;

    /**
     * socket connect handler
     */
    this.connectHandler = function() {
        log.info('client connected');
        connected = true;

        socket.id = socket._handle.fd;

        // if connect message, then send
        let lineReader = carrier.carry( socket, reader.lineHandler );

        if (sendWelcomeMessage) {
            client.send('greetings');
        }
    };

    /**
     * send a message to the socket server using the 'writer' object.
     *
     * @param obj - a string or object;
     * @return wrapper - the wrapped message or null if socket was not writable
     */
    this.send = function(obj) {
        return writer.send( obj, socket );
    };

    /**
     * add a message handler to capture incoming messages from the socket server
     *
     * @param callback - message object
     */
    this.onMessage = function(callback) {
        reader.on('message', callback);
    };

    /**
     * standard error handler
     *
     * @param err
     */
    this.errorHandler = function(err) {
        log.error( 'error handler: ', err.message );
    };

    /**
     * standard socket-end handler
     */
    this.endHandler = function() {
        log.info('client connection ended');

        reader.removeAllListeners();

        if (socket) {
            socket.removeAllListeners();
            socket.destroy();
            socket = null;
        }

        if (reconnect) {
            log.info('attempt a reconnect to ', socketFile);

            client.start();
        }
    };

    function connect() {
        if (fs.existsSync( socketFile )) {
            try {
                log.info('create socket connection to ', socketFile);

                socket = net.connect( socketFile );

                socket.on('connect', client.connectHandler );
                socket.on('error', client.errorHandler);
                socket.on('end', client.endHandler);
            } catch(err) {
                connected = false;
            }
        }
    }

    /**
     * start the client listener socket; on error, to try to connect or re-connect
     */
    this.start = function() {
        log.info('start the client socket for file: ', socketFile);

        connected = false;

        // check the socket file; if it doesn't exist, then reconnect()
        connect();

        const id = setInterval(function() {
            if (connected) {
                clearInterval( id );
            } else {
                connect();
            }
        }, 5000);
    };

    /**
     * stop/close the client connection and send an optional message
     * @param msg - optional last closing message
     */
    this.stop = function(msg) {
        log.info('stop the client socket at user request...');

        if (socket) {
            reconnect = false;
            if (msg) {
                socket.end( JSON.stringify( writer.wrapMessage( msg )) );
            } else {
                socket.end();
            }
        }
    };

    this.getReader = function() {
        return reader;
    };

    this.getWriter = function() {
        return writer;
    };

    this.__protected = function() {
        return {
            socketFile:socketFile,
            separator:separator,
            reconnect:reconnect
        };
    };

    // constructor validations
    (function() {
        if (!log) {
            throw new Error('socket client must be constructed with a log');
        }
        if (!socketFile) {
            throw new Error('socket client must be constructed with a socket file name');
        }
        if (!reader) {
            throw new Error('socket client must be constructed with a reader object');
        }
        if (!writer) {
            throw new Error('socket client must be constructed with a writer object');
        }
    })();
};

module.exports = SocketClient;