# LEGO TSS Save Rescue

Static web tool for building repair candidates for PC saves from **LEGO Star Wars: The Skywalker Saga**.

It does not fully decode the save format. It builds practical candidate folders that try to move a broken resume/location state to a known-good safe landing point while preserving progress-heavy files.

## GitHub Pages Deployment

This repo deploys through GitHub Actions.

1. In GitHub, open **Settings -> Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push to `main`, or run **Deploy GitHub Pages** manually from the Actions tab.
4. Open the deployed URL from the workflow summary.

The workflow stages only public site files into `_site` before upload: `index.html`, `css/`, `js/`, `vendor/`, `licenses/`, and `assets/` when present.

## Save Folder to Zip

Users should zip the numbered save-account folder containing `PROFILEDATA` and one or more `SLOT#` folders.

Windows Steam:

```text
%APPDATA%\Warner Bros. Interactive Entertainment\LEGO Star Wars - The Skywalker Saga\SAVEDGAMES\STEAM\<your-number>\
```

Steam Deck / desktop Linux with Proton:

```text
~/.local/share/Steam/steamapps/compatdata/920210/pfx/drive_c/users/steamuser/AppData/Roaming/Warner Bros. Interactive Entertainment/LEGO Star Wars - The Skywalker Saga/SAVEDGAMES/STEAM/<your-number>/
```

Other Linux Steam installs may use `~/.steam/steam/steamapps/compatdata/920210/...`. For games installed on another Steam library, start from that library's `steamapps/compatdata/920210` folder.

## Candidate Order

The package intentionally starts narrow:

1. `01-location-only-safe-landing`: patches `GAMEFLOW.BLOB` and the current location tail in `GAMEPROGRESS.BLOB`.
2. `02-location-meta-safe-landing`: also updates visible save metadata strings.
3. `03-full-safe-state-reset`: also resets active party/free-play state.

All candidates keep progress-heavy files from the uploaded save where possible.

## Testing Saves

1. Back up the real `SAVEDGAMES` folder.
2. Disable Steam Cloud or other sync tools while testing.
3. Generate the package.
4. Copy one candidate's `PROFILEDATA` and `SLOT#` folders into the save-account folder.
5. Launch the game and test the slot.
6. If it fails, close the game and copy the next candidate over the same test save.

## License

This project is licensed under the MIT License. JSZip is included under its own license in `licenses/JSZip-LICENSE.markdown`.

## Limits

This targets PC-style save folders and zip archives containing `PROFILEDATA` and `SLOT#` folders/files.

Uploaded zips are capped at 50 MiB, 300 entries, 160 recognized save files, 32 MiB per recognized save file, and 120 MiB total recognized save data after decompression.

It is not expected to fix encrypted console saves, saves missing core progress files, or saves where collectibles or achievement files are damaged.
