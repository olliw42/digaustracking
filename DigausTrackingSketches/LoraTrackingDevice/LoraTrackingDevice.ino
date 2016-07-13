#include <SPI.h>
#include "RFM98W/RFM98W.h"
#include "mavlink/include/mavlink_types.h"
#include "mavlink/include/mavlink.h"
#include <Wire.h>
#include "Adafruit-BMP085/Adafruit_BMP085.h"
#include "RunningMedian/RunningMedian.h"
#include "TinyGPSplus/TinyGPS++.h"


TinyGPSPlus gps;
Adafruit_BMP085 bmp;

RunningMedian voltageMedian = RunningMedian(50);
RunningMedian altMedian = RunningMedian(10);

#define SS_PIN  22
#define DIO0  21

#define PIN_BLUE 3
#define PIN_GREEN 6
#define PIN_RED 4

#define SENDTIMER 300

int goproMode = 0;
int gimbalMode = 0;
int trackingStarted = 0;
int panoramaStarted = 0;
int recording = 0;
int goproConnected = 0;
int hdr = 0;
int missionId = 0;
int missionActive = 0;

double lat = 0, lng = 0, speed = 0, alt = 0, start_alt = 0, sats = 0, battery_voltage = 0;
int satellites = 0;
double copter_lat = 0, copter_lng = 0, copter_heading = 0, copter_alt = 0, copter_voltage = 0, gimbal_heading = 0;

double poi_lat = 0, poi_lng = 0, poi_alt = 0;
bool poiActive = false;

unsigned long altMillis = 0;
unsigned long sendLoraMillis = 0;
unsigned long sendBluetoothMillis = 0;
unsigned long ledBlinkMillis = 0;
unsigned long loraTimeoutMillis = 0;

double Frequency = 434.400;
double FrequencyOffset = 0.0; // TODO: Automatic Frequency Correction

bool txDone = true;
bool rxDone = true;
bool received = true;

bool blinkLed = false;
bool ledOn = true;
bool loraConnected = false;
int ledColor = 0;
unsigned long blinkTimer = 600; // int blinkTimer = 600; //to suppress warning: comparison between signed and unsigned integer expressions

bool requestAck = false;
int ackCount = 0;
int maxAckCount = 5;
bool messageReceived = false;
unsigned long msgCount = 0;
mavlink_message_t msgToSend;
uint8_t buf[MAVLINK_MAX_PACKET_LEN];

bool btCommand = false;
bool btWaypoints = false;
String btData = "";

double poiLat[15], poiLng[15], poiAlt[10];
double wpLat[15], wpLng[15], wpAlt[15];
int wpTime[15], wpPoiId[15];
int uploadStatusCounter = 0;

bool wpPoiReceived = false;
int wpCount = 0;
int poiCount = 0;

int currentWp = 0;
int currentPoi = 0;

RFM98W rfm(SS_PIN, DIO0);

union bitToUint8
{
    struct
    {
      byte b0 :1;
      byte b1 :1;
      byte b2 :1;
      byte b3 :1;
      byte b4 :1;
      byte b5 :1;
      byte b6 :1;
      byte b7 :1;
    } bits;
    uint8_t i;
};

union doubleToUint64
{
    double d;
    uint64_t i;
};


void setup(){
 
  pinMode(PIN_RED, OUTPUT); 
  pinMode(PIN_GREEN, OUTPUT); 
  pinMode(PIN_BLUE, OUTPUT); 
  
  led_off();
    
  delay(2000); 
  
  Serial.begin(115200);
  Serial1.begin(115200);
  Serial2.begin(115200);

  bmp.begin();
  
  rfm.setLoRaMode(Frequency + FrequencyOffset, BANDWIDTH_500K, SPREADING_10, ERROR_CODING_4_5, EXPLICIT_MODE, CRC_ON);
  rfm.setTxPower(PA_MED_BOOST);
  rfm.startReceiving();
}

