/**
 * @class MessageWriter
 *
 * @author: darryl.west@roundpeg.com
 * @created: 6/21/14 6:37 PM
 */
const uuid = require('node-uuid');

const MessageWriter = function(options) {
    'use strict';

    const writer = this,
        log = options.log;

    let separator = options.separator || '\n',
        messageCount = 0;

    /**
     * wrap the string or object message with a message id (mid) and timestamp (ts)
     *
     * @param obj - the string of object message
     * @returns the wrapped object with mid, ts, and message properties
     */
    this.wrapMessage = function(obj) {
        if (!obj) {
            log.error('wrap message expects a message object...');
            return;
        }

        const wrapper = {
            mid:uuid.v4(),
            ts:Date.now(),
            message:obj
        };

        return wrapper;
    };

    /**
     * send a message to the socket;  the socket must be open and writable.
     *
     * @param obj - the string or object
     * @param socket - open/writable socket
     * @returns the wrapped message object
     */
    this.send = function(obj, socket) {
        let wrapper,
            json;

        if (!obj) {
            log.error('wrap message expects a message object...');
            return wrapper;
        }

        if (socket && socket.writable) {
            wrapper = writer.wrapMessage( obj );
            json = JSON.stringify( wrapper );

            log.debug('> send: ', json, ' to client: ', socket.id);

            socket.write( json + separator );
            messageCount++;
        } else {
            log.warn('client socket is no longer writable: ', (socket) ? socket.id : 'no socket available...');
        }

        return wrapper;
    };

    /**
     * return the total number of messages sent by this writer
     */
    this.getMessageCount = function() {
        log.info('total messages written: ', messageCount);
        return messageCount;
    };

    this.__protected = function() {
        return {
            separator:separator
        };
    };

    // constructor validations
    if (!log) throw new Error('socket server must be constructed with a log');
};


module.exports = MessageWriter;