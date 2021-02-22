/**
 * @class SocketServerTests
 *
 * @author: darryl.west@roundpeg.com
 * @created: 6/21/14 2:03 PM
 */
var should = require('chai').should(),
    dash = require('lodash' ),
    SocketModel = require('../lib/SocketModel' ),
    SocketServer = require('../lib/SocketServer' ),
    MessageReader = require('../lib/MessageReader' ),
    MessageWriter = require('../lib/MessageWriter');

describe('SocketServer', function() {
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
        var server = new SocketServer( createOptions() ),
            methods = [
                'broadcast',
                'onMessage',
                'createdCallback',
                'onClientConnection',
                'start',
                'stop',
                'getClients',
                'getReader',
                'getWriter',
                '__protected'
            ];

        it('should create an instance of SocketServer', function() {
            should.exist( server );
            server.should.be.instanceof( SocketServer );

            server.__protected().removeSocketFileOnStart.should.equal( true );
        });

        it('should have all expected methods by size and type', function() {
            dash.functions( server ).length.should.equal( methods.length );
            methods.forEach(function(method) {
                server[ method ].should.be.a( 'function' );
            });
        });
    });
});
