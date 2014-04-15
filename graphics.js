/**
 * @fileOverview This file contains the classes, methods and global variables
 * for the creation, manipulation and rendering of graphical objects using webGL,
 * as well as managing the required resources (such as textures).
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1
 */

var modelsDrawn = [0,0,0,0];

function Texture(filename) {
	//alert("creating texture: "+filename);
	this.filename=filename;
	//alert("filename set to: "+this.filename);
	this.id=-1;
	this.image = new Image();
}

Texture.prototype.chainLoad = function(resourceCenter,index,callback) {
	//alert("loading texture: "+this.filename);
	var self = resourceCenter.textures[index];
	if(resourceCenter.textures.length-1===index) {
		self.image.onload = callback;
	} else {
		self.image.onload = function() {self.chainLoad(resourceCenter,index+1,callback);};
	}
	self.image.src=self.filename;
};

Texture.prototype.setup = function(gl) {
	// Create a texture.
	this.id = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, this.id);
	
	// Set the parameters so we can render any size image.
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	// Upload the image into the texture.
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
};

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

function projectileModel(intersections) {
	var result = new EgomModel();
	result.vertices.push([-1,-1,0]);
	result.vertices.push([1,-1,0]);
	result.vertices.push([1,1,0]);
	result.vertices.push([-1,1,0]);
	
	result.triangles.push(new Triangle(0,1,2, 1.0,1.0,1.0,1.0, 0,0, 0.0,0.5, 1.0,0.5, 1.0,0.0, 0,0,1,  0,0,1,  0,0,1)); 
	result.triangles.push(new Triangle(2,3,0, 1.0,1.0,1.0,1.0, 0,0, 1.0,0.0, 0.0,0.0, 0.0,0.5, 0,0,1,  0,0,1,  0,0,1)); 
	//result.triangles.push(new Triangle(3,2,1, 1.0,1.0,1.0,1.0, 0,0, 0.0,0.5, 1.0,0.5, 1.0,0.0, 0,0,-1, 0,0,-1, 0,0,-1)); 
	//result.triangles.push(new Triangle(1,0,3, 1.0,1.0,1.0,1.0, 0,0, 1.0,0.0, 0.0,0.0, 0.0,0.5, 0,0,-1, 0,0,-1, 0,0,-1)); 
	
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

function Cubemap(name,imageURLs) {
	this.name=name;
	this.imageURLs=imageURLs;
	this.id=-1;
	this.images=new Array(6);
	for(var i=0;i<6;i++) {
		this.images[i] = new Image();
	}
}

Cubemap.prototype.chainLoad = function(resourceCenter,index,face,callback) {
	var self = this;
	if(face<5) {
		this.images[face].onload = function() {self.chainLoad(resourceCenter,index,face+1,callback);};
	} else {
		if(resourceCenter.cubemaps.length-1===index) {
			this.images[face].onload = callback;
		} else {
			this.images[face].onload = function() {resourceCenter.cubemaps[index+1].chainLoad(resourceCenter,index+1,0,callback);};
		}
	}
	this.images[face].src=this.imageURLs[face];
};

Cubemap.prototype.setup = function(gl) {
	// Create a texture.
	this.id = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.id);
	
	// Set the parameters so we can render any size image.
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
	
	var type = [
		gl.TEXTURE_CUBE_MAP_POSITIVE_X,
		gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
		gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
		gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
		gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
		gl.TEXTURE_CUBE_MAP_NEGATIVE_Z];

	// Upload the images into the texture.
	for(var i=0;i<6;i++) {
		gl.texImage2D(type[i], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.images[i]);
	}
};

function ShaderAttribute(name,size,role) {
	this.name=name;
	this.size=size;
	this.role=role;
}

/**
 * Enumeration defining the available variables types of shaders.
 */
var ShaderVariableTypes = Object.freeze(
        {
            none: 0,
            float: 1, 
            mat4: 2, 
            mat3: 3,
            vec3: 4,
            vec4: 5,
            sampler2D: 6,
            samplerCube: 7
        });
 
/**
 * Determining the enumeration value of a shader variable type from the string
 * containing the name of the variable type. 
 * @param {String} type The name of the variable type 
 */
