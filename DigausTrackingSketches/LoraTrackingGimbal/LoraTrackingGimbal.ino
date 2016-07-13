#include <SPI.h>
#include "RFM98W/RFM98W.h"
#include "mavlink/include/mavlink_types.h"
#include "mavlink/include/mavlink.h"
#include <Wire.h>
#include "ESP8266/ESP8266.h"

#define ToDeg(x) (x*57.2957795131)  // *180/pi

#define SS_PIN  22
#define RESET  23
#define DIO0  21

#define RETRACT_PIN_ON 16
#define RETRACT_PIN_DIR 17

#define SPEED_FACTOR 0
#define GIMBAL_ACCEL_PITCH 350
#define GIMBAL_ACCEL_YAW 250
#define GIMBAL_SPEED 0


double lat, lng, speed, alt;
double copter_lat = 0, copter_lng = 0, copter_fix_type = 0, copter_satellites_visible = 0, copter_heading = 0, copter_alt = 0, copter_heading_start = 0;
uint16_t copter_voltage = 0;

double pitchOffset = 0, yawOffset = 0;
double prevYaw = 0;
int turnCnt = 0;

//waypoint variables
double poiLat[15], poiLng[15], poiAlt[10];
double wpLat[15], wpLng[15], wpAlt[15];
int wpTime[15], wpPoiId[15];

int wpCount = 0;
int poiCount = 0;

int waypointsReceived = 0;

double gimbalPitch = 0, gimbalYaw = 0;
double gimbalPitchOffset = -0.01;

bool goproConnected = false;
bool goproState = false;
byte gimbalMode = 0;

unsigned long getStorm32DataMillis = 100;
int getStorm32DataCount = 0;
float lastMsgIndex = -1;

//panorama variables
bool panoramaStarted = false;
unsigned long panoramaTimer = 0;
bool takePanoramaPhoto = false;
unsigned long photoDelay = 1000; //int photoDelay = 1000;

int pitchPanoramaCount = 0;
int maxPitchPanoramaCount = 5;
int startPitchAngle = -20;
int panoramaPitchStep = 20;

int yawPanoramaCount = 0;
int maxYawPanoramaCount = 9;
bool yawDirectionPos = true;
double panoramaYawStep = 40;

double yawAngle = 0, pitchAngle = 0;

//hdr variables
bool hdr = false;
bool takeHdrPhoto = false;
int hdrPhotoCount = 0;
unsigned long hdrPhotoTimer = 0;

bool trackingStarted = false;
bool missionActive = false;

//rfm98w variables
double Frequency = 434.400;
double FrequencyOffset = 0.0; // TODO: Automatic Frequency Correction

bool txDone;
bool rxDone;

RFM98W rfm(SS_PIN, DIO0);


//gopro connection and commands
ESP8266 wifi(Serial1, 115200);
const char* host = "10.5.5.9";
const int httpPort = 80;

String start = "command/shutter?p=1";
String stopp = "command/shutter?p=0";


String video = "command/mode?p=0";
String photo = "command/mode?p=1";
String multi = "command/mode?p=2";


//variables for gopro settings
unsigned long getGoproSettingsMillis = 0;
String valueString = "";
int valueNumber = -1;
int settingOrState = 1;
String prevString = "";
bool valueStarted = false;

int settingsArray[100];
int stateArray[100];

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

  txDone = true;
  rxDone = true;
   
  pinMode(RETRACT_PIN_ON, OUTPUT);
  pinMode(RETRACT_PIN_DIR, OUTPUT);
  digitalWrite(RETRACT_PIN_ON, LOW);
    
  Serial.begin(57600);
  Serial1.begin(115200); //wifi
  Serial2.begin(57600); //pixhawk
  Serial3.begin(115200); //storm32

  delay(8000);
  wifi.setOprToStation();
  if(wifi.joinAP("GoProHero4", "spellbrink26")){
      goproConnected = true;
      wifi.createTCP(host, httpPort);
      getGoproState();
      Serial.println("connected");
  }
  
  rfm.setLoRaMode(Frequency + FrequencyOffset, BANDWIDTH_500K, SPREADING_10, ERROR_CODING_4_5, EXPLICIT_MODE, CRC_ON);
  rfm.setTxPower(PA_MAX_BOOST);
  rfm.startReceiving();

}

