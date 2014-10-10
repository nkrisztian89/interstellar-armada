/**
 * @fileOverview This file provides limited functionality to interact with
 * EgomModel 3D models, including loading the data from EgomModel XML files.
 * EgomModel is a simple 3D modeling library written in object pascal.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1-dev
 */

/**********************************************************************
    Copyright 2014 Krisztián Nagy
    
    This file is part of Interstellar Armada.

    Interstellar Armada is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Interstellar Armada is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Interstellar Armada.  If not, see <http://www.gnu.org/licenses/>.
 ***********************************************************************/

/**
 * Creates a new line object for an EgomModel.
 * @class Represents a line connecting two vertices in a model.
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

function Triangle(a,b,c,red,green,blue,alpha,luminosity,shininess,tax,tay,tbx,tby,tcx,tcy,nax,nay,naz,nbx,nby,nbz,ncx,ncy,ncz,group) {
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
        this.group=group;
}

/**
 * Creates a new 3D model object, and if a file name was given, loads the data
 * from the file. Only Egom XML format is supported.
 * @class Represents a 3D polygonal model. The Egom data stucture is optimized
 * for generating and editing models from the program code.
 * @param {string} filename The name of the file to load the model from. (optional)
 */
function EgomModel(filename) {
        Resource.call(this);
        // properties for file resource management
	this.vertices = new Array();
	this.lines = new Array();
	this.triangles = new Array();
	this.size = 0;
        this._maxX = 0;
        this._minX = 0;
        this._maxY = 0;
        this._minY = 0;
        this._maxZ = 0;
        this._minZ = 0;
        
        this.nOpaqueTriangles = 0;
        this.nTransparentTriangles = 0;
        
        this.filename=filename;
        this.loadRequestSent = false;
        if (filename===undefined) {
            this.setToReady();
        }
	
        // properties for WebGL resource management
        this._addedToContext = new Object();
	this._bufferStart = new Object();
        this._bufferStartTransparent = new Object();
	this._bufferStartLines = new Object();
}

EgomModel.prototype = new Resource();
EgomModel.prototype.constructor = EgomModel;

EgomModel.prototype.getBufferStartForContext = function(context,buffer) {
    if((buffer===undefined) || (buffer==="base")) {
        return this._bufferStart[context];
    }
    if(buffer==="transparent") {
        return this._bufferStartTransparent[context];
    }
    if(buffer==="lines") {
        return this._bufferStartLines[context];
    }
};

EgomModel.prototype.setBufferStartForContext = function(context,buffer,value) {
    if((buffer===undefined) || (buffer==="base")) {
        this._bufferStart[context] = value;
    }
    if(buffer==="transparent") {
        this._bufferStartTransparent[context] = value;
    }
    if(buffer==="lines") {
        this._bufferStartLines[context] = value;
    }
};

EgomModel.prototype.requestLoadFromFile = function() {
    if((this.isReadyToUse()===false)&&(this.loadRequestSent===false)) {
        this.loadRequestSent = true;
        var request = new XMLHttpRequest();
        request.open('GET', this.filename+"?123", true); 
        var self = this;
        request.onreadystatechange = function() {
                if(request.readyState===4) {
                    self.loadFromXML(request.responseXML);
                    self.setToReady();
                }
        };
        request.send(null);
    }
};

