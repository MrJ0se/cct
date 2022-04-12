import {Importer,ImpOpt} from "../import";
import * as def from '../def';
import * as tools from '../tools';
import * as cmake from '../cmake';
import * as files from '../u/files';
import * as path from 'path';
import {execNoError} from '../u/exec';
import * as fs from 'fs';

export function getImporter():Importer {
	return new LibImp("aom", {request_symlink:{build:true}});
}
class LibImp extends Importer {
	getVersions():string[] {
		return ["3.3.0"];
	}
	getOptions():Map<string,ImpOpt> {
		var k = new Map<string,ImpOpt>();
		k.set('optim', {value:'1', values:['0', '1', '2'], desc:'Optmization level'});
		k.set('dynamic', {value:'false', values:['true','false'], desc:'Build dynamic instead static library'});
		return k;
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		await super.import(target, version, options, dst, purge);
		await tools.requestMult(['perl','yasm'], true);
		await this.downloadSource('https://aomedia.googlesource.com/aom', 'git');
		var cmake_dir = path.resolve(this.cache_src, 'aom');
		var git_repo = path.resolve(cmake_dir, '.git');
		await this.dopeState(path.resolve(this.cache_src, 'git-1'), async()=>{
			console.log('checkout to 3.3.0...');
			if (!fs.existsSync(cmake_dir) || !(await execNoError('git checkout refs/tags/v'+version, cmake_dir)))
				throw 'Checkout failed';
		});
		if (fs.existsSync(git_repo)) {
			console.log('clearing source');
			files.remove_recursive(git_repo);
		}
		await this.dopeCmake(cmake_dir);
		await this.buildProcess(async (clear:boolean)=>{
			//@ts-ignore
			var optime_level = parseInt(options.get('optim').value);
			if (target.target.platform == def.Platform.WEB)
				optime_level = 0;
			var args:string[] = [
				//@ts-ignore
				'-DBUILD_SHARED_LIBS='+((options.get('dynamic').value == 'true')?'ON':'OFF'),
				
				'-DENABLE_TESTS=OFF',
				'-DENABLE_TOOLS=OFF',
				'-DENABLE_TESTDATA=OFF',
				'-DENABLE_EXAMPLES=OFF',
				'-DENABLE_DOCS=OFF',

				'-DENABLE_NEON='+(optime_level>=2?'ON':'OFF'),
				'-DENABLE_DSPR2='+(optime_level>=2?'ON':'OFF'),
				'-DENABLE_MSA='+(optime_level>=2?'ON':'OFF'),
				'-DENABLE_VSX='+(optime_level>=1?'ON':'OFF'),
				'-DENABLE_MMX='+(optime_level>=1?'ON':'OFF'),
				'-DENABLE_SSE='+(optime_level>=1?'ON':'OFF'),
				'-DENABLE_SSE2='+(optime_level>=1?'ON':'OFF'),
				'-DENABLE_SSE3='+(optime_level>=1?'ON':'OFF'),
				'-DENABLE_SSSE3='+(optime_level>=2?'ON':'OFF'),
				'-DENABLE_SSE4_1='+(optime_level>=2?'ON':'OFF'),
				'-DENABLE_SSE4_2='+(optime_level>=2?'ON':'OFF'),
				'-DENABLE_AVX='+(optime_level>=2?'ON':'OFF'),
				'-DENABLE_AVX2='+(optime_level>=2?'ON':'OFF'),
			];
			if (target.target.platform == def.Platform.WEB)
				args.push('-DAOM_TARGET_CPU=generic')

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
			path.resolve(cmake_dir, 'aom'),
			path.resolve(this.dst_inc, 'aom'),
			{ file_filter:header_filter, sub_folder_count:2 }
		);
		await files.copy_recursive(
			path.resolve(cmake_dir, 'third_party/libyuv/include'),
			path.resolve(this.dst_inc, 'libyuv'),
			{ file_filter:header_filter, sub_folder_count:5, sub_folder_src:true }
		)
		// create libyuv.h
		{
			let incs = fs.readdirSync(path.resolve(this.dst_inc, 'libyuv'))
				.filter((x)=>x.indexOf('.h')>0)
				.map((x)=>`#include "libyuv/${x}"`);
			fs.writeFileSync(path.resolve(this.dst_inc, 'libyuv.h'), '#pragma once\n'+incs.join('\n'));
		}
		//@ts-ignore
		if (options.get('dynamic').value == 'true')
			// dynamic
			await files.copy_recursive(
				this.cache_bld, this.dst_dynamic,
				{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.so','*.lib','*.dll','*.dylib']), symlinks_raster:true, ignore_clone_libs:true }
			);
		else
			// static
			await files.copy_recursive(
				this.cache_bld, this.dst_static,
				{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.a','*.lib']), symlinks_raster:true }
			);
		this.genCMakeInclude("AOM");
	}
}