void loop(){   
  
  if(rfm.checkInterrupt()){
    if(rfm.getLastMode()==RF96_MODE_RX_CONTINUOUS)
      rxDone = true;         
    if(rfm.getLastMode()==RF96_MODE_TX){
      txDone = true;    
      rfm.startReceiving();
    }
  }
  read_mavlink_lora();
  read_mavlink_pixhawk();
  read_mavlink_storm32();
  
  execute_tasks();

}

void execute_tasks(){
  if(panoramaStarted)
    takePanorama();
    
  if(takeHdrPhoto)
    takeHdrPhotos();

  requestStorm32Settings();
  readGoproState();
}

void read_mavlink_lora(){

  if(rxDone){
    rxDone = false;
    byte message[256];
    int packet_size = rfm.receiveMessage(message);
    encode_mavlink_lora(message, packet_size);    
  }
}

void read_mavlink_pixhawk(){ 
  mavlink_message_t msg;
  mavlink_status_t status;

  while (Serial2.available() > 0) {
    uint8_t c = Serial2.read();
    //trying to grab msg
    if (mavlink_parse_char(MAVLINK_COMM_1, c, &msg, &status)) {
      //handle msg
      switch (msg.msgid) {
        case MAVLINK_MSG_ID_HEARTBEAT:
          {
            sendHeartbeat();
          }
          break;
        case MAVLINK_MSG_ID_MISSION_ACK:
          {
            if(mavlink_msg_mission_ack_get_type(&msg) == 0);
              waypointsReceived++;
          }
          break;
        case MAVLINK_MSG_ID_MISSION_REQUEST:
          {
            int id = mavlink_msg_mission_request_get_seq(&msg);            
            uploadWaypoint(id);
          }
          break;
        case MAVLINK_MSG_ID_GPS_RAW_INT:
          {   
            copter_lat = mavlink_msg_gps_raw_int_get_lat(&msg);// / 10000000.0f;
            copter_lng = mavlink_msg_gps_raw_int_get_lon(&msg);// / 10000000.0f;
            copter_fix_type = mavlink_msg_gps_raw_int_get_fix_type(&msg);
            copter_satellites_visible = mavlink_msg_gps_raw_int_get_satellites_visible(&msg);
            if(trackingStarted)
              trackTarget();
          }
          break;
        case MAVLINK_MSG_ID_VFR_HUD:
          {
            copter_alt = mavlink_msg_vfr_hud_get_alt(&msg);
          }
          break;
        case MAVLINK_MSG_ID_SYS_STATUS:
          {
            copter_voltage = mavlink_msg_sys_status_get_voltage_battery(&msg);
          }
          break;
        case MAVLINK_MSG_ID_ATTITUDE:
          {
            copter_heading = ToDeg(mavlink_msg_attitude_get_yaw(&msg));
          }
          break;           
        default:
          break;
      }
      
    }
  }
}

void read_mavlink_storm32(){ 
  
  mavlink_message_t msg;
  mavlink_status_t status;
  
  while (Serial3.available() > 0) {
    
    uint8_t c = Serial3.read();
    //trying to grab msg
    if (mavlink_parse_char(MAVLINK_COMM_2, c, &msg, &status)) {   
      switch (msg.msgid) {
        case MAVLINK_MSG_ID_ATTITUDE:
          {
            gimbalYaw = ToDeg(mavlink_msg_attitude_get_yaw(&msg));
            gimbalPitch = ToDeg(mavlink_msg_attitude_get_pitch(&msg));
          }
          break;
          
        case MAVLINK_MSG_ID_PARAM_VALUE:
          {
            if(mavlink_msg_param_value_get_param_index(&msg) == 66){
              union intFloat
              {
                  int i;
                  float f;
              } val;
              val.f = mavlink_msg_param_value_get_param_value(&msg);
              gimbalMode = val.i;
            }         
            if(mavlink_msg_param_value_get_param_index(&msg) == 47){
              union intFloat
              {
                  int i;
                  float f;
              } val;
              val.f = mavlink_msg_param_value_get_param_value(&msg);
              if(val.i > 0)
                gimbalPitchOffset = ((double)val.i) / 10.0;
              else 
                gimbalPitchOffset = 0;
            }             
          }
          break;
        default:
          break;
      }
    }  
  }
  
}