EgomModel.prototype.loadFromXML = function(sourceXML) {
	var nVertices = parseInt(sourceXML.getElementsByTagName("vertices")[0].getAttribute("count"));
	this.vertices = new Array();
	var vertexTags = sourceXML.getElementsByTagName("vertex");
        this._maxX = 0;
        this._minX = 0;
        this._maxY = 0;
        this._minY = 0;
        this._maxZ = 0;
        this._minZ = 0;
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
                if(this.vertices[index][0]>this._maxX) {
                    this._maxX = this.vertices[index][0];
                }
                if(this.vertices[index][0]<this._minX) {
                    this._minX = this.vertices[index][0];
                }
                if(this.vertices[index][1]>this._maxY) {
                    this._maxY = this.vertices[index][1];
                }
                if(this.vertices[index][1]<this._minY) {
                    this._minY = this.vertices[index][1];
                }
                if(this.vertices[index][2]>this._maxZ) {
                    this._maxZ = this.vertices[index][2];
                }
                if(this.vertices[index][2]<this._minZ) {
                    this._minZ = this.vertices[index][2];
                }
	}
	
	var nLines = parseInt(sourceXML.getElementsByTagName("lines")[0].getAttribute("count"));
	this.lines = new Array(nLines);
	var lineTags = sourceXML.getElementsByTagName("line");
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
	
	var nTriangles = parseInt(sourceXML.getElementsByTagName("triangles")[0].getAttribute("count"));
	this.triangles = new Array(nTriangles);
	var triangleTags = sourceXML.getElementsByTagName("triangle");
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
			-triangleTags[i].getAttribute("ncz"),
                        (triangleTags[i].hasAttribute("group")?triangleTags[i].getAttribute("group"):0)
			);
                if ((this.triangles[i].alpha<1.0)&&(this.nTransparentTriangles===0)) {
                    this.nTransparentTriangles=nTriangles-i;
                }
	}
        this.nOpaqueTriangles=nTriangles-this.nTransparentTriangles;
};

EgomModel.prototype.getMaxX = function() {
    return this._maxX;
};

EgomModel.prototype.getMinX = function() {
    return this._minX;
};

EgomModel.prototype.getMaxY = function() {
    return this._maxY;
};

EgomModel.prototype.getMinY = function() {
    return this._minY;
};

EgomModel.prototype.getMaxZ = function() {
    return this._maxZ;
};

EgomModel.prototype.getMinZ = function() {
    return this._minZ;
};

EgomModel.prototype.getWidth = function() {
    return this._maxX-this._minX;
};

EgomModel.prototype.getHeight = function() {
    return this._maxY-this._minY;
};

EgomModel.prototype.getDepth = function() {
    return this._maxZ-this._minZ;
};

EgomModel.prototype.addToContext = function(context) {
    if(this._addedToContext[context] !== true) {
        context.addModel(this);
        this._addedToContext[context] = true;
    }
};

/**
 * Clears all previous bindings to managed WebGL contexts.
 */
EgomModel.prototype.clearContextBindings = function() {
    this._addedToContext = new Object();
};

EgomModel.prototype.getBufferData = function(lineMode) {
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
                var groupIndexData = new Float32Array(this.lines.length*2);
		for(var i=0;i<this.lines.length;i++) {
			groupIndexData[i*2]=0;
			groupIndexData[i*2+1]=0;
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
                var groupIndexData = new Float32Array(this.triangles.length*3);
		for(var i=0;i<this.triangles.length;i++) {
			groupIndexData[i*3]=this.triangles[i].group;
			groupIndexData[i*3+1]=this.triangles[i].group;
			groupIndexData[i*3+2]=this.triangles[i].group;
		}
	}
	
	return {
		"position": vertexData,
		"texCoord": texCoordData,
		"normal": normalData,
		"color": colorData,
		"luminosity": luminosityData,
		"shininess": shininessData,
                "groupIndex": groupIndexData,
                "dataSize": (lineMode?this.lines.length*2:this.triangles.length*3)
		};
};

