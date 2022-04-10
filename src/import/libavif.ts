import {Importer,ImpOpt} from "../import";
import * as def from '../def';
import * as tools from '../tools';
import * as cmake from '../cmake';
import * as files from '../u/files';
import * as pic_inj from '../proc/cmake_inject_pic_standard';
import * as path from 'path';

export function getImporter():Importer {
	return new LibImp("libavif");
}
class LibImp extends Importer {
	getVersions():string[] {
		return ["0.9.2"];
	}
	getOptions():Map<string,ImpOpt> {
		var k = new Map<string,ImpOpt>();
		k.set('dynamic', {value:'true', values:['true','false'], desc:'Build dynamic instead static library'});
		return k;
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		await super.import(target, version, options, dst, purge);
		await this.downloadSource(`https://github.com/AOMediaCodec/libavif/archive/refs/tags/v${version}.tar.gz`, "tar.gz");
		var cmake_dir = path.resolve(this.cache_src, 'libavif-'+version);
		await this.dopeFile(path.resolve(cmake_dir, 'CMakeLists.txt'), async (text)=>{
			return pic_inj.apply(text);
		});
		//@ts-ignore
		var dyn = (options.get('dynamic').value == 'true');
		await this.buildProcess(async (clear:boolean)=>{

			var aom = this.getLibraryJSON(await this.requestLibraryDir(target, dst, 'aom', undefined, true));
			var aom_lib = aom.getLibraries(dyn);
			var yuv_lib = aom_lib.filter((x)=>x.toLowerCase().indexOf('yuv')>=0);
			aom_lib     = aom_lib.filter((x)=>x.toLowerCase().indexOf('yuv')<0);

			var args:string[] = [
				'-DAVIF_CODEC_AOM=ON',
				'-DAVIF_CODEC_AOM_ENCODE=ON',
				'-DAVIF_CODEC_AOM_DECODE=ON',
				'-DAOM_FOUND=ON',
				'-DAOM_INCLUDE_DIR='+aom.inc,
				'-DAOM_LIBRARY='+aom_lib.join(';'),
				'-DBUILD_SHARED_LIBS='+(dyn?'ON':'OFF')
			];
			if (yuv_lib.length > 0)
				args.push(
					'-Dlibyuv_FOUND=ON',
					'-DLIBYUV_VERSION=1768',
					'-DLIBYUV_INCLUDE_DIR='+aom.inc,
					'-DLIBYUV_LIBRARY='+yuv_lib.join(';')
				);
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
			path.resolve(this.dst_inc),
			{ file_filter:header_filter }
		);
		// static
		await files.copy_recursive(
			this.cache_bld, this.dst_static,
			{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.a','*.lib']), symlinks_raster:true }
		);

		if (dyn)
			// dynamic
			await files.copy_recursive(
				this.cache_bld, this.dst_dynamic,
				{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.so','*.lib','*.dll','*.dylib']), symlinks_raster:true }
			);
		else
			// static
			await files.copy_recursive(
				this.cache_bld, this.dst_static,
				{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.a','*.lib']), symlinks_raster:true }
			);
		this.genCMakeInclude("LIBAVIF");
	}
}