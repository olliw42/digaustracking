angular.module('starter.services')
.factory('Markers',['$cordovaGeolocation','$ionicPopup','$rootScope','$timeout','Polylines','BLEService',function($cordovaGeolocation,$ionicPopup,$rootScope,$timeout,Polylines,BLEService) {
  

  var log = false;
  var started = false;
  var performance;
  var copterConnected = false;
  //Settings aus dem Local Storage abfragen für Performance und externes GPS
  var settings = JSON.parse(window.localStorage['Settings'] || null);
  if(settings==null){
    performance =  false;
    externGPS = false;
    lowVoltage = 15;
  }else{
    lowVoltage = settings.lowVoltage;
    performance = settings.performance;
    externGPS = settings.externGPS;
  }

  //Copter Marker erstellen mit custom Icon sowie nen Marker für Blickrichtung des Gimbals
  var latLngCopter = new google.maps.LatLng(0,0);
  var imageCopter = {
    url: 'img/quad.png',
    anchor: new google.maps.Point(30, 30),
    scaledSize: new google.maps.Size(60, 60),
  };

  var imageCopterHeading = {
    url:'img/heading.png',
    anchor: new google.maps.Point(30, 30),
    scaledSize: new google.maps.Size(60, 60),
  };
  var markerCopter = new google.maps.Marker({
    position:latLngCopter,
    icon: imageCopter,
    optimized: false,
    heading: 0,
    focus: false
  }); 
  var markerCopterHeading = new google.maps.Marker({
    position:latLngCopter,
    icon: imageCopterHeading,
    optimized: false,
    heading: 0
  }); 
  //Funktion um Copter und Gimbal Blickrichtung zur Map hinzuzufügen
  setCopterMap = function(map){

    //div Element erzeugen um ein click Evenet auf das Info Window zu legen (wird hier aber nicht unbedingt benötigt)
    var text = document.createElement('div');
    text.id='info';
    text.height = 0;
    text.voltage = 0;
    text.innerHTML = '<p>Height: ' + text.height +'m<br>Voltage: '+text.voltage+'V</p>';
    
    markerCopter.info = new google.maps.InfoWindow({
      content: text
    });

    markerCopterHeading.addListener('dblclick', function() {
      markerCopter.info.open(map,markerCopter);
    });
    markerCopter.setMap(map);    
    markerCopterHeading.setMap(map);
    return map;
  }

  //Optionen für die Positionsbestimmung definieren, 
  var posOptions = {
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 500
  };
  var watchOptions = {
    enableHighAccuracy: true,
    timeout: 3000,
    frequency: 100,
    maximumAge: 0
  };

  //Icons für die aktulle Position
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

  //Label für die aktuelle Position
  var newLabel = {
    text:' ',
    color:'white',
    id:-1
  };

  //Marker der aktuellen Position, track dient dazu um festzustellen welcher Marker aktuell ausgewählt ist
  //optimized muss false, ansonsten kann es zu Bugs kommen wenn die Position häufig neu gesetzt wird
  var markerTrack = new google.maps.Marker({
    track:0,
    icon: imagePosBlue,
    focus: false,
    label: newLabel,
    optimized: false
  }); 

  //Initierung des Positions-Markers, mit click Events etc
  initPos = function(map) {
    var myLatlng = new google.maps.LatLng(0,0);
    markerTrack.setPosition(myLatlng);
    markerTrack.setMap(map);

    //Auf dieses div Ojekt können wir nen click Event legen um nen Info Window anklickbar zu machen
    //Außerdem kann man so das padding etc anpassen um den Text des Info Windows zu positionieren
    var text = document.createElement('div');
    text.id='info';
    text.height = 0;
    text.sats = 0;
    text.innerHTML = '<p>Height: ' + text.height +'m</br>Sattelites: '+text.sats+'</p>';
    
    markerTrack.info = new google.maps.InfoWindow({
      content: text
    });

    //click Event für Marker, sendet unter anderem die Position and das Trackingmodule
    markerTrack.addListener('click', function() {
      stopTrack();
      markerTrack.track=1;
      markerTrack.setIcon(imagePosBlue);
      BLEService.sendTrack(markerTrack);
    });

    //Wie oben nur öffnet das Info Window
    markerTrack.addListener('dblclick', function() {
      stopTrack();
      markerTrack.track=1;
      markerTrack.setIcon(imagePosBlue);
      markerTrack.info.open(map,markerTrack);
      BLEService.sendTrack(markerTrack);
    });

    //Click Event auf das div Objekt gelegt um auf das Info Window klicken zu können, damit man Daten ändern kann
    google.maps.event.addDomListener(text,'click', function() {
      //Nur möglich wenn Log/Mission nicht läut 
      if(log == false && started == false){
        $rootScope.data = {};
        //zum $rootScope hinzufügen um die Daten im Template nutzen zu können
        $rootScope.data.height=markerTrack.info.content.height;
        var myPopup = $ionicPopup.show({
          template: '<label class="item item-input"><input type="number" ng-model="data.height"></label>',
          title: 'Enter Height',
          scope: $rootScope,
          buttons: [
            { text: 'Cancel' },
            {
              text: '<b>Save</b>',
              type: 'button-positive',
              onTap: function(e) {
                if($rootScope.data.height==undefined){
                  $rootScope.data.height=0;
                }
                return $rootScope.data;
              }
            }
          ]
        });
        //geänderte Höhe anpassen
        myPopup.then(function(res) {
          if(res!=undefined){
            markerTrack.info.content.height=res.height;
            markerTrack.info.content.innerHTML = '<p>Height: ' + res.height +'m</br>Sattelites: '+markerTrack.info.content.sats+'</p>';
          }
        });
      }
    });
  }

  var gotPos=false;

  //Positionserfassung, erst mit getCurrentPosition versuchen welches auch ältere Positionen erlaubt
  watchCurrentPos = function(map){
    if(gotPos==false && externGPS == false){ 
      $cordovaGeolocation.getCurrentPosition(posOptions).then(function (position) {
        var myLatlng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        markerTrack.setPosition(myLatlng);
  
        //zu Testzwecken wird auch der Copter auf die Position gesetzt
        //markerCopter.setPosition(myLatlng);
        //markerCopterHeading.setPosition(myLatlng);
        map.panTo(myLatlng);
        map.setZoom(17);
        gotPos=true;
      }, function(err) {
        console.log(err);
      });
    }
    $cordovaGeolocation.watchPosition(watchOptions).then(null, function(err) {
        console.log(err);
    },
    function (position) {
      if(externGPS == false){        
        var myLatlng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        markerTrack.setPosition(myLatlng);
        //markerCopter.setPosition(myLatlng);
        //markerCopterHeading.setPosition(myLatlng);
        if(markerTrack.focus==true&&markerCopter.focus==false){
          map.panTo(myLatlng);
        }
        if(markerTrack.focus==true&&markerCopter.focus==true){
          var bounds = new google.maps.LatLngBounds();
          bounds.extend(markerCopter.getPosition());
          bounds.extend(markerTrack.getPosition());
          for (var i = 0; i < waypoints.length; i++) {
           bounds.extend(waypoints[i].getPosition());
          }
          for (var i = 0; i < pointsOfInterest.length; i++) {
           bounds.extend(pointsOfInterest[i].getPosition());
          }
          map.fitBounds(bounds);        
        }
        //falls ausgewählt/Mission aktiv ist und Position sich ändert wird diese ans Module gesendet
        if(markerTrack.track == 1){
          BLEService.sendTrack(markerTrack);
        }
        //Polylinien anpassen
        Polylines.findPolyPOI(markerTrack,map);
        if(gotPos==false){
          map.panTo(myLatlng);
          map.setZoom(17);
          gotPos=true;
        }
      }
    });
  
    return map;
  } 

  //Waypoints and Point of Interests
  var wpID = 1;
  var POIID= 1;
  var waypoints = [];
  var pointsOfInterest = [];
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

  //setzte alle Icons auf grüne und track auf 0;
  stopTrack = function(){
    markerTrack.setIcon(imagePos);
    markerTrack.track=0;
    for(var i=0;i<waypoints.length;i++){
      if(waypoints[i].track==1){
        waypoints[i].track=0;
        waypoints[i].setIcon(imageWP);
      }
    }
  
    for(var i=0;i<pointsOfInterest.length;i++){
      if(pointsOfInterest[i].track==1){
        pointsOfInterest[i].track=0;
        pointsOfInterest[i].setIcon(imagePOI);
      }
    }
  }

  //schließt alle Info Windows
  closeWindows = function(){
    for(var i=0;i<waypoints.length;i++){
      waypoints[i].info.close();
    }
    for(var i=0;i<pointsOfInterest.length;i++){
      pointsOfInterest[i].info.close();
    }
    markerTrack.info.close();
  }

  //fügt einen Waypoint hinzu
  addWaypoint = function(latLng,map){

    //neuen Label erzeugen mit passenden Symbol (1-Z), id um leichter drauf zugreifen zu können
    var newLabel = {
      text:labelsWP[labelIndexWP++ % labelsWP.length],
      color:'white',
      id:wpID
    };

    //siehe markerTrack
    var markerWP = new google.maps.Marker({
      track:1,
      draggable: true,
      position:latLng,
      icon: imageWPBlue,
      map:map,
      label:newLabel
    }); 

    //siehe markerTrack
    var text = document.createElement('div');
    text.id='info';
    text.selectedPosition = 0;
    text.height = 20;
    text.time = 0;
    text.innerHTML = '<p>Height: ' + text.height +'m<br>Time: '+text.time+'s</br>Selected POI: '+text.selectedPosition+'</p>';
    
    markerWP.info = new google.maps.InfoWindow({
      content: text
    });

    markerWP.addListener('click', function() {
      stopTrack();
      closeWindows();
      markerWP.track=1;
      markerWP.setIcon(imageWPBlue);
    })

    //drag Event, zeichnet Polylinen während des drags neu 
    markerWP.addListener('drag', function() {
      if(performance==false){
        closeWindows();
        Polylines.polyWP(waypoints,map);
        Polylines.findPolyWP(markerWP,map);
      }
    });
    //dragend Event bei 'Increase Performance', zeichnet Polylinen am Ende des drags neu 
    markerWP.addListener('dragend', function() {
      if(performance==true){
        closeWindows();
        Polylines.polyWP(waypoints,map);
        Polylines.findPolyWP(markerWP,map);
      }
    });

    markerWP.addListener('dblclick', function() {
      stopTrack();
      closeWindows();
      markerWP.track=1;
      markerWP.setIcon(imageWPBlue);
      markerWP.info.open(map,markerWP);
    });

    //siehe markerTrack
    google.maps.event.addDomListener(text,'click', function() {
      if(log == false && started == false){
        $rootScope.data = {};
        $rootScope.markersPOI.push(markerTrack);
        $rootScope.markersPOI[$rootScope.markersPOI.length-1].label.text='Your Pos';
        $rootScope.data.height=markerWP.info.content.height;
        $rootScope.data.time=markerWP.info.content.time;

        //sucht den aktuellen POI herraus den der WP ausgewählt hat damit man diesen anzeigen kann
        for(var k=0;k<pointsOfInterest.length;k++){
          if(pointsOfInterest[k].label.text==markerWP.info.content.selectedPosition){
            $rootScope.data.selectedPOI=pointsOfInterest[k];
          }
        }
       
        var myPopup = $ionicPopup.show({
          template: '<label class="item item-input"><input type="number" ng-model="data.height"></label>'+
                    '<label class="item item-input"><input type="number" ng-model="data.time"></label>'+
                    '<div class="list"><label class="item item-input item-select"><div class="input-label">Select POI:</div>'+
                    '<select ng-model="data.selectedPOI" ng-options="marker as marker.label.text for marker in markersPOI"><option value="">0</option></select></label></div>',
          title: 'Enter Height and Time',
          scope: $rootScope,
          buttons: [
            { text: 'Cancel' },
            {
              text: '<b>Save</b>',
              type: 'button-positive',
              onTap: function(e) {
                if($rootScope.data.height==undefined){
                  $rootScope.data.height=0;
                }
                if($rootScope.data.time==undefined){
                  $rootScope.data.time=0;
                }
                if($rootScope.data.selectedValue==undefined){
                  $rootScope.data.selectedValue=0;
                }
                return $rootScope.data;
              }
            }
          ]
        });

        myPopup.then(function(res) {
          $rootScope.markersPOI.splice($rootScope.markersPOI.length-1,1);
          if(res!=undefined){
            markerWP.info.content.height=res.height;
            markerWP.info.content.time=res.time;
            if(res.selectedPOI!=null){
              markerWP.info.content.innerHTML = '<p>Height: ' + res.height +'m<br>Time: '+res.time+'s</br>Selected POI: '+ res.selectedPOI.label.text +'</p>';
            }else{
              markerWP.info.content.innerHTML = '<p>Height: ' + res.height +'m<br>Time: '+res.time+'s</br>Selected POI: 0</p>';
            }
            markerTrack.label.text=' ';
            
            //Polyline zeichnen zum gewählten POI
            Polylines.polyPOI(markerWP,res.selectedPOI,pointsOfInterest,map);
          }
        });
      }
    });
    //zum WP array hinzufügen
    waypoints.push(markerWP);
    //Polyline der Waypoints neu zeichnen
    Polylines.polyWP(waypoints,map);
    wpID++;
  }


  //Analog zu addWaypoint
  addPointOfInterest = function(latLng,map){
    var newLabel = {
      text:labelsPOI[labelIndexPOI++ % labelsPOI.length],
      color:'white',
      id:POIID,
    };
    var markerPOI = new google.maps.Marker({
      track:1,
      position:latLng,
      icon: imagePOIBlue,
      map:map,
      label:newLabel,
      draggable: true
    }); 

    var text = document.createElement('div');
    text.id='info';
    text.height = 0;
    text.innerHTML = '<p>Height: ' + text.height +'m'+'</p>';

    markerPOI.info = new google.maps.InfoWindow({
      content: text,
    });

    markerPOI.addListener('click', function() {
      stopTrack();
      closeWindows();
      markerPOI.track=1;
      markerPOI.setIcon(imagePOIBlue);
      BLEService.sendPos(markerPOI);
    });
    markerPOI.addListener('drag', function() {
      if(performance==false){
        closeWindows();
        Polylines.findPolyPOI(markerPOI,map);
      }
    });
     markerPOI.addListener('dragend', function() {
      if(performance==true){
        closeWindows();
        Polylines.findPolyPOI(markerPOI,map);
      }
    });
    markerPOI.addListener('dblclick', function() {
      stopTrack();
      closeWindows();
      markerPOI.track=1;
      markerPOI.setIcon(imagePOIBlue);
      markerPOI.info.open(map,markerPOI);
      BLEService.sendPos(markerPOI);
    });

    google.maps.event.addDomListener(text,'click', function() {
      if(log == false && started == false){
        $rootScope.data = {};
        $rootScope.data.height=markerPOI.info.content.height;
        var myPopup = $ionicPopup.show({
          template: '<label class="item item-input"><input type="number" ng-model="data.height"></label>',
          title: 'Enter Height',
          scope: $rootScope,
          buttons: [
            { text: 'Cancel' },
            {
              text: '<b>Save</b>',
              type: 'button-positive',
              onTap: function(e) {
                if($rootScope.data.height==undefined){
                  $rootScope.data.height=0;
                }
                return $rootScope.data;
              }
            }
          ]
        });

        myPopup.then(function(res) {
          if(res!=undefined){
            markerPOI.info.content.height=res.height;
            markerPOI.info.content.innerHTML = '<p>Height: ' + res.height +'m'+'</p>';
          }
        });
      }
    });
    pointsOfInterest.push(markerPOI);
    POIID++;
    BLEService.sendPos(markerPOI);
  }

  //wenn ein POI gelöscht wird werden die Labels angepasst und dies muss auch für die Info Windows der WPs angepasst werden
  updateWPinfo = function(markerPOI){
    for(var i=0;i<waypoints.length;i++){
      for(var j=0;j<pointsOfInterest.length;j++){
        if(waypoints[i].info.content.selectedPosition==pointsOfInterest[j].label.text&&pointsOfInterest[j].label.id>markerPOI.label.id){
          waypoints[i].info.content.selectedPosition=pointsOfInterest[j-1].label.text;
          waypoints[i].info.content.innerHTML = '<p>Height: ' + waypoints[i].info.content.height +'m<br>Time: '+ waypoints[i].info.content.time+'s</br>Selected POI: '+waypoints[i].info.content.selectedPosition+'</p>';
        }
      }
    }
  }

  //WP löschen
  removeWP = function(map){
    var newTrack = -1;
    for(var i=0;i<waypoints.length;i++){
      if(waypoints[i].track==1){
        newTrack = i;
        Polylines.removeWP(waypoints[i],pointsOfInterest);
        waypoints[i].setMap(null);
        
        //Label der Nachfolger anpassen 
        if(waypoints[i].label.id<waypoints[waypoints.length-1].label.id){
          for(var k=waypoints.length-1;k>i;k--){
            waypoints[k].label.text=waypoints[k-1].label.text; 
            //Label muss gesetzt werden um zu updaten
            waypoints[k].setLabel(waypoints[k].label);  
          }
        }
        labelIndexWP--;
        //wpID--;
        waypoints.splice(i,1);
        //Polyline neu zeichnen
        Polylines.polyWP(waypoints,map);
      }
    }
    if(waypoints.length>0&&newTrack!=-1){
      //Falls nicht der letzte WP
      if(newTrack<waypoints.length){
        waypoints[newTrack].setIcon(imageWPBlue);
        waypoints[newTrack].track=1;
      }else{
        waypoints[newTrack-1].setIcon(imageWPBlue);
        waypoints[newTrack-1].track=1;
      }
    }else{
      if(waypoints.length==0&&newTrack!=-1){
        markerTrack.setIcon(imagePosBlue);
        markerTrack.track=1;
        BLEService.sendTrack(markerTrack);
      }
    }
    return newTrack;
  }

  removePOI = function(map){
    var newTrack = -1;
    //ausgewählten Punkt suchen und entfernen
    for(var i=0;i<pointsOfInterest.length;i++){
      if(pointsOfInterest[i].track==1){
        newTrack=i;
        updateWPinfo(pointsOfInterest[i]);
        Polylines.removePOI(pointsOfInterest[i].label.id,waypoints);
        pointsOfInterest[i].setMap(null);
        //Label der Nachfolger anpassen 
        if(pointsOfInterest[i].label.id<pointsOfInterest[pointsOfInterest.length-1].label.id){
          for(var k=pointsOfInterest.length-1;k>i;k--){
            pointsOfInterest[k].label.text=pointsOfInterest[k-1].label.text;
            //Label muss gesetzt werden um zu updaten 
            pointsOfInterest[k].setLabel(pointsOfInterest[k].label);           
          }
        }
        labelIndexPOI--;
        pointsOfInterest.splice(i,1);
      }
    }
    if(pointsOfInterest.length>0&&newTrack!=-1){
      if(newTrack<pointsOfInterest.length){
        pointsOfInterest[newTrack].setIcon(imagePOIBlue);
        pointsOfInterest[newTrack].track=1;
        BLEService.sendPos(pointsOfInterest[newTrack]);
      }else{
        pointsOfInterest[newTrack-1].setIcon(imagePOIBlue);
        pointsOfInterest[newTrack-1].track=1;
        BLEService.sendPos(pointsOfInterest[newTrack-1]);
      }
    }else{
      markerTrack.setIcon(imagePosBlue);
      markerTrack.track=1;
      BLEService.sendTrack(markerTrack);
    }
  }

  //Missions laden aus dem LocalStorage
  var missions = JSON.parse(window.localStorage['Missions'] || null);
  if(missions == null){
    missions = [];
  }
  var id = 0;
  if(missions.length>0){
    id= missions[missions.length-1].id+1;
  }

  //Funktion zum drehen eines Icons
  setHeadingIcon = function(copterGimbal,degree){
    RotateIcon = function(options){
        this.options = options || {};
        this.rImg = options.img || new Image();
        this.rImg.src = this.rImg.src || this.options.url || '';
        this.options.width = this.options.width || this.rImg.width || 52;
        this.options.height = this.options.height || this.rImg.height || 60;
        canvas = document.createElement("canvas");
        canvas.width = this.options.width;
        canvas.height = this.options.height;
        this.context = canvas.getContext("2d");
        this.canvas = canvas;
    };
    RotateIcon.makeIcon = function(url) {
        return new RotateIcon({url: url});
    };
    RotateIcon.prototype.setRotation = function(options){
        var canvas = this.context,
            angle = options.deg ? options.deg * Math.PI / 180:
                options.rad,
            centerX = this.options.width/2,
            centerY = this.options.height/2;

        canvas.clearRect(0, 0, this.options.width, this.options.height);
        canvas.save();
        canvas.translate(centerX, centerY);
        canvas.rotate(angle);
        canvas.translate(-centerX, -centerY);
        canvas.drawImage(this.rImg, 0, 0);
        canvas.restore();
        return this;
    };
    RotateIcon.prototype.getUrl = function(){
        return this.canvas.toDataURL('image/png');
    };  
    if(copterGimbal=='Gimbal'){
      var imageGimbal = {
        url: RotateIcon.makeIcon('img/heading.png').setRotation({deg: degree}).getUrl(),
        anchor: new google.maps.Point(30, 30),
        scaledSize: new google.maps.Size(60, 60),
      };
      return imageGimbal;
    }else{
      var imageQuad = {
        url: RotateIcon.makeIcon('img/quad.png').setRotation({deg: degree}).getUrl(),
        anchor: new google.maps.Point(30, 30),
        scaledSize: new google.maps.Size(60, 60),
      };
      return imageQuad;
    }
  }

  //Daten vom Tracking Device abfragen (Copter Position etc)
  getDataFromBLE = function(map){
    $rootScope.checkAllCopter = function(){
      $timeout(function(){
        console.log('Marker');
        var tmp = BLEService.getData();
        if(tmp.posLat!=0){
          if(externGPS==true){
            var myLatlngTrack = new google.maps.LatLng(parseFloat(tmp.posLat/1000000), parseFloat(tmp.posLng/1000000));
            markerTrack.setPosition(myLatlngTrack);
            markerTrack.info.content.height = tmp.posHeight;
            markerTrack.info.content.sats = tmp.sats;
            markerTrack.info.content.innerHTML = '<p>Height: ' + tmp.posHeight +'m</br>Sattelites: '+tmp.sats+'</p>';

            if(markerTrack.focus==true&&markerCopter.focus==false){
              map.panTo(myLatlngTrack);
            }
            Polylines.findPolyPOI(markerTrack,map);
            if(gotPos==false){
              map.panTo(myLatlngTrack);
              map.setZoom(17);
              gotPos=true;
            }
          }

          
          //Daten vom Tracking Module ohne Veränderungen auswerten
          var myLatlngCopter = new google.maps.LatLng(parseFloat(tmp.copterLat/1000000), parseFloat(tmp.copterLng/1000000));
          markerCopter.setPosition(myLatlngCopter);
          markerCopterHeading.setPosition(myLatlngCopter);
          markerCopter.info.content.height = tmp.copterHeight;
          markerCopter.info.content.voltage = tmp.copterVoltage;

          if(markerCopter.focus==true&&markerTrack.focus==true){
            var bounds = new google.maps.LatLngBounds();
            bounds.extend(markerCopter.getPosition());
            bounds.extend(markerTrack.getPosition());
            for (var i = 0; i < waypoints.length; i++) {
             bounds.extend(waypoints[i].getPosition());
            }
            for (var i = 0; i < pointsOfInterest.length; i++) {
             bounds.extend(pointsOfInterest[i].getPosition());
            }
            map.fitBounds(bounds);
          }

          if(markerCopter.focus==true&&markerTrack.focus==false){
            map.panTo(myLatlngCopter);
          }
          //Low Voltage Alarm öffnet infoWindow mit der Spannung in Rot!
          if(parseFloat(tmp.copterVoltage)<=lowVoltage&&copterConnected==true){
            markerCopter.info.content.innerHTML = '<p>Height: ' + tmp.copterHeight +'m</br><font color="red">Voltage: '+ tmp.copterVoltage +'V</font></p>';
            if(markerCopter.info.getMap()==null){
              markerCopter.info.open(map,markerCopter);
            }
          }else{
            markerCopter.info.content.innerHTML = '<p>Height: ' + tmp.copterHeight +'m</br>Voltage: '+ tmp.copterVoltage +'V</p>';
          }
          markerCopter.setIcon(setHeadingIcon('Quad',parseInt(tmp.copterHeading)));
          markerCopterHeading.setIcon(setHeadingIcon('Gimbal',parseInt(tmp.gimbalHeading)+parseInt(tmp.copterHeading)));
          markerCopter.heading = parseInt(tmp.copterHeading);
          markerCopterHeading.heading = parseInt(tmp.gimbalHeading)+parseInt(tmp.copterHeading);
          
        }
      });
    } 

  }

  getRandomOffsetHeading = function () {
    var random = Math.floor((Math.random() * 360) + 0);
    return random;
  }
  getRandomOffset = function () {
    var min= 0;
    var max =2;
    var plusminus = Math.round(Math.random()) * 2 - 1;
    var zahl = Math.floor(Math.random()*(max-min+1)+min);
    zahl= zahl*0.001;
    return (plusminus)*(zahl);
  }


  return{
    setConnected: function(status){
      copterConnected = status;
    },
    followAll: function(status){
      markerCopter.focus = status;
      markerTrack.focus = status;
    },
    followCopter: function(status){
      markerCopter.focus=status;
      markerTrack.focus = false;
    },
    followPos: function(status){
      markerTrack.focus=status;
      markerCopter.focus = false;
    },
    setCenterCopter: function(map){
      map.panTo(markerCopter.getPosition());
      map.setZoom(17);
    },
    setCenterPos: function(map){
      map.panTo(markerTrack.getPosition());
      map.setZoom(17);
    },
    setCenterAll: function(map){
      var bounds = new google.maps.LatLngBounds();
      bounds.extend(markerCopter.getPosition());
      bounds.extend(markerTrack.getPosition());
      for (var i = 0; i < waypoints.length; i++) {
       bounds.extend(waypoints[i].getPosition());
      }
      for (var i = 0; i < pointsOfInterest.length; i++) {
       bounds.extend(pointsOfInterest[i].getPosition());
      }
      map.fitBounds(bounds);
    },
    startTrack: function(){
      started = true;
      for(var i=0;i<pointsOfInterest.length;i++){
        pointsOfInterest[i].setDraggable(false);
      }
      for(var i=0;i<waypoints.length;i++){
        waypoints[i].setDraggable(false);
      }
    },
    stopTrack: function(){
      started = false;
      if(log == false){
        for(var i=0;i<pointsOfInterest.length;i++){
          pointsOfInterest[i].setDraggable(true);
        }
        for(var i=0;i<waypoints.length;i++){
          waypoints[i].setDraggable(true);
        }
      }
    },
    setLowVoltage: function(voltage){
      lowVoltage = voltage;
    },
    setExternGPS: function(GPS){
      externGPS = GPS;
    },
    checkDataFromBLE: function(map){
      getDataFromBLE(map);
    },
    setPerformance: function(perf){
      performance = perf;
    },
    setHeading: function(copterGimbal,degree){
      RotateIcon = function(options){
        this.options = options || {};
        this.rImg = options.img || new Image();
        this.rImg.src = this.rImg.src || this.options.url || '';
        this.options.width = this.options.width || this.rImg.width || 52;
        this.options.height = this.options.height || this.rImg.height || 60;
        canvas = document.createElement("canvas");
        canvas.width = this.options.width;
        canvas.height = this.options.height;
        this.context = canvas.getContext("2d");
        this.canvas = canvas;
      };
      RotateIcon.makeIcon = function(url) {
          return new RotateIcon({url: url});
      };
      RotateIcon.prototype.setRotation = function(options){
          var canvas = this.context,
              angle = options.deg ? options.deg * Math.PI / 180:
                  options.rad,
              centerX = this.options.width/2,
              centerY = this.options.height/2;

          canvas.clearRect(0, 0, this.options.width, this.options.height);
          canvas.save();
          canvas.translate(centerX, centerY);
          canvas.rotate(angle);
          canvas.translate(-centerX, -centerY);
          canvas.drawImage(this.rImg, 0, 0);
          canvas.restore();
          return this;
      };
      RotateIcon.prototype.getUrl = function(){
          return this.canvas.toDataURL('image/png');
      };  
      if(copterGimbal=='Gimbal'){
        var imageGimbal = {
          url: RotateIcon.makeIcon('img/heading.png').setRotation({deg: degree}).getUrl(),
          anchor: new google.maps.Point(30, 30),
          scaledSize: new google.maps.Size(60, 60),
        };
        return imageGimbal;
      }else{
        var imageQuad = {
          url: RotateIcon.makeIcon('img/quad.png').setRotation({deg: degree}).getUrl(),
          anchor: new google.maps.Point(30, 30),
          scaledSize: new google.maps.Size(60, 60),
        };
        return imageQuad;
      }
    },

    //Für die Logs
    getLogTrack: function(){
      var track = {
        lat: markerTrack.position.lat(),
        lng: markerTrack.position.lng(),
        height: markerTrack.info.content.height,
        sats: markerTrack.info.content.sats,
      }
      return track;
    },

    //Für die Logs
    getLogCopter: function(){
      var copter = {
        lat: markerCopter.position.lat(),
        lng: markerCopter.position.lng(),
        heading: markerCopter.heading,
        height: markerCopter.info.content.height,
        voltage: markerCopter.info.content.voltage,
        headingGimbal: markerCopterHeading.heading
      }
      return copter;
    },

    //Marker für die Logs bekommen
    getLogMarkers:function(){
      var logWaypoints = [];
      for(var i=0;i<waypoints.length;i++){
        var wp = {
          label: waypoints[i].label.text,
          lat: waypoints[i].position.lat(),
          lng: waypoints[i].position.lng(),
          selectedPosition: waypoints[i].info.content.selectedPosition,
          height: waypoints[i].info.content.height,
          time: waypoints[i].info.content.time,
        }
        logWaypoints.push(wp);
      }
      var logPOIs = [];
      for(var i=0;i<pointsOfInterest.length;i++){
        var poi = {
          label: pointsOfInterest[i].label.text,
          lat: pointsOfInterest[i].position.lat(),
          lng: pointsOfInterest[i].position.lng(),
          height: pointsOfInterest[i].info.content.height,
        }
        logPOIs.push(poi);
      }

      var markers = {
        waypoints: logWaypoints,
        pois: logPOIs,
      }
      return markers
    },

    //Wenn Log gestartet, kann man die Marker nicht mehr bewegen
    startLog:function(){
      log=true;
      for(var i=0;i<pointsOfInterest.length;i++){
        pointsOfInterest[i].setDraggable(false);
      }
      for(var i=0;i<waypoints.length;i++){
        waypoints[i].setDraggable(false);
      }
    },
    stopLog:function(){
      log=false;
      if(started == false){
        for(var i=0;i<pointsOfInterest.length;i++){
          pointsOfInterest[i].setDraggable(true);
        }
        for(var i=0;i<waypoints.length;i++){
          waypoints[i].setDraggable(true);
        }
      }
    },

    //Mission abspeichern, dafür Daten erstmal abspeicherbar machen
    save:function(map){
      var saveWaypoints = [];
      for(var i=0;i<waypoints.length;i++){
        var wp = {
          label: waypoints[i].label.text,
          lat: waypoints[i].position.lat(),
          lng: waypoints[i].position.lng(),
          selectedPosition: waypoints[i].info.content.selectedPosition,
          height: waypoints[i].info.content.height,
          time: waypoints[i].info.content.time,
          innerHTML: waypoints[i].info.content.innerHTML,
        }
        saveWaypoints.push(wp);
      }
      var savePOIs = [];
      for(var i=0;i<pointsOfInterest.length;i++){
        var poi = {
          label: pointsOfInterest[i].label.text,
          lat: pointsOfInterest[i].position.lat(),
          lng: pointsOfInterest[i].position.lng(),
          height: pointsOfInterest[i].info.content.height,
          innerHTML: pointsOfInterest[i].info.content.innerHTML,
        }
        savePOIs.push(poi);
      }
      var saveTrack = {
        label: 'Your Pos',
        height: markerTrack.info.content.height,
      }

      //Datum und Uhrzeit zum speichern abfragen
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

      //Mission die gespeichert wird
      var mission = {
        id: id,
        date: date,
        time: time,
        wps: saveWaypoints,
        pois: savePOIs,
        track: saveTrack,
      }
      id++;

      //hinzufügen und dann in den LocalStorage speichern
      missions.push(mission);
      window.localStorage['Missions'] = JSON.stringify(missions);
    },

    //Mission laden, dafür ertsmal alles andere zurücksetzen
    load:function(map,mtmp){
      if(started == false && log == false){
        for(var i=0;i<waypoints.length;i++){
          waypoints[i].setMap(null);
        }
        for(var i=0;i<pointsOfInterest.length;i++){
          pointsOfInterest[i].setMap(null);
        }
        waypoints = [];
        pointsOfInterest = [];
        $rootScope.markersPOI = pointsOfInterest;
        $rootScope.markersWP = waypoints;
        wpID = 1;
        POIID = 1;
        labelIndexPOI = 0;
        labelIndexWP = 0;
        Polylines.removeAll();

        //Nun alle POIs und Marker hinzufügen
        for(var i=0;i<mtmp.pois.length;i++){
          var myLatlng = new google.maps.LatLng(mtmp.pois[i].lat,mtmp.pois[i].lng);
          stopTrack();
          addPointOfInterest(myLatlng,map);
        }
        for(var i=0;i<pointsOfInterest.length;i++){
          pointsOfInterest[i].info.content.height =  mtmp.pois[i].height;
          pointsOfInterest[i].info.content.innerHTML =  mtmp.pois[i].innerHTML;
        }

        for(var i=0;i<mtmp.wps.length;i++){
          var myLatlng = new google.maps.LatLng(mtmp.wps[i].lat,mtmp.wps[i].lng);
          stopTrack();
          addWaypoint(myLatlng,map);
        }

        //Den Inhalt der Info Windows setzen
        for(var i=0;i<waypoints.length;i++){
          waypoints[i].info.content.selectedPosition = mtmp.wps[i].selectedPosition;
          waypoints[i].info.content.height =  mtmp.wps[i].height;
          waypoints[i].info.content.time =  mtmp.wps[i].time;
          waypoints[i].info.content.innerHTML =  mtmp.wps[i].innerHTML;
          var POI = null;
          for(var k=0;k<pointsOfInterest.length;k++){
            if(pointsOfInterest[k].label.text == mtmp.wps[i].selectedPosition){
              var POI = k;
            }
          }

          //Ploylinie zeichnen wenn der geladene WP einen POI ausgewählt hatte
          if(POI != null){
            Polylines.polyPOI(waypoints[i],pointsOfInterest[POI],pointsOfInterest,map);
          }else{
            if(mtmp.wps[i].selectedPosition == 'Your Pos'){
              Polylines.polyPOI(waypoints[i],markerTrack,pointsOfInterest,map);
            }
          }
        }
        if(mtmp.track!=null){
          markerTrack.info.content.height = mtmp.track.height;
          markerTrack.info.content.innerHTML = '<p>Height: ' + mtmp.track.height +'m</br>Sattelites: '+markerTrack.info.content.sats+'</p>';
        }
        if(waypoints.length>0){
          map.setCenter(waypoints[waypoints.length-1].position);
        }
        var bounds = new google.maps.LatLngBounds();
        bounds.extend(markerCopter.getPosition());
        bounds.extend(markerTrack.getPosition());
        for (var i = 0; i < waypoints.length; i++) {
         bounds.extend(waypoints[i].getPosition());
        }
        for (var i = 0; i < pointsOfInterest.length; i++) {
         bounds.extend(pointsOfInterest[i].getPosition());
        }
        map.fitBounds(bounds);
      }
    },
    allMissions: function() {
      return missions;
    },
    removeMission: function(mtmp) {
      missions.splice(missions.indexOf(mtmp), 1);
      window.localStorage['Missions'] = JSON.stringify(missions);
    },
    initPosition:function(map){
      initPos(map);
    },
    watchPos:function(map){
      return watchCurrentPos(map);
    },
    allWP:function(){
      return waypoints;
    },
    allPOI:function(){
      return pointsOfInterest;
    },
    addWP:function(map){
      addWaypoint(map);
    },
    addPOI:function(map){
      addPointOfInterest(map);
    },

    add:function(latLng,map,selectedMarker){
      stopTrack();
      if(selectedMarker=='WP'){
        addWaypoint(latLng,map);
      }
      if(selectedMarker=='POI'){
        addPointOfInterest(latLng,map);
      }
      $rootScope.markersPOI=pointsOfInterest;
      $rootScope.markersWP=waypoints;
    },
    remove:function(map){
      if(log==false&&started==false){
        if(removeWP(map)==-1){
          removePOI(map);
        }
      }
    },
    closeAllWindows:function(){
      closeWindows();
    },
    setCopterPos:function(map){
      return setCopterMap(map);
    }
  }
        
}])