$file = "c:\data\Projects\Robotics\mentor-g\test\fixtures\2026_03_18 20_36_51 Wed.dslog"
$bytes = [System.IO.File]::ReadAllBytes($file)

Write-Output "=== DSLOG V4 RECORD ANALYSIS ==="
Write-Output ""

# Record size is 47 bytes, voltage byte 12 appears at offsets 22, 69, 116...
# So first record starts at: 22 - offset_within_record

# Let's find where 0C (12) appears within each 47-byte record
$recordSize = 47
$firstVoltageOffset = 22

# Within-record offset of voltage
$voltageOffsetInRecord = $firstVoltageOffset % $recordSize
Write-Output "Voltage appears at offset $voltageOffsetInRecord within each record"
Write-Output ""

# Header size = first voltage offset - voltage offset in record
$headerSize = $firstVoltageOffset - $voltageOffsetInRecord
Write-Output "Estimated header size: $headerSize bytes"
Write-Output ""

# Actually, let's look at the actual data more carefully
# First voltage at offset 22, which means:
# - If record offset is 22, and voltage is at position X in record, then header + X = 22
# - Next voltage at 69, so header + 47 + X = 69 -> header + X = 22 ✓

# Let's look at the 47-byte record starting at different positions
Write-Output "=== First few records (47 bytes each) ==="

for ($rec = 0; $rec -lt 5; $rec++) {
    $start = 16 + ($rec * 47)  # Assuming 16-byte header
    Write-Output "Record $rec (offset $start):"
    $recordBytes = $bytes[$start..($start + 46)]
    $hex = ($recordBytes | ForEach-Object { "{0:X2}" -f $_ }) -join " "
    Write-Output "  $hex"

    # Try to find voltage (0C = 12) in this record
    for ($j = 0; $j -lt $recordBytes.Length; $j++) {
        if ($recordBytes[$j] -eq 12) {
            Write-Output "  Found 0C at position $j in record"
        }
    }
    Write-Output ""
}

# Let's also sample some records in the middle of the file
Write-Output "=== Sample from middle of file ==="
$midOffset = [int]($bytes.Length / 2)
$alignedOffset = 16 + ([int](($midOffset - 16) / 47) * 47)
Write-Output "Middle record at offset $alignedOffset :"
$recordBytes = $bytes[$alignedOffset..($alignedOffset + 46)]
$hex = ($recordBytes | ForEach-Object { "{0:X2}" -f $_ }) -join " "
Write-Output "  $hex"

for ($j = 0; $j -lt $recordBytes.Length; $j++) {
    if ($recordBytes[$j] -ge 9 -and $recordBytes[$j] -le 13) {
        Write-Output "  Byte $j = $($recordBytes[$j]) (potential voltage)"
    }
}
