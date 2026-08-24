const test = require('node:test');
const assert = require('node:assert/strict');
const { buildHistoryRecord } = require('./historyStore');

test('buildHistoryRecord captures the user and a compact result summary', () => {
  const record = buildHistoryRecord({
    userEmail: 'ada@example.com',
    userName: 'Ada',
    scanResult: {
      blur_score: 10,
      brightness_score: 80,
      pigmentation_score: 78,
      wrinkle_score: 50,
      texture_score: 66,
      contrast_score: 82,
      redness_score: 65,
      shine_score: 60,
      under_eye_shadow_score: 55,
      pore_score: 70,
      symmetry_score: 75,
      image_quality: 'Good',
      skin_tone: 'Medium',
      undertone: 'Warm',
      message: 'Healthy tone',
    },
  });

  assert.equal(record.userEmail, 'ada@example.com');
  assert.equal(record.userName, 'Ada');
  assert.equal(record.summary.imageQuality, 'Good');
  assert.equal(record.summary.skinTone, 'Medium');
  assert.equal(record.summary.undertone, 'Warm');
  assert.equal(record.summary.message, 'Healthy tone');
  assert.equal(record.summary.overallScore, 63);
});
