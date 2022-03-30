import * as fs from 'fs';
import * as path from 'path';
import * as def from '../def';

export async function main (runtime:def.win_Runtime, ...files:string[]) {
	if (runtime == def.win_Runtime.ANY)
		return;
	var args = files.map((v)=>path.resolve(v));
	for (var i = 0; i < args.length; i++) {
		var p = path.resolve(args[i]);
		if (!fs.existsSync(p)) {
			console.log('[fail] '+p);
			continue;
		}
		if (fs.lstatSync(p).isDirectory())
			folder(runtime, p);
		else
			file(runtime, p);
	}
}
function folder (runtime:def. win_Runtime,p:string) {
	fs.readdirSync(p).forEach((x) =>{
		x = path.resolve(p, x);
		if (fs.lstatSync(x).isDirectory()) {
			folder(runtime, x);
			return;
		}
		if (path.extname(x) == ".vcxproj")
			file(runtime, x);
	});
}
function file (runtime:def.win_Runtime, fp:string) {
	var content = fs.readFileSync(fp, 'utf-8');
	var needsv = false;

	var r = "";
	var d = "";
	switch (runtime) {
	case def.win_Runtime.MD_DEBUG:
		r = 'MultiThreadedDebugDLL';
		break;
	case def.win_Runtime.MD_RELEASE:
		r = 'MultiThreadedDLL';
		break;
	case def.win_Runtime.MD_X:
		r = 'MultiThreadedDLL';
		d = 'MultiThreadedDebugDLL';
		break;
	case def.win_Runtime.MT_DEBUG:
		r = 'MultiThreadedDebug';
		break;
	case def.win_Runtime.MT_RELEASE:
		r = 'MultiThreaded';
		break;
	case def.win_Runtime.MT_X:
		r = 'MultiThreaded';
		d = 'MultiThreadedDebug';
		break;
	}
	if (d == "")
		d = r;
	r = '<RuntimeLibrary>'+r+'</RuntimeLibrary>';
	d = '<RuntimeLibrary>'+d+'</RuntimeLibrary>';
	[
		['<RuntimeLibrary>MultiThreadedDLL</RuntimeLibrary>',r],
		['<RuntimeLibrary>MultiThreadedDebugDLL</RuntimeLibrary>',d],
		['<RuntimeLibrary>MultiThreaded</RuntimeLibrary>',r],
		['<RuntimeLibrary>MultiThreadedDebug</RuntimeLibrary>',d],
	]
	.filter((x)=>x[0] != r && x[0] != d)
	.forEach((rep_word)=>{
		while (true) {
			var i = content.indexOf(rep_word[0]);
			if (i < 0)
				break;
			content = content.substr(0, i) + rep_word[1] + content.substr(i + rep_word[0].length);
			needsv = true;
		}
	});

	if (needsv)
		fs.writeFileSync(fp, content);
}