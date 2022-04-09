import {Tool} from './def';
import {execNoError} from './u/exec';
import * as files from './u/files';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

var memcache = new Map<string,Tool>();
var getters = new Map<string,(x:Tool)=>Promise<void>>();

export async function requestMult(names:string[], fail_on_falt:boolean):Promise<Tool[]> {
	var ret:Tool[] = [];
	for (var i = 0; i < names.length; i++) {
		var r = await request(names[i], fail_on_falt);
		if (r != undefined) ret.push(r);
	}
	return ret;
}
export async function request(name:string, fail_on_falt:boolean):Promise<Tool|undefined> {
	var r:Tool;
	if (memcache.has(name))
		r = memcache.get(name) as Tool;
	else {
		r = new Tool(name);
		if (!r.try_load(2*3600*1000) && getters.has(name)) {
			await (getters.get(name) as (x:Tool)=>Promise<void>)(r);
			r.save();
		}
	}
	if (r.found)
		return r;
	if (fail_on_falt)
		throw `Required tool not found: ${name}`;
	return undefined;
}
export function getAppFullpath(name:string|string[]):string {
	if (typeof(name) == 'string')
		name = [name];
	var r = '';
	for (var i = 0; i < name.length && r == ''; i++) {
		if (process.platform == 'win32') {
			//@ts-ignore
			(process.env.path.split(';') as string[])
			.find((x)=>['exe','bat','cmd'].find((y)=>{
				var p = path.resolve(x, name[i]+'.'+y);
				if (fs.existsSync(p)) {
					r = p;
					return true;
				}
				return false;
			}) !=null);
		} else {
			var p = '/usr/bin:usr/local/bin';
			var pl = process.env.path;
			if (pl && pl.length > 0)
				p += ':'+pl;

			(p.split(':') as string[])
			.find((x)=>{
				var p = path.resolve(x, name[i]);
				if (fs.existsSync(p)) {
					r = p;
					return true;
				}
				return false;
			});
		}
	}
	return r;
}

getters.set("cmake",async (r:Tool)=>{
	r.found = await execNoError("cmake --version");
});
getters.set("perl",async (r:Tool)=>{
	r.found = await execNoError("perl --version");
});
getters.set("yasm",async (r:Tool)=>{
	r.found = await execNoError("yasm --version");
});
getters.set("nasm",async (r:Tool)=>{
	r.found = await execNoError("nasm --version");
});
//compilers
getters.set("emsdk",async (r:Tool)=>{
	r.found = await execNoError("emcc --version");
	if (r.found) {
		r.props.set("cc","emcc");
		r.props.set("cxx","em++");
		r.props.set("ranlib","emranlib");
		r.props.set("ar","emar");
	}
});
getters.set("clang",async (r:Tool)=>{
	r.found = await execNoError("clang --version");
	if (r.found) {
		r.props.set("cc","clang");
		r.props.set("cxx","clang++");
		r.props.set("ranlib","llvm-ranlib");
		r.props.set("ar","llvm-ar");
		r.props.set("strip","llvm-strip");
	}
});
getters.set("gcc",async (r:Tool)=>{
	r.found = await execNoError("gcc --version");
	if (r.found) {
		r.props.set("cc","gcc");
		r.props.set("cxx","g++");
		r.props.set("ranlib","ranlib");
		r.props.set("ar","ar");
		r.props.set("strip","strip");
		r.props.set("ld","ld");
	}
});
getters.set("arm-linux-gnueabi-gcc",async (r:Tool)=>{
	r.found = await execNoError("arm-linux-gnueabi-gcc --version");
	if (r.found) {
		r.props.set("cc","arm-linux-gnueabi-gcc");
		r.props.set("cxx","arm-linux-gnueabi-g++");
		r.props.set("ranlib","arm-linux-gnueabi-ranlib");
		r.props.set("ar","arm-linux-gnueabi-ar");
		r.props.set("strip","arm-linux-gnueabi-strip");
		r.props.set("ld","arm-linux-gnueabi-ld");
	}
});
getters.set("aarch64-linux-gnu-gcc",async (r:Tool)=>{
	for (var i = 11; i >= 5; i--) {
		var pf = i == 5?"":("-"+i);
		r.found = await execNoError("aarch64-linux-gnu-gcc${pf} --version");
		if (r.found) {
			r.props.set("cc","aarch64-linux-gnu-gcc${cv}");
			r.props.set("cxx","aarch64-linux-gnu-g++${cv}");
			r.props.set("ranlib","aarch64-linux-gnu-ranlib");
			r.props.set("ar","aarch64-linux-gnu-ar");
			r.props.set("strip","aarch64-linux-gnu-strip");
			return;
		}
	}
});
getters.set("vc++",async (r:Tool)=>{
	if (process.platform != "win32")
		return;
	var paths = [
		'C:\\Program Files\\Microsoft Visual Studio',
		'C:\\Program Files (x86)\\Microsoft Visual Studio',
	];
	for (var i = 0; i < paths.length;i ++) {
		if (fs.existsSync(paths[i])) {
			var res = await files.find_recursive(paths[i], (x:string)=>path.basename(x) == 'vcvarsall.bat');
			if (res.length > 0) {
				r.found = true;
				r.props.set("vcvarall", res[0]);
				return;
			}
		}
	}
});

