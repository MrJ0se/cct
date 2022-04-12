import {Importer,ImpOpt} from "../import";
import * as def from '../def';
import * as tools from '../tools';
import * as cmake from '../cmake';
import * as files from '../u/files';
import * as pic_inj from '../proc/cmake_pic_standard';
import * as path from 'path';

export function getImporter():Importer {
	return new LibImp("zlib", {request_symlink:{build:true}});
}
class LibImp extends Importer {
	getVersions():string[] {
		return ["1.2.11"];
	}
	getOptions():Map<string,ImpOpt> {
		var k = new Map<string,ImpOpt>();
		k.set("asm", {value:"true", values:["true", "false"], desc:"Build with x32 | x64 asm optimization"})
		return k;
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		await super.import(target, version, options, dst, purge);
		await this.downloadSource(`https://www.zlib.net/fossils/zlib-${version}.tar.gz`, "tar.gz");
		var cmake_dir = path.resolve(this.cache_src, `zlib-${version}`);
		await this.dopeFile(path.resolve(cmake_dir, 'CMakeLists.txt'), async (text)=>{
			var cutindex = text.indexOf('# Example binaries');
			if (cutindex > 0) text = text.substr(0,cutindex);
			return pic_inj.apply(text);
		});
		await this.buildProcess(async (clear:boolean)=>{
			var args:string[] = ['-DSKIP_INSTALL_ALL=ON'];
			//@ts-ignore
			if (options.get('asm').value == 'true') {
				if (target.target.arch.indexOf('x')==0 && (await tools.request("yasm", false)) == null) await tools.request("nasm", true);
				if (target.target.arch == 'x32') args.push('ASM686=ON');
				if (target.target.arch == 'x64') args.push('AMD64=ON');
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
			{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.so','*.lib','*.dll','*.dylib']) && !files.filterName(x, ['*static*.lib']), symlinks_raster:true, ignore_clone_libs:true }
		);
		this.genCMakeInclude("ZLIB");
	}
}