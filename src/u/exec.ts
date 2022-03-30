import * as childp from 'child_process';
import * as fu from './files';
import * as def from '../def';

export function joinCommandLine(line:string[]):string {
	return line.map((x)=>{
		if (x.indexOf(' ') < 0)
			return x;
		return `"${x}"`;
	}).join(' ');
}
export function splitCommandLine(line:string):string[] {
	var s = 0;
	var i = 0;
	var e = line.length;
	var incontent = true;
	var inquote = false;
	var frags:string[] = [];
	
	for (; i < e; i++) {
		if (inquote) {
			if (line[i] == '"')
				inquote = false;
		} else if (line[i] == '"') {
			if (!incontent) {
				s = i;
				incontent = true;
			}
			inquote = true;
		}
		else if (line[i] == ' ') {
			if (incontent) {
				frags.push(line.substr(s, i - s));
				incontent = false;
			}
		} else if (!incontent) {
			s = i;
			incontent = true;
		}
	}
	if (incontent) 
		frags.push(line.substr(s));
	return frags.map((v)=>{
		if (v.length> 0 && v[0] == '"' && v[v.length-1] == '"')
			return v.substr(1, v.length - 2);
		return v;
	});
}
//execute and pipe it for current console.
export function execPiped(cmd:string[]|string, cwd:string, env?:any):Promise<number> {
	if (typeof cmd == "string")
		cmd = splitCommandLine(cmd);
	var program = cmd[0][0] == '"'?cmd[0].substr(1, cmd[0].length - 2):cmd[0];
	var args = cmd.slice(1);
	var proc = childp.spawn(program, args, {cwd, env});
	proc.stdout.pipe(process.stdout);
	proc.stderr.pipe(process.stderr);
	return new Promise((resolve)=>{
		proc.on('close', (code:number) => {
			resolve(code);
		});
	});
}

export async function execPipedVerbose(cmd:string[]|string, cwd:string, env?:any):Promise<number> {
	var print = 'Exec: '+(Array.isArray(cmd)?joinCommandLine(cmd):cmd);
	console.log(def.ColorCode.BgWhite+def.ColorCode.FgBlack+print+def.ColorCode.Reset+`\n{\n  working dir: ${JSON.stringify(cwd)}\n  custom env vars: ${JSON.stringify(env)}\n}\n`);
	var code = await execPiped(cmd, cwd, env);
	console.log(
		(code == 0?def.ColorCode.BgGreen:def.ColorCode.BgRed)+def.ColorCode.FgWhite+
		'End With Code: '+code+def.ColorCode.Reset
	);
	return code;
}
//execute and return all output as string.
export function execOutString(cmd:string[]|string, cwd?:string, env?:any):Promise<{str:string,code:number}> {
	if (typeof cmd == "string")
		cmd = splitCommandLine(cmd);
	var program = cmd[0][0] == '"'?cmd[0].substr(1, cmd[0].length - 2):cmd[0];
	var args = cmd.slice(1);
	var proc = childp.spawn(program, args, {cwd, env});
	var str = '';
	proc.stdout.on('data',(chunk)=>{
		str+=chunk;
	})
	return new Promise((resolve)=>{
		proc.on('close', (code:number) => {
			resolve({str,code});
		});
	});
}
//execute and return if has returned a without error?
export async function execNoError(line:string[]|string, cwd?:string, env?:any):Promise<boolean> {
	if (Array.isArray(line))
		line = joinCommandLine(line);
	return (await new Promise((resolve)=>{
		childp.exec(line as string, {cwd, env}, (error, stdout, stderr)=>{
			resolve(error == null);
		});
	})) as boolean;
}
export async function execGitClone(repo:string[]|string, dest:string) {
	fu.mkdir_recursive(dest);
	return await execNoError(`git clone --recursive ${repo}`, dest);
}