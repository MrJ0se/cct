import * as fs from 'fs';
import * as path from 'path';
import * as files from './u/files';
import * as exec from './u/exec';

//@ts-ignore
const exesuffix = {
	"linux":"",
	"darwin":"",
	"win32":".exe"
}[process.platform] as string;

export interface ToolsPaths {
	avrTool:string,
	avrArduino:string,
	esp:string,
}

export var packagePath:null|ToolsPaths = null;
export var currentBoard:null|Board = null;
{
	let ardconf = path.resolve(__dirname, "../arduino_ide.json");
	if (fs.existsSync(ardconf)) {
		try {
			packagePath = JSON.parse(fs.readFileSync(ardconf, 'utf-8'))[process.platform];
		} catch(e) {}
	}
	let boardconf = path.resolve(__dirname, "../cache/board.json");
	if (fs.existsSync(boardconf)) {
		try {
			currentBoard = JSON.parse(fs.readFileSync(boardconf, 'utf-8'));
		} catch(e) {}
	}
}
export enum BoardPackage {
	AVR = "AVR",
	ESP8266 = "ESP8266",
}
export interface Board {
	package:BoardPackage,
	label:string
}

export interface AVRBoard {
	//<extends>
	package:BoardPackage,
	label:string
	//</extends>

	id:string,
	name:string,

	upload_protocol:string,
	upload_max_size:string,
	upload_max_data_size?:string,
	upload_speed:string,

	build_mcu:string,
	build_fcpu:string,
	build_variant:string,
}

export function AVRGetBoards ():AVRBoard[] {
	if (packagePath == null)
		return [];
	var btxt = path.resolve(packagePath.avrArduino,"boards.txt");
	if (!fs.existsSync(btxt))
		throw "Cant found boards.txt in IDE path: "+packagePath.avrArduino;
	var configs = fs.readFileSync(btxt, 'utf-8')
		.replace(/(\r)/g,'').split('\n')
		.map((x)=>x.trim())
		.filter((x)=>x.length>0&&x.substr(0,1)!='#'&&x.indexOf('=')>0)
		.map((x)=>x.split('='));
	var boards_id:string[] = [];
	{
		configs.map((x)=>x[0].substr(0, x[0].indexOf('.')))
			.filter((x, i, boards)=>boards.indexOf(x) == i)
			.forEach((x)=>{
				var cpus = configs.filter((y)=>y[0].indexOf(x+'.menu.cpu.') == 0)
					.map((y)=>{
						var y_name = y[0].substr((x+'.menu.cpu.').length);
						return y_name.substr(0, y_name.indexOf('.'));
					})
					.filter((x, i, cpus)=>cpus.indexOf(x) == i)
				if (cpus.length > 0)
					cpus.forEach((cpu)=>{
						boards_id.push(x+'.'+cpu);
					});
				else
					boards_id.push(x);
			});
	}
	function getProp(x:string) {
		var y = configs.find((n)=>n[0]==x);
		if (y) return y[1];
	}
	//@ts-ignore
	return boards_id.map((id)=>{
		var flags = id.split('.');
		var name = getProp(flags[0]+".name");
		if (name == null) return null;

		var upload_protocol = getProp(flags[0]+".upload.protocol");
		var upload_max_size = getProp(flags[0]+".upload.maximum_size");
		var upload_max_data_size = getProp(flags[0]+".upload.maximum_data_size");
		var upload_speed = getProp(flags[0]+".upload.speed");

		var build_mcu = getProp(flags[0]+".build.mcu");
		var build_fcpu = getProp(flags[0]+".build.f_cpu");
		var build_variant = getProp(flags[0]+".build.variant");

		if (flags[1]) {
			name += " -> "+flags[1];

			var temp = getProp(flags[0]+".menu.cpu."+flags[1]+".upload.protocol");
			if (temp) upload_protocol = temp;
			temp = getProp(flags[0]+".menu.cpu."+flags[1]+".upload.maximum_size");
			if (temp) upload_max_size = temp;
			temp = getProp(flags[0]+".menu.cpu."+flags[1]+".upload.maximum_data_size");
			if (temp) upload_max_data_size = temp;
			temp = getProp(flags[0]+".menu.cpu."+flags[1]+".upload.speed");
			if (temp) upload_speed = temp;


			temp = getProp(flags[0]+".menu.cpu."+flags[1]+".build.mcu");
			if (temp) build_mcu = temp;
			temp = getProp(flags[0]+".menu.cpu."+flags[1]+".build.f_cpu");
			if (temp) build_fcpu = temp;
			temp = getProp(flags[0]+".menu.cpu."+flags[1]+".build.variant");
			if (temp) build_variant = temp;
		}


		if (upload_protocol && upload_max_size && upload_speed && build_mcu && build_fcpu && build_variant)
			return {
				package:BoardPackage.AVR,
				label:id,

				id,
				name,

				upload_protocol,
				upload_max_size,
				upload_max_data_size,
				upload_speed,

				build_mcu,
				build_fcpu,
				build_variant
			} as AVRBoard;
		return null;
	}).filter((x)=>x!=null);
}
export async function AVRExtractEEPROM(inputfile:string, outputfile:string):Promise<void> {
	if (packagePath == null) return;
	var cmd = path.resolve(packagePath.avrTool, 'bin/avr-objcopy')+` -O ihex -R .eeprom "${inputfile}" ${outputfile}`;
	var code = await exec.execPipedVerbose(cmd, path.resolve('.'));
	if (code != 0)
		throw "failed";
}
export async function AVRUploadEEPROM(hexfile:string, port:string):Promise<void> {
	if (packagePath == null) return;
	var y = currentBoard as AVRBoard;
	var cmd = path.resolve(packagePath.avrTool, 'bin/avrdude')+` -C${path.resolve(packagePath.avrTool, 'etc/avrdude.conf')} -v -p${y.build_mcu} -c${y.upload_protocol} -b${y.upload_speed} -P${port} -D -Uflash:w:${hexfile}:i`
	var code = await exec.execPipedVerbose(cmd, path.resolve('.'));
	if (code != 0)
		throw "failed";
}
export async function AVRSetBoard(y:AVRBoard):Promise<void> {
	if (packagePath == null) return;
	var ptxt = path.resolve(__dirname, "../cache/embed_cmake.txt");
	var pjson = path.resolve(__dirname, "../cache/board.json");
	files.mkdir_recursive(path.resolve(__dirname, "../cache"));
	fs.writeFileSync(ptxt,
`AVR
${packagePath.avrTool}
${packagePath.avrArduino}
${y.build_mcu}
${y.build_fcpu}
${y.build_variant}`
	);
	fs.writeFileSync(pjson, JSON.stringify(y));
}



