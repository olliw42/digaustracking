/*
  RFM98W.h - RFM98W Comms Library
  
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

#ifndef RFM98W_h
#define RFM98W_h

#define PAYLOAD_LENGTH  60

#define REG_FIFO                    0x00
#define REG_FIFO_ADDR_PTR           0x0D 
#define REG_FIFO_TX_BASE_AD         0x0E
#define REG_FIFO_RX_BASE_AD         0x0F
#define REG_RX_NB_BYTES             0x13
#define REG_OPMODE                  0x01
#define REG_FIFO_RX_CURRENT_ADDR    0x10
#define REG_IRQ_FLAGS               0x12
#define REG_RSSI_PACKET             0x1A
#define REG_RSSI_CURRENT            0x1B
#define REG_DIO_MAPPING_1           0x40
#define REG_DIO_MAPPING_2           0x41
#define REG_MODEM_CONFIG            0x1D
#define REG_MODEM_CONFIG2           0x1E
#define REG_MODEM_CONFIG3           0x26
#define REG_PAYLOAD_LENGTH          0x22
#define REG_IRQ_FLAGS_MASK          0x11
#define REG_HOP_PERIOD              0x24
#define REG_MODEM_STATUS            0x18
#define REG_PACKET_SNR              0x19
#define REG_DETECT_OPT              0x31
#define REG_DETECTION_THRESHOLD     0x37
#define REG_FREQ_ERROR              0x28

// MODES
// MODES
#define RF96_MODE_RX_CONTINUOUS     0x85
#define RF96_MODE_SLEEP             0x80
#define RF96_MODE_STANDBY           0x81
#define RF96_MODE_TX                0x83

// Modem Config 1
#define EXPLICIT_MODE               0x00
#define IMPLICIT_MODE               0x01

#define ERROR_CODING_4_5            0x02
#define ERROR_CODING_4_6            0x04
#define ERROR_CODING_4_7            0x06
#define ERROR_CODING_4_8            0x08

#define BANDWIDTH_7K8               0x00
#define BANDWIDTH_10K4              0x10
#define BANDWIDTH_15K6              0x20
#define BANDWIDTH_20K8              0x30
#define BANDWIDTH_31K25             0x40
#define BANDWIDTH_41K7              0x50
#define BANDWIDTH_62K5              0x60
#define BANDWIDTH_125K              0x70
#define BANDWIDTH_250K              0x80
#define BANDWIDTH_500K              0x90

// Modem Config 2

#define SPREADING_6                 0x60
#define SPREADING_7                 0x70
#define SPREADING_8                 0x80
#define SPREADING_9                 0x90
#define SPREADING_10                0xA0
#define SPREADING_11                0xB0
#define SPREADING_12                0xC0

#define CRC_OFF                     0x00
#define CRC_ON                      0x04


// POWER AMPLIFIER CONFIG
#define REG_PA_CONFIG               0x09
#define PA_MAX_BOOST                0xFF//0x8F
#define PA_LOW_BOOST                0x81
#define PA_MED_BOOST                0x8A
#define PA_MAX_UK                   0x88
#define PA_OFF_BOOST                0x00
#define RFO_MIN                     0x00

// LOW NOISE AMPLIFIER
#define REG_LNA                     0x0C
#define LNA_MAX_GAIN                0x23  // 0010 0011
#define LNA_OFF_GAIN                0x00

// Modem Status Bitmasks
#define MODEM_STATUS_SIGNAL_DETECTED    0x01
#define MODEM_STATUS_SIGNAL_SYNC        0x02
#define MODEM_STATUS_RX_IN_PROGRESS  0x04
#define MODEM_STATUS_GOT_HEADER     0x08
#define MODEM_STATUS_MODEM_CLEAR    0x10


class RFM98W {
    public:
        // Constructors
        RFM98W(uint8_t SS, uint8_t DIO0); 

        int16_t getRSSI();
        int16_t getRSSIPacket();
        int32_t getFrequencyError();
        void setMode(byte newMode);
        void setLoRaMode(double Frequency, uint8_t Bandwidth, uint8_t Spreading, uint8_t ErrorCoding, uint8_t HeaderMode, uint8_t CRC);
        void startReceiving();
        int receiveMessage(byte *message);
        uint8_t checkInterrupt();
        void writeRegister(byte addr, byte value);
        byte readRegister(byte addr);
        void setFrequency(double Frequency);
        void sendData(byte *buffer, int len);
        uint8_t getLastMode();
        void setTxPower(uint8_t TxPower);
    private:
        uint8_t SS_PIN;
        uint8_t DIO0_PIN;
        byte currentMode;
        uint8_t txPower;

};





#endif