function ShaderVariableTypeFromString(type) {
    if (type==="float") return ShaderVariableTypes.float;
    if (type==="mat4") return ShaderVariableTypes.mat4;
    if (type==="mat3") return ShaderVariableTypes.mat3;
    if (type==="vec3") return ShaderVariableTypes.vec3;
    if (type==="vec4") return ShaderVariableTypes.vec4;
    if (type==="sampler2D") return ShaderVariableTypes.sampler2D;
    if (type==="samplerCube") return ShaderVariableTypes.samplerCube;
    return ShaderVariableTypes.none;
}

function ShaderUniform(name,type) {
	this.name=name;
	this.type=ShaderVariableTypeFromString(type);
	this.location=-1;
}

ShaderUniform.prototype.getLocation = function(gl,program) {
	this.location=gl.getUniformLocation(program,this.name);
};

/**
 * Get the GL function that sets the uniform of the specified type at the
 * specified location to the specified value.
 * @param gl The GL context
 * @param location The location of the uniform
 * @param type The type of the uniform
 * @param value The value to set the uniform to
 */
ShaderUniform.prototype.getSetterFunction = function(gl,location,type,value) {
    switch(type) {
        case ShaderVariableTypes.float: return function() { gl.uniform1f(location,value); };
            break;
        case ShaderVariableTypes.mat4: return function() { gl.uniformMatrix4fv(location,false,value); };
            break;
        case ShaderVariableTypes.mat3: return function() { gl.uniformMatrix3fv(location,false,value); };
            break;
        case ShaderVariableTypes.vec3: return function() { gl.uniform3fv(location,value); };
            break;
        case ShaderVariableTypes.vec4: return function() { gl.uniform4fv(location,value); };
            break;
        case ShaderVariableTypes.sampler2D: return function() { gl.uniform1i(location,value); };
            break;
        case ShaderVariableTypes.samplerCube: return function() { gl.uniform1i(location,value); };
            break;
    }
};

/**
 * Sets the value of the shader in the specified GL context to the return value
 * of the passed value functio.
 * @param gl The GL context
 * @param {function} valueFunction The function to calculate the uniform value
 */
ShaderUniform.prototype.setValue = function(gl,valueFunction) {
	ShaderUniform.prototype.getSetterFunction(gl,this.location,this.type,valueFunction())();
};

function Shader(name,vertexShaderFileName,fragmentShaderFileName,depthMask,attributes,uniforms) {
	this.name=name;
	this.vertexShaderFileName=vertexShaderFileName;
	this.fragmentShaderFileName=fragmentShaderFileName;
	this.depthMask=depthMask;
	this.attributes=attributes;
	this.uniforms=uniforms;
	this.vertexBuffers=new Array();

	this.id=-1;
}

Shader.prototype.setup = function(gl) {
	var shaderSource = null;
	
	var request = new XMLHttpRequest();
	request.open('GET', this.vertexShaderFileName+"?1.0", false);
	request.send(null);
	shaderSource = request.responseText;

	var vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, shaderSource);
	gl.compileShader(vertexShader);
	
	request.open('GET', this.fragmentShaderFileName+"?1.0", false);
	request.send(null);
	shaderSource = request.responseText;

	var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, shaderSource);
	gl.compileShader(fragmentShader);

	this.id = gl.createProgram();
	gl.attachShader(this.id, vertexShader);
        gl.attachShader(this.id, fragmentShader);
        gl.linkProgram(this.id);
	
	for(var i=0;i<this.uniforms.length;i++) {
		this.uniforms[i].getLocation(gl,this.id);
	}
};

/**
 * Creates a new VisualObject.
 * @class The parent class of all objects to be rendered in the scene graph such
 * as full viewport quads, shaded meshes, billboards or particle systems. Serves
 * as a node, contains references to its parent and subnodes as well.
 * @param shader The shader that should be active while rendering this object
 */
function VisualObject(shader) {
	this.shader = shader;
	this.camera = null;
	this.uniformValueFunctions = new Array();
	
	this.toBeDeleted=false;
	
	this.renderParent=null;
	this.subnodes=new Array();
	
	this.visible=true;
	
	this.visibleWidth=0;
	this.visibleHeight=0;
}

VisualObject.prototype.getPosition = function() {
	return identityMatrix4();
};

VisualObject.prototype.getOrientation = function() {
	return identityMatrix4();
};

VisualObject.prototype.getScale = function() {
	return identityMatrix4();
};

VisualObject.prototype.getSize = function() {
	return 1;
};

VisualObject.prototype.getModelMatrix = function() {
	return identityMatrix4();
};

