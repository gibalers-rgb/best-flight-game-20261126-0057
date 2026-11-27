# Kurir Langit — Kepulauan Angin

[![Make the best flight game](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/competitions/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/gibalers-rgb/best-flight-game-20261126-0057/rank.svg)](https://make.fun/competitions/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/gibalers-rgb/best-flight-game-20261126-0057/reward.svg)](https://make.fun/competitions/best-flight-game-20261126-0057)

Terbang sebagai kurir langit di atas kepulauan tropis dengan pesawat amfibi
**Kestrel**. Tiga kontrak menantimu: menembus cincin emas di atas laguna,
mengantar paket ke tiga desa pulau, lalu mendarat pulang dengan mulus di
landasan Pulau Besar.

## Cara bermain

| Tombol | Aksi |
| ------ | ---- |
| W / S | Gas naik / turun |
| ← / → atau A / D | Belok (roll) |
| ↑ / ↓ | Naik / turun (pitch) |
| Spasi | Lepas paket (Kontrak 2) |
| M | Kendali mouse aktif/mati |
| P | Jeda |
| R | Ulang kontrak aktif |

Mendaratlah di bawah 34 m/s dengan sayap datar dan turunan lembut — menukik
terlalu keras, miring, atau terlalu cepat berarti kecelakaan dan kamu kembali
ke titik aman.

## Menjalankan game

Game ini file statis tanpa build step — cukup sajikan folder `game/` dengan
server HTTP apa pun:

```sh
node serve.ts        # lalu buka http://localhost:8123/
```

atau:

```sh
npx serve game
```

Buka `game/index.html` di desktop Chrome dan mainkan dengan keyboard dan mouse.
Semua bunyi disintesis WebAudio di dalam game; tidak ada aset jaringan.

## Struktur

- `game/index.html` — halaman game
- `game/style.css` — tampilan kartu, toast, dan debrief
- `game/src/boot.js` — loop utama, state machine, mode demo
- `game/src/projection.js` — kamera kejar dan proyeksi perspektif
- `game/src/archipelago.js` — pulau, laut, langit, awan, landasan
- `game/src/kestrel.js` — pesawat amfibi dan model terbang
- `game/src/contracts.js` — tiga kontrak kurir dan penilaian
- `game/src/gauges.js` — HUD, kompas, horizon buatan, panel instrumen
- `game/src/sounds.js` — bunyi mesin, angin, dan peristiwa (WebAudio)
- `game/src/controls.js` — keyboard dan mouse
- `main.ts` — menyerahkan game ke make.fun (menyalin `game/` + `screenshots/`, menulis `dossier.json`)
- `serve.ts` — server statis lokal untuk mencoba game
- `screenshots/` — tangkapan layar asli dari game ini

## Lisensi

MIT — lihat [LICENSE](LICENSE).
