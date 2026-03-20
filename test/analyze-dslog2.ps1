$file = "c:\data\Projects\Robotics\mentor-g\test\fixtures\2026_03_18 20_36_51 Wed.dslog"
$bytes = [System.IO.File]::ReadAllBytes($file)

Write-Output "=== DSLOG V4 FORMAT ANALYSIS ==="
Write-Output "File size: $($bytes.Length) bytes"
Write-Output ""

# Header analysis
Write-Output "=== HEADER (first 32 bytes) ==="
for ($i = 0; $i -lt 32; $i += 4) {
    $hex = ($bytes[$i..($i+3)] | ForEach-Object { "{0:X2}" -f $_ }) -join " "
    $beInt = [BitConverter]::ToInt32([byte[]]($bytes[$i+3], $bytes[$i+2], $bytes[$i+1], $bytes[$i]), 0)
    Write-Output "Offset $i : $hex  (BE int: $beInt)"
}

# Look at potential records starting at different offsets
Write-Output ""
Write-Output "=== SEARCHING FOR 12V PATTERNS ==="

# Voltage around 12V could be:
# - Single byte: 12 (0x0C)
# - Two bytes: 12.5 = high:12, low:128 (0x0C 0x80) or (0x80 0x0C)
# - 16-bit scaled: various possibilities

$found = @()
for ($i = 0; $i -lt [Math]::Min(500, $bytes.Length - 2); $i++) {
    # Check for byte value 12 (integer voltage 12V)
    if ($bytes[$i] -eq 12) {
        $context = ($bytes[($i-2)..($i+5)] | ForEach-Object { "{0:X2}" -f $_ }) -join " "
        $found += "Offset $i : byte=12, context: $context"
    }
}
$found | Select-Object -First 10 | ForEach-Object { Write-Output $_ }

Write-Output ""
Write-Output "=== RECORD SIZE DETECTION ==="
# Look for repeating patterns to determine record size
$patternStart = 32  # Skip header
$sampleBytes = $bytes[$patternStart..($patternStart + 200)]
$hex = ($sampleBytes | ForEach-Object { "{0:X2}" -f $_ }) -join " "
Write-Output "Bytes 32-232: $hex"
