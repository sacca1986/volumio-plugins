'use strict';

// load external modules
var libQ = require('kew');
var io = require('socket.io-client');
var Gpio = require('onoff').Gpio;
var exec = require('child_process').exec;
var sleep = require('sleep');
var execSync = require('exec-sync');

var socket = io.connect('http://localhost:3000');


//declare global status variable
var status = 'stop';
var volume = '';
// Define the aunacontrol class
module.exports = aunacontrol;


function aunacontrol(context) {
	var self = this;

	// Save a reference to the parent commandRouter
	self.context = context;
	self.commandRouter = self.context.coreCommand;
	self.logger=self.commandRouter.logger;
	this.configManager = this.context.configManager;

    //define shutdown variable
    self.shutdowngpiosp1;
    self.shutdowngpiosp2;
    self.shutdowngpiopac;

}

// define behaviour on system start up. In our case just read config file
aunacontrol.prototype.onVolumioStart = function()
{
    var self = this;
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);
    return libQ.resolve();    

}



// Volumio needs this
aunacontrol.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
}

// define behaviour on plugin activation
aunacontrol.prototype.onStart = function() {
	var self = this;
	var defer=libQ.defer();

    // initialize output port
    self.ampGPIOInit();
    socket.emit('getState','');

	
      if(self.config.get('speaker1_setting')){
	        self.logger.info("PIN UP");
        	self.shutdowngpiosp1.writeSync(0);
    	} else {
	    	self.logger.info('PIN DOWN');
        	self.shutdowngpiosp1.writeSync(1);
    	};
    	
    	 if(self.config.get('speaker2_setting')){
	        self.logger.info("PIN UP");
        	self.shutdowngpiosp2.writeSync(0);
    	} else {
	    	self.logger.info('PIN DOWN');
        	self.shutdowngpiosp2.writeSync(1);
    	};
    	if(self.config.get('powerac')){
	        self.logger.info("PIN UP");
        	self.shutdowngpiopac.writeSync(0);
    	} else {
	    	self.logger.info('PIN DOWN');
        	self.shutdowngpiopac.writeSync(1);
    	}



    // read and parse status once
    //socket.emit('getState','');
    //socket.once('pushState', self.parseStatus.bind(self));

    // listen to every subsequent status report from Volumio
    // status is pushed after every playback action, so we will be
    // notified if the status changes
    // socket.on('pushState', self.parseStatus.bind(self));

    defer.resolve();
	return defer.promise;
};

// define behaviour on plugin deactivation.
aunacontrol.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // we don't have to claim GPIOs any more
   self.freeGPIO();

    return defer.promise;
};

// initialize Plugin settings page
aunacontrol.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;
    self.logger.info('Speaker1: ' + self.config.get('speaker1_setting'));
    self.logger.info('Speaker2: ' + self.config.get('speaker2_setting'));
    self.logger.info('PowerAC: ' + self.config.get('powerac'));
    self.logger.info('gpiospeaker1: ' + self.config.get('gpio_speaker1'));
	self.logger.info('gpiospeaker2: ' + self.config.get('gpio_speaker2'));
	self.logger.info('gpioPowerAC: ' + self.config.get('gpio_powerac'));
	self.logger.info('volume_setting: ' + self.config.get('volume_setting'))
	
    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
                                __dirname+'/i18n/strings_en.json',
                                __dirname + '/UIConfig.json')
    .then(function(uiconf)
          {
          uiconf.sections[0].content[0].value = self.config.get('speaker1_setting');
//          uiconf.sections[0].content[0].value.label = self.config.get('port').toString();
          uiconf.sections[0].content[1].value = self.config.get('speaker2_setting');
          uiconf.sections[1].content[0].value = self.config.get('powerac');
          uiconf.sections[2].content[0].value = self.config.get('gpio_speaker1');
          uiconf.sections[2].content[1].value = self.config.get('gpio_speaker2');
          uiconf.sections[2].content[2].value = self.config.get('gpio_powerac');
          uiconf.sections[3].content[0].config.bars[0].value = self.config.get('volume_setting');
          volume = self.config.get('volume_setting');

          
          defer.resolve(uiconf);
          })
    .fail(function()
          {
          defer.reject(new Error());
          });
    
    return defer.promise;
};

