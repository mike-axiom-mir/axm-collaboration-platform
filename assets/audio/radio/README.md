# AXM Local Radio

Add only music you own or have permission to use, then list it in `index.json`:

```json
{
  "schema": "axm.local-radio/v1",
  "name": "AXM Local Mix",
  "tracks": [
    { "title": "Workshop Theme", "src": "/assets/audio/radio/workshop-theme.mp3" }
  ]
}
```

When at least one track exists, the Hub radio automatically adds the local mix to its station picker. Game music and sound effects should later use their own licensed asset manifests rather than rebroadcasting Internet radio.
