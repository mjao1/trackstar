#include <WiFi.h>
#include <WiFiClient.h>
#include <Wire.h>
#include <TinyGPS++.h>

// === CONFIGURATION ===

// WiFi credentials
//#define WIFI_SSID "suhyeon"
//#define WIFI_PASSWORD "trackstar"

//#define WIFI_SSID "emmaiphone"
//#define WIFI_PASSWORD "b14bzqh9wnwns"

#define WIFI_SSID "9304"
#define WIFI_PASSWORD "donotjoinifnotapt9304"

// Backend API
//#define API_BASE_URL "http://172.20.10.9:3000" // suhyeon
//#define API_BASE_URL "http://172.20.10.4:3000" // emma
#define API_BASE_URL "http://10.0.0.31:3000" // home

#define API_POLL_ENDPOINT "/api/esp32/poll"
#define API_MOTION_ENDPOINT "/api/esp32/motion"
#define API_GPS_ENDPOINT "/api/esp32/gps"

// Device credentials
#define DEVICE_ID "ESP32-DEVICE-001"
#define DEVICE_SECRET "123456789"

#define MOTION_THRESHOLD 0.25
#define GRAVITY_BASELINE 1.0

#define POLL_INTERVAL_IDLE 10
#define POLL_INTERVAL_WATCH 10
#define POLL_INTERVAL_THEFT 10
#define MOTION_QUIET_TIMEOUT 10000

// Pinout
#define PIN_BUZZER 0
#define PIN_MPU_SDA 15
#define PIN_MPU_SCL 2
#define PIN_WIFI_LED 27
#define PIN_GPS_RX 16
#define PIN_GPS_TX 17

// Buzzer polarity
#define BUZZER_ACTIVE_LOW true
#define BUZZER_BEEP_INTERVAL 100

// MPU-6050 registers
#define MPU6050_ADDR 0x68
#define MPU6050_PWR_MGMT_1 0x6B
#define MPU6050_ACCEL_CONFIG 0x1C
#define MPU6050_ACCEL_XOUT_H 0x3B
#define MPU6050_SMPLRT_DIV 0x19


// === GLOBAL VARIABLES ===

enum DeviceState {
  IDLE,
  WATCH,
  THEFT_DETECTED
};

DeviceState currentState = IDLE;
bool alarmActive = false;

// MPU-6050 (using direct I2C, no library needed)
bool mpuInitialized = false;

unsigned long lastPollTime = 0;
unsigned long lastQuietMotionTime = 0;
unsigned long lastSirenUpdate = 0;
unsigned long lastMotionEventTime = 0;

bool motionDetected = false;
float lastAccelMagnitude = 0;

bool buzzerState = false;

bool wifiConnected = false;
WiFiClient client;

// GPS
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);
unsigned long lastGpsUpdate = 0;
#define GPS_UPDATE_INTERVAL 5000

// === SETUP ===

void setup() {
  pinMode(PIN_WIFI_LED, OUTPUT);
  digitalWrite(PIN_WIFI_LED, LOW);
  
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n=== Trackstar ESP32 Device ===");
  Serial.println("Device ID: " + String(DEVICE_ID));
  
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, BUZZER_ACTIVE_LOW ? HIGH : LOW);
  
  Wire.begin(PIN_MPU_SDA, PIN_MPU_SCL);
  delay(100);
  
  Serial.println("Initializing MPU-6050...");
  if (!initMPU6050()) {
    Serial.println("ERROR: MPU-6050 not found");
    while (1) {
      delay(1000);
    }
  }
  
  Serial.println("MPU-6050 initialized");
  
  // Initialize GPS
  gpsSerial.begin(9600, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);
  Serial.println("GPS initialized");
  
  // Connect to WiFi
  connectWiFi();
  currentState = IDLE;
  Serial.println("Initial state: IDLE");
  pollBackend();

  
  digitalWrite(PIN_WIFI_LED, HIGH); 
}

