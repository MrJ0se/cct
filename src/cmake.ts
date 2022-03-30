import * as def from './def';
import * as files from './u/files';
import * as fs from 'fs';
import * as path from 'path';
import {execPipedVerbose, joinCommandLine} from './u/exec';
import {request, requestMult} from './tools';

import {main as runtime_fix} from './proc/windows_runtime';
import {main as uglify} from './proc/uglify';

class CMakeTC {
	found:boolean = false;
	platform_arch:string;
	config:((target:def.TargetBuild, src:string, dst:string, args:string)=>Promise<void>)|undefined;
	build:((target:def.TargetBuild, dst:string, release:boolean)=>Promise<void>)|undefined;
	constructor(platform_arch:string) {
		this.platform_arch = platform_arch;
	}
};

var memcache = new Map<string,CMakeTC>();
var getters = new Map<string,(x:CMakeTC)=>Promise<void>>();
export async function request_tc (platform_arch:string, fail_on_falt:boolean):Promise<CMakeTC|undefined>  {
	var r:CMakeTC;
	if (memcache.has(platform_arch))
		r = memcache.get(platform_arch) as CMakeTC;
	else {
		r = new CMakeTC(platform_arch);
		if (getters.has(platform_arch))
			await (getters.get(platform_arch) as (x:CMakeTC)=>Promise<void>)(r);
	}
	if (r.found && r.config && r.build)
		return r;
	if (fail_on_falt)
		throw `Required cmake target not found or unavailable: ${platform_arch}`;
	return undefined;
}

export async function cmake(target:def.TargetBuild, src:string, dst:string, args:string[], actions:{clear?:boolean, config?:boolean, build?:boolean}) {
	await request("cmake", true);
	var tc = await request_tc(def.Target_join(target.target), true) as CMakeTC;
	if (actions.clear) {
		fs.readdirSync(dst).forEach((x)=>{
			files.mkdir_recursive(path.resolve(dst, x));
		});
	}

	var mode_args:string[] = [];
	switch (target.mode) {
	case def.BuildMode.DEBUG:
		mode_args = ['-DCMAKE_BUILD_TYPE=Debug'];
		break;
	case def.BuildMode.RELEASE:
		mode_args = ['-DCMAKE_BUILD_TYPE=Release'];
		break;
	default:
		mode_args = ['-DCMAKE_BUILD_TYPE=Release', 'DCMAKE_CXX_FLAGS_RELEASE='+getOptimizationFlag(
			//@ts-ignore
			target.mode,
			(target.target.platform == 'uwp' || target.target.platform == 'win32')
		)];
	}
	if (actions.config) {
		var final_args = [
				...args,
				`-DCCT_TARGET=${target.target.platform}-${target.target.arch}`,
				`-DCCT_TARGET_PLATFORM=${target.target.platform}`,
				`-DCCT_TARGET_ARCH=${target.target.arch}`,
				...mode_args,
			];
		if (false)//old mode
			final_args.push(src);
		else 
			final_args.push('-B'+dst,'-S'+src);
		//@ts-ignore
		await tc.config(target, src, dst, joinCommandLine(final_args));
	}
	if (actions.build) {
		//@ts-ignore
		await tc.build(target, dst, target.mode != def.BuildMode.DEBUG);
	}
}
function getOptimizationFlag(opt:def.BuildMode, isWin:boolean):string {
	switch (opt) {
	default:
	case def.BuildMode.RELEASE_FASTER:
		return isWin?'/Ot':'-Ofast';
	case def.BuildMode.RELEASE_LITTLER:
		return isWin?'/Os':'-Os';
	case def.BuildMode.RELEASE_MIN_OPTMIZE:
		return isWin?'/Od':'-O0';
	case def.BuildMode.RELEASE_MAX_OPTMIZE:
		return isWin?'/O2':'-Ofast';
	}
}
function toPattern_arch(x:string) {
	return ({
		'x32':'x32',
		'x86':'x32',
		'ia32':'x32',
		'win32':'x32',
		'x64':'x64',
		'x86_64':'x64',
		'arm':'arm',
		'armeabi-v7a':'arm',
		'arm64':'arm64',
		'arm64-v8a':'arm64',
	}[x.toLowerCase()] as string);
}
function toPattern_windows_arch(x:string) {
	return ({
		'x32':'Win32',
		'x86':'Win32',
		'ia32':'Win32',
		'win32':'Win32',
		'x64':'x64',
		'x86_64':'x64',
		'arm':'arm',
		'armeabi-v7a':'arm',
		'arm64':'ARM64',
		'arm64-v8a':'ARM64',
	}[x.toLowerCase()] as string);
}
function toPattern_android_arch(x:string) {
	return ({
		'x32':'x86',
		'x86':'x86',
		'ia32':'x86',
		'win32':'x86',
		'x64':'x86_64',
		'x86_64':'x86_64',
		'arm':'armeabi-v7a',
		'armeabi-v7a':'armeabi-v7a',
		'arm64':'arm64-v8a',
		'arm64-v8a':'arm64-v8a',
	}[x.toLowerCase()] as string);
}
function fill_cmakeTC_normal(x: CMakeTC, config_line: string) {
	x.found = true;
	x.config = async(target:def.TargetBuild, src:string, dst:string, args:string)=>{
		if ((await execPipedVerbose(config_line + ' ' + args, dst))!=0)
			throw "";
	};
	x.build = async (target:def.TargetBuild, dst:string, release:boolean)=>{
		if ((await execPipedVerbose(`cmake --build . --config ${release?'Release':'Debug'}`, dst))!=0)
			throw "";
	};
}