void encode_mavlink_lora(byte *message, int length){
  mavlink_message_t msg;
  mavlink_status_t status;

  for(int i=0; i<length; i++){
    uint8_t c = message[i];
    //trying to grab msg
    if (mavlink_parse_char(MAVLINK_COMM_0, c, &msg, &status)) {

      uint8_t buf[MAVLINK_MAX_PACKET_LEN];
      uint16_t len = mavlink_msg_to_send_buffer(buf, &msg);      
      
      switch (msg.msgid) {
        case MAVLINK_MSG_ID_MISSION_CLEAR_ALL:
          {
            //clear waypoints and pois
            waypointsReceived = 0;
            Serial2.write(buf,len);
            for(int i=0; i<15; i++){
              wpCount = 0;
              poiCount = 0;
            }
            //send ack
            txDone = false;
            rfm.sendData(buf, len);            
          }
          break;
        case MAVLINK_MSG_ID_COMMAND_LONG:
          {
            int command = mavlink_msg_command_long_get_command(&msg);
            if(command == 203){  
              if(lastMsgIndex != mavlink_msg_command_long_get_param1(&msg)){
                lastMsgIndex = mavlink_msg_command_long_get_param1(&msg);
                
                //tracking
                if(mavlink_msg_command_long_get_param2(&msg) == 1){
                  if(mavlink_msg_command_long_get_param3(&msg) == 1)
                    startStopTracking(true);
                  else
                    startStopTracking(false);
                }
                //panorama
                else if(mavlink_msg_command_long_get_param2(&msg) == 2){
                  if(mavlink_msg_command_long_get_param3(&msg) == 1)
                    startStopPanorama(true);
                  else
                    startStopPanorama(false);
                }
                //take photo/video
                else if(mavlink_msg_command_long_get_param2(&msg) == 3){
                  if(mavlink_msg_command_long_get_param3(&msg) == 1){
                    if(hdr && stateArray[43] == 1)
                      takeHdrPhoto = true;
                    else                
                      triggerGopro(true);
                  }
                  else             
                    triggerGopro(false);                               
                }
                //enable/disable hdr
                else if(mavlink_msg_command_long_get_param2(&msg) == 4){
                  if(mavlink_msg_command_long_get_param3(&msg) == 1)
                    hdr = true;
                  else
                    hdr = false;
                }
                //change gopro mode
                else if(mavlink_msg_command_long_get_param2(&msg) == 5){
                  if(mavlink_msg_command_long_get_param3(&msg) == 1)
                    setGoproMode(1);
                  else
                    setGoproMode(0);
                }
                //gimbal pan mode
                else if(mavlink_msg_command_long_get_param2(&msg) == 6){
                  if(mavlink_msg_command_long_get_param3(&msg) == 1)
                    setPanMode(1);
                  else
                    setPanMode(0);
                }  
                //yaw and pitch offset
                else if(mavlink_msg_command_long_get_param2(&msg) == 7){
                  yawOffset = mavlink_msg_command_long_get_param3(&msg);
                  pitchOffset = mavlink_msg_command_long_get_param4(&msg);
                }    
                //recenter
                else if(mavlink_msg_command_long_get_param2(&msg) == 8){
                  recenter();
                }   
                //wp/poi upload finished
                else if(mavlink_msg_command_long_get_param2(&msg) == 9){
                  requestWaypointUpload();
                }      
                else if(mavlink_msg_command_long_get_param2(&msg) == 10){
                    mavlink_msg_command_long_pack(255, 1, &msg, 71, 67, 203, 0, mavlink_msg_command_long_get_param1(&msg), 10, waypointsReceived, 0, 0, 0, 0);
                    len = mavlink_msg_to_send_buffer(buf, &msg);
                }        
              }
              txDone = false;
              rfm.sendData(buf, len); 
            }
          }
          break;
        case MAVLINK_MSG_ID_GPS_RAW_INT:
          {
            //waypoint message
            if(mavlink_msg_gps_raw_int_get_fix_type(&msg) != 0){
              //send ack
              txDone = false;
              rfm.sendData(buf, len);
              
              int type = mavlink_msg_gps_raw_int_get_fix_type(&msg);
              int cnt = mavlink_msg_gps_raw_int_get_satellites_visible(&msg);
                  
              if(type == 1){
                wpLat[cnt] = mavlink_msg_gps_raw_int_get_lat(&msg);// / 10000000.0f;
                wpLng[cnt] = mavlink_msg_gps_raw_int_get_lon(&msg);// / 10000000.0f;
                wpAlt[cnt] = mavlink_msg_gps_raw_int_get_alt(&msg);
                wpTime[cnt] = mavlink_msg_gps_raw_int_get_time_usec(&msg);
                wpPoiId[cnt] = mavlink_msg_gps_raw_int_get_eph(&msg);
                wpCount = cnt + 1;
              }
              if(type == 2){
                poiLat[cnt] = mavlink_msg_gps_raw_int_get_lat(&msg);// / 10000000.0f;
                poiLng[cnt] = mavlink_msg_gps_raw_int_get_lon(&msg);// / 10000000.0f;
                poiAlt[cnt] = mavlink_msg_gps_raw_int_get_alt(&msg);
                poiCount = cnt + 1;
              }            
            }
            //gps tracking message
            else{
              sendCopterDataToGround();

              if(!panoramaStarted && !takeHdrPhoto && goproState)
                getGoproState();
              goproState = !goproState;
              
              lat = mavlink_msg_gps_raw_int_get_lat(&msg);// / 10000000.0f;
              lng = mavlink_msg_gps_raw_int_get_lon(&msg);// / 10000000.0f;
              alt = mavlink_msg_gps_raw_int_get_alt(&msg) / 10.0;
              if(trackingStarted)
                trackTarget();           
            }
          }
          break;
        default:
          {
            sendCopterDataToGround();
          }
          break;
      }
      
    }

  }
}

