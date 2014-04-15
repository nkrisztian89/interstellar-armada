/**
 * @fileOverview This file provides limited functionality to interact with
 * EgomModel 3D models, including loading the data from EgomModel XML files.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1
 */

/**
 * Creates a new line object for an EgomModel.
 * @param a The index of the starting vertex of the line.
 * @param b The index of the end vertex of the line.
 * @param red The red component of the line's color.
 * @param green The green component of the line's color.
 * @param blue The blue component of the line's color.
 * @param luminosity The luminosity of the line.
 * @param nx The X coordinate of the normal vector associated with the line.
 * @param ny The Y coordinate of the normal vector associated with the line.
 * @param nz The Z coordinate of the normal vector associated with the line.
 */
function Line(a,b,red,green,blue,luminosity,nx,ny,nz) {
	this.a=a;
	this.b=b;
	this.red=red;
	this.green=green;
	this.blue=blue;
	this.luminosity=luminosity;
	this.nx=nx;
	this.ny=ny;
	this.nz=nz;
}

function Triangle(a,b,c,red,green,blue,alpha,luminosity,shininess,tax,tay,tbx,tby,tcx,tcy,nax,nay,naz,nbx,nby,nbz,ncx,ncy,ncz) {
	this.a=a;
	this.b=b;
	this.c=c;
	this.red=red;
	this.green=green;
	this.blue=blue;
	this.alpha=alpha;
	this.luminosity=luminosity;
	this.shininess=shininess;
	this.tax=tax;
	this.tay=tay;
	this.tbx=tbx;
	this.tby=tby;
	this.tcx=tcx;
	this.tcy=tcy;
	this.nax=nax;
	this.nay=nay;
	this.naz=naz;
	this.nbx=nbx;
	this.nby=nby;
	this.nbz=nbz;
	this.ncx=ncx;
	this.ncy=ncy;
	this.ncz=ncz;
}

function EgomModel(filename) {
	this.vertices = new Array();
	this.lines = new Array();
	this.triangles = new Array();
	this.size = 0;
	
	this.filename=filename;
	if(filename!==undefined) {
		this.loadFromFile(filename);
	}
	
	this.bufferStart = 0;
	this.bufferStartLine = 0;
}

EgomModel.prototype.clear = function() {
	this.vertices = new Array();
	this.lines = new Array();
	this.triangles = new Array();
	this.size = 0;
	
	this.filename=null;
	
	this.bufferStart = 0;
	this.bufferStartLine = 0;
};

