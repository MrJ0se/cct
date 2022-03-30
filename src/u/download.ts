import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import * as fu from './files';
import * as exec from './exec';
import unzip from './unzip';
import * as def from '../def';

var dg_anim_state = 0;
function dg_anim() {
	dg_anim_state++;
	if (dg_anim_state >= 18)
		dg_anim_state = 0;

	var index = dg_anim_state >= 10?(18 - dg_anim_state):dg_anim_state;

	var tstr = '';
	for (var i = 0; i < 10; i++)
		tstr += (i == dg_anim_state)?'=':' ';
	//@ts-ignore
	process.stdout.clearLine();
	process.stdout.cursorTo(0);
	process.stdout.write('['+tstr+']');
}
export async function download_git(repo:string, filepath_dest:string):Promise<void> {
	console.log("Downloading (git clone ${repo})");
	var anim = setTimeout(dg_anim, 33);
	var res = exec.execGitClone(repo, filepath_dest);
	clearTimeout(anim);
	if (!res) {
		console.log("Failed");
		throw "git clone failed";
	}
	//@ts-ignore
	process.stdout.clearLine();
	process.stdout.cursorTo(0);
	process.stdout.write('[complete]');
	return;
}
export function download_file(link:string, filepath_dest:string):Promise<void> {
	return new Promise((resolve,reject)=>{
		if (link.length < 6 || (link.substring(0,5) != 'http:' && link.substring(0,6) != 'https:')) {
			console.error(`Invalid link: ${link}`);
			reject();
			return;
		}
		function _returner (res:http.IncomingMessage) {
			fu.mkdir_recursive(path.resolve(filepath_dest,'..'));
			if (res.statusCode && (res.statusCode<200 || res.statusCode>=300)) {
				if (res.statusCode == 302) {
					var data = '';
					res.on('data',(d)=>data+=d);
					res.on('end',()=>{
						var init = data.indexOf('<a href="');
						var end = data.indexOf('"',init+10);
						if (init == -1 || end == -1) {
							console.error(`Download code: ${res.statusCode} redirect; (url: ${link}) not found next url`);
							reject();
						} else
							download_file(data.substring(init+9,end).replace(/\&amp\;/g,'&'), filepath_dest).then(resolve).catch(reject);
					});
				} else {
					console.error(`Download code: ${res.statusCode}; (url: ${link})`);
					reject();
				}
				return;
			}
			console.log(`Downloading (${link})...\n`);
			const file = fs.createWriteStream(filepath_dest);
			res.pipe(file);
			var progress = 0;
			var fullsize = 
				res.headers['Content-Length']?parseInt(res.headers['Content-Length'] as string):
				res.headers['content-length']?parseInt(res.headers['content-length'] as string):
				null;
			var lastUpdate = 0;
			res.on('data', (chunk:any)=>{
				if (chunk.length) {
					progress += chunk.length;
					var lastNow = Date.now();
					if (lastNow>lastUpdate+100)
						lastUpdate = lastNow;
					else
						return;
					//@ts-ignore
					process.stdout.clearLine();
					process.stdout.cursorTo(0);
					process.stdout.write("	"+ formatByteSize(progress));
					if (fullsize) {
						if (fullsize <= progress)
							process.stdout.write(' [complete!]');
						else {
	 						var tstr = ' / ' + formatByteSize(fullsize) + ' [';
							var csz = (progress*30/fullsize);
							for (var i = 0; i < 30; i++)
								tstr += (i < csz)?'=':' ';
							process.stdout.write(tstr+']');
						}
					}
				}
			});
			res.on('end',()=>{
				console.log('\n');
				resolve();
			});
		}
		if (link.substring(0,5) == 'http:')
			http.get(link, _returner);
		else
			https.get(link, _returner);
	});
}
function formatByteSize(x:number):string {
	if (x < 1024)
		return x + 'b';
	if (x < 1024*1024)
		return (x/1024).toFixed(1) + 'kb';
	return (x/(1024*1024)).toFixed(1) + 'mb';
}
//throw error on fail
export async function download_source(file_path:string, source_dir:string, link:string, type:"git"|"tar.gz"|"tar.xz", purge?:{file?:boolean, source?:boolean}) {
	var purge_dir = purge && purge.source;
	var purge_file = purge && purge.file;

	var source_dir_exists = fs.existsSync(source_dir);
	var source_dir_ok = fs.existsSync(source_dir+".ok");
	if (!purge_dir && source_dir_exists && source_dir_ok)
		return;
	if (source_dir_exists)
		fu.remove_recursive(source_dir);
	if (source_dir_ok)
		fu.remove_recursive(source_dir+".ok");
	if (type == "git") {
		fu.mkdir_recursive(path.resolve(source_dir));
		await download_git(link, source_dir)
		fs.writeFileSync(source_dir+".ok","");
	} else {
		var zipfile = file_path+"."+type;
		var zipfile_exists = fs.existsSync(zipfile);
		var zipfile_ok = fs.existsSync(zipfile+".ok");
		if (purge_file || !zipfile_exists || !zipfile_ok) {
			if (zipfile_exists)
				fu.remove_recursive(zipfile);
			if (zipfile_ok)
				fu.remove_recursive(zipfile+".ok");
			fu.mkdir_recursive(path.resolve(def.cacheDirDownload));
			await download_file(link, zipfile);
			fs.writeFileSync(zipfile+".ok","");
		}
		fu.mkdir_recursive(path.resolve(source_dir));
		await unzip(zipfile, source_dir);
		fs.writeFileSync(source_dir+".ok","");
	}
}