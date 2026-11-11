import type { Architecture } from "@/store/useLabStore";

export const MAIN_FILE: Record<Architecture, string> = {
  "arduino-uno": "sketch.ino",
  "8051": "main.asm",
  esp32: "esp32_sketch.ino",
  "jetson-nano": "main.py",
};

export const VREF: Record<Architecture, number> = {
  "arduino-uno": 5,
  "8051": 5,
  esp32: 3.3,
  "jetson-nano": 3.3,
};

export function esp32Sketch(dbUrl: string, deviceKey: string): string {
  return String.raw`// Helios Lab – ESP32 -> Firebase telemetry (run inside your Wokwi ESP32 project)
// Wokwi wiring: potentiometer signal -> GPIO34, LED (with resistor) -> GPIO2
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

const char* DB_URL     = "${dbUrl}";
const char* DEVICE_KEY = "${deviceKey}";

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  analogReadResolution(12);
  WiFi.begin("Wokwi-GUEST", "", 6);
  while (WiFi.status() != WL_CONNECTED) { delay(250); Serial.print("."); }
  Serial.println("\nWi-Fi connected");
}

void loop() {
  int raw = analogRead(34);                    // 0..4095 (12-bit)
  float voltage = raw * 3.3f / 4095.0f;        // Vout = Vref * D / (2^N - 1)
  float temperature = 20.0f + voltage * 5.0f;  // simulated sensor
  bool led = voltage > 1.65f;
  digitalWrite(2, led);

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = String(DB_URL) + "/device_ingest/" + DEVICE_KEY + ".json";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  String body = "{\"adc_raw\":" + String(raw) +
                ",\"voltage\":" + String(voltage, 3) +
                ",\"temperature\":" + String(temperature, 2) +
                ",\"GPIO2\":" + String(led ? 1 : 0) +
                ",\"ts\":{\".sv\":\"timestamp\"}}";
  int code = http.PUT(body);
  Serial.printf("PUT %d  V=%.3f  T=%.2f\n", code, voltage, temperature);
  http.end();
  delay(1000);
}
`;
}

const ARDUINO_BLINK = String.raw`// Helios Lab – Arduino Uno: blink + serial
void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
  Serial.println("Helios Lab: Uno online");
}

void loop() {
  digitalWrite(13, HIGH);
  Serial.println("LED ON");
  delay(500);
  digitalWrite(13, LOW);
  Serial.println("LED OFF");
  delay(500);
}
`;

const ARDUINO_PWM = String.raw`// PWM fade on D9 – open the oscilloscope on D9 to watch the duty cycle change
void setup() {
  pinMode(9, OUTPUT);
  pinMode(13, OUTPUT);
}

void loop() {
  for (int duty = 0; duty <= 255; duty += 15) {
    analogWrite(9, duty);
    delay(60);
  }
  digitalWrite(13, !digitalRead(13));
}
`;

const ARDUINO_BUTTON = String.raw`// Push button on D2 (pressed = LOW) lights the LED on D13
void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  bool pressed = digitalRead(2) == LOW;
  digitalWrite(13, pressed ? HIGH : LOW);
  static bool last = false;
  if (pressed != last) { Serial.println(pressed ? "Button pressed" : "Button released"); last = pressed; }
  delay(10);
}
`;

const ASM_BLINK = String.raw`; Helios Lab – 8051 blink on P1.0
        ORG 0000H
LED     EQU P1.0

START:  CPL LED          ; toggle the LED pin
        ACALL DELAY
        SJMP START

DELAY:  MOV R1, #5       ; ~0.5 s at 12 MHz
D0:     MOV R2, #200
D1:     MOV R3, #250
D2:     DJNZ R3, D2
        DJNZ R2, D1
        DJNZ R1, D0
        RET
        END
`;

