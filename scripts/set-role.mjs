// Usage: node scripts/set-role.mjs someone@email.com instructor
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "node:fs";

const VALID = ["student", "instructor", "admin"];
const [email, role] = process.argv.slice(2);

if (!email || !VALID.includes(role)) {
  console.error("Usage: node scripts/set-role.mjs <email> <student|instructor|admin>");
  process.exit(1);
}

const sa = JSON.parse(readFileSync("./service-account.json", "utf8"));
initializeApp({ credential: cert(sa) });

const user = await getAuth().getUserByEmail(email);
await getAuth().setCustomUserClaims(user.uid, { role });
console.log(`✔ ${email} is now "${role}". They must sign out and back in.`);