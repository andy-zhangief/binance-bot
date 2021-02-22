/**
 *
 *
 * @author: darryl.west@roundpeg.com
 * @created: 6/21/14 6:53 PM
 */
var should = require('chai').should(),
    dash = require('lodash' ),
    MessageWriter = require('../lib/MessageWriter');

describe('MessageWriter', function() {
    'use strict';

    var log = require('simple-node-logger' ).createSimpleLogger();

    var createOptions = function() {
        var opts = {};

        opts.log = log;

        return opts;
    };

    describe('#instance', function() {
        var writer = new MessageWriter( createOptions() ),
            methods = [
                'wrapMessage',
                'send',
                'getMessageCount',
                '__protected'
            ];

        it('should create an instance of MessageWriter', function() {
            should.exist( writer );
            writer.should.be.instanceof( MessageWriter );

            writer.__protected().separator.should.equal( '\n' );
        });

        it('should have all expected methods by size and type', function() {
            dash.functions( writer ).length.should.equal( methods.length );
            methods.forEach(function(method) {
                writer[ method ].should.be.a( 'function' );
            });
        });
    });

    describe('wrapMessage', function() {
        var writer = new MessageWriter( createOptions() );

        it('should wrap a plain text message', function() {
            var obj = writer.wrapMessage('this is a test');

            should.exist( obj );
            obj.message.should.equal( 'this is a test' );
            obj.ts.should.be.above( 100 );
            should.exist( obj.mid );
        });

        it('should wrap a complex object', function() {
            var msg = {
                one:'this is my one test',
                two:'second parameter'
            };

            var obj = writer.wrapMessage( msg );

            should.exist( obj );
            should.exist( obj.mid );
            obj.ts.should.be.above( Date.now() - 1000 );

            obj.message.one.should.equal( msg.one );
            obj.message.two.should.equal( msg.two );
        });

        it('should reject a null message', function() {
            var obj = writer.wrapMessage();

            should.not.exist( obj );
        });
    });
});
