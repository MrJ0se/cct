## Imports:
Status:
- 🔨 some limitations
- ✅ ok
- ❌ fail
- ⚙️ fail, but rest some tries
- ☢ incompatible

| | ![Windows](./md/win.png) | ![Linux](./md/lnx.png) | ![MacOS](./md/mac.png) | ![Android](./md/and.png) | ![IOS](./md/ios.png) | ![WEB](./md/asm.png) | ![UWP/XBOX](./md/xbx.png) | obs. |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Codecs**     | -- | -- | -- | -- | -- | -- | -- | |
| libpng         | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| libjpeg-turbo  | 🔨 | ✅ | ✅ | ✅ | ✅ | 🔨 | 🔨 | win/web/uwp: no turbo/SIMD, static only |
| giflib         | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚙️ | uwp: win only file api |
| libwebp        | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| aom            | ✅ | ✅ | 🔨 | ⚙️ | ⚙️ | ✅ | ⚙️ | mac: static only. android: multiple wrong named neon SIMD functions. uwp: aom\av1\encoder\interp_search.c(472): error C4703: possible uninitied variable 'switchable_interp_p0' |
| libavif        | ✅ | ✅ | 🔨 |    |    | ✅ |    | mac: static only |
| opus           | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| flac           | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚙️ | uwp: need a workaround: some function renames. |
| **Vision**     | -- | -- | -- | -- | -- | -- | -- | |
| opencv         | ✅ | ✅ | ✅ | ✅ |    | ✅ | ⚙️ | uwp: broken cmake file |
| leptonica      | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚙️ | uwp: win only file api |
| tesseract      | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |    | |
| **Basic**      | -- | -- | -- | -- | -- | -- | -- | |
| zlib           | ✅ | ✅ | ✅ | ✅ | ✅ | 🔨 | ✅ | |
| brotli         | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| sqlite         | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | uwp: win only api |
| libreSSL       | ✅ | ✅ | ✅ | ✅ | ✅ | 🔨 | ✅ | |

- \*obs.: disable any optimization, and static build for web compilations

## Compilation tips:
### windows:
- while windows runtime library recomendend is static (MT), in **uwp supports MD only** (dynamicly linked runtime).
- if compiler say "cant found LIBCMT.lib", its a spectree mitigation library, and to use the visual studio needs library with spectre mitigation components installed.

### IOS:
- needs a team id specified, to get it, do a login in xcode, export the certified of team, get the number of Organization Unity / Unidade Empresarial of certify, and set on CCT.

### Arduino:
- setup arduino target with: "cct as \[path to arduino IDE\] \[board\]".
- generate CMake lines to enable cmake-based autocomplete (to insert in your CMakeLists): "cct acc".
- send program to arduino with: "cct aw \[path to pogram\] \[port\]".

## To do (not implemented yet):
- [ ] spectre mitigation option injection in vcprojects (proc/windows_runtime_spectre.ts).
- [ ] replace hardcoded Apple SDK version in cmake.ts (use "xcrun --show-sdk-version" to get).
- [ ] edit opencv script to use cct zlib instead clone zlib.

## Required Tools:

| platform | target(s) | required | recomended |
| -------- | --------- | -------- | ---------- |
| windows  | uwp/win32 | visual studio (components: msvc++, uwp, cmake, python, strawberry perl | yasm, git (bash) |
| linux    | linux     | gcc,g++,binutils,python,perl,cmake | clang, yasm |
| mac      | mac/ios   | xcode, xcode command line tools, brew, cmake(brew) | yasm |
|          | android   | android studio (components: ndk), perl, python, cmake | yasm |
|          | web       | android studio (components: ndk) | perl, python, cmake | |
|          | arduino   | arduino IDE (components: AVR boards) | CH34X driver (to send program) | |