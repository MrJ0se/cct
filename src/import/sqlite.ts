import {Importer,ImpOpt} from "../import";
import * as def from '../def';
import * as cmake from '../cmake';
import * as files from '../u/files';
import * as path from 'path';

export function getImporter():Importer {
	return new LibImp("sqlite");
}
class LibImp extends Importer {
	getVersions():string[] {
		return ["3.24.0"];
	}
	getOptions():Map<string,ImpOpt> {
		var k = new Map<string,ImpOpt>();
		return k;
	}
	async import(target:def.TargetBuild, version:string, options:Map<string,ImpOpt>, dst:string, purge?:{file?:boolean, source?:boolean, build?:boolean}):Promise<void> {
		await super.import(target, version, options, dst, purge);
		await this.downloadSource(`https://github.com/alex85k/sqlite3-cmake/archive/refs/tags/v${version}.tar.gz`, "tar.gz");
		var cmake_dir = path.resolve(this.cache_src, 'sqlite3-cmake-'+version);
		await this.dopeFile(path.resolve(cmake_dir, 'CMakeLists.txt'), async (text)=>{
			return cmake_txt;
		});
		await this.buildProcess(async (clear:boolean)=>{
			await cmake.cmake(
				target,
				cmake_dir,
				this.cache_bld,
				[],
				{
					clear,
					config:true,
					build:true,
				});
		});
		////////////
		//copy out//
		////////////
		console.log('coping out..')
		// include
		var header_filter = (x:string)=>files.filterName(x, ['*.h', '*.hpp']);
		await files.copy_recursive(
			cmake_dir, this.dst_inc,
			{ sub_folder_src:true, file_filter:header_filter }
		);
		// static
		await files.copy_recursive(
			this.cache_bld, this.dst_static,
			{ sub_folder_src:true, file_filter:(x:string)=>files.filterName(x, ['*.a','*static*.lib']), symlinks_raster:true }
		);
		this.genCMakeInclude("SQLITE", undefined,
`add_definitions(-DSQLITE_ENABLE_RTREE)
add_definitions(-DSQLITE_ENABLE_FTS4)
add_definitions(-DSQLITE_ENABLE_FTS5)
add_definitions(-DSQLITE_ENABLE_JSON1)
add_definitions(-DSQLITE_ENABLE_RBU)
add_definitions(-DSQLITE_ENABLE_STAT4)`
		);
	}
}
const cmake_txt = `PROJECT(sqlite3)
cmake_minimum_required(VERSION 2.8)

set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_STANDARD 14)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 11)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

include_directories(\${CMAKE_SOURCE_DIR}/src)
add_library(sqlite3 STATIC src/sqlite3.c src/sqlite3.h src/sqlite3ext.h)

add_definitions(-DSQLITE_ENABLE_RTREE)
add_definitions(-DSQLITE_ENABLE_FTS4)
add_definitions(-DSQLITE_ENABLE_FTS5)
add_definitions(-DSQLITE_ENABLE_JSON1)
add_definitions(-DSQLITE_ENABLE_RBU)
add_definitions(-DSQLITE_ENABLE_STAT4)
`;