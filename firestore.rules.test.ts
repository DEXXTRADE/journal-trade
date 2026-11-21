import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rules = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');

test('firestore.rules enforces global deny-all and restricts workspace to main journal', () => {
  assert.match(rules, /rules_version\s*=\s*'2';/);
  assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
  assert.match(rules, /journalId == 'main'/);
  assert.match(rules, /parentJournalExists\(journalId\)/);
  assert.doesNotMatch(rules, /request\.auth\.token\.email_verified/);
});

test('firestore.rules enforces blueprint length limits, theme enum, strict keys, and server timestamps', () => {
  assert.match(rules, /data\.journalName\.size\(\)\s*<=\s*40/);
  assert.match(rules, /data\.theme in \['light', 'dark'\]/);
  assert.match(rules, /data\.method\.size\(\)\s*<=\s*80/);
  assert.match(rules, /data\.pair\.size\(\)\s*<=\s*20/);
  assert.match(rules, /data\.note\.size\(\)\s*<=\s*500/);
  assert.match(rules, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(rules, /hasOnly\(/);
  assert.match(rules, /existing\(\)\.journalId == journalId/);
});
