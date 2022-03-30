import * as def from '../def';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as files from './files';

export enum EType {
	LABEL,
	INPUT,
	COMBOBOX,
	CHECKBOX,
	BUTTON,
};
export class Element {
	bl:boolean = true;
	text:string = "";
	type:EType = EType.LABEL;

	color?:def.ColorCode;

	placeholder?:string;

	items?:string[];
	itemSelected?:number;

	checked?:boolean;

	onAction?:()=>Promise<void>;

	setBL(x:boolean) {
		this.bl = x;
		return this;
	}
	setLabel(text:string, color?:def.ColorCode) {
		this.type = EType.LABEL;
		this.text = text;
		this.color = color;
		return this;
	}
	setInput(text:string, placeholder?:string) {
		this.type = EType.INPUT;
		this.text = text;
		this.placeholder = placeholder;
		return this;
	}
	setCombobox(text:string, items?:string[], def?:number) {
		this.type = EType.COMBOBOX;
		this.text = text;
		this.items = items;
		this.itemSelected = def;
		return this;
	}
	setCheckBox(text:string, checked?:boolean) {
		this.type = EType.CHECKBOX;
		this.text = text;
		this.checked = checked;
		return this;
	}
	setButton(text:string) {
		this.type = EType.BUTTON;
		this.text = text;
		return this;
	}
	setAction(action:()=>Promise<void>) {
		this.onAction = action;
		return this;
	}
	render(focused:boolean):string {
		switch (this.type) {
		default:
			if (this.color)
				return this.color+this.text+def.ColorCode.Reset;
			else
				return this.text;
		case EType.INPUT:
			var r = "[";
			var spaces_fill = this.text.length;
			if (this.text == "" && this.placeholder) {
				spaces_fill = this.placeholder.length;
				r += def.ColorCode.FgYellow+this.placeholder;
				if (spaces_fill > 50) {
					var dif = spaces_fill - 50;
					r = r.substr(0, r.length - dif - 3) + "...";
				} 
				r += (focused?def.ColorCode.FgWhite:def.ColorCode.Reset);
			} else {
				r += def.ColorCode.FgGreen+this.text;
				if (spaces_fill > 50) {
					var dif = spaces_fill - 50;
					r = r.substr(0, r.length - dif - 3) + "...";
				} 
				r += (focused?def.ColorCode.FgWhite:def.ColorCode.Reset);
			}
			while (spaces_fill++ < 50)
				r += ' ';
			if (focused)
				return def.ColorCode.FgCyan+r+def.ColorCode.FgCyan+']'+def.ColorCode.Reset;
			return r+']'+def.ColorCode.Reset;
		case EType.CHECKBOX:
			var r = this.text;
			if (focused)
				r = def.ColorCode.FgCyan+r+def.ColorCode.Reset;
			if (this.checked)
				r += def.ColorCode.FgGreen+'[X]'+def.ColorCode.Reset;
			else
				r += def.ColorCode.FgYellow+'[ ]'+def.ColorCode.Reset;
			return r;
		case EType.COMBOBOX:
			var r = this.text;
			if (focused)
				r = def.ColorCode.FgCyan+r+def.ColorCode.Reset;
			r+= ": ";
			if (this.items ) {
				var i = this.itemSelected?this.itemSelected:0;
				if (i >= this.items.length)
					return r;
				var ci = this.items[i];
				var side_sz = (50 - (this.text.length + 2))/2 - (ci.length/2);
				ci = def.ColorCode.FgGreen+ci+def.ColorCode.Reset;
				var pre = " ";
				var pos = " "
				var pi = i;
				while (pre.length < side_sz) {
					pi--;
					if (pi < 0) pi = this.items.length-1;
					pre = this.items[pi] + ' ' + pre;
				}
				pre = pre.substr(pre.length - side_sz);
				pi = i;
				while (pos.length < side_sz) {
					pi++;
					if (pi >= this.items.length) pi = 0;
					pos += ' ' + this.items[pi];
				}
				pos = pos.substr(0, side_sz);

				r += "<" + pre + ci + pos + ">";
			}
			return r;
		case EType.BUTTON:
			if (focused)
				return  def.ColorCode.FgCyan+"<< "+this.text+" >>"+def.ColorCode.Reset;
			return "<< "+this.text+" >>";
		}
	}
	async keyPress(key:string){
		switch (this.type) {
		default:
		case EType.INPUT:
			if (key.charCodeAt(0) == 13) {//enter
				var k = await getline(`Edit Value (send " "(space) to cancel edition)\n  old: "${this.text}"(${this.text.length})\n  new: `);
				if (k != ' ') {
					this.text = k;
					if (this.onAction)
						await this.onAction();
				}
			}
			return;
		case EType.CHECKBOX:
			if (key.charCodeAt(0) == 13) {//enter
				this.checked = (this.checked != true);
				if (this.onAction)
					await this.onAction();
			}
			return;
		case EType.COMBOBOX:
			if (this.items) {
				var i = this.itemSelected?this.itemSelected:0;
				if (key == '\u001B\u005B\u0044') {//left
					i--;
					if (i < 0) i = this.items.length - 1;
				} else if (key == '\u001B\u005B\u0043') {//rigth
					i++;
					if (i >= this.items.length) i = 0;
				} else return;
				this.itemSelected = i;
				if (this.onAction)
					await this.onAction();
			}
			return;
		case EType.BUTTON:
			if (key.charCodeAt(0) == 13 && this.onAction)//enter
				await this.onAction();
			return;
		}
	}
}
export class Form {
	closeSignal = false;
	focusIndex = -1;
	elements:Element[] = [];
	add(...x:Element[]) {
		this.elements.push(...x);
	}
	close() {
		this.closeSignal = true;
	}
	async run() {
		this.moveFocus(1);
		while (!this.closeSignal) {
			//render
			var focusIndex = this.focusIndex;
			console.clear();
			console.log(
				this.elements.map((el, i)=>{
					var r = el.render(i == focusIndex);
					if (el.bl) r += '\n';
					return r;
				}).join(' ')
			);

			//input
			var key = (await(new Promise((resolve, reject)=>{
				process.stdin.setRawMode(true);
				process.stdin.setEncoding('utf8');
				process.stdin.on('data', (key:string)=>{
					process.stdin.pause();
					process.stdin.removeAllListeners();
					if (key == '\u0003') process.exit();    // ctrl-c
					resolve(key);
				});
				process.stdin.resume();
			}))) as string;
			if (key == '\u001B\u005B\u0041')
				this.moveFocus(-1);
			else if (key == '\u001B\u005B\u0042')
				this.moveFocus(1);
			else if (this.focusIndex >= 0)
				await this.elements[this.focusIndex].keyPress(key);
		}
	}
	moveFocus(cof:number) {
		var focus = this.focusIndex;
		if (focus == -1)
			focus = 0;
		if (this.elements.length == 0)
			return;
		var tries = 0;
		while (tries <= this.elements.length) {
			focus += cof;
			if (focus >= this.elements.length)
				focus = 0;
			else if (focus < 0)
				focus = this.elements.length - 1;
			if (this.elements[focus].type != EType.LABEL) {
				this.focusIndex = focus;
				return;
			}
			tries++;
		}
	}
	meta_get():any[] {
		return this.elements.filter((el)=>el.type != EType.LABEL && el.type != EType.BUTTON).map((el)=>{
			switch (el.type) {
			case EType.INPUT:
				return el.text;
			case EType.CHECKBOX:
				return el.checked == true;
			case EType.COMBOBOX:
				return el.itemSelected;
			}
		})
	}
	meta_set(x:any[]) {
		return this.elements.filter((el)=>el.type != EType.LABEL && el.type != EType.BUTTON).forEach((el,i)=>{
			switch (el.type) {
			case EType.INPUT:
				return el.text = x[i];
			case EType.CHECKBOX:
				return el.checked = x[i];
			case EType.COMBOBOX:
				return el.itemSelected = x[i];
			}
		})
	}
	cache_save(name:string) {
		files.mkdir_recursive(def.cacheDirMeta);
		fs.writeFileSync(
			path.resolve(def.cacheDirMeta,"form."+name+".json"),
			JSON.stringify(this.meta_get())
		)
	}
	cache_load(name:string) {
		name = path.resolve(def.cacheDirMeta , "form."+name+".json");
		if (fs.existsSync(name)) {
			try {
				this.meta_set(JSON.parse(fs.readFileSync(name, 'utf-8')));
			} catch(e) {
				fs.unlinkSync(name);
			}
		}
	}
}



