/**
 * @fileOverview This file the {@link Scene} class, which can be used to build
 * and render a scene containing {@link VisualObject} instances.
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
 * Creates a new VisualObject.
 * @class The parent class of all objects to be rendered in the scene graph such
 * as full viewport quads, shaded meshes, billboards or particle systems. Serves
 * as a node, contains references to its parent and subnodes as well.
 * @param {Shader} shader The shader that should be active while rendering this object
 * @param {number} smallestParentSizeWhenDrawn If the rendering parent's apparent size is smaller than this value, render will not take place.
 * @param {boolean} renderedWithDepthMask Tells whether this object should be rendered when the depth mask is on (= it contains non-transparent triangles)
 * @param {boolean} renderedWithoutDepthMask Tells whether this object should be rendered when the depth mask is off (= it contains transparent triangles)
 */
function VisualObject(shader,smallestParentSizeWhenDrawn,renderedWithDepthMask,renderedWithoutDepthMask) {
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
        
        this.renderedWithDepthMask = renderedWithDepthMask;
        this.renderedWithoutDepthMask = renderedWithoutDepthMask;
        
        this.modelMatrixCalculated = false;
        
        this._wasRendered = false;
}

/**
 * Adds a subnode to the rendering tree.
 * @param {VisualObject} subnode The subnode to be added to the rendering tree. 
 * It will be rendered relative to this object (transformation matrices stack)
 */
VisualObject.prototype.addSubnode = function(subnode) {
    this.subnodes.push(subnode);
    subnode.renderParent = this;
};

/**
 * Removes all subnodes from the subtree of this object that are deleted or
 * are marked for deletion.
 */
VisualObject.prototype.cascadeCleanUp = function() {
    for(var i=0;i<this.subnodes.length;i++) {
        this.subnodes[i].cascadeCleanUp();
        while ((i<this.subnodes.length)&&((this.subnodes[i]===undefined)||(this.subnodes[i].toBeDeleted))) {
            delete this.subnodes[i];
            this.subnodes.splice(i,1);
	}
    }
};

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
			this.shader.uniforms[i].setValue(gl,this.shader.id,this.uniformValueFunctions[this.shader.uniforms[i].name]);
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
 * A method to check if the visual object needs to be rendered according to this
 * LOD parameters and depth mask phase (a model at a certain LOD might or might 
 * not contain transparent triangles) Needs to be implemented in the descendant
 * classes.
 * @param {Number} screenWidth
 * @param {Number} screenHeight
 * @param {LODContext} lodContext
 * @param {Boolean} depthMask
 * @returns {Boolean}
 */
VisualObject.prototype.needsToBeRendered = function(screenWidth,screenHeight,lodContext,depthMask) {
    return true;
};

/**
 * Renders the object and all its subnodes.
 * @param {ResourceCenter} resourceCenter The resource center that holds the
 * necessary rendering resources .
 * @param {Scene} scene The scene within which the object is located.
 * @param {number} screenWidth The size of the rendering viewport in pixels,
 * to determine the actual drawn size of the object (for dynamic LOD)
 * * @param {number} screenHeight The size of the rendering viewport in pixels,
 * to determine the actual drawn size of the object (for dynamic LOD)
 * @param {boolean} depthMaskPhase Whether we are drawing in the depthmask
 * enabled or disabled phase (renders only phase matches with the type of the
 * shader the object has)
 * */ 
VisualObject.prototype.cascadeRender = function(resourceCenter,scene,screenWidth,screenHeight,depthMaskPhase) {
    this._wasRendered = false;
    // the visible property determines visibility of all subnodes as well
    if(this.visible) {
        // subnodes (children) are only rendered if the parent's visible size
        // reaches a set limit
        if ((this.renderParent===null) || (this.smallestParentSizeWhenDrawn===undefined) ||
                (Math.max(this.renderParent.visibleWidth*screenWidth,this.renderParent.visibleHeight*screenHeight)>=this.smallestParentSizeWhenDrawn)) {
            // checking if the object is rendered in this phase (depth mask on/
            // off) and it is inside the view frustum
            if(((this.renderedWithDepthMask===true)&&(depthMaskPhase===true))||
                    ((this.renderedWithoutDepthMask===true)&&(depthMaskPhase===false))) {
                // the frustum check only needs to be calculated if this is the
                // first pass (depth mask on), or the object wasn't rendered
                // in the first pass
                if ((
                        ((this.renderedWithDepthMask===false)||(depthMaskPhase===true))
                        &&(this.isInsideViewFrustum(scene.activeCamera))
                    )||(this.lastInsideFrustumState===true)) {
                    if(this.needsToBeRendered(screenWidth,screenHeight,scene.lodContext,depthMaskPhase)) {
                        resourceCenter.setCurrentShader(this.shader,scene);
                        this.assignUniforms(resourceCenter.gl);
                        this.render(resourceCenter,depthMaskPhase);
                        this._wasRendered = true;
                    }
                }
            }
            // recursive rendering of all subnodes
            for(var i=0;i<this.subnodes.length;i++) {
                this.subnodes[i].cascadeRender(resourceCenter,scene,screenWidth,screenHeight,depthMaskPhase);
            }
        }
    }
};