void loop(){    

  if(rfm.checkInterrupt()){
    if(rfm.getLastMode()==RF96_MODE_RX_CONTINUOUS){
      rxDone = true;
      loraTimeoutMillis = millis();
    }
    if(rfm.getLastMode()==RF96_MODE_TX){
      txDone = true;
      rfm.startReceiving();
    }    
  }

  encode_gps();
  calculate_alt();

  send_lora();
  send_bluetooth();
  
  read_mavlink_lora();
  read_bluetooth();
  read_battery();

  checkLoraTimeout();
  intitialStart();
}

void checkLoraTimeout(){
  unsigned long now = millis();  
  if(now - loraTimeoutMillis > 1000)
    loraConnected = false;
  else
    loraConnected = true;
}

void send_bluetooth(){
  unsigned long now = millis();
  
  if(now - sendBluetoothMillis > 100){
    sendBluetoothMillis = now;  
    String message = String(lat/10) + ";";
    message += String(lng/10) + ";";  
    message += String(satellites) + ";";
    message += String(alt - start_alt,2) + ";";
    message += String(copter_lat/10) + ";";
    message += String(copter_lng/10) + ";";
    message += String(copter_alt,2) + ";";
    message += String(copter_voltage,2) + ";";
    message += String(copter_heading,2) + ";";
    message += String(gimbal_heading,2)  + ";";
    message += String(missionActive) + ";";
    message += String(missionId) + ";";
    message += String(trackingStarted) +";";
    message += String(panoramaStarted) +";";
    message += String(recording) +";";
    message += String(hdr) +";";
    message += String(gimbalMode) +";";
    message += String(goproMode) +";";
    message += String(goproConnected) +";";
    message += String((int)loraConnected) +";";
    if(messageReceived)
      message += "S;";
    else
      message += "F;";

    int checksum= 0;
    for(int i=0; i<(int)message.length(); i++) //typecast to suppress warning: comparison between signed and unsigned integer expressions
      if(message[i]!=';')
        checksum+=(int)message[i];
        
    message += String(checksum);
    Serial1.println(message);
    messageReceived = false;
  }
}

void send_lora(){
  unsigned long now = millis();
  
  if(now - sendLoraMillis > SENDTIMER && txDone){
    sendLoraMillis = now;   
    if(requestAck && ackCount<maxAckCount){
      uint16_t len = mavlink_msg_to_send_buffer(buf, &msgToSend);
      txDone = false;
      received = false; 
      rfm.sendData(buf, len);
      ackCount++;   
    }
    else{
      if(ackCount>=maxAckCount){
          requestAck = false;    
          ackCount = 0;
          messageReceived = false;
      }     
      sendGPSLora();
    }
  }
}

void sendGPSLora(){
  if(poiActive)
    mavlink_msg_gps_raw_int_pack(255, 1, &msgToSend, 0, 0, poi_lat * 10, poi_lng * 10, poi_alt * 10, 0, 0, 0, 0, 0);
  else
    mavlink_msg_gps_raw_int_pack(255, 1, &msgToSend, 0, 0, lat, lng, (alt - start_alt) * 10, 0, 0, 0, 0, 0);
    
  uint16_t len = mavlink_msg_to_send_buffer(buf, &msgToSend);
  if(txDone){
    txDone = false;
    rfm.sendData(buf, len);  
  }  
}


void read_battery(){
  voltageMedian.add(analogRead(A0)); 
  battery_voltage = voltageMedian.getAverage() * (3.3 / 1023.0) * 1.56; 

  unsigned long now = millis();
  if(now - ledBlinkMillis > blinkTimer){
    ledBlinkMillis = now; 
    if(blinkLed)
      ledOn = !ledOn;    
    else
      ledOn = true; 
  }
  if(ledOn){
    if(battery_voltage>4.19)
      ledColor = 3;
    if(battery_voltage>3.95 && battery_voltage<4.15)
      ledColor = 0;
    if(battery_voltage<3.85 && battery_voltage>3.65)
      ledColor = 1;
    if(battery_voltage<3.6)
      ledColor = 2;

    if(ledColor == 0)
      led_green();
    if(ledColor == 1)
      led_yellow();
    if(ledColor == 2)
      led_red();
    if(ledColor == 3)
      led_white();
  } 
  else{
    if(loraConnected)
      led_blue();
    else
      led_off();
  }
}

