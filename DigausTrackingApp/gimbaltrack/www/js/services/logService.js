angular.module('starter.services')

.factory('Logs', ['$cordovaGeolocation','$ionicLoading','$timeout','$rootScope','Markers', function($cordovaGeolocation,$ionicLoading,$timeout,$rootScope,Markers) {
  var started = false;
  //Logs aus dem LocalStorage laden
  var logs = JSON.parse(window.localStorage['Logs'] || null);
  if(logs == null){
    logs = [];
  }
  var log = [];
  var id = 0;
  if(logs.length>0){
    id=logs[logs.length-1].id+1;
  }
  var myLatlng = new google.maps.LatLng(0,0);

  var mapOptions = {
    center: myLatlng,
    zoom: 2,
    disableDefaultUI: true,
    mapTypeId: google.maps.MapTypeId.SATELLITE
  }     
  //Analog zum Marker und Polyinien Service mit leichten Abwandlungen
  var mapLogs;
  var polylines = [];
  var polylinesTrack = [];
  var logT;
  var count=1;
  var stop = false;

  var wpID = 1;
  var POIID= 1;
  var wps = [];
  var pois = [];
  var labelsPOI = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var labelIndexPOI = 0;
  var labelsWP = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var labelIndexWP = 0;
  var imagePOI = {
    url: 'img/roi_big.png',
    anchor: new google.maps.Point(18, 28),
    scaledSize: new google.maps.Size(36, 35),
    labelOrigin: new google.maps.Point(18, 11.5)
  };
  var imageWP = {
    url: 'img/ic_roi1.png',
    anchor: new google.maps.Point(17, 16),
    scaledSize: new google.maps.Size(34, 36),
    labelOrigin: new google.maps.Point(17, 16)
  };
  var imagePOIBlue = {
    url: 'img/roi_blue_big.png',
    anchor: new google.maps.Point(18, 28),
    scaledSize: new google.maps.Size(36, 35),
    labelOrigin: new google.maps.Point(18, 11.5)
  };
  var imageWPBlue = {
    url: 'img/ic_roi_blue1.png',
    anchor: new google.maps.Point(17, 16),
    scaledSize: new google.maps.Size(34, 36),
    labelOrigin: new google.maps.Point(17, 16)
  };

  stopT = function(){
    markerTra.setIcon(imagePos);
    markerTra.track=0;
    for(var i=0;i<wps.length;i++){
      if(wps[i].track==1){
        wps[i].track=0;
        wps[i].setIcon(imageWP);
      }
    }
  
    for(var i=0;i<pois.length;i++){
      if(pois[i].track==1){
        pois[i].track=0;
        pois[i].setIcon(imagePOI);
      }
    }
  }
  closeW = function(){
    for(var i=0;i<wps.length;i++){
      wps[i].info.close();
    }
    for(var i=0;i<pois.length;i++){
      pois[i].info.close();
    }
    markerTra.info.close();
  }

  addWP = function(dataWP){
    var newLabel = {
      text:labelsWP[labelIndexWP++ % labelsWP.length],
      color:'white',
      id:wpID
    };
    var latlng = new google.maps.LatLng(dataWP.lat,dataWP.lng);
    var markerWP = new google.maps.Marker({
      track:1,
      position: latlng,
      icon: imageWPBlue,
      map:mapLogs,
      label:newLabel
    }); 

    var text = document.createElement('div');
    text.id='info';
    text.selectedPosition = dataWP.selectedPosition;
    text.height = dataWP.height;
    text.time = dataWP.time;
    text.innerHTML = '<p>Height: ' + text.height +'m<br>Time: '+text.time+'s</br>Selected POI: '+text.selectedPosition+'</p>';
    
    markerWP.info = new google.maps.InfoWindow({
      content: text
    });

    markerWP.addListener('click', function() {
      stopT();
      closeW();
      markerWP.track=1;
      markerWP.setIcon(imageWPBlue);
    })
    markerWP.addListener('dblclick', function() {
      console.log(markerWP.label.id);
      stopT();
      closeW();
      markerWP.track=1;
      markerWP.setIcon(imageWPBlue);
      markerWP.info.open(mapLogs,markerWP);
    });
    wps.push(markerWP);
    wpID++;
  }

  addPOI = function(dataPOI){

    var newLabel = {
      text:labelsPOI[labelIndexPOI++ % labelsPOI.length],
      color:'white',
      id:POIID,
    };
    var latlng = new google.maps.LatLng(dataPOI.lat,dataPOI.lng);
    var markerPOI = new google.maps.Marker({
      track:1,
      position:latlng,
      icon: imagePOIBlue,
      map:mapLogs,
      label:newLabel,
    }); 

    var text = document.createElement('div');
    text.id='info';
    text.height = dataPOI.height;
   
    text.innerHTML = '<p>Height: ' + text.height +'m'+'</p>';

    markerPOI.info = new google.maps.InfoWindow({
      clickable: true,
      content: text,
    });

    markerPOI.addListener('click', function() {
      stopT();
      closeW();
      markerPOI.track=1;
      markerPOI.setIcon(imagePOIBlue);
    });
    markerPOI.addListener('dblclick', function() {
      stopT();
      closeW();
      markerPOI.track=1;
      markerPOI.setIcon(imagePOIBlue);
      markerPOI.info.open(mapLogs,markerPOI);
    });
    pois.push(markerPOI);
    POIID++;
  }
  var pathWP = new google.maps.Polyline({
    geodesic: true,
    strokeColor: '#FFFFFF',
    strokeOpacity: 1.0,
    strokeWeight: 2
  });
  var lineSymbol = {
    path: 'M 0,-1 0,1',
    strokeOpacity: 1,
    scale: 3,
    strokeColor: '#FFFFFF'
  };
     
  //Wenn Log gestartet wurde die Positionen des Copters und der eigenen Position alle 500ms abspeichern
  logging = function(){
    var copter = Markers.getLogCopter();
    var track = Markers.getLogTrack();
    var data = {
     copter: copter,
     track: track,
    }
    log.data.push(data);
    $timeout(function(){
      if(started==true){
        logging();
      }
    },100); 
  }

  //Wenn ein andere Log geladen wird die alten Marker/Polylinien etc. entfernen
  resetAll = function(){
    for(var i=0;i<wps.length;i++){
      wps[i].setMap(null);
    }
    wps = [];
    for(var i=0;i<pois.length;i++){
      pois[i].setMap(null);
    }
    pois = [];
    markerCop.setMap(null);
    markerCopHeading.setMap(null);
    markerTra.setMap(null);
    for(var i=0;i<polylines.length;i++){
      polylines[i].setMap(null);
    }
    polylines = [];
    for(var i=0;i<polylinesTrack.length;i++){
      polylinesTrack[i].setMap(null);
    }
    polylinesTrack = [];
    pathWP.setMap(null);
    wpID=1;
    POIID=1;
    labelIndexPOI = 0;
    labelIndexWP = 0;
  }
  polyPOI = function(){
    for(var i=0;i<wps.length;i++){
      if(wps[i].info.content.selectedPosition!=0){
        var pathPOI = new google.maps.Polyline({
          icons: [{
            icon: lineSymbol,
            offset: '0',
            repeat: '20px'
          }],
          strokeOpacity: 0
        });   
        var flightPlanCoordinates = []; 
        for(var k=0;k<pois.length;k++){
          if(pois[k].label.text == wps[i].info.content.selectedPosition){
            flightPlanCoordinates.push(wps[i].position);
            flightPlanCoordinates.push(pois[k].position);
            pathPOI.setPath(flightPlanCoordinates);
            polylines.push(pathPOI);
            polylines[polylines.length-1].setMap(mapLogs);
          }
        }
      }
    }
  }

  var markerCop = new google.maps.Marker({
    optimized: false,
    focus:false
  }); 
 
  var markerCopHeading = new google.maps.Marker({
    optimized: false,
  }); 


  var textA = document.createElement('div');
  textA.id='info';
  textA.height = 20;
  textA.voltage = 0;
  textA.innerHTML = '<p>Height: ' + textA.height +'m<br>Voltage: '+textA.voltage+'V</p>';
  
  markerCop.info = new google.maps.InfoWindow({
    content: textA
  });

  markerCopHeading.addListener('dblclick', function() {
    markerCop.info.open(mapLogs,markerCop);
  });

  //Copter setzen zzgl der Headings (Icons werden gedreht) und Info Window
  setCopter = function (copter){
    var imageCopter = Markers.setHeading('Quad',copter.heading);
    var imageCopterHeading = Markers.setHeading('Gimbal',copter.headingGimbal);
    var latlng = new google.maps.LatLng(copter.lat,copter.lng);
    markerCop.setPosition(latlng);
    markerCopHeading.setPosition(latlng);
    markerCop.info.content.innerHTML = '<p>Height: ' + copter.height +'m<br>Voltage: '+copter.voltage+'V</p>';
    markerCop.setIcon(imageCopter);
    markerCopHeading.setIcon(imageCopterHeading);
  }

  var imagePosBlue = {
    url: 'img/ic_roi_blue1.png',
    anchor: new google.maps.Point(10, 10.5),
    scaledSize: new google.maps.Size(20, 21),
  };
  var imagePos = {
    url: 'img/ic_roi1.png',
    anchor: new google.maps.Point(10, 10.5),
    scaledSize: new google.maps.Size(20, 21),
  };

  var newLabel = {
    text:' ',
    color:'white',
    id:-1
  };
  var markerTra = new google.maps.Marker({
    track:0,
    icon: imagePosBlue,
    focus: false,
    label: newLabel,
    optimized: false,
    focus:false
  }); 

  var text = document.createElement('div');
  text.id='info';
  text.height = 0;
  text.innerHTML = '<p>Height: ' + text.height +'m</p>';
  
  markerTra.info = new google.maps.InfoWindow({
    content: text
  });
  markerTra.addListener('click', function() {
    stopT();
    markerTra.track=1;
    markerTra.setIcon(imagePosBlue);
  });

  markerTra.addListener('dblclick', function() {
    stopT();
    markerTra.track=1;
    markerTra.setIcon(imagePosBlue);
    markerTra.info.open(mapLogs,markerTra);
  });

  //Position setzen und Info Window anpassen sowie Polylinie
  setTrack = function (track){
    var latlng = new google.maps.LatLng(track.lat,track.lng);
    markerTra.setPosition(latlng);
    markerTra.info.content.innerHTML = '<p>Height: ' + track.height +'m</br>Sattelites: '+track.sats+'</p>';
    for(var i=0;i<polylinesTrack.length;i++){
      polylinesTrack[i].setMap(null);
    }
    polylinesTrack =[];
    for(var i=0;i<wps.length;i++){
      if(wps[i].info.content.selectedPosition=='Your Pos'){
        var pathPOI = new google.maps.Polyline({
          icons: [{
            icon: lineSymbol,
            offset: '0',
            repeat: '20px'
          }],
          strokeOpacity: 0
        }); 
        var flightPlanCoordinates = [];
        flightPlanCoordinates.push(wps[i].position);
        flightPlanCoordinates.push(markerTra.position);
        pathPOI.setPath(flightPlanCoordinates);
        polylinesTrack.push(pathPOI);
        polylinesTrack[polylinesTrack.length-1].setMap(mapLogs);
      }
    }
  }
  
  //Wenn abgespielt wird alle 500ms die Positionen und Infos des Copter etc setzen
  //count startet bei 1 da der 0te Log beim ersten laden schon gesetzt wurde
  playing = function(){
    $timeout(function(){
      if(logT.data[count]!=undefined&&stop==false){
        setTrack(logT.data[count].track);
        setCopter(logT.data[count].copter);

        if(markerCop.focus==true&&markerTra.focus==true){
          var bounds = new google.maps.LatLngBounds();
          bounds.extend(markerCop.getPosition());
          bounds.extend(markerTra.getPosition());
          for (var i = 0; i < wps.length; i++) {
           bounds.extend(wps[i].getPosition());
          }
          for (var i = 0; i < pois.length; i++) {
           bounds.extend(pois[i].getPosition());
          }
          mapLogs.fitBounds(bounds);   
        }

        if(markerTra.focus==true&&markerCop.focus==false){
          mapLogs.panTo(markerTra.getPosition());
        }

        if(markerCop.focus==true&&markerTra.focus==false){
          mapLogs.panTo(markerCop.getPosition());
        }

        count++;
        playing();
      }else{
        count = 1;
        $rootScope.checkEndLog();
        if(stop==true){
          $ionicLoading.show({
            template: 'Log stopped!',
            duration: 1000
          });
        }else{
          stop = true;
          $ionicLoading.show({
            template: 'Log ended!',
            duration: 1000
          });
        } 
      }
      $rootScope.seconds(count);
    },100); 
  }
  
  return {
    backward: function(){
      if(count>=300){
        count = count -300;
      }else{
        count = 0;
      }
    },
    forward: function(){
      if(count<=logT.data.length - 300){
        count = count  + 300;
      }else{
        count = logT.data.length;
      }
    },
    followAll: function(state){
      markerCop.focus=state;
      markerTra.focus=state;
    },
    followCopter: function(state){
      markerCop.focus=state;
    },
    followPos: function(state){
      markerTra.focus=state;
    },
    setCenterCopter: function(map){
      map.panTo(markerCop.getPosition());
      map.setZoom(17);
    },
    setCenterPos: function(map){
      map.panTo(markerTra.getPosition());
      map.setZoom(17);
    },
    setCenterAll: function(map){
      var bounds = new google.maps.LatLngBounds();
      bounds.extend(markerCop.getPosition());
      bounds.extend(markerTra.getPosition());
      for (var i = 0; i < wps.length; i++) {
       bounds.extend(wps[i].getPosition());
      }
      for (var i = 0; i < pois.length; i++) {
       bounds.extend(pois[i].getPosition());
      }
      map.fitBounds(bounds);    
    },
    getStatus: function(){
      return stop;
    },
    play: function(){
      stop = false;
      if(count==1){
        $ionicLoading.show({
          template: 'Log started!',
          duration: 1000
        });
        playing();
      }
    },
    stopPlay: function(){
      stop = true;
      count = 1;
    },

    //laden des gewählten Logs
    loadLog: function(logtmp){
      logT = logtmp;
      resetAll();
      for(var i=0; i<logtmp.markers.pois.length;i++){
        stopT();
        addPOI(logtmp.markers.pois[i]);
      }
      for(var i=0; i<logtmp.markers.waypoints.length;i++){
        stopT();
        addWP(logtmp.markers.waypoints[i]);
      }
      var flightPlanCoordinates = [];
      for(var k=0;k<wps.length;k++){
        flightPlanCoordinates.push(wps[k].position);
      }
      pathWP.setPath(flightPlanCoordinates);
      pathWP.setMap(mapLogs);
      polyPOI();
      setTrack(logtmp.data[0].track);
      setCopter(logtmp.data[0].copter);
      markerCop.setMap(mapLogs);
      markerCopHeading.setMap(mapLogs);
      markerTra.setMap(mapLogs);  
    },
    initMap: function(){
      mapLogs = new google.maps.Map(document.getElementById("mapLogs"), mapOptions);
      return mapLogs;
    },

    //Log aufzeichnen wird gestartet, map übergeben um den Zoom zu bekommen
    start: function(map){
      started = true;

      //Datum und Uhrzeit abfragen für den Log
      var tmp =  new Date();
      var dd = tmp.getDate();
      if(dd<10){
        dd = '0' +dd;
      }
      var mm = tmp.getMonth()+1;
      if(mm<10){
        mm = '0' +mm;
      }
      var yy = tmp.getFullYear();
      var hours = tmp.getHours();
      if(hours<10){
        hours = '0' +hours;
      }
      var minutes = tmp.getMinutes();
      if(minutes<10){
        minutes = '0' +minutes;
      }
      var date = dd + '.' + mm + '.' + yy;
      var time = hours + ':' + minutes;
      
      log = {
        id:id,
        date: date,
        time: time,
        markers: Markers.getLogMarkers(),
        data: [],
      }
      id++;
      if(started==true){
        logging();
      }
    },
    //Erst wenn Log gestoppt wird, zu den Logs und zum LocalStorage hinzufügen
    stop: function(){
      started = false;
      var tmp =  new Date();
      var hours = tmp.getHours();
      if(hours<10){
        hours = '0' +hours;
      }
      var minutes = tmp.getMinutes();
      if(minutes<10){
        minutes = '0' +minutes;
      }
      var time = ' - ' + hours + ':' + minutes;
      log.time += time;
      logs.push(log);
      window.localStorage['Logs'] = JSON.stringify(logs);
    },
    all: function() {
      return logs;
    },
    remove: function(log) {
      logs.splice(logs.indexOf(log), 1);
      window.localStorage.removeItem('Logs');
      window.localStorage['Logs'] = JSON.stringify(logs);
    },
  };
}]);