// === MAIN LOOP ===

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    wifiConnected = false;
    connectWiFi();
  }
  
  // Read accelerometer (if in WATCH or THEFT_DETECTED state)
  if (currentState == WATCH || currentState == THEFT_DETECTED) {
    readAccelerometer();
    checkMotion();
  }
  
  switch (currentState) {
    case IDLE:
      break;
      
    case WATCH:
      // Continuous motion monitoring
      if (motionDetected) {
        currentState = THEFT_DETECTED;
        lastQuietMotionTime = millis();
        Serial.println("State: WATCH -> THEFT_DETECTED");
        sendMotionEvent();
      }
      break;
      
    case THEFT_DETECTED:
      if (motionDetected) {
        sendMotionEvent();
      }
      // Read GPS and send location updates
      readGPS();
      if (millis() - lastGpsUpdate >= GPS_UPDATE_INTERVAL) {
        sendGpsLocation();
        lastGpsUpdate = millis();
      }
      break;
  }
  
  if (alarmActive) {
    updateBuzzerSiren();
  } else {
    buzzerState = false;
    digitalWrite(PIN_BUZZER, BUZZER_ACTIVE_LOW ? HIGH : LOW);
  }
  
  // Poll backend for commands
  unsigned long pollInterval = getPollInterval();
  if (millis() - lastPollTime >= pollInterval) {
    pollBackend();
    lastPollTime = millis();
  }
  
  delay(1);
}

// === WIFI ===

void connectWiFi() {
  if (wifiConnected && WiFi.status() == WL_CONNECTED) {
    return;
  }
  
  Serial.println("Connecting to WiFi: " + String(WIFI_SSID));
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("\nWiFi connected");
    Serial.println("IP address: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWiFi connection failed");
    wifiConnected = false;
  }
}

// === MPU-6050 ===

bool initMPU6050() {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_PWR_MGMT_1);
  Wire.write(0);
  if (Wire.endTransmission() != 0) {
    return false;
  }
  
  delay(10);
  
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_ACCEL_CONFIG);
  Wire.write(0x00);  // 2g range
  if (Wire.endTransmission() != 0) {
    return false;
  }
  
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_SMPLRT_DIV);
  Wire.write(0);
  Wire.endTransmission();
  
  mpuInitialized = true;
  return true;
}

void readAccelerometer() {
  if (!mpuInitialized) {
    return;
  }
  
  // Read 6 bytes starting from ACCEL_XOUT_H register
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_ACCEL_XOUT_H);
  if (Wire.endTransmission() != 0) {
    return;
  }
  
  Wire.requestFrom(MPU6050_ADDR, 6);
  if (Wire.available() < 6) {
    return;
  }
  
  // Read raw 16-bit values (big-endian)
  int16_t ax_raw = (Wire.read() << 8) | Wire.read();
  int16_t ay_raw = (Wire.read() << 8) | Wire.read();
  int16_t az_raw = (Wire.read() << 8) | Wire.read();
  
  // Convert to g-force (for 2g range: 16384 LSB/g)
  float ax = ax_raw / 16384.0;
  float ay = ay_raw / 16384.0;
  float az = az_raw / 16384.0;
  
  // Calculate magnitude
  float magnitude = sqrt(ax * ax + ay * ay + az * az);
  lastAccelMagnitude = magnitude;
}

void checkMotion() {
  // Check if acceleration magnitude exceeds threshold
  // Account for 1g gravity baseline
  float motionLevel = abs(lastAccelMagnitude - GRAVITY_BASELINE);
  
  if (motionLevel > MOTION_THRESHOLD) {
    if (!motionDetected) {
      motionDetected = true;
      Serial.println("Motion detected, Level: " + String(motionLevel) + "g");
    }
  } else {
    motionDetected = false;
  }
}

// === HTTP COMMUNICATION ===