// define what happens when the user clicks the 'save' button on the settings page
aunacontrol.prototype.saveOptionsSpeakers = function(data) {
    var self = this;
    var successful = true;
    var old_settingsp1 = self.config.get('speaker1_setting');
    var old_settingsp2 = self.config.get('speaker2_setting');

    // save port setting to our config
    self.logger.info('Speaker1 ' + data['speaker1_setting']);
    self.logger.info('Speaker2 ' + data['speaker2_setting']);
    //self.config.set('port', data['port_setting']['value']);
    self.config.set('speaker1_setting', data['speaker1_setting']);
    self.config.set('speaker2_setting', data['speaker2_setting']);
    // unexport GPIOs before constructing new GPIO object
  self.freeGPIO();
    try{
       self.ampGPIOInit()
    } catch(err) {
        successful = false;
    }
    if(successful){
	     if(self.config.get('speaker1_setting')){
	        self.logger.info("PIN UP");
        	self.shutdowngpiosp1.writeSync(0);
    	} else {
	    	self.logger.info('PIN DOWN');
        	self.shutdowngpiosp1.writeSync(1);
    	};
    	
    	 if(self.config.get('speaker2_setting')){
	        self.logger.info("PIN UP");
        	self.shutdowngpiosp2.writeSync(0);
    	} else {
	    	self.logger.info('PIN DOWN');
        	self.shutdowngpiosp2.writeSync(1);
    	};
    	if(self.config.get('powerac')){
	        self.logger.info("PIN UP");
        	self.shutdowngpiopac.writeSync(0);
    	} else {
	    	self.logger.info('PIN DOWN');
        	self.shutdowngpiopac.writeSync(1);
    	}


        // output message about successful saving to the UI
	self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
        self.commandRouter.pushToastMessage('Success','Settings', 'saved');
    } else {
        // save port setting to old config
        self.config.set('speaker1_setting', old_settingsp1);
        self.config.set('speaker2_setting', old_settingsp2);
        self.commandRouter.pushToastMessage('Failure','Port not accessible', '');
    }

};

aunacontrol.prototype.saveOptionsPowerAC = function(data) {
    var self = this;
    var successful2 = true;
    var old_settingac = self.config.get('powerac');
   
    // save port setting to our config
    self.logger.info('PowerAC ' + data['powerac']);
        //self.config.set('port', data['port_setting']['value']);
    self.config.set('powerac', data['powerac']);
    // unexport GPIOs before constructing new GPIO object
   self.freeGPIO();
    try{
        self.ampGPIOInit()
    } catch(err) {
        successful2 = false;
    }
    if(successful2){
        // output message about successful saving to the UI
	    if(self.config.get('powerac')){
	        self.logger.info("PIN UP");
        	self.shutdowngpiopac.writeSync(0);
    	} else {
	    	self.logger.info('PIN DOWN');
        	self.shutdowngpiopac.writeSync(1);
    	};
    	if(self.config.get('speaker1_setting')){
	        self.logger.info("PIN UP");
        	self.shutdowngpiosp1.writeSync(0);
    	} else {
	    	self.logger.info('PIN DOWN');
        	self.shutdowngpiosp1.writeSync(1);
    	};
    	
    	 if(self.config.get('speaker2_setting')){
	        self.logger.info("PIN UP");
        	self.shutdowngpiosp2.writeSync(0);
    	} else {
	    	self.logger.info('PIN DOWN');
        	self.shutdowngpiosp2.writeSync(1);
    	}

		
        self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
        self.commandRouter.pushToastMessage('Success','Settings', 'saved');
    } else {
        // save port setting to old config
        self.config.set('powerac', old_settingac);

        self.commandRouter.pushToastMessage('Failure','Port not accessible', '');
    }

};

