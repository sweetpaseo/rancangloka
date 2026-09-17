param(
    [string]$Prompt = "   Enter Master Recovery Passphrase: "
)

function Read-ZeroEchoSecureString([string]$promptText) {
    # If stdin is redirected (e.g. automated test suites or pipe IPC), read line directly into SecureString
    if ([Console]::IsInputRedirected) {
        $line = [Console]::In.ReadLine()
        $sec = New-Object System.Security.SecureString
        if ($line) {
            foreach ($c in $line.ToCharArray()) {
                $sec.AppendChar($c)
            }
        }
        return $sec
    }

    # Interactive mode: Display prompt to console screen via stderr (unbuffered inherited stream)
    [System.Console]::Error.Write($promptText)

    $sec = New-Object System.Security.SecureString
    while ($true) {
        # $true = intercept key: produces NO characters and NO asterisks on screen (true zero-echo)
        $keyInfo = [System.Console]::ReadKey($true)

        # Enter finishes input
        if ($keyInfo.Key -eq [System.ConsoleKey]::Enter -or [int]$keyInfo.KeyChar -eq 13 -or [int]$keyInfo.KeyChar -eq 10) {
            [System.Console]::Error.WriteLine()
            break
        }

        # Backspace handling without exposing length or echoing
        if ($keyInfo.Key -eq [System.ConsoleKey]::Backspace -or [int]$keyInfo.KeyChar -eq 8) {
            if ($sec.Length -gt 0) {
                $sec.RemoveAt($sec.Length - 1)
            }
            continue
        }

        # Escape cancels entry
        if ($keyInfo.Key -eq [System.ConsoleKey]::Escape) {
            [System.Console]::Error.WriteLine()
            [System.Console]::Error.WriteLine("ERROR: Passphrase entry cancelled by operator.")
            exit 1
        }

        # Accept standard printable ASCII characters (32..126)
        if ([int]$keyInfo.KeyChar -ge 32 -and [int]$keyInfo.KeyChar -le 126) {
            $sec.AppendChar($keyInfo.KeyChar)
        }
    }

    return $sec
}

$sec = Read-ZeroEchoSecureString $Prompt
if ($null -eq $sec -or $sec.Length -eq 0) {
    [System.Console]::Error.WriteLine("ERROR: Passphrase cannot be empty.")
    exit 2
}

$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
$pass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)

# Immediately zero out unmanaged BSTR memory
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

if ($pass.Length -lt 8) {
    [System.Console]::Error.WriteLine("ERROR: Passphrase must be at least 8 characters long.")
    exit 2
}

# Stream passphrase directly to stdout pipe (IPC to parent Node process)
[System.Console]::Out.Write($pass)
[System.Console]::Out.Flush()

# Explicitly exit 0 to close pipes and return control immediately
exit 0
