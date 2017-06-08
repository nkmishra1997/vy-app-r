var flock = require('flockos');
var config = require('./config.js');
var config_twitter = require('./config-twitter.js');
var express = require('express');
var fs = require('fs');
var Twit = require('twit');
var url  = require('url');
var async = require('async');
const googleTrends = require('google-trends-api');
var util = require('util');
var cons = require('consolidate'); 
var path = require('path');
var bodyParser = require('body-parser');
var request = require('request');



flock.appId = config.appId;
flock.appSecret = config.appSecret;
var app = express();
var T = new Twit(config_twitter);


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.engine('html', cons.swig)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.use(flock.events.tokenVerifier);
app.post('/events', flock.events.listener);
app.get('/home', function(req, res) {
    res.send('Thank You for registering with us!');
});
app.get('/', function(req, res) {
    res.send('Flock');
});
app.get('/trending', function(req, res) {
    var url_parts = url.parse(req.url, true);
    var name = "";
    var number = req.query.number;
    console.log(number);
    if (req.query.name[0] == '%' && req.query.name[1] == '2' && req.query.name[2] == '3') {
        name = "#";
        name += req.query.name.slice(3);
    } else {
        name = req.query.name;
    }
    var params = { 
    q: name, 
    count: number 
    }
    console.log(name);
    var htmltobesend="";
    T.get('search/tweets', params, function (err, data, response) {
        var tweets = data.statuses;
        var asyncArray =[];
        tweets.forEach(function(tweet) {
            asyncArray.push(
                function(callback) {
                    console.log(tweet);
                    var urltobechecked = 'https://twitter.com/'+tweet.user.screen_name+'/status/'+ tweet.id_str;
                    console.log(urltobechecked);
                    T.get('statuses/oembed', {
                        url: urltobechecked
                    }, function(err, data, response) {
                        if(err) {
                            console.warn(err);
                            callback(true);
                            return ;
                        }                         
                        callback(false, data.html);
                    }); 
                }
            );
        });
        async.parallel(asyncArray, function(err, results) {
            if(err) { 
                console.log(err); 
                res.send(500,"Server Error"); return; 
            }
            console.log(results);
            var sendthis = results.join("");
            res.send(sendthis);
        });
    }); 
});

app.get('/googletrends', function(req,res) {
    var text = req.query.text;
    var comm = text.split(",");
    var commands = {};
    var i=0;
    var commstring = "";
    comm.forEach(function(command) {
        commands[i] = command;
        i++;
        commstring += command + ',';
    });
    var response = "";
    commstring = commstring.slice(0,commstring.length-1);
    console.log(commstring);
    res.render("charttrends", {'response' : response, 'commands': commstring});
});

app.get('/grammar', function(req, res) {
    var text = req.query.text;
    if(text != undefined || text != null) {
         var options = { 
            method: 'GET',
            url: 'https://api.cognitive.microsoft.com/bing/v5.0/spellcheck/',
            qs: { text: text, mode: 'proof' },
            headers: { 
                'ocp-apim-subscription-key': '6c0e679d884f4d11b35174fbd9e007d1' 
            } 
        };
        request(options, function (error, response, body) {
            if (error) throw new Error(error);
            console.log(body);
            res.render("grammar", {text: text, body: body});
            return ;
        });
    } else {
        res.render("grammar", {});
    }
});

// Read tokens from a local file, if possible.
var tokens;
try {
    tokens = require('./tokens.json');
} catch (e) {
    tokens = {};
}

// save tokens on app.install
flock.events.on('app.install', function (event, callback) {
    tokens[event.userId] = event.token;    
    callback(null, {});
});


// delete tokens on app.uninstall
flock.events.on('app.uninstall', function (event, callback) {
    delete tokens[event.userId];
    callback(null, {});
});


