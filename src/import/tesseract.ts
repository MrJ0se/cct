import {Importer,ImpOpt} from "../import";
import * as def from '../def';
import * as tools from '../tools';
import * as cmake from '../cmake';
import * as files from '../u/files';
import * as pic_inj from '../proc/cmake_pic_standard';
import * as path from 'path';
import * as fs from 'fs';

export function getImporter():Importer {
	return new LibImp("tesseract",{request_symlink:{build:true}});
}
class LibImp extends Importer {
	getVersions():string[] {
		return ["5.1.0"];
	}
	getOptions():Map<string,ImpOpt> {
		var k = new Map<string,ImpOpt>();
		k.set("dynamic", {value:"false", values:["true", "false"], desc:"Build dynamic instead static library"});
		return k;
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		await super.import(target, version, options, dst, purge);
		await this.downloadSource(`https://github.com/tesseract-ocr/tesseract/archive/refs/tags/${version}.tar.gz`, "tar.gz");
		var cmake_dir = path.resolve(this.cache_src, `tesseract-${version}`);
		await this.dopeFile(path.resolve(cmake_dir, 'CMakeLists.txt'), async (text)=>{
			var cutindex = text.indexOf('# EXECUTABLE tesseract');
			if (cutindex > 0) text = text.substr(0,cutindex);
			text = text.replace('sw" ON','sw" OFF')
				.replace('find_package(Leptonica ${MINIMUM_LEPTONICA_VERSION} CONFIG)', '');
			return pic_inj.apply(text);
		});
		await this.dopeFile(path.resolve(cmake_dir, 'src/arch/simddetect.cpp'), async (text)=>
			text.replace(/(defined\(HAS_CPUID\))/g,'defined(HAS_CPUID) && !defined(__EMSCRIPTEN__)')
		);
		await this.buildProcess(async (clear:boolean)=>{
			var leptonica = this.getLibraryJSON(await this.requestLibraryDir(target, dst, 'leptonica', undefined, true));
			await cmake.cmake(
				target,
				cmake_dir,
				this.cache_bld,
				[
					//@ts-ignore
					'-DBUILD_SHARED_LIBS='+((options.get('dynamic').value == 'true')?'ON':'OFF'),

					'-DCMAKE_DISABLE_FIND_PACKAGE_TIFF=ON',
					'-DCMAKE_DISABLE_FIND_PACKAGE_PkgConfig=ON',
					'-DDISABLE_CURL=ON',
					'-DDISABLE_ARCHIVE=ON',
					'-DINSTALL_CONFIGS=OFF',
					
					'-DLeptonica_FOUND=ON',
					'-DLeptonica_LIBRARIES='+leptonica.getLibraries(false).join(';'),
					'-DLeptonica_INCLUDE_DIRS='+leptonica.inc,
				],{
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
		await files.copy_recursive(
			path.resolve(cmake_dir, 'include'), path.resolve(this.dst_inc, 'tesseract'),
			{
				sub_folder_src:true,
				file_filter:(x:string)=>files.filterName(x, ['*.h', '*.hpp'])
			}
		);//config_auto
		await files.copy_recursive(
			this.cache_bld, path.resolve(this.dst_inc, 'tesseract'),
			{
				sub_folder_src:true, sub_folder_count:4,
				file_filter:(x:string)=>files.filterName(x, ['*.h', '*.hpp']) && !files.filterName(x,'*config_auto*')
			}
		)
		//@ts-ignore
		if ((options.get('dynamic').value == 'true')) {
			// dynamic
			await files.copy_recursive(
				this.cache_bld, this.dst_dynamic,
				{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.so','*.lib','*.dll','*.dylib']), symlinks_raster:true, ignore_clone_libs:true }
			);
		} else {
			// static
			await files.copy_recursive(
				this.cache_bld, this.dst_static,
				{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.a','*.lib']), symlinks_raster:true }
			);
		}
		this.genCMakeInclude("TESSERACT");
	}
}

