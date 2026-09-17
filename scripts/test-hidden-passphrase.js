import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const psScript = path.join(__dirname, 'get-hidden-passphrase.ps1');

console.log('Testing get-hidden-passphrase.ps1 with simulated stdin inputs...');

function runHelperWithInput(inputStr) {
  const startTime = Date.now();
  const res = spawnSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', psScript
  ], {
    input: inputStr,
    encoding: 'utf-8',
    timeout: 5000
  });
  const duration = Date.now() - startTime;
  return { ...res, duration };
}

// 1. Successful matching passphrase
console.log('Case 1: Matching passphrase');
const pass1 = 'CorrectHorseBatteryStaple99!';
const res1 = runHelperWithInput(`${pass1}\r\n${pass1}\r\n`);
console.log('Case 1 exit code:', res1.status, 'duration:', res1.duration, 'ms');
console.log('Case 1 stdout len:', res1.stdout ? res1.stdout.length : 0);
if (
  res1.status !== 0 ||
  res1.stdout !== pass1 ||
  res1.stderr.includes('*') ||
  res1.stderr.includes(pass1)
) {
  console.error('Case 1 FAILED:', res1);
  process.exit(1);
} else {
  console.log('Case 1 PASSED (clean handoff, zero asterisks, no stderr leak)');
}

// 2. Mismatching passphrase
console.log('Case 2: Mismatching passphrase');
const pass2 = 'WrongPasswordBatteryStaple99!';
const res2 = runHelperWithInput(`${pass1}\r\n${pass2}\r\n`);
console.log('Case 2 exit code:', res2.status, 'duration:', res2.duration, 'ms');
if (
  res2.status !== 3 ||
  res2.stdout !== '' ||
  res2.stderr.includes('*') ||
  res2.stderr.includes(pass1) ||
  res2.stderr.includes(pass2)
) {
  console.error('Case 2 FAILED (expected exit code 3, empty stdout, zero leak):', res2);
  process.exit(1);
} else {
  console.log('Case 2 PASSED (failed closed with code 3, zero character leak)');
}

// 3. Empty passphrase
console.log('Case 3: Empty passphrase');
const res3 = runHelperWithInput('\r\n');
console.log('Case 3 exit code:', res3.status, 'duration:', res3.duration, 'ms');
if (res3.status !== 2 || res3.stdout !== '' || res3.stderr.includes('*')) {
  console.error('Case 3 FAILED (expected exit code 2, empty stdout):', res3);
  process.exit(1);
} else {
  console.log('Case 3 PASSED (failed closed with code 2)');
}

// 4. Short passphrase (< 8 chars)
console.log('Case 4: Short passphrase');
const res4 = runHelperWithInput('short\r\nshort\r\n');
console.log('Case 4 exit code:', res4.status, 'duration:', res4.duration, 'ms');
if (res4.status !== 2 || res4.stdout !== '' || res4.stderr.includes('*')) {
  console.error('Case 4 FAILED (expected exit code 2):', res4);
  process.exit(1);
} else {
  console.log('Case 4 PASSED (failed closed with code 2)');
}

console.log('ALL PASSPHRASE TESTS PASSED!');