EgomModel.prototype.render = function(context,lineMode) {
    if (lineMode===true) {
        context.gl.drawArrays(context.gl.LINES, this._bufferStartLines[context], 2*this.lines.length);
    } else {
        context.gl.drawArrays(context.gl.TRIANGLES, this._bufferStart[context], 3*this.triangles.length);
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

function uvCoordsOnTexture(left,bottom,right,top,relativeX,relativeY) {
    var result=[0,0];
    result[0]=left+(right-left)*relativeX;
    result[1]=bottom+(top-bottom)*relativeY;
    return result;
}

/**
 * Adds vertices and triangles that form a sphere (UV sphere).
 * @param {number} x The X coordinate of the center.
 * @param {number} y The Y coordinate of the center.
 * @param {number} z The Z coordinate of the center.
 * @param {number} radius The radius of the sphere.
 * @param {number} angles The number of angles one circle should have within the sphere.
 * @param {number[]} color The RGBA components of the desired color of the triangles.
 * @param {number} luminosity The luminosity of the triangles.
 * @param {number} shininess The shininess exponent of the triangles.
 * @param {number[][]} textureCoordinates The coordinate pairs of the texture to map to the sphere: from bottom left counter-clockwise
 * @param {boolean} cullFace Whether to omit the triangles from the inside of the sphere.
 */
EgomModel.prototype.addSphere = function(x,y,z,radius,angles,color,luminosity,shininess,textureCoordinates, cullFace) {    
    // circles with vertices indexed starting from the top, starting from XY and spinned around axis Y
    for (var i=0;i<angles;i++) {
        for (var j=0;j<angles;j++) {
            this.vertices.push([x+radius*Math.sin(j*2*3.1415/angles)*Math.cos(i*2*3.1415/angles),y+radius*Math.cos(j*2*3.1415/angles),z+radius*Math.sin(i*2*3.1415/angles)*Math.sin(j*2*3.1415/angles)]);
        }
    }
    
    var i0 = this.vertices.length-angles*angles;
    
    if((angles%2)===1) {
        this.vertices[i0+(angles+1)/2][0]=x;
        this.vertices[i0+(angles+1)/2][2]=z;
    }
    
    for(var i=0;i<angles;i++) {
        // adding triangles connected to the top
        // the vertex indices:
        var v = [i0+(i*angles),i0+(((i+1)%angles)*angles)+1,i0+(i*angles)+1];
        // the UV texture coordinates:
        var uv1 = uvCoordsOnTexture(textureCoordinates[0][0],textureCoordinates[0][1],textureCoordinates[2][0],textureCoordinates[2][1],1/(2*angles)+(i/angles),1);
        var uv2 = uvCoordsOnTexture(textureCoordinates[0][0],textureCoordinates[0][1],textureCoordinates[2][0],textureCoordinates[2][1],(i+1)/angles,1-2/angles);
        var uv3 = uvCoordsOnTexture(textureCoordinates[0][0],textureCoordinates[0][1],textureCoordinates[2][0],textureCoordinates[2][1],i/angles,1-2/angles);
        // the normal vectors:
        var n1 = [(this.vertices[v[0]][0]-x)/radius,(this.vertices[v[0]][1]-y)/radius,(this.vertices[v[0]][2]-z)/radius];
        var n2 = [(this.vertices[v[1]][0]-x)/radius,(this.vertices[v[1]][1]-y)/radius,(this.vertices[v[1]][2]-z)/radius];
        var n3 = [(this.vertices[v[2]][0]-x)/radius,(this.vertices[v[2]][1]-y)/radius,(this.vertices[v[2]][2]-z)/radius];
        this.triangles.push(new Triangle(v[0],v[1],v[2],color[0],color[1],color[2],color[3],luminosity,shininess,
            uv1[0],uv1[1],uv2[0],uv2[1],uv3[0],uv3[1],
            n1[0],n1[1],n1[2],n2[0],n2[1],n2[2],n3[0],n3[1],n3[2]));
        if(cullFace!==true) {
            this.triangles.push(new Triangle(v[0],v[2],v[1],color[0],color[1],color[2],color[3],luminosity,shininess,
                uv1[0],uv1[1],uv3[0],uv3[1],uv2[0],uv2[1],
                -n1[0],-n1[1],-n1[2],-n3[0],-n3[1],-n3[2],-n2[0],-n2[1],-n2[2]));
        }
        // triangles connected to the bottom
        if ((angles%2)===0) {
            v = [i0+(i*angles)+angles/2,i0+(i*angles)+angles/2-1,i0+(((i+1)%angles)*angles)+angles/2-1];
        } else {
            v= [i0+(angles+1)/2,i0+(i*angles)+(angles-1)/2,i0+(((i+1)%angles)*angles)+(angles-1)/2];
        }
        uv1 = uvCoordsOnTexture(textureCoordinates[0][0],textureCoordinates[0][1],textureCoordinates[2][0],textureCoordinates[2][1],1/(2*angles)+(i/angles),0);
        uv2 = uvCoordsOnTexture(textureCoordinates[0][0],textureCoordinates[0][1],textureCoordinates[2][0],textureCoordinates[2][1],i/angles,((angles%2)===0)?2/angles:1/angles);
        uv3 = uvCoordsOnTexture(textureCoordinates[0][0],textureCoordinates[0][1],textureCoordinates[2][0],textureCoordinates[2][1],(i+1)/angles,((angles%2)===0)?2/angles:1/angles);
        n1 = [(this.vertices[v[0]][0]-x)/radius,(this.vertices[v[0]][1]-y)/radius,(this.vertices[v[0]][2]-z)/radius];
        n2 = [(this.vertices[v[1]][0]-x)/radius,(this.vertices[v[1]][1]-y)/radius,(this.vertices[v[1]][2]-z)/radius];
        n3 = [(this.vertices[v[2]][0]-x)/radius,(this.vertices[v[2]][1]-y)/radius,(this.vertices[v[2]][2]-z)/radius];
        this.triangles.push(new Triangle(v[0],v[1],v[2],color[0],color[1],color[2],color[3],luminosity,shininess,
            uv1[0],uv1[1],uv2[0],uv2[1],uv3[0],uv3[1],
            n1[0],n1[1],n1[2],n2[0],n2[1],n2[2],n3[0],n3[1],n3[2]));
        if(cullFace!==true) {
            this.triangles.push(new Triangle(v[0],v[2],v[1],color[0],color[1],color[2],color[3],luminosity,shininess,
                uv1[0],uv1[1],uv3[0],uv3[1],uv2[0],uv2[1],
                -n1[0],-n1[1],-n1[2],-n3[0],-n3[1],-n3[2],-n2[0],-n2[1],-n2[2]));
        }
        // quads between the two subsequent circles
        for (var j=1;j<angles/2-1;j++) {
            v=[i0+(i*angles)+j,i0+(((i+1)%angles)*angles)+j+1,i0+(i*angles)+j+1];
            uv1 = uvCoordsOnTexture(textureCoordinates[0][0],textureCoordinates[0][1],textureCoordinates[2][0],textureCoordinates[2][1],i/angles,1-2*j/angles);
            uv2 = uvCoordsOnTexture(textureCoordinates[0][0],textureCoordinates[0][1],textureCoordinates[2][0],textureCoordinates[2][1],(i+1)/angles,1-2*(j+1)/angles);
            uv3 = uvCoordsOnTexture(textureCoordinates[0][0],textureCoordinates[0][1],textureCoordinates[2][0],textureCoordinates[2][1],i/angles,1-2*(j+1)/angles);
            n1 = [(this.vertices[v[0]][0]-x)/radius,(this.vertices[v[0]][1]-y)/radius,(this.vertices[v[0]][2]-z)/radius];
            n2 = [(this.vertices[v[1]][0]-x)/radius,(this.vertices[v[1]][1]-y)/radius,(this.vertices[v[1]][2]-z)/radius];
            n3 = [(this.vertices[v[2]][0]-x)/radius,(this.vertices[v[2]][1]-y)/radius,(this.vertices[v[2]][2]-z)/radius];
            this.triangles.push(new Triangle(v[0],v[1],v[2],color[0],color[1],color[2],color[3],luminosity,shininess,
                uv1[0],uv1[1],uv2[0],uv2[1],uv3[0],uv3[1],
                n1[0],n1[1],n1[2],n2[0],n2[1],n2[2],n3[0],n3[1],n3[2]));
            if(cullFace!==true) {
                this.triangles.push(new Triangle(v[0],v[2],v[1],color[0],color[1],color[2],color[3],luminosity,shininess,
                    uv1[0],uv1[1],uv3[0],uv3[1],uv2[0],uv2[1],
                    -n1[0],-n1[1],-n1[2],-n3[0],-n3[1],-n3[2],-n2[0],-n2[1],-n2[2]));
            }
            v=[i0+(((i+1)%angles)*angles)+j+1,i0+(i*angles)+j,i0+(((i+1)%angles)*angles)+j];
            uv1 = uvCoordsOnTexture(textureCoordinates[0][0],textureCoordinates[0][1],textureCoordinates[2][0],textureCoordinates[2][1],(i+1)/angles,1-2*(j+1)/angles);
            uv2 = uvCoordsOnTexture(textureCoordinates[0][0],textureCoordinates[0][1],textureCoordinates[2][0],textureCoordinates[2][1],i/angles,1-2*j/angles);
            uv3 = uvCoordsOnTexture(textureCoordinates[0][0],textureCoordinates[0][1],textureCoordinates[2][0],textureCoordinates[2][1],(i+1)/angles,1-2*j/angles);
            n1 = [(this.vertices[v[0]][0]-x)/radius,(this.vertices[v[0]][1]-y)/radius,(this.vertices[v[0]][2]-z)/radius];
            n2 = [(this.vertices[v[1]][0]-x)/radius,(this.vertices[v[1]][1]-y)/radius,(this.vertices[v[1]][2]-z)/radius];
            n3 = [(this.vertices[v[2]][0]-x)/radius,(this.vertices[v[2]][1]-y)/radius,(this.vertices[v[2]][2]-z)/radius];
            this.triangles.push(new Triangle(v[0],v[1],v[2],color[0],color[1],color[2],color[3],luminosity,shininess,
                uv1[0],uv1[1],uv2[0],uv2[1],uv3[0],uv3[1],
                n1[0],n1[1],n1[2],n2[0],n2[1],n2[2],n3[0],n3[1],n3[2]));
            if(cullFace!==true) {
                this.triangles.push(new Triangle(v[0],v[2],v[1],color[0],color[1],color[2],color[3],luminosity,shininess,
                    uv1[0],uv1[1],uv3[0],uv3[1],uv2[0],uv2[1],
                    -n1[0],-n1[1],-n1[2],-n3[0],-n3[1],-n3[2],-n2[0],-n2[1],-n2[2]));
            }    
        }
    }
};

/**
 * Sets up and returns a simple EgomModel that is suitable to be used for
 * rendering Full Viewport Quads. (FVQ)
 * @returns {EgomModel} An FVQ model.
 */
function fvqModel() {
	var result = new EgomModel();
	result.vertices.push([-1,-1,1]);
	result.vertices.push([1,-1,1]);
	result.vertices.push([1,1,1]);
	result.vertices.push([-1,1,1]);
	
	result.triangles.push(new Triangle(0,1,2,1.0,1.0,1.0,1.0,0,0, 0,1, 1,1, 1,0, 0,0,1, 0,0,1, 0,0,1)); 
	result.triangles.push(new Triangle(2,3,0,1.0,1.0,1.0,1.0,0,0, 1,0, 0,0, 0,1, 0,0,1, 0,0,1, 0,0,1)); 
		
	return result;
}

/**
 * Sets up and returns a simple EgomModel that contains a two sided XY square.
 * @returns {EgomModel} An XY square model.
 */
function squareModel() {
	var result = new EgomModel();
	result.vertices.push([-1,-1,0]);
	result.vertices.push([1,-1,0]);
	result.vertices.push([1,1,0]);
	result.vertices.push([-1,1,0]);
	
	result.triangles.push(new Triangle(0,1,2,1.0,1.0,1.0,1.0,0,0, 0,1, 1,1, 1,0, 0,0,1, 0,0,1, 0,0,1)); 
	result.triangles.push(new Triangle(2,3,0,1.0,1.0,1.0,1.0,0,0, 1,0, 0,0, 0,1, 0,0,1, 0,0,1, 0,0,1)); 
	result.triangles.push(new Triangle(2,1,0,1.0,1.0,1.0,1.0,0,0, 0,1, 1,1, 1,0, 0,0,-1, 0,0,-1, 0,0,-1)); 
	result.triangles.push(new Triangle(0,3,2,1.0,1.0,1.0,1.0,0,0, 1,0, 0,0, 0,1, 0,0,-1, 0,0,-1, 0,0,-1)); 
		
	return result;
}

/**
 * Sets up and returns a simple EgomModel that is suitable for rendering
 * energy projectiles by containing one square to serve as the side view and
 * a set of intersecting squares that are perpendicular to the first one, to
 * serve as the front view(s) of the projectile.
 * @param {number[]} intersections A set of numbers between -1 and 1
 * representing the points where the squares serving as the front view should 
 * be created along the side view square.
 * @returns {EgomModel} A projectile model of intersecting squares.
 */
function projectileModel(intersections) {
	var result = new EgomModel();
	result.vertices.push([-1,-1,0]);
	result.vertices.push([1,-1,0]);
	result.vertices.push([1,1,0]);
	result.vertices.push([-1,1,0]);
	
	result.triangles.push(new Triangle(0,1,2, 1.0,1.0,1.0,1.0, 0,0, 0.0,0.5, 1.0,0.5, 1.0,0.0, 0,0,1,  0,0,1,  0,0,1)); 
	result.triangles.push(new Triangle(2,3,0, 1.0,1.0,1.0,1.0, 0,0, 1.0,0.0, 0.0,0.0, 0.0,0.5, 0,0,1,  0,0,1,  0,0,1)); 
	
	for(var i=0;i<intersections.length;i++) {
		result.vertices.push([1,intersections[i],-1]);
		result.vertices.push([-1,intersections[i],-1]);
		result.vertices.push([-1,intersections[i],1]);
		result.vertices.push([1,intersections[i],1]);
		
		result.triangles.push(new Triangle(((i+1)*4)+0,((i+1)*4)+1,((i+1)*4)+2,1.0,1.0,1.0,1.0,0,0, 0.0,1.0, 1.0,1.0, 1.0,0.5, 0,-1,0, 0,-1,0, 0,-1,0)); 
		result.triangles.push(new Triangle(((i+1)*4)+2,((i+1)*4)+3,((i+1)*4)+0,1.0,1.0,1.0,1.0,0,0, 1.0,0.5, 0.0,0.5, 0.0,1.0, 0,-1,0, 0,-1,0, 0,-1,0)); 
		result.triangles.push(new Triangle(((i+1)*4)+3,((i+1)*4)+2,((i+1)*4)+1,1.0,1.0,1.0,1.0,0,0, 0.0,1.0, 1.0,1.0, 1.0,0.5, 0,1,0,  0,1,0,  0,1,0)); 
		result.triangles.push(new Triangle(((i+1)*4)+1,((i+1)*4)+0,((i+1)*4)+3,1.0,1.0,1.0,1.0,0,0, 1.0,0.5, 0.0,0.5, 0.0,1.0, 0,1,0,  0,1,0,  0,1,0)); 
	}
		
	return result;
}

/**
 * Sets up and returns a simple EgomModel that contains a cuboid (XYZ-box) model 
 * with the given properties.
 * @param {number} width Size of the box along the X axis.
 * @param {number} height Size of the box along the Y axis.
 * @param {number} depth Size of the box along the Z axis.
 * @param {number[]} color A vector containing the RGBA components of the 
 * desired box color.
 * @returns {EgomModel} A cuboid model.
 */
function cuboidModel(width,height,depth,color) {
	var result = new EgomModel();
	// front
	result.vertices.push([-width/2,-height/2,depth/2]);
	result.vertices.push([width/2,-height/2,depth/2]);
	result.vertices.push([width/2,height/2,depth/2]);
	result.vertices.push([-width/2,height/2,depth/2]);
	// back
	result.vertices.push([-width/2,height/2,-depth/2]);
	result.vertices.push([width/2,height/2,-depth/2]);
	result.vertices.push([width/2,-height/2,-depth/2]);
	result.vertices.push([-width/2,-height/2,-depth/2]);
	// top
	result.vertices.push([width/2,height/2,-depth/2]);
	result.vertices.push([-width/2,height/2,-depth/2]);
	result.vertices.push([-width/2,height/2,depth/2]);
	result.vertices.push([width/2,height/2,depth/2]);
	// bottom
	result.vertices.push([-width/2,-height/2,-depth/2]);
	result.vertices.push([width/2,-height/2,-depth/2]);
	result.vertices.push([width/2,-height/2,depth/2]);
	result.vertices.push([-width/2,-height/2,depth/2]);
	// right
	result.vertices.push([width/2,-height/2,depth/2]);
	result.vertices.push([width/2,-height/2,-depth/2]);
	result.vertices.push([width/2,height/2,-depth/2]);
	result.vertices.push([width/2,height/2,depth/2]);
	// left
	result.vertices.push([-width/2,height/2,depth/2]);
	result.vertices.push([-width/2,height/2,-depth/2]);
	result.vertices.push([-width/2,-height/2,-depth/2]);
	result.vertices.push([-width/2,-height/2,depth/2]);
	
	var normals = [[0,0,1],[0,0,-1],[0,1,0],[0,-1,0],[1,0,0],[-1,0,0]];
	
	for(var i=0;i<6;i++) {
		result.triangles.push(new Triangle((i*4)+0,(i*4)+1,(i*4)+2,color[0],color[1],color[2],color[3],128,0, 0,1, 1,1, 1,0, normals[i][0], normals[i][1], normals[i][2], normals[i][0], normals[i][1], normals[i][2], normals[i][0], normals[i][1], normals[i][2])); 
		result.triangles.push(new Triangle((i*4)+2,(i*4)+3,(i*4)+0,color[0],color[1],color[2],color[3],128,0, 1,0, 0,0, 0,1, normals[i][0], normals[i][1], normals[i][2], normals[i][0], normals[i][1], normals[i][2], normals[i][0], normals[i][1], normals[i][2])); 
		result.triangles.push(new Triangle((i*4)+2,(i*4)+1,(i*4)+0,color[0],color[1],color[2],color[3],128,0, 0,1, 1,1, 1,0, -normals[i][0], -normals[i][1], -normals[i][2], -normals[i][0], -normals[i][1], -normals[i][2], -normals[i][0], -normals[i][1], -normals[i][2])); 
		result.triangles.push(new Triangle((i*4)+0,(i*4)+3,(i*4)+2,color[0],color[1],color[2],color[3],128,0, 1,0, 0,0, 0,1, -normals[i][0], -normals[i][1], -normals[i][2], -normals[i][0], -normals[i][1], -normals[i][2], -normals[i][0], -normals[i][1], -normals[i][2])); 
	}
		
	return result;
}

/**
 * Sets up and returns a simple EgomModel that contains a two vertices connected
 * with a line for drawing dust particles.
 * @param {number[]} color The RGB components of the color to use for the line.
 * @returns {EgomModel} A dust particle model.
 */
function dustModel(color) {
    var result = new EgomModel();
    result.vertices.push([0.0,0.0,0.0]);
    result.vertices.push([1.0,1.0,1.0]);
    result.lines.push(new Line(0,1,color[0],color[1],color[2],1,0,0,1));
    return result;
}