void led_off(){
  analogWrite(PIN_RED, 0);   
  analogWrite(PIN_GREEN, 0);
  analogWrite(PIN_BLUE, 0);
}

void led_red(){
  analogWrite(PIN_RED, 50);   
  analogWrite(PIN_GREEN, 0);
  analogWrite(PIN_BLUE, 0);
}

void led_green(){
  analogWrite(PIN_RED, 0);   
  analogWrite(PIN_GREEN, 75);
  analogWrite(PIN_BLUE, 0);
}

void led_blue(){
  analogWrite(PIN_RED, 0);   
  analogWrite(PIN_GREEN, 0);
  analogWrite(PIN_BLUE, 75);
}

void led_yellow(){
  analogWrite(PIN_RED, 50);   
  analogWrite(PIN_GREEN, 75);
  analogWrite(PIN_BLUE, 0);
}

void led_white(){
  analogWrite(PIN_RED, 50);   
  analogWrite(PIN_GREEN, 75);
  analogWrite(PIN_BLUE, 75);
}


void calculate_alt(){
  unsigned long now = millis();    
  if(now - altMillis > 500){
     altMillis = now;
     altMedian.add(bmp.readAltitude());
     alt = altMedian.getAverage();
  }
}

void encode_gps(){
  while(Serial2.available()>0){
    char c = Serial2.read();
    gps.encode(c);
  }
    
  lat = gps.location.lat()*10000000.0;
  lng = gps.location.lng()*10000000.0;
  satellites = gps.satellites.value();
  
  if(gps.location.isValid() && satellites>=6)
    blinkLed = true;  
  else
    blinkLed = false;
  
}


