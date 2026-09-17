param(
    [string]$Prompt1 = "   Enter Master Recovery Passphrase (min 8 chars): ",
    [string]$Prompt2 = "   Confirm Master Recovery Passphrase: "
)

function Read-ZeroEchoSecureString([string]$promptText) {
    # If stdin is redirected (e.g. automated test suites), read line directly into SecureString
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

    # Interactive mode: Display prompt to console screen via stderr (inherited stream)
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

$sec1 = Read-ZeroEchoSecureString $Prompt1
if ($null -eq $sec1 -or $sec1.Length -eq 0) {
    [System.Console]::Error.WriteLine("ERROR: Passphrase cannot be empty.")
    exit 2
}

$sec2 = Read-ZeroEchoSecureString $Prompt2
if ($null -eq $sec2 -or $sec2.Length -eq 0) {
    [System.Console]::Error.WriteLine("ERROR: Confirmation passphrase cannot be empty.")
    exit 2
}

$bstr1 = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec1)
$bstr2 = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec2)
$pass1 = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr1)
$pass2 = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr2)

# Immediately zero out unmanaged BSTR memory
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr1)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr2)

if ($pass1.Length -lt 8) {
    [System.Console]::Error.WriteLine("ERROR: Passphrase must be at least 8 characters long.")
    exit 2
}

if ($pass1 -ne $pass2) {
    [System.Console]::Error.WriteLine("ERROR: Passphrase confirmation mismatch. Failed closed.")
    exit 3
}

# Stream confirmed passphrase directly to stdout pipe (IPC to parent Node process)
[System.Console]::Out.Write($pass1)
[System.Console]::Out.Flush()

# Explicitly exit 0 to close pipes and return control immediately
exit 0