flock.events.on('client.slashCommand', function (event, callback) {
    var name = event.name;
    var userId = event.userId;
    var userName = event.userName;
    var chat = event.chat;
    var chatName = event.chatName;
    var command = event.command;
    var text = event.text;
    var textArray = text.split(" ");
    var hint1 = textArray[0];
    textArray[0] = "";
    textArray.splice(0, 1);
    var commandText = textArray.join(" ");

    if(hint1 == "trendy") {
        T.get('trends/place', { 
            id: 1
        }, function (err, data, response) {
            console.log(err);
            var tweets = data[0].trends;
            // console.log(tweets[0].name);
            var names = [];
            var names_twit="";
            if(textArray[0]) {
                var lengthtext = textArray[0];
            } else {
                var lengthtext = 10;
            }
            for(var i=0;i<lengthtext; i++) {
                if(i != 0) {
                    names_twit += "<br/>";
                }
                var uri = config.baseUrl+"/trending?name=";
                if((tweets[i].name)[0] == '#') {
                    uri += '%23';
                    uri += (tweets[i].name).slice(1);
                } else {
                    uri += tweets[i].name;
                }
                var url = encodeURI(uri);
                if(textArray[1]){
                    var mintextlength = textArray[1];
                } else {
                    var mintextlength = 5;
                }
                url += '&number=' + mintextlength;
                console.log("URl : ",url);

                names_twit += '<action id="act1" type="openWidget" url="'+url+'" desktopType="sidebar" mobileType="modal">'+tweets[i].name+'</action>'; 
            }

            flock.callMethod('chat.sendMessage', tokens[event.userId], {
                to: chat,
                text: "Trending Tweets"
                ,attachments: 
                [
                    {
                        "title":"Trending Tweets",
                        "description":"Top "+lengthtext+ " tweets",
                        "views": {
                            // "html": { 
                            //     "inline": "<html><head></head><body>"+names_twit+"</body></html>" 
                            // }
                            // ,
                            "flockml": '<flockml>'+names_twit+'</flockml>'
                        }
                        // ,"buttons": [{
                        //     "name": "View",
                        //     "icon": "https://cdn3.iconfinder.com/data/icons/faticons/32/view-01-128.png",
                        //     "action": { "type": "openWidget", "desktopType": "modal", "mobileType": "modal", "url": "<action url>" },
                        //     "id": "viewButton"
                        // }, {
                        //     "name": "Help",
                        //     "icon": "https://cdn4.iconfinder.com/data/icons/ionicons/512/icon-help-circled-128.png",
                        //     "action": { "type": "openWidget", "desktopType": "sidebar", "mobileType": "modal", "url": "<action url>" },
                        //     "id": "helpButton"
                        // }]
                    }
                ]
            }, function (error, response) {
                if(!error) {
                    console.log(response);
                } else {
                    console.log('error while sending chat sendMessage');
                }
            });
        }); 

        
        
        callback(null, {
            "text": "Fetching tweets!"
        });

    } else if (hint1 == "analyze") {
          var url = config.baseUrl + '/googletrends?text='+encodeURI(commandText);
          flock.callMethod('chat.sendMessage', tokens[event.userId], {
                to: chat,
                text: "Trends"
                ,attachments: 
                [
                    {
                        "title":"Trends",
                        "description":"",
                        "views": {
                            "html": { 
                                "inline": '<html><head><title>Grammar</title><link href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-BVYiiSIFeK1dGmJRAkycuHAHRg32OmUcww7on3RYdg4Va+PmSTsz/K68vbdEjh4u" crossorigin="anonymous"><script src="https://code.jquery.com/jquery-2.2.4.min.js" integrity="sha256-BbhdlvQf/xTY9gja0Dq3HiwQF8LaCRTXxZKRutelT44=" crossorigin="anonymous"></script><script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js" integrity="sha384-Tc5IQib027qvyjSMfHjOMaLkfuWVxZxUPnCJA7l2mCWNIpG9mGCD8wGNIcPD7Txa" crossorigin="anonymous"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/1.0.2/Chart.min.js"></script></head><body><input id = "parsebody" type="hidden" value="{{commands}}"><script>var inputElement = document.getElementById("parsebody");var commands = inputElement.value;var commandArray = "'+commandText+'".split(",");inputElement.value = "";for(var i=0; i<commandArray.length;i++) { commandArray[i] = commandArray[i].trim(); } var width = window.innerWidth;var height = window.innerHeight;var final_str=""; for(var i=0; i<commandArray.length;i++) { if(i != commandArray.length-1) { for(var j =0; j<commandArray[i].length; j++) {if(commandArray[i][j] == " ") { commandArray[i][j] = "+"; } } final_str += commandArray[i] + ","; } else { for(var j =0; j<commandArray[i].length; j++) { if(commandArray[i][j] == " ") { commandArray[i][j] = "+"; }} final_str += commandArray[i];}}var url = "https://www.google.com/trends/fetchComponent?hl=en-US&q=" + final_str +"&cmpt=q&content=1&cid=TIMESERIES_GRAPH_0&export=5&w="+width+"&h="+height;</script><iframe id="iframemap" scrolling="yes" style="border:none;" width="100%" height="100%"></iframe><script> var iframeElem = document.getElementById("iframemap");iframeElem.src=url; </script></body></html>',
                                "height": "155"
                            }
                        }
                        ,"buttons": [{
                            "name": "View",
                            "icon": "https://cdn3.iconfinder.com/data/icons/faticons/32/view-01-128.png",
                            "action": { "type": "openWidget", "desktopType": "modal", "mobileType": "modal", "url": url },
                            "id": "viewButton"
                        }
                        ]
                    }
                ]
            }, function (error, response) {
                if(!error) {
                    console.log(response);
                } else {
                    console.log('error while sending chat sendMessage');
                }
            });
        callback(null, {
            "text": "Fetching Graphs"
        });

    } else {
        setTimeout(function() {
            flock.callMethod('chat.sendMessage', tokens[event.userId], {
                    to: chat,
                    text: commandText 
                }, function (error, response) {
                    if(!error) {
                        console.log(response);
                    } else {
                        console.log('error while sending chat sendMessage');
                    }
                });
        }, time); 
        callback(null, {
            "text": "Setting a reminder for " + time + " milliseconds!"
        });
    }
});

