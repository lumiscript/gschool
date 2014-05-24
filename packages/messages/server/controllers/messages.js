'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Message = mongoose.model('Message'),
    User = mongoose.model('User'),
    Schedule = mongoose.model('Schedule'),
    _ = require('lodash');


// unread inbox
exports.unread = function(req,res){
    var query = Message.find({to : req.user.username});

    query.count(function(err,totals){

        // find msg has read
        var q = Message.find({to : req.user.username,isRead : req.user.username});
        q.count(function(e,t){
            res.jsonp({'totals' : totals - t});
        });
        
    });
};


/**
 * List of messages
 */
exports.all = function(req, res) {

    // from schedule
    if (req.query.schedule == 1) {
        var query = Schedule.find({from : req.user._id});
    }
    else
    {
        // from inbox
        if (req.query.inbox == 1) {
            var query = Message.find({to : req.user.username});
        }
        else
        {
            // from trash
            if (req.query.trash) {
                var query = Message.find({isTrashReceiver : req.user.username});
            }
            else // from sent box
                var query = Message.find({from : req.user._id});
        }
    }

    
    
    query.count(function(err, totals) {
        var page = req.query.page;
        var limit = req.query.limit;

        if (req.query.schedule == 1) {
            var q = Schedule.find({from : req.user._id}).skip((page - 1) * limit).limit(limit);
        }
        else
        {
            if (req.query.inbox == 1) {
                var q = Message.find({to : req.user.username}).skip((page - 1) * limit).limit(limit);
            }
            else
            {
                if (req.query.trash) {
                    var q = Message.find({isTrashReceiver : req.user.username}).skip((page - 1) * limit).limit(limit);
                }
                else
                    var q = Message.find({from : req.user._id}).skip((page - 1) * limit).limit(limit);
            }
        }

        q.sort({ dateSent : 'desc' }).exec(function(err, messages) {
            if (err) {
                console.log(err);
                res.render('error', {
                    status: 500
                });
            } else {
                messages.push({'totals' : totals , 'pages' : Math.ceil(totals / limit) });
                res.jsonp(messages);
            }
        });
    });

};


// suggest username

exports.suggest = function(req,res){
    console.log(req.query);
    User.find( {name: new RegExp('^'+req.query.q, "i") },'username name', function(err, users) {
        if (err) {
            res.render('error', {
                status: 500
            });
        } else {
            var userArr = [];
            for (var i = 0; i < users.length; i++) {
                userArr[i] = { 'label' : users[i].name, 'value' : users[i].username };
            };
            res.jsonp(userArr);
        }
    });
};

// Get message by id
exports.message = function(req, res, next, id) {
    Message.load(id, function(err, message) {
        if (err) return next(err);
        if (!message) return next(new Error('Failed to load message ' + id));
        req.message = message;
        next();
    });
};

/**
 * Update an message
 */
exports.update = function(req, res) {
    var message = req.message;

    message = _.extend(message, req.body);

    if (!message.hasRead(req.user.username)) {
        message.isRead.push(req.user.username);
    };

    message.save(function(err) {
        if (err) {
            return res.send('users/signup', {
                errors: err.errors,
                message: message
            });
        } else {
            res.jsonp(message);
        }
    });
};

/**
 * Delete an message
 */
exports.destroy = function(req, res) {
    var message = req.message;

    console.log(message);

    // if only me on this message, this message will remove
    if (message.to.length == 1 && message.to.indexOf(req.user.username) !== -1 ) {
         message.remove(function(err) {
            if (err) {
                return res.send('users/signup', {
                    errors: err.errors,
                    message: message
                });
            } else {
                // res.jsonp(message);
            }
        });
    }
    else     // Otherwise, remove my username from field 'to'
    {
        for (var i = 0; i < message.to.length; i++) {
            if( message.to[i] == req.user.username)
            {
                message.to.splice(i,1);
                break;
            }
        };

        message.save(function(err) {
            if (err) {
                return res.send('users/signup', {
                    errors: err.errors,
                    message: message
                });
            } else {
                // res.jsonp(message);
            }
        });
            
    }

   
};


