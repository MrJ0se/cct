import {mkdir_recursive} from './files';

export default async function unzip(src:string, dest:string) {
	const decompress = require('decompress');
	const decompressTarxz = require('decompress-tarxz');
	const decompressTargz = require('decompress-targz');
	mkdir_recursive(dest);
	await decompress(src, dest, src.indexOf('.zip')==src.length-4?undefined:{plugins:[
		decompressTarxz(),
		decompressTargz()
	]});
}