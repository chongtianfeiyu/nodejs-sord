"use strict";

global.sordDebug = true;

var net = require('net');
var ansibuffer = require('nodejs-ansibuffer');
var microdb = require('nodejs-microdb');
var path = require('path');
var datapath = path.join(__dirname, 'data');

var sord = {
  datapath: path.join(__dirname, 'data'),
  art: require('./lib/art.js'),
  acenter: ansibuffer.ANSICenter,
  menuctrl: require('./lib/menu.js').SordMenu,
  menus: require('./lib/menu.js').SordMenuArt,
  util: require('./lib/util.js'),
  
  conf: new microdb({'file': path.join(datapath, 'config.db')}),
  users: new microdb({'file': path.join(datapath, 'users.db')}),
  gamedata: new microdb({'file': path.join(datapath, 'gamedata.db'), 'savetime': 0}),
  darkhorse: new microdb({'file': path.join(datapath, 'darkhorse.db'), 'datatype': 0, 'maxrec': 12}),
  patrons: new microdb({'file': path.join(datapath, 'patrons.db'), 'datatype': 0, 'maxrec': 12}),
  daily: new microdb({'file': path.join(datapath, 'dailyhap.db'), 'datatype': 0, 'maxrec': 12}),
  flowers: new microdb({'file':path.join(datapath, 'flowers.db'), 'datatype':0, 'maxrec':10}),
  dirt: new microdb({'file':path.join(datapath, 'dirt.db'), 'datatype':0, 'maxrec':10}),

  
  menuwait: function(pass, callback, menu, menuopt, validopt, validconv ) {
    var validcodes = [];
    if ( typeof validconv === 'undefined' ) { validconv = true; }
    if ( typeof menu === 'function' ) { pass.outBuff.queue(menu(menuopt)); }
    if ( typeof menu === 'string' ) { pass.outBuff.queue(menu); }
    if ( typeof validconv === 'undefined' || validconv === true ) {
      if ( typeof validopt === 'undefined' ) {
        for ( var i = 32; i < 127; i++ ) { validcodes.push(i); }
      } else {
        for ( var i = 0; i < validopt.length; i++ ) { validcodes.push(validopt[i].charCodeAt(0)); }
      }
    } else {
      validcodes = validopt;
    }
    if ( pass.inBuff.length > 0 ) {
      var thisChoice = pass.inBuff.shift();
      var thisCode = thisChoice.toUpperCase().charCodeAt(0);
      if ( validcodes.indexOf(thisCode) > -1 ) {
        pass.outBuff.queue(thisChoice.toUpperCase() + "\r\n");
        setTimeout(callback,0,pass,thisChoice.toUpperCase()); return;
      }
    }
    setTimeout(function () { sord.menuwait(pass, callback, false, false, validcodes, false) }, 100);
  },
  readline : function(pass, callback, opts) {
    if ( typeof opts.once === 'undefined' || opts.once === false ) { 
      pass.inBuff.clear(); 
      opts.once = true;
      opts.line = '';
    }
    if ( typeof opts.line === 'undefined' ) { opts.line = ''; }
    if ( typeof opts.noprint === 'undefined' ) { opts.noprint = false; }
    if ( typeof opts.passopt === 'undefined' ) { opts.passopt = false; }
    
    while ( pass.inBuff.length > 0 ) { 
      var x = pass.inBuff.shift();
      var code = ( opts.noprint === 3 ) ? 13 : x.charCodeAt(0);
      
      if ( (code === 8 || code === 127) && line.length > 0 ) { 
        opts.line = opts.line.substr(0,line.length-1); 
        pass.outBuff.queue("\x1b[1D \x1b[1D");
      }
      if ( code === 13 ) { 
        pass.outBuff.queue("\r\n");
        if ( opts.passopt === true ) {
          opts.once = false;
          setTimeout(callback,0,pass,opts.line,opts); return;
        } else {
          setTimeout(callback,0,pass,opts.line); return;
        }
      } 
      if ( code > 31 && code < 127 ) {
        opts.line = opts.line + x;
        if ( opts.noprint === false ) { pass.outBuff.queue(x); }
        if ( opts.noprint === 2 ) { pass.outBuff.queue('*'); }
      }
    }
    setTimeout(function () { 
      sord.readline(pass, callback, opts) 
    }, 100);
  },
  pause: function (pass, callback) {
    pass.outBuff.queue(" `%[`2-`0=`2- `0P`2ress `0A`2ny `0K`2ey -`0=`2-`%]`7 ");
    sord.readline(pass, this.clrpause, {'noprint':3, 'nextcall':callback, 'passopt': true});
  },
  clrpause: function(pass, line, opts) {
    pass.outBuff.queue("\x1b[1A                        \x1b[1G");
    setTimeout(opts.nextcall,0,pass,line);
  },
  killconn: function(pass) {
    var exitQuote = ['The black thing inside rejoices at your departure.', 'The very earth groans at your depature.', 'The very trees seem to moan as you leave.', 'Echoing screams fill the wastelands as you close your eyes.', 'Your very soul aches as you wake up from your favorite dream.'];
    var thisQuote = Math.floor(Math.random()*exitQuote.length);
    if ( pass.curUser !== false ) {
      pass.sord.users.data[pass.curUser].online = 0;
    }
    pass.outBuff.queue(pass.sord.util.casebold("\r\n\r\n   "+exitQuote[thisQuote]+"\r\n\r\n", 7));
    pass.outBuff.queue("NO CARRIER\r\n");
    setTimeout(function() {pass.conn.end(pass.outBuff.dump());}, 2000);
  },
  gettime: function(strt) {
    var ed = new Date();
    var diff = ( ed - strt ) / 1000;
    var min = parseInt((diff / 60), 10);
    var sec = parseInt((diff % 60), 10);
    return ('`7' + min + '`%:`7' + ((sec<10)?'0':'') + sec );
  }
};

