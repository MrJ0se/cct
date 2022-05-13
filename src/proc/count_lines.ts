import * as path from "path";
import * as fs from "fs";

function joinMaps(x:Map<string, number>, y:Map<string, number>):Map<string, number> {
	for (let key of y.keys()) {
		var vt = (y.get(key) as number);
		var vb = x.get(key);
		if (vb)
			x.set(key, vb + vt);
		else
			x.set(key, vt);
	}
	return x;
}
function add(x:Map<string, number>, k:string, v:number):Map<string, number> {
	var old = x.get(k);
	if (old)
		x.set(k, v + old);
	else
		x.set(k, v);
	return x;
}
var pexts = new Map<string,string>([
	[".cpp","C++"],
	[".cc","C"],
	[".c","C"],
	[".h","C/C++/OC Header"],
	[".hpp","C/C++/OC Header"],
	[".kt","Kotlin"],
	[".java","Java"],
	[".ts","TypeScript"],
	[".js","JavaScript (transpile to JS)"],
	[".cmake","CMake build system"],
	[".md","Markup"],
	[".htm","HTML"],
	[".html","HTML"],
	[".css","CSS"],
	[".sass","SASS (transpile to CSS)"],
	[".less","LESS (transpile to CSS)"],
	[".txt","TXT"],
	[".go","GOLang"],
	[".sql","SQL"],
	[".json","JSON"],
	[".hjson","Human JSON (hjson)"],
	[".xml","XML"],
	[".gradle","Gradle build system"],
	[".bat","Batch"],
	[".sh","Bash"],
	[".bash","Bash"],
	[".ksh","Bash"],
	[".zsh","Bash"],
	[".csh","Bash"],
	[".tcsh","Bash"],
	[".bash","Bash"],
	[".py","Python"],
	[".pl","Perl"],
	[".plx","Perl"],
	[".php","PHP"],
	[".rb","Ruby"],
	[".ps1","PowerShell"],
	[".cs","C#"],
	[".lua","Lua"],
	[".cob","COBOL"],
	[".cpy","COBOL"],
	[".swift","Swift"],
	[".pas","Pascal"],
	[".pp","Pascal"],
	[".rs","Rust"],
	[".asm","Assembly"],
	[".vb","Visual Basic"],
	[".vbs","Visual Basic Script"],
	[".m","Objective C"],
	[".mm","Objective C++"],
]);
var pfullname = new Map<string,string>([
	["CMakeLists.txt","CMake"],
	[".gitignore","GIT"],
	[".gitattributes","GIT"]
]);
var pcount = new Map<string,string>([
	[".so","SO Unix Shared Library"],
	[".a","A Unix Static Library"],
	[".lib","LIB Windows Static Library"],
	[".dll","DLL Windows Shared Library BIN"],
	[".exe","EXE Windows Executable"],
	[".pdb","PDB Windows Debug Information"],
	[".apk","APK Android Package"],
	[".aab","AAB Android Package"],
	[".aar","AAR Android DEV Library"],
	[".jar","JAR Java Bytecode"],
	[".psd1","PowerShell"],
	[".psm1","PowerShell"],
	[".rlib","Rust Library"],
	[".wasm","WASM Bytecode"],
]);
var pmedia = new Map<string,string>([
	[".jpg","JPEG image"],
	[".webp","WEBP image"],
	[".png","PNG image"],
	[".gif","GIF image"],
	[".mp4","MP4 video"],
	[".webm","WEBM video"],
	[".mkv","MKV video"],
	[".avi","AVI video"],
	[".wmv","WMV video"],
	[".mp3","MP3 audio"],
	[".wav","WAV audio"],
]);
var pexcludename = [
	"node_modules",
	"node_modulesw",
	"node_modulesl",
	".git",
	"bin",
	"b",
	"CMakeFiles",
	".idea",
	".gradle",
	"build",
	"ext",
	"package-lock.json",
	"document",
	"cache"
];
export function count(localpath:string):Map<string, number> {
	var r = new Map<string, number>([["files",0],["media files",0],["folders",0]]);

	fs.readdirSync(localpath).filter((x)=>x!="."&&x!="..").forEach(file => {
		file = path.resolve(localpath, file);
		var basename = path.basename(file);
		if (pexcludename.find((x)=>x==basename) != null)
			return;

		var stat = fs.lstatSync(file);
		if (stat.isFile()) {
			r = add(r, "files", 1);
			//core
			var extension = path.extname(file).toLowerCase();
			var type = pexts.get(extension);
			if (type == null)
				type = pfullname.get(basename)

			if (type) {
				r = add(r, "files - "+type, 1);
				var txt = fs.readFileSync(file, "utf-8");
				var l = 0;
				var oid = 0;
				do {
					l++;
					oid = txt.indexOf("\n",oid+1);
				} while (oid >= 0)
				r = add(r, "lines - "+type, l);
			} else {
				type = pmedia.get(extension);
				if (type) {
					r = add(r, "media files", 1);
					r = add(r, "files - "+type, 1);
				} else {
					type = pcount.get(extension);
					if (type)
						r = add(r, "files - "+type, 1);
				}
			}
			//end core
		} else if (stat.isDirectory()) {
			r = add(r, "folders", 1);
			r = joinMaps(r, count(file));
		}
	});

	return r;
}
export function toPrint(x:Map<string, number>):string {
	var r = "Code Statistics:\n";
	for (let key of x.keys())
		r += "	"+key+": "+(x.get(key) as number)+"\n";
	return r;
}
