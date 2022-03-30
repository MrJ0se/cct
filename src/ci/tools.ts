import * as tools from '../tools';
import * as UI from '../u/console_ui';

export async function execute(args:string[], offset:number) {
	while (true) {
		if (args.length <= offset) {
			var name = await UI.getline("tool name to query:",true);
			if (name == "")
				return;
			var t = await tools.request(name, false);
			if (t == null) console.error(`not found a tool "${name}"`);
			else console.log(t);
		} else {
			var t = await tools.request(args[offset], false);
			if (t == null) console.error(`not found a tool "${args[offset]}"`);
			else console.log(t);
			offset++;
		}
	}
	if (args[offset] == '?') {
	}
	console.log(await tools.request(args[offset], false));
}