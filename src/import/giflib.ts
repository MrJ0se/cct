import {Importer,ImpOpt} from "../import";
import * as def from '../def';
import * as tools from '../tools';
import * as cmake from '../cmake';
import * as files from '../u/files';
import * as path from 'path';
import * as fs from 'fs';

export function getImporter():Importer {
	return new LibImp("giflib");
}
class LibImp extends Importer {
	getVersions():string[] {
		return ["5.2.1"];
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		await super.import(target, version, options, dst, purge);
		await this.downloadSource(`https://megalink.dl.sourceforge.net/project/giflib/giflib-${version}.tar.gz`, "tar.gz");
		var cmake_dir = path.resolve(this.cache_src, 'giflib-'+version);
		var cmake_file = path.resolve(cmake_dir, 'CMakeLists.txt');
		if (!fs.existsSync(cmake_file))
			fs.writeFileSync(cmake_file, GIFLIB_CMAKE);
		await this.dopeFile(path.resolve(cmake_dir, 'gif_hash.h'),
			async (text)=>text.replace('#include <unistd.h>',
`#if defined(WIN32) || defined(_WIN32) || defined(__WIN32__) || defined(__NT__)
#include <Windows.h>
#else
#include <unistd.h>
#endif`
			));

		await this.buildProcess(async (clear:boolean)=>{
			await cmake.cmake(
				target,
				cmake_dir,
				this.cache_bld,
				[],
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
			cmake_dir, this.dst_inc,
			{ file_filter:header_filter, sub_folder_count:1 }
		);
		// static
		await files.copy_recursive(
			this.cache_bld, this.dst_static,
			{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.a','*.lib']), symlinks_raster:true }
		);
		this.genCMakeInclude("GIFLIB");
	}
}


const GIFLIB_CMAKE =
`cmake_minimum_required(VERSION 3.10)
project(giflib)
set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
set (LIB_DIR "\${CMAKE_CURRENT_LIST_DIR}")
add_library(giflib STATIC
	"\${LIB_DIR}/dgif_lib.c"
	"\${LIB_DIR}/egif_lib.c"
	"\${LIB_DIR}/gif_err.c"
	"\${LIB_DIR}/gif_font.c"
	"\${LIB_DIR}/gif_hash.c"
	"\${LIB_DIR}/gif_hash.h"
	"\${LIB_DIR}/gif_lib.h"
	"\${LIB_DIR}/gif_lib_private.h"
	"\${LIB_DIR}/gifalloc.c"
	"\${LIB_DIR}/openbsd-reallocarray.c"
	"\${LIB_DIR}/quantize.c"
)
target_include_directories(giflib PRIVATE "\${LIB_DIR}")`;