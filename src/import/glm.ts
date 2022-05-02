import {Importer,ImpOpt} from "../import";
import * as def from '../def';
import * as files from '../u/files';
import * as path from 'path';

export function getImporter():Importer {
	return new LibImp("glm", {headeronly:true});
}
class LibImp extends Importer {
	getVersions():string[] {
		return ["0.9.9.8"];
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		await super.import(target, version, options, dst, purge);
		await this.downloadSource('https://codeload.github.com/g-truc/glm/tar.gz/refs/tags/'+version, "tar.gz");
		////////////
		//copy out//
		////////////
		console.log('coping out..')
		// include
		await files.copy_recursive(
			path.resolve(this.cache_src, `glm-${version}/glm`),
			path.resolve(this.dst_inc, 'glm'),
			{ sub_folder_count:10 }
		);
		this.genCMakeInclude("GLM");
	}
}