VisualObject.prototype.getCascadePositionVector = function() {
	if(this.renderParent!==null) {
		return vectorAdd3(
			this.renderParent.getCascadePositionVector(),
			vector3Matrix4Product(
				getPositionVector(
					this.getPosition()
					),
				mul(
					this.renderParent.getScale(),
					this.renderParent.getOrientation()
					)
				)
			);
	} else {
		return getPositionVector(this.getPosition());
	}
};

VisualObject.prototype.getCascadeScale = function() {
	if(this.renderParent!==null) {
		return mul(this.renderParent.getCascadeScale(),this.getScale());
	} else {
		return this.getScale();
	}
};

VisualObject.prototype.getParentModelMatrix = function() {
	if(this.renderParent!==null) {
		return this.renderParent.getModelMatrix();
	} else {
		return identityMatrix4();
	}
};

VisualObject.prototype.assignUniforms = function(gl) {
	for(var i=0;i<this.shader.uniforms.length;i++) {
		if(this.uniformValueFunctions[this.shader.uniforms[i].name]!==undefined) {
			this.shader.uniforms[i].setValue(gl,this.uniformValueFunctions[this.shader.uniforms[i].name]);
		}
	}
};

// if inside frustum, also sets visible width and height properties
VisualObject.prototype.insideViewFrustum = function(camera) {
	var baseMatrix =
		mul(mul(
			this.getCascadeScale(),
			translationMatrixv(getPositionVector4(
				mul(
					translationMatrixv(this.getCascadePositionVector()),
					camera.matrix
					)
				))
			),
			camera.perspective);
		
	var position = vector4Matrix4Product([0.0,0.0,0.0,1.0],baseMatrix);
	position = [position[0]/position[3],position[1]/position[3],position[2]/position[3]];
	var zOffsetPosition = vector4Matrix4Product([0.0,0.0,-this.getSize(),1.0],baseMatrix);
	var zOffset = (zOffsetPosition[2]/zOffsetPosition[3]);
		
	// frustum culling: back and front
	if (((zOffset>-1.0) && (zOffset<1.0)) || ((position[2]>-1.0) && (position[2]<1.0))) {
		var xyOffsetPosition = vector4Matrix4Product([this.getSize(),this.getSize(),0.0,1.0],baseMatrix);
		xyOffsetPosition = [xyOffsetPosition[0]/xyOffsetPosition[3],xyOffsetPosition[1]/xyOffsetPosition[3],xyOffsetPosition[2]/xyOffsetPosition[3]];
		var xOffset = xyOffsetPosition[0]-position[0];
		var yOffset = xyOffsetPosition[1]-position[1];
		
		// frustum culling: sides
		if ((position[0]+xOffset>-1)&&(position[0]-xOffset<1)&&
			(position[1]+yOffset>-1)&&(position[1]-yOffset<1)) {
			this.visibleWidth=xOffset;
			this.visibleHeight=yOffset;
			return true;
		} else {
			return false;
		}
	} else {
		return false;
	}
};

// renders the object and all its subnodes
VisualObject.prototype.cascadeRender = function(parent,resourceCenter,scene,screenSize,lodContext,depthMask) {
	if(this.visible) {
		this.renderParent=parent;
		if((this.shader.depthMask===depthMask)&&(this.insideViewFrustum(scene.activeCamera))) {
			resourceCenter.setCurrentShader(this.shader,scene);
			this.assignUniforms(resourceCenter.gl);
			this.render(resourceCenter,screenSize,lodContext);
		} else if(scene.uniformsAssigned===false) {
			resourceCenter.setCurrentShader(this.shader,scene);
		}
	}
	for(var i=0;i<this.subnodes.length;i++) {
		this.subnodes[i].cascadeRender(this,resourceCenter,scene,screenSize,lodContext,depthMask);
	}
};

function FVQ(model,shader,samplerName,cubemap) {
	VisualObject.call(this,shader);
	this.model=model;
	this.samplerName=samplerName;
	this.cubemap=cubemap;
	
	var self = this;
	
	this.uniformValueFunctions[this.samplerName] =                   function() { return self.cubemap.id; };
	this.uniformValueFunctions["u_viewDirectionProjectionInverse"] = function() { return inverse4(mul(self.camera.orientation,self.camera.perspective)); };
}

FVQ.prototype = new VisualObject();
FVQ.prototype.constructor = FVQ;

FVQ.prototype.insideViewFrustum = function(camera) {
	return true;
};

