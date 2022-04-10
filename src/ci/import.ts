import * as def from "../def";
import * as tools from '../tools';
import * as util from './util';
import * as UI from '../u/console_ui';
import * as exec from '../u/exec';
import {createCBwith} from './util';
import * as importer from '../import';
import * as path from 'path';
import * as cmake from '../cmake';

export async function execute(args:string[], offset:number) {
	var use_assist = args.length <= offset+ 1;
	var libname = args[offset] as string;
	var libversion =  args[offset+1] as string;
	var alllibs = importer.getList();

	if (libname == null || libname == "?") {
		console.clear();
		console.log("Importable libraries:")
		console.log(alllibs);
		libname = await UI.getline("name of library to import (cct i <name> <version> [<library options(lo-{option}:{value})>] [<build opts....>]):", true);
	}

	if (alllibs.find((x)=>x == libname) == null)
		throw `Required library importer not found: ${libname}`;

	var lib_imp = importer.loadImporter(libname, true) as importer.Importer;
	var lib_prefs = lib_imp.getOptions();
	var lib_versions = lib_imp.getVersions();

	offset += 2;
	for (var i = offset; i < args.length; i++) {
		var ce = args[i];
		if (ce == '?') {
			use_assist = true;
			continue;
		}
		var di = ce.indexOf(':');
		if (di > 0 && ce.indexOf('lo-') == 0) {
			var key = ce.substr(3, di-3);
			var value = ce.substr(di+1);
			if (!lib_prefs.has(key)) {
				console.log("Library Option ignored: "+key+" = "+value);
				continue;
			}
			var temp = lib_prefs.get(key) as importer.ImpOpt;
			if (temp.values) {
				if (temp.values.find((x)=>x==value) == null) {
					console.log("Library Option ignored due to invalid value: "+key+" = "+value);
					console.log("  valid values: "+temp.values.join(";"));
					continue;
				}
			}
			temp.value = value;
			lib_prefs.set(key, temp);
		}
	}
	use_assist = use_assist || libversion == null || libversion == "?";
	if (use_assist) {
		if (lib_versions.find((x)=>x==libversion) == null)
			libversion = lib_versions[0];

		var form = new UI.Form();
		var cb_version = createCBwith("Version", lib_versions, libversion);
		form.add(
			(new UI.Element()).setLabel(`Importer Assistent "${libname}" -> library options`),
			cb_version
		);

		var ui_lo = new Map<string,UI.Element>();
		Array.from(lib_prefs.keys()).forEach((key)=>{
			var pref = lib_prefs.get(key) as importer.ImpOpt;
			if (pref.values) {
				var form_el = createCBwith(`(lo-)${key}`, pref.values, pref.value);
				ui_lo.set(key, form_el);
				form.add(form_el, (new UI.Element()).setLabel('*'+pref.desc));
			} else {
				var form_el = (new UI.Element()).setInput(pref.value);
				form.add((new UI.Element()).setLabel(`(lo-)${key}:`), form_el, (new UI.Element()).setLabel('*'+pref.desc))
				ui_lo.set(key, form_el);
			}
		});
		form.add(
			(new UI.Element()).setButton("Next (Target config)").setAction(async ()=> form.close()),
			(new UI.Element()).setButton("Save Prefs").setAction(async ()=> form.cache_save(`import_${libname}_prefs`)),
			(new UI.Element()).setButton("Load Prefs").setAction(async ()=> form.cache_load(`import_${libname}_prefs`)),
		)
		await form.run();

		Array.from(ui_lo.keys()).forEach((key)=>{
			var temp_pref = lib_prefs.get(key) as importer.ImpOpt;
			var el = ui_lo.get(key) as UI.Element;
			if (el.type == UI.EType.COMBOBOX)
				//@ts-ignore
				temp_pref.value = el.items[el.itemSelected];
			else
				temp_pref.value = el.text;
			lib_prefs.set(key, temp_pref);
		})
		//@ts-ignore
		libversion = cb_version.items[cb_version.itemSelected];
	}
	if (lib_versions.find((x)=>x==libversion) == null)
		throw `Library version unsuported by importer (${libname}): %{libversion}`;
	var lib_purge = {file:false, source:false, build:false};

	//========//
	// part 2 //
	//========//
	//@ts-ignore
	var target = new def.TargetBuild({platform:cmake.current_platform, arch:cmake.current_arch});
	target.mode = def.BuildMode.RELEASE_FASTER;
	var dst = `.`;

	for (var i = offset; i < args.length; i++) {
		var ce = args[i];
		if (ce == '?') {
			use_assist = true;
			continue;
		}
		switch (ce) {
		case "purge-file":lib_purge.file = true; break;
		case "purge-source":lib_purge.source = true; break;
		case "purge-build":lib_purge.build = true; break;
		default: {
			var di = ce.indexOf(':');
			if (di > 0) {
				switch (ce.substring(0, di)) {
				case "dst":
					dst = ce.substring(di+1);
					break;
				case "platform":
				case "p":
					target.target.platform = ce.substring(di+1) as def.Platform;
					break;
				case "arch":
				case "a":
					target.target.arch = ce.substring(di+1) as def.Arch;
					break;
				case "mode":
				case "m":
					target.mode = ce.substring(di+1) as def.BuildMode;
					break;
				case "wr":
					var content = ce.substring(di+1);
					var i = 0;
					Object.values(def.win_Runtime).filter((x)=>typeof x == "string").forEach((x, ci)=>{
						if (x == content)
							i = ci;
					});
					target.win_runtime = i as def.win_Runtime;
					break;
				case "sdk":
				case "s":
					target.and_sdk = ce.substring(di+1);
					target.uwp_sdk = ce.substring(di+1) as def.uwp_SDKVersion;
					break;
				case "bundle":
				case "b":
					target.mac_bundleGUI = ce.substring(di+1);
					break;
				default:
					if (ce.indexOf('lo-')) break;
					di = -1;
				}
			}
			if (di == -1)
				console.log('ignored flag: '+ce);
		}}
	}
	if (use_assist) {
		var form = new UI.Form();
		var tb_dst = (new UI.Element()).setInput(dst, "destin directory");
		
		var cb_t_platform = createCBwith(' (platform:|p:) Platform',  Object.values(def.Platform).filter((x)=>typeof x == "string" && x == x.toLowerCase()) as string[], target.target.platform);
		var cb_t_arch = createCBwith(' (arch:|a:) Architecture',  Object.values(def.Arch).filter((x)=>typeof x == "string" && x == x.toLowerCase()) as string[], target.target.arch);
		var cb_mode = createCBwith(' (mode:|m:) Modo',  Object.values(def.BuildMode).filter((x)=>typeof x == "string" && x == x.toLowerCase()) as string[], target.mode);

		var cb_ext_and = createCBwith(' (sdk:|s:) Android API level', [19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35].map((x)=>x+""), target.and_sdk);
		var cb_ext_win = (new UI.Element()).setCombobox(' (wr:) Windows Runtime Library', Object.values(def.win_Runtime).filter((x)=>typeof x == "string") as string[], target.win_runtime as number);
		var cb_ext_uwp = createCBwith(' (sdk:|s:) UWP SDK version', Object.values(def.uwp_SDKVersion).filter((x)=>typeof x == "string" && x.indexOf('.')>0), target.uwp_sdk);
		var tb_ext_mac = (new UI.Element()).setInput(target.mac_bundleGUI, "example: com.company.product");

		var cb_purge_fil = (new UI.Element()).setCheckBox("(purge-file) zip file?", lib_purge.file);
		var cb_purge_src = (new UI.Element()).setCheckBox("(purge-source) source folder?", lib_purge.source);
		var cb_purge_bld = (new UI.Element()).setCheckBox("(purge-build) build folder?", lib_purge.build);

		form.add(
			(new UI.Element()).setLabel(`Importer Assistent "${libname}" -> target`),
			(new UI.Element()).setLabel("(dst:) Destin path:"),
			tb_dst,
			(new UI.Element()).setLabel("== Target =="),
			cb_t_platform,
			cb_t_arch,
			cb_mode,
			(new UI.Element()).setLabel("=== Ext ==="),
			cb_ext_and,
			cb_ext_win,
			cb_ext_uwp,
			(new UI.Element()).setLabel(" (bundle:|b:) Mac BundleUI:"),
			tb_ext_mac,
			(new UI.Element()).setLabel("=== Purge Library Cache ==="),
			cb_purge_fil,
			cb_purge_src,
			cb_purge_bld,
			(new UI.Element()).setButton("Run Importer").setAction(async ()=> form.close()),
			(new UI.Element()).setButton("Save Prefs").setAction(async ()=> form.cache_save(`import_${libname}_target`)),
			(new UI.Element()).setButton("Load Prefs").setAction(async ()=> form.cache_load(`import_${libname}_target`)),
			(new UI.Element()).setButton("Save Prefs Shared").setAction(async ()=> form.cache_save(`import_target`)),
			(new UI.Element()).setButton("Load Prefs Shared").setAction(async ()=> form.cache_load(`import_target`)),
		);
		await form.run();
		console.log("...");
		dst = tb_dst.text;

		//@ts-ignore
		target.target.platform = cb_t_platform.items[cb_t_platform.itemSelected];
		//@ts-ignore
		target.target.arch = cb_t_arch.items[cb_t_arch.itemSelected];
		//@ts-ignore
		target.mode = cb_mode.items[cb_mode.itemSelected];

		//@ts-ignore
		target.and_sdk = cb_ext_and.items[cb_ext_and.itemSelected];
		//@ts-ignore
		target.win_runtime = cb_ext_win.items[cb_ext_win.itemSelected];
		//@ts-ignore
		target.uwp_sdk = cb_ext_uwp.items[cb_ext_uwp.itemSelected];
		target.mac_bundleGUI = tb_ext_mac.text;

		lib_purge.file = cb_purge_fil.checked == true;
		lib_purge.source = cb_purge_src.checked == true;
		lib_purge.build = cb_purge_bld.checked == true;
	}
	await lib_imp.import(target, libversion, lib_prefs, path.resolve(dst), lib_purge);
}