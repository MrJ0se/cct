import * as UI from '../u/console_ui';
import {createCBwith} from './util';
import * as embed from '../embed';
import * as fs from 'fs';
import * as path from 'path';
import * as def from '../def';

export async function setup(args:string[], offset:number) {
	var form = new UI.Form();
	form.add(
		(new UI.Element()).setLabel("Setup embed compiler assistent")
	);
	if (embed.currentBoard)
		form.add(
			(new UI.Element()).setLabel("Current board: <"+embed.currentBoard.label+"> from <"+embed.currentBoard.package+">")
		);
	var avr_boards = embed.AVRGetBoards();
	if (avr_boards.length > 0) {
		var cb_avr = createCBwith(' AVR board', avr_boards.map((x)=>x.label), avr_boards[0].label);

		form.add(
			cb_avr,
			(new UI.Element()).setButton("Set AVR").setAction(async ()=>{
				form.close();
				if (cb_avr.itemSelected)
					await embed.AVRSetBoard(avr_boards[cb_avr.itemSelected]);
			}),
		);
	}

	form.add(
		(new UI.Element()).setButton("Cancel").setAction(async ()=> form.close())
	);

	await form.run();
	console.log("...");
}
export async function load(args:string[], offset:number) {
	if (embed.currentBoard == null) {
		console.log("no board selected");
		return;
	}
	var programs = fs.readdirSync('.').filter((x)=>path.extname(x)=='.elf');

	if (programs.length == 0) {
		console.log("cant found any program (.elf) in current folder");
		return;
	}
	var form = new UI.Form();

	var cb_programs = createCBwith(' AVR board', programs, programs[0]);
	//console.log('in linux: "dmesg | grep tty" to get ports, commonly: "/dev/ttyUSB0"');
	var cb_serials = createCBwith(' Serial port', ['/dev/ttyUSB0'], '/dev/ttyUSB0');

	var flashit = false;

	form.add(
		(new UI.Element()).setLabel("Flash board assistent"),
		cb_programs,
		cb_serials,
		(new UI.Element()).setButton("Flash").setAction(async ()=>{
			flashit = true;
			form.close();
		}),
		(new UI.Element()).setButton("Cancel").setAction(async ()=> form.close())
	);

	await form.run();
	console.log("...");

	if (flashit && embed.currentBoard) {
		console.log(embed.currentBoard);
		if (embed.currentBoard.package == embed.BoardPackage.AVR) {
				console.log("unpacking ELF...");
				var program = (cb_programs.items as string[])[cb_programs.itemSelected as number];
				var serial = (cb_serials.items as string[])[cb_serials.itemSelected as number];
				var hex = path.resolve(def.cacheDir,'arduino_program.hex');
				await embed.AVRExtractEEPROM(program, hex);
				console.log("flashing AVR...");
				await embed.AVRUploadEEPROM(hex, serial);
				process.exit();
			}
	}
}