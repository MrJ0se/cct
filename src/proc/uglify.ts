import * as uglify from "uglify-js";
import * as path from 'path';
import * as fs from 'fs';


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
		if (path.extname(x) == ".js")
			file(x);
	});
}
function file(p:string) {
	console.log("running on file: "+p);
	var res = uglify.minify(fs.readFileSync(p,'utf-8'));
	if (res.error) {
		console.error("on file: "+p);
		console.log(res.error);
		return;
	}
	fs.writeFileSync(p, res.code);
}