const ASM_TIMER = String.raw`; Timer 0 interrupt blink: 10 x 50 ms = 0.5 s toggle on P1.0
        ORG 0000H
        LJMP MAIN
        ORG 000BH            ; Timer 0 interrupt vector
        LJMP T0_ISR

        ORG 0030H
MAIN:   MOV TMOD, #01H       ; Timer 0, mode 1 (16-bit)
        MOV TH0, #3CH        ; 65536 - 50000 = 3CB0H -> 50 ms at 12 MHz
        MOV TL0, #0B0H
        MOV R7, #10
        SETB ET0             ; enable Timer 0 interrupt
        SETB EA              ; global interrupt enable
        SETB TR0             ; start Timer 0
        SJMP $               ; wait here forever

T0_ISR: MOV TH0, #3CH        ; reload
        MOV TL0, #0B0H
        DJNZ R7, DONE
        MOV R7, #10
        CPL P1.0
DONE:   RETI
        END
`;

const ASM_BUTTON = String.raw`; Push button on P3.2 (pressed = LOW) drives the LED on P1.0
        ORG 0000H
LOOP:   MOV C, P3.2
        CPL C
        MOV P1.0, C
        SJMP LOOP
        END
`;

const JETSON_MAIN = String.raw`# Helios Lab – Jetson Nano Edge AI pipeline (simulated TensorRT runtime)
# Edit the settings below, then press Run (or Cmd/Ctrl+Enter) to redeploy.

MODEL = "ssd-mobilenet-v2"              # ssd-mobilenet-v2 | ssd-inception-v2 | yolov5s | peoplenet
CLASSES = ["person", "car", "bicycle"]  # person, car, bicycle, dog, truck
CONFIDENCE_THRESHOLD = 0.55
CAMERA_FPS = 30
SHOW_LABELS = True

import jetson_inference
import jetson_utils

net = jetson_inference.detectNet(MODEL, threshold=CONFIDENCE_THRESHOLD)
camera = jetson_utils.videoSource("csi://0")
display = jetson_utils.videoOutput("display://0")

while display.IsStreaming():
    img = camera.Capture()
    detections = net.Detect(img)
    display.Render(img)
`;

export const TEMPLATES: Record<Architecture, string> = {
  "arduino-uno": ARDUINO_BLINK,
  "8051": ASM_BLINK,
  esp32: esp32Sketch("PASTE_DATABASE_URL", "PASTE_DEVICE_KEY"),
  "jetson-nano": JETSON_MAIN,
};

export const EXAMPLES: Record<Architecture, { name: string; code: string }[]> = {
  "arduino-uno": [
    { name: "Blink + serial", code: ARDUINO_BLINK },
    { name: "PWM fade (scope D9)", code: ARDUINO_PWM },
    { name: "Push button (D2)", code: ARDUINO_BUTTON },
  ],
  "8051": [
    { name: "Blink (delay loop)", code: ASM_BLINK },
    { name: "Timer 0 interrupt blink", code: ASM_TIMER },
    { name: "Push button (P3.2)", code: ASM_BUTTON },
  ],
  esp32: [{ name: "Firebase telemetry", code: esp32Sketch("PASTE_DATABASE_URL", "PASTE_DEVICE_KEY") }],
  "jetson-nano": [{ name: "Object detection", code: JETSON_MAIN }],
};

export const PIN_OPTIONS: Record<Architecture, string[]> = {
  "arduino-uno": [
    ...Array.from({ length: 14 }, (_, i) => `D${i}`),
    ...Array.from({ length: 6 }, (_, i) => `A${i}`),
  ],
  "8051": [0, 1, 2, 3].flatMap((p) => Array.from({ length: 8 }, (_, b) => `P${p}.${b}`)),
  esp32: [],
  "jetson-nano": [],
};

export const DEFAULT_LED_PIN: Record<Architecture, string | undefined> = {
  "arduino-uno": "D13", "8051": "P1.0", esp32: undefined, "jetson-nano": undefined,
};

export const DEFAULT_BUTTON_PIN: Record<Architecture, string | undefined> = {
  "arduino-uno": "D2", "8051": "P3.2", esp32: undefined, "jetson-nano": undefined,
};

export function languageFor(file: string): string {
  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "asm" || ext === "a51") return "asm8051";
  if (ext === "py") return "python";
  if (ext === "c") return "c";
  return "cpp";
}