/**
 * Sets the modelMatrixCalculated property of this object and its whole subtree
 * to false.
 */
VisualObject.prototype.cascadeResetModelMatrixCalculated = function() {
    var i;
    this.modelMatrixCalculated=false;
    for(var i=0;i<this.subnodes.length;i++) {
        this.subnodes[i].cascadeResetModelMatrixCalculated();
    }    
};

VisualObject.prototype.getNumberOfDrawnTriangles = function() {
    return 0;
};

VisualObject.prototype.cascadeGetNumberOfDrawnTriangles = function() {
    var result = 0;
    if(this._wasRendered) {
        result+=this.getNumberOfDrawnTriangles();
    }
    for(var i=0;i<this.subnodes.length;i++) {
        result+=this.subnodes[i].cascadeGetNumberOfDrawnTriangles();
    }    
    return result;
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
	VisualObject.call(this,shader,0,false,true);
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
 */
FVQ.prototype.render = function(resourceCenter) {
	resourceCenter.bindTexture(this.cubemap,0);
	
	this.model.render(resourceCenter.gl,false);
};

FVQ.prototype.getNumberOfDrawnTriangles = function() {
    return 2;
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
 * @param {Object} textures The textures that should be bound while rendering this object in an associative array, with the roles as keys.
 * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
 * @param {Float32Array} orientationMatrix The 4x4 rotation matrix representing the initial orientation of the object.
 * @param {Float32Array} scalingMatrix The 4x4 scaling matrix representing the initial size of the object.
 * @param {boolean} lineMode Whether the mesh should be drawn as wireframe instead of solid.
 */
function Mesh(modelsWithLOD,shader,textures,positionMatrix,orientationMatrix,scalingMatrix,lineMode) {
        VisualObject.call(this,shader,10,true,true);
	this.modelsWithLOD=modelsWithLOD;
	this.textures=textures;
	this.positionMatrix=positionMatrix;
	this.orientationMatrix=orientationMatrix;
	this.scalingMatrix=scalingMatrix;
	this.lineMode=lineMode;
        
        this.model=null;
	
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
	for(var textureType in textures) {
            if(textureType==="color") {
                this.uniformValueFunctions["u_colorTexture"] = function() { return 0; };
            } else
            if(textureType==="specular") {
                this.uniformValueFunctions["u_specularTexture"] = function() { return 1; };
            } else
            if(textureType==="luminosity") {
                this.uniformValueFunctions["u_luminosityTexture"] = function() { return 2; };
            }
        }
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
 * A method to check if the mesh needs to be rendered according to these
 * LOD parameters and depth mask phase (a model at a certain LOD might or might 
 * not contain transparent triangles) Also sets the model property to the model
 * with the calculated LOD.
 * @param {Number} screenWidth
 * @param {Number} screenHeight
 * @param {LODContext} lodContext
 * @param {Boolean} depthMask
 * @returns {Boolean}
 */
Mesh.prototype.needsToBeRendered = function(screenWidth,screenHeight,lodContext,depthMask) {
    // choose the model of appropriate LOD
    var visibleSize = Math.max(this.visibleWidth*screenWidth,this.visibleHeight*screenHeight);
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
                    closestLOD=this.modelsWithLOD[i].lod;
                    this.model=this.modelsWithLOD[i].model;
            }
    }
    
    if (this.lineMode===true) {
            return true;
    } else {
            if(depthMask===true) {
                if(this.model.nOpaqueTriangles>0) {
                    return true;
                }
            } else if ((depthMask===false)&&(this.model.nTransparentTriangles>0)) {
                return true;
            }
    }
    return false;
};

/**
 * Renders the appropriate model of the mesh.
 * @param {ResourceCenter} resourceCenter The resource center that holds the
 * texture, the models and the shader.
 * @param {boolean} depthMask Tells whether the depth mask is turned on during this render pass.
 */
Mesh.prototype.render = function(resourceCenter,depthMask) {
    var i=0;
    for(var textureType in this.textures) {        
        resourceCenter.bindTexture(this.textures[textureType],i);
        i++;
    }
    if (this.lineMode===true) {
            resourceCenter.gl.drawArrays(resourceCenter.gl.LINES, this.model.bufferStartLines, 2*this.model.lines.length);
    } else {
            if(depthMask===true) {
                resourceCenter.gl.drawArrays(resourceCenter.gl.TRIANGLES, this.model.bufferStart, 3*this.model.nOpaqueTriangles);
            } else {
                resourceCenter.gl.drawArrays(resourceCenter.gl.TRIANGLES, this.model.bufferStartTransparent, 3*this.model.nTransparentTriangles);
            }
    }
};

Mesh.prototype.getNumberOfDrawnTriangles = function() {
    return this.model.triangles.length;
};

function ShipMesh(modelsWithLOD,shader,textures,positionMatrix,orientationMatrix,scalingMatrix,lineMode) {
    Mesh.call(this,modelsWithLOD,shader,textures,positionMatrix,orientationMatrix,scalingMatrix,lineMode);

    this.luminosityFactors = new Float32Array(20);
    for(var i=0;i<this.luminosityFactors.length;i++) {
        this.luminosityFactors[i]=0.0;
    }
    
    var self = this;
    
    this.uniformValueFunctions["u_luminosityFactors"] = function() { return self.luminosityFactors; };
}

ShipMesh.prototype = new Mesh([]);
ShipMesh.prototype.constructor = ShipMesh;


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
	VisualObject.call(this,shader,0,false,true);
	this.model=model;
	this.texture=texture;
	this.positionMatrix=positionMatrix;
	this.orientationMatrix=orientationMatrix;
	this.scalingMatrix=scalingMatrix(size,size,size);
	
	var self = this;
	
	this.uniformValueFunctions["u_modelMatrix"] = function() { return mul(mul(self.scalingMatrix,self.orientationMatrix),self.positionMatrix); };
        this.uniformValueFunctions["u_colorTexture"] = function() { return 0; };
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
 */
Billboard.prototype.render = function(resourceCenter) {
	resourceCenter.bindTexture(this.texture,0);
	
	this.model.render(resourceCenter.gl,false);
};

Billboard.prototype.getNumberOfDrawnTriangles = function() {
    return 2;
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
	VisualObject.call(this,shader,smallestParentSizeWhenDrawn,false,true);
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
        this.uniformValueFunctions["u_colorTexture"] = function() { return 0; };
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
 */
DynamicParticle.prototype.render = function(resourceCenter) {
	resourceCenter.bindTexture(this.texture,0);
	if(new Date().getTime()>=this.creationTime+this.duration) {
		this.toBeDeleted=true;
	} else {
		this.model.render(resourceCenter.gl,false);
	}
};

DynamicParticle.prototype.getNumberOfDrawnTriangles = function() {
    return 2;
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
        this.uniformValueFunctions["u_colorTexture"] = function() { return 0; };
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
 */
StaticParticle.prototype.render = function(resourceCenter) {
    resourceCenter.bindTexture(this.texture, 0);
    if (this._relSize > 0) {
        this.model.render(resourceCenter.gl, false);
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
function PointParticle(model,shader,color,positionMatrix) {
	VisualObject.call(this,shader,0,false,true);
	this.color=color;
	this.positionMatrix=positionMatrix;
        this.shift=[0.0,0.0,0.0];
        
        this.model = model;
	
	var self = this;
	
	this.uniformValueFunctions["u_modelMatrix"] =   function() { return mul(self.positionMatrix,self.getParentModelMatrix()); };
        this.uniformValueFunctions["u_color"] =   function() { return self.color; };
        this.uniformValueFunctions["u_shift"] =   function() { return self.shift; };
}

PointParticle.prototype = new VisualObject();
PointParticle.prototype.constructor = PointParticle;

/**
 * Always returns true as is it faster to skip the check because anyway we are
 * only rendering one line here.
 * @param {Camera} camera Irrelevant in this case.
 * @returns {boolean} Always true.
 */
PointParticle.prototype.isInsideViewFrustum = function(camera) {
	return true;
};

/**
 * Renders the particle.
 * @param {ResourceCenter} resourceCenter The resource center that holds the
 * the model and the shader.
 */
PointParticle.prototype.render = function(resourceCenter) {
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

function LightSource(color,direction) {
    this.color = color;
    this.direction = direction;
}

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
	
        this._backgroundObjects = new Array();
        this.objects = new Array();
        this.cameras = new Array();
        this.lights = new Array();
        
	this.activeCamera = new SceneCamera(width/height,60,1000);
		
        this.lodContext = lodContext;
        
	this.uniformValueFunctions = new Object();
        
        this.firstRender=true;
        this._drawnTriangles = 0;
        
        var self = this;
        // setting uniform valuables that are universal to all scene graph 
        // objects, so any shader used in the scene will be able to get their
        // values
        this.uniformValueFunctions['u_numLights'] = function() { return self.lights.length; };
        this.uniformValueFunctions['u_lights'] = function() { return self.lights; };
   
        this.uniformValueFunctions['u_cameraMatrix'] = function() { return mul(self.activeCamera.positionMatrix,self.activeCamera.orientationMatrix); };
        this.uniformValueFunctions['u_cameraOrientationMatrix'] = function() { return self.activeCamera.orientationMatrix; };
        this.uniformValueFunctions['u_projMatrix'] = function() { return self.activeCamera.perspectiveMatrix; };
        this.uniformValueFunctions['u_eyePos'] = function() 
            {
                    var eyePos = [
                            -self.activeCamera.positionMatrix[12],
                            -self.activeCamera.positionMatrix[13],
                            -self.activeCamera.positionMatrix[14]
                            ];
                    return [eyePos[0],eyePos[1],eyePos[2]]; 
            };
}

/**
 * Appends a new visual object to the list of background objects.
 * @param {VisualObject} newVisualObject The object to append.
 */
Scene.prototype.addBackgroundObject = function(newVisualObject) {
    this._backgroundObjects.push(newVisualObject);
};

/**
 * Appends a new visual object to the topmost level of the scene graph.
 * @param {VisualObject} newVisualObject The object to append.
 */
Scene.prototype.addObject = function(newVisualObject) {
    this.objects.push(newVisualObject);
};

Scene.prototype.addLightSource = function(newLightSource) {
    this.lights.push(newLightSource);
};

Scene.prototype.getLODContext = function() {
    return this.lodContext;
};

Scene.prototype.getNumberOfDrawnTriangles = function() {
    return this._drawnTriangles;
};

/**
 * Recalculates the perspective matrices of cameras in case the viewport size
 * (and as a result, aspect) has changed.
 */
Scene.prototype.resizeViewport = function() {
    var i;
    //this.width=newWidth;
    //this.height=newHeight;
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
			shader.uniforms[i].setValue(gl,shader.id,this.uniformValueFunctions[shader.uniforms[i].name]);
		}
	}
};

/**
 * Cleans up the whole scene graph, removing all object that are deleted or are
 * marked for deletion.
 */
Scene.prototype.cleanUp = function() {
    for(var i=0;i<this.objects.length;i++) {
        this.objects[i].cascadeCleanUp();
        while ((i<this.objects.length)&&((this.objects[i]===undefined)||(this.objects[i].toBeDeleted))) {
            delete this.objects[i];
            this.objects.splice(i,1);
	}
    }
};

/**
 * Renders the whole scene applying the general configuration and then rendering
 * all visual objects in the graph.
 * @param {ResourceCenter} resourceCenter The resource center that holds the
 * shaders, textures, models of the scene.
 */
Scene.prototype.render = function(resourceCenter) {
        this._drawnTriangles = 0;
        
	var gl = resourceCenter.gl;
	
	gl.viewport(this.left, this.top, this.width, this.height);
	gl.scissor(this.left, this.top, this.width, this.height);
	
	if (this.clearColorOnRender) {
		gl.colorMask(this.colorMask[0], this.colorMask[1], this.colorMask[2], this.colorMask[3]);
		gl.clearColor(this.clearColor[0],this.clearColor[1],this.clearColor[2],this.clearColor[3]);
	}

	this.firstRender=false;
	
        // glClear is affected by the depth mask, so we need to turn it on here!
        // (it's disabled for the second (transparent) render pass)
        gl.depthMask(true);
        // clearing color and depth buffers as set for this scene
	var clear = this.clearColorOnRender?gl.COLOR_BUFFER_BIT:0;
	clear=this.clearDepthOnRender?clear|gl.DEPTH_BUFFER_BIT:clear;
	gl.clear(clear);
        
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(false);
        
        for(var i=0;i<this._backgroundObjects.length;i++) {
                this._backgroundObjects[i].cascadeResetModelMatrixCalculated();
		this._backgroundObjects[i].cascadeRender(resourceCenter,this,this.width,this.height,false);
                this._drawnTriangles+=this._backgroundObjects[i].cascadeGetNumberOfDrawnTriangles();
	}
        
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
	
        // ensuring that transformation matrices are only calculated once for 
        // each object in each render
	for(var i=0;i<this.objects.length;i++) {
		this.objects[i].cascadeResetModelMatrixCalculated();
	}
                
        // first rendering pass: rendering the non-transparent triangles with 
        // Z buffer writing turned on
        gl.disable(gl.BLEND);
	for(var i=0;i<this.objects.length;i++) {
		this.objects[i].cascadeRender(resourceCenter,this,this.width,this.height,true);
                this._drawnTriangles+=this.objects[i].cascadeGetNumberOfDrawnTriangles();
	}
        // second rendering pass: rendering the transparent triangles with 
        // Z buffer writing turned off
	gl.depthMask(false);
        gl.enable(gl.BLEND);
	for(var i=0;i<this.objects.length;i++) {
		this.objects[i].cascadeRender(resourceCenter,this,this.width,this.height,false);
                this._drawnTriangles+=this.objects[i].cascadeGetNumberOfDrawnTriangles();
	}
};