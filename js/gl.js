/**
 * @fileOverview This file contains wrapper classes for accessing WebGL 
 * functionality and manage the corresponding resources.
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
 * Creates a new Texture object.
 * @class Represents a webGL texture resource
 * @param {String} filename The name of file from which the texture resource 
 * is to be loaded. The constructor itself does not initiate the loading.
 */
function Texture(filename) {
	this.filename=filename;
	this.id=-1;
	this.image = new Image();
}

/**
 * Initiates the loading of the texture from file and sets a callback for the
 * finish of the loading to initiate loading the next texture from the resource
 * center if such exists, otherwise to execute the callback passed in parameter.
 * This is required to make sure all the textures are loaded by the time the
 * final callback is executed, that is proceeding with any further steps already
 * making use of the textures.
 * @param {ResourceCenter} resourceCenter The resource center object where the
 * subsequents texture resources to be loaded are stored.
 * @param {number} index The index of the current texture resource in the array
 * of textures.
 * @param {function} callback The function to be executed after all textures
 * have been loaded.
 */
Texture.prototype.chainLoad = function(resourceCenter,index,callback) {
	var self = resourceCenter.textures[index];
	if(resourceCenter.textures.length-1===index) {
		self.image.onload = callback;
	} else {
		self.image.onload = function() {
                    game.getCurrentScreen().updateStatus("loaded texture: "+self.filename+".");
                    self.chainLoad(resourceCenter,index+1,callback);
                };
	}
	self.image.src=self.filename;
};

/**
 * Sets up the webGL resource for the texture within the provided GL context.
 * Call only after the chainload has finished!
 * @param {WebGLRenderingContext} gl The webGL context.
 */
Texture.prototype.setup = function(gl) {
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

/**
 * Creates a new Cubemap object.
 * @class Represents a webGL cubemapped texture resource
 * @param {String} name The name of cubemap resource
 * @param {String[]} imageURLs An array containing the URLs of the 6 faces of
 * the cubemapped texture. The order of the pictures has to be X,Y,Z and within
 * that, always positive first.
 */
function Cubemap(name,imageURLs) {
	this.name=name;
	this.imageURLs=imageURLs;
	this.id=-1;
	this.images=new Array(6);
	for(var i=0;i<6;i++) {
		this.images[i] = new Image();
	}
}

/**
 * Initiates the loading of one of the face textures of a cubemapped texture 
 * object from file and sets a callback for the finish of the loading to 
 * initiate loading the next face, the next cubemapped texture object from the
 * resource center if such exists, otherwise to execute the callback passed in 
 * parameter.
 * This is required to make sure all the pictures are loaded by the time the
 * final callback is executed, that is proceeding with any further steps already
 * making use of the textures.
 * @param {ResourceCenter} resourceCenter The resource center object where the
 * subsequents cubemapped texture resources to be loaded are stored.
 * @param {number} index The index of the current cubemap resource in the array
 * of cubemaps.
 * @param {number} face The index of the current face to load (0-5)
 * @param {function} callback The function to be executed after all textures
 * have been loaded.
 */
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

/**
 * Sets up the webGL resource for the cubemapped texture within the provided GL
 * context.
 * Call only after the chainload has finished!
 * @param {WebGLRenderingContext} gl The webGL context.
 */
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

/**
 * Creates a new ShaderAttribute object.
 * @class A wrapper class for storing the attributes used in a given program, 
 * so they can be automatically set based on their roles. 
 * @param {string} name Name of the shader attribute.
 * @param {number} size Size of the shader attribute: number of dimensions.
 * @param {string} role Role of the shader attribute, based on which the
 * appropriate buffer will be assigned to it to supply the values. Currently
 * supported roles are: position, texCoord, normal, color, luminosity, 
 * shininess, groupIndex.
 */
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
            samplerCube: 7,
            int: 8
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
    if (type==="int") return ShaderVariableTypes.int;
    if (type==="struct") return ShaderVariableTypes.struct;
    return ShaderVariableTypes.none;
}

/**
 * Creates a new ShaderUniform.
 * @class A class representing and wrapping a GLSL uniform 
 * variable.
 * @param {String} name The name of the uniform variable. Has to be the same
 * as the name specified in the GLSL source.
 * @param {String} type The type of the uniform variable. Only certain variable
 * types are supported.
 * @param {Number} arraySize If 0 or undefined, the uniform is not an array. If 
 * one or more, then gives the size of the uniform array.
 */
function ShaderUniform(name,type,arraySize) {
	this.name=name;
	this.type=ShaderVariableTypeFromString(type);
        if(arraySize!==undefined) {
            this.arraySize=arraySize;
        } else {
            this.arraySize=0;
        }
	this.location=new Object();
        
        this._members = null;
        if(this.type===ShaderVariableTypes.struct) {
            this._members = new Array();
        }
}

