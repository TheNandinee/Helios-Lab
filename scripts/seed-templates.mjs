/**
 * Seed Helios Lab starter projects and grading test suites.
 *
 * Dry run (default):
 *   node scripts/seed-templates.mjs <ADMIN_UID>
 * Write:
 *   node scripts/seed-templates.mjs <ADMIN_UID> --apply
 * Also create guest demo copies:
 *   node scripts/seed-templates.mjs <ADMIN_UID> --apply --include-demos
 *
 * Requires ./service-account.json (gitignored) for the target Firebase project.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const credentialPath = resolve(ROOT, "service-account.json");
const configPath = resolve(ROOT, "config/grading-test-suites.json");
const args = process.argv.slice(2);
const adminUid = args.find((arg) => !arg.startsWith("--"));
const apply = args.includes("--apply");
const includeDemos = args.includes("--include-demos");

function usage() {
  console.log(`Usage: node scripts/seed-templates.mjs <ADMIN_UID> [--apply] [--include-demos]\n` +
    `Without --apply the script only validates and prints the planned writes.`);
}

if (args.includes("--help") || args.includes("-h")) { usage(); process.exit(0); }
if (!adminUid) { usage(); console.error("ADMIN_UID is required."); process.exit(1); }
if (!existsSync(credentialPath)) {
  console.error("Missing service-account.json in the project root. Keep this file private and never commit it.");
  process.exit(1);
}
if (!existsSync(configPath)) throw new Error(`Missing grading suite definitions: ${configPath}`);

const serviceAccount = JSON.parse(readFileSync(credentialPath, "utf8"));
if (!serviceAccount.project_id) throw new Error("service-account.json must contain project_id.");
const firebaseRcPath = resolve(ROOT, ".firebaserc");
if (existsSync(firebaseRcPath)) {
  const rc = JSON.parse(readFileSync(firebaseRcPath, "utf8"));
  const configured = rc.projects?.default;
  if (configured && configured !== serviceAccount.project_id) {
    throw new Error(`Credential project (${serviceAccount.project_id}) does not match .firebaserc (${configured}).`);
  }
}

const app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth(app);
const db = getFirestore(app);
const suites = JSON.parse(readFileSync(configPath, "utf8"));

const templates = [
  {
    id: "template_arduino_uno_blink",
    name: "Arduino Uno – Blink",
    hardware_architecture: "arduino-uno",
    diagram_json: {
      components: [
        { id: "uno-1", type: "arduino-uno", position: [-0.6, 0, 0.1] },
        { id: "led-1", type: "led", position: [0.4, 0, 0.1], pin: "D13", color: "#ef4444" }
      ],
      wires: [
        { from: "uno-1:13", to: "led-1:A", color: "green" },
        { from: "led-1:C", to: "uno-1:GND", color: "black" }
      ]
    },
    source_code: {
      "sketch.ino": `void setup() {\n  pinMode(13, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}\n`
    }
  },
  {
    id: "template_8051_p10_blink",
    name: "8051 – P1.0 LED Blink",
    hardware_architecture: "8051",
    diagram_json: {
      components: [
        { id: "mcu-1", type: "mcu-8051", position: [-0.6, 0, 0.1] },
        { id: "led-1", type: "led", position: [0.4, 0, 0.1], pin: "P1.0", color: "#ef4444" }
      ],
      wires: [
        { from: "mcu-1:P1.0", to: "led-1:A", color: "green" },
        { from: "led-1:C", to: "mcu-1:GND", color: "black" }
      ]
    },
    source_code: {
      "main.asm": `        ORG 0000H\nLED     EQU P1.0\nSTART:  CPL LED\n        ACALL DELAY\n        SJMP START\nDELAY:  MOV R1, #5\nD0:     MOV R2, #200\nD1:     MOV R3, #250\nD2:     DJNZ R3, D2\n        DJNZ R2, D1\n        DJNZ R1, D0\n        RET\n        END\n`
    }
  },
  {
    id: "template_esp32_telemetry",
    name: "ESP32 – Sensor Telemetry",
    hardware_architecture: "esp32",
    diagram_json: {
      components: [
        { id: "esp32-1", type: "esp32", position: [-0.6, 0, 0.1] },
        { id: "led-1", type: "led", position: [0.4, 0, 0.1], color: "#22c55e" }
      ],
      wires: [ { from: "esp32-1:2", to: "led-1:A", color: "green" } ]
    },
    source_code: {
      "esp32_sketch.ino": `#include <WiFi.h>\n#include <HTTPClient.h>\n#include <WiFiClientSecure.h>\nconst char* DB_URL = "PASTE_DATABASE_URL";\nconst char* DEVICE_KEY = "PASTE_DEVICE_KEY";\nvoid setup() {\n  Serial.begin(115200);\n  pinMode(2, OUTPUT);\n  analogReadResolution(12);\n  WiFi.begin("Wokwi-GUEST", "", 6);\n}\nvoid loop() {\n  int raw = analogRead(34);\n  float voltage = raw * 3.3f / 4095.0f;\n  bool led = voltage > 1.65f;\n  digitalWrite(2, led);\n  WiFiClientSecure client; client.setInsecure();\n  HTTPClient http;\n  http.begin(client, String(DB_URL) + "/device_ingest/" + DEVICE_KEY + ".json");\n  http.addHeader("Content-Type", "application/json");\n  http.PUT(String("{\\\"adc_raw\\\":") + raw + "}");\n  http.end();\n  delay(1000);\n}\n`
    }
  },
  {
    id: "template_jetson_nano_detection",
    name: "Jetson Nano – Object Detection",
    hardware_architecture: "jetson-nano",
    diagram_json: {
      components: [ { id: "jetson-1", type: "jetson-nano", position: [-0.6, 0, 0.1] } ],
      wires: []
    },
    source_code: {
      "main.py": `MODEL = "ssd-mobilenet-v2"\nCLASSES = ["person", "car", "bicycle"]\nCONFIDENCE_THRESHOLD = 0.55\nCAMERA_FPS = 30\nSHOW_LABELS = True\nimport jetson_inference\nimport jetson_utils\nnet = jetson_inference.detectNet(MODEL, threshold=CONFIDENCE_THRESHOLD)\ncamera = jetson_utils.videoSource("csi://0")\ndisplay = jetson_utils.videoOutput("display://0")\nwhile display.IsStreaming():\n    img = camera.Capture()\n    detections = net.Detect(img)\n    display.Render(img)\n`
    }
  }
];

function templateDocument(template, ownerUid, existingCreatedAt) {
  return {
    project_id: template.id,
    owner_uid: ownerUid,
    name: template.name,
    hardware_architecture: template.hardware_architecture,
    diagram_json: template.diagram_json,
    source_code: template.source_code,
    is_template: true,
    created_at: existingCreatedAt ?? FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp()
  };
}

async function main() {
  const admin = await auth.getUser(adminUid);
  if (admin.customClaims?.role !== "admin") {
    throw new Error(`UID ${adminUid} does not have custom claim role="admin". Ask a project admin to assign it.`);
  }

  const writes = [
    ...templates.map((t) => ({ collection: "lab_projects", id: t.id, kind: "template", data: t })),
    ...Object.entries(suites).map(([arch, suite]) => ({
      collection: "test_suites", id: `suite_${arch}`, kind: "grading suite", data: { hardware_architecture: arch, active: true, ...suite }
    }))
  ];
  if (includeDemos) {
    for (const t of templates) writes.push({
      collection: "demo_projects", id: t.id.replace(/^template_/, "demo_"), kind: "demo", data: t
    });
  }

  console.log(`Firebase project: ${serviceAccount.project_id}`);
  console.log(`Admin UID: ${adminUid}`);
  console.log(`Mode: ${apply ? "WRITE" : "DRY RUN"}`);
  console.log(`Planned documents: ${writes.length}`);
  for (const item of writes) console.log(`  ${item.collection}/${item.id} (${item.kind})`);
  if (!apply) { console.log("\nDry run only. Add --apply to write these documents."); return; }

  const snapshots = await Promise.all(writes.map((w) => db.collection(w.collection).doc(w.id).get()));
  const batch = db.batch();
  writes.forEach((w, i) => {
    const ref = db.collection(w.collection).doc(w.id);
    const previous = snapshots[i].exists ? snapshots[i].data() : undefined;
    let data;
    if (w.collection === "lab_projects") data = templateDocument(w.data, adminUid, previous?.created_at);
    else if (w.collection === "demo_projects") data = {
      project_id: w.id, owner_uid: adminUid, name: w.data.name,
      hardware_architecture: w.data.hardware_architecture, diagram_json: w.data.diagram_json,
      source_code: w.data.source_code, is_demo: true,
      created_at: previous?.created_at ?? FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp()
    };
    else data = { ...w.data, updated_at: FieldValue.serverTimestamp() };
    batch.set(ref, data);
  });
  await batch.commit();
  console.log(`\nSuccessfully wrote ${writes.length} documents.`);
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
