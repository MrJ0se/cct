import {Importer,ImpOpt} from "../import";
import * as def from '../def';
import * as cmake from '../cmake';
import * as files from '../u/files';
import * as pic_inj from '../proc/cmake_inject_pic_standard';
import * as remove_install from '../proc/cmake_remove_install';
import * as path from 'path';

export function getImporter():Importer {
	return new LibImp("libjpeg-turbo", {request_symlink:{build:true}});
}
class LibImp extends Importer {
	getVersions():string[] {
		return ["2.0.90"];
	}
	getOptions():Map<string,ImpOpt> {
		var k = new Map<string,ImpOpt>();
		k.set("simd", {value:"true", values:["true", "false"], desc:" SIMD Optimizatios"});
		k.set("turbo", {value:"false", values:["true", "false"], desc:"Optimized turbo-jpeg"});
		k.set("static", {value:"true", values:["true", "false"], desc:"Build static library"});
		k.set("dynamic", {value:"true", values:["true", "false"], desc:"Build dynamic library"});
		return k;
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		await super.import(target, version, options, dst, purge);
		await this.downloadSource(`https://github.com/libjpeg-turbo/libjpeg-turbo/archive/refs/tags/${version}.tar.gz`, "tar.gz");
		var cmake_dir = path.resolve(this.cache_src, `libjpeg-turbo-${version}`);
		await this.dopeFile(path.resolve(cmake_dir, 'CMakeLists.txt'), async (text)=>{
			remove_install.main(cmake_dir);
			return remove_install.apply(pic_inj.apply(text));
		});
		await this.dopeFile(path.resolve(cmake_dir, 'sharedlib/CMakeLists.txt'), async (text)=>
			remove_install.apply(text)
		);
		//to try after: fix turbo-jpeg compilation (linker errors can be resolved in windows with: (library) vcruntime)
		/*await this.dopeFile(path.resolve(cmake_dir, 'tjutil.h'), async (text)=>{
			var i = text.indexOf('_snprintf_s');
			return text.substr(0,i)+'0//'+text.substr(i);
		});*/
		await this.buildProcess(async (clear:boolean)=>{
			if ([def.Arch.X32, def.Arch.X64].find((x)=>target.target.arch==x)!=null)
				//@ts-ignore
				{var t = options.get('simd');t.value='false';options.set('simd',t);}
			if (target.target.platform == def.Platform.WEB) {
				//@ts-ignore
				{var t = options.get('turbo');t.value='false';options.set('turbo',t);}
				//@ts-ignore
				{var t = options.get('dynamic');t.value='false';options.set('dynamic',t);}
				//@ts-ignore
				{var t = options.get('static');t.value='true';options.set('static',t);}
			}
			var args = [
				//@ts-ignore
				'-DWITH_SIMD='+((options.get('simd').value == 'true')?'ON':'OFF'),
				//@ts-ignore
				'-DWITH_TURBOJPEG='+((options.get('turbo').value == 'true')?'ON':'OFF'),
				//@ts-ignore
				'-DENABLE_SHARED='+((options.get('dynamic').value == 'true')?'ON':'OFF'),
				//@ts-ignore
				'-DENABLE_STATIC='+((options.get('static').value == 'true')?'ON':'OFF'), 
			];

			if ([def.Platform.WIN, def.Platform.LNX, def.Platform.AND].find((x)=>target.target.platform==x)==null) {
				var tarch = 'x86';
				switch (target.target.arch) {
				case def.Arch.X32: tarch = 'x86'; break;
				case def.Arch.X64: tarch = 'x86_64'; break;
				case def.Arch.ARM: tarch = 'arm'; break;
				case def.Arch.A64: tarch = 'arm64'; break;
				}
				args.push('-DCMAKE_SYSTEM_PROCESSOR='+tarch);
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
			{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.a','*static*.lib']), symlinks_raster:true }
		);
		// dynamic
		await files.copy_recursive(
			this.cache_bld, this.dst_dynamic,
			{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.so','*.lib','*.dll','*.dylib']) && !files.filterName(x, ['*static*.lib']), symlinks_raster:true }
		);
		this.genCMakeInclude("LIBJPEG_TURBO");
	}
}