void requestWaypointUpload(){
  mavlink_message_t msg;
  uint8_t buf[MAVLINK_MAX_PACKET_LEN];
  mavlink_msg_mission_count_pack(250, 1, &msg, 1, 0, wpCount + 1);
  uint16_t len = mavlink_msg_to_send_buffer(buf, &msg);
  Serial2.write(buf, len);

}
void uploadWaypoint(int id){
  int pos = id;
  if(id>0)
    pos-=1;
    
  mavlink_message_t msg;
  uint8_t buf[MAVLINK_MAX_PACKET_LEN];
  mavlink_msg_mission_item_pack(250, 1, &msg, 1, 0, id, MAV_FRAME_GLOBAL_RELATIVE_ALT, MAV_CMD_NAV_WAYPOINT, 0, 1, 1, wpTime[pos], 0, 0, wpLat[pos]/10000000.0f, wpLng[pos]/10000000.0f, wpAlt[pos]);
  uint16_t len = mavlink_msg_to_send_buffer(buf, &msg);
  Serial2.write(buf, len);
}


void sendHeartbeat(){
  mavlink_message_t msg;
  uint8_t buf[MAVLINK_MAX_PACKET_LEN];
  mavlink_msg_heartbeat_pack (250, 1, &msg, MAV_TYPE_GCS, MAV_AUTOPILOT_INVALID, MAV_MODE_FLAG_STABILIZE_ENABLED, 0, MAV_STATE_ACTIVE);
  uint16_t len = mavlink_msg_to_send_buffer(buf, &msg);
  Serial2.write(buf, len);
}

