/**
 * @fileOverview This file contains the classes, methods and global variables
 * for the creation, manipulation and rendering of graphical objects using webGL,
 * as well as managing the required resources (such as textures).
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1
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
		self.image.onload = function() {self.chainLoad(resourceCenter,index+1,callback);};
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
 * shininess.
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

/**
 * Creates a new ShaderUniform.
 * @class A class representing and wrapping a GLSL uniform 
 * variable.
 * @param {String} name The name of the uniform variable. Has to be the same
 * as the name specified in the GLSL source.
 * @param {String} type The type of the uniform variable. Only certain variable
 * types are supported.
 */
function ShaderUniform(name,type) {
	this.name=name;
	this.type=ShaderVariableTypeFromString(type);
	this.location=-1;
}

/**
 * Gets the location of the uniform variable in the specified GLSL program
 * within the specified GL context, and sets the location member of the class
 * to remember it.
 * @param {WebGLRenderingContext} gl The GL context.
 * @param {number} programID The GLSL shader program ID.
 * @returns {number} The location ID of the uniform in the program.
 * */
ShaderUniform.prototype.getAndSetLocation = function(gl,programID) {
	this.location=gl.getUniformLocation(programID,this.name);
        return this.location;
};

/**
 * Get the GL function that sets the uniform of the specified type at the
 * specified location to the specified value.
 * @param {WebGLRenderingContext} gl The GL context
 * @param {number} location The location of the uniform
 * @param {ShaderVariableTypes member} type The type of the uniform
 * @param {object} value The value to set the uniform to (can be of different
 * types)
 * @returns {function} A function that executes the webGL query of setting the
 * uniform to the specified value.
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
 * of the passed value function.
 * @param {WebGLRenderingContext} gl The GL context
 * @param {function} valueFunction The function to calculate the uniform value
 */
