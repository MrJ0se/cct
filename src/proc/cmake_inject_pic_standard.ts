import * as fs from 'fs';
import * as path from 'path';


export const lineCMakeArgs = [
	'-DCMAKE_CXX_STANDARD_REQUIRED=ON',
	'-DCMAKE_CXX_STANDARD=14',
	'-DCMAKE_C_STANDARD_REQUIRED=ON',
	'-DCMAKE_C_STANDARD=14',
	'-DCMAKE_POSITION_INDEPENDENT_CODE=ON'
];
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
	[
		'set(CMAKE_CXX_STANDARD_REQUIRED ON)',
		'set(CMAKE_CXX_STANDARD 14)',
		'set(CMAKE_C_STANDARD_REQUIRED ON)',
		'set(CMAKE_C_STANDARD 11)',
		'set(CMAKE_POSITION_INDEPENDENT_CODE ON)',
	].forEach((word)=>{
		var index = content.indexOf(word);
		if (index < 0 || index > 4000)
			content = word + '\n' + content;
	});
	return content;
}