void startStopPanorama(bool on){
  if(on){

    union intFloat
    {
        int i;
        float f;
    } val;
    val.i = 0;

    mavlink_message_t msg;
    uint8_t buf[MAVLINK_MAX_PACKET_LEN];
    
    //pitch accel
    mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 50, val.f, 0.0, 0.0, 0.0, 0.0, 0.0);
    uint16_t len = mavlink_msg_to_send_buffer(buf, &msg);
    Serial3.write(buf, len);

    //yaw accel
    mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 64, val.f, 0.0, 0.0, 0.0, 0.0, 0.0);
    len = mavlink_msg_to_send_buffer(buf, &msg);
    Serial3.write(buf, len);

    //pitch speed
    mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 49, val.f, 0.0, 0.0, 0.0, 0.0, 0.0);
    len = mavlink_msg_to_send_buffer(buf, &msg);
    Serial3.write(buf, len);

    //yaw speed
    mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 63, val.f, 0.0, 0.0, 0.0, 0.0, 0.0);
    len = mavlink_msg_to_send_buffer(buf, &msg);
    Serial3.write(buf, len);
      
    panoramaStarted = true; 
    panoramaTimer = millis() + 1000;  
    yawPanoramaCount = 0; 
    pitchPanoramaCount = 0; 
    pitchAngle = startPitchAngle;
    yawAngle = 0; 
    recenter();
  }
  else{
    mavlink_message_t msg;
    uint8_t buf[MAVLINK_MAX_PACKET_LEN];

    //pitch accel 
    mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 50, 0.0, 0.0, 0.0, 0.0, 0.0, 83.0f);
    uint16_t len = mavlink_msg_to_send_buffer(buf, &msg);
    Serial3.write(buf, len);

    //yaw accel 1
    mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 64, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
    len = mavlink_msg_to_send_buffer(buf, &msg);
    Serial3.write(buf, len);
    
    //yaw accel 2
    mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 64, 0.0, 0.0, 0.0, 0.0, 0.0, 83.0f);
    len = mavlink_msg_to_send_buffer(buf, &msg);
    Serial3.write(buf, len);

    //pitch speed
    mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 49, 0.0, 0.0, 0.0, 0.0, 0.0, 83.0f);
    len = mavlink_msg_to_send_buffer(buf, &msg);
    Serial3.write(buf, len);

    //yaw speed
    mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 63, 0.0, 0.0, 0.0, 0.0, 0.0, 83.0f);
    len = mavlink_msg_to_send_buffer(buf, &msg);
    Serial3.write(buf, len);
      
    panoramaStarted = false; 
    yawPanoramaCount = 0; 
    pitchPanoramaCount = 0;
    recenter();
  }
  
}

void takePanorama(){
  unsigned long now = millis();

  unsigned long timeToWait = 2000; //XX  int timeToWait = 2000;
  if(hdr)
    timeToWait = 7000;
    
  if((now - panoramaTimer) > timeToWait){
    panoramaTimer = now;    
    setAngles(pitchAngle, yawAngle);
    takePanoramaPhoto = true;
    if(yawPanoramaCount < maxYawPanoramaCount){
      if(yawDirectionPos)
        yawAngle += panoramaYawStep;
      else
        yawAngle -= panoramaYawStep;
      yawPanoramaCount++;
    }
    else{
      pitchAngle += panoramaPitchStep;
      pitchPanoramaCount++;
      yawDirectionPos=!yawDirectionPos;
      yawPanoramaCount = 0;
    }
    if(pitchPanoramaCount > maxPitchPanoramaCount)
      startStopPanorama(false);
    
  }
  
  if((now - panoramaTimer) > photoDelay){
    if(takePanoramaPhoto){
      if(hdr)
        takeHdrPhoto = true;
      else
       triggerGopro(true); 
       
      takePanoramaPhoto = false;
    }
  }
}

void takeHdrPhotos(){
  unsigned long now = millis();  
  if(hdrPhotoCount == 0 && (now - hdrPhotoTimer) > 1750){
    hdrPhotoTimer = now;
    hdrPhotoCount = 1;
    setGoproExposure(0); 
    triggerGopro(true);
  }
  else if(hdrPhotoCount == 1 && (now - hdrPhotoTimer) > 1750){
    hdrPhotoTimer = now;
    hdrPhotoCount = 2;
    setGoproExposure(8);
    triggerGopro(true);
  }
  else if(hdrPhotoCount == 2 && (now - hdrPhotoTimer) > 1750){
    hdrPhotoTimer = now;
    hdrPhotoCount = 0;
    takeHdrPhoto = false;
    setGoproExposure(4);
    triggerGopro(true);
  }
}


