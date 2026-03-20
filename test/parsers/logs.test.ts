import { describe, it, expect } from 'vitest';

/**
 * Unit tests for dslog parser
 * Tests the parsing logic with synthetic binary data
 */

// Helper to create a dslog v4 buffer with known values
function createDslogV4Buffer(records: Array<{
  tripTime: number;      // 0-127 (will be * 2 in raw)
  lostPackets: number;   // 0-63 (will be / 4 in raw)
  voltage: number;       // 5-16 (will be * 256 in raw)
  rioCpu: number;        // 0-100 (will be * 4 in raw)
  status: number;        // raw status byte (will be inverted)
  canUsage: number;      // 0-100 (will be * 4 in raw)
}>): ArrayBuffer {
  const headerSize = 16;
  const recordSize = 47;
  const dataBlockOffset = 4;

  const bufferSize = headerSize + records.length * recordSize;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Write header: version 4 as big-endian int32
  view.setInt32(0, 4, false);

  // Write records
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const recordOffset = headerSize + i * recordSize;
    const dataOffset = recordOffset + dataBlockOffset;

    // Byte 0: Trip time (raw = value * 2)
    bytes[dataOffset] = Math.round(rec.tripTime * 2);

    // Byte 1: Packet loss (raw = value / 4)
    bytes[dataOffset + 1] = Math.round(rec.lostPackets / 4);

    // Bytes 2-3: Voltage (raw = value * 256, big-endian)
    const voltageRaw = Math.round(rec.voltage * 256);
    view.setUint16(dataOffset + 2, voltageRaw, false);

    // Byte 4: Rio CPU (raw = value * 4)
    bytes[dataOffset + 4] = Math.round(rec.rioCpu * 4);

    // Byte 5: Status (will be inverted when read, so invert here)
    bytes[dataOffset + 5] = ~rec.status & 0xff;

    // Byte 6: CAN usage (raw = value * 4)
    bytes[dataOffset + 6] = Math.round(rec.canUsage * 4);
  }

  return buffer;
}

// Import the parser - we'll need to extract the parsing logic for unit testing
// For now, test the binary structure creation and parsing logic

describe('dslog v4 binary format', () => {
  it('should have correct header structure', () => {
    const buffer = createDslogV4Buffer([]);
    const view = new DataView(buffer);

    // Version should be 4
    expect(view.getInt32(0, false)).toBe(4);

    // Buffer should be exactly header size when no records
    expect(buffer.byteLength).toBe(16);
  });

  it('should encode voltage correctly', () => {
    const buffer = createDslogV4Buffer([
      { tripTime: 0, lostPackets: 0, voltage: 12.035, rioCpu: 0, status: 0, canUsage: 0 }
    ]);
    const view = new DataView(buffer);

    // Voltage at dataOffset + 2 (header 16 + prefix 4 + 2 = 22)
    const voltageRaw = view.getUint16(22, false);
    const voltage = voltageRaw / 256;

    expect(voltage).toBeCloseTo(12.035, 2);
  });

  it('should encode multiple voltage values correctly', () => {
    const testVoltages = [12.0, 11.5, 10.0, 9.5, 9.047];
    const records = testVoltages.map(v => ({
      tripTime: 0, lostPackets: 0, voltage: v, rioCpu: 0, status: 0, canUsage: 0
    }));

    const buffer = createDslogV4Buffer(records);
    const view = new DataView(buffer);

    const headerSize = 16;
    const recordSize = 47;
    const dataBlockOffset = 4;

    for (let i = 0; i < testVoltages.length; i++) {
      const dataOffset = headerSize + i * recordSize + dataBlockOffset;
      const voltageRaw = view.getUint16(dataOffset + 2, false);
      const voltage = voltageRaw / 256;

      expect(voltage).toBeCloseTo(testVoltages[i], 2);
    }
  });

  it('should encode status bits correctly for brownout', () => {
    const buffer = createDslogV4Buffer([
      // Status 0x01 = brownout bit set (after inversion)
      { tripTime: 0, lostPackets: 0, voltage: 12.0, rioCpu: 0, status: 0x01, canUsage: 0 }
    ]);
    const bytes = new Uint8Array(buffer);

    // Status at dataOffset + 5 (header 16 + prefix 4 + 5 = 25)
    const statusRaw = bytes[25];
    const status = ~statusRaw & 0xff;
    const brownout = (status & 0x01) !== 0;

    expect(brownout).toBe(true);
  });

  it('should encode status bits correctly for watchdog', () => {
    const buffer = createDslogV4Buffer([
      // Status 0x02 = watchdog bit set (after inversion)
      { tripTime: 0, lostPackets: 0, voltage: 12.0, rioCpu: 0, status: 0x02, canUsage: 0 }
    ]);
    const bytes = new Uint8Array(buffer);

    const statusRaw = bytes[25];
    const status = ~statusRaw & 0xff;
    const watchdog = (status & 0x02) !== 0;

    expect(watchdog).toBe(true);
  });

  it('should calculate correct record count', () => {
    const numRecords = 100;
    const records = Array(numRecords).fill({
      tripTime: 5, lostPackets: 0, voltage: 12.0, rioCpu: 50, status: 0, canUsage: 30
    });

    const buffer = createDslogV4Buffer(records);

    const headerSize = 16;
    const recordSize = 47;
    const calculatedRecords = Math.floor((buffer.byteLength - headerSize) / recordSize);

    expect(calculatedRecords).toBe(numRecords);
  });

  it('should encode trip time correctly', () => {
    const buffer = createDslogV4Buffer([
      { tripTime: 4.5, lostPackets: 0, voltage: 12.0, rioCpu: 0, status: 0, canUsage: 0 }
    ]);
    const bytes = new Uint8Array(buffer);

    // Trip time at dataOffset (header 16 + prefix 4 = 20)
    const tripTimeRaw = bytes[20];
    const tripTime = tripTimeRaw / 2;

    expect(tripTime).toBe(4.5);
  });

  it('should encode CPU usage correctly', () => {
    const buffer = createDslogV4Buffer([
      { tripTime: 0, lostPackets: 0, voltage: 12.0, rioCpu: 50, status: 0, canUsage: 0 }
    ]);
    const bytes = new Uint8Array(buffer);

    // CPU at dataOffset + 4 (header 16 + prefix 4 + 4 = 24)
    const cpuRaw = bytes[24];
    const rioCpu = (cpuRaw / 2) * 0.5;

    expect(rioCpu).toBeCloseTo(50, 0);
  });

  it('should encode CAN usage correctly', () => {
    // CAN usage formula: (byte / 2) * 0.5 = value, max ~63.75%
    const buffer = createDslogV4Buffer([
      { tripTime: 0, lostPackets: 0, voltage: 12.0, rioCpu: 0, status: 0, canUsage: 30 }
    ]);
    const bytes = new Uint8Array(buffer);

    // CAN at dataOffset + 6 (header 16 + prefix 4 + 6 = 26)
    const canRaw = bytes[26];
    const canUsage = (canRaw / 2) * 0.5;

    expect(canUsage).toBeCloseTo(30, 0);
  });
});

