/*
 * KivuSense - station climatique ESP32
 * Bibliothèques Arduino : DHT sensor library, Adafruit BMP280, BH1750, ArduinoJson.
 * Les seules valeurs à fournir sont le Wi-Fi, l'URL de l'API et DEVICE_KEY.
 */
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_BMP280.h>
#include <BH1750.h>

const char* WIFI_SSID = "VOTRE_WIFI";
const char* WIFI_PASSWORD = "VOTRE_MOT_DE_PASSE";
const char* API_URL = "http://192.168.1.20:8000/iot/measurements";
const char* DEVICE_KEY = "CLE_COPIEE_DEPUIS_KIVUSENSE";

constexpr uint8_t DHT_PIN = 4, SOIL_PIN = 34, CO2_PIN = 35, WATER_PIN = 32;
constexpr uint8_t PUMP_RELAY = 25, FAN_RELAY = 26, MISTER_RELAY = 27, LIGHT_RELAY = 14, BUZZER_PIN = 13;
constexpr uint32_t SEND_INTERVAL_MS = 30000;

DHT dht(DHT_PIN, DHT22);
Adafruit_BMP280 bmp;
BH1750 lightMeter;
uint32_t lastSend = 0;

float percentFromAnalog(uint8_t pin, int dryValue, int wetValue) {
  int raw = analogRead(pin);
  return constrain(100.0f * (raw - dryValue) / (wetValue - dryValue), 0.0f, 100.0f);
}

void connectWifi() {
  WiFi.mode(WIFI_STA); WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
}

void setup() {
  Serial.begin(115200); dht.begin(); Wire.begin(); bmp.begin(0x76); lightMeter.begin();
  for (uint8_t pin : {PUMP_RELAY, FAN_RELAY, MISTER_RELAY, LIGHT_RELAY, BUZZER_PIN}) {
    pinMode(pin, OUTPUT); digitalWrite(pin, HIGH); // relais actifs à LOW
  }
  connectWifi();
}

void sendMeasurements() {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  float temperature = dht.readTemperature(), humidity = dht.readHumidity();
  if (isnan(temperature) || isnan(humidity)) return;

  JsonDocument payload;
  payload["air_temperature"] = temperature;
  payload["air_humidity"] = humidity;
  payload["soil_moisture"] = percentFromAnalog(SOIL_PIN, 3200, 1200); // calibrer selon la sonde
  payload["luminosity"] = lightMeter.readLightLevel();
  payload["co2"] = map(analogRead(CO2_PIN), 0, 4095, 400, 2000); // estimation MQ-135 à calibrer
  payload["pressure"] = bmp.readPressure() / 100.0f;
  payload["water_level"] = percentFromAnalog(WATER_PIN, 300, 3000);

  String body; serializeJson(payload, body);
  HTTPClient http; http.begin(API_URL); http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY); int status = http.POST(body);
  Serial.printf("KivuSense API: %d\n", status); http.end();
}

void loop() {
  if (millis() - lastSend >= SEND_INTERVAL_MS) { lastSend = millis(); sendMeasurements(); }
  delay(100);
}