FVQ.prototype.render = function(resourceCenter,screenSize,lodContext) {
	resourceCenter.bindTexture(this.cubemap);
	
	this.model.render(resourceCenter.gl,false);
};

function ModelWithLOD(model,lod) {
	this.model=model;
	this.lod=lod;
}

function Mesh(modelsWithLOD,shader,texture,position,orientation,scale,lineMode) {
	VisualObject.call(this,shader);
	this.modelsWithLOD=modelsWithLOD;
	this.texture=texture;
	this.position=position;
	this.orientation=orientation;
	this.scale=scale;
	this.lineMode=lineMode;
	
	this.modelSize=0;
	for(var i=0;i<this.modelsWithLOD.length;i++) {
		if(this.modelsWithLOD[i].model.size>this.modelSize) {
			this.modelSize=this.modelsWithLOD[i].model.size;
		}
	}
	
	this.submeshes=new Array();
	
	this.modelMatrix = identityMatrix4();
	
	var self=this;
	
	this.uniformValueFunctions["u_modelMatrix"] = function() { self.modelMatrix=self.getModelMatrix(); return self.modelMatrix; };
	this.uniformValueFunctions["u_normalMatrix"] = function() { return transposed3(inverse3(matrix3from4(self.modelMatrix))); };
	this.uniformValueFunctions["u_image"] = function() { return self.texture.id; };
}

Mesh.prototype = new VisualObject();

Mesh.prototype.constructor = Mesh;

Mesh.prototype.getPosition = function() {
	return this.position;
};

Mesh.prototype.getOrientation = function() {
	return this.orientation;
};

Mesh.prototype.getScale = function() {
	return this.scale;
};

Mesh.prototype.getSize = function() {
	return this.modelSize;
};

Mesh.prototype.getModelMatrix = function() {
	return mul(mul(this.scale,this.orientation),mul(this.position,this.getParentModelMatrix()));
};

Mesh.prototype.render = function(resourceCenter,screenSize,lodContext) {
	resourceCenter.bindTexture(this.texture);
	// choose the model of appropriate LOD
	var visibleSize = this.visibleWidth*screenSize;
	var model;
	var closestLOD = -1;
	for(var i=0;i<this.modelsWithLOD.length;i++) {
		if(
			(closestLOD===-1) ||
			(this.modelsWithLOD[i].lod<=lodContext.maxEnabledLOD) &&
			(
				(closestLOD>lodContext.maxEnabledLOD) ||
				((lodContext.thresholds[closestLOD]>visibleSize) && (lodContext.thresholds[this.modelsWithLOD[i].lod]<=visibleSize)) ||
				((lodContext.thresholds[closestLOD]<=visibleSize) && (lodContext.thresholds[this.modelsWithLOD[i].lod]<=visibleSize) && (this.modelsWithLOD[i].lod>closestLOD)) ||
				((lodContext.thresholds[closestLOD]>visibleSize) && (lodContext.thresholds[this.modelsWithLOD[i].lod]>visibleSize) && (this.modelsWithLOD[i].lod<closestLOD))
			)) {
			model=this.modelsWithLOD[i].model;
			closestLOD=this.modelsWithLOD[i].lod;
		}
	}
	modelsDrawn[closestLOD]=modelsDrawn[closestLOD]+1;
	
	if (this.lineMode===true) {
		resourceCenter.gl.drawArrays(resourceCenter.gl.LINES, model.bufferStartLines, 2*model.lines.length);
	} else {
		resourceCenter.gl.drawArrays(resourceCenter.gl.TRIANGLES, model.bufferStart, 3*model.triangles.length);
		drawnPolyogons+=model.triangles.length;
	}
};

function Billboard(model,shader,texture,size,position,orientation) {
	VisualObject.call(this,shader);
	this.model=model;
	this.texture=texture;
	this.position=position;
	this.orientation=orientation;
	this.scale=scalingMatrix(size,size,size);
	
	var self = this;
	
	this.uniforms["u_modelMatrix"] = function() { return mul(mul(self.scale,self.orientation),self.position); };
}

Billboard.prototype = new VisualObject();
Billboard.prototype.constructor = Billboard;

Billboard.prototype.insideViewFrustum = function(camera) {
	return true;
};

Billboard.prototype.render = function(resourceCenter,screenSize,lodContext) {
	resourceCenter.bindTexture(this.texture);
	
	drawnPolyogons+=2;
	this.model.render(resourceCenter.gl,false);
};

