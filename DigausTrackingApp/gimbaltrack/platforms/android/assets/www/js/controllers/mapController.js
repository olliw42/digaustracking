angular.module('starter.controllers')
.controller('MapCtrl', function($scope,$state,$timeout, $cordovaGeolocation, $ionicPopup, $ionicLoading, $rootScope,MapService, Markers, BLEService, Logs) {
  $scope.startStop = 'Start Tracking';
  $scope.startStopLog = 'Start Log';
  $scope.missions = Markers.allMissions();
  $scope.copterColor = 'assertive';
  $scope.copterStatus = 'Disconnected';
  $scope.poi = 'button button-clear icon ion-ios-eye button-positive';
  $scope.wp = 'button button-clear icon ion-ios-navigate-outline';
  $scope.buttonCopter = '';
  $scope.buttonPos = '';
  $scope.buttonAll = '';

  var posActive = false;
  var allActive = false;
  var copterActive = false;

  var myPopup;
  var missionActive = false;
  //Zur überprüfung ob POI oderWp zum hinzufügen ausgewählt wurde
  $scope.setPOI = function(){
    MapService.setMarker('POI');
    if($scope.poi != 'button button-clear icon ion-ios-eye button-positive'){
      $scope.poi = 'button button-clear icon ion-ios-eye button-positive';
      $scope.wp = 'button button-clear icon ion-ios-navigate-outline';
    }
  }
  $scope.setWP = function(){
    MapService.setMarker('WP');
    if($scope.wp != 'button button-clear icon ion-ios-navigate button-positive'){
      $scope.wp = 'button button-clear icon ion-ios-navigate button-positive';
      $scope.poi = 'button button-clear icon ion-ios-eye-outline';
    }
  }

  $scope.onTouchPos = function(){
    $scope.buttonPos='button-dark';
  }

  $scope.onTouchCopter = function(){
    $scope.buttonCopter='button-dark';
  }
  $scope.onTouchAll = function(){
    $scope.buttonAll='button-dark';
  }

  $scope.onReleasePos = function(){
    if(posActive==false){
      $scope.buttonPos='';
    }
  }

  $scope.onReleaseCopter = function(){
  if(copterActive==false){
      $scope.buttonCopter='';
    }
  }
  $scope.onReleaseAll = function(){
    if(allActive==false){
      $scope.buttonAll='';
    }
  }
  $scope.allHold = function(){
    if(allActive==false){
      $scope.buttonAll='button-dark';
      $scope.buttonCopter='';
      $scope.buttonPos='';
      allActive = true;
      copterActive = false;
      posActive = false;
      Markers.followAll(true);
    }else{
      $scope.buttonAll='';
      allActive = false;
      Markers.followAll(false);
    }
  }
  $scope.posHold = function(){
    if(posActive==false){
      $scope.buttonPos='button-dark';
      $scope.buttonCopter='';
      $scope.buttonAll='';
      posActive = true;
      copterActive = false
      allActive = false;
      Markers.followPos(true);
    }else{
      $scope.buttonPos='';
      posActive = false;
      Markers.followPos(false);
    }
  }
  $scope.copterHold = function(){
    if(copterActive==false){
      $scope.buttonCopter='button-dark';
      $scope.buttonPos='';
      $scope.buttonAll='';
      posActive = false;
      copterActive = true;
      allActive = false;
      Markers.followCopter(true);
    }else{
      $scope.buttonCopter='';
      copterActive = false;
      Markers.followCopter(false);
    }
  }
  $scope.centerAll = function(){
    Markers.setCenterAll($scope.map);
  }
  $scope.centerCopter = function(){
    Markers.setCenterCopter($scope.map);
  }
  $scope.center = function(){
    Markers.setCenterPos($scope.map);
  }
  //Seitenmenu als Popup mit mehreren funktionen
  $scope.sidemenu = function(){
    myPopup = $ionicPopup.show({
      template: '<button ng-click="start()" class="button  button-full ">{{startStop}}</button>'+
                '<button ng-click="startLog()" class="button  button-full ">{{startStopLog}}</button>'+
                '<button ng-click="upload()" class="button  button-full ">Upload</button>'+
                '<button ng-click="save()" class="button  button-full ">Save</button>'+
                '<button ng-click="load()" class="button  button-full ">Load/Delete</button>',
      title: 'Mission',
      scope: $scope,
      buttons: [
        {
          text: '<b>Done</b>',
          type: 'button-positive',
        }
      ]
    });
  };

  //Remove aufrufen, zu löchender Marker wird im Service bestimmt
  $scope.delete =function(){
    Markers.remove($scope.map);
  };

  //Mission abspeichern, mapübergebn um Zoom abfragen zu können
  $scope.save = function(){
    Markers.save($scope.map);
    myPopup.close();
    $ionicLoading.show({
      template: 'Mission saved!',
      duration: 1500
    });
  };

  //Popup zum auswählen der zu ladenen Mission
  $scope.load = function(){
    myPopup.close();
    myPopup = $ionicPopup.show({
      template: '<ion-list>'+
                  '<ion-item ng-click = "loadMission(mission)" class="item-remove-animate item-icon-right" ng-repeat="mission in missions" type="item-text-wrap">'+
                    '<h2>{{mission.date}}</h2>'+
                    '<p>{{mission.time}}</p>'+
                    '<i class="icon ion-chevron-right icon-accessory"></i>'+
                    '<ion-option-button class="button-assertive" ng-click="removeMission(mission)">'+
                      'Delete'+
                    '</ion-option-button>'+
                  '</ion-item>'+
                '</ion-list>',
      title: 'Load/Delete Mission',
      scope: $scope,
      buttons: [
        {
          text: '<b>Cancel</b>',
          type: 'button-positive',
        }
      ]
    });
  };

  //Mission laden
  $scope.loadMission = function(mission){
    if($scope.startStop == 'Start Tracking' && $scope.startStopLog == 'Start Log' && missionActive==false){
      Markers.load($scope.map,mission);
      myPopup.close();
      $ionicLoading.show({
        template: 'Mission loaded!',
        duration: 1500
      });
    }else{
      if(missionActive==true){
        $ionicLoading.show({
          template: 'Cannot load Mission while Mission is active!',
          duration: 1500
        });
      }
      if($scope.startStop == 'Stop Tracking'){
        $ionicLoading.show({
          template: 'Cannot load Mission while Tracking is active!',
          duration: 1500
        });
      }
      if($scope.startStopLog == 'Stop Log'){
        $ionicLoading.show({
          template: 'Cannot load Mission while Log is active!',
          duration: 1500
        });
      }
    }
  }
  //Mission löschen
  $scope.removeMission = function(mission){
    Markers.removeMission(mission);
  }

  //Log starten
  $scope.startLog = function(){
    if($scope.startStopLog =='Start Log'){
      Markers.startLog();
      MapService.startLog();
      $scope.startStopLog= 'Stop Log';
      myPopup.close();
      $ionicLoading.show({
        template: 'Logging data started!',
        duration: 1500
      });
      Logs.start($scope.map);
    }else{
      Markers.stopLog();
      MapService.stopLog();
      $scope.startStopLog = 'Start Log';
      myPopup.close();
      $ionicLoading.show({
        template: 'Logging data stopped!',
        duration: 1500
      });
      Logs.stop();
    }
  };

 


  $scope.start = function(){ 
    myPopup.close();
    if(missionActive==false){
      BLEService.sendID('T');
    }else{ 
      $ionicLoading.show({
        template: 'Cannot start Tracking while Mission is active!',
        duration: 1500
      });
    }
  };
  
  //Popup um Mission zum hochladen auszuwählen
  $scope.upload = function(){
    myPopup.close();
    myPopup = $ionicPopup.show({
      template: '<ion-list>'+
                  '<ion-item ng-click = "uploadMission(mission)" class="item-icon-right" ng-repeat="mission in missions" type="item-text-wrap">'+
                    '<h2>{{mission.date}}</h2>'+
                    '<p>{{mission.time}}</p>'+
                    '<i class="icon ion-chevron-right icon-accessory"></i>'+
                  '</ion-item>'+
                '</ion-list>',
      title: 'Upload Mission',
      scope: $scope,
      buttons: [
        {
          text: '<b>Cancel</b>',
          type: 'button-positive',
        }
      ]
    });
    
  };

  //Ausgewählte Mission hochladen
  $scope.uploadMission = function(mission){
    if($scope.startStop == 'Start Tracking' && missionActive==false){
      $ionicLoading.show({
        template: 'Uploading Mission!'
      });
      BLEService.uploadMission(mission);
      myPopup.close();
    }else{
      if(missionActive == true){
        $ionicLoading.show({
          template: 'Cannot upload Mission while Mission is active!',
          duration: 1500
        });
      }else{
        $ionicLoading.show({
          template: 'Cannot upload while Tracking is active!',
          duration: 1500
        });
      }
    }
  }
  checkTrack = function(){
    if(BLEService.getTracking()==true && $scope.startStop=='Start Tracking'){
      BLEService.sendPosTmp();
      Markers.startTrack();
      MapService.startTrack();
      $ionicLoading.show({
          template: 'Tracking started!',
          duration: 1500
      });
      $scope.startStop = 'Stop Tracking';
    }else{
      if(BLEService.getTracking()==false && $scope.startStop=='Stop Tracking'){
        Markers.stopTrack();
        MapService.stopTrack();
        $ionicLoading.show({
          template: 'Tracking stopped!',
          duration: 1500
        });
        $scope.startStop = 'Start Tracking';
      }
    }
  }

  checkMission = function(){
    var mission = null;
    if(BLEService.getMissionActive()==true && missionActive==false){
      for(var i=0;i<$scope.missions.length;i++){
        if($scope.missions[i].id==BLEService.getMission()){
          mission = $scope.missions[i];
          Markers.load($scope.map,mission);
        }
      }
      Markers.startTrack();
      MapService.startTrack();
      missionActive = true;
      if(mission!=null){
        $ionicLoading.show({
          template: 'Mission started!',
          duration: 1500
        });
      }else{
        $ionicLoading.show({
          template: 'Started unkown Mission!',
          duration: 1500
        });
      }
    }else{
      if(BLEService.getMissionActive()==false && missionActive==true){
        Markers.stopTrack();
        MapService.stopTrack();
        $ionicLoading.show({
          template: 'Mission stopped!',
          duration: 1500
        });
        missionActive = false;
      }
    }
  }

  checkCopter = function(){
    if(BLEService.getCopter() == true){
      $scope.copterStatus = 'Connected';
      $scope.copterColor = 'balanced';
      Markers.setConnected(true);
    }else{
      $scope.copterStatus = 'Disconnected';
      $scope.copterColor = 'assertive';
      Markers.setConnected(false);
    }
  }

  $rootScope.checkAllMap = function(){
    $timeout(function(){
      checkTrack(); 
      checkMission();
      checkCopter();
      console.log('Map');
    });
  }
  //Map initialisiern und laden
  ionic.Platform.ready(function(){ 
    if(BLEService.getMap()==false){
      BLEService.map();
	    var map = MapService.initMap();
	    Markers.initPosition(map);
	    map = Markers.setCopterPos(map);
	    map = Markers.watchPos(map);
	    Markers.checkDataFromBLE(map);
	    $scope.map = map;   
	    $rootScope.checkAllMap();  
	    $timeout(function(){
	      var copterStatus = document.getElementById('copter');
	      var centerCtrl = document.getElementById('center');
	      var centerAllCtrl = document.getElementById('centerAll');
	      var centerCopterCtrl = document.getElementById('centerCopter');
	      map.controls[google.maps.ControlPosition.TOP_CENTER].push(copterStatus);
	      map.controls[google.maps.ControlPosition.RIGHT].push(centerCtrl);
	      map.controls[google.maps.ControlPosition.RIGHT].push(centerCopterCtrl);
	      map.controls[google.maps.ControlPosition.RIGHT].push(centerAllCtrl);
	    });
	    BLEService.startBLE(null);
	    window.plugins.insomnia.keepAwake();
	 }
  });
  
  $scope.reloadMap = function(){
    if(BLEService.getMap()==true){ 
      console.log('MapsCtrl');
      $timeout(function(){
        var center = $scope.map.getCenter();
        google.maps.event.trigger($scope.map, "resize");
        $scope.map.setCenter(center);
      });
    }
  }
  
})