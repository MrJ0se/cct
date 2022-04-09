import {Importer,ImpOpt} from "../import";
import * as def from '../def';
import * as tools from '../tools';
import * as cmake from '../cmake';
import * as files from '../u/files';
import * as pic_inj from '../proc/cmake_inject_pic_standard';
import * as path from 'path';

export function getImporter():Importer {
	return new LibImp("brotli", {request_symlink:{build:true}});
}
class LibImp extends Importer {
	getVersions():string[] {
		return ["1.0.9"];
	}
	getOptions():Map<string,ImpOpt> {
		var k = new Map<string,ImpOpt>();
		return k;
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		await super.import(target, version, options, dst, purge);
		await this.downloadSource('https://codeload.github.com/google/brotli/tar.gz/refs/tags/v'+version, "tar.gz");
		var cmake_dir = path.resolve(this.cache_src, 'brotli-'+version);
		await this.dopeFile(path.resolve(cmake_dir, 'CMakeLists.txt'), async (text)=>{
			return pic_inj.apply(text);
		});
		await this.buildProcess(async (clear:boolean)=>{
			var args:string[] = ['-DBROTLI_DISABLE_TESTS=on','-DENABLE_COVERAGE=no'];
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
			path.resolve(cmake_dir, 'c/include/brotli'),
			path.resolve(this.dst_inc, 'brotli'),
			{ file_filter:header_filter, sub_folder_count:1 }
		);
		// static
		await files.copy_recursive(
			this.cache_bld, this.dst_static,
			{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.a','*static*.lib']), symlinks_raster:true }
		);
		// dynamic
		await files.copy_recursive(
			this.cache_bld, this.dst_dynamic,
			{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.so','*.lib','*.dll','*.dylib']) && !files.filterName(x, ['*static*.lib']) }
		);
		this.genCMakeInclude("BROTLI");
	}
}