function Particle(model,shader,texture,color,size,position,duration) {
	VisualObject.call(this,shader);
	this.model=model;
	this.texture=texture;
	this.color=color;
	this.position=position;
	this.scale=scalingMatrix(size,size,size);
	
	this.creationTime=new Date().getTime();
	this.duration=duration;
	var self = this;
	
	this.uniformValueFunctions["u_modelMatrix"] =   function() { return mul(mul(self.scale,self.position),self.getParentModelMatrix()); };
	this.uniformValueFunctions["u_billboardSize"] = function() { return self.scale[0]; };
	this.uniformValueFunctions["u_relAge"] = function() { return (new Date().getTime()-self.creationTime)/self.duration; };
	this.uniformValueFunctions["u_color"] =   function() { return self.color; };
}

Particle.prototype = new VisualObject();
Particle.prototype.constructor = Particle;

Particle.prototype.insideViewFrustum = function(camera) {
	return true;
};

Particle.prototype.render = function(resourceCenter,screenSize,lodContext) {
	resourceCenter.bindTexture(this.texture);
	if(new Date().getTime()>=this.creationTime+this.duration) {
		this.toBeDeleted=true;
	} else {
		drawnPolyogons+=2;
		this.model.render(resourceCenter.gl,false);
	}
};

function PermanentParticle(model,shader,texture,color,size,position) {
	Particle.call(this,model,shader,texture,color,size,position,1000);
	this.relSize=0;
	var self = this;
	this.uniformValueFunctions["u_relAge"] = function() { return 1.0-self.relSize; };
}

PermanentParticle.prototype = new Particle();
PermanentParticle.prototype.constructor = PermanentParticle;

PermanentParticle.prototype.render = function(resourceCenter,screenSize,lodContext) {
	resourceCenter.bindTexture(this.texture);
	if(this.relSize>0) {
		drawnPolyogons+=2;
		this.model.render(resourceCenter.gl,false);
	}
};

function VertexBuffer(id,data,location,vectorSize) {
	this.id=id;
	this.data=data;
	this.location=location;
	this.vectorSize=vectorSize;
}

function Camera(aspect,fov,followedObject) {
	this.position=identityMatrix4();
	this.orientation=identityMatrix4();
	this.matrix=identityMatrix4();
	this.velocity=[0,0,0];
	this.maxSpeed=1;
	this.acceleration=0.1;
	this.angularVelocity=[0,0,0];
	this.maxTurn=0.1;
	this.angularAcceleration=0.01;
	this.followedObject=followedObject;
	this.followPosition=identityMatrix4();
	this.followOrientation=identityMatrix4();
	this.aspect=aspect;
	this.fov=fov;
	this.focusDistance=Math.cos(fov*3.1415/360)*2*this.aspect;
	this.perspective=perspectiveMatrix4(this.aspect,1.0,Math.cos(fov*3.1415/360)*2*this.aspect,500.0);
}

Camera.prototype.setFOV = function(fov) {
	this.fov=fov;
	this.perspective=perspectiveMatrix4(this.aspect,1.0,Math.cos(fov*3.1415/360)*2*this.aspect,500.0);
};

function Scene(left,top,width,height,clearColorOnRender,colorMask,clearColor,clearDepthOnRender,activeCamera) {
	this.objects=new Array();
	this.left=left;
	this.top=top;
	this.width=width;
	this.height=height;
	
	this.clearColorOnRender=clearColorOnRender;
	this.colorMask=colorMask;
	this.clearColor=clearColor;
	this.clearDepthOnRender=clearDepthOnRender;
	
	this.activeCamera = activeCamera;
		
	this.uniformValueFunctions = new Object();
	
	this.firstRender=true;
	this.uniformsAssigned=false;
}

Scene.prototype.assignUniforms = function(gl,program) {
	for(var i=0;i<program.uniforms.length;i++) {
		if(this.uniformValueFunctions[program.uniforms[i].name]!==undefined) {
			program.uniforms[i].setValue(gl,this.uniformValueFunctions[program.uniforms[i].name]);
		}
	}
	this.uniformsAssigned=true;
};

Scene.prototype.bindBuffers = function(gl,shader) {
	for(var i=0;i<shader.attributes.length;i++) {
		gl.bindBuffer(gl.ARRAY_BUFFER, shader.vertexBuffers[i].id);
		gl.vertexAttribPointer(shader.vertexBuffers[i].location, shader.vertexBuffers[i].vectorSize, gl.FLOAT, false, 0, 0);
	}
};

