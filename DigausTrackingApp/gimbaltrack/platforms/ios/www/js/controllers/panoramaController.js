angular.module('starter.controllers')
.controller('PanoramaCtrl', function($scope, $ionicLoading,$rootScope,$timeout, BLEService) {
 

  $scope.settings = {
      HDR: false,
      Pan: false,
      PhotoVideo: false,
      startStopPano: 'Start Panorama',
      startStopVideo: 'Start Video',
      statusGopro: 'Disconnected',
      colorGopro: 'assertive',
      panoColor: 'button-balanced',
      videoColor: 'button-balanced'
  };
  if(BLEService.getPanorama() == true){
    $scope.settings.startStopPano = 'Stop Panorama';
    $scope.settings.panoColor = 'button-assertive';
  }
  if(BLEService.getHDR() == true){
    $scope.settings.HDR = true;
  }
  if(BLEService.getPan() == false){
    $scope.settings.Pan = true;
  }
  if(BLEService.getPhotoVideo() == true){
    $scope.settings.PhotoVideo = true;
    $scope.settings.startStopVideo = 'Take Photo';
    $scope.settings.videoColor = 'button-positive';
  }
  if(BLEService.getVideo() == true){
    $scope.settings.PhotoVideo = false;
    $scope.settings.startStopVideo = 'Stop Video';
    $scope.settings.videoColor = 'button-assertive';
  }

  $scope.setPhotoVideo = function(){
    $scope.settings.PhotoVideo = !($scope.settings.PhotoVideo);
    if($scope.settings.startStopVideo != 'Stop Video'){
      if($scope.settings.startStopPano == 'Start Panorama'){
        BLEService.sendID('PHV');
      }else{
        $ionicLoading.show({
          template: 'Cannot set while Panorama is active!',
          duration: 1500
        });
      }
    }else{
      $ionicLoading.show({
        template: 'Cannot set while Video is active!',
        duration: 1500
      });
    }
  }
  $scope.setPan = function(){      
    $scope.settings.Pan = !($scope.settings.Pan);
    if(BLEService.getTracking()==true){
      $ionicLoading.show({
        template: 'Cannot active Pan while Tracking is active!',
        duration: 1500
      });
    }else{
      BLEService.sendID('PAN');
    }
  }

  $scope.setHDR = function(){
    $scope.settings.HDR = !($scope.settings.HDR);
    BLEService.sendID('HDR'); 
  }
  $scope.center = function(){
    BLEService.sendID('C');
  }
  $scope.startPhoto = function(){
    if($scope.settings.startStopVideo == 'Start Video'){
      if($scope.settings.startStopPano == 'Start Panorama'){
        BLEService.sendID('PH');
      }else{
        $ionicLoading.show({
          template: 'Cannot take Photo while Panorama is active!',
          duration: 1500
        });
      }
    }else{
      $ionicLoading.show({
        template: 'Cannot take Photo while Video is active!',
        duration: 1500
      });
    }
  }
  //Panorama starten
  $scope.startPano = function(){
    if($scope.settings.startStopVideo == 'Take Photo' && BLEService.getTracking()==false && BLEService.getMissionActive()==false){
      BLEService.sendID('P');
    }else{
      if(BLEService.getTracking()==true){
        $ionicLoading.show({
          template: 'Cannot start Panorama while Tracking is active!',
          duration: 1500
        });
      }
      if(BLEService.getMissionActive()==true){
        $ionicLoading.show({
          template: 'Cannot start Panorama while Mission is active!',
          duration: 1500
        });
      }
      if($scope.settings.startStopVideo !='Take Photo'){
        $ionicLoading.show({
          template: 'Can only start Panorama in Photo Mode!',
          duration: 1500
        });
      }
    }
  }

  //Video starten
  $scope.startVideo = function(){
    if($scope.settings.startStopPano == 'Start Panorama'){
      if($scope.settings.startStopVideo != "Take Photo"){
        BLEService.sendID('V');
      }else{
        BLEService.sendID('PH');
      }
    }else{
      $ionicLoading.show({
        template: 'Cannot start Video while Panorama is active!',
        duration: 1500
      });
    }
  }


  checkPano = function(){
    if(BLEService.getPanorama()==true && $scope.settings.startStopPano=='Start Panorama'){
      $ionicLoading.show({
        template: 'Panorama started!',
        duration: 1000
      });
      $scope.settings.startStopPano ='Stop Panorama';
      $scope.settings.panoColor = 'button-assertive';
    }else{
      if(BLEService.getPanorama()==false && $scope.settings.startStopPano=='Stop Panorama'){
        $ionicLoading.show({
          template: 'Panorama stopped!',
          duration: 1000
        });
        $scope.settings.startStopPano = 'Start Panorama';
        $scope.settings.panoColor = 'button-balanced';
      }
    }
  }

  checkVideo = function(){
    if(BLEService.getVideo()==true && $scope.settings.startStopVideo=='Start Video'){
      $ionicLoading.show({
        template: 'Video started!',
        duration: 1000
      });
      $scope.settings.startStopVideo='Stop Video';
      $scope.settings.videoColor = 'button-assertive';
    }else{
      if(BLEService.getVideo()==false && $scope.settings.startStopVideo=='Stop Video'){
        $ionicLoading.show({
          template: 'Video stopped!',
          duration: 1000
        });
        $scope.settings.startStopVideo = 'Start Video';
        $scope.settings.videoColor = 'button-balanced';
      }
    }
  }

  checkHDR = function(){
    if(BLEService.getHDR() == true && $scope.settings.HDR == false){
      $ionicLoading.show({
        template: 'HDR activated!',
        duration: 1000
      });
      $scope.settings.HDR = true;
    }else{
      if(BLEService.getHDR() == false && $scope.settings.HDR == true){
        $ionicLoading.show({
          template: 'HDR disabled!',
          duration: 1000
        });
        $scope.settings.HDR = false;
      }
    }
   }
  checkPan = function(){
    if(BLEService.getPan() == false && $scope.settings.Pan == false){
      $ionicLoading.show({
        template: 'Pan activated!',
        duration: 1000
      });
      $scope.settings.Pan = true;
    }else{
      if(BLEService.getPan() == true && $scope.settings.Pan == true){
        $ionicLoading.show({
          template: 'Hold activated!',
          duration: 1000
        });
        $scope.settings.Pan = false;
      }
    }
  }
  checkPhotoVideo = function(){
    if(BLEService.getPhotoVideo() == true && $scope.settings.PhotoVideo == false){
      $ionicLoading.show({
        template: 'Photo activated!',
        duration: 1000
      });
      $scope.settings.startStopVideo = 'Take Photo'
      $scope.settings.PhotoVideo = true;
      $scope.settings.videoColor = 'button-positive';

    }else{
      if(BLEService.getPhotoVideo() == false && $scope.settings.PhotoVideo == true){
        $ionicLoading.show({
          template: 'Video activated!',
          duration: 1000
        });
        $scope.settings.startStopVideo = 'Start Video'
        $scope.settings.PhotoVideo = false;
        $scope.settings.videoColor = 'button-balanced';
      }
    }
  }
  checkGopro = function(){
    if(BLEService.getGopro() == true){
      $scope.settings.statusGopro = 'Connected'
      $scope.settings.colorGopro = 'balanced';
    }else{
      $scope.settings.statusGopro = 'Disconnected'
      $scope.settings.colorGopro = 'assertive';
    }
  }
  $rootScope.checkAllPano = function(){
    $timeout(function(){
      checkPano();
      checkVideo();
      checkHDR();
      checkPan();
      checkPhotoVideo();
      checkGopro();
      console.log('Pano');
    });
  }
  
  $rootScope.checkAllPano();
  BLEService.pano();
})