/*async function getMoveKey ():Promise<string> {
	return await new Promise((resolve)=>{
		process.stdin.on('data', (key:string)=>{
			if (key == '\u001B\u005B\u0041') {
				process.stdin.pause();
				process.stdin.removeAllListeners();
				resolve('u');
			}else
			if (key == '\u001B\u005B\u0043') {
				process.stdin.pause();
				process.stdin.removeAllListeners();
				resolve('r');
			}else
			if (key == '\u001B\u005B\u0042') {
				process.stdin.pause();
				process.stdin.removeAllListeners();
				resolve('d'); 
			}else
			if (key == '\u001B\u005B\u0044') {
				process.stdin.pause();
				process.stdin.removeAllListeners();
				resolve('l'); 
			}else
			if (key.charCodeAt(0) == 13) {
				process.stdin.pause();
				process.stdin.removeAllListeners();
				resolve('e'); 
			}else
			if (key == '\u0003') { process.exit(); }    // ctrl-c
		});
		process.stdin.setRawMode(true);
		process.stdin.setEncoding('utf8');
		process.stdin.resume();
	});
}
export async function showOptions (text:string, opts:string[]):Promise<number> {
	var i = 0;
	while (true) {
		console.clear();
		console.log(text);
		opts.forEach((v:string, ci:number)=>{
			if (ci == i) {
				process.stdout.write('\t');
				ccolor.contrastLog(ccolor.CodePrint.Green,v);
			} else
				console.log('\t' + v);
		});
		var key = await getKey();
		switch (key) {
		case 'l':
		case 'u':
			i--;
			if (i < 0) i = opts.length - 1;
			break;
		case 'r':
		case 'd':
			i++
			if (i >= opts.length) i = 0;
			break;
		case 'e':
			return i;
			break;
		}
	}
	return i;
}*/
export async function getline (x:string, dontclear?:boolean):Promise<string> {
	if (dontclear !== true)
		console.clear();
	console.log(x);
	return await new Promise((resolve)=>{
		process.stdin.setRawMode(false);
		process.stdin.on('data', (line:string)=>{
				line = line.toString();
				process.stdin.pause();
				process.stdin.removeAllListeners();
				console.log(line);
				resolve(line.replace('\n','').replace('\r',''));
		});
		process.stdin.resume();
	});
}