Digaus' Tracking
================

<strong>360° Target Tracking System for STorM32 Gimbal Controller</strong>

digaus has done a remarkable job in developping a 360° target tracking system for the STorM32 gimbal controller, see http://www.rcgroups.com/forums/showthread.php?t=2423260&pp=50. He recently published his codes in the above thread, and on behalf of him I restructured them a bit, to make staring with them easier, and put it on my github.

<strong>Arduino Codes, Installation for Windows</strong>

* Download and install Arduino (I tested with Arduino-1.6.9 for windows): https://www.arduino.cc/en/Main/Software

* Downlaod and install Teensyduino (I tested with Teensyduino 1.29): https://www.pjrc.com/teensy/td_download.html

* Download this repository (do not forget to extract the .zip)

* Copy the DigausTrackingSketches folder as it is into your Arduino sketch folder (it is usually Documents/Arduino/). Nothing else needs to be copied or done.

* In the DigausTrackingSketches folder you find two subfolders, with the sketches for the codes for tracking unit on the gimbal (folder LoraTrackingGimbal), and the tracking unit on the target (LoraTrackingDevice).

* As usual with Arduino, click the .ino sketch, which opens the Arduino IDE.

* In the Arduino IDE, go to Tools->Boards and select the Teensy LC.

* The ready-to-upload .hex files are also found in teh respective folders.


<strong>Used Projects&Libraries</strong>
* Arduino: https://www.arduino.cc/
* Teensyduino: https://www.pjrc.com/teensy/teensyduino.html
* Adafruit-BMP085: Limor Fried/Ladyada, https://www.adafruit.com/
* ESP8266: Wu Pengfei<pengfei.wu@itead.cc> 
* Mavlink: http://pixhawk.ethz.ch/wiki/software/mavlink/, Lorenz Meier <pixhawk@switched.com> / PIXHAWK Team
* RunningMedian: Rob dot Tillaart at gmail dot com, http://arduino.cc/playground/Main/RunningMedian
* TinyGPS++: Mikal Hart, http://arduiniana.org/libraries/tinygpsplus/
* RFM98W: Mark Jessop <vk5qi@rfhead.net>, original code by David Ackerman, with changes by digaus

