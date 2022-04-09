import {Importer,ImpOpt} from "../import";
import * as def from '../def';
import * as tools from '../tools';
import * as cmake from '../cmake';
import * as files from '../u/files';
import * as pic_inj from '../proc/cmake_inject_pic_standard';
import * as path from 'path';

export function getImporter():Importer {
	return new LibImp("flac");
}
class LibImp extends Importer {
	getVersions():string[] {
		return ["1.3.2-20191201"];
	}
	getOptions():Map<string,ImpOpt> {
		var k = new Map<string,ImpOpt>();
		//k.set("asm", {value:"true", values:["true", "false"], desc:"Build with x32 | x64 asm optimization"})
		return k;
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		await super.import(target, version, options, dst, purge);
		await this.downloadSource('https://codeload.github.com/janbar/flac-cmake/tar.gz/refs/tags/'+version, "tar.gz");
		var cmake_dir = path.resolve(this.cache_src, 'flac-cmake-'+version);
		await this.dopeFile(path.resolve(cmake_dir, 'CMakeLists.txt'), async (text)=>{
			return pic_inj.apply(text);
		});
		await this.dopeFile(path.resolve(cmake_dir, 'src/libFLAC/cpu.c'), async (text)=>{
			return cpu_wasm_fix.replace('%CONTENT%', text);
		});
		await this.buildProcess(async (clear:boolean)=>{
			var args:string[] = [];
			if (target.target.platform == def.Platform.WEB)
				args.push('-DCPU_IS_BIG_ENDIAN=0','-DHAVE_CPU_IS_BIG_ENDIAN=1');
			if (target.target.platform == def.Platform.UWP) {
				var arch = 'unk';
				switch (target.target.arch) {
				case def.Arch.X32: arch = 'x86'; break;
				case def.Arch.X64: arch = 'x86_64'; break;
				}
				args.push('-DCMAKE_SYSTEM_PROCESSOR='+arch);
			}
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
			path.resolve(cmake_dir, 'include/FLAC'),
			path.resolve(this.dst_inc, 'FLAC'),
			{  sub_folder_src:true, file_filter:header_filter }
		);
		await files.copy_recursive(
			path.resolve(cmake_dir, 'include/FLAC++'),
			path.resolve(this.dst_inc, 'FLAC++'),
			{  sub_folder_src:true, file_filter:header_filter }
		);
		// static
		await files.copy_recursive(
			this.cache_bld, this.dst_static,
			{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.a','*.lib']), symlinks_raster:true }
		);
		this.genCMakeInclude("FLAC");
	}
}

var cpu_wasm_fix = `#ifdef __EMSCRIPTEN__
#include "private/cpu.h"
#include "share/compat.h"
#include <stdlib.h>
#include <memory.h>
#if defined FLAC__CPU_IA32 || defined FLAC__CPU_X86_64
static uint32_t
cpu_xgetbv_x86(void)
{
	return 0;
}
#endif
static void
ia32_cpu_info (FLAC__CPUInfo *info)
{
	info->use_asm = false;
}
static void
x86_64_cpu_info (FLAC__CPUInfo *info)
{
	info->use_asm = false;
}
void FLAC__cpu_info (FLAC__CPUInfo *info)
{
	memset(info, 0, sizeof(*info));
}
void FLAC__cpu_info_x86(FLAC__uint32 level, FLAC__uint32 *eax, FLAC__uint32 *ebx, FLAC__uint32 *ecx, FLAC__uint32 *edx)
{
	*eax = *ebx = *ecx = *edx = 0;
}
#else
%CONTENT%
#endif`;