export var current_platform = process.platform;
export var current_arch = toPattern_arch(process.arch);

getters.set('linux-x32',async (x: CMakeTC)=>{
	if (current_platform != 'linux' || ['x64','x32'].find((x)=>x==current_arch) == null)
		return;
	var t = await request("clang",false)
	if (t != undefined)
		t = await request("gcc",true);
	//@ts-ignore
	fill_cmakeTC_normal(x, `cmake -DCMAKE_C_COMPILER=${t.props.get('cc')} -DCMAKE_CXX_COMPILER=${t.props.get('cxx')} -DCMAKE_C_FLAGS="-m32" -DCMAKE_CXX_FLAGS="-m32"`);
});
getters.set('linux-x64',async (x: CMakeTC)=>{
	if (current_platform != 'linux' || ['x64','x32'].find((x)=>x==current_arch) == null)
		return;
	var t = await request("clang",false)
	if (t == undefined)
		t = await request("gcc",true);
	//@ts-ignore
	fill_cmakeTC_normal(x, `cmake -DCMAKE_C_COMPILER=${t.props.get('cc')} -DCMAKE_CXX_COMPILER=${t.props.get('cxx')} -DCMAKE_C_FLAGS="-m64" -DCMAKE_CXX_FLAGS="-m64"`);
});
getters.set('linux-arm',async (x:CMakeTC)=>{
	var t:def.Tool|undefined;
	if (current_platform == 'linux' && current_arch == 'arm') {
		t = await request("clang",false)
		if (t == undefined)
			t = await request("gcc",true);
	} else
		t = await request("arm-linux-gnueabi-gcc",true);
	//@ts-ignore
	fill_cmakeTC_normal(x, `cmake -DCMAKE_C_COMPILER=${t.props.get('cc')} -DCMAKE_CXX_COMPILER=${t.props.get('cxx')}`);
});
getters.set('linux-arm64',async (x:CMakeTC)=>{
	var t:def.Tool|undefined;
	if (current_platform == 'linux' && current_arch == 'arm64') {
		t = await request("clang",false)
		if (t == undefined)
			t = await request("gcc",true);
	} else
		t = await request("aarch64-linux-gnu-gcc",true);
	//@ts-ignore
	fill_cmakeTC_normal(x, `cmake -DCMAKE_C_COMPILER=${t.props.get('cc')} -DCMAKE_CXX_COMPILER=${t.props.get('cxx')}`);
});
//falta o fix runtime no win e uwp
['x32','x64','arm','arm64'].forEach((arch)=>{
	let varch = toPattern_windows_arch(arch);
	let aarch = toPattern_android_arch(arch);
	//win
	getters.set('win32-'+arch,async (x:CMakeTC)=>{
		var t = await request("vc++",true);
		x.found = true;
		x.config = async(target:def.TargetBuild, src:string, dst:string, args:string)=>{
			if ((await execPipedVerbose(`cmake -A ${varch} ` + args, dst))!=0)
				throw "";
			console.log('running post config runtime fix...');
			runtime_fix(target.win_runtime, dst);
		};
		x.build = async (target:def.TargetBuild, dst:string, release:boolean)=>{
			if ((await execPipedVerbose(`cmake --build . --config ${release?'Release':'Debug'}`, dst))!=0)
				throw "";
		};
	});
	//uwp
	getters.set('uwp-'+arch,async (x:CMakeTC)=>{
		var t = await request("vc++",true);
		x.found = true;
		x.config = async(target:def.TargetBuild, src:string, dst:string, args:string)=>{
			if ((await execPipedVerbose(`cmake -A ${varch} -DCMAKE_SYSTEM_NAME=WindowsStore -DCMAKE_SYSTEM_VERSION=${target.uwp_sdk as string} ` + args, dst))!=0)
				throw "";
			if (target.win_runtime == def.win_Runtime.ANY)
				target.win_runtime = def.win_Runtime.MD_X;
			console.log('running post config runtime fix...');
			runtime_fix(target.win_runtime, dst);
		};
		x.build = async (target:def.TargetBuild, dst:string, release:boolean)=>{
			if ((await execPipedVerbose(`cmake --build . --config ${release?'Release':'Debug'}`, dst))!=0)
				throw "";
		};
	});
	//android
	getters.set('android-'+arch,async (x:CMakeTC)=>{
		var t = await request("vc++",true);
		//@ts-ignore
		var toolchain = t.props.get('toolchain.cmake');
		x.found = true;
		x.config = async(target:def.TargetBuild, src:string, dst:string, args:string)=>{
			if ((await execPipedVerbose(`cmake -DCMAKE_TOOLCHAIN_FILE=${toolchain} -DANDROID_ABI=${aarch} -DANDROID_NATIVE_API_LEVEL=${target.and_sdk} ` + args, dst))!=0)
				throw "";
		};
		x.build = async (target:def.TargetBuild, dst:string, release:boolean)=>{
			if ((await execPipedVerbose(`cmake --build . --config ${release?'Release':'Debug'}`, dst))!=0)
				throw "";
		};
	});
});
getters.set('web-wasm',async (x:CMakeTC)=>{
	var t = await request("emsdk",true)
	x.found = true;
	x.config = async(target:def.TargetBuild, src:string, dst:string, args:string)=>{
		if ((await execPipedVerbose(`emcmake cmake ` + args, dst))!=0)
			throw "";
	};
	x.build = async (target:def.TargetBuild, dst:string, release:boolean)=>{
		if ((await execPipedVerbose(`cmake --build . --config ${release?'Release':'Debug'}`, dst))!=0)
			throw "";
		console.log('running post release build uglify...');
		uglify(dst);
	};
});

const macTCpath = path.resolve(__dirname,"../rsc/mac/ios.toolchain.cmake");
[
	['darwin-x64','MAC'],
	['darwin-arm64','MAC_ARM64'],
	['ios-arm64','OS64'],
	['iosemu-x64','SIMULATOR64'],
	['iosemu-arm64','SIMULATORARM64'],
].forEach((desc)=>{
	getters.set(desc[0],async (x:CMakeTC)=>{
		var t = await request("emsdk",true)
		x.found = true;
		x.config = async(target:def.TargetBuild, src:string, dst:string, args:string)=>{
			if (target.mac_bundleGUI != "")
				args = `-DMACOSX_BUNDLE_GUI_IDENTIFIER=${target.mac_bundleGUI} ` + args;
			if ((await execPipedVerbose(`cmake -G Xcode -DCMAKE_TOOLCHAIN_FILE=${macTCpath} -DPLATFORM=${desc[1]} ` + args, dst))!=0)
				throw "";
		};
		x.build = async (target:def.TargetBuild, dst:string, release:boolean)=>{
			if ((await execPipedVerbose(`cmake --build . --config ${release?'Release':'Debug'}`, dst))!=0)
				throw "";
		};
	});
});