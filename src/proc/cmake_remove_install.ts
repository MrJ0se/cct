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
	var needsv = false;

	while (true) {
		var i = content.search(/install(\s*\t*\n*)*\(/g);
		if (i == -1)
			break;
		var i2 = content.indexOf(')', i);
		if (i2 == -1)
			break;
		content = content.substr(0, i) + content.substr(i2+1);
		needsv = true;
	}

	if (needsv)
		fs.writeFileSync(fp, content);
}