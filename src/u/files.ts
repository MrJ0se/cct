import * as fs from 'fs';
import * as path from 'path';

export function mkdir_recursive (p:string) {
	if (fs.existsSync(p))
		return;
	mkdir_recursive(path.resolve(p, '..'));
	fs.mkdirSync(p);
}
export function remove_recursive (p:string) {
	if (!fs.existsSync(p))
		return;
	if (fs.lstatSync(p).isDirectory()) {
		fs.readdirSync(p)
			.forEach((fp)=>
				remove_recursive(path.resolve(p, fp))
			);
		fs.rmdirSync(p);
	} else
		fs.unlinkSync(p);
}
export interface FilterPrefs {
	file_filter?:(x:string)=>boolean,
	folder_filter?:(x:string)=>boolean,

	symlinks_ignore?:boolean,
	symlinks_raster?:boolean,
	ignore_clone_libs?:boolean,

	sub_folder_src?:boolean

	sub_folder_count?:number,
}
async function testFilter(x:string, config?:FilterPrefs):Promise<boolean> {
	if (!fs.existsSync(x))
		return false;
	if (config) {
		var is_dir = fs.statSync(x).isDirectory();
		if (config.symlinks_ignore) {
			if (await new Promise((resolve,reject)=>{
				fs.lstat(x, (err,stats)=>{
					if (err)
						reject(err);
					else
						resolve(stats.isSymbolicLink());
				})
			}))
				return false;
		}
		if (is_dir) {
			if (config.sub_folder_count === 0)
				return false;
			else if (config.sub_folder_count)
				config.sub_folder_count--;
			if (config.folder_filter)
				return config.folder_filter(x);
		} else if (config.file_filter) {
			if (config.ignore_clone_libs) {
				if (isInNameVersionDylib(x))
					return false;
				if (path.basename(x).indexOf('__ignore__') == 0)
					return false;
			}
			return config.file_filter(x);
		}
	}
	return true;
}
export async function copy_recursive (pbase:string, pdest:string, config?:FilterPrefs) {
	if (config) config = {...config};//make a copy
	if (!(await testFilter(pbase, config)))
		return;

	if (fs.lstatSync(pbase).isDirectory()) {
		var files = fs.readdirSync(pbase);
		for (var i = 0; i < files.length; i++) {
			var fp = files[i];
			if (config && config.sub_folder_src && fs.lstatSync(path.resolve(pbase, fp)).isDirectory()) {
				await copy_recursive(
					path.resolve(pbase, fp),
					pdest,
					config
				);
			} else {
				await copy_recursive(
					path.resolve(pbase, fp),
					path.resolve(pdest, fp),
					config
				);
			}
		}
	} else {
		if (config && config.symlinks_raster &&
			(await new Promise((resolve,reject)=>{
				fs.lstat(pbase,(err,stats)=>{
					if (err)
						reject(err);
					else
						resolve(stats.isSymbolicLink());
				})
			}))
		) {
			pbase = fs.realpathSync(pbase);
			if (!fs.existsSync(pbase))
				return;
		}
		mkdir_recursive(path.resolve(pdest, '..'));
		fs.copyFileSync(pbase, pdest);
	}
}
export async function find_recursive (pbase:string, filter_ret:(x:string)=>boolean, config?:FilterPrefs):Promise<string[]> {
	var ret:string[] = [];
	if (config) config = {...config};//make a copy
	if (!(await testFilter(pbase, config)))
		return [];

	if (fs.lstatSync(pbase).isDirectory()) {
		var files = fs.readdirSync(pbase);
		for (var i = 0; i < files.length; i++) {
			var fp = files[i];
			ret.push(...(
				await find_recursive(
					path.resolve(pbase, fp),
					filter_ret,
					config
				)
			));
		}
	} else {
		if (config && config.symlinks_raster &&
			(await new Promise((resolve,reject)=>{
				fs.lstat(pbase,(err,stats)=>{
					if (err)
						reject(err);
					else
						resolve(stats.isSymbolicLink());
				})
			}))
		) {
			pbase = fs.realpathSync(pbase);
			if (!fs.existsSync(pbase))
				return ret;
		}
		if (filter_ret(pbase))
			return [pbase];
	}
	return ret;
}
export function filterName(name:string, filter:string|string[]):boolean {
	if (Array.isArray(filter)) {
		for (var i = 0; i < filter.length;i++)
			if (filterName(name, filter[i]))
				return true;
		return false;
	}

	var ff = filter.split('*');

	if (ff.length == 1)
		return ff[0] == name;

	var solved = 0;
	for (var i = 0; i < ff.length; i++) {
		if (ff[i] == '')//*
			continue;
		if (i == ff.length-1) {//last
			var ifind = name.lastIndexOf(ff[i]);
			return ifind >= solved &&
				ifind == name.length - ff[i].length;
		}
		var ifind = name.indexOf(ff[i], solved);
		if ((i == 0 && ifind != 0) ||//first
			ifind < 0)
			return false;
		solved = ifind + ff[i].length;
	}
	return true;
}
export function isInNameVersionDylib(name:string) {
	name = path.basename(name);
	var li = name.lastIndexOf('.dylib');
	var di = name.indexOf('.');
	return li > 0 && di < li;
}
