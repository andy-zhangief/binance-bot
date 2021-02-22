/**
 * @class MessageReader
 *
 * @author: darryl.west@roundpeg.com
 * @created: 6/21/14 8:18 PM
 */
const events = require('events' ),
    util = require('util' );

const MessageReader = function(options) {
    'use strict';

    const reader = this,
        log = options.log;

    let separator = options.separator || '\n',
        messageCount = 0;

    events.EventEmitter.call( this );

    /**
     * the line handler parses the JSON line and fires a message event. Lines are delimied with the 'separator'
     * character, typically new line (\n).
     *
     * @param line - a stringified JSON object.
     */
    this.lineHandler = function(line) {
        let data;

        if (line && line.length > 2) {
            try {
                data = JSON.parse(line);

                messageCount++;

                log.debug('< read: ', line, ', message count: ', messageCount);


            } catch(err) {
                log.error( 'error parsing line: ', line, ', err: ', err.message);
            }

            if (data) {
                // don't fire the event in this thread...
                process.nextTick(function() {
                    reader.emit( 'message', data );
                });
            }
        }
    };

    /**
     * return the total number of messages read by this reader
     */
    this.getMessageCount = function() {
        log.info('total messages read: ', messageCount);
        return messageCount;
    };

    this.__protected = function() {
        return {
            separator:separator
        };
    };

    // constructor validations
    if (!log) {
        throw new Error('socket server must be constructed with a log');
    }
};

util.inherits( MessageReader, events.EventEmitter );

module.exports = MessageReader;