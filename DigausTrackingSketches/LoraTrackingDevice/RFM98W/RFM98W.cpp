/*
  RFM98W.cpp - RFM98W Comms Library
  
  Copyright (C) 2014 Mark Jessop <vk5qi@rfhead.net>
  Original code by David Ackerman.
  
  with changes by digaus: http://www.rcgroups.com/forums/showpost.php?p=35244667&postcount=239

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    For a full copy of the GNU General Public License, 
    see <http://www.gnu.org/licenses/>.
*/

#include "Arduino.h"
#include <SPI.h>
#include "RFM98W.h"


RFM98W::RFM98W(uint8_t SS, uint8_t DIO0){
    this->SS_PIN = SS;
    this->DIO0_PIN = DIO0;

    this->currentMode = 0x81;

    pinMode(this->SS_PIN, OUTPUT);
    digitalWrite(this->SS_PIN, HIGH);
    pinMode(this->DIO0_PIN, INPUT);

    SPI.begin();
}

void RFM98W::writeRegister(byte addr, byte value){
    digitalWrite(this->SS_PIN, LOW);
    SPI.transfer(addr | 0x80);
    SPI.transfer(value);
    digitalWrite(this->SS_PIN, HIGH);
}

byte RFM98W::readRegister(byte addr){
    digitalWrite(this->SS_PIN, LOW);
    SPI.transfer(addr & 0x7F);
    byte regval = SPI.transfer(0);
    digitalWrite(this->SS_PIN, HIGH);
    return regval;
}

int16_t RFM98W::getRSSI(){
    uint8_t rssi = this->readRegister(REG_RSSI_CURRENT);
    return (int16_t)rssi - 137;
}

uint8_t RFM98W::checkInterrupt(){

    uint8_t done = digitalRead(this->DIO0_PIN);
    
    if(done&&currentMode==RF96_MODE_TX)
      writeRegister(REG_IRQ_FLAGS, 0x08); 
      
    return done;
}

int16_t RFM98W::getRSSIPacket(){
    uint8_t rssi = this->readRegister(REG_RSSI_PACKET);
    return (int16_t)rssi - 137;
}

int32_t RFM98W::getFrequencyError(){
  int32_t Temp;
  
  Temp = (int32_t)readRegister(REG_FREQ_ERROR) & 7;
  Temp <<= 8L;
  Temp += (int32_t)readRegister(REG_FREQ_ERROR+1);
  Temp <<= 8L;
  Temp += (int32_t)readRegister(REG_FREQ_ERROR+2);
  
  if (readRegister(REG_FREQ_ERROR) & 8)
  {
    Temp = Temp - 524288;
  }

  return Temp;
}

void RFM98W::setMode(byte newMode)
{
  if(newMode == currentMode)
    return;  
  
  switch (newMode) 
  {
    case RF96_MODE_TX:
      this->writeRegister(REG_LNA, LNA_OFF_GAIN);  // TURN LNA OFF FOR TRANSMITT
      this->writeRegister(REG_PA_CONFIG, txPower);
      this->writeRegister(REG_OPMODE, newMode);
      this->currentMode = newMode; 
      break;
    case RF96_MODE_RX_CONTINUOUS:
      this->writeRegister(REG_PA_CONFIG, PA_OFF_BOOST);  // TURN PA OFF FOR RECIEVE??
      this->writeRegister(REG_LNA, LNA_MAX_GAIN);  // LNA_MAX_GAIN);  // MAX GAIN FOR RECIEVE
      this->writeRegister(REG_OPMODE, newMode);
      this->currentMode = newMode; 
      break;
    case RF96_MODE_SLEEP:
      this->writeRegister(REG_OPMODE, newMode);
      this->currentMode = newMode; 
      break;
    case RF96_MODE_STANDBY:
      this->writeRegister(REG_OPMODE, newMode);
      this->currentMode = newMode; 
      break;
    default: return;
  } 
  
  if(newMode != RF96_MODE_SLEEP){
    delay(1);
  }
   
  return;
}