// move to trash
exports.clean = function(req, res) {
    var idArr = req.query.ids.split(',');
    var counter = 0;

    console.log(idArr);
    if (!idArr.length || idArr[0] == '') {
        console.log('Empty');
        res.jsonp({'error' : 'empty'});
        return ;
    };
    // remove from schedule db
    if (req.query.schedule == 1) {
       Schedule.find({ _id : { $in : idArr } },function (err,data) {
            data.forEach(function(message){
                message.remove(function(err) {
                    if (err) {
                        return res.send('users/signup', {
                            errors: err.errors,
                            message: message
                        });
                    } 
                });
            });
            res.jsonp({'messages' : data});
       });
    }
    else
    {
        Message.find({ _id : { $in : idArr } },function (err,data) {
             data.forEach(function(message){
                if (req.query.inbox == 1) {
                        // move to trash from inbox
                        message.isTrashReceiver.push(req.user.username);
                        
                        var tmpTo = [];
                        for (var i = 0; i < message.to.length; i++) {
                            if (message.to[i] == req.user.username)
                                continue;
                            else
                                tmpTo.push(message.to[i]);
                        };

                        message.to = tmpTo;

                } else {
                        // note: emty trash
                        if (req.query.trash == 1) {
                            var tmpTrash = [];
                            for (var i = 0; i < message.isTrashReceiver.length; i++) {
                                if (message.isTrashReceiver[i] == req.user.username)
                                    continue;
                                else
                                    tmpTrash.push(message.isTrashReceiver[i]);
                            };
                            message.isTrashReceiver = tmpTrash;
                        }
                        else // move to trash from sender
                            message.isTrashSender.push(req.user.username);
                }

                    message.save(function(err) {
                            if (err) {
                                return res.send('users/signup', {
                                    errors: err.errors,
                                    message: message
                                });
                            } 
                            else
                            {
                                counter++;
                                if (counter == idArr.length) {
                                    res.jsonp({'messages' : data});
                                };
                            }
                        });
             });
        });
    }
    
   
};

/**
 * Create an message
 */
exports.send = function(req, res) {

    if (req.body.occurChecked || req.body.repeatChecked) {
        var message = new Schedule(req.body);
        message
    }
    else
    {
        var message = new Message(req.body);
    }
    
    var fs = require('fs-extra');
    // message.to = message.to.split(',');
    req.body.receiver = req.body.receiver.replace(" ","");
    message.to = req.body.receiver.split(',');
    message.from = req.user;
    message.fromName = req.user.name;

    message.save(function(err) {
        if (err) {
            return res.send('users/signup', {
                errors: err.errors,
                message: message
            });
        } else {
            // move file
            var new_location = './public/uploads/';
            if (message.file != "") {
                fs.copy('./public/uploads/tmp/' + message.file, new_location + message.file, function(err) {  
                    if (err) {
                        console.error(err);
                    } else {
                        console.log("move file success!")
                    }
                });
            };
            res.jsonp(message);

            // recursive msg
            if (req.body.repeatChecked) {
                var schedule = require('node-schedule');

                // explode hours and date
                var timeSelect = message.repeat.split(',');
                var hoursArr = timeSelect[timeSelect.length - 1].split(':');
                var rule = new schedule.RecurrenceRule();
                rule.minute = hoursArr[1];
                rule.hour = hoursArr[0];
                timeSelect.pop(); // remove hours from arr
                rule.dayOfWeek = timeSelect;
                console.log(rule);
                // var j = schedule.scheduleJob(rule, function(){
                //     console.log('Today is recognized by Rebecca Black!');
                // });

            } else 
            if (req.body.occurChecked) { // schedule msg on time

                var schedule = require('node-schedule');
                var date = new Date(message.repeat);

                var j = schedule.scheduleJob(date, function(){
                    // save to message
                        Schedule.find({_id : message._id},function(err,resp){
                        console.log(resp);
                        if (err) {
                            console.log('Schedule has been cancel.');
                            schedule.cancelJob(j);
                        }
                        else
                        {
                            if (resp.length) {
                                var msg = new Message();
                                 msg.to = message.to;
                                 msg.from = message.from;
                                 msg.fromName = message.fromName;
                                 msg.file = message.file;
                                 msg.message = message.message;

                                 msg.save(function(e){
                                        if (e) {
                                            console.log(e);
                                        }
                                        else
                                        {
                                            console.log(msg);
                                        }
                                 });
                             }
                             else
                                schedule.cancelJob(j);
                             
                        }
                    });

                   
                });
            };
            
        }
    });
};

// process upload file
exports.upload = function(req,res){
    var formidable = require('formidable'),fs = require('fs-extra'), util = require('util');

    var form = new formidable.IncomingForm();
    
    form.parse(req, function(err, fields, files) {
      res.jsonp({ files: files});
    });
    
    form.on('error', function(err) {
        console.error(err);
    });

    form.on('progress', function(bytesReceived, bytesExpected) {
        var percent_complete = (bytesReceived / bytesExpected) * 100;
        console.log(percent_complete.toFixed(2));
    });

    form.on('end', function(fields, files) {
        /* Temporary location of our uploaded file */
        var temp_path = this.openedFiles[0].path;
        /* The file name of the uploaded file */
        var file_name = this.openedFiles[0].name;
        /* Location where we want to copy the uploaded file */
        // Todo: Clean temp folder
        var new_location = './public/uploads/tmp/';
 
        fs.copy(temp_path, new_location + file_name, function(err) {  
            if (err) {
                console.error(err);
            } else {
                console.log("upload success!")
            }
        });
    });
    

}