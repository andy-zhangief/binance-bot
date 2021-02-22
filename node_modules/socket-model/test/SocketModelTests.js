/**
 *
 *
 * @author: darryl.west@roundpeg.com
 * @created: 6/21/14 7:49 PM
 */
var should = require('chai').should(),
    dash = require('lodash' ),
    SocketModel = require('../lib/SocketModel' ),
    SocketServer = require('../lib/SocketServer' ),
    SocketClient = require('../lib/SocketClient');

describe('SocketModel', function() {
    'use strict';

    describe('createSocketServer', function() {
        it('should create an instance of SocketServer with zero parameters', function() {
            var server = SocketModel.createServer();

            should.exist( server );
            server.should.be.instanceof( SocketServer );
        });
    });

    describe('createSocketClient', function() {
        it('should create an instance of SocketClient', function() {
            var client = SocketModel.createClient({ socketFile:'test-file.sock'});

            should.exist( client );
            client.should.be.instanceof( SocketClient );
        });
    });
});
