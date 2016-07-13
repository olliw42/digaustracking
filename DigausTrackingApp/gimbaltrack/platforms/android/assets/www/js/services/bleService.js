angular.module('starter.services')
.factory('BLEService',['$ionicLoading','$timeout','$rootScope',function($ionicLoading,$timeout,$rootScope) {

  //Falls man schonmal ein Device zum verbinden gewählt hat dieses aus dem LocalStorage laden
  var selectedDevice = JSON.parse(window.localStorage['bleDevice'] || null);
  var markerTmp = null;
  var isConnected = false;
  var processedData = [];
  var sending = false;
  var success = false;
  var counter = 0;
  var tracking = false;
  var video = false;
  var panorama = false;
  var pan = true;
  var HDR = false;
  var photoVideo = false;
  var gopro = false;
  var copter = false;
  var missionActive = false;
  var missionID = 0;

  var pano = false;
  var settings = false;
  var map = false;

  //Datenobjekt für Daten vom Tracking Device
  var BLEData = {
    posLat: 0,
    posLng: 0,
    sats: 0,
    posHeight: 0,
    copterLat: 0,
    copterLng: 0,
    copterHeight: 0,
    copterVoltage: 0,
    copterHeading: 0,
    gimbalHeading: 0
  };
  

  //Daten setzen nur falls korrekt emfangen wurde! (checksum wird am Ende mitgeschickt)
  processData = function(recieved){
    var checksum = 0;
    processedData = recieved.split(';');
    if(processedData[20]=='S'){
      success = true;
    }
    if(processedData.length<=22){
      for(var i=0;i<processedData.length-1;i++){
        checksum += getChecksum(processedData[i]);
      }
    }
    if(checksum == parseInt(processedData[21])){
      BLEData.posLat = processedData[0];
      BLEData.posLng = processedData[1];
      BLEData.sats = processedData[2];
      BLEData.posHeight = processedData[3];
      BLEData.copterLat = processedData[4];
      BLEData.copterLng = processedData[5];
      BLEData.copterHeight = processedData[6];
      BLEData.copterVoltage = processedData[7];
      BLEData.copterHeading = processedData[8];
      BLEData.gimbalHeading = processedData[9];
      missionActive = charToBoolean(processedData[10]);
      missionID = charToBoolean(processedData[11]);
      tracking = charToBoolean(processedData[12]);
      panorama = charToBoolean(processedData[13]);
      video = charToBoolean(processedData[14]);
      HDR = charToBoolean(processedData[15]);
      pan = charToBoolean(processedData[16]);
      photoVideo = charToBoolean(processedData[17]);
      gopro = charToBoolean(processedData[18]);
      copter = charToBoolean(processedData[19]);
      if(copter == false){
        gopro = false;
      }
    }else{
      //alert('Checksum not correct: ' + checksum +'; '+parseInt(processedData[20]));
    }
    if(map==true){
      $rootScope.checkAllMap();
    }     
    if(pano==true){
      $rootScope.checkAllPano();
    }
    $rootScope.checkAllCopter();
  }


  charToBoolean = function(char){
      switch(char){
          case "1": return true;
          case "0": return false;
          default: return false;
      }
  }



  //Settings werden gesendet
  sendSettings = function(){
    var settings = JSON.parse(window.localStorage['Settings'] || null);
    if(settings==null){
      settings = {
        pitch: 0,
        yaw: 0,
      }
    }
    var data = 'S;' + settings.pitch  + ';' + settings.yaw + '\n';
    sendToBLE(data);
  }

  //Versuchen zum BLE zu verbinden
  startBLE = function(device){
    $ionicLoading.show({
      template: 'Connecting...'
    });
    if(device == null){
      device = JSON.parse(window.localStorage['bleDevice'] || null);
    }
    if(device == null){
      $ionicLoading.hide();
      $ionicLoading.show({
        template: 'No Bluetooth device selected!',
        duration: 1500
      });        
    }else{
      bluetoothSerial.isConnected( 
        function() {
          $ionicLoading.hide();
          $ionicLoading.show({
            template: 'Already connected!',
            duration: 1500
          });               
        },
        function() {
          bluetoothSerial.connect(device.id, function(){
            $ionicLoading.hide();
            $ionicLoading.show({
              template: 'Connection successful!',
              duration: 1500
            });         
            isConnected = true;     
            selectedDevice = device;
            window.localStorage['bleDevice'] = JSON.stringify(device);
            
            //Notification zum emfangen von Daten starten              

            bluetoothSerial.subscribe('\n',function (data) {
              processData(data);
            },function(error) {
                alert('Error getting Data');
            });   
            //Settings nach erfolgreichem verbinden rüber senden
            sendSettings();
            if(settings==true){
              $rootScope.checkAllSettings();
            }

          }, function(error){
            $ionicLoading.hide();
            isConnected = false;
            copter = false;
            gopro = false;
            $ionicLoading.show({
              template: 'Connection failed/lost!',
              duration: 1000
            });   
            if(map==true){
              $rootScope.checkAllMap();
            }     
            if(settings==true){
              $rootScope.checkAllSettings();
            }
            if(pano==true){
              $rootScope.checkAllPano();
            }
          });
        }
      );
    }
    if(settings==true){
      $rootScope.checkAllSettings();
    }
  }

  //String zum senden in ein ByteArray umwandeln
  sendToBLE = function(data){
    var counterSuccess;    

    if(data.indexOf("M") < 0){
      counterSuccess = 60;
    }else{
      counterSuccess = 200;
    }

    sending = true;
    if(counter == 0){
      success = false;
      if(data.indexOf("POS") < 0 && data.indexOf("TD") < 0 && data.indexOf("S") < 0){
        $ionicLoading.show({
          template: 'Sending...',
        });
      } 
      bluetoothSerial.write(data, function(){}, function(error){
        alert('Failed to send'+ JSON.stringify(error));
      }); 
    }

    //Wird bis zum 3 mal versucht zu senden, falls nicht erfolgreich war (success, siehe oben)
    $timeout(function(){
      if(success==false){
        counter++;
        if(counter<counterSuccess){
          sendToBLE(data);
        }else{
          counter = 0;
          sending = false;
          $ionicLoading.hide();
          if(data.indexOf("POS") < 0 && data.indexOf("TD") < 0 && data.indexOf("S") < 0){
            $ionicLoading.show({
              template: 'Error sending Data!',
              duration: 1500
            }); 
          }       
        }
      }else{        
        counter = 0;
        sending = false;
        success = false;
        if(data.indexOf("POS") < 0 && data.indexOf("TD") < 0 && data.indexOf("S") < 0){
          $ionicLoading.show({
            template: 'Sending successful!',
            duration: 1500
          });    
        }
      }
    },50);
   
  }
 
  getChecksum = function(data){
    var checksum = 0;
    for(var i=0; i<data.length;i++){
      if(data.charAt(i)!=';'){
        checksum+=data.charCodeAt(i);
      }
    }
    return checksum;
  }
   
  return {
    getMap: function(){
      return map;
    },
    map: function(){
      map = true;
    },
    settings: function(){
      settings = true;
    },
    pano: function(){
      pano = true;
    },
    getMission: function(){
      return missionID;
    },
    getMissionActive: function(){
      return missionActive;
    },
    getCopter: function(){
      return copter;
    },
    getGopro: function(){
      return gopro;
    },
    getPhotoVideo: function(){
      return photoVideo;
    },
    getPan: function(){
      return pan;
    },
    getHDR: function(){
      return HDR;
    },
    getPanorama: function(){
      return panorama;
    },
    getVideo: function(){
      return video;
    },
    getTracking: function(){
      return tracking;
    },
    sendAllSettings: function(){
      if(isConnected==true && sending == false){
        sendSettings();
      }else{
        $ionicLoading.hide();
      }
    },
    getData: function(){
      return BLEData;
    },
    setConnected: function(connected){
      isConnected = connected;
      copter = false;
      gopro = false;
      if(settings==true){
        $rootScope.checkAllSettings();
      }
    },
    //Mission passend formatieren und hochladen
    uploadMission: function(mission){

      var loadPOIs = mission.pois;
      var loadWaypoints = mission.wps;
      var loadTrack = mission.track;
      var checksum = 0;

      var mission = 'M;'+mission.id +'\n';
      var pois ='POI;' + loadPOIs.length + ';';
      for(var i=0;i<loadPOIs.length;i++){
        pois = pois + parseInt(loadPOIs[i].lat*1000000) +','+ parseInt(loadPOIs[i].lng*1000000) +','+ loadPOIs[i].height +';';
      }
      checksum = getChecksum(pois);

      pois = pois + checksum + '\n';
    
      var wps = 'WP;' + loadWaypoints.length + ';';
      for(var i=0;i<loadWaypoints.length;i++){
        wps = wps + parseInt(loadWaypoints[i].lat*1000000) +','+ parseInt(loadWaypoints[i].lng*1000000) +','+ loadWaypoints[i].height +','+ loadWaypoints[i].time +','+ loadWaypoints[i].selectedPosition +';';
      }
      checksum = getChecksum(wps);

      wps = wps + checksum + '\n';
      if(isConnected==true && sending == false){
        sendToBLE(mission+pois+wps);      
      }else{
        $ionicLoading.hide();
        if(isConnected == false){
          $ionicLoading.show({
            template: 'No BLE device connected!',
            duration: 1500
          });        
        }
      }
    },
    sendID: function(id){
      if(isConnected==true && sending == false){
        sendToBLE(id+'\n');
      }else{
        $ionicLoading.hide();
        if(isConnected == false){
          $ionicLoading.show({
            template: 'No BLE device connected!',
            duration: 1500
          });        
        }
      }    
    },
    getStatus: function(){
      return isConnected;
    },
    startBLE: function(device){
      bluetoothSerial.isEnabled(
        function() {
          startBLE(device);
        },
        function() {
          bluetoothSerial.enable(
            function() {
              startBLE(device);
            },
            function() {
              $ionicLoading.show({
                template: 'Error enableing Bluetooth!',
                duration: 1500
              });          
            }
          );
        }
      ); 
    },
    sendPosTmp: function(){
      if(tracking==true&&markerTmp!=null){
        var lat = parseInt(markerTmp.position.lat()*1000000);
        var lng = parseInt(markerTmp.position.lng()*1000000);
        var height = markerTmp.info.content.height;
        var data = 'POS;'+ lat + ';' + lng + ';' + height + ';';
        var checksum = getChecksum(data);
        if(isConnected==true && sending == false){
          sendToBLE(data + checksum + '\n');
        }else{
          $ionicLoading.hide();
        }
      }    
    },
    //Position formatieren und senden
    sendPos: function(marker){
      markerTmp=marker;
      if(tracking==true){
        var lat = parseInt(marker.position.lat()*1000000);
        var lng = parseInt(marker.position.lng()*1000000);
        var height = marker.info.content.height;
        var data = 'POS;'+ lat + ';' + lng + ';' + height + ';';
        var checksum = getChecksum(data);
        if(isConnected==true && sending == false){
          sendToBLE(data + checksum + '\n');
        }else{
          $ionicLoading.hide();
        }
      }    
    },
    sendTrack: function(marker){
      markerTmp=marker;
      if(tracking==true){
        var settings = JSON.parse(window.localStorage['Settings'] || null);
        if(settings==null){
          settings = {
            externGPS: false,
          }
        }
        var lat = parseInt(marker.position.lat()*1000000);
        var lng = parseInt(marker.position.lng()*1000000);
        var height = marker.info.content.height;
        var data = 'POS;'+ lat + ';' + lng + ';' + height + ';';
        var checksum = getChecksum(data);
        if(isConnected==true && sending == false){
          if(settings.externGPS == false){
            sendToBLE(data + checksum + '\n');
          }else{
            sendToBLE('TD\n');
          }
        }else{
          $ionicLoading.hide();
        }    
      }
    },
  }
}])
