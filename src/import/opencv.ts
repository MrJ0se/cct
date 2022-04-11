import {Importer,ImpOpt,ReorderOp} from "../import";
import * as def from '../def';
import * as tools from '../tools';
import * as cmake from '../cmake';
import * as files from '../u/files';
import * as pic_inj from '../proc/cmake_inject_pic_standard';
import * as path from 'path';
import * as fs from 'fs';

export function getImporter():Importer {
	return new LibImp("opencv", {request_symlink:{build:true}});
}
class LibImp extends Importer {
	getVersions():string[] {
		return ["4.5.5"];
	}
	getOptions():Map<string,ImpOpt> {
		var k = new Map<string,ImpOpt>();
		k.set("dynamic", {value:"false", values:["true", "false"], desc:"Build dynamic instead static library"});
		return k;
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		await super.import(target, version, options, dst, purge);
		await this.downloadSource(`https://github.com/opencv/opencv/archive/refs/tags/${version}.tar.gz`, "tar.gz");
		var cmake_dir = path.resolve(this.cache_src, `opencv-${version}`);
		await this.dopeFile(path.resolve(cmake_dir, 'cmake/OpenCVFindLibsGUI.cmake'), async(text:string)=>
			text.replace('set(HAVE_COCOA YES)','#set(HAVE_COCOA YES)')
		);
		await this.dopeFile(path.resolve(cmake_dir, 'cmake/OpenCVCompilerOptions.cmake'), async(text:string)=>
			text.replace('set(_option "-Wl,--as-needed")',
`if(APPLE)
	set(_option "-Wl")
else()
	set(_option "-Wl,--as-needed")
endif()`
			)
		);
		await this.buildProcess(async (clear:boolean)=>{
			var args:string[] = [
				//@ts-ignore
				'-DBUILD_SHARED_LIBS='+((options.get('dynamic').value == 'true')?'ON':'OFF'),

				'-DOPENCV_ENABLE_NONFREE=OFF',
				'-DWITH_AVFOUNDATION=OFF',
				'-DWITH_CAP_IOS=OFF',
				'-DWITH_FFMPEG=OFF',
				'-DWITH_GSTREAMER=OFF',
				'-DWITH_GTK=OFF',
				'-DWITH_JASPER=OFF',
				'-DWITH_OPENJPEG=OFF',
				'-DWITH_JPEG=OFF',
				'-DWITH_WEBP=OFF',
				'-DWITH_OPENEXR=OFF',
				'-DWITH_PNG=OFF',
				'-DWITH_WIN32UI=OFF',
				'-DWITH_TIFF=OFF',
				'-DWITH_V4L=OFF',
				'-DWITH_DSHOW=OFF',
				'-DWITH_MSMF=OFF',
				'-DWITH_XIMEA=OFF',
				'-DWITH_IMGCODEC_HDR=OFF',
				'-DWITH_IMGCODEC_SUNRASTER=OFF',
				'-DWITH_IMGCODEC_PXM=OFF',
				'-DWITH_IMGCODEC_PFM=OFF',
				'-DWITH_QUIRC=OFF',
				'-DENABLE_PYLINT=OFF',
				'-DENABLE_FLAKE8=OFF',

				'-DWITH_OPENCL=OFF',

				'-DBUILD_opencv_apps=OFF',
				'-DBUILD_ANDROID_PROJECTS=OFF',
				'-DBUILD_ANDROID_EXAMPLES=OFF',
				'-DBUILD_DOCS=OFF',
				'-DBUILD_PERF_TESTS=OFF',
				'-DBUILD_TESTS=OFF',
				'-DBUILD_FAT_JAVA_LIB=OFF',
				'-DBUILD_OBJC=OFF',
				'-DBUILD_KOTLIN_EXTENSIONS=OFF',
				'-DINSTALL_BIN_EXAMPLES=OFF',
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


		const incdirs = [
			path.resolve(cmake_dir, "include/opencv2"),
			path.resolve(this.cache_bld, "opencv2"),
			...(fs
				.readdirSync(path.resolve(cmake_dir, 'modules'))
				.map(x=>path.resolve(cmake_dir, 'modules', x, 'include/opencv2'))
				.filter(x=>fs.existsSync(x))
			)
		];
		var dst_inc_x = path.resolve(this.dst_inc, 'opencv2');
		for (var i = 0; i < incdirs.length; i++) {
			await files.copy_recursive(
				incdirs[i], dst_inc_x,
				{ file_filter:header_filter, sub_folder_count:5 }
			);
		}

		//@ts-ignore
		if ((options.get('dynamic').value == 'true')) {
			// dynamic
			await files.copy_recursive(
				this.cache_bld, this.dst_dynamic,
				{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.so','*.lib','*.dll','*.dylib']), symlinks_raster:true }
			);
		} else {
			// static
			await files.copy_recursive(
				this.cache_bld, this.dst_static,
				{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.a','*.lib']), symlinks_raster:true }
			);
		}
		this.genCMakeInclude(
			"OPENCV",
			[
				{op:ReorderOp.ADD_TO_NEW, filter:'*opencv*'},
				{op:ReorderOp.MOVE_TO_END, filter:'*opencv*core*'},
				{op:ReorderOp.ADD_TO_NEW, filter:['*ade*','*ittnotify*','*libproto*','*ippiw*']},
				{op:ReorderOp.ADD_TO_NEW, filter:'*ippicv*'},
				{op:ReorderOp.ADD_TO_NEW, filter:'*'},
			]
		);
	}
}