aunacontrol.prototype.saveOptionsGpio = function(data) {
    var self = this;
    var successful3 = true;
    var old_settinggsp1 = self.config.get('gpio_speaker1');
    var old_settinggsp2 = self.config.get('gpio_speaker2');
    var old_settinggsac = self.config.get('gpio_powerac');
   
    // save port setting to our config
    self.logger.info('gpio_speaker1 ' + data['gpio_speaker1']);
    self.logger.info('gpio_speaker2 ' + data['gpio_speaker2']);
    self.logger.info('gpio_powerac ' + data['gpio_powerac']);
        //self.config.set('port', data['port_setting']['value']);
    self.config.set('gpio_speaker1', data['gpio_speaker1']);
    self.config.set('gpio_speaker2', data['gpio_speaker2']);
    self.config.set('gpio_powerac', data['gpio_powerac']);
    // unexport GPIOs before constructing new GPIO object
   self.freeGPIO();
    try{
	   self.ampGPIOInit()
    } catch(err) {
        successful3 = false;
    }
    if(successful3){
        // output message about successful saving to the UI
	self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
        self.commandRouter.pushToastMessage('Success','Settings', 'saved');
    } else {
        // save port setting to old config
        self.config.set('gpio_speaker1', old_settinggsp1);
		self.config.set('gpio_speaker2', old_settinggsp2);
		self.config.set('gpio_powerac', old_settinggsac);
  
        self.commandRouter.pushToastMessage('Failure','Port not accessible', '');
    }

};

aunacontrol.prototype.saveOptionsVolume = function(data) {
    var self = this;
    var successful4 = true;
    var old_settingvol = self.config.get('volume_setting');
	
   
    // save port setting to our config
    self.logger.info('volume_setting ' + data['volume_setting']);
        //self.config.set('port', data['port_setting']['value']);
    self.config.set('volume_setting', data['volume_setting']);
    // unexport GPIOs before constructing new GPIO object
 //  self.freeGPIO();
    try{
//	   self.ampGPIOInit()
    } catch(err) {
        successful4 = false;
    }
    if(successful4){
	    // self.config.get('powerac');
        // output message about successful saving to the UI
        self.logger.info('-----> ' + self.config.get('powerac'));
        volume = self.config.get('volume_setting');

       
        if (self.config.get('powerac')){
	        self.logger.info('Modifico Volume:', data['volume_setting']);
	        socket.emit('getState','');
			socket.once('pushState', self.parseStatus.bind(self));
		self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
	    }
	    else {
		self.logger.info('Volume non modificato AMP spento');
		self.commandRouter.pushToastMessage('error', "Configuration not update", 'The AC power of Amp is Off, Turn on AC before change volume setting');
        
		}
		self.commandRouter.pushToastMessage('Success','Settings', 'saved');
    } else {
        // save port setting to old config
        self.config.set('volume_setting', old_settingvol);
        self.commandRouter.pushToastMessage('Failure','Port not accessible', '');
    }

};


// initialize shutdown port to the one that we stored in the config
aunacontrol.prototype.ampGPIOInit = function() {
    var self = this;

    self.shutdowngpiosp1 = new Gpio(self.config.get('gpio_speaker1'),'out');
    self.shutdowngpiosp2 = new Gpio(self.config.get('gpio_speaker2'),'out');
    self.shutdowngpiopac = new Gpio(self.config.get('gpio_powerac'),'out');
};

