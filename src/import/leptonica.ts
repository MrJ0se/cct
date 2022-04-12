import {Importer,ImpOpt} from "../import";
import * as def from '../def';
import * as tools from '../tools';
import * as cmake from '../cmake';
import * as files from '../u/files';
import * as pic_inj from '../proc/cmake_pic_standard';
import * as path from 'path';
import * as fs from 'fs';

export function getImporter():Importer {
	return new LibImp("leptonica");
}
class LibImp extends Importer {
	getVersions():string[] {
		return ["1.82.0"];
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		await super.import(target, version, options, dst, purge);
		await this.downloadSource(`https://github.com/DanBloomberg/leptonica/archive/refs/tags/${version}.tar.gz`, "tar.gz");
		var cmake_dir = path.resolve(this.cache_src, `leptonica-${version}`);
		await this.dopeFile(path.resolve(cmake_dir, 'CMakeLists.txt'), async (text)=>{
			var cutindex = text.indexOf('install(FILES');
			if (cutindex > 0) text = text.substr(0,cutindex);
			text = text.replace('sw" ON','sw" OFF').replace('if(NOT SW_BUILD)','if(ON)\nelseif(OFF)');
			return pic_inj.apply(text);
		});
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
			{ sub_folder_src:true, file_filter:header_filter, sub_folder_count:3 }
		);
		await files.copy_recursive(
			this.cache_bld, this.dst_inc,
			{ sub_folder_src:true, file_filter:header_filter, sub_folder_count:3 }
		)
		// static
		await files.copy_recursive(
			this.cache_bld, this.dst_static,
			{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.a','*.lib']), symlinks_raster:true }
		);
		this.genCMakeInclude("LEPTONICA");
	}
}

