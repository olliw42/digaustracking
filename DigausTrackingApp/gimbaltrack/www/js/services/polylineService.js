angular.module('starter.services')
.factory('Polylines', ['$cordovaGeolocation',function($cordovaGeolocation){
  //Polylinien zwischen WPs und POIs
  var polylinesPOI = [];

  //Polylinie zwischen WPs
  var pathWP = new google.maps.Polyline({
    geodesic: true,
    strokeColor: '#FFFFFF',
    strokeOpacity: 1.0,
    strokeWeight: 2
  });

  //Gestrichelte Linie 
  var lineSymbol = {
    path: 'M 0,-1 0,1',
    strokeOpacity: 1,
    scale: 3,
    strokeColor: '#FFFFFF'
  };
  return{
    removeAll:function(){
      for(var i=0;i<polylinesPOI.length;i++){
        polylinesPOI[i].setMap(null);
      }
      polylinesPOI = [];
      pathWP.setMap(null);
    },
    getAll:function(){
      return polylinesPOI;
    },

    //Polylinie der WPs neu zeichen
    polyWP:function(markersWP,map){
      var flightPlanCoordinates = [];
      for(var i=0;i<markersWP.length;i++){
        flightPlanCoordinates.push(markersWP[i].position);
      }
      pathWP.setPath(flightPlanCoordinates);
      pathWP.setMap(map);
    },
    
    //Polyline zwischen WP und POI zeichnen
    polyPOI:function(markerWP,markerPOI,markersPOI,map){
      var exists = false;
      var flightPlanCoordinates = [];
      var pathPOI = new google.maps.Polyline({
        icons: [{
          icon: lineSymbol,
          offset: '0',
          repeat: '20px'
        }],
        strokeOpacity: 0
      });
      //Schauen ob schon vorhanden, dann alte löschen (Wenn ein WP eine ander Polylinie auswählt)
      for(var i=0;i<polylinesPOI.length;i++){
        if(polylinesPOI[i].idWP == markerWP.label.id ){
          exists = true;
          polylinesPOI[i].setMap(null);
          //Falls ausgewählter POI nicht 0, Polylinie anpassen und neu zeichnen
          if(markerPOI!=null){
            flightPlanCoordinates.push(markerWP.position);
            flightPlanCoordinates.push(markerPOI.position);
            polylinesPOI[i].setPath(flightPlanCoordinates);
            polylinesPOI[i].idPOI = markerPOI.label.id;
            polylinesPOI[i].setMap(map);
          }else{
            polylinesPOI.splice(i,1);    
          }
        }
      }
      
      if(exists==false&&markerPOI!=null){
        flightPlanCoordinates.push(markerWP.position);
        flightPlanCoordinates.push(markerPOI.position);
        pathPOI.setPath(flightPlanCoordinates);
        pathPOI.idWP = markerWP.label.id;
        pathPOI.idPOI = markerPOI.label.id;
        polylinesPOI[polylinesPOI.length]=pathPOI;
        polylinesPOI[polylinesPOI.length-1].setMap(map);
      }
      if(markerPOI!=null){
        //Falls die aktuelle Position ausgewählt wurde noch den Info text anpassen
        if(markerPOI.label.text==' '){
          markerWP.info.content.selectedPosition='Your Pos';
        }else{
          markerWP.info.content.selectedPosition=markerPOI.label.text;
        }
      }else{
        markerWP.info.content.selectedPosition=0;
      }
    },

    //Falls Waypoint bewegt wird müssen auch die Polylinien angepasst werden
    findPolyWP:function(markerWP,map){
      for(var i=0;i<polylinesPOI.length;i++){
        if(polylinesPOI[i].idWP == markerWP.label.id ){
          var flightPlanCoordinates = [];
          polylinesPOI[i].setMap(null);
          flightPlanCoordinates.push(markerWP.position);
          //POI Position muss gleich bleiben, die konnte man hiermit aus dem Pfad wieder übernehmen
          flightPlanCoordinates.push(polylinesPOI[i].getPath().getArray()[1]);
          polylinesPOI[i].setPath(flightPlanCoordinates);
          polylinesPOI[i].setMap(map);
        }
      }
    },

    //Ebenso falls ein POI bewegt wird
    findPolyPOI:function(markerPOI,map){
      for(var i=0;i<polylinesPOI.length;i++){
        if(polylinesPOI[i].idPOI == markerPOI.label.id ){
          var flightPlanCoordinates = [];
          polylinesPOI[i].setMap(null);
          flightPlanCoordinates.push(polylinesPOI[i].getPath().getArray()[0]);
          flightPlanCoordinates.push(markerPOI.position);
          polylinesPOI[i].setPath(flightPlanCoordinates);
          polylinesPOI[i].setMap(map);
        }
      }
    },

    //Wenn ein POI gelöscht wird müssen auch alle Polylinien dazu gelöscht werden
    removePOI:function(id,markersWP){
      for(var i=0;i<polylinesPOI.length;i++){
        if(polylinesPOI[i].idPOI == id ){
          polylinesPOI[i].setMap(null);
          for(var k=0;k<markersWP.length;k++){
            //noch Info Window des WPs anpassen
            if(markersWP[k].label.id==polylinesPOI[i].idWP){
              markersWP[k].info.content.selectedPosition=0;
              markersWP[k].info.content.innerHTML= '<p>Height: ' + markersWP[k].info.content.height +'m<br>Time: '+markersWP[k].info.content.time+'s</br>Position: '+markersWP[k].info.content.selectedPosition+'</p>';
            }
          }
          polylinesPOI.splice(i,1);
          i--;
        }
      }
    },

    //WP löschen
    removeWP:function(markerWP,markersPOI){
      for(var i=0;i<polylinesPOI.length;i++){
        if(polylinesPOI[i].idWP == markerWP.label.id){
          polylinesPOI[i].setMap(null);
          polylinesPOI.splice(i,1);
        }
      }
    }
  }
}])