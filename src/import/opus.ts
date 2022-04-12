import {Importer,ImpOpt} from "../import";
import * as def from '../def';
import * as tools from '../tools';
import * as cmake from '../cmake';
import * as files from '../u/files';
import * as path from 'path';
import {execNoError} from '../u/exec';
import * as fs from 'fs';

export function getImporter():Importer {
	return new LibImp("opus");
}
class LibImp extends Importer {
	getVersions():string[] {
		return ["1.3.1"];
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		await super.import(target, version, options, dst, purge);
		await this.downloadSource(`https://archive.mozilla.org/pub/opus/opus-${version}.tar.gz`, 'tar.gz');
		var cmake_dir = path.resolve(this.cache_src, 'opus-'+version);
		await this.dopeCmake(cmake_dir);
		{
			//add missing file
			var fixp = path.resolve(cmake_dir, 'opus_buildtype.cmake');
			if (!fs.existsSync(fixp))
				fs.writeFileSync(fixp, opus_bt_cmake);
		}
		await this.buildProcess(async (clear:boolean)=>{
			var args:string[] = [
				'-DOPUS_INSTALL_PKG_CONFIG_MODULE=OFF',
				'-DOPUS_INSTALL_CMAKE_CONFIG_MODULE=OFF'
			];

			if (process.platform == 'win32') {
				args.push(
					'-DPERL_FOUND=ON',
					//@ts-ignore
					'-DPERL_EXECUTABLE='+tools.getAppFullpath('perl')
				);
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
			path.resolve(cmake_dir, 'include'),
			this.dst_inc,
			{ file_filter:header_filter, sub_folder_count:2, sub_folder_src:true }
		);
		await files.copy_recursive(
			this.cache_bld, this.dst_inc,
			{ file_filter:header_filter, sub_folder_count:5, sub_folder_src:true }
		);
		// static
		await files.copy_recursive(
			this.cache_bld, this.dst_static,
			{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.a','*.lib']), symlinks_raster:true }
		);
		this.genCMakeInclude("OPUS");
	}
}

var opus_bt_cmake = `# Set a default build type if none was specified
if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  if(CMAKE_C_FLAGS)
    message(STATUS "CMAKE_C_FLAGS: " \${CMAKE_C_FLAGS})
  else()
    set(default_build_type "Release")
    message(
      STATUS
        "Setting build type to '\${default_build_type}' as none was specified and no CFLAGS was exported."
      )
    set(CMAKE_BUILD_TYPE "\${default_build_type}"
        CACHE STRING "Choose the type of build."
        FORCE)
    # Set the possible values of build type for cmake-gui
    set_property(CACHE CMAKE_BUILD_TYPE
                 PROPERTY STRINGS
                          "Debug"
                          "Release"
                          "MinSizeRel"
                          "RelWithDebInfo")
  endif()
endif()`;