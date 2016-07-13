angular.module('starter.services')
.factory('MapService',  ['$cordovaGeolocation','$rootScope','Markers','BLEService',function($cordovaGeolocation,$rootScope,Markers,BLEService) {
  var log = false;
  var started = false;
  var selectedMarker = 'POI';
  init = function(){
    
    var myLatlng = new google.maps.LatLng(0,0);
    var mapOptions = {
      center: myLatlng,
      zoom: 2,
      disableDefaultUI: true,
      mapTypeId: google.maps.MapTypeId.SATELLITE
    }
    var map = new google.maps.Map(document.getElementById("map"), mapOptions);     
    map.addListener('click', function(event) {
      //falls Log/Mission gestartet wurde hinzufügen von POIs und WPs verhindern
      if(log==false && started == false){
        var myLatlng = event.latLng;
        Markers.add(event.latLng,map,selectedMarker);
        Markers.closeAllWindows();
        $rootScope.markersPOI=Markers.allPOI();
        $rootScope.markersWP=Markers.allWP();
      }
    });
    return map;
  }

  return{
    setMarker:function(marker){
      selectedMarker = marker;
    },
    startLog:function(){
      log = true;
    },
    stopLog:function(){
      log = false;
    },
    startTrack:function(){
      started = true;
    },
    stopTrack:function(){
      started = false;
    },
    initMap:function(){
      return init();
    }
  }
}])