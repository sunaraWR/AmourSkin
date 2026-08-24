const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://venura449:new123@cluster0.q4dyssc.mongodb.net/?appName=Cluster0';
const DB_NAME = process.env.MONGODB_DB_NAME || 'sasvi_skin';
const COLLECTION_NAME = 'scan_history';

let client;
let db;

async function getConnection() {
  if (db) return db;
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);
  return db;
}

function parseNumericValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function computeOverallScore(scanResult) {
  const directScore = scanResult?.overall_score ?? scanResult?.overallScore ?? scanResult?.score;
  const parsedDirect = parseNumericValue(directScore);
  if (parsedDirect != null) {
    return Math.round(parsedDirect);
  }

  const metricKeys = [
    'blur_score',
    'brightness_score',
    'pigmentation_score',
    'wrinkle_score',
    'texture_score',
    'contrast_score',
    'redness_score',
    'shine_score',
    'under_eye_shadow_score',
    'pore_score',
    'symmetry_score',
  ];

  const values = metricKeys
    .map((key) => parseNumericValue(scanResult?.[key]))
    .filter((value) => value != null);

  if (!values.length) {
    const quality = scanResult?.image_quality?.toString().toLowerCase() || '';
    if (quality.includes('good')) return 82;
    if (quality.includes('fair') || quality.includes('moderate') || quality.includes('intermediate')) return 70;
    if (quality.includes('poor')) return 50;
    return null;
  }

  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(avg);
}

function buildHistoryRecord({ userEmail, userName, scanResult, metadata = {} }) {
  const summary = {
    imageQuality: scanResult?.image_quality || null,
    skinTone: scanResult?.skin_tone || null,
    undertone: scanResult?.undertone || null,
    message: scanResult?.message || null,
    overallScore: computeOverallScore(scanResult),
    blurScore: scanResult?.blur_score ?? null,
    brightnessScore: scanResult?.brightness_score ?? null,
    pigmentationScore: scanResult?.pigmentation_score ?? null,
    wrinkleScore: scanResult?.wrinkle_score ?? null,
    textureScore: scanResult?.texture_score ?? null,
    contrastScore: scanResult?.contrast_score ?? null,
    rednessScore: scanResult?.redness_score ?? null,
    shineScore: scanResult?.shine_score ?? null,
    underEyeShadowScore: scanResult?.under_eye_shadow_score ?? null,
    poreScore: scanResult?.pore_score ?? null,
    symmetryScore: scanResult?.symmetry_score ?? null,
    undertoneConfidence: scanResult?.undertone_confidence ?? null,
    createdAt: new Date().toISOString(),
  };

  return {
    userEmail: userEmail?.toLowerCase?.() || null,
    userName: userName || null,
    scanResult,
    summary,
    metadata,
    createdAt: new Date(),
  };
}

async function saveScanHistory(record) {
  const connection = await getConnection();
  const collection = connection.collection(COLLECTION_NAME);
  const result = await collection.insertOne(record);
  return { id: result.insertedId.toString(), ...record };
}

async function getUserScanHistory(userEmail) {
  const connection = await getConnection();
  const collection = connection.collection(COLLECTION_NAME);
  return collection
    .find({ userEmail: userEmail?.toLowerCase?.() || userEmail })
    .sort({ createdAt: -1 })
    .toArray();
}

module.exports = {
  buildHistoryRecord,
  saveScanHistory,
  getUserScanHistory,
  ObjectId,
};