var drawnPolyogons = 0;

Scene.prototype.render = function(resourceCenter,multipleScenes,lodContext) {
	document.getElementById("output").innerHTML="";
	drawnPolyogons=0;
	
	var gl = resourceCenter.gl;
	
	//alert("setting viewport: "+this.left+","+this.top+","+this.width+","+this.height);
	gl.viewport(this.left, this.top, this.width, this.height);
	gl.scissor(this.left, this.top, this.width, this.height);
	
	if (this.clearColorOnRender) {
		gl.colorMask(this.colorMask[0], this.colorMask[1], this.colorMask[2], this.colorMask[3]);
		gl.clearColor(this.clearColor[0],this.clearColor[1],this.clearColor[2],this.clearColor[3]);
	}

	this.firstRender=false;
	
	gl.depthMask(true);
	var clear = this.clearColorOnRender?gl.COLOR_BUFFER_BIT:0;
	clear=this.clearDepthOnRender?clear|gl.DEPTH_BUFFER_BIT:clear;
	gl.clear(clear);
	
	this.uniformsAssigned=false;
	
	modelsDrawn = [0,0,0,0];
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	for(var i=0;i<this.objects.length;i++) {
		while ((i<this.objects.length)&&((this.objects[i]===null)||(this.objects[i].toBeDeleted))) {
			delete this.objects[i];
			this.objects.splice(i,1);
		}
		if (i<this.objects.length) {
			this.objects[i].camera=this.activeCamera;
			this.objects[i].cascadeRender(null,resourceCenter,this,this.height,lodContext,true);
		}
	}
	gl.depthMask(false);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
	for(var i=0;i<this.objects.length;i++) {
		this.objects[i].cascadeRender(null,resourceCenter,this,this.height,lodContext,false);
	}
	document.getElementById("output").innerHTML+=drawnPolyogons;
	//for(var i=0;i<4;i++) document.getElementById("output").innerHTML+=i+": "+modelsDrawn[i]+" ";
};

function LODContext(maxEnabledLOD,thresholds) {
	this.maxEnabledLOD=maxEnabledLOD;
	this.thresholds=thresholds;
}

function ResourceCenter(canvas,lodContext) {
	this.gl=null;
	
	this.textures=new Array();
	this.cubemaps=new Array();
	this.shaders=new Array();
	this.models=new Array();
	this.cameras=new Array();
	this.scenes=new Array();
	
	this.vertexBuffers=new Array();
	
	this.cameras.push(new Camera(canvas.width/canvas.height,60));
	
	this.lodContext=lodContext;
	
	this.maxRenderTimes = 30;
	this.renderTimes = new Array();
	
	this.currentShader=null;
	this.boundTexture=null;
}

ResourceCenter.prototype.getTexture = function(filename) {
	var i = 0;
	while((i<this.textures.length)&&(this.textures[i].filename!==filename)) {
		i++;
	}
	if(i<this.textures.length) {
		return this.textures[i];
	} else {
		var texture=new Texture(filename);
		this.textures.push(texture);
		return texture;
	}
};

ResourceCenter.prototype.getShader = function(name) {
	var i = 0;
	while((i<this.shaders.length)&&
		(this.shaders[i].name!==name)) {
		i++;
	}
	if(i<this.shaders.length) {
		return this.shaders[i];
	} else {
		return null;
	}
};

ResourceCenter.prototype.getCubemap = function(name) {
	var i = 0;
	while((i<this.cubemaps.length)&&
		(this.cubemaps[i].name!==name)) {
		i++;
	}
	if(i<this.cubemaps.length) {
		return this.cubemaps[i];
	} else {
		return null;
	}
};

ResourceCenter.prototype.getModel = function(filename) {
	var i = 0;
	while((i<this.models.length)&&(this.models[i].filename!==filename)) {
		i++;
	}
	if(i<this.models.length) {
		return this.models[i];
	} else {
		var model=new EgomModel(filename);
		this.models.push(model);
		return model;
	}
};

ResourceCenter.prototype.addModel = function(model,name) {
	var i = 0;
	while((i<this.models.length)&&(this.models[i]!==model)&&(this.models[i].filename!==name)) {
		i++;
	}
	if(i<this.models.length) {
		return this.models[i];
	} else {
		model.filename=name;
		this.models.push(model);
		return this.models[i];
	}
};

