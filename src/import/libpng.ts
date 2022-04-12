import {Importer,ImpOpt} from "../import";
import * as def from '../def';
import * as cmake from '../cmake';
import * as files from '../u/files';
import * as remove_install from '../proc/cmake_remove_install';
import * as pic_inj from '../proc/cmake_pic_standard';
import * as path from 'path';

export function getImporter():Importer {
	return new LibImp("libpng", {request_symlink:{build:true}});
}
class LibImp extends Importer {
	getVersions():string[] {
		return ["1.6.37"];
	}
	getOptions():Map<string,ImpOpt> {
		var k = new Map<string,ImpOpt>();
		k.set("static", {value:"true", values:["true", "false"], desc:"Build static library"});
		k.set("dynamic", {value:"true", values:["true", "false"], desc:"Build dynamic library"});
		return k;
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		await super.import(target, version, options, dst, purge);
		await this.downloadSource(`https://codeload.github.com/glennrp/libpng/tar.gz/refs/tags/v${version}`, "tar.gz");
		var cmake_dir = path.resolve(this.cache_src, `libpng-${version}`);
		await this.dopeFile(path.resolve(cmake_dir, 'CMakeLists.txt'), async (text)=>{
			return remove_install.apply(pic_inj.apply(text
				//remove math library from linker (avoid gnu std)
				.replace('find_library(M_LIBRARY m)',
` find_library(M_LIBRARY m)
  if(NOT M_LIBRARY)
    set(M_LIBRARY "")
  endif()`)
				//force to use precompiled configure header, awk = bug
				.replace('find_program(AWK NAMES gawk awk)','#removed find awk by cct2')
				//compatible with multiple zlib... one specific for static lib
				.replace('target_link_libraries(png_static ${ZLIB_LIBRARY}','target_link_libraries(png_static ${ZLIB_LIBRARY_STATIC}')
			));
		});
		await this.buildProcess(async (clear:boolean)=>{
			var zlib = this.getLibraryJSON(await this.requestLibraryDir(target, dst, 'zlib', undefined, true));
			var args:string[] = [
				'-DHAVE_LD_VERSION_SCRIPT=OFF',
				//@ts-ignore
				'-DPNG_SHARED='+((options.get('dynamic').value == 'true')?'ON':'OFF'),
				//@ts-ignore
				'-DPNG_STATIC='+((options.get('static').value == 'true')?'ON':'OFF'),
				'-DPNG_TESTS=OFF',
				'-DZLIB_INCLUDE_DIR='+zlib.inc,
				'-DZLIB_LIBRARY='+zlib.getLibraries(true).join(';'),
				'-DZLIB_LIBRARY_STATIC='+zlib.getLibraries(false).join(';'),
			];
			if ([
				def.Platform.WEB,
				def.Platform.MAC,
				def.Platform.IOS,
				def.Platform.IOS_EMU
			].find((x)=>x==target.target.platform) != null)
				args.push('-DPNG_HARDWARE_OPTIMIZATIONS=OFF');
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
			cmake_dir, this.dst_inc,
			{ file_filter:header_filter, sub_folder_count:1 }
		);
		await files.copy_recursive(
			this.cache_bld, this.dst_inc,
			{ file_filter:header_filter, sub_folder_count:1 }
		)
		// static
		await files.copy_recursive(
			this.cache_bld, this.dst_static,
			{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*png*.a','*static*.lib']), symlinks_raster:true }
		);
		// dynamic
		await files.copy_recursive(
			this.cache_bld, this.dst_dynamic,
			{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.so','*.lib','*.dll','*.dylib']) && !files.filterName(x, ['*static*.lib']), symlinks_raster:true, ignore_clone_libs:true }
		);
		this.genCMakeInclude("LIBPNG");
	}
}