getters.set("ndk",async (r:Tool)=>{
	if (process.platform == 'linux') {
		var ndks_repo = [
			path.resolve(os.homedir(),'Android/Sdk/ndk'),
		].find((p)=>fs.existsSync(p));
		if (ndks_repo)
			var and = await find_ndk(ndks_repo, r, "");
	}
});
function android_ndk_version2number (v:number[]) {
	try {
		var r = (v[0]?v[0]:0)*100000;
		r    += (v[1]?v[1]:0)*10000;
		//@ts-ignore
		r += parseInt((v[2]?v[2]:0)/1000);
		return r;
	} catch (e) {
		return -1;
	}
}
async function find_ndk (ndks_repo:string, r:Tool, exec_postfix:string) {
	var ndks_folders = fs.readdirSync(ndks_repo).filter((dir)=>
		fs.lstatSync(path.resolve(ndks_repo as string, dir)).isDirectory() && dir.split('.').length == 3
	).sort((f1,f2)=>{
		let a1 = android_ndk_version2number(path.basename(f1).split('.').map((v)=>parseInt(v)));
		let a2 = android_ndk_version2number(path.basename(f2).split('.').map((v)=>parseInt(v)));
		return a2 - a1;
	}).map((f)=>path.resolve(ndks_repo as string, f));

	for (var i = 0; i < ndks_folders.length; i++) {
		var ndk_folder = ndks_folders[i];

		var toolchain_file = path.resolve(ndk_folder, 'build/cmake/android.toolchain.cmake');
		if (!fs.existsSync(toolchain_file))
			continue;
		let llvm_pb_folder = path.resolve(ndk_folder, 'toolchains/llvm/prebuilt');
		if (!fs.existsSync(llvm_pb_folder) || !fs.lstatSync(llvm_pb_folder).isDirectory())
			continue;
		var llvm = fs.readdirSync(llvm_pb_folder).map((dir)=>
			path.resolve(
				llvm_pb_folder,
				dir,
				'bin'
			)
		).find((p)=>
			fs.existsSync(path.resolve(p, 'llvm-strip'+exec_postfix))
		);
		if (llvm == null)
			continue;

		r.found = true;
		r.props.set('root', ndk_folder);
		r.props.set('toolchain.cmake', toolchain_file);

		const arch_bin =
		['i686-linux-android','x86_64-linux-android','arm-linux-androideabi','aarch64-linux-android'];
		['x32','x64','arm','a64'].forEach((arc, i)=>{

			var barc = arch_bin[i];
			r.props.set(arc+"-cc",path.resolve(llvm as string, barc+'${SDK}-clang'+exec_postfix));
			r.props.set(arc+"-cxx",path.resolve(llvm as string, barc+'${SDK}-clang++'+exec_postfix));
			r.props.set(arc+"-ranlib",path.resolve(llvm as string, barc+'-ranlib'+exec_postfix));
			r.props.set(arc+"-ar",path.resolve(llvm as string, barc+'-ar'+exec_postfix));
			r.props.set(arc+"-strip",path.resolve(llvm as string, barc+'-strip'+exec_postfix));
		});
		return;
	}
}