$ErrorActionPreference = "Stop"

try {
    # Read files with explicit encoding
    $gas = Get-Content -Path "gas.csv" -Raw -Encoding UTF8
    $we = Get-Content -Path "we.csv" -Raw -Encoding UTF8

    # Escape backticks and ${ using single-quoted strings to avoid PS expansion
    # In PS single quotes, ` is a literal backtick. \ is a literal backslash.
    $gas = $gas.Replace('`', '\`').Replace('${', '\${')
    $we = $we.Replace('`', '\`').Replace('${', '\${')

    # Construct the final JS content
    # We use double quotes here to allow variable expansion ($gas, $we)
    # We need to escape the surrounding backticks for the JS template literal.
    # In PS double quotes, a literal backtick is ``.
    
    $jsContent = "const GAS_CSV_TEXT = ``$gas``;`nconst WE_CSV_TEXT = ``$we``;"
    
    # Write to file
    $jsContent | Set-Content -Path "utility_data.js" -Encoding UTF8
    
    Write-Host "Success"
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
