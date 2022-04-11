## Imports:
Status:
- 🔨 some limitations
- ✅ ok
- ❌ fail
- ⚙️ fail, but rest some tries
- ☢ not designed for this platform

| | ![Windows](./md/win.png) | ![Linux](./md/lnx.png) | ![MacOS](./md/mac.png) | ![Android](./md/and.png) | ![IOS](./md/ios.png) | ![WEB](./md/asm.png) | ![UWP/XBOX](./md/xbx.png) | ![Arduino](./md/ard.png) | obs. |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Codecs**     | -- | -- | -- | -- | -- | -- | -- | -- | |
| libpng         | ✅ | ✅ |    |    |    |    | ✅ |    | |
| libjpeg-turbo  | 🔨 | ✅ |    |    |    |    | 🔨 |    | win/uwp: no turbo/SIMD, static only |
| giflib         | ✅ | ✅ |    |    |    |    | ⚙️ |    | uwp: win only file api |
| libwebp        | ✅ | ✅ |    |    |    |    | ✅ |    | |
| aom            | ✅ | ✅ |    |    |    |    | ⚙️ |    | uwp: aom\av1\encoder\interp_search.c(472): error C4703: possible uninitied variable 'switchable_interp_p0' |
| libavif        | ✅ | ✅ |    |    |    |    |    |    | |
| opus           | ✅ | ✅ |    |    |    |    | ✅ |    | |
| flac           | ✅ | ✅ |    |    |    |    | ⚙️ |    | uwp: need a workaround: some function renames. |
| **Vision**     | -- | -- | -- | -- | -- | -- | -- | -- | |
| opencv         | ✅ | ✅ |    |    |    |    | ⚙️ |    | uwp: broken cmake file |
| leptonica      | ✅ | ✅ |    |    |    |    | ⚙️ |    | uwp: win only file api |
| tesseract      | ✅ | ✅ |    |    |    |    |    |    | |
| **Basic**      | -- | -- | -- | -- | -- | -- | -- | -- | |
| zlib           | ✅ | ✅ |    |    |    |    | ✅ |    | |
| brotli         | ✅ | ✅ |    |    |    |    | ✅ |    | |
| sqlite         | ✅ | ✅ |    |    |    |    | ☢ |    | uwp: win only api |
| libreSSL       | ✅ | ✅ | 🔨 |    |    |    | ✅ |    | |

## Compilation tips:
### windows:
- while windows runtime library recomendend is static (MT), in **uwp supports MD only** (dynamicly linked runtime).
- if compiler say "cant found LIBCMT.lib", its a spectree mitigation library, and to use the visual studio needs library with spectre mitigation components installed.

## Not implemented:
- spectre mitigation option injection in vcprojects (proc/windows_runtime_spectre.ts).