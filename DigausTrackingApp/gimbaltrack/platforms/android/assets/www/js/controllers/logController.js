angular.module('starter.controllers')
.controller('LogCtrl', function($scope,$timeout,$rootScope, Logs) {
  $scope.logs = Logs.all();
  $scope.mapFooterHide = true;
  $scope.logHide = false;
  $scope.startStop = 'Play';
  $scope.buttonCopter = '';
  $scope.buttonPos = '';
  $scope.buttonAll = '';
  var loaded = false;
  var posActive = false;
  var copterActive = false;
  var allActive = false;

  $scope.time = '00:00';

  $rootScope.seconds = function(time){
    calcTime(time*100);
  }
  calcTime = function(millis){
    var minutes = Math.floor(millis / 60000);
    var seconds = ((millis % 60000) / 1000).toFixed(0);
    $scope.time = (minutes < 10 ? '0' : '') + minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
  }

  $scope.playSpeed = function(){
    if($scope.startStop=='Stop'){
      Logs.forward();
    }
  }  
  $scope.backSpeed = function(){
    if($scope.startStop=='Stop'){
      Logs.backward();
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
      Logs.followAll(true);
    }else{
      $scope.buttonAll='';
      allActive = false;
      Logs.followAll(false);
    }
  }
  $scope.posHold = function(){
    if(posActive==false){
      $scope.buttonPos='button-dark';
      $scope.buttonCopter='';
      $scope.buttonAll='';
      posActive = true;
      copterActive = false;
      allActive = false;
      Logs.followPos(true);
    }else{
      $scope.buttonPos='';
      posActive = false;
      Logs.followPos(false);
    }
  }
  $scope.copterHold = function(){
    if(copterActive==false){
      $scope.buttonCopter='button-dark';
      $scope.buttonPos='';
      $scope.buttonAll='';
      posActive = false;
      allActive = false;
      copterActive = true;
      Logs.followCopter(true);
    }else{
      $scope.buttonCopter='';
      copterActive = false;
      Logs.followCopter(false);
    }
  }
  $scope.centerAll = function(){
    Logs.setCenterAll($scope.mapLogs);
    $scope.buttonAll='';
  }
  $scope.centerCopter = function(){
    Logs.setCenterCopter($scope.mapLogs);
    if(copterActive==false){
      $scope.buttonCopter='';
    }
  }
  $scope.center = function(){
    Logs.setCenterPos($scope.mapLogs);
    if(posActive==false){
      $scope.buttonPos='';
    }
  }
  //Log löschen
  $scope.remove = function(log) {
    Logs.remove(log);
  };

  //Map und Footer wird sichtbar gemacht wenn ein Log ausgewählt wurde zudem wird der Log geladen
  $scope.showMap = function(log){
    $scope.mapFooterHide = false;
    $scope.logHide = true;
    $scope.time = '00:00';

      //Map laden
    if(loaded==false){
      ionic.Platform.ready(function(){ 
        var mapLogs = Logs.initMap();
        $scope.mapLogs=mapLogs;
        $timeout(function(){
          var centerAllCtrlLog = document.getElementById('centerAllLog');
          var centerCopterCtrlLog = document.getElementById('centerCopterLog');
          var centerCtrlLog = document.getElementById('centerPosLog');
          mapLogs.controls[google.maps.ControlPosition.RIGHT].push(centerCtrlLog);
          mapLogs.controls[google.maps.ControlPosition.RIGHT].push(centerCopterCtrlLog);
          mapLogs.controls[google.maps.ControlPosition.RIGHT].push(centerAllCtrlLog);
        });
      }); 
    }
    loaded = true;
    Logs.loadLog(log);
    $timeout(function(){
      google.maps.event.trigger($scope.mapLogs, "resize");
      Logs.setCenterAll($scope.mapLogs);
    },100);
  };

  //Wenn zurück werden Map und Footer wieder versteckt und Rest sichtbar
  $scope.back = function(){
    $scope.mapFooterHide = true;
    $scope.logHide = false;
    $scope.startStop = 'Play';
    Logs.stopPlay();
  };

  //Log wird abgespielt
  $scope.play = function(){
    if($scope.startStop=='Play'){
      $scope.startStop = 'Stop';
      Logs.play();
    }else{
      $scope.startStop = 'Play';
      Logs.stopPlay(); 
    }
  }

  $rootScope.checkEndLog = function(){
    minutes = 0;
    seconds = 0;
    $scope.time = '00:00';
    $timeout(function(){
      if(Logs.getStatus()==true){
        $scope.startStop = 'Play';
      }
    });
  }


  
  $scope.reloadMapLogs = function(){
    console.log('LogCtrl');
    if(loaded == true){
      $timeout(function(){
        var center = $scope.mapLogs.getCenter();
        google.maps.event.trigger($scope.mapLogs, "resize");
        $scope.mapLogs.setCenter(center);
      });
    }
  }

})