EgomModel.prototype.loadFromFile = function(filename) {
	var request = new XMLHttpRequest();
	request.open('GET', filename+"?12345", false); //timestamp added to URL to bypass cache
	request.send(null);
	modelSource = request.responseXML;
	
	var nVertices = parseInt(modelSource.getElementsByTagName("vertices")[0].getAttribute("count"));
	this.vertices = new Array();
	vertexTags = modelSource.getElementsByTagName("vertex");
	for(var i=0; i<nVertices; i++) {
		var index=vertexTags[i].getAttribute("i");
		if (this.vertices.length<index) {
			for(var j=this.vertices.length;j<index;j++) {
				this.vertices[j]=[0.0,0.0,0.0];
			}
		}
		this.vertices[index]=[
			vertexTags[i].getAttribute("x")/10000.0,
			vertexTags[i].getAttribute("y")/-10000.0,
			vertexTags[i].getAttribute("z")/-10000.0];
		if(Math.abs(this.vertices[index][0]*2)>this.size) {
			this.size=Math.abs(this.vertices[index][0]*2);
		}
		if(Math.abs(this.vertices[index][1]*2)>this.size) {
			this.size=Math.abs(this.vertices[index][1]*2);
		}
		if(Math.abs(this.vertices[index][2]*2)>this.size) {
			this.size=Math.abs(this.vertices[index][2]*2);
		}
	}
	
	var nLines = parseInt(modelSource.getElementsByTagName("lines")[0].getAttribute("count"));
	this.lines = new Array(nLines);
	lineTags = modelSource.getElementsByTagName("line");
	for(var i=0; i<nLines; i++) {
		this.lines[i]=new Line(
			lineTags[i].getAttribute("a"),
			lineTags[i].getAttribute("b"),
			lineTags[i].getAttribute("red")/255.0,
			lineTags[i].getAttribute("green")/255.0,
			lineTags[i].getAttribute("blue")/255.0,
			lineTags[i].getAttribute("luminosity")/255.0,
			lineTags[i].getAttribute("nx"),
			-lineTags[i].getAttribute("ny"),
			-lineTags[i].getAttribute("nz")
			);
	}
	
	var nTriangles = parseInt(modelSource.getElementsByTagName("triangles")[0].getAttribute("count"));
	this.triangles = new Array(nTriangles);
	triangleTags = modelSource.getElementsByTagName("triangle");
	for(var i=0; i<nTriangles; i++) {
		this.triangles[i]=new Triangle(
			triangleTags[i].getAttribute("a"),
			triangleTags[i].getAttribute("b"),
			triangleTags[i].getAttribute("c"),
			triangleTags[i].getAttribute("red")/255.0,
			triangleTags[i].getAttribute("green")/255.0,
			triangleTags[i].getAttribute("blue")/255.0,
			(255-triangleTags[i].getAttribute("alpha"))/255.0,
			triangleTags[i].getAttribute("luminosity")/255.0,
			triangleTags[i].getAttribute("shininess"),
			triangleTags[i].getAttribute("tax"),
			triangleTags[i].getAttribute("tay"),
			triangleTags[i].getAttribute("tbx"),
			triangleTags[i].getAttribute("tby"),
			triangleTags[i].getAttribute("tcx"),
			triangleTags[i].getAttribute("tcy"),
			triangleTags[i].getAttribute("nax"),
			-triangleTags[i].getAttribute("nay"),
			-triangleTags[i].getAttribute("naz"),
			triangleTags[i].getAttribute("nbx"),
			-triangleTags[i].getAttribute("nby"),
			-triangleTags[i].getAttribute("nbz"),
			triangleTags[i].getAttribute("ncx"),
			-triangleTags[i].getAttribute("ncy"),
			-triangleTags[i].getAttribute("ncz")
			);
	}
	
	//alert("model with "+nVertices+" vertices loaded!");
	
	//xmlDoc.getElementsByTagName("to")[0].childNodes[0].nodeValue;
	//getAttribute('category')
};

