import {Importer,ImpOpt} from "../import";
import * as def from '../def';
import * as cmake from '../cmake';
import * as files from '../u/files';
import * as pic_inj from '../proc/cmake_pic_standard';
import * as path from 'path';

export function getImporter():Importer {
	return new LibImp("libwebp");
}
class LibImp extends Importer {
	getVersions():string[] {
		return ["1.2.0"];
	}
	getOptions():Map<string,ImpOpt> {
		var k = new Map<string,ImpOpt>();
		return k;
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		await super.import(target, version, options, dst, purge);
		await this.downloadSource(`https://codeload.github.com/webmproject/libwebp/tar.gz/refs/tags/v${version}`, "tar.gz");
		var cmake_dir = path.resolve(this.cache_src, `libwebp-${version}`);
		await this.dopeFile(path.resolve(cmake_dir, 'CMakeLists.txt'), async (text)=>{
			return pic_inj.apply(text.replace('if(WEBP_BUILD_GIF2WEBP OR WEBP_BUILD_IMG2WEBP)', 'if(ON)'));
		});
		await this.buildProcess(async (clear:boolean)=>{
			var args:string[] = [
				'-DWEBP_BUILD_CWEBP=OFF',
				'-DWEBP_BUILD_DWEBP=OFF',
				'-DWEBP_BUILD_IMG2WEBP=OFF',
				'-DWEBP_BUILD_GIF2WEBP=OFF',
				'-DWEBP_BUILD_VWEBP=OFF',
				'-DWEBP_BUILD_WEBPINFO=OFF',
				'-DWEBP_BUILD_WEBPMUX=OFF',
				'-DWEBP_BUILD_EXTRAS=OFF',
			
			];
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
			{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.a','*.lib']), symlinks_raster:true }
		);
		this.genCMakeInclude("LIBWEBP");
	}
}