ShaderUniform.prototype.setValue = function(gl,valueFunction) {
	ShaderUniform.prototype.getSetterFunction(gl,this.location,this.type,valueFunction())();
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
 * @param {boolean} depthMask Whether the depthmask should be turned on while
 * rendering using this shader.
 * @param {ShaderAttribute[]} attributes The list of attributes this shader
 * has as an input.
 * @param {ShaderUniform[]} uniforms The list of uniform variables this shader
 * contains.
 * */
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
		this.uniforms[i].getAndSetLocation(gl,this.id);
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
 * Creates a new VisualObject.
 * @class The parent class of all objects to be rendered in the scene graph such
 * as full viewport quads, shaded meshes, billboards or particle systems. Serves
 * as a node, contains references to its parent and subnodes as well.
 * @param {Shader} shader The shader that should be active while rendering this object
 * @param {number} smallestParentSizeWhenDrawn If the rendering parent's apparent size is smaller than this value, render will not take place.
 */
function VisualObject(shader,smallestParentSizeWhenDrawn) {
	this.shader = shader;
	this.uniformValueFunctions = new Array();
	
	this.toBeDeleted=false;
	
	this.renderParent=null;
	this.subnodes=new Array();
	
	this.visible=true;
	
	this.visibleWidth=0;
	this.visibleHeight=0;
        
        this.lastInsideFrustumState=true;
        
        this.insideParent=undefined;
        this.smallestParentSizeWhenDrawn=smallestParentSizeWhenDrawn;
        
        this.modelMatrixCalculated = false;
}

/**
 * Returns the translation matrix describing the position of the 
 * visual object. Actual calculations have to be implemented in children 
 * classes, this one always returns an identity matrix.
 * @returns {Float32Array} A 4x4 identity matrix.
 */
VisualObject.prototype.getPositionMatrix = function() {
	return identityMatrix4();
};

/**
 * Returns the rotation matrix describing the orientation of the 
 * visual object. Actual calculations have to be implemented in children 
 * classes, this one always returns an identity matrix.
 * * @returns {Float32Array} A 4x4 identity matrix.
 */
VisualObject.prototype.getOrientationMatrix = function() {
	return identityMatrix4();
};

/**
 * Returns the scaling matrix describing the size of the 
 * visual object. Actual calculations have to be implemented in children 
 * classes, this one always returns an identity matrix.
 * * @returns {Float32Array} A 4x4 identity matrix.
 */
VisualObject.prototype.getScalingMatrix = function() {
	return identityMatrix4();
};

/**
 * Returns the numerical size of the visual object.
 * Actual calculations have to be implemented in children 
 * classes, this one always returns 1.
 * @returns {number} Always 1.
 */
VisualObject.prototype.getSize = function() {
	return 1;
};

/**
 * Returns the model transformation matrix of the visual object. 
 * Actual calculations have to be implemented in children classes to include
 * translation, rotation, scaling as well as cascading operations based on
 * relative positioning.
 * * @returns {Float32Array} A 4x4 identity matrix.
 */
VisualObject.prototype.getModelMatrix = function() {
	return identityMatrix4();
};

/**
 * Returns the vector that represents the position of the visual
 * object in the scene, taking into account the transformations of its parent
 * classes.
 * * @returns {number[]} A 3 element float vector indicating the position.
 */
VisualObject.prototype.getCascadePositionVector = function() {
	if(this.renderParent!==null) {
		return vectorAdd3(
			this.renderParent.getCascadePositionVector(),
			vector3Matrix4Product(
				getPositionVector(
					this.getPositionMatrix()
					),
				mul(
					this.renderParent.getScalingMatrix(),
					this.renderParent.getOrientationMatrix()
					)
				)
			);
	} else {
		return getPositionVector(this.getPositionMatrix());
	}
};

/**
 * Returns the scaling matrix that represents the size of the
 * visual object in the scene, taking into account the scaling of its parent
 * classes.
 * * @returns {Float32Array} A 4x4 scaling matrix indicating the size.
 */
VisualObject.prototype.getCascadeScalingMatrix = function() {
	if(this.renderParent!==null) {
		return mul(this.renderParent.getCascadeScalingMatrix(),this.getScalingMatrix());
	} else {
		return this.getScalingMatrix();
	}
};

/**
 * Return the model transformation matrix of the parent of the visual object.
 * * @returns {Float32Array} A 4x4 transformation matrix of the parent.
 */
VisualObject.prototype.getParentModelMatrix = function() {
	if(this.renderParent!==null) {
		return this.renderParent.getModelMatrix();
	} else {
		return identityMatrix4();
	}
};

/**
 * Assigns all uniforms in the shader program associated with this object that
 * this object has a value function for, using the appropriate webGL calls.
 * The matching is done based on the names of the uniforms.
 * @param {WebGLRenderingContext} gl The webGL context to use
 */
VisualObject.prototype.assignUniforms = function(gl) {
	for(var i=0;i<this.shader.uniforms.length;i++) {
		if(this.uniformValueFunctions[this.shader.uniforms[i].name]!==undefined) {
			this.shader.uniforms[i].setValue(gl,this.uniformValueFunctions[this.shader.uniforms[i].name]);
		}
	}
};

/**
 * Checks if the object is inside the viewing frustum of the passed camera,
 * taking into account the parents of the object as well. Also sets the view
 * width and height members of the object.
 * @param {Camera} camera The camera the frustum of which is to be checked
 * @returns {boolean} Whether the object is inside the frustum.
 */
VisualObject.prototype.isInsideViewFrustum = function(camera) {
        if (this.renderParent!==null) {
            if (this.insideParent===undefined) {
                this.insideParent=(this.getPositionMatrix()[12]<this.renderParent.getSize()) &&
                        (this.getPositionMatrix()[13]<this.renderParent.getSize()) && 
                        (this.getPositionMatrix()[14]<this.renderParent.getSize());
            }
            if (this.renderParent.lastInsideFrustumState===false) {
                this.visibleWidth=0;
                this.visibleHeight=0;
                this.lastInsideFrustumState = false;
                return this.lastInsideFrustumState;
            } else if (this.insideParent===true) {
                this.visibleWidth=this.renderParent.visibleWidth;
                this.visibleHeight=this.renderParent.visibleHeight;
                this.lastInsideFrustumState = true;
                return this.lastInsideFrustumState;
            }
        }
	var baseMatrix =
			translationMatrixv(getPositionVector4(
				mul(
					translationMatrixv(this.getCascadePositionVector()),
					camera.matrix
					)
				));
        var fullMatrix =
               mul(mul(this.getCascadeScalingMatrix(),baseMatrix),camera.perspectiveMatrix);
		
	var position = vector4Matrix4Product([0.0,0.0,0.0,1.0],fullMatrix);
	position = [position[0]/position[3],position[1]/position[3],position[2]/position[3]];
	var zOffsetPosition = vector4Matrix4Product([0.0,0.0,-this.getSize(),1.0],fullMatrix);
	var zOffset = (zOffsetPosition[2]/zOffsetPosition[3]);
		
	// frustum culling: back and front
	if (((zOffset>-1.0) && (zOffset<1.0)) || ((position[2]>-1.0) && (position[2]<1.0))) {
                
                // frustum culling: sides
                var xOffsetPosition = vector4Matrix4Product([0.0,0.0,0.0,1.0],mul(mul(baseMatrix,translationMatrix(this.getSize()*this.getCascadeScalingMatrix()[0],0.0,0.0)),camera.perspectiveMatrix));
                var yOffsetPosition = vector4Matrix4Product([0.0,0.0,0.0,1.0],mul(mul(baseMatrix,translationMatrix(0.0,this.getSize()*this.getCascadeScalingMatrix()[0],0.0)),camera.perspectiveMatrix));
		var xOffset = Math.abs(xOffsetPosition[0]/xOffsetPosition[3]-position[0]);
                var yOffset = Math.abs(yOffsetPosition[1]/yOffsetPosition[3]-position[1]);
                //alert(offset);
		if (
                    !(((position[0]+xOffset<-1)&&(position[0]-xOffset<-1))||((position[0]+xOffset>1)&&(position[0]-xOffset>1)))&&
		    !(((position[1]+yOffset<-1)&&(position[1]-yOffset<-1))||((position[1]+yOffset>1)&&(position[1]-yOffset>1)))
                    ) {
			this.visibleWidth=xOffset;
			this.visibleHeight=yOffset;
			this.lastInsideFrustumState = true;
		} else {
                        this.visibleWidth=0;
			this.visibleHeight=0;
			this.lastInsideFrustumState = false;
		}
	} else {
                this.visibleWidth=0;
		this.visibleHeight=0;
		this.lastInsideFrustumState = false;
	}
        return this.lastInsideFrustumState;
};

/**
 * Renders the object and all its subnodes.
 * @param {VisualObject} parent The rendering parent to which the position,
 * orientation and scaling of the object is relative.
 * @param {ResourceCenter} resourceCenter The resource center that holds the
 * necessary rendering resources .
 * @param {Scene} scene The scene within which the object is located.
 * @param {number} screenWidth The size of the rendering viewport in pixels,
 * to determine the actual drawn size of the object (for dynamic LOD)
 * * @param {number} screenHeight The size of the rendering viewport in pixels,
 * to determine the actual drawn size of the object (for dynamic LOD)
 * @param {boolean} depthMaskPhase Whether we are drawing in the depthmask
 * enabled or disabled phase (renders only phase matches with the type of the
 * shared the object has)
 * */ 
VisualObject.prototype.cascadeRender = function(parent,resourceCenter,scene,screenWidth,screenHeight,depthMaskPhase) {
    if(this.visible) {
        this.renderParent=parent;
        if ((this.renderParent===null) || (this.smallestParentSizeWhenDrawn===undefined) ||
                (Math.max(this.renderParent.visibleWidth*screenWidth,this.renderParent.visibleHeight*screenHeight)>=this.smallestParentSizeWhenDrawn)) {
            if((this.shader.depthMask===depthMaskPhase)&&(this.isInsideViewFrustum(scene.activeCamera))) {
                resourceCenter.setCurrentShader(this.shader,scene);
                this.assignUniforms(resourceCenter.gl);
                this.render(resourceCenter,screenWidth,screenHeight,scene.lodContext);
            } else if(scene.uniformsAssigned===false) {
                resourceCenter.setCurrentShader(this.shader,scene);
            }
            for(var i=0;i<this.subnodes.length;i++) {
                this.subnodes[i].cascadeRender(this,resourceCenter,scene,screenWidth,screenHeight,depthMaskPhase);
            }
        }
    }
};

VisualObject.prototype.resetModelMatrixCalculated = function() {
    var i;
    this.modelMatrixCalculated=false;
    for(var i=0;i<this.subnodes.length;i++) {
        this.subnodes[i].resetModelMatrixCalculated();
    }    
};

/**
 * Creates a new Full Viewport Quad visual object.
 * @class Represent a Full Viewport Quad to be used for drawing the background
 * using a cube mapped texture.
 * @extends VisualObject
 * @param {EgomModel} model The model to be used (see fvqModel()).
 * @param {Shader} shader The shader that should be active while rendering this object.
 * @param {string} samplerName The name of the uniform variable that holds the
 * texture sampler for the drawing.
 * @param {Cubemap} cubemap The cubemap object to be used for mapping the background
 * @param {Camera} camera The camera to be used for querying the cube map.
 * */
function FVQ(model,shader,samplerName,cubemap,camera) {
	VisualObject.call(this,shader);
	this.model=model;
	this.samplerName=samplerName;
	this.cubemap=cubemap;
        this.camera=camera;
	
	var self = this;
	
	this.uniformValueFunctions[this.samplerName] =                   function() { return self.cubemap.id; };
	this.uniformValueFunctions["u_viewDirectionProjectionInverse"] = function() { return inverse4(mul(self.camera.orientationMatrix,self.camera.perspectiveMatrix)); };
}

FVQ.prototype = new VisualObject();
FVQ.prototype.constructor = FVQ;

/**
 * Always returns true as the FVQ always has to be rendered.
 * @param {Camera} camera Irrelevant in this case, FVQ is visible in all directions.
 * @returns {boolean} Always true.
 */
FVQ.prototype.isInsideViewFrustum = function(camera) {
	return true;
};

/**
 * Renders the FVQ, binding the cube mapped texture.
 * @param {ResourceCenter} resourceCenter The resource center that holds the
 * cube mapped textures, the FVQ model and the shader.
 * @param {number} screenWidth Irrelevant in this case.
 * @param {number} screenHeight Irrelevant in this case.
 * @param {LODContext} lodContext Irrelevant in this case.
 */
FVQ.prototype.render = function(resourceCenter,screenWidth,screenHeight,lodContext) {
	resourceCenter.bindTexture(this.cubemap);
	
        drawnPolyogons+=2;
	this.model.render(resourceCenter.gl,false);
};

/**
 * Creates a LOD associated 3D model object.
 * @class A 3D model paired up with Level Of Detail indicator.
 * @param {EgomModel} model The 3D model data.
 * @param {number} lod The LOD level to be associated with the model.
 */
function ModelWithLOD(model,lod) {
	this.model=model;
	this.lod=lod;
}

/**
 * Creates a mesh type visual object.
 * @class Visual object that renders a 3D model from a set of different LOD
 * options.
 * @extends VisualObject
 * @param {ModelWithLOD[]} modelsWithLOD The series of 3D models with their 
 * associated LOD information.
 * @param {Shader} shader The shader that should be active while rendering this object.
 * @param {Texture} texture The texture that should be bound while rendering this object
 * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
 * @param {Float32Array} orientationMatrix The 4x4 rotation matrix representing the initial orientation of the object.
 * @param {Float32Array} scalingMatrix The 4x4 scaling matrix representing the initial size of the object.
 * @param {boolean} lineMode Whether the mesh should be drawn as wireframe instead of solid.
 */
function Mesh(modelsWithLOD,shader,texture,positionMatrix,orientationMatrix,scalingMatrix,lineMode) {
	VisualObject.call(this,shader);
	this.modelsWithLOD=modelsWithLOD;
	this.texture=texture;
	this.positionMatrix=positionMatrix;
	this.orientationMatrix=orientationMatrix;
	this.scalingMatrix=scalingMatrix;
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

/**
 * Returns the translation matrix describing the position of the mesh.
 * @returns {Float32Array} The 4x4 translation matrix indicating the position.
 */
Mesh.prototype.getPositionMatrix = function() {
    return this.positionMatrix;
};

Mesh.prototype.setPositionMatrix = function(newValue) {
    this.positionMatrix = newValue;
    this.modelMatrixCalculated = false;
};

/**
 * Returns the rotation matrix describing the orientation of the mesh.
 * @returns {Float32Array} The 4x4 rotation matrix indicating the orientation.
 */
Mesh.prototype.getOrientationMatrix = function() {
    return this.orientationMatrix;
};

Mesh.prototype.setOrientationMatrix = function(newValue) {
    this.orientationMatrix = newValue;
    this.modelMatrixCalculated = false;
};

/**
 * Returns the scaling matrix describing the size of the mesh.
 * @returns {Float32Array} The 4x4 scaling matrix indicating the size.
 */
Mesh.prototype.getScalingMatrix = function() {
    return this.scalingMatrix;
};

Mesh.prototype.setScalingMatrix = function(newValue) {
    this.scalingMatrix = newValue;
    this.modelMatrixCalculated = false;
};

/**
 * Returns the size of the largest model of the mesh.
 * @returns {number} The size of the largest model of the mesh.
 */
Mesh.prototype.getSize = function() {
	return this.modelSize;
};

/**
 * Returns the model transformation matrix of the mesh, also taking into account
 * the parent's transformation.
 * @returns {Float32Array} The 4x4 model transformation matrix of the object.
 */
Mesh.prototype.getModelMatrix = function() {
    if (this.modelMatrixCalculated===false) {
	this.modelMatrix=mul(mul(this.scalingMatrix,this.orientationMatrix),mul(this.positionMatrix,this.getParentModelMatrix()));
        this.modelMatrixCalculated=true;
    }
    return this.modelMatrix;    
};

/**
 * Renders the appropriate model of the mesh.
 * @param {ResourceCenter} resourceCenter The resource center that holds the
 * texture, the models and the shader.
 * @param {number} screenWidth The size of the screen in pixels for LOD decision.
 * @param {number} screenHeight The size of the screen in pixels for LOD decision.
 * @param {LODContext} lodContext The object storing the LOD thresholds and settings.
 */
Mesh.prototype.render = function(resourceCenter,screenWidth,screenHeight,lodContext) {
	resourceCenter.bindTexture(this.texture);
	// choose the model of appropriate LOD
	var visibleSize = Math.max(this.visibleWidth*screenWidth,this.visibleHeight*screenHeight);
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
	
	if (this.lineMode===true) {
		resourceCenter.gl.drawArrays(resourceCenter.gl.LINES, model.bufferStartLines, 2*model.lines.length);
	} else {
		resourceCenter.gl.drawArrays(resourceCenter.gl.TRIANGLES, model.bufferStart, 3*model.triangles.length);
		drawnPolyogons+=model.triangles.length;
	}
};

/**
 * Creates a billboard type visual object, used for projectiles.
 * @class Visual object that renders a 2D billboard transformed in 3D space.
 * @extends VisualObject
 * @param {EgomModel} model The model to store the simple billboard data.
 * @param {Shader} shader The shader that should be active while rendering this object.
 * @param {Texture} texture The texture that should be bound while rendering this object
 * @param {number} size The size of the billboard
 * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
 * @param {Float32Array} orientationMatrix The 4x4 rotation matrix representing the initial orientation of the object.
 */
function Billboard(model,shader,texture,size,positionMatrix,orientationMatrix) {
	VisualObject.call(this,shader);
	this.model=model;
	this.texture=texture;
	this.positionMatrix=positionMatrix;
	this.orientationMatrix=orientationMatrix;
	this.scalingMatrix=scalingMatrix(size,size,size);
	
	var self = this;
	
	this.uniformValueFunctions["u_modelMatrix"] = function() { return mul(mul(self.scalingMatrix,self.orientationMatrix),self.positionMatrix); };
}

Billboard.prototype = new VisualObject();
Billboard.prototype.constructor = Billboard;

/**
 * Always returns true as is it faster to skip the check because anyway we are
 * only rendering 2 triangles here.
 * @param {Camera} camera Irrelevant in this case.
 * @returns {boolean} Always true.
 */
Billboard.prototype.isInsideViewFrustum = function(camera) {
	return true;
};

/**
 * Renders the billboard, binding the texture.
 * @param {ResourceCenter} resourceCenter The resource center that holds the
 * textures, the model and the shader.
 * @param {number} screenWidth Irrelevant in this case.
 * @param {number} screenHeight Irrelevant in this case.
 * @param {LODContext} lodContext Irrelevant in this case.
 */
Billboard.prototype.render = function(resourceCenter,screenWidth,screenHeight,lodContext) {
	resourceCenter.bindTexture(this.texture);
	
	drawnPolyogons+=2;
	this.model.render(resourceCenter.gl,false);
};

/**
 * Creates a dynamic particle type visual object that has a certain lifespan
 * and GLSL takes into account its age when rendering. 
 * @class Visual object that renders a 2D billboard positioned in 3D space and
 * dynamically changing size during it's lifespan. Used for flashes and
 * particle systems.
 * @extends VisualObject
 * @param {EgomModel} model The model to store the simple billboard data.
 * @param {Shader} shader The shader that should be active while rendering this object.
 * @param {Texture} texture The texture that should be bound while rendering this object.
 * @param {number[]} color The RGBA components of the color to modulate the billboard texture with.
 * @param {number} size The size of the billboard
 * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
 * @param {number} duration The lifespan of the particle in milliseconds.
 * @param {number} smallestParentSizeWhenDrawn If the rendering parent's apparent size is smaller than this, render will not take place.
 */
function DynamicParticle(model,shader,texture,color,size,positionMatrix,duration,smallestParentSizeWhenDrawn) {
	VisualObject.call(this,shader,smallestParentSizeWhenDrawn);
	this.model=model;
	this.texture=texture;
	this.color=color;
	this.positionMatrix=positionMatrix;
	this.scalingMatrix=scalingMatrix(size,size,size);
	
	this.creationTime=new Date().getTime();
	this.duration=duration;
	var self = this;
	
	this.uniformValueFunctions["u_modelMatrix"] =   function() { return mul(mul(self.scalingMatrix,self.positionMatrix),self.getParentModelMatrix()); };
	this.uniformValueFunctions["u_billboardSize"] = function() { return self.scalingMatrix[0]; };
	this.uniformValueFunctions["u_relAge"] = function() { return (new Date().getTime()-self.creationTime)/self.duration; };
	this.uniformValueFunctions["u_color"] =   function() { return self.color; };
}

DynamicParticle.prototype = new VisualObject();
DynamicParticle.prototype.constructor = DynamicParticle;

/**
 * Always returns true as is it faster to skip the check because anyway we are
 * only rendering 2 triangles here.
 * @param {Camera} camera Irrelevant in this case.
 * @returns {boolean} Always true.
 */
DynamicParticle.prototype.isInsideViewFrustum = function(camera) {
	return (this.renderParent===null?true:this.renderParent.lastInsideFrustumState);
};

/**
 * Renders the particle, binding the needed texture.
 * @param {ResourceCenter} resourceCenter The resource center that holds the
 * textures, the model and the shader.
 * @param {number} screenWidth Irrelevant in this case.
 * @param {number} screenHeight Irrelevant in this case.
 * @param {LODContext} lodContext Irrelevant in this case.
 */
DynamicParticle.prototype.render = function(resourceCenter,screenWidth,screenHeight,lodContext) {
	resourceCenter.bindTexture(this.texture);
	if(new Date().getTime()>=this.creationTime+this.duration) {
		this.toBeDeleted=true;
	} else {
		drawnPolyogons+=2;
		this.model.render(resourceCenter.gl,false);
	}
};

/**
 * Creates a static particle type visual object.
 * @class Visual object that renders a 2D billboard positioned in 3D space.
 * @extends DynamicParticle
 * @param {EgomModel} model The model to store the simple billboard data.
 * @param {Shader} shader The shader that should be active while rendering this object.
 * @param {Texture} texture The texture that should be bound while rendering this object.
 * @param {number[]} color The RGBA components of the color to modulate the billboard texture with.
 * @param {number} size The size of the billboard
 * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
 * @param {number} smallestParentSizeWhenDrawn If the rendering parent's apparent size is smaller than this, render will not take place.
 */
function StaticParticle(model,shader,texture,color,size,positionMatrix,smallestParentSizeWhenDrawn) {
	DynamicParticle.call(this,model,shader,texture,color,size,positionMatrix,1000,smallestParentSizeWhenDrawn);
	this._relSize=0;
	var self = this;
	this.uniformValueFunctions["u_relAge"] = function() { return 1.0-self._relSize; };
}

StaticParticle.prototype = new DynamicParticle();
StaticParticle.prototype.constructor = StaticParticle;

/**
 * Getter function for the _relSize member.
 * @returns {number} The value of the relative size.
 */
StaticParticle.prototype.getRelSize = function() {
    return this._relSize;
};

/**
 * Setter function for the _relSize member. Also updates the visibility.
 * @param {number} newValue The new value of the relative size.
 */
StaticParticle.prototype.setRelSize = function(newValue) {
    this._relSize=newValue;
    this.visible=this._relSize>=0.001;
};

/**
 * Renders the particle, binding the needed texture.
 * @param {ResourceCenter} resourceCenter The resource center that holds the
 * textures, the model and the shader.
 * @param {number} screenWidth Irrelevant in this case.
 * @param {number} screenHeight Irrelevant in this case.
 * @param {LODContext} lodContext Irrelevant in this case.
 */
StaticParticle.prototype.render = function(resourceCenter,screenWidth,screenHeight,lodContext) {
	resourceCenter.bindTexture(this.texture);
	if(this._relSize>0) {
		drawnPolyogons+=2;
		this.model.render(resourceCenter.gl,false);
	}
};

/**
 * Creates a dust particle type visual object.
 * @class Visual object that renders a point like object as a line as it is
 * moving. Used to represent dust particles that give a visual clue about the
 * motion of the camera.
 * @extends VisualObject
 * @param {EgomModel} model A model of 2 vertices has to be passed (see dustModel()).
 * @param {Shader} shader The shader that should be active while rendering this object.
 * @param {number[]} color The RGBA components of the color to modulate the billboard texture with.
 * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
 */
function DustParticle(model,shader,color,positionMatrix) {
	VisualObject.call(this,shader);
	this.color=color;
	this.positionMatrix=positionMatrix;
        this.shift=[0.0,0.0,0.0];
        
        this.model = model;
	
	var self = this;
	
	this.uniformValueFunctions["u_modelMatrix"] =   function() { return mul(self.positionMatrix,self.getParentModelMatrix()); };
        this.uniformValueFunctions["u_color"] =   function() { return self.color; };
        this.uniformValueFunctions["u_shift"] =   function() { return self.shift; };
}

DustParticle.prototype = new VisualObject();
DustParticle.prototype.constructor = DustParticle;

/**
 * Always returns true as is it faster to skip the check because anyway we are
 * only rendering one line here.
 * @param {Camera} camera Irrelevant in this case.
 * @returns {boolean} Always true.
 */
DustParticle.prototype.isInsideViewFrustum = function(camera) {
	return true;
};

/**
 * Renders the particle.
 * @param {ResourceCenter} resourceCenter The resource center that holds the
 * the model and the shader.
 * @param {number} screenWidth Irrelevant in this case.
 * @param {number} screenHeight Irrelevant in this case.
 * @param {LODContext} lodContext Irrelevant in this case.
 */
DustParticle.prototype.render = function(resourceCenter,screenWidth,screenHeight,lodContext) {
	this.model.render(resourceCenter.gl,true);
};

/**
 * Creates a new camera object.
 * @class A virtual camera that can be positioned free or relative to another
 * object. The scene can contain many cameras and the real camera can be set to
 * follow one of these.
 * @param {number} aspect The X/Y aspect ration of the screen of the camera.
 * @param {number} fov The Field Of View of the camera in degrees.
 * @param {boolean} controllablePosition Whether the position of the camera is changeable by the player.
 * @param {boolean} controllableDirection Whether the direction of the camera is changeable by the player.
 * @param {VisualObject} followedObject The object to which the camera position and direction has to be interpredet.
 * If undefined, the camera position is interpreted as absolute (relative to scene center)
 * @param {Float32Array} followPositionMatrix The translation matrix describing the relative position to the followed object.
 * @param {Float32Array} followOrientationMatrix The rotation matrix describing the relative orientation to the followed object. 
 * @param {boolean} rotationCenterIsObject Whether the rotation of the camera has to be executed around the followed model.
 */
function Camera(aspect,fov,controllablePosition,controllableDirection,followedObject,followPositionMatrix,followOrientationMatrix,rotationCenterIsObject) {
        this.positionMatrix=identityMatrix4();
	this.orientationMatrix=identityMatrix4();
	this.matrix=identityMatrix4();
	this.velocityVector=[0,0,0];
	this.maxSpeed=5;
	this.acceleration=0.1;
	this.angularVelocityVector=[0,0,0];
	this.maxTurn=0.1;
	this.angularAcceleration=0.01;
	if(followedObject!==undefined) {
            this.followObject(followedObject,followPositionMatrix,followOrientationMatrix,rotationCenterIsObject);
        }
	this.aspect=aspect;
	this.fov=fov;
        this.controllablePosition=controllablePosition;
        this.controllableDirection=controllableDirection;
	this.updatePerspectiveMatrix();
        this.nextView=null;
}

/**
 * Sets the camera up to follow the given visual object.
 * @param {VisualObject} followedObject The object to which the camera position and direction has to be interpredet.
 * If undefined, the camera position is interpreted as absolute (relative to scene center)
 * @param {Float32Array} followPositionMatrix The translation matrix describing the relative position to the followed object.
 * @param {Float32Array} followOrientationMatrix The rotation matrix describing the relative orientation to the followed object. 
 * @param {boolean} rotationCenterIsObject Whether the rotation of the camera has to be executed around the followed model.
 */
Camera.prototype.followObject = function(followedObject,followPositionMatrix,followOrientationMatrix,rotationCenterIsObject) {
    this.followedObject=followedObject;
    if(followPositionMatrix===undefined) {
        followPositionMatrix=identityMatrix4();
    }
    if(followOrientationMatrix===undefined) {
        followOrientationMatrix=identityMatrix4();
    }
    this.followPositionMatrix=followPositionMatrix;
    this.followOrientationMatrix=followOrientationMatrix;
    this.originalFollowPositionMatrix=followPositionMatrix;
    this.originalFollowOrientationMatrix=followOrientationMatrix;
    this.rotationCenterIsObject=rotationCenterIsObject;
};

/**
 * Resets the camera's relative position and orientation to their original values.
 */
Camera.prototype.reset = function() {
    this.followPositionMatrix=this.originalFollowPositionMatrix;
    this.followOrientationMatrix=this.originalFollowOrientationMatrix;
};

Camera.prototype.updatePerspectiveMatrix = function() {
    this.perspectiveMatrix=perspectiveMatrix4(this.aspect/20,1.0/20,this.aspect*Math.cos(this.fov*3.1415/360)*2/20,5000.0);
};

/**
 * Sets the camera's Field Of View by also recalculating the perspective matrix.
 * @param {number} fov The new desired FOV in degrees.
 */
Camera.prototype.setFOV = function(fov) {
    this.fov=fov;
    this.updatePerspectiveMatrix();
};

/**
 * Sets the camera's aspect ratio by also recalculating the perspective matrix.
 * @param {number} aspect The new desired aspect ratio.
 */
Camera.prototype.setAspect = function(aspect) {
    this.aspect=aspect;
    this.updatePerspectiveMatrix();
};

/**
 * Creates a new SceneCamera.
 * @class A camera that is used to draw a scene. Can follow one of
 * the camera objects in the resource center, adapting its parameters to the
 * ones of that camera in a given time.
 * @extends Camera
 * @param {number} aspect The starting X/Y aspect ratio of the camera.
 * @param {number} fov The starting field of view value of the camera in degrees.
 * @param {number} adaptationTime The initial duration the camera will take when adapting its parameters
 * to a new followed camera in milliseconds.
 * @param {Camera} followedCamera Initial camera object to follow.
 * */
function SceneCamera(aspect,fov,adaptationTime,followedCamera) {
    Camera.call(this,aspect,fov,true,true);
    this.adaptationTime=adaptationTime;
    this.followCamera(followedCamera);
}

SceneCamera.prototype = new Camera();
SceneCamera.prototype.constructor = SceneCamera;

/**
 * A temporary function needed as controllers have to set their controlled
 * entity at initialization, and they expect a controllable entity that has
 * this function, however ControllableEntity is defined in logic.js. The
 * scene camera has a controller so it needs this function (to be cleaned up
 * later)
 * @param {Controller} newController
 */
SceneCamera.prototype.setControllerWithoutChecks = function(newController) {
    this.controller = newController;
};

/**
 * Set the camera up to adapt to a virtual camera.
 * @param {Camera} camera The new camera to follow.
 * @param {number} adaptationTime The duration the camera will take when adapting its parameters
 * to the new followed camera in milliseconds. (optional)
 */
SceneCamera.prototype.followCamera = function(camera,adaptationTime) {
    if(adaptationTime!==undefined) {
        this.adaptationTime=adaptationTime;
    }
    this.followedCamera=camera;
    this.adaptationStartTime=new Date().getTime();
    this.adaptationStartPositionMatrix=this.positionMatrix;
    this.adaptationStartOrientationMatrix=this.orientationMatrix;
    this.adaptationStartFOV=this.fov;
    this.adaptationTimeLeft=this.adaptationTime;
};

/**
 * Updates the transformation matrices of the scene camera to transition to a
 * new followed camera if it did not adapt to it fully yet.
 */
SceneCamera.prototype.update = function() {
    if(this.followedCamera!==undefined) {
        if(this.adaptationTimeLeft>0) {
            var currentTime=new Date().getTime();
            var adaptationProgress=Math.min(1.0,(currentTime-this.adaptationStartTime)/this.adaptationTime);
            this.adaptationTimeLeft=this.adaptationTime-(currentTime-this.adaptationStartTime);
            var trans = translationMatrix(
                    (this.followedCamera.positionMatrix[12]-this.adaptationStartPositionMatrix[12])*adaptationProgress,
                    (this.followedCamera.positionMatrix[13]-this.adaptationStartPositionMatrix[13])*adaptationProgress,
                    (this.followedCamera.positionMatrix[14]-this.adaptationStartPositionMatrix[14])*adaptationProgress
                    );
            var newPositionMatrix=translate(this.adaptationStartPositionMatrix,trans);
            var velocityMatrix = mul(translationMatrix(
                newPositionMatrix[12]-this.positionMatrix[12],
                newPositionMatrix[13]-this.positionMatrix[13],
                newPositionMatrix[14]-this.positionMatrix[14]),this.orientationMatrix);
            this.velocityVector = [velocityMatrix[12],velocityMatrix[13],velocityMatrix[14]];
            this.positionMatrix=newPositionMatrix;
            this.orientationMatrix=correctOrthogonalMatrix(addMatrices4(
                mulMatrix4Scalar(this.adaptationStartOrientationMatrix,1.0-adaptationProgress),
                mulMatrix4Scalar(this.followedCamera.orientationMatrix,adaptationProgress)));
            this.matrix=mul(this.positionMatrix,this.orientationMatrix);
            this.setFOV(this.adaptationStartFOV+(this.followedCamera.fov-this.adaptationStartFOV)*adaptationProgress);
        } else {
            this.positionMatrix=this.followedCamera.positionMatrix;
            this.orientationMatrix=this.followedCamera.orientationMatrix;
            this.matrix=this.followedCamera.matrix;
            this.perspectiveMatrix=this.followedCamera.perspectiveMatrix;
        }
    }
};

SceneCamera.prototype.getFollowedSpacecraft = function(logicContext) {
    var i;
    if ((this.followedCamera!==undefined) && (this.followedCamera.followedObject!==undefined)) {
        // look up the spacecraft being followed (these references need to be cleaned up
        // to make this part transparent)
        i=0;
        while ((i<logicContext.level.spacecrafts.length)&&
                (logicContext.level.spacecrafts[i].visualModel!==this.followedCamera.followedObject)) {
            i++;
        }
        // if we found it, set the proper controller
        if (i<logicContext.level.spacecrafts.length) {
            return logicContext.level.spacecrafts[i];
        }
    }
    return null;
};

/**
 * Creates a new scene graph object.
 * @class An object to hold a hierarchic scene graph and webGL configuration for rendering.
 * @param {number} left The X coordinate of the top left corner of the viewport on the screen.
 * @param {number} top The Y coordinate of the top left corner of the viewport on the screen.
 * @param {number} width The width of the viewport in pixels.
 * @param {number} height The height of the viewport in pixels.
 * @param {boolean} clearColorOnRender Whether to clear the color buffer every time at the beginning of rendering the scene.
 * @param {boolean[]} colorMask Which components shall be cleared if the color buffer is to be cleared.
 * @param {number[]} clearColor What color to use when clearing the buffer (RGBA components).
 * @param {boolean} clearDepthOnRender Whether to clear the depth buffer every time at the beginning of rendering the scene.
 * @param {LODContext} lodContext The LOD threshold and configuration to be used
 * for rendering object with the appropriate level of detail.
 */
function Scene(left,top,width,height,clearColorOnRender,colorMask,clearColor,clearDepthOnRender,lodContext) {
	this.left=left;
	this.top=top;
	this.width=width;
	this.height=height;
	
	this.clearColorOnRender=clearColorOnRender;
	this.colorMask=colorMask;
	this.clearColor=clearColor;
	this.clearDepthOnRender=clearDepthOnRender;
	
        this.objects = new Array();
        this.cameras = new Array();
        
	this.activeCamera = new SceneCamera(width/height,60,1000);
		
        this.lodContext = lodContext;
        
	this.uniformValueFunctions = new Object();
	this.uniformsAssigned=false;
        
        this.firstRender=true;
}

Scene.prototype.getLODContext = function() {
    return this.lodContext;
};

Scene.prototype.resizeViewport = function(newWidth,newHeight) {
    var i;
    this.width=newWidth;
    this.height=newHeight;
    for(var i=0;i<this.cameras.length;i++) {
        this.cameras[i].setAspect(this.width/this.height);
    }
    this.activeCamera.setAspect(this.width/this.height);
};

/**
 * Assigns all uniforms in the given shader program that
 * the scene has a value function for, using the appropriate webGL calls.
 * The matching is done based on the names of the uniforms.
 * @param {WebGLRenderingContext} gl The webGL context to use
 * @param {Shader} shader The shader program in which to assign the uniforms.
 */
Scene.prototype.assignUniforms = function(gl,shader) {
	for(var i=0;i<shader.uniforms.length;i++) {
		if(this.uniformValueFunctions[shader.uniforms[i].name]!==undefined) {
			shader.uniforms[i].setValue(gl,this.uniformValueFunctions[shader.uniforms[i].name]);
		}
	}
	this.uniformsAssigned=true;
};

// Global variable to store the number of polygon drawn so far in the current render.
var drawnPolygons = 0;

/**
 * Renders the whole scene applying the general configuration and then rendering
 * all visual objects in the graph.
 * @param {ResourceCenter} resourceCenter The resource center that holds the
 * shaders, textures, models of the scene.
 */
Scene.prototype.render = function(resourceCenter) {
	document.getElementById("output").innerHTML="";
	drawnPolyogons=0;
	
	var gl = resourceCenter.gl;
	
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
	
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	for(var i=0;i<this.objects.length;i++) {
		while ((i<this.objects.length)&&((this.objects[i]===undefined)||(this.objects[i].toBeDeleted))) {
			delete this.objects[i];
			this.objects.splice(i,1);
		}
		if (i<this.objects.length) {
			this.objects[i].cascadeRender(null,resourceCenter,this,this.width,this.height,true);
		}
	}
	gl.depthMask(false);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        for(var i=0;i<this.objects.length;i++) {
		this.objects[i].resetModelMatrixCalculated();
	}
	for(var i=0;i<this.objects.length;i++) {
		this.objects[i].cascadeRender(null,resourceCenter,this,this.width,this.height,false);
	}
	document.getElementById("output").innerHTML+=drawnPolyogons;
};

/**
 * Creates a new LOD context object.
 * @class Holds a certain LOD configuration to be used for making LOD decisions while rendering.
 * @param {number} maxEnabledLOD The highest LOD that can be chosen while rendering.
 * @param {number[]} thresholds The threshold size in pixels for each LOD.
 * For each object the highest LOD, for which its size exceed the threshold, will be used.
 */
function LODContext(maxEnabledLOD,thresholds) {
	this.maxEnabledLOD=maxEnabledLOD;
	this.thresholds=thresholds;
}

/**
 * Creates a new Resource Center object.
 * @class This class holds and manages all the various resources and their 
 * configuration that are needed for rendering: textures, shaders, models, cameras, scenes.
 */
function ResourceCenter() {
	this.gl=null;
	
	this.textures=new Array();
	this.cubemaps=new Array();
	this.shaders=new Array();
	this.models=new Array();
	this.scenes=new Array();
	
	this.vertexBuffers=new Array();
		
	this.maxRenderTimes = 30;
	this.renderTimes = new Array();
	
	this.currentShader=null;
	this.boundTexture=null;
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
    document.getElementById("status").innerHTML="loading model: "+filename+"...";
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
    document.getElementById("status").innerHTML="loading model: "+filename+"... done.";
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

/**
 * Loads the shader configuration from an external XML file into the resource
 * center.
 * @param {string} filename The XML file where the shader configuration is stored.
 */
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

/**
 * Sets up the provided shader for usage within the provided scene, also assigning
 * the scene uniforms.
 * @param {Shader} shader The shader to set as current.
 * @param {Scene} scene The scene we are drawing.
 */
ResourceCenter.prototype.setCurrentShader = function(shader,scene) {
	if(this.currentShader!==shader) {
		this.gl.useProgram(shader.id);
		shader.bindBuffers(this.gl);	
		scene.assignUniforms(this.gl,shader);
		this.currentShader=shader;
	}
};

/**
 * Binds the given texture or cubemap resource with webGL
 * @param {Texture|Cubemap} texture The resource to bind for rendering.
 */
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

/**
 * Sets up a webGL context and performs the basic configuration with it.
 * @param {object} canvas The HMTL5 canvas to get and configure the context for.
 * @returns {boolean} Indicates whether the creation of the WebGL context succeeded.
 */
ResourceCenter.prototype.setupWebGL = function(canvas) {
	try {
		// Try to grab the standard context. If it fails, fallback to experimental.
		this.gl = canvas.getContext("webgl",{alpha: false, antialias: true}) || canvas.getContext("experimental-webgl",{alpha: false, antialias: true});
	}
	catch(e) {}

	// If we don't have a GL context, give up now
	if (!this.gl) {
		alert("Unable to initialize WebGL. Your browser might not support it.");
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
 * @param {number} freq The frequency for the rendering loop, in Hertz.
 */
ResourceCenter.prototype.init = function(canvas,freq) {
	var self=this;
	document.getElementById("status").innerHTML="loading textures...";
	this.loadTextures(function() {
		document.getElementById("status").innerHTML="initializing WebGL...";
		if (self.setupWebGL(canvas)) {
                    document.getElementById("status").style.display="none";
                    document.getElementById("progress").value=100;
                    alert("ready!");
                    document.getElementById("progress").style.display="none";
                    document.getElementById("output").style.display="block";
                    document.getElementById("ui").style.display="block";
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

/**
 * Renders all the contained scenes.
 */
ResourceCenter.prototype.renderScenes = function() {
	for(var i=0;i<this.scenes.length;i++) {
		this.scenes[i].render(this);
	}
};

/**
 * Creates a new graphics context object.
 * @class A graphics context for other modules, containing the current resource
 * center and scene.
 * @param {ResourceCenter} resourceCenter The resource center to be stored in the context.
 * @param {Scene} scene The scene to be stored in the context.
 */
function GraphicsContext(resourceCenter,scene) {
	this.resourceCenter=resourceCenter;
	this.scene=scene;
}