ShaderUniform.prototype.addMember = function(member) {
    this._members.push(member);
};

ShaderUniform.prototype.setLocation = function(gl,programID) {
    if(this.location[gl]===undefined) {
        this.location[gl]=new Object();
    } 
    this.location[gl][programID] = gl.getUniformLocation(programID,this.name);
};

ShaderUniform.prototype.getLocation = function(gl,programID) {
    return this.location[gl][programID];
};

/**
 * Sets the value of the shader in the specified GL context to the return value
 * of the passed value function.
 * @param {WebGLRenderingContext} gl The GL context
 * @param {Number} programID
 * @param {function} valueFunction The function to calculate the uniform value
 * @param {String} locationPrefix
 */
ShaderUniform.prototype.setValue = function(gl,programID,valueFunction,locationPrefix) {
    var value = valueFunction();
    var location;
    if (locationPrefix!==undefined) {
        location = gl.getUniformLocation(programID,locationPrefix+this.name);
    } else {
        location = this.getLocation(gl,programID);
    }
    var i,j;
    if(this.arraySize>0) {
        switch(this.type) {
            case ShaderVariableTypes.float: gl.uniform1fv(location,value);
                break;
            case ShaderVariableTypes.struct:
                    for(i=0;i<value.length;i++) {
                        for(j=0;j<this._members.length;j++) {
                            if(value[i][this._members[j].name]!==undefined) {
                                var memberName = this._members[j].name; 
                                this._members[j].setValue(gl,programID,function(){ return value[i][memberName]; },this.name+"["+i+"].");
                            }
                        }
                    }
                break;
        }
    } else {
        switch(this.type) {
            case ShaderVariableTypes.float: gl.uniform1f(location,value);
                break;
            case ShaderVariableTypes.mat4: gl.uniformMatrix4fv(location,false,value);
                break;
            case ShaderVariableTypes.mat3: gl.uniformMatrix3fv(location,false,value);
                break;
            case ShaderVariableTypes.vec3: gl.uniform3fv(location,value);
                break;
            case ShaderVariableTypes.vec4: gl.uniform4fv(location,value);
                break;
            case ShaderVariableTypes.sampler2D: gl.uniform1i(location,value);
                break;
            case ShaderVariableTypes.samplerCube: gl.uniform1i(location,value);
                break;
            case ShaderVariableTypes.int: gl.uniform1i(location,value);
                break;
        }
    }    
};

/**
 * Creates a new vertex buffer object.
 * @class A wrapper object that represents a webGL vertex buffer object.
 * @param {number} id The ID of the vertex buffer in its webGL context.
 * @param {} data The data that has to be loaded to the vertex buffer.
 * @param {number} location The location ID of the VBO in its webGL context.
 * @param {number} vectorSize The number of components in one element of te VBO.
 */
function VertexBuffer(id,data,location,vectorSize) {
	this.id=id;
	this.data=data;
	this.location=location;
	this.vectorSize=vectorSize;
}

/**
 * Creates a new Shader object. Does not perform anything besides setting the
 * members.
 * @class A wrapper class representing a webGL shader program.
 * @param {string} name The name of the shader program ot can be referred to 
 * with later.
 * @param {string} vertexShaderFileName The name of the file containing the 
 * vertex shader code.
 * @param {string} fragmentShaderFileName The name of the file containing the
 * fragment shader code.
 * @param {string} blendType What kind of blending function should be used
 * while rendering with this shader.
 * @param {ShaderAttribute[]} attributes The list of attributes this shader
 * has as an input.
 * @param {ShaderUniform[]} uniforms The list of uniform variables this shader
 * contains.
 * */
function Shader(name,vertexShaderFileName,fragmentShaderFileName,blendType,attributes,uniforms) {
	this.name=name;
	this.vertexShaderFileName=vertexShaderFileName;
	this.fragmentShaderFileName=fragmentShaderFileName;
	this.blendType=blendType;
	this.attributes=attributes;
	this.uniforms=uniforms;
	this.vertexBuffers=new Array();

	this.id=-1;
}

/**
 * Performs the full preparation of the webGL shader within the supplied GL
 * context: dowloads the vertex and fragment shader files, compiles and links
 * the code using webGL and saves the location IDs of the uniforms of the 
 * shader.
 * @param {WebGLRenderingContext} gl The webGL context to use for webGL operations.
 */
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
		this.uniforms[i].setLocation(gl,this.id);
	}
};

