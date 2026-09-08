Get-ChildItem 'src\models\*.ts' -Exclude 'index.ts' | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $patched = $content -replace 'new Schema<I\w+Document>', 'new Schema'
    Set-Content $_.FullName $patched -NoNewline
    Write-Host "Patched: $($_.Name)"
}
Write-Host "Done."
