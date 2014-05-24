'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    passport = require('passport'),
    logger = require('mean-logger');

/**
 * Main application entry file.
 * Please note that the order of loading is important.
 */

// Initializing system variables
var config = require('./server/config/config');
var db = mongoose.connect(config.db);

// Bootstrap Models, Dependencies, Routes and the app as an express app
var app = require('./server/config/system/bootstrap')(passport, db);

// add socket io
var http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server);

io.sockets.on('connection', function(socket) {
	socket.on('createMessage', function(data) {
		socket.broadcast.emit('onMessageCreated', data);
	});

	socket.on('createComment', function(comment) {
		socket.broadcast.emit('onCommentCreated', comment);
	});

});

server.listen(config.port, config.hostname);


// Start the app by listening on <port>, optional hostname
// app.listen(config.port, config.hostname);
console.log('Mean app started on port ' + config.port + ' (' + process.env.NODE_ENV + ')');

// Initializing logger
logger.init(app, passport, mongoose);

// Expose app
exports = module.exports = app;