void pollBackend() {
  if (!wifiConnected) {
    return;
  }
  
  // Extract host and port from API_BASE_URL
  String host = String(API_BASE_URL);
  host.replace("http://", "");
  int port = 3000;
  int portIndex = host.indexOf(':');
  if (portIndex != -1) {
    port = host.substring(portIndex + 1).toInt();
    host = host.substring(0, portIndex);
  } else {
    // Default port 80 for HTTP
    port = 80;
  }
  
  Serial.println("Connecting to: " + host + ":" + String(port));
  
  if (!client.connect(host.c_str(), port)) {
    Serial.println("Connection failed");
    return;
  }
  
  // Send HTTP GET request
  String endpoint = String(API_POLL_ENDPOINT);
  client.print("GET ");
  client.print(endpoint);
  client.println(" HTTP/1.1");
  client.print("Host: ");
  client.println(host);
  client.print("x-device-id: ");
  client.println(DEVICE_ID);
  client.print("x-device-secret: ");
  client.println(DEVICE_SECRET);
  client.println("Connection: close");
  client.println();
  
  unsigned long timeout = millis();
  while (client.available() == 0) {
    // Keep buzzer beeping while waiting
    if (alarmActive) {
      updateBuzzerSiren();
    }
    if (millis() - timeout > 1000) {
      Serial.println("Client timeout");
      client.stop();
      return;
    }
  }
  
  // Read response
  String response = "";
  while (client.available()) {
    String line = client.readStringUntil('\r');
    response += line;
  }
  
  // Extract JSON from HTTP response (skip headers)
  int jsonStart = response.indexOf('{');
  if (jsonStart != -1) {
    String payload = response.substring(jsonStart);
    Serial.println("Poll response: " + payload);
    parsePollResponse(payload);
  } else {
    Serial.println("No JSON in response: " + response);
  }
  
  client.stop();
}

void parsePollResponse(String response) {
  // Simple JSON parsing (for production, use ArduinoJson library)
  // Look for "state":" and "alarm":
  
  // Parse state
  int stateIndex = response.indexOf("\"state\":\"");
  if (stateIndex != -1) {
    int start = stateIndex + 9;
    int end = response.indexOf("\"", start);
    String stateStr = response.substring(start, end);
    
    DeviceState newState = currentState;
    if (stateStr == "IDLE") {
      newState = IDLE;
    } else if (stateStr == "WATCH") {
      newState = WATCH;
    } else if (stateStr == "THEFT_DETECTED") {
      newState = THEFT_DETECTED;
      // Reset quiet timeout whenever backend confirms THEFT_DETECTED
      lastQuietMotionTime = millis();
    }
    
    if (newState != currentState) {
      currentState = newState;
      Serial.println("State changed to: " + stateStr);
      
      // Reset motion detection on state change
      if (currentState == WATCH) {
        motionDetected = false;
        lastQuietMotionTime = millis();
      }
    }
  }
  
  // Parse alarm
  int alarmIndex = response.indexOf("\"alarm\":");
  if (alarmIndex != -1) {
    int start = alarmIndex + 8;
    String alarmStr = response.substring(start, start + 4);
    bool newAlarmState = (alarmStr.indexOf("true") != -1);
    
    if (newAlarmState != alarmActive) {
      alarmActive = newAlarmState;
      Serial.println("Alarm: " + String(alarmActive ? "ON" : "OFF"));
    }
  }
}

void sendMotionEvent() {
  if (!wifiConnected) {
    return;
  }
  
  // Extract host and port from API_BASE_URL
  String host = String(API_BASE_URL);
  host.replace("http://", "");
  int port = 3000;
  int portIndex = host.indexOf(':');
  if (portIndex != -1) {
    port = host.substring(portIndex + 1).toInt();
    host = host.substring(0, portIndex);
  } else {
    port = 80;
  }
  
  if (!client.connect(host.c_str(), port)) {
    Serial.println("Motion event: Connection failed");
    return;
  }
  
  // Send HTTP POST request
  String endpoint = String(API_MOTION_ENDPOINT);
  String body = "{}";
  
  client.print("POST ");
  client.print(endpoint);
  client.println(" HTTP/1.1");
  client.print("Host: ");
  client.println(host);
  client.print("x-device-id: ");
  client.println(DEVICE_ID);
  client.print("x-device-secret: ");
  client.println(DEVICE_SECRET);
  client.println("Content-Type: application/json");
  client.print("Content-Length: ");
  client.println(body.length());
  client.println("Connection: close");
  client.println();
  client.print(body);
  
  // Wait for response
  unsigned long timeout = millis();
  while (client.available() == 0) {
    // Keep buzzer beeping while waiting
    if (alarmActive) {
      updateBuzzerSiren();
    }
    if (millis() - timeout > 1000) {
      Serial.println("Motion event: Client timeout");
      client.stop();
      return;
    }
  }
  
  // Read response
  String response = "";
  while (client.available()) {
    String line = client.readStringUntil('\r');
    response += line;
  }
  
  // Check for success (200 OK) or rate limit (429)
  if (response.indexOf("200 OK") != -1 || response.indexOf("429") != -1) {
    int jsonStart = response.indexOf('{');
    if (jsonStart != -1) {
      String payload = response.substring(jsonStart);
      Serial.println("Motion event sent. Response: " + payload);
    } else {
      Serial.println("Motion event sent successfully");
    }
  } else {
    Serial.println("Motion event failed. Response: " + response.substring(0, 200));
  }
  
  client.stop();
}

