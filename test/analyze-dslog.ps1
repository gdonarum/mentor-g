$file = "c:\data\Projects\Robotics\mentor-g\test\fixtures\2026_03_18 20_36_51 Wed.dslog"
$bytes = [System.IO.File]::ReadAllBytes($file)

Write-Output "File size: $($bytes.Length) bytes"
Write-Output "First 20 bytes (hex):"
$hex = ($bytes[0..19] | ForEach-Object { "{0:X2}" -f $_ }) -join " "
Write-Output $hex

Write-Output ""
Write-Output "Byte 0: $($bytes[0])"
Write-Output "Bytes 0-3 as BE int32 (version?): $([BitConverter]::ToInt32([byte[]]($bytes[3], $bytes[2], $bytes[1], $bytes[0]), 0))"

# Look for voltage patterns - check bytes at different offsets
Write-Output ""
Write-Output "Sample record analysis (assuming different header sizes):"

# Try offset 8 (if 8-byte header)
$offset = 8
Write-Output "At offset $offset : bytes = $($bytes[$offset]), $($bytes[$offset+1]), $($bytes[$offset+2]), $($bytes[$offset+3])"
$v1 = $bytes[$offset+2] + $bytes[$offset+3] / 256.0
Write-Output "  Voltage (current formula): $v1"

# Try offset 35 (look for patterns)
for ($i = 0; $i -lt 50; $i++) {
    $v = $bytes[$i]
    if ($v -ge 9 -and $v -le 13) {
        Write-Output "  Byte $i = $v (could be integer voltage)"
    }
}
