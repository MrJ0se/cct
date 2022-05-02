import * as fs from 'fs';
import * as path from 'path';
import * as def from '../def';

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
	var content2 = apply(content, fp);
	if (content2 != content)
		fs.writeFileSync(fp, content);
}
export function apply(content:string, fp:string):string {
	var fake_cpp = path.resolve(fp,'../fake.c');
	if (!fs.existsSync(fake_cpp))
		fs.writeFileSync(fake_cpp, '');

	if (content.indexOf('macro(add_executable x)') < 0) {
		content =
`set(FAKE_CPP_PATH \${CMAKE_CURRENT_LIST_DIR}/fake.c)
macro(add_executable x)
  add_library(\${x} STATIC \${FAKE_CPP_PATH})
  #set_target_properties(\${x} PROPERTIES LINKER_LANGUAGE C)
  set_target_properties(\${x} PROPERTIES PREFIX "__ignore__")
endmacro()
`+content;
	}
	return content;
}