// a pushState event has happened. Check whether it differs from the last known status and
// switch output port on or off respectively
aunacontrol.prototype.parseStatus = function(state) {
    var self = this;

    if(state.status=='play'){
        status=state.status;
        self.on();
    } else if((state.status=='pause' || state.status=='stop')){
        status=state.status;
        self.off();
    }
	self.logger.info('^^^^^^^^^^^');
};
// switch outport port on
aunacontrol.prototype.on = function() {
    var self = this;
    var counter = 0;
    self.logger.info('Status ON');
     self.logger.info(volume);
     
     self.logger.info('Abbasso il volume a 0');
     execSync('irsend SEND_START AUNA-amp KEY_VOLUMEDOWN');
     //exec('irsend SEND_START AUNA-amp KEY_VOLUMEDOWN', function(err, stdout, stderr){}); 
      self.logger.info('inizio sleep');
     sleep.sleep(7);
      self.logger.info('fine sleep');
     execSync('irsend SEND_STOP AUNA-amp KEY_VOLUMEDOWN'); 
     sleep.sleep(1);

     
     if ((volume > 0 && volume < 5)) {
	 	 self.logger.info('Set volume: 5'); 
	 	 	while (counter < 3) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };

     if ((volume > 5 && volume < 10)) {
	 	 self.logger.info('Set volume: 10'); 
	 	 	while (counter < 5) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };

	     
	 if ((volume >= 10 && volume < 15)) {
	 	 self.logger.info('Set volume: 15'); 
	 	 	while (counter < 8) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };

	 if ((volume >= 15 && volume < 20)) {
	 	 self.logger.info('Set volume: 20'); 
	 	 	while (counter < 11) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };
	     
	 if ((volume >= 20 && volume < 25)) {
	 	 self.logger.info('Set volume: 25'); 
	 	 	while (counter < 13) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };
	     
	 if ((volume >= 25 && volume < 30)) {
	 	 self.logger.info('Set volume: 30'); 
	 	 	while (counter < 16) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };

	 if ((volume >= 30 && volume < 35)) {
	 	 self.logger.info('Set volume: 35'); 
	 	 	while (counter < 19) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };	     
	     
	 if ((volume >= 35 && volume < 40)) {
	 	 self.logger.info('Set volume: 40'); 
	 	 	while (counter < 22) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };	 
	     
	 if ((volume >= 40 && volume < 45)) {
	 	 self.logger.info('Set volume: 45'); 
	 	 	while (counter < 22) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };	   

	 if ((volume >= 45 && volume < 50)) {
	 	 self.logger.info('Set volume: 50'); 
	 	 	while (counter < 25) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };	   
	    
	 if ((volume >= 50 && volume < 55)) {
	 	 self.logger.info('Set volume: 55'); 
	 	 	while (counter < 28) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };

	 if ((volume >= 55 && volume < 60)) {
	 	 self.logger.info('Set volume: 60'); 
	 	 	while (counter < 30) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };

	 if ((volume >= 60 && volume < 65)) {
	 	 self.logger.info('Set volume: 65'); 
	 	 	while (counter < 33) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };

	 if ((volume >= 65 && volume < 70)) {
	 	 self.logger.info('Set volume: 70'); 
	 	 	while (counter < 36) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };	 

	 if ((volume >= 70 && volume < 75)) {
	 	 self.logger.info('Set volume: 75'); 
	 	 	while (counter < 39) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };	

	 if ((volume >= 75 && volume < 80)) {
	 	 self.logger.info('Set volume: 80'); 
	 	 	while (counter < 41) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };
	     
	 if ((volume >= 80 && volume < 85)) {
	 	 self.logger.info('Set volume: 80'); 
	 	 	while (counter < 44) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };     
	     
	 if ((volume >= 85 && volume < 90)) {
	 	 self.logger.info('Set volume: 90'); 
	 	 	while (counter < 47) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     }; 
	     
	 if ((volume >= 90 && volume < 95)) {
	 	 self.logger.info('Set volume: 95'); 
	 	 	while (counter < 50) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };  

	 if ((volume >= 95 && volume <= 100)) {
	 	 self.logger.info('Set volume: 100'); 
	 	 	while (counter < 52) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };              
	 //exec('/data/plugins/miscellanea/aunacontrol/scripts/volume_setting '+volume+' 1', function(err, stdout, stderr){}); 
	
};

