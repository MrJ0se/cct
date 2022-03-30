//"hot reload" libraries if not match current OS.

import * as fs from 'fs';
import * as path from 'path';
import * as childp from 'child_process';

var platform = process.platform;
var modules_fold_platform = path.resolve(__dirname, "../cache/"+platform);
var modules_fold = path.resolve(__dirname, "../node_modules");
var sign_file = path.resolve(__dirname, "../node_modules/signfile.txt");
var need_node_modules = false;

if (fs.existsSync(sign_file)) {
	var ref_platform = fs.readFileSync(sign_file, 'utf-8');
	if (ref_platform != platform) {
		console.log("swaped OS, swaping node_modules...");
		fs.renameSync(modules_fold, path.resolve(__dirname, '../cache/'+ref_platform));
		if (!fs.existsSync(modules_fold_platform)) {
			need_node_modules = true;
		} else fs.renameSync(modules_fold_platform, modules_fold);
	}
} else if (fs.existsSync(modules_fold)) {
	fs.writeFileSync(sign_file, platform);
} else {
	if (fs.existsSync(modules_fold_platform)) {
		console.log("swaped OS, swaping node_modules...");
		fs.renameSync(modules_fold_platform, modules_fold);
	} else {
		need_node_modules = true;
	}
}

if (need_node_modules) {
	console.log("no node_modules, running install");
	
	childp.exec('npm install', {cwd:path.resolve(__dirname, '..')}, (error, stdout, stderr)=>{
		var node_module_path = path.resolve(__dirname, '../node_modules');
		fs.writeFileSync(sign_file, platform);
		require("./ci");
	});
} else {
	require("./ci");
}