// === GPS ===

void readGPS() {
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }
}

void sendGpsLocation() {
  if (!wifiConnected || !gps.location.isValid()) {
    return;
  }
  
  // Extract host and port from API_BASE_URL
  String host = String(API_BASE_URL);
  host.replace("http://", "");
  int port = 3000;
  int portIndex = host.indexOf(':');
  if (portIndex != -1) {
    port = host.substring(portIndex + 1).toInt();
    host = host.substring(0, portIndex);
  } else {
    port = 80;
  }
  
  if (!client.connect(host.c_str(), port)) {
    Serial.println("GPS: Connection failed");
    return;
  }
  
  // Build JSON body with GPS coordinates
  String body = "{";
  body += "\"latitude\":" + String(gps.location.lat(), 6) + ",";
  body += "\"longitude\":" + String(gps.location.lng(), 6);
  if (gps.satellites.value() > 0) {
    body += ",\"satellites\":" + String(gps.satellites.value());
  }
  if (gps.speed.isValid()) {
    body += ",\"speed\":" + String(gps.speed.mph(), 2);
  }
  body += "}";
  
  // Send HTTP POST request
  String endpoint = String(API_GPS_ENDPOINT);
  client.print("POST ");
  client.print(endpoint);
  client.println(" HTTP/1.1");
  client.print("Host: ");
  client.println(host);
  client.print("x-device-id: ");
  client.println(DEVICE_ID);
  client.print("x-device-secret: ");
  client.println(DEVICE_SECRET);
  client.println("Content-Type: application/json");
  client.print("Content-Length: ");
  client.println(body.length());
  client.println("Connection: close");
  client.println();
  client.print(body);
  
  // Wait for response
  unsigned long timeout = millis();
  while (client.available() == 0) {
    if (millis() - timeout > 1000) {
      Serial.println("GPS: Client timeout");
      client.stop();
      return;
    }
  }
  
  // Read response
  String response = "";
  while (client.available()) {
    String line = client.readStringUntil('\r');
    response += line;
  }
  
  if (response.indexOf("200 OK") != -1) {
    Serial.println("GPS location sent successfully");
  } else {
    Serial.println("GPS location failed. Response: " + response.substring(0, 100));
  }
  
  client.stop();
}

unsigned long getPollInterval() {
  switch (currentState) {
    case IDLE:
      return POLL_INTERVAL_IDLE;
    case WATCH:
      return POLL_INTERVAL_WATCH;
    case THEFT_DETECTED:
      return POLL_INTERVAL_THEFT;
    default:
      return POLL_INTERVAL_IDLE;
  }
}

// === BUZZER ===

void updateBuzzerSiren() {
  if (millis() - lastSirenUpdate >= BUZZER_BEEP_INTERVAL) {
    buzzerState = !buzzerState;
    lastSirenUpdate = millis();
  }
  
  if (BUZZER_ACTIVE_LOW) {
    digitalWrite(PIN_BUZZER, buzzerState ? LOW : HIGH);
  } else {
    digitalWrite(PIN_BUZZER, buzzerState ? HIGH : LOW);
  }
}

// === UTILITY ===

void printState() {
  Serial.println("=== Device Status ===");
  Serial.println("State: " + String(currentState == IDLE ? "IDLE" : 
                                    currentState == WATCH ? "WATCH" : "THEFT_DETECTED"));
  Serial.println("Alarm: " + String(alarmActive ? "ON" : "OFF"));
  Serial.println("WiFi: " + String(wifiConnected ? "Connected" : "Disconnected"));
  Serial.println("Motion: " + String(motionDetected ? "Detected" : "None"));
  Serial.println("===================");
}