void read_mavlink_lora(){ 

  if(rxDone){
    rxDone = false;
    received = true;
    
    byte message[256];
    int length = rfm.receiveMessage(message);    

    mavlink_message_t msg = {0}; //this is to avoid warning: '*((void*)& msg +XX)' may be used uninitialized in this function 
    mavlink_status_t status;
  
    for(int i=0; i<length; i++){
      uint8_t c = message[i];
      //trying to grab msg
      if (mavlink_parse_char(MAVLINK_COMM_0, c, &msg, &status)) {
        //handle msg
         
        switch (msg.msgid) {
          case MAVLINK_MSG_ID_MISSION_CLEAR_ALL:
            {  
                  //wp cleared
                  requestAck = false;
                  ackCount = 0;
                  
                  //start sending waypoints
                  currentWp = 0;      
                  currentPoi = 0;        
                  sendNextWpPoi();
            }
            break;
          case MAVLINK_MSG_ID_COMMAND_LONG:
            {
              if(mavlink_msg_command_long_get_command(&msg) == 203 && mavlink_msg_command_long_get_param1(&msg) == mavlink_msg_command_long_get_param1(&msgToSend)){                     

                  if(mavlink_msg_command_long_get_param2(&msg) == 9){
                    //uploading to pixhawk startet
                    requestAck = false;
                    ackCount = 0;     
                    checkWpUploadStatus();              
                  }
                  else if(mavlink_msg_command_long_get_param2(&msg) == 10){
                    requestAck = false;
                    ackCount = 0;
                    if(mavlink_msg_command_long_get_param3(&msg) != 2){
                      if(uploadStatusCounter<5){
                        checkWpUploadStatus();
                        uploadStatusCounter ++;
                      }
                      else
                        uploadStatusCounter = 0;
                    }
                    else
                      messageReceived = true;
                  }
                  else{
                    requestAck = false;
                    ackCount = 0;
                    messageReceived = true;
                  }
                  
              }
            }
            break;
          case MAVLINK_MSG_ID_GPS_RAW_INT:
            {
              if(mavlink_msg_gps_raw_int_get_fix_type(&msg) != 0){
                if(mavlink_msg_gps_raw_int_get_epv(&msg) == mavlink_msg_gps_raw_int_get_epv(&msgToSend)){    
                  //waypoint recieved
                  requestAck = false;
                  ackCount = 0;
                                             
                  //send next waypoint or Poi
                  sendNextWpPoi();                                   
                }
              }
              else{
                copter_lat = mavlink_msg_gps_raw_int_get_lat(&msg);// / 10000000.0f;
                copter_lng = mavlink_msg_gps_raw_int_get_lon(&msg);// / 10000000.0f;

                doubleToUint64 copterHeading;
                copterHeading.i = mavlink_msg_gps_raw_int_get_time_usec(&msg);
                copter_heading = copterHeading.d;
                
                gimbal_heading = mavlink_msg_gps_raw_int_get_alt(&msg) / 10.0;
                copter_alt = mavlink_msg_gps_raw_int_get_eph(&msg) / 10.0;
                copter_voltage = mavlink_msg_gps_raw_int_get_epv(&msg) / 1000.0;

                bitToUint8 states;
                states.i = mavlink_msg_gps_raw_int_get_satellites_visible(&msg);                
                
                goproMode = states.bits.b0;
                gimbalMode = states.bits.b1;
                trackingStarted = states.bits.b2;
                panoramaStarted = states.bits.b3;
                goproConnected = states.bits.b4;
                hdr = states.bits.b5;
                recording = states.bits.b6;
                missionActive = states.bits.b7;
              }
            }
            break;
           
          default:
            break;
        }
        
      }
    }
  }
}

void read_bluetooth(){ 

  while(Serial1.available()>0){
    char c = Serial1.read();
    if(c=='\n')
      decode_bluetooth();
    else
      btData +=c ;
  }
}