void sendCopterDataToGround(){

  uint16_t copter_alt_tmp = 0;
  if(copter_alt>0)
    copter_alt_tmp = copter_alt * 10.0;
    
  doubleToUint64 copterHeading;
  copterHeading.d = copter_heading;

  int recording = 0;
  if(stateArray[13] > 0)
    recording = 1;

  bitToUint8 states;
  states.bits.b0 = stateArray[43]; //gopro mode
  states.bits.b1 = gimbalMode;
  states.bits.b2 = trackingStarted;
  states.bits.b3 = panoramaStarted;
  states.bits.b4 = goproConnected;
  states.bits.b5 = hdr;
  states.bits.b6 = recording;
  states.bits.b7 = missionActive;
  
  mavlink_message_t msg;
  uint8_t buf[MAVLINK_MAX_PACKET_LEN];
  mavlink_msg_gps_raw_int_pack(250, 1, &msg, copterHeading.i, 0, copter_lat, copter_lng, gimbalYaw * 10.0, copter_alt_tmp, copter_voltage, 0.0, 0.0, states.i);
  uint16_t len = mavlink_msg_to_send_buffer(buf, &msg);
  if(txDone){
    txDone = false;
    rfm.sendData(buf, len);  
  }  
}


void requestStorm32Settings(){
    
  unsigned long now = millis();
  
  if(getStorm32DataCount == 0 && (now - getStorm32DataMillis) > 250){
    getStorm32DataMillis = now;
    getStorm32DataCount = 1;
    
    mavlink_message_t msg;
    uint8_t buf[MAVLINK_MAX_PACKET_LEN];
    mavlink_msg_param_request_read_pack(250, 1, &msg, 71, 67, "", 66);
    uint16_t len = mavlink_msg_to_send_buffer(buf, &msg);
    Serial3.write(buf, len);   
  }

  if(getStorm32DataCount == 1 && (now - getStorm32DataMillis) > 250){
    if(gimbalPitchOffset==-0.01){
      getStorm32DataMillis = now;
        
      mavlink_message_t msg;
      uint8_t buf[MAVLINK_MAX_PACKET_LEN];
      mavlink_msg_param_request_read_pack(250, 1, &msg, 71, 67, "", 47);
      uint16_t len = mavlink_msg_to_send_buffer(buf, &msg);
      Serial3.write(buf, len);    
    }
    getStorm32DataCount = 2;
  }
  
  if(getStorm32DataCount == 2 && (now - getStorm32DataMillis) > 250){
    getStorm32DataMillis = now;
    getStorm32DataCount = 0;
    
    mavlink_message_t msg;
    uint8_t buf[MAVLINK_MAX_PACKET_LEN];
    mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 1234, 0, 0, 0, 0, 0, 0, 0, 0);
    uint16_t len = mavlink_msg_to_send_buffer(buf, &msg);
    Serial3.write(buf, len);   
  }
}


