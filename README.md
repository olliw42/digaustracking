Digaus' Tracking
================

<strong>360° Target Tracking System for STorM32 Gimbal Controller</strong>
<br>

digaus has done a remarkable job in developping a 360° target tracking system for the STorM32 gimbal controller, see http://www.rcgroups.com/forums/showthread.php?t=2423260&pp=50. He recently published his codes in this thread, and on his behalf, with his permission, I put it on github here for your convenience.

https://www.youtube.com/watch?v=YNtU7Xp14rA&feature=youtu.be

<br>
<strong>Arduino Codes, Installation for Windows</strong>

* Download and install Arduino (I tested with Arduino-1.6.9 for windows): https://www.arduino.cc/en/Main/Software

* Downlaod and install Teensyduino (I tested with Teensyduino 1.29): https://www.pjrc.com/teensy/td_download.html
* Download this repository (do not forget to extract the .zip)
* Copy the DigausTrackingSketches folder as is to your Arduino sketch folder (it is usually Documents/Arduino/). Nothing else needs to be copied or done.
* In the DigausTrackingSketches folder you find two subfolders, with the sketches for the tracking unit on the gimbal (folder LoraTrackingGimbal), and the tracking unit on the target (LoraTrackingDevice).
* As usual with Arduino, click the .ino sketch, which opens the Arduino IDE.
* In the Arduino IDE, go to Tools->Boards and select the Teensy LC.
* The ready-to-upload .hex files are also found in the respective folders.

<br>
<strong>Used Arduino Projects&Libraries</strong>
* Arduino: https://www.arduino.cc/
* Teensyduino: https://www.pjrc.com/teensy/teensyduino.html
* Adafruit-BMP085: Limor Fried/Ladyada, https://www.adafruit.com/
* ESP8266: Wu Pengfei, https://github.com/itead/ITEADLIB_Arduino_WeeESP8266
* Mavlink: Lorenz Meier, https://github.com/mavlink/mavlink
* RunningMedian: Rob dot Tillaart at gmail dot com, http://arduino.cc/playground/Main/RunningMedian
* TinyGPS++: Mikal Hart, http://arduiniana.org/libraries/tinygpsplus/
* RFM98W: Mark Jessop, original code by David Ackerman, with changes by digaus, https://github.com/darksidelemm/RFM98Arduino/tree/master/lora_groundstation

<br>
<strong>Android Codes, Installation for Windows</strong>

The Android app was written using the Ionic framework. See http://ionicframework.com/getting-started/.
