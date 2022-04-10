import {Importer,ImpOpt,ReorderOp} from "../import";
import * as def from '../def';
import * as tools from '../tools';
import * as cmake from '../cmake';
import * as files from '../u/files';
import * as exec from '../u/exec';
import * as pic_inj from '../proc/cmake_inject_pic_standard';
import * as path from 'path';

export function getImporter():Importer {
	return new LibImp("libreSSL");
}
class LibImp extends Importer {
	getVersions():string[] {
		return ["3.3.3"];
	}
	getOptions():Map<string,ImpOpt> {
		var k = new Map<string,ImpOpt>();
		k.set("asm", {value:"true", values:["true", "false"], desc:"Build with asm optimization"})
		return k;
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		await super.import(target, version, options, dst, purge);
		await this.downloadSource('https://codeload.github.com/libressl-portable/portable/tar.gz/refs/tags/v'+version, "tar.gz");
		var cmake_dir = path.resolve(this.cache_src, 'portable-'+version);
		await this.dopeFile(path.resolve(cmake_dir, 'CMakeLists.txt'), async (text)=>{
			return pic_inj.apply(text.replace('add_definitions(-Drestrict)',''));
		});
		await this.dopeState(path.resolve(cmake_dir, 'sh'), async ()=>{
			console.log('running autogen.sh');
			if ((await exec.execPipedVerbose([tools.getAppFullpath(['sh','bash']), 'autogen.sh'], cmake_dir)) != 0) {
				if (process.platform=='win32')
					console.log('autogen.sh must be runned in a no-windows enviroment before (first import of library, requires: autoconf and libtool-bin)');
				throw "failed to execute autogen.sh ()";
			}
		});
		await this.dopeFile(path.resolve(cmake_dir, 'crypto/compat/arc4random.c'), async (text)=>
`#if defined(__EMSCRIPTEN__)
#include <sys/random.h>
#endif
`+text
		);
		await this.dopeFile(path.resolve(cmake_dir, 'include/openssl/opensslconf.h'), macfix);
		await this.dopeFile(path.resolve(cmake_dir, 'crypto/compat/recallocarray.c'), macfix);
		await this.dopeFile(path.resolve(cmake_dir, 'crypto/compat/freezero.c'), macfix);

		await this.buildProcess(async (clear:boolean)=>{
			var args = [
				'-DLIBRESSL_SKIP_INSTALL=ON',
				'-DLIBRESSL_APPS=OFF',
				'-DLIBRESSL_TESTS=OFF',
				'-DENABLE_EXTRATESTS=OFF',
				'-DENABLE_NC=OFF',
				'-DUSE_STATIC_MSVC_RUNTIMES=OFF'
			];
			//@ts-ignore
			if (options.get('asm').value!='true'||[def.Platform.MAC, def.Platform.IOS, def.Platform.IOS_EMU, def.Platform.WEB].find((x)=>x==target.target.platform)!=null)
				args.push('-DENABLE_ASM=OFF');
			if (target.target.platform == def.Platform.WEB)
				args.push('-DCMAKE_C_FLAGS="-D__linux__"');
			await cmake.cmake(
				target,
				cmake_dir,
				this.cache_bld,
				args,
				{
					clear,
					config:true,
					build:true,
				});
		});
		////////////
		//copy out//
		////////////
		console.log('coping out..')
		// include
		var header_filter = (x:string)=>files.filterName(x, ['*.h', '*.hpp']);
		await files.copy_recursive(
			path.resolve(cmake_dir, 'include'), this.dst_inc,
			{ file_filter:header_filter, sub_folder_count:1 }
		);
		// static
		await files.copy_recursive(
			this.cache_bld, this.dst_static,
			{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.a','*.lib']), symlinks_raster:true }
		);
		this.genCMakeInclude(
			"LIBRESSL",
			[
				{op:ReorderOp.ADD_TO_NEW, filter:'*cryp*'},
				{op:ReorderOp.ADD_TO_NEW, filter:'*ssl*'},
				{op:ReorderOp.ADD_TO_NEW, filter:'*tls*'},
				{op:ReorderOp.ADD_TO_NEW, filter:'*'},
			]
		);
	}
}
async function macfix(text:string):Promise<string> {
	return `#if defined(__APPLE__) && !defined(FIX_BZERO)
#define FIX_BZERO 1
#include <stddef.h>
#define SYSLOG_DATA_INIT {0}
struct syslog_data {int x;};
void vsyslog_r(int x, ...) {}
inline void explicit_bzero (void* ptr, size_t len) {
  char* p = (char*)ptr;
  for (int i = 0; i < len; i++)
    p[i] = 0;
}
#endif
`+text;
}