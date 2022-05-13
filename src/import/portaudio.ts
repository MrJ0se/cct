import {Importer,ImpOpt} from "../import";
import * as def from '../def';
import * as cmake from '../cmake';
import * as files from '../u/files';
import * as path from 'path';

export function getImporter():Importer {
	return new LibImp("portaudio", {request_symlink:{build:true}});
}
class LibImp extends Importer {
	getVersions():string[] {
		return ["04.06.2021"];
	}
	getOptions():Map<string,ImpOpt> {
		return new Map<string,ImpOpt>();
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		await super.import(target, version, options, dst, purge);
		await this.downloadSource(
			//@ts-ignore
			{
				"04.06.2021":"http://files.portaudio.com/archives/pa_stable_v190700_20210406.tgz",
			}[version], "tar.gz");
		var cmake_dir = path.resolve(this.cache_src, 'portaudio');
		await this.dopeCmake(path.resolve(cmake_dir, 'CMakeLists.txt'), async (txt:string, pf:string):Promise<string>=>{
			return txt.replace(
`SET(PA_PKGCONFIG_LDFLAGS "\${PA_PKGCONFIG_LDFLAGS} -lm")
  SET(PA_LIBRARY_DEPENDENCIES \${PA_LIBRARY_DEPENDENCIES} m)`,
`if (ANDROID_ABI)
    SET(PA_PKGCONFIG_LDFLAGS "\${PA_PKGCONFIG_LDFLAGS} -lm")
    SET(PA_LIBRARY_DEPENDENCIES \${PA_LIBRARY_DEPENDENCIES} m)
  else()
    SET(PA_PKGCONFIG_LDFLAGS "\${PA_PKGCONFIG_LDFLAGS} -lm -lpthread")
    SET(PA_LIBRARY_DEPENDENCIES \${PA_LIBRARY_DEPENDENCIES} m pthread)
  endif()`
  			);
		});
		if (target.target.platform == def.Platform.LNX)
			console.error("In linux libasound-dev must be installed!!");
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
			{ sub_folder_src:true, file_filter:header_filter, sub_folder_count:2 }
		);
		// static
		await files.copy_recursive(
			this.cache_bld, this.dst_static,
			{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.a','*static*.lib']), symlinks_raster:true }
		);
		// dynamic
		await files.copy_recursive(
			this.cache_bld, this.dst_dynamic,
			{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.so','*.lib','*.dll','*.dylib']) && !files.filterName(x, ['*static*.lib']), symlinks_raster:true, ignore_clone_libs:true }
		);
		this.genCMakeInclude("PORTAUDIO");
	}
}