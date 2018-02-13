'use strict';

// load external modules
var libQ = require('kew');
var io = require('socket.io-client');
var Gpio = require('onoff').Gpio;
var exec = require('child_process').exec;
var sleep = require('sleep');

var socket = io.connect('http://localhost:3000');


//declare global status variable
var status = 'stop';
var command ='';
var prestatus;
var status2 = 'stop';


// Define the autostandbyamp class
module.exports = autostandbyamp;

function execChild(callback){
    var child = exec( 'volumio status | awk \'NR==2{ gsub(\"\\"\",\"\"); gsub(\",\",\"\");print $2 }\'',

          function (error, stdout, stderr) 
          {
            status2=stdout.replace(/[\n\r]/g, '');
             callback(status2);
          }
 )};


function autostandbyamp(context) {
	var self = this;

	// Save a reference to the parent commandRouter
	self.context = context;
	self.commandRouter = self.context.coreCommand;
	self.logger=self.commandRouter.logger;
	this.configManager = this.context.configManager;

    //define shutdown variable
    self.shutdown;

}

// define behaviour on system start up. In our case just read config file
autostandbyamp.prototype.onVolumioStart = function()
{
    var self = this;
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);
    return libQ.resolve();

}

// Volumio needs this
autostandbyamp.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
}

// define behaviour on plugin activation
autostandbyamp.prototype.onStart = function() {
	var self = this;
	var defer=libQ.defer();

    // initialize output port

    // read and parse status once
    socket.emit('getState','');
    socket.once('pushState', self.parseStatus.bind(self));

    // listen to every subsequent status report from Volumio
    // status is pushed after every playback action, so we will be
    // notified if the status changes
    socket.on('pushState', self.parseStatus.bind(self));
     
    command = self.config.get('ircommand');

    defer.resolve();
	return defer.promise;
};

// define behaviour on plugin deactivation.
autostandbyamp.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();


    return defer.promise;
};

// initialize Plugin settings page
autostandbyamp.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;
    self.logger.info('IR Command: ' + self.config.get('ircommand'));
    
    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
                                __dirname+'/i18n/strings_en.json',
                                __dirname + '/UIConfig.json')
    .then(function(uiconf)
          {
          uiconf.sections[0].content[0].value = self.config.get('ircommand');
		  command = self.config.get('ircommand');
          defer.resolve(uiconf);
          })
    .fail(function()
          {
          defer.reject(new Error());
          });
    
    return defer.promise;
};

// define what happens when the user clicks the 'save' button on the settings page
autostandbyamp.prototype.saveOptions = function(data) {
    var self = this;
    var successful = true;
    var old_setting = self.config.get('ircommand');

    // save port setting to our config
   self.logger.info('IR Command'+command)
   self.config.set('ircommand', data['ircommand']);
   command = self.config.get('ircommand');

    try{

    } catch(err) {
        successful = false;
    }
    if(successful){
        // output message about successful saving to the UI
        self.logger.info('----> '+command)
	self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
        self.commandRouter.pushToastMessage('Success','Settings', 'saved');
    } else {
        // save port setting to old config
        self.config.set('ircommand', old_setting);
        command = self.config.get('ircommand');
	self.commandRouter.pushToastMessage('error', "Configuration not update", 'The configuration has not been successfully updated');
        self.commandRouter.pushToastMessage('Failure','Port not accessible', '');
    }
};


// a pushState event has happened. Check whether it differs from the last known status and
// switch output port on or off respectively
autostandbyamp.prototype.parseStatus = function(state) {
    var self = this;

    if(state.status=='play' && state.status!=status){
        status=state.status;
        self.on();
    } else if((state.status=='pause' || state.status=='stop') && (status!='pause' && status!='stop')){
        status=state.status;
        self.off();
    }

};

// switch outport port on
autostandbyamp.prototype.on = function() {
    var self = this;
    
    self.logger.info('IR Command: '+command)
//	exec('/data/plugins/miscellanea/autostandbyamp/scripts/lirc-amp.sh start \''+command+'\'', function(err, stdout, stderr){});	
	self.logger.info('send command power-on');
	self.logger.info('#########################');
	self.logger.info('#########################');
	self.logger.info(status2);
	if(status2=='pause' || status2=='stop'){
	exec(command, function(err, stdout, stderr){});
	status2 = 'play';
	}
};

//switch output port off
autostandbyamp.prototype.off = function() {
    var self = this;

    
    self.logger.info('IR Command: '+command)
    self.logger.info('sleep');
    sleep.sleep(6);

    execChild(function(status2){
	self.logger.info('after 2 seconds: '+status2);
	self.logger.info('#'+status2+'#');
	if(status2=='pause' || status2=='stop'){
		self.logger.info('send command power-off');
		exec(command, function(err, stdout, stderr){});
		status2 = 'stop';
	};

	
	});
    
	

};

