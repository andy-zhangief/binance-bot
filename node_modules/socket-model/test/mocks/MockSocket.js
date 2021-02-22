/**
 *
 *
 * @author: darryl.west@roundpeg.com
 * @created: 6/21/14 7:00 PM
 */
var net = require('net' ),
    dash = require('lodash');

var MockSocket = function() {
    'use strict';

    var mock = this,
        sentMessages = [],
        receivedMessages = [],
        mid = Math.round(Math.random( 1000 ) ),
        bytesRead = 0,
        bytesWritten = 0;

    dash.extend( this, new net.Socket() );

    this._handle = { fd:mid };

    this.writable = true;
    this.readable = true;
    this.destroyed = false;

    this.write = function(data, callback) {
        callback();
    };

    this.end = function() {
        mock.writable = false;
        mock.readable = false;
        mock.destroyed = true;
    };

    this.destroy = function() {
        mock.end();
    };

    this.pause = function() {

    };

    this.resume = function() {

    };

    this.setTimeout = function(timeout, callback) {

    };

    this.setKeepAlive = function() {

    };

    this.address = function() {

    };

    this.unref = function() {

    };

    this.bytesRead = bytesRead;
    this.bytesWritten = bytesWritten;

    this.on = function(type, handler) {

    };
};

module.exports = MockSocket;