EgomModel.prototype.getBuffers = function(lineMode) {
	if(lineMode===true) {
		var vertexData = new Float32Array(this.lines.length*6);
		for(var i=0;i<this.lines.length;i++) {
			vertexData[i*6]=this.vertices[this.lines[i].a][0];
			vertexData[i*6+1]=this.vertices[this.lines[i].a][1];
			vertexData[i*6+2]=this.vertices[this.lines[i].a][2];
			vertexData[i*6+3]=this.vertices[this.lines[i].b][0];
			vertexData[i*6+4]=this.vertices[this.lines[i].b][1];
			vertexData[i*6+5]=this.vertices[this.lines[i].b][2];
		}
		var texCoordData = new Float32Array(this.lines.length*4);
		for(var i=0;i<this.lines.length;i++) {
			texCoordData[i*4]=0.0;
			texCoordData[i*4+1]=1.0;
			texCoordData[i*4+2]=1.0;
			texCoordData[i*4+3]=1.0;
		}
		var normalData = new Float32Array(this.lines.length*6);
		for(var i=0;i<this.lines.length;i++) {
			normalData[i*6]=this.lines[i].nx;
			normalData[i*6+1]=this.lines[i].ny;
			normalData[i*6+2]=this.lines[i].nz;
			normalData[i*6+3]=this.lines[i].nx;
			normalData[i*6+4]=this.lines[i].ny;
			normalData[i*6+5]=this.lines[i].nz;
		}
		var colorData = new Float32Array(this.lines.length*8);
		for(var i=0;i<this.lines.length;i++) {
			colorData[i*8]=this.lines[i].red;
			colorData[i*8+1]=this.lines[i].green;
			colorData[i*8+2]=this.lines[i].blue;
			colorData[i*8+3]=1.0;
			colorData[i*8+4]=this.lines[i].red;
			colorData[i*8+5]=this.lines[i].green;
			colorData[i*8+6]=this.lines[i].blue;
			colorData[i*8+7]=1.0;
		}
		var luminosityData = new Float32Array(this.lines.length*2);
		for(var i=0;i<this.lines.length;i++) {
			luminosityData[i*2]=this.lines[i].luminosity;
			luminosityData[i*2+1]=this.lines[i].luminosity;
		}
		var shininessData = new Float32Array(this.lines.length*2);
		for(var i=0;i<this.lines.length;i++) {
			shininessData[i*2]=0;
			shininessData[i*2+1]=0;
		}
	} else {
		var vertexData = new Float32Array(this.triangles.length*9);
		for(var i=0;i<this.triangles.length;i++) {
			vertexData[i*9]=this.vertices[this.triangles[i].a][0];
			vertexData[i*9+1]=this.vertices[this.triangles[i].a][1];
			vertexData[i*9+2]=this.vertices[this.triangles[i].a][2];
			vertexData[i*9+3]=this.vertices[this.triangles[i].b][0];
			vertexData[i*9+4]=this.vertices[this.triangles[i].b][1];
			vertexData[i*9+5]=this.vertices[this.triangles[i].b][2];
			vertexData[i*9+6]=this.vertices[this.triangles[i].c][0];
			vertexData[i*9+7]=this.vertices[this.triangles[i].c][1];
			vertexData[i*9+8]=this.vertices[this.triangles[i].c][2];
		}
		var texCoordData = new Float32Array(this.triangles.length*6);
		for(var i=0;i<this.triangles.length;i++) {
			texCoordData[i*6]=this.triangles[i].tax;
			texCoordData[i*6+1]=this.triangles[i].tay;
			texCoordData[i*6+2]=this.triangles[i].tbx;
			texCoordData[i*6+3]=this.triangles[i].tby;
			texCoordData[i*6+4]=this.triangles[i].tcx;
			texCoordData[i*6+5]=this.triangles[i].tcy;
		}
		var normalData = new Float32Array(this.triangles.length*9);
		for(var i=0;i<this.triangles.length;i++) {
			normalData[i*9]=this.triangles[i].nax;
			normalData[i*9+1]=this.triangles[i].nay;
			normalData[i*9+2]=this.triangles[i].naz;
			normalData[i*9+3]=this.triangles[i].nbx;
			normalData[i*9+4]=this.triangles[i].nby;
			normalData[i*9+5]=this.triangles[i].nbz;
			normalData[i*9+6]=this.triangles[i].ncx;
			normalData[i*9+7]=this.triangles[i].ncy;
			normalData[i*9+8]=this.triangles[i].ncz;
		}
		var colorData = new Float32Array(this.triangles.length*12);
		for(var i=0;i<this.triangles.length;i++) {
			colorData[i*12]=this.triangles[i].red;
			colorData[i*12+1]=this.triangles[i].green;
			colorData[i*12+2]=this.triangles[i].blue;
			colorData[i*12+3]=this.triangles[i].alpha;
			colorData[i*12+4]=this.triangles[i].red;
			colorData[i*12+5]=this.triangles[i].green;
			colorData[i*12+6]=this.triangles[i].blue;
			colorData[i*12+7]=this.triangles[i].alpha;
			colorData[i*12+8]=this.triangles[i].red;
			colorData[i*12+9]=this.triangles[i].green;
			colorData[i*12+10]=this.triangles[i].blue;
			colorData[i*12+11]=this.triangles[i].alpha;
		}
		var luminosityData = new Float32Array(this.triangles.length*3);
		for(var i=0;i<this.triangles.length;i++) {
			luminosityData[i*3]=this.triangles[i].luminosity;
			luminosityData[i*3+1]=this.triangles[i].luminosity;
			luminosityData[i*3+2]=this.triangles[i].luminosity;
		}
		var shininessData = new Float32Array(this.triangles.length*3);
		for(var i=0;i<this.triangles.length;i++) {
			shininessData[i*3]=this.triangles[i].shininess;
			shininessData[i*3+1]=this.triangles[i].shininess;
			shininessData[i*3+2]=this.triangles[i].shininess;
		}
	}
	
	return {
		"position": vertexData,
		"texCoord": texCoordData,
		"normal": normalData,
		"color": colorData,
		"luminosity": luminosityData,
		"shininess": shininessData
		};
};

