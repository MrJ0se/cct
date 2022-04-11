import * as path from 'path';
import * as fs from 'fs';
import * as files from './u/files';
import * as os from 'os';


export enum ColorCode {
	Reset = "\x1b[0m",
	Bright = "\x1b[1m",
	Dim = "\x1b[2m",
	Underscore = "\x1b[4m",
	Blink = "\x1b[5m",
	Reverse = "\x1b[7m",
	Hidden = "\x1b[8m",

	FgBlack = "\x1b[30m",
	FgRed = "\x1b[31m",
	FgGreen = "\x1b[32m",
	FgYellow = "\x1b[33m",
	FgBlue = "\x1b[34m",
	FgMagenta = "\x1b[35m",
	FgCyan = "\x1b[36m",
	FgWhite = "\x1b[37m",

	BgBlack = "\x1b[40m",
	BgRed = "\x1b[41m",
	BgGreen = "\x1b[42m",
	BgYellow = "\x1b[43m",
	BgBlue = "\x1b[44m",
	BgMagenta = "\x1b[45m",
	BgCyan = "\x1b[46m",
	BgWhite = "\x1b[47m",
};

export interface Library {
	name:string;
	version:string;
	dynamic?:boolean;
	static?:boolean;
};
export enum Platform {
	WIN = "win32",
	UWP = "uwp",
	LNX = "linux",
	AND = "android",
	MAC = "darwin",
	IOS = "ios",
	IOS_EMU = "iosemu",
	WEB = "web",
};
export enum Arch {
	X32 = "x32",
	X64 = "x64",
	ARM = "arm",
	A64 = "arm64",
	WASM = "wasm",
};
export enum BuildMode {
	DEBUG = "debug",
	RELEASE = "release",
	RELEASE_LITTLER = "release-min",
	RELEASE_FASTER = "release-fast",
	RELEASE_MIN_OPTMIZE = "release-0",
	RELEASE_MAX_OPTMIZE = "release-3",
};
export enum win_Runtime {
	ANY = 0,
	MT_RELEASE,
	MT_DEBUG,
	MT_X,
	MD_RELEASE,
	MD_DEBUG,
	MD_X,
}
export enum uwp_SDKVersion {
	SDK_8 = "8.0",
	SDK_8_1 = "8.1",
	SDK_10 = "10.0",
};
export enum win_SpectreMitigation {
	ANY = 0,
	SM_ENABLED,
	SM_DISABLED,
}

export interface Target {
	platform:Platform,
	arch:Arch,
}
export function Target_join(x:Target):string {
	return x.platform + '-' + x.arch;
}
export function Target_split(x:string):Target {
	var i = x.lastIndexOf('-');
	var arch = x.substr(i+1) as Arch;
	if (i < 0) i = 0;
	var platform = x.substr(0, i) as Platform;
	return {platform, arch};
}
export class TargetBuild {
	target:Target;
	mode:BuildMode = BuildMode.DEBUG;

	win_runtime:win_Runtime = win_Runtime.ANY;
	win_spectreMitigation:win_SpectreMitigation = win_SpectreMitigation.ANY;
	mac_bundleGUI:string = "";
	uwp_sdk:uwp_SDKVersion = uwp_SDKVersion.SDK_10;
	and_sdk:string = "24";

	constructor(target:Target) {
		this.target = target;
	}
};
export class Tool {
	name:string;
	found:boolean = false;
	props:Map<string,string> = new Map<string,string>();
	constructor(name:string) {
		this.name = name;
	}
	save() {
		var file_path = path.resolve(cacheDirMeta, this.name+".json");
		files.mkdir_recursive(path.resolve(file_path, '..'));
		fs.writeFileSync(file_path, JSON.stringify({found:this.found, props:this.props},
			(key, value)=>{
				if(value instanceof Map)
					return {
						dataType: 'Map',
						value: Array.from(value.entries()),
					};
				else
					return value;
			}, "\t"), );
	}
	try_load(valid_ms:number):boolean {
		var file_path = path.resolve(cacheDirMeta, this.name+".json");
		if (!fs.existsSync(file_path) || fs.statSync(file_path).mtimeMs + valid_ms < Date.now())
			return false;
		try {
			var t = JSON.parse(
				fs.readFileSync(file_path, 'utf-8'),
				(key, value)=>{
					if(typeof value === 'object' && value !== null && value.dataType === 'Map')
						return new Map(value.value);
					return value;
				}
			);
			if (t.found !== undefined && t.props) {
				this.found = t.found;
				this.props = t.props;
				return true;
			}
		} catch (e) { }
		return false;
	}
};
export var cacheDir = path.resolve(__dirname,'../cache');
export var cacheDirMeta = path.resolve(__dirname,'../cache/meta', process.platform);
export var cacheDirDownload = path.resolve(__dirname,'../cache/download');
export var cacheDirSource = path.resolve(__dirname,'../cache/source');
export var cacheDirBuild = path.resolve(__dirname,'../cache/build');

var _tmp = path.resolve(os.tmpdir(),'.cct_cache');
export var tcacheDir = _tmp;
export var tcacheDirMeta = path.resolve(_tmp,'meta', process.platform);
export var tcacheDirDownload = path.resolve(_tmp,'download');
export var tcacheDirSource = path.resolve(_tmp,'source');
export var tcacheDirBuild = path.resolve(_tmp,'build');

function testCacheSymlink(local:string):boolean {
	var lresult = path.resolve(local, 'symtest.txt');
	var link = path.resolve(local, 'symtest');
	if (fs.existsSync(lresult))
		return fs.readFileSync(lresult, 'utf-8') == "true";
	var test = true;
	try { fs.symlinkSync('/test', link); } catch(e) { test = false; }
	if (fs.existsSync(link))
		fs.unlinkSync(link);
	fs.writeFileSync(lresult, test?'true':'false');
	return test;
}

export var cacheSupportSymlink = testCacheSymlink(cacheDir);