void startStopTracking(bool on){

  trackingStarted = on;
  if(on){
 
      copter_heading_start = copter_heading;
      union intFloat
      {
          int i;
          float f;
      } val;

      mavlink_message_t msg;
      uint8_t buf[MAVLINK_MAX_PACKET_LEN];

      val.i = GIMBAL_ACCEL_PITCH;       
      //pitch accel
      mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 50, val.f, 0.0, 0.0, 0.0, 0.0, 0.0);
      uint16_t len = mavlink_msg_to_send_buffer(buf, &msg);
      Serial3.write(buf, len);

      //yaw accel 1
      mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 64, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
      len = mavlink_msg_to_send_buffer(buf, &msg);
      Serial3.write(buf, len);

      val.i = GIMBAL_ACCEL_YAW;
      //yaw accel 2
      mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 64, val.f, 0.0, 0.0, 0.0, 0.0, 0.0);
      len = mavlink_msg_to_send_buffer(buf, &msg);
      Serial3.write(buf, len);

      val.i = GIMBAL_SPEED;          
      //pitch speed
      mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 49, val.f, 0.0, 0.0, 0.0, 0.0, 0.0);
      len = mavlink_msg_to_send_buffer(buf, &msg);
      Serial3.write(buf, len);

      //yaw speed
      mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 63, val.f, 0.0, 0.0, 0.0, 0.0, 0.0);
      len = mavlink_msg_to_send_buffer(buf, &msg);
      Serial3.write(buf, len);

      setPanMode(1);
      
  }
  else{            
    mavlink_message_t msg;
    uint8_t buf[MAVLINK_MAX_PACKET_LEN];

    //pitch accel 
    mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 50, 0.0, 0.0, 0.0, 0.0, 0.0, 83.0f);
    uint16_t len = mavlink_msg_to_send_buffer(buf, &msg);
    Serial3.write(buf, len);

    //yaw accel 1
    mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 64, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
    len = mavlink_msg_to_send_buffer(buf, &msg);
    Serial3.write(buf, len);
    
    //yaw accel 2
    mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 64, 0.0, 0.0, 0.0, 0.0, 0.0, 83.0f);
    len = mavlink_msg_to_send_buffer(buf, &msg);
    Serial3.write(buf, len);

    //pitch speed
    mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 49, 0.0, 0.0, 0.0, 0.0, 0.0, 83.0f);
    len = mavlink_msg_to_send_buffer(buf, &msg);
    Serial3.write(buf, len);

    //yaw speed
    mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 63, 0.0, 0.0, 0.0, 0.0, 0.0, 83.0f);
    len = mavlink_msg_to_send_buffer(buf, &msg);
    Serial3.write(buf, len);

  }
    
}

void trackTarget(){

  double tmp_lat = (copter_lat/10000000.0f + lat/10000000.0f) / 2.0 * PI / 180.0;

  double dx = 111.32 * 1000.0 * cos(tmp_lat) * (copter_lng/10000000.0f - lng/10000000.0f);
  double dy = 111.32 * 1000.0 * (lat/10000000.0f - copter_lat/10000000.0f);
  double dz = copter_alt-alt;

  double newDX = dx;
  double newDY = dy;
  double newDZ = dz;

  double distance = sqrt(newDX * newDX + newDY * newDY);
  
  double yaw = atan2(-newDY, newDX) * 180.0 / PI;
  double pitch = atan2(newDZ, distance) * 180.0 / PI;
  double absYaw = calcYawAbsolute(yaw);
  
  setAngles(pitch, absYaw);
}

double calcYawAbsolute(double yaw){
  double yawAbsolute=0;

  if(prevYaw<0&&yaw>0){
      if(abs(prevYaw)+yaw>=180)
          turnCnt-=1;
      else
      if(turnCnt!=0)
          turnCnt+=1;
  }
  if(prevYaw>0&&yaw<0){
      if(abs(yaw)+prevYaw>=180)
          turnCnt+=1;
      else
      if(turnCnt!=0)
          turnCnt-=1;
  }

  prevYaw=yaw;

  if(turnCnt > 0) {
      if (yaw > 0)
          yawAbsolute = turnCnt * 180 + yaw;
      else
          yawAbsolute = turnCnt * 180 + (180+yaw);
  }
  else
  if(turnCnt < 0) {
      if (yaw < 0)
          yawAbsolute = turnCnt * 180 + yaw;
      else
          yawAbsolute = turnCnt * 180 - (180-yaw);
  }
  else
      yawAbsolute=yaw;

  yawAbsolute += copter_heading_start;
  yawAbsolute += 90;

  return yawAbsolute;
}

void setAngles(float pitch, float yaw){
  mavlink_message_t msg;
  uint8_t buf[MAVLINK_MAX_PACKET_LEN];
  mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 205, 0, pitch + pitchOffset - gimbalPitchOffset, 0.0, yaw + yawOffset, 0.0, 0.0, 0.0, 0.0);
  uint16_t len = mavlink_msg_to_send_buffer(buf, &msg);
  Serial3.write(buf, len);
}

void recenter(){
  setPanMode(0);
    
  mavlink_message_t msg;
  uint8_t buf[MAVLINK_MAX_PACKET_LEN];
  mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 204, 0, 1.0f, 0, 0, 0, 0, 0, 0);
  uint16_t len = mavlink_msg_to_send_buffer(buf, &msg);
  Serial3.write(buf, len);
}