ResourceCenter.prototype.loadTextures = function(callback) {
	var self = this;
	if(this.textures.length>0) {	
		if(this.cubemaps.length>0) {
			this.textures[0].chainLoad(this,0,function(){self.cubemaps[0].chainLoad(self,0,0,callback);});
		} else {
			this.textures[0].chainLoad(this,0,callback);
		}
	}
};

ResourceCenter.prototype.loadShaders = function(filename) {
	var request = new XMLHttpRequest();
	request.open('GET', filename+"?12345", false); //timestamp added to URL to bypass cache
	request.send(null);
	shadersSource = request.responseXML;
	
	this.cubemaps=new Array();
	
	var cubemapTags = shadersSource.getElementsByTagName("Cubemap");
	for(var i=0;i<cubemapTags.length;i++) {
		var imageTags = cubemapTags[i].getElementsByTagName("image");
		var imageURLs = new Array(6);
		for(var j=0;j<imageTags.length;j++) {
			var index=-1;
			switch(imageTags[j].getAttribute("direction")) {
				case "pos_x": index = 0;
					break;
				case "neg_x": index = 1;
					break;
				case "pos_y": index = 2;
					break;
				case "neg_y": index = 3;
					break;
				case "pos_z": index = 4;
					break;
				case "neg_z": index = 5;
					break;
			}
			imageURLs[index]=imageTags[j].getAttribute("url");
		}
		this.cubemaps.push(new Cubemap(cubemapTags[i].getAttribute("name"),imageURLs));
	}
	
	this.shaders=new Array();
	
	var shaderTags = shadersSource.getElementsByTagName("Shader");
	for(var i=0;i<shaderTags.length;i++) {
		this.shaders.push(new Shader(
			shaderTags[i].getAttribute("name"),
			shaderTags[i].getElementsByTagName("vertex")[0].getAttribute("filename"),
			shaderTags[i].getElementsByTagName("fragment")[0].getAttribute("filename"),
			(shaderTags[i].getElementsByTagName("depthMask")[0].getAttribute("value")==="true"),
			new Array(),
			new Array())
			);
		var attributeTags = shaderTags[i].getElementsByTagName("attribute");
		for(var j=0;j<attributeTags.length;j++) {
			this.shaders[i].attributes.push(new ShaderAttribute(
				attributeTags[j].getAttribute("name"),
				parseInt(attributeTags[j].getAttribute("size")),
				attributeTags[j].getAttribute("role"))
				);
		}
		var uniformTags = shaderTags[i].getElementsByTagName("uniform");
		for(var j=0;j<uniformTags.length;j++) {
			this.shaders[i].uniforms.push(new ShaderUniform(
				uniformTags[j].getAttribute("name"),
				uniformTags[j].getAttribute("type"))
				);
		}
	}	
};

ResourceCenter.prototype.setupBuffers = function(shader,loadLines) {
	//alert("setting up vertex buffers for shader: "+shader.name);
	this.gl.useProgram(shader.id);
	var sumVertices=0;
	for(var i=0;i<this.models.length;i++) {
		sumVertices=sumVertices+
			(loadLines?this.models[i].lines.length*2:0)+
			this.models[i].triangles.length*3;
	}
	
	// creating float32arrays of the appropriate size for the buffers
	shader.vertexBuffers=new Array();
	for(var i=0;i<shader.attributes.length;i++) {
		shader.vertexBuffers.push(new VertexBuffer(-1,new Float32Array(sumVertices*shader.attributes[i].size),null,shader.attributes[i].size));
	}
	
	// filling the buffer data arrays from model data
	var bufferSize=0;
	var objectBufferData=null;
	for(var i=0;i<this.models.length;i++) {
		var linesToLoad=loadLines;
		var trianglesToLoad=true;
		while(linesToLoad||trianglesToLoad) {
			objectBufferData=this.models[i].getBuffers(linesToLoad);
			linesToLoad?
				(this.models[i].bufferStartLines=bufferSize):
				(this.models[i].bufferStart=bufferSize);
			for(var j=0;j<shader.attributes.length;j++) {
				shader.vertexBuffers[j].data.set(objectBufferData[shader.attributes[j].role],bufferSize*shader.attributes[j].size);
			}
			bufferSize+=Math.round(objectBufferData[shader.attributes[0].role].length/shader.attributes[0].size);
			linesToLoad?
				(linesToLoad=false):
				(trianglesToLoad=false);
		}
	}
	
	// provide the data to webGL
	for(var i=0;i<shader.attributes.length;i++) {
		shader.vertexBuffers[i].location = this.gl.getAttribLocation(shader.id, shader.attributes[i].name);
		shader.vertexBuffers[i].id = this.gl.createBuffer();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, shader.vertexBuffers[i].id);
		this.gl.bufferData(
			this.gl.ARRAY_BUFFER, 
			shader.vertexBuffers[i].data,
			this.gl.STATIC_DRAW);
		this.gl.enableVertexAttribArray(shader.vertexBuffers[i].location);
		this.gl.vertexAttribPointer(shader.vertexBuffers[i].location, shader.attributes[i].size, this.gl.FLOAT, false, 0, 0);
	}
};

