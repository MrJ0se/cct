import * as path from 'path';
import * as fs from 'fs';
import * as files from './u/files';
import * as def from './def';
import * as download from './u/download'
import * as crypto from 'crypto';

export interface ImpOpt {
	desc:string,
	value:string,
	values?:string[],
};
class LibraryJSONUtil {
	inc:string;
	sta:string;
	dyn:string;
	l_sta?:string[];
	l_dyn?:string[];

	constructor (path_dir:string) {
		this.inc = path.resolve(path_dir, 'include');
		this.sta = path.resolve(path_dir, 'static');
		this.dyn = path.resolve(path_dir, 'dynamic');
		var p = path.resolve(path_dir, 'inc.json');
		if (fs.existsSync(p)) {
			var obj = JSON.parse(fs.readFileSync(p, 'utf-8'));
			var stab = obj.static as (string[]|undefined);
			var dynb = obj.dynamic as (string[]|undefined);
			if (stab && stab.length > 0) this.l_sta = stab;
			if (dynb && dynb.length > 0) this.l_dyn = dynb;
		}
	}
	getLibraries(prefer_dynamic:boolean):string[] {
		if (prefer_dynamic && this.l_dyn)
			return this.l_dyn.map((x)=>path.resolve(this.dyn,x));
		if (this.l_sta)
			return this.l_sta.map((x)=>path.resolve(this.sta,x));
		if (this.l_dyn)
			return this.l_dyn.map((x)=>path.resolve(this.dyn,x));
		throw 'Cant find any library';
	}
}
export interface NewImporterOpts {
	request_symlink?:{
		download?:boolean,
		source?:boolean,
		build?:boolean
	}
}
export class Importer {
	getLibraryJSON(path_dir:string){
		return new LibraryJSONUtil(path_dir);
	}
	name:string;
	opts:NewImporterOpts = {};
	constructor(name:string, opts?:NewImporterOpts) {
		this.name = name;
		if (opts)
			this.opts = opts;
	}
	cache_file:string = "";
	cache_src:string = "";
	cache_bld:string = "";
	dst_inc:string = "";
	dst_static:string = "";
	dst_dynamic:string = "";
	purge?:{file?:boolean, source?:boolean, build?:boolean};

