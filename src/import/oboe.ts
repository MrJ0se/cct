
import {Importer,ImpOpt} from "../import";
import * as def from '../def';
import * as cmake from '../cmake';
import * as files from '../u/files';
import * as path from 'path';

export function getImporter():Importer {
	return new LibImp("oboe");
}
class LibImp extends Importer {
	getVersions():string[] {
		return ["1.6.1"];
	}
	getOptions():Map<string,ImpOpt> {
		return new Map<string,ImpOpt>();
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		await super.import(target, version, options, dst, purge);
		if (target.target.platform != def.Platform.AND)
			throw "oboe is android exclusive API";

		await this.downloadSource(`https://codeload.github.com/google/oboe/tar.gz/refs/tags/${version}`, "tar.gz");
		var cmake_dir = path.resolve(this.cache_src, `oboe-${version}`);
		await this.dopeCmake(path.resolve(cmake_dir, 'CMakeLists.txt'), async(txt:string):Promise<string>=>{
			return txt.replace('-std=c++17','-std=c++17 -mno-outline-atomics');
		}, {requestC17:true});
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
		await files.copy_recursive(path.resolve(cmake_dir,'include'), this.dst_inc);
		// static
		await files.copy_recursive(
			this.cache_bld, this.dst_static,
			{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.a']), symlinks_raster:true }
		);
		this.genCMakeInclude("OBOE");
	}
}