ResourceCenter.prototype.setCurrentShader = function(shader,scene) {
	if(this.currentShader!==shader) {
		this.gl.useProgram(shader.id);
		scene.bindBuffers(this.gl,shader);	
		scene.assignUniforms(this.gl,shader);
		this.currentShader=shader;
	}
};

ResourceCenter.prototype.bindTexture = function(texture) {
	if(this.boundTexture!==texture) {
		if (texture instanceof Texture) {
			this.gl.bindTexture(this.gl.TEXTURE_2D, texture.id);
		} else
		if (texture instanceof Cubemap) {
			this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, texture.id);
		}
		this.boundTexture=texture;
	}
};

ResourceCenter.prototype.setupWebGL = function(canvas) {
	try {
		// Try to grab the standard context. If it fails, fallback to experimental.
		this.gl = canvas.getContext("webgl",{alpha: false}) || canvas.getContext("experimental-webgl",{alpha: false});
	}
	catch(e) {}

	// If we don't have a GL context, give up now
	if (!this.gl) {
		alert("Unable to initialize WebGL. Your browser might not support it.");
	}
	
	this.gl.clearDepth(1.0);
	this.gl.colorMask(true, true, true, true);
	this.gl.enable(this.gl.DEPTH_TEST);
	this.gl.depthFunc(this.gl.LEQUAL); 
	this.gl.enable(this.gl.CULL_FACE);
	this.gl.cullFace(this.gl.BACK);
	this.gl.frontFace(this.gl.CCW);
	this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
	this.gl.enable(this.gl.BLEND);
	this.gl.enable(this.gl.SCISSOR_TEST);
	this.gl.activeTexture(this.gl.TEXTURE0);
	
	this.boundTexture=null;
	
	this.setupShaders();
	this.setupTextures();
	this.setupCubemaps();
	
	for(var i=0;i<this.shaders.length;i++) {
		this.setupBuffers(this.shaders[i],true);
	}
};

ResourceCenter.prototype.init = function(canvas,freq) {
	//alert("Initializing...");
	var self=this;
	document.getElementById("status").innerHTML="loading textures...";
	this.loadTextures(function() {
		document.getElementById("status").innerHTML="initializing WebGL...";
		self.setupWebGL(canvas);
		document.getElementById("status").style.display="none";
		document.getElementById("progress").value=100;
		alert("ready!");
		document.getElementById("progress").style.display="none";
		setInterval(
			function() {
				self.renderScenes();
				var d = new Date();
				self.renderTimes.push(d.getTime());
				if(self.renderTimes.length>self.maxRenderTimes) {
					self.renderTimes.shift();
				}
				if (self.renderTimes.length>1) {
					document.getElementById("output").innerHTML+=
						"<br/>FPS: "+
						Math.round(1000/((self.renderTimes[self.renderTimes.length-1]-self.renderTimes[0])/(self.renderTimes.length-1))*10)/10;
				}
			},
			1000/freq);
	});
};

ResourceCenter.prototype.setupTextures = function() {
	for(var i=0;i<this.textures.length;i++) {
		this.textures[i].setup(this.gl);
	}
};

ResourceCenter.prototype.setupCubemaps = function() {
	for(var i=0;i<this.cubemaps.length;i++) {
		this.cubemaps[i].setup(this.gl);
	}
};

ResourceCenter.prototype.setupShaders = function() {
	for(var i=0;i<this.shaders.length;i++) {
		this.shaders[i].setup(this.gl);
	}
};

ResourceCenter.prototype.renderScenes = function() {
	for(var i=0;i<this.scenes.length;i++) {
		this.scenes[i].render(this,(this.scenes.length>1),this.lodContext);
	}
};

function GraphicsContext(resourceCenter,scene) {
	this.resourceCenter=resourceCenter;
	this.scene=scene;
}