//switch output port off
aunacontrol.prototype.off = function() {
    var self = this;
    var counter = 0;
    self.logger.info('Status OFF');
     self.logger.info(volume);

	 self.logger.info('accendo l amp');
    
     execSync('irsend SEND_ONCE AUNA-amp KEY_POWER'); 
     sleep.sleep(1);

    
     self.logger.info('Abbasso il volume a 0');
          
     
     execSync('irsend SEND_START AUNA-amp KEY_VOLUMEDOWN');
     //exec('irsend SEND_START AUNA-amp KEY_VOLUMEDOWN', function(err, stdout, stderr){}); 
      self.logger.info('inizio sleep');
     sleep.sleep(7);
      self.logger.info('fine sleep');
     execSync('irsend SEND_STOP AUNA-amp KEY_VOLUMEDOWN'); 
     sleep.sleep(1);

     
     if ((volume > 0 && volume < 5)) {
	 	 self.logger.info('Set volume: 5'); 
	 	 	while (counter < 3) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };

     if ((volume > 5 && volume < 10)) {
	 	 self.logger.info('Set volume: 10'); 
	 	 	while (counter < 5) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };

	     
	 if ((volume >= 10 && volume < 15)) {
	 	 self.logger.info('Set volume: 15'); 
	 	 	while (counter < 8) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };

	 if ((volume >= 15 && volume < 20)) {
	 	 self.logger.info('Set volume: 20'); 
	 	 	while (counter < 11) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };
	     
	 if ((volume >= 20 && volume < 25)) {
	 	 self.logger.info('Set volume: 25'); 
	 	 	while (counter < 13) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };
	     
	 if ((volume >= 25 && volume < 30)) {
	 	 self.logger.info('Set volume: 30'); 
	 	 	while (counter < 16) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };

	 if ((volume >= 30 && volume < 35)) {
	 	 self.logger.info('Set volume: 35'); 
	 	 	while (counter < 19) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };	     
	     
	 if ((volume >= 35 && volume < 40)) {
	 	 self.logger.info('Set volume: 40'); 
	 	 	while (counter < 22) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };	 
	     
	 if ((volume >= 40 && volume < 45)) {
	 	 self.logger.info('Set volume: 45'); 
	 	 	while (counter < 22) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };	   

	 if ((volume >= 45 && volume < 50)) {
	 	 self.logger.info('Set volume: 50'); 
	 	 	while (counter < 25) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };	   
	    
	 if ((volume >= 50 && volume < 55)) {
	 	 self.logger.info('Set volume: 55'); 
	 	 	while (counter < 28) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };

	 if ((volume >= 55 && volume < 60)) {
	 	 self.logger.info('Set volume: 60'); 
	 	 	while (counter < 30) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };

	 if ((volume >= 60 && volume < 65)) {
	 	 self.logger.info('Set volume: 65'); 
	 	 	while (counter < 33) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };

	 if ((volume >= 65 && volume < 70)) {
	 	 self.logger.info('Set volume: 70'); 
	 	 	while (counter < 36) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };	 

	 if ((volume >= 70 && volume < 75)) {
	 	 self.logger.info('Set volume: 75'); 
	 	 	while (counter < 39) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };	

	 if ((volume >= 75 && volume < 80)) {
	 	 self.logger.info('Set volume: 80'); 
	 	 	while (counter < 41) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };
	     
	 if ((volume >= 80 && volume < 85)) {
	 	 self.logger.info('Set volume: 80'); 
	 	 	while (counter < 44) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };     
	     
	 if ((volume >= 85 && volume < 90)) {
	 	 self.logger.info('Set volume: 90'); 
	 	 	while (counter < 47) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     }; 
	     
	 if ((volume >= 90 && volume < 95)) {
	 	 self.logger.info('Set volume: 95'); 
	 	 	while (counter < 50) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };  

	 if ((volume >= 95 && volume <= 100)) {
	 	 self.logger.info('Set volume: 100'); 
	 	 	while (counter < 52) {
		 	 	self.logger.info('------');
		 	 	execSync('irsend SEND_ONCE AUNA-amp KEY_VOLUMEUP');
		 	 	counter++;
		 	};
	 	 
	     };
	     
	 self.logger.info('Spengo l amp');
	 sleep.sleep(1);
     execSync('irsend SEND_ONCE AUNA-amp KEY_POWER'); 
     sleep.sleep(1);


//     exec('/data/plugins/miscellanea/aunacontrol/scripts/volume_setting '+volume+' 0', function(err, stdout, stderr){}); 

};

// stop claiming output port
aunacontrol.prototype.freeGPIO = function() {
    var self = this;

    self.shutdowngpiosp1.unexport();
    self.shutdowngpiosp2.unexport();
    self.shutdowngpiopac.unexport();
};
