import * as def from "../def";
import * as cmake from '../cmake';
import * as path from 'path';
import * as UI from '../u/console_ui';
import * as exec from '../u/exec';
import {createCBwith} from './util';


//target:def.TargetBuild, src:string, dst:string, args:string[], actions:{clear?:boolean, config?:boolean, build?:boolean}
export async function execute(args:string[], offset:number) {
	var use_assist = args.length <= offset;
	//@ts-ignore
	var target = new def.TargetBuild({platform:cmake.current_platform, arch:cmake.current_arch});
	var src = '.';
	var dst = '.';
	var actions = {
		clear:false,
		config:false,
		build:false,
	};
	var cmake_args:string[] = [];

	for (var i = offset; i < args.length; i++) {
		var ce = args[i];
		if (ce == '?') {
			use_assist = true;
			continue;
		}
		switch (ce) {
		case "clear": actions.clear = true; break;
		case "config": actions.config = true; break;
		case "build": actions.build = true; break;
		default: {
			var di = ce.indexOf(':');
			if (di > 0) {
				switch (ce.substring(0, di)) {
				case "src":
					src = ce.substring(di+1);
					break;
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
					var content = ce.substring(di+1).toLowerCase();
					var i = 0;
					Object.values(def.win_Runtime).filter((x)=>typeof x == "string").forEach((x, ci)=>{
						if ((''+x).toLowerCase() == content)
							i = ci;
					});
					target.win_runtime = i as def.win_Runtime;
					break;
				case "wsm":
					var content = ce.substring(di+1).toLowerCase();
					var i = 0;
					Object.values(def.win_SpectreMitigation).filter((x)=>typeof x == "string").forEach((x, ci)=>{
						if ((''+x).toLowerCase() == content)
							i = ci;
					});
					target.win_spectreMitigation = i as def.win_SpectreMitigation;
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
					di = -1;
				}
			}
			if (di == -1)
				cmake_args.push(ce);
		}}
	}
	if (use_assist || src == dst) {
		var form = new UI.Form();
		var tb_src = (new UI.Element()).setInput(src, "source directory");
		var tb_dst = (new UI.Element()).setInput(dst, "destin directory");
		var tb_args = (new UI.Element()).setInput(exec.joinCommandLine(cmake_args), "passed to cmake");

		var ck_clear = (new UI.Element()).setCheckBox("(clear) Clear dst dir?", actions.clear);
		var ck_config = (new UI.Element()).setCheckBox("(config) Configure CMakeFiles?", actions.clear);
		var ck_build = (new UI.Element()).setCheckBox("(build) Build solution?", actions.clear);
		
		var cb_t_platform = createCBwith(' (platform:|p:) Platform',  Object.values(def.Platform).filter((x)=>typeof x == "string" && x == x.toLowerCase()) as string[], target.target.platform);
		var cb_t_arch = createCBwith(' (arch:|a:) Architecture',  Object.values(def.Arch).filter((x)=>typeof x == "string" && x == x.toLowerCase()) as string[], target.target.arch);
		var cb_mode = createCBwith(' (mode:|m:) Modo',  Object.values(def.BuildMode).filter((x)=>typeof x == "string" && x == x.toLowerCase()) as string[], target.mode);

		var cb_ext_and = createCBwith(' (sdk:|s:) Android API level', [19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35].map((x)=>x+""), target.and_sdk);
		var cb_ext_win = (new UI.Element()).setCombobox(' (wr:) Windows Runtime Library', Object.values(def.win_Runtime).filter((x)=>typeof x == "string") as string[], target.win_runtime as number);
		var cb_ext_wsm = (new UI.Element()).setCombobox(' (wsm:) Windows Spectre Mitigation', Object.values(def.win_SpectreMitigation).filter((x)=>typeof x == "string") as string[], target.win_spectreMitigation as number);
		var cb_ext_uwp = createCBwith(' (sdk:|s:) UWP SDK version', Object.values(def.uwp_SDKVersion).filter((x)=>typeof x == "string" && x.indexOf('.')>0), target.uwp_sdk);
		var tb_ext_mac = (new UI.Element()).setInput(target.mac_bundleGUI, "example: com.company.product");

		form.add(
			(new UI.Element()).setLabel("CMake Assistent"),
			(new UI.Element()).setLabel("(src:)  Source path:"),
			tb_src,
			(new UI.Element()).setLabel("(dst:) Destin path:"),
			tb_dst,
			(new UI.Element()).setLabel("cmake arguments:"),
			tb_args,
			ck_clear, ck_config, ck_build,
			(new UI.Element()).setLabel("== Target =="),
			cb_t_platform,
			cb_t_arch,
			cb_mode,
			(new UI.Element()).setLabel("=== Ext ==="),
			cb_ext_and,
			cb_ext_win,
			cb_ext_wsm,
			cb_ext_uwp,
			(new UI.Element()).setLabel(" (bundle:|b:) Mac BundleUI:"),
			tb_ext_mac,
			(new UI.Element()).setButton("Run CMake").setAction(async ()=> form.close()),
			(new UI.Element()).setButton("Save Prefs").setAction(async ()=> form.cache_save("cmake")),
			(new UI.Element()).setButton("Load Prefs").setAction(async ()=> form.cache_load("cmake")),
		);
		await form.run();
		console.log("...");

		src = tb_src.text;
		dst = tb_dst.text;
		cmake_args = exec.splitCommandLine(tb_args.text);

		actions.clear = ck_clear.checked as boolean;
		actions.config = ck_config.checked as boolean;
		actions.build = ck_build.checked as boolean;

		//@ts-ignore
		target.target.platform = cb_t_platform.items[cb_t_platform.itemSelected];
		//@ts-ignore
		target.target.arch = cb_t_arch.items[cb_t_arch.itemSelected];
		//@ts-ignore
		target.mode = cb_mode.items[cb_mode.itemSelected];

		//@ts-ignore
		target.and_sdk = cb_ext_and.items[cb_ext_and.itemSelected];
		target.win_runtime = cb_ext_win.itemSelected as def.win_Runtime;
		target.win_spectreMitigation = cb_ext_wsm.itemSelected as def.win_SpectreMitigation;
		//@ts-ignore
		target.uwp_sdk = cb_ext_uwp.items[cb_ext_uwp.itemSelected];
		target.mac_bundleGUI = tb_ext_mac.text;
	}
	await cmake.cmake(target, path.resolve(src), path.resolve(dst), cmake_args, actions);
}