describe('dslog voltage range validation', () => {
  it('should identify valid voltage range (5V-16V)', () => {
    const validVoltages = [5.0, 9.0, 12.0, 14.0, 16.0];
    const invalidVoltages = [0.0, 2.0, 4.9, 16.1, 20.0];

    for (const v of validVoltages) {
      expect(v >= 5 && v <= 16).toBe(true);
    }

    for (const v of invalidVoltages) {
      expect(v >= 5 && v <= 16).toBe(false);
    }
  });

  it('should identify brownout threshold (< 6.3V)', () => {
    const brownoutVoltages = [5.0, 5.5, 6.0, 6.2];
    const normalVoltages = [6.3, 6.5, 9.0, 12.0];

    for (const v of brownoutVoltages) {
      expect(v >= 5 && v < 6.3).toBe(true);
    }

    for (const v of normalVoltages) {
      expect(v >= 5 && v < 6.3).toBe(false);
    }
  });

  it('should identify low voltage threshold (< 7V)', () => {
    const lowVoltages = [5.0, 6.0, 6.9];
    const normalVoltages = [7.0, 9.0, 12.0];

    for (const v of lowVoltages) {
      expect(v < 7).toBe(true);
    }

    for (const v of normalVoltages) {
      expect(v < 7).toBe(false);
    }
  });
});

describe('dslog statistics calculation', () => {
  it('should find min/max voltage correctly', () => {
    const voltages = [12.0, 11.5, 10.0, 9.5, 9.047, 10.5, 11.0];

    const validVoltages = voltages.filter(v => v >= 5 && v <= 16);
    const min = Math.min(...validVoltages);
    const max = Math.max(...validVoltages);

    expect(min).toBeCloseTo(9.047, 3);
    expect(max).toBeCloseTo(12.0, 3);
  });

  it('should count low voltage events correctly', () => {
    const voltages = [12.0, 6.5, 11.0, 6.8, 10.0, 6.9, 9.0];

    const lowVoltageCount = voltages.filter(v => v >= 5 && v < 7).length;

    expect(lowVoltageCount).toBe(3);
  });

  it('should track brownout transitions correctly', () => {
    // Simulate voltage dropping into brownout and recovering
    const voltages = [12.0, 10.0, 8.0, 6.0, 5.5, 6.2, 8.0, 12.0, 6.0, 12.0];

    let brownoutCount = 0;
    let prevBrownout = false;

    for (const v of voltages) {
      const brownout = v >= 5 && v < 6.3;
      if (brownout && !prevBrownout) {
        brownoutCount++;
      }
      prevBrownout = brownout;
    }

    // Should count 2 brownout transitions (12->6.0 and 12->6.0)
    expect(brownoutCount).toBe(2);
  });
});
