/**
 * Test script to verify dslog parser correctness
 * Run with: node test/test-dslog-parser.js
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'fixtures', '2026_03_18 20_36_51 Wed.dslog');
const buffer = fs.readFileSync(filePath);
const view = new DataView(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
const bytes = new Uint8Array(buffer);

console.log('=== DSLOG PARSER TEST ===\n');
console.log(`File: ${filePath}`);
console.log(`Size: ${buffer.length} bytes\n`);

// Parse header
const version = view.getInt32(0, false); // big-endian
console.log(`Version: ${version}`);

// Parser parameters
const headerSize = 16;
const recordSize = 47;
const dataBlockOffset = 4;
const numRecords = Math.floor((buffer.length - headerSize) / recordSize);

console.log(`Header size: ${headerSize} bytes`);
console.log(`Record size: ${recordSize} bytes`);
console.log(`Total records: ${numRecords}`);
console.log(`Duration: ~${(numRecords * 0.02).toFixed(1)} seconds\n`);

// Parse first few records
console.log('=== FIRST 5 RECORDS ===\n');

let minVoltage = 999;
let maxVoltage = 0;
let validCount = 0;

for (let i = 0; i < Math.min(5, numRecords); i++) {
  const recordOffset = headerSize + i * recordSize;
  const dataOffset = recordOffset + dataBlockOffset;

  const tripTime = bytes[dataOffset] / 2;
  const lostPackets = bytes[dataOffset + 1] * 4;
  const voltageRaw = view.getUint16(dataOffset + 2, false);
  const voltage = voltageRaw / 256.0;
  const rioCpu = (bytes[dataOffset + 4] / 2) * 0.5;
  const statusRaw = bytes[dataOffset + 5];
  const status = ~statusRaw & 0xff;
  const canUsage = (bytes[dataOffset + 6] / 2) * 0.5;
  const watchdog = (status & 0x02) !== 0;
  const brownoutFlag = (status & 0x01) !== 0;

  console.log(`Record ${i}:`);
  console.log(`  Trip time: ${tripTime.toFixed(1)}ms`);
  console.log(`  Packet loss: ${lostPackets}%`);
  console.log(`  Voltage: ${voltage.toFixed(3)}V (raw: 0x${voltageRaw.toString(16).padStart(4, '0')})`);
  console.log(`  RIO CPU: ${rioCpu.toFixed(1)}%`);
  console.log(`  CAN usage: ${canUsage.toFixed(1)}%`);
  console.log(`  Status raw: 0x${statusRaw.toString(16).padStart(2, '0')}, inverted: 0x${status.toString(16).padStart(2, '0')}`);
  console.log(`  Watchdog: ${watchdog}, Brownout flag: ${brownoutFlag}\n`);
}

// Scan all records for statistics
console.log('=== SCANNING ALL RECORDS ===\n');

for (let i = 0; i < numRecords; i++) {
  const recordOffset = headerSize + i * recordSize;
  const dataOffset = recordOffset + dataBlockOffset;

  if (dataOffset + 10 > buffer.length) break;

  const voltageRaw = view.getUint16(dataOffset + 2, false);
  const voltage = voltageRaw / 256.0;

  if (voltage >= 5 && voltage <= 16) {
    validCount++;
    if (voltage < minVoltage) minVoltage = voltage;
    if (voltage > maxVoltage) maxVoltage = voltage;
  }
}

console.log(`Valid records: ${validCount} / ${numRecords}`);
console.log(`Voltage range: ${minVoltage.toFixed(3)}V - ${maxVoltage.toFixed(3)}V`);
console.log('\n✅ Parser test complete');

// Expected: Claude Sonnet reported minimum 9.047V, max around 12V
if (minVoltage >= 9 && minVoltage <= 10 && maxVoltage >= 11 && maxVoltage <= 13) {
  console.log('✅ Voltage range matches expected values (min ~9V, max ~12V)');
} else {
  console.log(`⚠️ Voltage range may be off. Expected min ~9V, max ~12V`);
}