var server = net.createServer(function(c) { //'connection' listener
  console.log('server connected from ' +  c.remoteAddress);
  
  var passer = { 
    outBuff: new ansibuffer.ANSIBuffer(),
    inBuff: new ansibuffer.ANSIBuffer(),
    conn: c,
    startTime: new Date(),
    sord: sord, 
    curUser: false,
    xpert: false,
  };
  var writer = setInterval(
    function() { 
      var tmp = passer.outBuff.bite(); 
      if ( tmp !== false ) { c.write(tmp); } 
    }, 5);
  
    // Clear the input buffer of any captured set-up control chars
  setTimeout(function() { passer.inBuff.clear(); },500);
   // Set character mode (client side - do not wait for CR-LF)
  c.write(String.fromCharCode(255) + String.fromCharCode(253) + String.fromCharCode(34),'ascii');
   // No local (client-side) echo
  c.write(String.fromCharCode(255) + String.fromCharCode(251) + String.fromCharCode(1),'ascii');
  
  c.on('end', function() {
    clearInterval(writer);
    sord.users.flush();
    console.log('Server disconnected');
  });
  c.on('data', function(data) {
    data.toString().split('').forEach(function(x) {
      var code = x.charCodeAt(0);
      // Dump High ASCII, all control besides BKSPC & DEL
      if ( code === 8 || code === 13 || ( code > 31 && code < 128 ) ) { 
        passer.inBuff.queue(x);
      }
    });
  });
  
  c.write("Establishing Connection...  Starting... (Please Wait)\r\n");
  setTimeout(function() {
    passer.outBuff.center(
      " `4-`@=`%=`@=`4- " +
      "`9W`1elcome to `9S`%.`9O`%.`9R`%.`9D`%." +
      " `4-`@=`%=`@=`4- `7\r\n"
    );
    sord.pause(passer, show.Banner);
  }, 1000);
});
server.listen(sord.conf.data.port, function() { //'listening' listener
  console.log('--Server bound to port ' + sord.conf.data.port);
});

// Here be dragons.
var show = {
  Banner : function(pass) {
    if ( global.sordDebug !== true ) {
      pass.outBuff.queue(sord.art.banner());
    }
    sord.pause(pass, show.Welcome);
  },
  Welcome: function(pass) {
    pass.outBuff.queue(sord.art.welcome(sord));
    setTimeout(sord.menuwait,0,pass,sord.menuctrl.prolouge,false,false,['E','L','I','Q']);
  }
};