	//must be implemented...
	getVersions():string[] {
		return [];
	}
	getOptions():Map<string,ImpOpt> {
		return new Map<string,ImpOpt>();
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		this.purge = purge;
		var unamev = this.name+'/'+version;
		var uname = unamev+"/"+def.Target_join(target.target);
		this.dst_inc = path.resolve(dst, uname, "include");
		this.dst_static = path.resolve(dst, uname, "static");
		this.dst_dynamic = path.resolve(dst, uname, "dynamic");
		this.cache_file = path.resolve(
			(this.opts.request_symlink && this.opts.request_symlink.download && !def.cacheSupportSymlink)?
				def.tcacheDirDownload:def.cacheDirDownload,
			unamev
		);
		this.cache_src = path.resolve(
			(this.opts.request_symlink && this.opts.request_symlink.source && !def.cacheSupportSymlink)?
				def.tcacheDirSource:def.cacheDirSource,
			unamev
		);
		this.cache_bld = path.resolve(
			(this.opts.request_symlink && this.opts.request_symlink.build && !def.cacheSupportSymlink)?
				def.tcacheDirBuild:def.cacheDirBuild,
			unamev
		);
	}
	//utils
	hashConfig(target:def.TargetBuild, options:Map<string,ImpOpt>):string {
		return crypto.createHash('md5').update(
			target.mode+
			target.win_runtime+
			target.mac_bundleGUI+
			target.and_sdk+
			target.uwp_sdk+
			//@ts-ignore
			Array.from(options.keys()).map((x)=>options.get(x).value)
		).digest('hex');
	}
	async requestLibraryDir(target:def.TargetBuild, dst:string, libname:string, version?:string, import_if_not_found?:boolean):Promise<string> {
		var triple = def.Target_join(target.target);
		if (version) {
			if (fs.existsSync(path.resolve(dst, libname, version, triple)))
				return path.resolve(dst, libname, version, triple);
			if (import_if_not_found !== true)
				return '';

			var imp = loadImporter(libname, true) as Importer;
			await imp.import(target, version, imp.getOptions(), dst);

			return path.resolve(dst, libname, version, triple);
		}

		var imp = loadImporter(libname, true) as Importer;
		var versions = imp.getVersions();

		if (fs.existsSync(path.resolve(dst, libname))) {
			var found_versions = fs.readdirSync(path.resolve(dst, libname))
				.filter((vers)=>fs.existsSync(path.resolve(dst, libname, vers, triple)));

			if (found_versions.length > 0) {
				for (var i = versions.length - 1; i >= 0; i--) {
					if (found_versions.find((x)=>x == versions[i]) != null)
						return path.resolve(dst, libname, versions[i], triple);
				}
				return path.resolve(dst, libname, found_versions[found_versions.length - 1], triple);
			}
		}
		if (import_if_not_found !== true)
			return '';

		version = versions[versions.length - 1];
		await imp.import(target, version, imp.getOptions(), dst);

		return path.resolve(dst, libname, version, triple);
	}
	async downloadSource(link:string, type:"git"|"tar.gz"|"tar.xz"):Promise<void> {
		await download.download_source(this.cache_file, this.cache_src, link, type, this.purge);
	}
	async buildProcess(build_func:(need_clear:boolean)=>Promise<void>) {
		var build_ok = this.cache_bld+".ok";
		var build_ok_exists = fs.existsSync(build_ok); 

		files.mkdir_recursive(this.cache_bld);

		if (this.purge && this.purge.build) {
			if (build_ok_exists)
				fs.unlinkSync(build_ok);

			await build_func(true);
		} else if (build_ok_exists)
			return;
		else
			await build_func(false);
		fs.writeFileSync(build_ok, "");
	}
	async dopeFile(pf:string, doper:(text:string)=>Promise<string>):Promise<void> {
		var pf_ok = pf+".ok";
		if (!fs.existsSync(pf_ok)) {
			fs.writeFileSync(pf, await doper(
				fs.readFileSync(pf, 'utf-8')
			));
			fs.writeFileSync(pf_ok, '');
		}
	}
	async dopeState(pf:string, doper:()=>Promise<void>):Promise<void> {
		var pf_ok = pf+".ok";
		if (!fs.existsSync(pf_ok)) {
			await doper();
			fs.writeFileSync(pf_ok, '')
		}
	}
	genCMakeInclude(name:string, order?:{op:ReorderOp, filter:string[]|string}[]) {
		var text = `set(${name}_INC \${CMAKE_CURRENT_LIST_DIR}/include)\n`;
		var static_libs:string[] = [];
		var dynamic_libs:string[] = [];
		var dynamic_copy:string[] = [];
		if (fs.existsSync(this.dst_static))
			static_libs = reorderLib(fs.readdirSync(this.dst_static), order);
		if (fs.existsSync(this.dst_dynamic)) {
			var temp = fs.readdirSync(this.dst_dynamic);
			dynamic_libs = reorderLib(temp.filter((x)=>
				files.filterName(x, ['*.lib','*.so','*.dylib'])
			), order)
			dynamic_copy = temp.filter((x)=>
				files.filterName(x, ['*.dll','*.so','*.dylib'])
			);
		}
		if (static_libs.length>0)
			text += `set(${name}_STATIC ${static_libs.map((x)=>'${CMAKE_CURRENT_LIST_DIR}/static/'+x).join(' ')})\n`;
		if (dynamic_libs.length>0) {
			text += `set(${name}_DYNAMIC ${dynamic_libs.map((x)=>'${CMAKE_CURRENT_LIST_DIR}/dynamic/'+x).join(' ')})\n`;
			text += `set(${name}_DYNAMIC_CPY ${dynamic_copy.map((x)=>'${CMAKE_CURRENT_LIST_DIR}/dynamic/'+x).join(' ')})\n`;
		}
		fs.writeFileSync(path.resolve(this.dst_inc, '../inc.cmake'), text);
		var json_save:any = {
			static:static_libs,
			dynamic:dynamic_libs,
			dynamic_copy
		};
		fs.writeFileSync(path.resolve(this.dst_inc, '../inc.json'), JSON.stringify(json_save));
	}
};
export enum ReorderOp {
	ADD_TO_NEW,
	REMOVE_FROM_NEW,
	MOVE_TO_END
};
function reorderLib(list:string[], order?:{op:ReorderOp, filter:string[]|string}[]) {
	if (order) {
		var nlist:string[] = [];

		order.forEach((op)=>{
			switch (op.op) {
			case ReorderOp.ADD_TO_NEW:
				nlist.push(...list.filter((x)=>files.filterName(x, op.filter)));
				break;
			case ReorderOp.REMOVE_FROM_NEW:
				nlist = nlist.filter((x)=>!files.filterName(x, op.filter));
				break;
			case ReorderOp.MOVE_TO_END:
				var to_end = nlist.filter((x)=>files.filterName(x, op.filter));
				nlist = [...nlist.filter((x)=>!files.filterName(x, op.filter)), ...to_end];
				break;
			}
		});

		nlist = nlist.filter((x, i)=>{
			i--;
			for (;i>=0;i--) {
				if (x == nlist[i])
					return false;
			}
			return true;
		});
		return nlist;
	}
	return list;
}

var memcache:string[][] = [];
export function getList():string[] {
	if (memcache.length == 0)
		memcache = fs.readdirSync(path.resolve(__dirname, 'import'))
			.map((x)=>path.resolve(__dirname, 'import', x))
			.filter((x:string)=>path.extname(x)==".js" && fs.existsSync(x))
			.map((el)=>[path.basename(el).replace('.js','') , el]);
	return memcache.map((x)=>x[0]);
}
export function loadImporter(name:string, fail_on_falt:boolean):Importer|null {
	var p = memcache.find((x)=>x[0] == name);
	if (p == null) {
		if (fail_on_falt)
			throw `Required cmake target not found: ${name}`;
		return null;
	}
	//@ts-ignore
	return require(p[1]).getImporter() as Importer;
}