void RFM98W::setFrequency(double Frequency)
{
  unsigned long FrequencyValue;

  Frequency = (Frequency * 1000000) / 61.03515625;
  FrequencyValue = (unsigned long)(Frequency);

  writeRegister(0x06, (FrequencyValue >> 16) & 0xFF);   // Set frequency
  writeRegister(0x07, (FrequencyValue >> 8) & 0xFF);
  writeRegister(0x08, FrequencyValue & 0xFF);

}

void RFM98W::setLoRaMode(double Frequency, uint8_t Bandwidth, uint8_t Spreading, uint8_t ErrorCoding, uint8_t HeaderMode, uint8_t CRC)
{
  this->setMode(RF96_MODE_SLEEP);
  this->writeRegister(REG_OPMODE,0x80);

  this->writeRegister(REG_MODEM_CONFIG, HeaderMode | ErrorCoding | Bandwidth);
  this->writeRegister(REG_MODEM_CONFIG2, Spreading | CRC);
  this->writeRegister(REG_MODEM_CONFIG3, 0x04 | 0);                 // 0x04: AGC sets LNA gain
  this->writeRegister(REG_DETECT_OPT, (Spreading == SPREADING_6) ? 0x05 : 0x03);          // 0x05 For SF6; 0x03 otherwise
  this->writeRegister(REG_DETECTION_THRESHOLD, (Spreading == SPREADING_6) ? 0x0C : 0x0A); 

  writeRegister(REG_PAYLOAD_LENGTH,PAYLOAD_LENGTH);
  writeRegister(REG_RX_NB_BYTES,PAYLOAD_LENGTH);
  
  this->setFrequency(Frequency);
   
  
  return;
}

void RFM98W::startReceiving()
{

  writeRegister(REG_DIO_MAPPING_1, 0x00);    // 00 00 00 00 maps DIO0 to RxDone
  
  writeRegister(REG_FIFO_RX_BASE_AD, 0);
  writeRegister(REG_FIFO_ADDR_PTR, 0);
    
  // Setup Receive Continuous Mode
  setMode(RF96_MODE_RX_CONTINUOUS); 
}

int RFM98W::receiveMessage(byte *message)
{
  int i, Bytes, currentAddr, x;

  Bytes = 0;
  
  x = readRegister(REG_IRQ_FLAGS);
  
  // clear the rxDone flag
  writeRegister(REG_IRQ_FLAGS, 0x40); 
    
  // check for payload crc issues (0x20 is the bit we are looking for
  if((x & 0x20) == 0x20)
  {
    // CRC Error
    writeRegister(REG_IRQ_FLAGS, 0x20);   // reset the crc flags
    return 0;
  }
  else
  {
    currentAddr = readRegister(REG_FIFO_RX_CURRENT_ADDR);
    Bytes = readRegister(REG_RX_NB_BYTES);

    writeRegister(REG_FIFO_ADDR_PTR, currentAddr);   
    
    for(i = 0; i < Bytes; i++)
    {
      message[i] = readRegister(REG_FIFO);
    }

    // Clear all flags
    writeRegister(REG_IRQ_FLAGS, 0xFF); 
  
    return Bytes;
  }
}

uint8_t RFM98W::getLastMode(){
    return this->currentMode;
}

void RFM98W::sendData(byte *buffer, int Length)
{
  
  int i;
  
  setMode(RF96_MODE_STANDBY);

  writeRegister(REG_DIO_MAPPING_1, 0x40);    // 01 00 00 00 maps DIO0 to TxDone
  writeRegister(REG_FIFO_TX_BASE_AD, 0x00);  // Update the address ptr to the current tx base address
  writeRegister(REG_FIFO_ADDR_PTR, 0x00); 
  writeRegister(REG_PAYLOAD_LENGTH, Length);
  
  digitalWrite(this->SS_PIN, LOW);
  // tell SPI which address you want to write to
  SPI.transfer(REG_FIFO | 0x80);

  // loop over the payload and put it on the buffer 
  for (i = 0; i < Length; i++)
  {
    SPI.transfer(buffer[i]);
  }
  digitalWrite(this->SS_PIN, HIGH);

  // go into transmit mode
  setMode(RF96_MODE_TX);
  
}

void RFM98W::setTxPower(uint8_t TxPower)
{
  txPower = TxPower;
}





