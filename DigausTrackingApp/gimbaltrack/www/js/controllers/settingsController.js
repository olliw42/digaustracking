angular.module('starter.controllers')
.controller('SettingsCtrl', function($scope,$ionicLoading,$timeout,$rootScope,$timeout, BLEService, Markers) {
  var devices = [];

  $scope.data = {
    selectedDevice: null,
    externGPS: false,
    pitch: 0,
    yaw: 0,
    performance: false,
    lowVoltage: 15
  }
  $scope.get = {
    devices: devices,
    statusBLE: 'Connect',
    statusColor: 'button-balanced'
  }
  if(BLEService.getStatus()==true){
    $scope.get.statusBLE = 'Disconnect';
    $scope.get.statusColor = 'button-assertive';
  }
  $scope.yawPlus = function(){
    if($scope.data.yaw<=49){
      $scope.data.yaw++;
      $scope.save();
    }
  }
  $scope.yawMinus = function(){
    if($scope.data.yaw>=-49){
      $scope.data.yaw--;
      $scope.save();
    }
  }
  $scope.pitchPlus = function(){
    if($scope.data.pitch<=49){
      $scope.data.pitch++;
      $scope.save();
    }
  }
  $scope.pitchMinus = function(){
    if($scope.data.pitch>=-49){
      $scope.data.pitch--;
      $scope.save();
    }
  }
  $scope.voltagePlus = function(){
    if($scope.data.lowVoltage<=19.9){
      $scope.data.lowVoltage = ($scope.data.lowVoltage*10+0.1*10)/10;
      $scope.save();
    }
  }
  $scope.voltageMinus = function(){
    if($scope.data.lowVoltage>=10.1){
      $scope.data.lowVoltage = ($scope.data.lowVoltage*10-0.1*10)/10;
      $scope.save();
    }
  }
  //Bei jedem ändern der Settings diese abspeichern
  $scope.save = function(){
    window.localStorage['Settings'] = JSON.stringify($scope.data);
    Markers.setPerformance($scope.data.performance);
    Markers.setExternGPS($scope.data.externGPS);
    Markers.setLowVoltage($scope.data.lowVoltage);
    BLEService.sendAllSettings();
  }
  

  $scope.getDevices = function(){
    getAllDevices();
  }

  //Verbinden/Trennen der Verbinung mit dem ausgewählten Device
  $scope.connect = function(device){
    if($scope.get.statusBLE == 'Connect'){
      BLEService.startBLE(device);
    }else{
      bluetoothSerial.disconnect(function(){
        BLEService.setConnected(false);
      }, function(){
        alert(device.id + 'Disonnection failed');
      })    
    }
  }
  getAllDevices = function(){
    bluetoothSerial.isEnabled(
      function() {
        bluetoothSerial.list(
          function(result) { 
            $timeout(function(){
              $scope.get.devices = result;
            });
          },
          function(error) {
            $ionicLoading.show({
              template: 'Error getting devices!',
              duration: 1500
            }); 
          }
        );      
      },
      function() {
        bluetoothSerial.enable(
          function() {
            bluetoothSerial.list(
              function(result) { 
                $timeout(function(){
                  $scope.get.devices = result;
                });
              },
              function(error) {
                $ionicLoading.show({
                  template: 'Error getting devices!',
                  duration: 1500
                });   
              }
            );
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
  }
   //Überprüft alle 500ms ob noch eine Verbindung besteht um den Connect Button anzupassen
  $rootScope.checkAllSettings = function(){
    $timeout(function(){
      if(BLEService.getStatus()==true && $scope.get.statusBLE == 'Connect'){      
        $scope.get.statusBLE = 'Disconnect';
        $scope.get.statusColor = 'button-assertive';
      }
      if(BLEService.getStatus()==false && $scope.get.statusBLE == 'Disconnect'){
        $scope.get.statusBLE = 'Connect';
        $scope.get.statusColor = 'button-balanced';
        $ionicLoading.show({
          template: 'Disconnected!',
          duration: 1000
        });    
      }
      console.log('Settings');
    });
  }

    //Settings aus dem LocalStorage laden
  if(JSON.parse(window.localStorage['Settings'] || null)!=null){
    $timeout(function(){
      $scope.data = JSON.parse(window.localStorage['Settings'] || null);
      $scope.data.selectedDevice = JSON.parse(window.localStorage['bleDevice'] || null);
      $scope.get.devices.push($scope.data.selectedDevice);
    });
  }

  $rootScope.checkAllSettings();
  BLEService.settings();
  getAllDevices();
});
