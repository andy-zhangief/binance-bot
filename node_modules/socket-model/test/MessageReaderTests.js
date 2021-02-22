/**
 *
 *
 * @author: darryl.west@roundpeg.com
 * @created: 6/21/14 8:21 PM
 */
var should = require('chai').should(),
    dash = require('lodash' ),
    MessageReader = require('../lib/MessageReader');

describe('MessageReader', function() {
    'use strict';

    var log = require('simple-node-logger' ).createSimpleLogger();

    var createOptions = function() {
        var opts = {};

        opts.log = log;

        return opts;
    };

    describe('#instance', function() {
        var reader = new MessageReader( createOptions() ),
            methods = [
                'lineHandler',
                'getMessageCount',
                '__protected'
            ];

        it('should create an instance of MessageReader', function() {
            should.exist( reader );
            reader.should.be.instanceof( MessageReader );

            reader.__protected().separator.should.equal( '\n' );
        });

        it('should have all expected methods by size and type', function() {
            dash.functions( reader ).length.should.equal( methods.length );
            methods.forEach(function(method) {
                reader[ method ].should.be.a( 'function' );
            });
        });
    });

    describe('lineHandler', function() {


        it('should parse a valid json line', function(done) {
            var reader = new MessageReader( createOptions() ),
                callback,
                obj = {
                    hello:'world',
                    flarb:'flib'
                };

            callback = function(data) {
                should.exist( data );

                data.hello.should.equal( obj.hello );

                done();
            };

            reader.on('message', callback);
            reader.lineHandler( JSON.stringify( obj ));
        });

        it('should log error on non-json input line', function() {
            var reader = new MessageReader( createOptions() ),
                callback;

            callback = function(data) {
                should.not.exist( data );
            };

            reader.on('message', callback);
            reader.lineHandler( 'bad line' );
        });
    });

});
