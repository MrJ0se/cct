import * as fs from 'fs';
import * as path from 'path';

export async function main (...args:string[]) {
	var args = args.map((v)=>path.resolve(v));
	for (var i = 0; i < args.length; i++) {
		var p = path.resolve(args[i]);
		if (!fs.existsSync(p)) {
			console.log('[fail] '+p);
			continue;
		}
		if (fs.lstatSync(p).isDirectory())
			folder(p);
		else 
			file(p);
	}
}
function folder (p:string) {
	fs.readdirSync(p).forEach((x) =>{
		x = path.resolve(p, x);
		if (fs.lstatSync(x).isDirectory()) {
			folder(x);
			return;
		}
		if (path.extname(x) == ".cmake" || path.basename(x) == "CMakeLists.txt")
			file(x);
	});
}
function file(fp:string) {
	var content = fs.readFileSync(fp, 'utf-8');
	var content2 = apply(content);
	if (content2 != content)
		fs.writeFileSync(fp, content);
}
export function apply(content:string):string {
	while (true) {
		var i = content.indexOf("install(");
		if (i < 0)
			break;
		var i2 = content.indexOf(')', i);
		if (i2 < 0)
			break;
		content = content.substr(0, i) + content.substr(i2+1);
	}
	return content;
}