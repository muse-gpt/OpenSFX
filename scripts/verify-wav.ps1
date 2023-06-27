# Independent WAV oracle for the OpenSFX install-state products.
#
# Parses the RIFF chunks by hand (no shared decoder with the implementation,
# per the acceptance rule that products must not share an oracle with the
# code under test) and asserts, per file: PCM16 stereo 44100 header, frame
# count equal to round(duration * 44100), no trailing bytes past the data
# chunk, every sample inside the i16 range, and audibility floors (peak
# above 0.02 and RMS above 1e-4 - a non-empty file is not proof of sound).
#
#   powershell -File scripts/verify-wav.ps1 <outDir>

param(
    [Parameter(Mandatory = $true)][string]$OutDir
)

$ErrorActionPreference = 'Stop'

$expected = [ordered]@{
    'whoosh-a.wav'           = 0.6
    'impact-a.wav'           = 0.6
    'riser-a.wav'            = 0.6
    'tick-a.wav'             = 0.6
    'glitch-a.wav'           = 0.6
    'sub-a.wav'              = 0.6
    'ambience-a.wav'         = 0.6
    'sparkle-a.wav'          = 0.6
    'preset-whoosh-soft.wav' = 0.9
    'preset-whoosh-metal.wav' = 0.7
    'preset-impact-deep.wav' = 1.4
    'preset-impact-snap.wav' = 0.45
    'preset-riser-tension.wav' = 6.0
    'preset-tick-clean.wav'  = 0.12
    'preset-glitch-data.wav' = 0.8
    'preset-sub-drop.wav'    = 2.2
    'preset-ambience-night.wav' = 8.0
    'preset-sparkle-rise.wav' = 1.6
    'cli-tick-clean.wav'     = 0.12
}

$failures = 0

function Read-U16([byte[]]$b, [int]$i) { [BitConverter]::ToUInt16($b, $i) }
function Read-U32([byte[]]$b, [int]$i) { [BitConverter]::ToUInt32($b, $i) }

foreach ($entry in $expected.GetEnumerator()) {
    $name = $entry.Key
    $duration = $entry.Value
    $path = Join-Path $OutDir $name
    $problems = @()

    if (-not (Test-Path -LiteralPath $path)) {
        Write-Host "FAIL $name - file missing"
        $failures += 1
        continue
    }

    $bytes = [System.IO.File]::ReadAllBytes($path)
    $fmt = $null
    $dataStart = -1
    $dataSize = -1

    if ($bytes.Length -lt 12 -or
        [System.Text.Encoding]::ASCII.GetString($bytes, 0, 4) -ne 'RIFF' -or
        [System.Text.Encoding]::ASCII.GetString($bytes, 8, 4) -ne 'WAVE') {
        $problems += 'RIFF/WAVE magic missing'
    }
    else {
        $riffSize = Read-U32 $bytes 4
        if ($riffSize + 8 -ne $bytes.Length) { $problems += "RIFF size $riffSize does not cover the file ($($bytes.Length) bytes)" }
        $cursor = 12
        while ($cursor + 8 -le $bytes.Length) {
            $id = [System.Text.Encoding]::ASCII.GetString($bytes, $cursor, 4)
            $size = Read-U32 $bytes ($cursor + 4)
            $body = $cursor + 8
            if ($id -eq 'fmt ') { $fmt = @{ format = Read-U16 $bytes $body; channels = Read-U16 $bytes ($body + 2); rate = Read-U32 $bytes ($body + 4); bits = Read-U16 $bytes ($body + 14) } }
            elseif ($id -eq 'data') { $dataStart = $body; $dataSize = $size }
            $cursor = $body + $size + ($size % 2)
        }
    }

    if ($null -eq $fmt) { $problems += 'no fmt chunk' }
    else {
        if ($fmt.format -ne 1) { $problems += "audio format $($fmt.format) is not PCM" }
        if ($fmt.channels -ne 2) { $problems += "$($fmt.channels) channels, expected 2" }
        if ($fmt.rate -ne 44100) { $problems += "sample rate $($fmt.rate), expected 44100" }
        if ($fmt.bits -ne 16) { $problems += "$($fmt.bits)-bit, expected 16" }
    }
    if ($dataStart -lt 0) { $problems += 'no data chunk' }
    else {
        if ($dataSize % 4 -ne 0) { $problems += "data size $dataSize is not a whole number of stereo frames" }
        if ($dataStart + $dataSize -ne $bytes.Length) { $problems += "data chunk ends at $($dataStart + $dataSize), file is $($bytes.Length) bytes" }
        $frames = $dataSize / 4
        $wantFrames = [int][Math]::Round($duration * 44100, [System.MidpointRounding]::AwayFromZero)
        if ($frames -ne $wantFrames) { $problems += "$frames frames, expected $wantFrames for ${duration}s" }

        $peak = 0
        $sumSquares = 0.0
        $total = 0
        for ($i = 0; $i -lt $dataSize; $i += 2) {
            $sample = [int][BitConverter]::ToInt16($bytes, $dataStart + $i)
            $abs = [Math]::Abs($sample)
            if ($abs -gt $peak) { $peak = $abs }
            $sumSquares += $sample * $sample
            $total += 1
        }
        $peakNorm = $peak / 32767.0
        $rmsNorm = [Math]::Sqrt($sumSquares / $total) / 32767.0
        if ($peakNorm -le 0.02) { $problems += "peak $peakNorm is at or below the audibility floor 0.02" }
        if ($rmsNorm -le 1e-4) { $problems += "RMS $rmsNorm is silent" }
        $metrics = "frames $frames peak {0:N4} rms {1:N5}" -f $peakNorm, $rmsNorm
    }

    if ($problems.Count -eq 0) {
        Write-Host "PASS $name - $metrics"
    }
    else {
        Write-Host "FAIL $name - $($problems -join '; ')"
        $failures += 1
    }
}

if ($failures -eq 0) { Write-Host 'ALL WAV CHECKS PASS' } else { Write-Host "$failures WAV FAILURES" }
if ($failures -eq 0) { exit 0 } else { exit 1 }
