// ESP32 gas node: reads one analog gas sensor, POSTs to the server, sounds a LOCAL buzzer based on the response status.
// You MUST calibrate raw->ppm for your sensor (MQ-series are indicative only; use certified detectors for safety-critical use).
#include <WiFi.h>
#include <HTTPClient.h>
const char* SSID="YOUR_WIFI"; const char* PASS="YOUR_PASS";
const char* URL="http://SERVER_IP:3000/api/readings"; const char* KEY="device-secret";
const char* DEVICE_ID="ESP32-001"; const char* GAS="CO";   // register first via POST /api/sensors
const int SENSOR_PIN=34, BUZZER_PIN=25;
float toPpm(int raw){ return raw*(1000.0/4095.0); }          // PLACEHOLDER calibration
void beep(int n,int ms){ for(int i=0;i<n;i++){ tone(BUZZER_PIN,1000,ms); delay(ms*2);} }
void setup(){ pinMode(BUZZER_PIN,OUTPUT); WiFi.begin(SSID,PASS); while(WiFi.status()!=WL_CONNECTED) delay(500); }
void ensureWifi(){ if(WiFi.status()!=WL_CONNECTED){ WiFi.disconnect(); WiFi.begin(SSID,PASS); unsigned long t=millis(); while(WiFi.status()!=WL_CONNECTED && millis()-t<15000) delay(500); } }
void loop(){
  ensureWifi(); if(WiFi.status()!=WL_CONNECTED){ delay(3000); return; }
  float v=toPpm(analogRead(SENSOR_PIN));
  HTTPClient h; h.begin(URL); h.addHeader("Content-Type","application/json"); h.addHeader("x-device-key",KEY);
  int code=h.POST(String("{\"deviceId\":\"")+DEVICE_ID+"\",\"gas\":\""+GAS+"\",\"value\":"+v+"}");
  if(code==200){ String r=h.getString();
    if(r.indexOf("DANGER")>0) beep(8,80); else if(r.indexOf("CRITICAL")>0) beep(3,200); else if(r.indexOf("WARNING")>0) beep(2,150); }
  h.end(); delay(3000);
}