EgomModel.prototype.setupBuffers = function(gl,program) {
	var bufferData=this.getBuffers();
	var vertexData=bufferData[0];
	var texCoorddata=bufferData[1];
	var normalData=bufferData[2];
	var colorData=bufferData[3];
	var luminosityData=bufferData[4];
	var shininessData=bufferData[5];
	
	// look up where the vertex data needs to go.
	var positionLocation = gl.getAttribLocation(program, "a_position");
	// Create a buffer and put a single clipspace rectangle in
	// it (2 triangles)
	var buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(
		gl.ARRAY_BUFFER, 
		vertexData,
		gl.STATIC_DRAW);
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
	
	// look up where the texture coordinates need to go.
	var texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
	// provide texture coordinates for the rectangle.
	var texCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		texCoordData,
		gl.STATIC_DRAW);
	gl.enableVertexAttribArray(texCoordLocation);
	gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
	
	// look up where the normal data needs to go.
	var normalLocation = gl.getAttribLocation(program, "a_normal");
	var normalBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER, 
		normalData,
		gl.STATIC_DRAW);
	gl.enableVertexAttribArray(normalLocation);
	gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);
	
	var colorLocation = gl.getAttribLocation(program, "a_color");
	var colorBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER, 
		colorData,
		gl.STATIC_DRAW);
	gl.enableVertexAttribArray(colorLocation);
	gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);
	
	var luminosityLocation = gl.getAttribLocation(program, "a_luminosity");
	var luminosityBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, luminosityBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER, 
		luminosityData,
		gl.STATIC_DRAW);
	gl.enableVertexAttribArray(luminosityLocation);
	gl.vertexAttribPointer(luminosityLocation, 1, gl.FLOAT, false, 0, 0);
	
	var shininessLocation = gl.getAttribLocation(program, "a_shininess");
	var shininessBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, shininessBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER, 
		shininessData,
		gl.STATIC_DRAW);
	gl.enableVertexAttribArray(shininessLocation);
	gl.vertexAttribPointer(shininessLocation, 1, gl.FLOAT, false, 0, 0);
};

EgomModel.prototype.render = function(gl,lineMode) {
	if (lineMode===true) {
		gl.drawArrays(gl.LINES, this.bufferStartLines, 2*this.lines.length);
	} else {
		gl.drawArrays(gl.TRIANGLES, this.bufferStart, 3*this.triangles.length);
	}
};