void decode_bluetooth(){
  messageReceived = false;
  
  if(btData == "T"){
    if(trackingStarted == 1)
      startTracking(0);
    else
      startTracking(1);
  }

  if(btData == "V"){
    if(recording == 1)  
      startVideo(0);
    else
      startVideo(1);
  }
  
  if(btData == "P"){
    if(panoramaStarted == 1)
      startPanorama(0);
    else
      startPanorama(1);
  }
  
  if(btData == "PH")
    startVideo(1);

  if(btData == "C")
    recenterGimbal();
    
  if(btData == "PHV"){
    if(goproMode == 0)
      setGoproMode(1);
    else
      setGoproMode(0);
  }

  if(btData == "PAN"){
    if(gimbalMode == 1)
      setPanMode(0);
    else
      setPanMode(1);
  }

  if(btData == "HDR"){
    if(hdr == 1)
      setHDR(0);
    else
      setHDR(1);
  }

  if(btData.substring(0,1) == "M"){
    missionId = btData.substring(2).toInt();
  }

  if(btData.substring(0,3) == "POI"){
    String data = btData;
    btData = btData.substring(4);

    //pois
    poiCount = btData.substring(0,btData.indexOf(";")).toInt();
    btData = btData.substring(btData.indexOf(";") + 1);
     
    for(int i=0; i<poiCount; i++){  
      double tmp_lat = btData.substring(0,btData.indexOf(",")).toInt();    
      btData = btData.substring(btData.indexOf(",") + 1); 
       
      double tmp_lng = btData.substring(0,btData.indexOf(",")).toInt();  
      btData = btData.substring(btData.indexOf(",") + 1); 
       
      double tmp_alt = btData.substring(0,btData.indexOf(";")).toInt();
      btData = btData.substring(btData.indexOf(";") + 1);

      poiLat[i] = tmp_lat;
      poiLng[i] = tmp_lng;
      poiAlt[i] = tmp_alt;
    }
    int poiChecksum = btData.substring(0,btData.indexOf(";")).toInt();
    
    int calc_poiChecksum = 0;
    for(int i=0; i<(int)data.length(); i++) //type cast to suppress warning: comparison between signed and unsigned integer expressions
      if(data[i]!=';' && i < data.lastIndexOf(";"))
        calc_poiChecksum+=(int)data[i];

    if(poiChecksum != calc_poiChecksum){
      poiCount = 0;
      wpPoiReceived = false;
    }       
    else
      wpPoiReceived = true;
  }

  if(btData.substring(0,2) == "WP"){
    String data = btData;
    btData = btData.substring(3);

    //waypoints
    wpCount = btData.substring(0,btData.indexOf(";")).toInt();
    btData = btData.substring(btData.indexOf(";") + 1);
     
    for(int i=0; i<wpCount; i++){  
      double tmp_lat = btData.substring(0,btData.indexOf(",")).toInt();    
      btData = btData.substring(btData.indexOf(",") + 1); 
       
      double tmp_lng = btData.substring(0,btData.indexOf(",")).toInt();  
      btData = btData.substring(btData.indexOf(",") + 1); 
       
      double tmp_alt = btData.substring(0,btData.indexOf(",")).toInt();
      btData = btData.substring(btData.indexOf(",") + 1);

      int tmp_time = btData.substring(0,btData.indexOf(",")).toInt();
      btData = btData.substring(btData.indexOf(",") + 1);
      
      int tmp_poiId = btData.substring(0,btData.indexOf(";")).toInt();
      btData = btData.substring(btData.indexOf(";") + 1);

      wpLat[i] = tmp_lat*10.0;
      wpLng[i] = tmp_lng*10.0;
      wpAlt[i] = tmp_alt;
      wpTime[i] = tmp_time;
      wpPoiId[i] = tmp_poiId;   
    }
    int wpChecksum = btData.substring(0,btData.indexOf(";")).toInt();
    
    int calc_wpChecksum = 0;
    for(int i=0; i<(int)data.length(); i++)  //type cast to suppress warning: comparison between signed and unsigned integer expressions
      if(data[i]!=';' && i < data.lastIndexOf(";"))
        calc_wpChecksum+=(int)data[i];
             
    if(wpChecksum != calc_wpChecksum || !wpPoiReceived){
      wpCount = 0;
      wpPoiReceived = false;
    }       
    else{
      wpPoiReceived = true;
      upload_wpPoi();
    }        
  }
  
  if(btData.substring(0,1) == "S"){
    btData = btData.substring(2);
    int pitchOffset = btData.substring(0,btData.indexOf(";")).toInt();
    
    btData = btData.substring(btData.indexOf(";") + 1);
    int yawOffset = btData.substring(0,btData.indexOf(";")).toInt();
    
    setOffset(-yawOffset, pitchOffset);
  }
  
  if(btData.substring(0,3) == "POS"){
    String data = btData;
    btData = btData.substring(4);
    
    double tmp_lat = btData.substring(0,btData.indexOf(";")).toInt();    
    btData = btData.substring(btData.indexOf(";") + 1);  
    
    double tmp_lng = btData.substring(0,btData.indexOf(";")).toInt();  
    btData = btData.substring(btData.indexOf(";") + 1);  
   
    double tmp_alt = btData.substring(0,btData.indexOf(";")).toInt();
    btData = btData.substring(btData.indexOf(";") + 1);  
   
    int checksum = btData.substring(0,btData.indexOf(";")).toInt();
    
    int calc_checksum = 0;
    for(int i=0; i<(int)data.length(); i++) //type cast to suppress warning: comparison between signed and unsigned integer expressions
      if(data[i]!=';' && i < data.lastIndexOf(";"))
        calc_checksum+=(int)data[i];
        
    if(checksum == calc_checksum){
      poi_lat = tmp_lat;
      poi_lng = tmp_lng;
      poi_alt = tmp_alt;
      poiActive = true;
      messageReceived = true;
    }      

  }

  if(btData.substring(0,2) == "TD"){
    poiActive = false;
  }

  btData = "";
}