/**
 * Binds all the vertex attribute buffers of the shader program.
 * @param {WebGLRenderingContext} gl The webGL context to use.
 */
Shader.prototype.bindBuffers = function(gl) {
	for(var i=0;i<this.attributes.length;i++) {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffers[i].id);
                gl.vertexAttribPointer(this.vertexBuffers[i].location, this.vertexBuffers[i].vectorSize, gl.FLOAT, false, 0, 0);
	}
};

/**
 * Creates a new Resource Center object.
 * @class This class holds and manages all the various resources and their 
 * configuration that are needed for rendering: textures, shaders, models.
 */
function ResourceCenter() {
	this.gl=null;
	
	this.textures=new Array();
	this.cubemaps=new Array();
	this.shaders=new Array();
	this.models=new Array();
	
	this.vertexBuffers=new Array();
	
	this.currentShader=null;
	this.boundTextures=new Array();
}

/**
 * Looks for a texture with the given filename in the resource center, if not
 * present yet, adds it, then returns it.
 * @param {string} filename The name of the file of the texture we are looking for.
 * @returns {Texture} The found or added texture object in the resource center.
 */
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

/**
 * Looks for a shader with the given name in the resource center and returns it.
 * If it is not present then returns null.
 * @param {string} name The name of the shader program resource we are looking for.
 * @returns {Shader} The found shader object in the resource center or null.
 */
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

/**
 * Looks for a cubemap with the given name in the resource center and returns it.
 * If it is not present then returns null.
 * @param {string} name The name of the cubemap resource we are looking for.
 * @returns {Cubemap} The found cubemap object in the resource center or null.
 */
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

/**
 * Looks for a model with the given filename in the resource center, if not
 * present yet, adds it, then returns it.
 * @param {string} filename The name of the file of the model resource we are looking for.
 * @returns {EgomModel} The found or added model object in the resource center.
 */
ResourceCenter.prototype.getModel = function(filename) {
    game.getCurrentScreen().updateStatus("loading model: "+filename+"...");
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
    game.getCurrentScreen().updateStatus("loading model: "+filename+"... done.");
};

/**
 * Checks if the model passed as parameter is already in the resource center,
 * and if not, then adds it. Also uses name checking, and doesn't add the model
 * if another one if already present with the same name.
 * @param {EgomModel} model The model resource we are looking for in the resource center.
 * @param {string} name The name of the model resource we are looking for.
 * @returns {EgomModel} The found or added model object in the resource center.
 */
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

/**
 * Performs the sequential loading of the external picture files for textures and
 * cubemaps and then executes the callback function. 
 * @param {function} callback The function to execute after all pictures have been loaded.
 */
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

ResourceCenter.prototype.requestShaderLoad = function(filename) {
    var request = new XMLHttpRequest();
    request.open('GET', getXMLFolder()+filename+"?123", true);
    var self = this;
    request.onreadystatechange = function() {
        if (request.readyState === 4) {
            self.loadShadersFromXML(request.responseXML);
        }
    };
    request.send(null);
};

/**
 * Loads the shader configuration from an external XML file into the resource
 * center.
 */
ResourceCenter.prototype.loadShadersFromXML = function(xmlSource) {	
	this.cubemaps=new Array();
	
	var cubemapTags = xmlSource.getElementsByTagName("Cubemap");
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
	
	var shaderTags = xmlSource.getElementsByTagName("Shader");
	for(var i=0;i<shaderTags.length;i++) {
		this.shaders.push(new Shader(
			shaderTags[i].getAttribute("name"),
			shaderTags[i].getElementsByTagName("vertex")[0].getAttribute("filename"),
			shaderTags[i].getElementsByTagName("fragment")[0].getAttribute("filename"),
			shaderTags[i].getElementsByTagName("blendType")[0].getAttribute("value"),
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
				uniformTags[j].getAttribute("type"),
                                uniformTags[j].hasAttribute("arraySize")?uniformTags[j].getAttribute("arraySize"):0)
				);
                        if(uniformTags[j].hasAttribute("memberOf")) {
                            var parent = uniformTags[j].getAttribute("memberOf");
                            for(var k=0;k<this.shaders[i].uniforms.length;k++) {
                                if(this.shaders[i].uniforms[k].name===parent) {
                                    this.shaders[i].uniforms[k].addMember(this.shaders[i].uniforms[this.shaders[i].uniforms.length-1]);
                                }
                            }
                        }
		}
	}	
};

/**
 * Loads the vertex buffer data to the graphic memory for the given shader program using webGL.
 * @param {Shader} shader The shader program for which the buffers will be loaded.
 * @param {boolean} loadLines Whether to fill the buffer for drawing lines as well next to triangles.
 */