EgomModel.prototype.addCuboid = function(x,y,z,width,height,depth,color,luminosity, textureCoordinates, cullFace) {
	// front
	this.vertices.push([x-width/2,y-height/2,z+depth/2]);
	this.vertices.push([x+width/2,y-height/2,z+depth/2]);
	this.vertices.push([x+width/2,y+height/2,z+depth/2]);
	this.vertices.push([x-width/2,y+height/2,z+depth/2]);
	// back
	this.vertices.push([x-width/2,y+height/2,z-depth/2]);
	this.vertices.push([x+width/2,y+height/2,z-depth/2]);
	this.vertices.push([x+width/2,y-height/2,z-depth/2]);
	this.vertices.push([x-width/2,y-height/2,z-depth/2]);
	// top
	this.vertices.push([x+width/2,y+height/2,z-depth/2]);
	this.vertices.push([x-width/2,y+height/2,z-depth/2]);
	this.vertices.push([x-width/2,y+height/2,z+depth/2]);
	this.vertices.push([x+width/2,y+height/2,z+depth/2]);
	// bottom
	this.vertices.push([x-width/2,y-height/2,z-depth/2]);
	this.vertices.push([x+width/2,y-height/2,z-depth/2]);
	this.vertices.push([x+width/2,y-height/2,z+depth/2]);
	this.vertices.push([x-width/2,y-height/2,z+depth/2]);
	// right
	this.vertices.push([x+width/2,y-height/2,z-depth/2]);
	this.vertices.push([x+width/2,y+height/2,z-depth/2]);
	this.vertices.push([x+width/2,y+height/2,z+depth/2]);
	this.vertices.push([x+width/2,y-height/2,z+depth/2]);
	// left
	this.vertices.push([x-width/2,y+height/2,z-depth/2]);
	this.vertices.push([x-width/2,y-height/2,z-depth/2]);
	this.vertices.push([x-width/2,y-height/2,z+depth/2]);
	this.vertices.push([x-width/2,y+height/2,z+depth/2]);
		
	var normals = [[0,0,1],[0,0,-1],[0,1,0],[0,-1,0],[1,0,0],[-1,0,0]];
	
	var i0 = this.vertices.length-24;
	
	for(var i=0;i<6;i++) {
		this.triangles.push(new Triangle(i0+(i*4)+0,i0+(i*4)+1,i0+(i*4)+2,color[0],color[1],color[2],color[3],luminosity,0, textureCoordinates[0][0],textureCoordinates[0][1], textureCoordinates[1][0],textureCoordinates[1][1], textureCoordinates[2][0],textureCoordinates[2][1], normals[i][0], normals[i][1], normals[i][2], normals[i][0], normals[i][1], normals[i][2], normals[i][0], normals[i][1], normals[i][2])); 
		this.triangles.push(new Triangle(i0+(i*4)+2,i0+(i*4)+3,i0+(i*4)+0,color[0],color[1],color[2],color[3],luminosity,0, textureCoordinates[2][0],textureCoordinates[2][1], textureCoordinates[3][0],textureCoordinates[3][1], textureCoordinates[0][0],textureCoordinates[0][1], normals[i][0], normals[i][1], normals[i][2], normals[i][0], normals[i][1], normals[i][2], normals[i][0], normals[i][1], normals[i][2])); 
		if (!(cullFace===true)) {
			this.triangles.push(new Triangle(i0+(i*4)+2,i0+(i*4)+1,i0+(i*4)+0,color[0],color[1],color[2],color[3],luminosity,0, textureCoordinates[0][0],textureCoordinates[0][1], textureCoordinates[1][0],textureCoordinates[1][1], textureCoordinates[2][0],textureCoordinates[2][1], -normals[i][0], -normals[i][1], -normals[i][2], -normals[i][0], -normals[i][1], -normals[i][2], -normals[i][0], -normals[i][1], -normals[i][2])); 
			this.triangles.push(new Triangle(i0+(i*4)+0,i0+(i*4)+3,i0+(i*4)+2,color[0],color[1],color[2],color[3],luminosity,0, textureCoordinates[2][0],textureCoordinates[2][1], textureCoordinates[3][0],textureCoordinates[3][1], textureCoordinates[0][0],textureCoordinates[0][1], -normals[i][0], -normals[i][1], -normals[i][2], -normals[i][0], -normals[i][1], -normals[i][2], -normals[i][0], -normals[i][1], -normals[i][2])); 
		}
	}
	
};
