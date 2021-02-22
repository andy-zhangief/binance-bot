/**
 * @class SocketClientTests
 *
 * @author: darryl.west@roundpeg.com
 * @created: 6/21/14 7:45 PM
 */
var should = require('chai').should(),
    dash = require('lodash' ),
    SocketModel = require('../lib/SocketModel' ),
    SocketClient = require('../lib/SocketClient' ),
    MessageReader = require('../lib/MessageReader' ),
    MessageWriter = require('../lib/MessageWriter');

describe('SocketClient', function() {
    'use strict';

    var log = require('simple-node-logger' ).createSimpleLogger();

    var createOptions = function() {
        var opts = {};

        opts.log = log;
        opts.socketFile = '/tmp/test.sock';

        opts.reader = new MessageReader( opts );
        opts.writer = new MessageWriter( opts );

        return opts;
    };

    describe('#instance', function() {
        var client = new SocketClient( createOptions() ),
            methods = [
                'send',
                'onMessage',
                'connectHandler',
                'errorHandler',
                'endHandler',
                'start',
                'stop',
                'getReader',
                'getWriter',
                '__protected'
            ];

        it('should create an instance of SocketClient', function() {
            should.exist( client );
            client.should.be.instanceof( SocketClient );

            client.__protected().separator.should.equal( '\n' );
            client.__protected().reconnect.should.equal( true );
        });

        it('should have all expected methods by size and type', function() {
            dash.functions( client ).length.should.equal( methods.length );
            methods.forEach(function(method) {
                client[ method ].should.be.a( 'function' );
            });
        });
    });
});
