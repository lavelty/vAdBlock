$urls = @(
    "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/BaseFilter/sections/adservers.txt",
    "https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/SpywareFilter/sections/tracking_servers.txt"
)

$domains = @("nativo.com", "ntv.io", "postrelease.com", "mixpanel.com", "api.mixpanel.com")

foreach ($url in $urls) {
    Write-Output "Downloading $url..."
    $content = Invoke-RestMethod -Uri $url
    $lines = $content -split "`n"
    foreach ($line in $lines) {
        $line = $line.Trim()
        if ($line.StartsWith("||") -and $line.EndsWith("^")) {
            $domain = $line.Substring(2, $line.Length - 3)
            if ($domain -notmatch "/") {
                $domains += $domain
            }
        }
    }
}

$domains = $domains | Select-Object -Unique
Write-Output "Total unique domains from AdGuard: $($domains.Count)"

$rulesPath = "c:\Users\egeko\Desktop\Vade Extensions\lave_adblock\rules.json"
$existingRules = Get-Content -Path $rulesPath -Raw | ConvertFrom-Json

$chunkSize = 1000
$newRules = @()
$maxId = 0
foreach ($r in $existingRules) {
    if ($r.id -gt $maxId) { $maxId = $r.id }
}
$id = $maxId + 1

for ($i = 0; $i -lt $domains.Count; $i += $chunkSize) {
    $chunk = $domains | Select-Object -Skip $i -First $chunkSize
    
    $rule = @{
        id = $id
        priority = 1
        action = @{ type = "block" }
        condition = @{
            requestDomains = $chunk
            resourceTypes = @("main_frame", "sub_frame", "script", "image", "xmlhttprequest", "ping", "media", "websocket", "other")
        }
    }
    $newRules += $rule
    $id++
}

$finalRules = $existingRules + $newRules
$finalRules | ConvertTo-Json -Depth 10 | Out-File -FilePath $rulesPath -Encoding utf8
Write-Output "Successfully injected AdGuard lists! Total rules in JSON: $($finalRules.Count)"
