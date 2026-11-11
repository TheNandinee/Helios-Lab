import type { Architecture } from "@/store/useLabStore";

export const MAIN_FILE: Record<Architecture, string> = {
  "arduino-uno": "sketch.ino",
  "8051": "main.asm",
  esp32: "esp32_sketch.ino",
  "jetson-nano": "main.py",
};

export const TEMPLATES: Record<Architecture, string> = {
  "arduino-uno": `// Helios Lab – Arduino Uno: blink + serial
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
`,
  "8051": `; Helios Lab – 8051 blink on P1.0
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
`,
  esp32: `// Helios Lab – ESP32 (paste into your Wokwi ESP32 project)
#include <WiFi.h>

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  WiFi.begin("Wokwi-GUEST", "", 6);
  while (WiFi.status() != WL_CONNECTED) { delay(250); Serial.print("."); }
  Serial.println("\\nWi-Fi connected: " + WiFi.localIP().toString());
}

void loop() {
  digitalWrite(2, !digitalRead(2));
  delay(500);
}
`,
  "jetson-nano": `# Helios Lab – Jetson Nano vision tier (Phase 3)
import cv2
print("Edge AI pipeline coming in Phase 3")
`,
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
  "arduino-uno": "D13",
  "8051": "P1.0",
  esp32: undefined,
  "jetson-nano": undefined,
};

export function languageFor(file: string): string {
  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "asm" || ext === "a51") return "asm8051";
  if (ext === "py") return "python";
  if (ext === "c") return "c";
  return "cpp";
}