// Start the listener after reading the port from config
var port = config.port || 3000;
app.listen(port, function () {
    console.log('Listenineg on port: ' + port);
});

// exit handling -- save tokens in token.js before leaving
process.on('SIGINT', process.exit);
process.on('SIGTERM', process.exit);
process.on('exit', function () {
    fs.writeFileSync('./tokens.json', JSON.stringify(tokens));
});





// Flock api call

// flock.events.on('client.slashCommand', function (event, callback) {
//     // handle slash command event here

//     // invoke the callback to send a response to the event
//     callback(null, { text: 'Received your command' });
// });

// flock.callMethod('chat.sendMessage', token, {
//     to: 'u:wufu4udrcewerudu',
//     text: 'hello'
// }, function (error, response) {
//     if (!error) {
//         console.log(response);
//     }
// });

/******************** Interest over time **************************/

// googleTrends.interestOverTime({keyword: 'Valentines Day'})
// .then((res) => {
//   console.log('this is res', res);
// })
// .catch((err) => {
//   console.log('got the error', err);
//   console.log('error message', err.message);
//   console.log('request body',  err.requestBody);
// });

// googleTrends.interestOverTime({keyword: 'Valentines Day', startTime: new Date(Date.now() - (4 * 60 * 60 * 1000))}, function(err, results) {
//   if (err) console.log('oh no error!', err);
//   else console.log(results);
// });


/******* Interest over time - Comparing multiple keywords *********/
// googleTrends.interestOverTime({keyword: ['Valentines Day', 'Christmas Day']})
// .then((res) => {
//   console.log('this is res', res);
// })
// .catch((err) => {
//   console.log('got the error', err);
// })


/******************** Interest by region **************************/


// googleTrends.interestByRegion({keyword: 'Donald Trump', startTime: new Date('2017-02-01'), endTime: new Date('2017-02-06'), resolution: 'CITY'})
// .then((res) => {
//   console.log(res);
// })
// .catch((err) => {
//   console.log(err);
// })

// googleTrends.interestByRegion({keyword: 'Donald Trump', startTime: new Date('2017-02-01'), endTime: new Date('2017-02-06'), geo: 'US-CA'})
// .then((res) => {
//   console.log(res);
// })
// .catch((err) => {
//   console.log(err);
// })


/******************** Related queries **************************/

// googleTrends.relatedQueries({keyword: 'Westminster Dog Show'})
// .then((res) => {
//   console.log(res);
// })
// .catch((err) => {
//   console.log(err);
// })

/******************** Related topics **************************/

// googleTrends.relatedTopics({keyword: 'Chipotle', startTime: new Date('2015-01-01'), endTime: new Date('2017-02-10')})
// .then((res) => {
//   console.log(res);
// })
// .catch((err) => {
//   console.log(err);
// });