void setPanMode(int mode){  
  union intFloat
  {
      int i;
      float f;
  } val;
  val.i = mode;
  
  mavlink_message_t msg;
  uint8_t buf[MAVLINK_MAX_PACKET_LEN];
  mavlink_msg_command_long_pack(250, 1, &msg, 71, 67, 180, 0, 66, val.f, 0.0, 0.0, 0.0, 0.0, 0.0);
  uint16_t len = mavlink_msg_to_send_buffer(buf, &msg);
  Serial3.write(buf, len);
}


void triggerGopro(bool on){
  if(on)
    trigger(start);
  else
    trigger(stopp); 

}

void getGoproState(){

  if(goproConnected){
    while(Serial1.available()>0)
      Serial1.read();
      
    byte data[256];
    
    String dataString = String("GET ") + "/gp/gpControl/status" + " HTTP/1.1\r\n" + "Host: " + host + "\r\n" + "Connection: open\r\n\r\n";
    dataString.getBytes(data,256);
    wifi.send(data, dataString.length());
  }
 
}
void readGoproState(){

  while(Serial1.available()>0){
    
    char c = Serial1.read();
    prevString += c;
    Serial.write(c);
    if(prevString.length()>10)
      prevString = prevString.substring(1,11);

    //start of settings/state
    if(prevString == "\"status\":{"){
      valueNumber = 0;
      settingOrState = 2;
    }
    if(prevString == "ettings\":{"){
      valueNumber = 0;
      settingOrState = 1;
    }
    
    //settings
    if(settingOrState == 1 && valueNumber != -1){            
      if(valueStarted){      
        if(c != ',' && c != '}')       
          valueString += c;
        else{
          valueStarted = false; 
          settingsArray[valueNumber + 1] = valueString.toInt();
          valueString = "";
          valueNumber++;
          if(c == '}' || valueNumber > 80)
            valueNumber = -1;      
        }         
      }
      if(c == ':')
        valueStarted = true;
        
    }

    //states
    if(settingOrState == 2 && valueNumber != -1){            
      if(valueStarted){      
        if(c != ',' && c != '}')
          valueString += c;
        else{
          valueStarted = false;
          if(valueNumber == 3 || valueNumber == 5 || valueNumber == 10 || valueNumber == 16  || valueNumber == 22)
            valueNumber++;
          if(valueNumber == 48)
            valueNumber+=4;           
          stateArray[valueNumber + 1] = valueString.toInt();
          valueString = "";
          valueNumber ++;
          if(c == '}'  || valueNumber > 80){
            valueNumber = -1;
            /*Serial.print("settings:  ");
            for(int i=0; i<66; i++){
              Serial.print(settingsArray[i]);
              Serial.print(";");
            }
            Serial.println();
            Serial.println();
            Serial.print("states:  ");
            for(int i=0; i<74; i++){
              Serial.print(stateArray[i]);
              Serial.print(";");
            }
            Serial.println();
            Serial.println();*/
          }         
        }         
      }
      if(c == ':')
        valueStarted = true;
    }
  }
}

void setGoproMode(int mode){
  if(mode == 0) 
    trigger(video);
  else 
    trigger(photo);
}

void setGoproExposure(int exposure){

  int exposureId = 26;
  String command = String(exposureId) + "/" + String(exposure);
  triggerSet(command);
}


void trigger(String url1){
  if(goproConnected){
    String url = "/gp/gpControl/" + url1;
    
    byte data[256];
  
    String dataString = String("GET ") + url + " HTTP/1.1\r\n" + "Host: " + host + "\r\n" + "Connection: open\r\n\r\n";
    dataString.getBytes(data,256); 
    wifi.send(data, dataString.length());
  }
}

void triggerSet(String url1){

  if(goproConnected){
    String url = "/gp/gpControl/setting/" + url1;
  
    byte data[256];
    
    String dataString = String("GET ") + url + " HTTP/1.1\r\n" + "Host: " + host + "\r\n" + "Connection: open\r\n\r\n";
    dataString.getBytes(data,256); 
    wifi.send(data, dataString.length()); 
  }     
}