void upload_wpPoi(){
  mavlink_msg_mission_clear_all_pack(255, 1, &msgToSend, 1, 0);
  requestAck = true; 
}

void sendNextWpPoi(){
  if(currentWp < wpCount){
    //send wp
    mavlink_msg_gps_raw_int_pack(255, 1, &msgToSend, wpTime[currentWp], 1, wpLat[currentWp], wpLng[currentWp], wpAlt[currentWp], wpPoiId[currentWp], msgCount, 0, 0, currentWp);
    currentWp++;
    requestAck = true;
    msgCount++;
  }
  else if(currentPoi < wpCount){
    //send Poi
    mavlink_msg_gps_raw_int_pack(255, 1, &msgToSend, 0, 2, poiLat[currentWp], poiLng[currentWp], poiAlt[currentWp], 0, msgCount, 0, 0, currentPoi);
    currentPoi++;
    requestAck = true;
    msgCount++;
  }
  else{
    //finished
    mavlink_msg_command_long_pack(255, 1, &msgToSend, 71, 67, 203, 0, msgCount, 9, 0, 0, 0, 0, 0);
    requestAck = true;
    msgCount++;
  }
}

void checkWpUploadStatus(){
  mavlink_msg_command_long_pack(255, 1, &msgToSend, 71, 67, 203, 0, msgCount, 10, 0, 0, 0, 0, 0);
  requestAck = true;
  msgCount++;
}

void intitialStart(){
  unsigned long now = millis();
  if(now > 10000 && start_alt == 0){
    start_alt = altMedian.getAverage();
    startTracking(1);
  }
}

void startTracking(int on){
  mavlink_msg_command_long_pack(255, 1, &msgToSend, 71, 67, 203, 0, msgCount, 1, on, 0, 0, 0, 0);
  requestAck = true;
  msgCount++;
}

void startPanorama(int on){
  mavlink_msg_command_long_pack(255, 1, &msgToSend, 71, 67, 203, 0, msgCount, 2, on, 0, 0, 0, 0);
  requestAck = true;
  msgCount++;
}

void startVideo(int on){
  mavlink_msg_command_long_pack(255, 1, &msgToSend, 71, 67, 203, 0, msgCount, 3, on, 0, 0, 0, 0);
  requestAck = true;
  msgCount++;
}

void setHDR(int val){
  mavlink_msg_command_long_pack(255, 1, &msgToSend, 71, 67, 203, 0, msgCount, 4, val, 0, 0, 0, 0);
  requestAck = true;
  msgCount++;
}

void setGoproMode(int val){
  mavlink_msg_command_long_pack(255, 1, &msgToSend, 71, 67, 203, 0, msgCount, 5, val, 0, 0, 0, 0);
  requestAck = true;
  msgCount++;
}

void setPanMode(int val){
  mavlink_msg_command_long_pack(255, 1, &msgToSend, 71, 67, 203, 0, msgCount, 6, val, 0, 0, 0, 0);
  requestAck = true;
  msgCount++;
}

void setOffset(float yaw, float pitch){
  mavlink_msg_command_long_pack(255, 1, &msgToSend, 71, 67, 203, 0, msgCount, 7, yaw, pitch, 0, 0, 0);
  requestAck = true;
  msgCount++;
}

void recenterGimbal(){
  mavlink_msg_command_long_pack(255, 1, &msgToSend, 71, 67, 203, 0, msgCount, 8, 0, 0, 0, 0, 0);
  requestAck = true;
  msgCount++;
}


