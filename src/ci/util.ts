import {joinCommandLine} from '../u/exec';
import * as def from '../def';
import * as UI from '../u/console_ui';

export function destacArgument(args:string[], init:number, count:number) {
	var end = init + count;
	return (joinCommandLine(args.map((x,i)=>{
		if (i >= init && i <= end)
			return def.ColorCode.BgWhite+def.ColorCode.FgBlack+x+def.ColorCode.Reset;
		return x;
	})))
}
export function createCBwith(name:string, items:string[], value:string):UI.Element {
	var i = 0;
	items.forEach((el, ci)=>{
		if (el == value)
			i = ci;
	});
	return (new UI.Element()).setCombobox(name, items, i);
}