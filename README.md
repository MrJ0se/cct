# Imports:
Status:
- 🔨 ok, with optimizations disabled
- ✅ ok
- ❌ fail
- ☢ untested
- ⚙️ fail, but rest some tries
- 🛇 not designed for this platform

| | ![Windows](./md/win.png) | ![Linux](./md/lnx.png) | ![MacOS](./md/mac.png) | ![Android](./md/and.png) | ![IOS](./md/ios.png) | ![WEB](./md/asm.png) | ![UWP/XBOX](./md/xbx.png) | ![Arduino](./md/ard.png) | obs. |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Codecs**     | ✅ | ✅ |    |    |    |    |    |    | |
| libpng         | ✅ | ✅ |    |    |    |    |    |    | |
| libjpeg-turbo  | 🔨 | ✅ |    |    |    |    |    |    | win: just static |
| giflib         | ✅ | ✅ |    |    |    |    |    |    | win: \gif_hash.h(12,1) cant found include 'unistd.h'|
| libwebp        | ✅ | ✅ |    |    |    |    |    |    | |
| aom            | ✅ | ✅ |    |    |    |    |    |    | |
| libavif        | ✅ | ✅ |    |    |    |    |    |    | |
| opus           | ✅ | ✅ |    |    |    |    |    |    | |
| flac           | ✅ | ✅ |    |    |    |    |    |    | |
| **Vision**     | ✅ | ✅ |    |    |    |    |    |    | |
| opencv         | ✅ | ✅ |    |    |    |    |    |    | |
| leptonica      | ✅ | ✅ |    |    |    |    |    |    | |
| tesseract      | ✅ | ✅ |    |    |    |    |    |    | |
| **Basic**      | ✅ | ✅ |    |    |    |    |    |    | |
| zlib           | ✅ | ✅ |    |    |    |    |    |    | |
| brotli         | ✅ | ✅ |    |    |    |    |    |    | |
| sqlite         | ✅ | ✅ |    |    |    |    |    |    | |
| libreSSL       | ✅ | ✅ | 🔨 |    |    |    |    |    | |

