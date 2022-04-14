import * as UI from './u/console_ui';
import * as ciu from './ci/util';
import * as files from './u/files';
import * as def from './def';
import * as fs from 'fs';
import * as path from 'path';

import {execute as cmake_exec} from './ci/cmake';
import {execute as tools_exec} from './ci/tools';
import {execute as import_exec} from './ci/import';
import {runTestServer} from './u/wasm_server';
import * as counter from './proc/count_lines';
import * as ardu from './arduino';

interface Opt {
	long:string,
	short:string,
	desc:string
	next?:(args:string[], offset:number)=>Promise<void>;
}
const opts:Opt[] = [
	{long:"cmake",short:"c",desc:"Compile with CMake",next:cmake_exec},
	{long:"set_apple_team_id",short:"set_team_id",desc:"Set Apple Team ID",next:async(args:string[], offset:number)=>{
		var team_id = args[offset];
		if (team_id == null)
			team_id = await UI.getline("team id:", true);
		fs.writeFileSync(path.resolve(def.cacheDir, 'ios_dev_team.txt'), team_id);
	}},
	{long:"import",short:"i",desc:"Import library ",next:import_exec},
	{long:"tool",short:"t",desc:"Search tool",next:tools_exec},
	{long:"purge-meta",short:"pm",desc:"Purge meta data of CCT cache",next:async()=>{
		files.remove_recursive(def.cacheDirMeta);
	}},
	{long:"webserver",short:"ws",desc:"Web Server for test wasm modules",next:async(args:string[], offset:number)=>{
		var modulename = args[offset];
		if (modulename == null)
			modulename = await UI.getline("module name:", true);
		runTestServer(modulename);
		modulename = modulename.replace('.js','');
		//keep running server
		await new Promise(()=>{});
	}},
	{long:"arduino-setup",short:"as",desc:"Setup a arduino CMake variables, for a specific board",next:async(args:string[], offset:number)=>{
		var ard_ide = args[offset];
		if (ard_ide == null)
			ard_ide = await UI.getline("arduino IDE path:", true);
		var boards = ardu.getBoards(ard_ide);
		console.log('found boards:\n'+boards.map((x)=>`\t${x.name} (${x.id})\n`).join(""));
		var ard_board = args[offset+1];
		if (ard_board == null)
			ard_board = await UI.getline("arduino board id:", true);
		var board = boards.find((x)=>x.id == ard_board);
		if (board == null)
			throw "invalid arduino board";
		ardu.setup(ard_ide, board);
	}},
	{long:"arduino-write",short:"aw",desc:"Write program to arduino board",next:async(args:string[], offset:number)=>{
		var ard_ide = args[offset];
		if (ard_ide == null)
			ard_ide = await UI.getline("program path:", true);
		var tools = new ardu.ArduinoTools();
		var hex = path.resolve(def.cacheDir,'arduino_program.hex');
		await tools.extractEEPROM(ard_ide, hex);
		var size = await tools.getHexByteCount(hex);
		var maxsize = parseInt(tools.board.upload_max_size);
		console.log(`Program size: ${size} / ${maxsize} (%${size*100/maxsize})`);
		if (size > maxsize)
			throw "program large than target memory";

		console.log('in linux: "dmesg | grep tty" to get ports, commonly: "/dev/ttyUSB0"');
		var port = args[offset+1];
		if (port == null)
			port = await UI.getline("port to write:", true);
		console.log('execute next line with sudo:')
		await tools.uploadEEPROM(hex, port);
	}},
	{long:"arduino-cmake-complete",short:"acc",desc:"Generate a CMake line to enable autocomplete",next:async()=>{
		console.log(`option(ARD_AUTO_COMPLETE "enable auto complete" ON)\nif(ARD_AUTO_COMPLETE)\ninclude(${path.resolve(__dirname, "../rsc/arduino/EasyClangComplete.cmake")})\nendif()`);	
	}},
	{long:"countlines",short:"ct",desc:"Gen statics about files under folder and subfolders",next:async(args:string[], offset:number)=>{
		console.log(counter.toPrint(counter.count(path.resolve("."))));
	}},
	{long:"help",short:"h",desc:"show help resume of cct",next:async(args:string[], offset:number)=>{
		console.log(fs.readFileSync(path.resolve(__dirname, '../rsc/help.txt'),'utf-8'));
	}},
];

main(Array.from(process.argv).slice(2));
async function main (args:string[]) {
	if (args.length == 0)
		args = ["?"];
	if (args[0] == "?") {
		var form = new UI.Form();
		form.add(
			(new UI.Element()).setLabel(
				ciu.destacArgument(args, 0, 1)+"\ncomplete arguments with a command:"
			),
			...opts.map((x)=>{
				return (new UI.Element()).setButton(`${x.short}|${x.long} : ${x.desc}`).setAction(async ()=>{
					args[0] = x.short;
					form.close()
				});
			})
		);
		await form.run();
		console.clear();
	}
	var sel = opts.find((x)=>x.short == args[0] || x.long == args[0]);
	if (sel) {
		if (sel.next)
			await sel.next(args, 1);
	} else {
		console.log("Invalid argument:");
		console.log(ciu.destacArgument(args, 0, 1));
	}
	process.exit(0);
}