import * as fs from 'fs';
import * as path from 'path';
import * as files from './u/files';
import * as exec from './u/exec';

export interface Board {
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

export function getBoards (ide_path:string):Board[] {
	var btxt = path.resolve(ide_path,"hardware/arduino/avr/boards.txt");
	if (!fs.existsSync(btxt))
		throw "Cant found boards.txt in IDE path: "+ide_path;
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
		if (name == null)
			return null;

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
				id,
				name,

				upload_protocol,
				upload_max_size,
				upload_max_data_size,
				upload_speed,

				build_mcu,
				build_fcpu,
				build_variant
			};
		return null;
	}).filter((x)=>x!=null);
}
export function setup(ide_path:string, x:Board) {
	ide_path = path.resolve(ide_path);

	var ptxt = path.resolve(__dirname, "../cache/arduino_cmake.txt");
	var pjson = path.resolve(__dirname, "../cache/arduino.json");
	files.mkdir_recursive(path.resolve(__dirname, "../cache"));

	fs.writeFileSync(ptxt,
`${ide_path}
${x.build_mcu}
${x.build_fcpu}
${x.build_variant}`
	);
	fs.writeFileSync(pjson, JSON.stringify({ide:ide_path, board:x}));
}

export class ArduinoTools {
	board:Board;
	ide:string;
	constructor() {
		var data = JSON.parse(
			fs.readFileSync(
				path.resolve(__dirname, "../cache/arduino.json"),
				'utf-8'
			)
		);
		this.board = data.board as Board;
		this.ide = data.ide as string;
	}
	async extractEEPROM(inputfile:string, outputfile:string):Promise<void> {
		var cmd = path.resolve(this.ide,'hardware/tools/avr/bin/avr-objcopy')+` -O ihex -R .eeprom "${inputfile}" ${outputfile}`;
		var code = await exec.execPipedVerbose(cmd, path.resolve('.'));
		if (code != 0)
			throw "failed";
	}
	async getHexByteCount(hexfile:string):Promise<number> {
		var len = 0;
		var data = fs.readFileSync(hexfile, "utf-8");
		var i = 0;
		while (true) {
			i = data.indexOf(':', i);
			if (i < 0) break;
			if (data.substr(i+1+6,2) == "00")
				len += parseInt(data.substr(i+1,2), 16);
			i++;
		}
		return len;
	}
	async uploadEEPROM(hexfile:string, port:string) {
		var cmd = path.resolve(this.ide,'hardware/tools/avr/bin/avrdude')+` -C${path.resolve(this.ide, 'hardware/tools/avr/etc/avrdude.conf')} -v -p${this.board.build_mcu} -c${this.board.upload_protocol} -b${this.board.upload_speed} -P${port} -D -Uflash:w:${hexfile}:i`
		var code = await exec.execPipedVerbose(cmd, path.resolve('.'));
		if (code != 0)
			throw "failed";
	}
}