ResourceCenter.prototype.setupBuffers = function(shader,loadLines) {
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
			 if (linesToLoad) {
				this.models[i].bufferStartLines=bufferSize;
                            } else {
				this.models[i].bufferStart=bufferSize;
                                this.models[i].bufferStartTransparent=bufferSize+this.models[i].nOpaqueTriangles*3;
                            }
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

/**
 * Sets up the provided shader for usage within the provided scene, also assigning
 * the scene uniforms.
 * @param {Shader} shader The shader to set as current.
 * @param {Scene} scene The scene we are drawing.
 */
ResourceCenter.prototype.setCurrentShader = function(shader,scene) {
	if(this.currentShader!==shader) {
		this.gl.useProgram(shader.id);
                if (shader.blendType==="mix") {
                    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
                } else if (shader.blendType==="add") {
                    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
                }
		shader.bindBuffers(this.gl);	
		scene.assignUniforms(this.gl,shader);
		this.currentShader=shader;
	}
};

/**
 * Binds the given texture or cubemap resource with webGL
 * @param {Texture|Cubemap} texture The resource to bind for rendering.
 * @param {Number} place To which activeTexture place does it need to bind (for multi-texturing, starting with 0)
 */
ResourceCenter.prototype.bindTexture = function(texture,place) {
    switch(place) {
        case 0: this.gl.activeTexture(this.gl.TEXTURE0);
            break;
        case 1: this.gl.activeTexture(this.gl.TEXTURE1);
            break;
        case 2: this.gl.activeTexture(this.gl.TEXTURE2);
            break;
        case 3: this.gl.activeTexture(this.gl.TEXTURE3);
            break;
    }
    if(this.boundTextures[place]!==texture) {
            if (texture instanceof Texture) {
                    this.gl.bindTexture(this.gl.TEXTURE_2D, texture.id);
            } else
            if (texture instanceof Cubemap) {
                    this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, texture.id);
            }
            this.boundTextures[place]=texture;
    }
};

/**
 * Sets up a webGL context and performs the basic configuration with it.
 * @param {object} canvas The HMTL5 canvas to get and configure the context for.
 * @param {Boolean} antialiasing Whether antialising should be turned on. (given
 * that the implementation supports it)
 * @returns {boolean} Indicates whether the creation of the WebGL context succeeded.
 */
ResourceCenter.prototype.setupWebGL = function(canvas,antialiasing) {
	try {
                var contextParameters = {alpha: false, antialias: antialiasing};
		// Try to grab the standard context. If it fails, fallback to experimental.
		this.gl = canvas.getContext("webgl",contextParameters) || canvas.getContext("experimental-webgl",contextParameters);
	}
	catch(e) {}

	// If we don't have a GL context, give up now
	if (!this.gl) {
		game.showError("Unable to initialize WebGL. Your browser might not support it.");
                return false;
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
        
        return true;
};

/**
 * Loads and sets up all resources for rendering the scenes to the given HTML5
 * canvas, then start the rendering loop with the given frequency.
 * @param {object} canvas The HTML5 canvas to render to.
 * @param {Boolean} antialiasing Whether antialising should be turned on. (given
 * that the implementation supports it)
 * @param {number} freq The frequency for the rendering loop, in Hertz.
 */
ResourceCenter.prototype.init = function(canvas,antialiasing,freq) {
	var self=this;
        game.getCurrentScreen().updateStatus("loading textures...");
	this.loadTextures(function() {
                game.getCurrentScreen().updateStatus("initializing WebGL...");
		if (self.setupWebGL(canvas,antialiasing)) {
                    game.getCurrentScreen().updateStatus("",100);
                    game.getCurrentScreen().showMessage("Ready!");
                    game.getCurrentScreen().getLoadingBox().hide();
                    game.getCurrentScreen().showStats();
                    game.getCurrentScreen().startRenderLoop(1000/freq);
                }
	});
};

/**
 * Performs the webGL setup for all contained texture resources.
 */
ResourceCenter.prototype.setupTextures = function() {
	for(var i=0;i<this.textures.length;i++) {
		this.textures[i].setup(this.gl);
	}
};

/**
 * Performs the webGL setup for all contained cubemap resources.
 */
ResourceCenter.prototype.setupCubemaps = function() {
	for(var i=0;i<this.cubemaps.length;i++) {
		this.cubemaps[i].setup(this.gl);
	}
};

/**
 * Performs the webGL setup for all contained shader resources.
 */
ResourceCenter.prototype.setupShaders = function() {
	for(var i=0;i<this.shaders.length;i++) {
		this.shaders[i].setup(this.gl);
	}
};