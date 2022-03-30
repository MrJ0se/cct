import express from 'express';
import ws from 'ws';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import bodyParser from 'body-parser';
import multer from 'multer';
var keypath = path.resolve(__dirname,'../../rsc/ssl/cert');
var privateKey  = fs.readFileSync(keypath + '.key', 'utf8');
var certificate = fs.readFileSync(keypath + '.crt', 'utf8');

export function runTestServer (module_loader:string) {
	var app = express();

	app.use(function (req, res, next) {
		res.set('Cross-Origin-Opener-Policy', 'same-origin');
		res.set('Cross-Origin-Embedder-Policy', 'require-corp');
		next();
	});

	app.use(express.static("./"));
	app.get('/', (req, res)=>{
		res.send(main.replace(/\$\?\$/g, module_loader));
	});
	app.get('/loader', (req, res)=>{
		res.send(loader.replace(/\$\?\$/g, module_loader));
	});
	app.get('/noloader', (req, res)=>{
		res.send(noloader.replace(/\$\?\$/g, module_loader));
	});
	app.get('/module', (req, res)=>{
		res.send(modulehtml.replace(/\$\?\$/g, module_loader));
	});
	app.use(bodyParser.urlencoded({ extended: false }));
	app.use(bodyParser.json());
	app.post('/post', (req, res)=>{
		res.setHeader('Content-Type', 'text/plain')
		res.write('you posted:\n')

		var x = JSON.stringify(req.body, null, 2);
		console.log("/post received:\n"+x);
		res.end(x)
	});
	/*app.post('/mult', (req,res)=>{
		req.pipe(process.stdout);
		res.send("teste");
	});*/
	app.post('/mult', multer({storage:multer.memoryStorage()}).any(), (req,res)=>{
		res.setHeader('Content-Type', 'text/plain')
		res.write('you posted:\n');

		var x = JSON.stringify(req.files, null, 2) + JSON.stringify(req.body, null, 2);
		console.log("/multi received:\n"+x);
		res.end(x)
	});

	var httpsserver = https.createServer({ key: privateKey,cert: certificate}, app);
	httpsserver.listen((3000), () =>{
		console.log ('[WASM UTILS] running test server at port 3000');
	});

	const wss = new ws.Server({server:httpsserver});
	wss.on('connection', (socket)=>{
		socket.on('close', ()=>{
			console.log("WS: received close");
		});
		socket.on('message', (data)=>{
			console.log("WS msg:"+data);
			socket.send("received!");
		});
		socket.on('error',(error) =>{
			console.error('WS error:'+error);
		});
		console.log('WS: new client');
	});
}

var main =
`<html>
	<head>
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
	</head>
	<body>
		<h2>$?$</h2>
		<a href="/module"><button>Test Module with loader</button></a>
		<a href="/loader"><button>Test with default loader</button></a>
		<a href="/noloader"><button>Test with embed loader</button></a>
		<hr>
		<h2>test post</h2>
		<form action="/post" enctype="application/x-www-form-urlencoded" method="post">
		  <label for="fname">First name:</label>
		  <input type="text" id="fname" name="fname"><br><br>
		  <label for="lname">Last name:</label>
		  <input type="text" id="lname" name="lname"><br><br>
		  <input type="submit" value="Submit">
		</form>
		<hr>
		<h2>test mult</h2>
		<form action="/mult" enctype="multipart/form-data" method="post">
		  <label for="fname">First name:</label>
		  <input type="text" id="fname" name="fname"><br><br>
		  <label for="lname">Last name:</label>
		  <input type="text" id="lname" name="lname"><br><br>
		  <input type="submit" value="Submit">
		</form>
	</body>
</html>`
;
var loader =
`<html>
	<head>
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
	</head>
	<body>
		<div>
			<canvas width="500" height="500" style="border-bottom:2px solid green;" id="webgl"></canvas>
			<div class="output"></div>
		</div>
		<script>
var hconsole = document.body.querySelector('.output');
var Module = {
	preRun: [],
	postRun: [],
	print: (text)=>{
		hconsole.innerHTML+=\`<span>\${text}</span><br>\`;
	},
	printErr: function(text) {
		if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
		hconsole.innerHTML+=\`<span style="color:red;">\${text}</span><br>\`;
	},
	canvas:(function() {
		var canvas = document.getElementById('webgl');

		canvas.addEventListener("webglcontextlost", function(e) { alert('WebGL context lost. You will need to reload the page.'); e.preventDefault(); }, false);

		return canvas;
	})(),
	setStatus: function(text) {
		hconsole.innerHTML+=\`<span style="color:#8c7c2b;">\${text}</span><br>\`;
	},
	totalDependencies: 0,
	monitorRunDependencies: function(left) {
		this.totalDependencies = Math.max(this.totalDependencies, left);
		Module.setStatus(left ? 'Preparing... (' + (this.totalDependencies-left) + '/' + this.totalDependencies + ')' : 'All downloads complete.');
	}
};
Module.setStatus('Downloading...');
window.onerror = function(event) {
	Module.setStatus('Exception thrown, see JavaScript console');
	Module.setStatus = function(text) {
		if (text) Module.printErr('[post-exception status] ' + text);
	};
};
		</script>
		<script src="/$?$.js"></script>
	</body>
</html>`;
var noloader =
`<html>
	<head>
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
	</head>
	<body>
		<script src="/$?$.js"></script>
	</body>
</html>`;

var modulehtml =
`<html>
	<head>
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
	</head>
	<body>
		<div>
			<canvas width="500" height="500" style="border-bottom:2px solid green;" id="webgl"></canvas>
			<div class="output"></div>
		</div>
		<script>
var exports = {};
		</script>
		<script src="/$?$.js"></script>
		<script>
var hconsole = document.body.querySelector('.output');
var Module = {
	preRun: [],
	postRun: [],
	print: (text)=>{
		hconsole.innerHTML+=\`<span>\${text}</span><br>\`;
	},
	printErr: function(text) {
		if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
		hconsole.innerHTML+=\`<span style="color:red;">\${text}</span><br>\`;
	},
	canvas:(function() {
		var canvas = document.getElementById('webgl');

		canvas.addEventListener("webglcontextlost", function(e) { alert('WebGL context lost. You will need to reload the page.'); e.preventDefault(); }, false);

		return canvas;
	})(),
	setStatus: function(text) {
		hconsole.innerHTML+=\`<span style="color:#8c7c2b;">\${text}</span><br>\`;
	},
	totalDependencies: 0,
	monitorRunDependencies: function(left) {
		this.totalDependencies = Math.max(this.totalDependencies, left);
		Module.setStatus(left ? 'Preparing... (' + (this.totalDependencies-left) + '/' + this.totalDependencies + ')' : 'All downloads complete.');
	}
};
Module.setStatus('Downloading...');
window.onerror = function(event) {
	Module.setStatus('Exception thrown, see JavaScript console');
	Module.setStatus = function(text) {
		if (text) Module.printErr('[post-exception status] ' + text);
	};
};
exports["$?$Module"](Module);
		</script>
	</body>
</html>`;
