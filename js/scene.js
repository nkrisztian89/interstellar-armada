"use strict";

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

Application.createModule({name: "Scene",
    dependencies: [
        {script: "matrices.js"},
        {module: "GL", from: "gl.js"}]}, function () {
    // create a reference to the used modules in the local scope for cleaner and
    // faster access
    var GL = Application.GL;
    /**
     * Creates a new VisualObject.
     * @class The parent class of all objects to be rendered in the scene graph such
     * as full viewport quads, shaded meshes, billboards or particle systems. Serves
     * as a node, contains references to its parent and subnodes as well.
     * @param {Shader} shader The shader that should be active while rendering this object
     * @param {Boolean} renderedWithDepthMask Tells whether this object should be rendered when the depth mask is on (= it contains non-transparent triangles)
     * @param {Boolean} renderedWithoutDepthMask Tells whether this object should be rendered when the depth mask is off (= it contains transparent triangles)
     * @param {Number} smallestParentSizeWhenDrawn If the rendering parent's apparent size is smaller than this value, render will not take place.
     */
    function VisualObject(shader, renderedWithDepthMask, renderedWithoutDepthMask, smallestParentSizeWhenDrawn) {
        this.shader = shader;
        this.uniformValueFunctions = new Array();

        this.toBeDeleted = false;

        this.renderParent = null;
        this.subnodes = new Array();

        this.visible = true;

        this.visibleWidth = 0;
        this.visibleHeight = 0;

        this.lastInsideFrustumState = false;

        this.insideParent = undefined;
        this.smallestParentSizeWhenDrawn = smallestParentSizeWhenDrawn;

        this.renderedWithDepthMask = renderedWithDepthMask;
        this.renderedWithoutDepthMask = renderedWithoutDepthMask;

        this.modelMatrixCalculated = false;

        this._wasRendered = false;

        /**
         * @name VisualObject#_firstView
         * @type Camera
         */
        this._firstView = null;
    }

    VisualObject.prototype.setUniformValueFunction = function (uniformName, valueFunction) {
        this.uniformValueFunctions[uniformName] = valueFunction;
    };

    VisualObject.prototype.show = function () {
        this.visible = true;
    };

    VisualObject.prototype.hide = function () {
        this.visible = false;
    };

    VisualObject.prototype.toggleVisibility = function () {
        this.visible = !this.visible;
    };

    VisualObject.prototype.getFirstView = function () {
        return this._firstView;
    };

    VisualObject.prototype.setFirstView = function (firstView) {
        this._firstView = firstView;
    };

    VisualObject.prototype.resetViews = function () {
        for (
                var view = this._firstView;
                view !== null;
                view = ((view.nextView === this._firstView) ? null : view.nextView)) {
            view.reset();
        }
    };

    VisualObject.prototype.addToContext = function (context) {
        this.shader.addToContext(context);
    };

    VisualObject.prototype.cascadeAddToContext = function (context) {
        this.addToContext(context);
        var i;
        for (var i = 0; i < this.subnodes.length; i++) {
            this.subnodes[i].cascadeAddToContext(context);
        }
    };

    VisualObject.prototype.setShader = function (shader) {
        this.shader = shader;
    };

    VisualObject.prototype.cascadeSetShader = function (shader) {
        this.setShader(shader);
        var i;
        for (var i = 0; i < this.subnodes.length; i++) {
            this.subnodes[i].setShader(shader);
        }
    };

    /**
     * Adds a subnode to the rendering tree.
     * @param {VisualObject} subnode The subnode to be added to the rendering tree. 
     * It will be rendered relative to this object (transformation matrices stack)
     */
    VisualObject.prototype.addSubnode = function (subnode) {
        this.subnodes.push(subnode);
        subnode.renderParent = this;
    };

    /**
     * Removes all subnodes from the subtree of this object that are deleted or
     * are marked for deletion.
     */
    VisualObject.prototype.cascadeCleanUp = function () {
        for (var i = 0; i < this.subnodes.length; i++) {
            this.subnodes[i].cascadeCleanUp();
            while ((i < this.subnodes.length) && ((this.subnodes[i] === undefined) || (this.subnodes[i].toBeDeleted))) {
                this.subnodes[i] = null;
                this.subnodes.splice(i, 1);
            }
        }
    };

    /**
     * Returns the translation matrix describing the position of the 
     * visual object. Actual calculations have to be implemented in children 
     * classes, this one always returns an identity matrix.
     * @returns {Float32Array} A 4x4 identity matrix.
     */
    VisualObject.prototype.getPositionMatrix = function () {
        return Mat.identity4();
    };

    /**
     * Returns the rotation matrix describing the orientation of the 
     * visual object. Actual calculations have to be implemented in children 
     * classes, this one always returns an identity matrix.
     * * @returns {Float32Array} A 4x4 identity matrix.
     */
    VisualObject.prototype.getOrientationMatrix = function () {
        return Mat.identity4();
    };

    /**
     * Returns the scaling matrix describing the size of the 
     * visual object. Actual calculations have to be implemented in children 
     * classes, this one always returns an identity matrix.
     * * @returns {Float32Array} A 4x4 identity matrix.
     */
    VisualObject.prototype.getScalingMatrix = function () {
        return Mat.identity4();
    };

    /**
     * Returns the numerical size of the visual object.
     * Actual calculations have to be implemented in children 
     * classes, this one always returns 1.
     * @returns {number} Always 1.
     */
    VisualObject.prototype.getSize = function () {
        return 1;
    };

    /**
     * Returns the model transformation matrix of the visual object. 
     * Actual calculations have to be implemented in children classes to include
     * translation, rotation, scaling as well as cascading operations based on
     * relative positioning.
     * * @returns {Float32Array} A 4x4 identity matrix.
     */
    VisualObject.prototype.getModelMatrix = function () {
        return Mat.identity4();
    };

    /**
     * Returns the vector that represents the position of the visual
     * object in the scene, taking into account the transformations of its parent
     * classes.
     * * @returns {number[]} A 3 element float vector indicating the position.
     */
    VisualObject.prototype.getCascadePositionVector = function () {
        if (this.renderParent !== null) {
            return Vec.add3(
                    this.renderParent.getCascadePositionVector(),
                    Vec.mulVec3Mat4(
                            Mat.translationVector3(
                                    this.getPositionMatrix()
                                    ),
                            Mat.mul4(
                                    this.renderParent.getScalingMatrix(),
                                    this.renderParent.getOrientationMatrix()
                                    )
                            )
                    );
        } else {
            return Mat.translationVector3(this.getPositionMatrix());
        }
    };

    /**
     * Returns the scaling matrix that represents the size of the
     * visual object in the scene, taking into account the scaling of its parent
     * classes.
     * * @returns {Float32Array} A 4x4 scaling matrix indicating the size.
     */
    VisualObject.prototype.getCascadeScalingMatrix = function () {
        if (this.renderParent !== null) {
            return Mat.mul4(this.renderParent.getCascadeScalingMatrix(), this.getScalingMatrix());
        } else {
            return this.getScalingMatrix();
        }
    };

    VisualObject.prototype.getScaledSize = function () {
        return this.getSize() * this.getCascadeScalingMatrix()[0];
    };

    /**
     * * @returns {Float32Array} A 4x4 transformation matrix.
     */
    VisualObject.prototype.getCascadeModelMatrix = function () {
        if (this.renderParent !== null) {
            return Mat.mul4(this.getModelMatrix(), this.renderParent.getCascadeModelMatrix());
        } else {
            return this.getModelMatrix();
        }
    };

    /**
     * Assigns all uniforms in the shader program associated with this object that
     * this object has a value function for, using the appropriate webGL calls.
     * The matching is done based on the names of the uniforms.
     * @param {ManagedGLContext} context The webGL context to use
     */
    VisualObject.prototype.assignUniforms = function (context) {
        this.shader.assignUniforms(context, this.uniformValueFunctions);
    };

    /**
     * Checks if the object is inside the viewing frustum of the passed camera,
     * taking into account the parents of the object as well. Also sets the view
     * width and height members of the object.
     * @param {Camera} camera The camera the frustum of which is to be checked
     * @returns {boolean} Whether the object is inside the frustum.
     */
    VisualObject.prototype.isInsideViewFrustum = function (camera) {
        if (this.renderParent !== null) {
            if (this.insideParent === undefined) {
                this.insideParent = (Math.abs(this.getPositionMatrix()[12]) < this.renderParent.getSize()) &&
                        (Math.abs(this.getPositionMatrix()[13]) < this.renderParent.getSize()) &&
                        (Math.abs(this.getPositionMatrix()[14]) < this.renderParent.getSize());
            }
            if (this.insideParent === true) {
                if (this.renderParent.lastInsideFrustumState === false) {
                    this.visibleWidth = 0;
                    this.visibleHeight = 0;
                    this.lastInsideFrustumState = false;
                    return this.lastInsideFrustumState;
                } else {
                    this.visibleWidth = this.renderParent.visibleWidth;
                    this.visibleHeight = this.renderParent.visibleHeight;
                    this.lastInsideFrustumState = true;
                    return this.lastInsideFrustumState;
                }
            }
        }
        // scaling and orientation is lost here, since we create a new translation
        // matrix based on the original transformation
        var baseMatrix =
                Mat.translation4v(Mat.translationVector4(
                        Mat.mul4(
                                this.getCascadeModelMatrix(),
                                camera.getCameraMatrix()
                                )
                        ));
        // we reintroduce appropriate scaling, but not the orientation, so 
        // we can check border points of the properly scaled model, but translated
        // along the axes of the camera space
        var fullMatrix =
                Mat.mul4(
                        Mat.mul4(this.getCascadeScalingMatrix(), baseMatrix),
                        camera.getPerspectiveMatrix()
                        );

        var position = Vec.mulVec4Mat4([0.0, 0.0, 0.0, 1.0], fullMatrix);
        position[0] = (position[0] === 0.0) ? 0.0 : position[0] / position[3];
        position[1] = (position[1] === 0.0) ? 0.0 : position[1] / position[3];
        position[2] = (position[2] === 0.0) ? 0.0 : position[2] / position[3];
        var zOffsetPosition = Vec.mulVec4Mat4([0.0, 0.0, -this.getSize(), 1.0], fullMatrix);
        var zOffset = (zOffsetPosition[2] === 0.0) ? 0.0 : (zOffsetPosition[2] / zOffsetPosition[3]);

        // frustum culling: back and front
        if (((zOffset > -1.0) && (zOffset < 1.0)) || ((position[2] > -1.0) && (position[2] < 1.0))) {
            // frustum culling: sides
            var xOffsetPosition = Vec.mulVec4Mat4([this.getSize(), 0.0, 0.0, 1.0], fullMatrix);
            var yOffsetPosition = Vec.mulVec4Mat4([0.0, this.getSize(), 0.0, 1.0], fullMatrix);
            var xOffset = Math.abs(((xOffsetPosition[0] === 0.0) ? 0.0 : xOffsetPosition[0] / xOffsetPosition[3]) - position[0]);
            var yOffset = Math.abs(((yOffsetPosition[1] === 0.0) ? 0.0 : yOffsetPosition[1] / yOffsetPosition[3]) - position[1]);
            if (
                    !(((position[0] + xOffset < -1) && (position[0] - xOffset < -1)) || ((position[0] + xOffset > 1) && (position[0] - xOffset > 1))) &&
                    !(((position[1] + yOffset < -1) && (position[1] - yOffset < -1)) || ((position[1] + yOffset > 1) && (position[1] - yOffset > 1)))
                    ) {
                this.visibleWidth = xOffset;
                this.visibleHeight = yOffset;
                this.lastInsideFrustumState = true;
            } else {
                this.visibleWidth = 0;
                this.visibleHeight = 0;
                this.lastInsideFrustumState = false;
            }
        } else {
            this.visibleWidth = 0;
            this.visibleHeight = 0;
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
    VisualObject.prototype.needsToBeRendered = function (screenWidth, screenHeight, lodContext, depthMask) {
        return true;
    };

    VisualObject.prototype.render = function () {
    };

    VisualObject.prototype.renderShadowMap = function () {
    };

    /**
     * Renders the object and all its subnodes.
     * @param {ManagedGLContext} managedGLContext
     * @param {Scene} scene The scene within which the object is located.
     * @param {number} screenWidth The size of the rendering viewport in pixels,
     * to determine the actual drawn size of the object (for dynamic LOD)
     * * @param {number} screenHeight The size of the rendering viewport in pixels,
     * to determine the actual drawn size of the object (for dynamic LOD)
     * @param {boolean} depthMaskPhase Whether we are drawing in the depthmask
     * enabled or disabled phase (renders only phase matches with the type of the
     * shader the object has)
     * */
    VisualObject.prototype.cascadeRender = function (managedGLContext, scene, screenWidth, screenHeight, depthMaskPhase) {
        this._wasRendered = false;
        // the visible property determines visibility of all subnodes as well
        if (this.visible) {
            // subnodes (children) are only rendered if the parent's visible size
            // reaches a set limit
            if ((this.renderParent === null) || (this.smallestParentSizeWhenDrawn === undefined) ||
                    (Math.max(this.renderParent.visibleWidth * screenWidth / 2, this.renderParent.visibleHeight * screenHeight / 2) >= this.smallestParentSizeWhenDrawn)) {
                // checking if the object is rendered in this phase (depth mask on/
                // off) and it is inside the view frustum
                if (((this.renderedWithDepthMask === true) && (depthMaskPhase === true)) ||
                        ((this.renderedWithoutDepthMask === true) && (depthMaskPhase === false))) {
                    // the frustum check only needs to be calculated if this is the
                    // first pass (depth mask on), or the object wasn't rendered
                    // in the first pass
                    if ((
                            ((this.renderedWithDepthMask === false) || (depthMaskPhase === true))
                            && (this.isInsideViewFrustum(scene.activeCamera))
                            ) || (this.lastInsideFrustumState === true)) {
                        if (this.needsToBeRendered(screenWidth, screenHeight, scene.lodContext, depthMaskPhase)) {
                            managedGLContext.setCurrentShader(this.shader, scene);
                            this.assignUniforms(managedGLContext);
                            this.render(managedGLContext, depthMaskPhase);
                            this._wasRendered = true;
                        }
                    }
                }
                // recursive rendering of all subnodes
                for (var i = 0; i < this.subnodes.length; i++) {
                    this.subnodes[i].cascadeRender(managedGLContext, scene, screenWidth, screenHeight, depthMaskPhase);
                }
            }
        }
    };

    VisualObject.prototype.cascadeRenderShadowMap = function (managedGLContext, scene, screenWidth, screenHeight) {
        // the visible property determines visibility of all subnodes as well
        if (this.visible) {
            this.renderShadowMap(managedGLContext, scene, screenWidth, screenHeight);
            // recursive rendering of all subnodes
            for (var i = 0; i < this.subnodes.length; i++) {
                this.subnodes[i].cascadeRenderShadowMap(managedGLContext, scene, screenWidth, screenHeight);
            }
        }
    };

    /**
     * Sets the modelMatrixCalculated property of this object and its whole subtree
     * to false.
     */
    VisualObject.prototype.cascadeResetModelMatrixCalculated = function () {
        var i;
        this.modelMatrixCalculated = false;
        for (var i = 0; i < this.subnodes.length; i++) {
            this.subnodes[i].cascadeResetModelMatrixCalculated();
        }
    };

    VisualObject.prototype.getNumberOfDrawnTriangles = function () {
        return 0;
    };

    VisualObject.prototype.cascadeGetNumberOfDrawnTriangles = function () {
        var result = 0;
        if (this._wasRendered) {
            result += this.getNumberOfDrawnTriangles();
        }
        for (var i = 0; i < this.subnodes.length; i++) {
            result += this.subnodes[i].cascadeGetNumberOfDrawnTriangles();
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
    function FVQ(model, shader, samplerName, cubemap, camera) {
        VisualObject.call(this, shader, false, true);
        this.model = model;
        this.samplerName = samplerName;
        this.cubemap = cubemap;
        this.camera = camera;

        var self = this;

        this.uniformValueFunctions[this.samplerName] = function () {
            return self.cubemap.id;
        };
        this.uniformValueFunctions["u_viewDirectionProjectionInverse"] = function () {
            return Mat.inverse4(Mat.mul4(self.camera.getOrientationMatrix(), self.camera.getPerspectiveMatrix()));
        };
    }

    FVQ.prototype = new VisualObject();
    FVQ.prototype.constructor = FVQ;

    FVQ.prototype.addToContext = function (context) {
        VisualObject.prototype.addToContext.call(this, context);
        this.model.addToContext(context, false);
        this.cubemap.addToContext(context);
    };

    /**
     * Always returns true as the FVQ always has to be rendered.
     * @param {Camera} camera Irrelevant in this case, FVQ is visible in all directions.
     * @returns {boolean} Always true.
     */
    FVQ.prototype.isInsideViewFrustum = function (camera) {
        return true;
    };

    /**
     * Renders the FVQ, binding the cube mapped texture.
     * @param {ManagedGLContext} context
     */
    FVQ.prototype.render = function (context) {
        context.bindTexture(this.cubemap, 0);

        this.model.render(context, false);
    };

    FVQ.prototype.getNumberOfDrawnTriangles = function () {
        return 2;
    };

    /**
     * Creates a LOD associated 3D model object.
     * @class A 3D model paired up with Level Of Detail indicator.
     * @param {EgomModel} model The 3D model data.
     * @param {Number} lod The LOD level to be associated with the model.
     */
    function ModelWithLOD(model, lod) {
        this.model = model;
        this.lod = lod;
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
     * @param {Number} smallestParentSizeWhenDrawn
     */
    function Mesh(modelsWithLOD, shader, textures, positionMatrix, orientationMatrix, scalingMatrix, lineMode, smallestParentSizeWhenDrawn) {
        VisualObject.call(this, shader, true, true, smallestParentSizeWhenDrawn);
        this.modelsWithLOD = modelsWithLOD;
        this.textures = textures;
        this.positionMatrix = positionMatrix;
        this.orientationMatrix = orientationMatrix;
        this.scalingMatrix = scalingMatrix;
        this.lineMode = lineMode;
        /**
         * @name Mesh#model
         * @type Egom.Model
         */
        this.model = null;

        this.modelSize = 0;

        this.submeshes = new Array();

        this.modelMatrix = Mat.identity4();

        var self = this;

        this.uniformValueFunctions["u_modelMatrix"] = function () {
            return self.getCascadeModelMatrix();
        };
        this.uniformValueFunctions["u_normalMatrix"] = function () {
            return Mat.transposed3(Mat.inverse3(Mat.matrix3from4(self.getCascadeModelMatrix())));
        };
        for (var textureType in textures) {
            if (textureType === "color") {
                this.uniformValueFunctions["u_colorTexture"] = function () {
                    return 0;
                };
            } else
            if (textureType === "specular") {
                this.uniformValueFunctions["u_specularTexture"] = function () {
                    return 1;
                };
            } else
            if (textureType === "luminosity") {
                this.uniformValueFunctions["u_luminosityTexture"] = function () {
                    return 2;
                };
            }
        }
    }

    Mesh.prototype = new VisualObject();
    Mesh.prototype.constructor = Mesh;

    Mesh.prototype.addToContext = function (context) {
        VisualObject.prototype.addToContext.call(this, context);
        var i;
        for (i = 0; i < this.modelsWithLOD.length; i++) {
            this.modelsWithLOD[i].model.addToContext(context, this.lineMode);
            if (this.modelsWithLOD[i].model.getSize() > this.modelSize) {
                this.modelSize = this.modelsWithLOD[i].model.getSize();
            }
        }
        for (var role in this.textures) {
            this.textures[role].addToContext(context);
        }
    };

    /**
     * Returns the translation matrix describing the position of the mesh.
     * @returns {Float32Array} The 4x4 translation matrix indicating the position.
     */
    Mesh.prototype.getPositionMatrix = function () {
        return this.positionMatrix;
    };

    Mesh.prototype.setPositionMatrix = function (newValue) {
        this.positionMatrix = newValue;
        this.modelMatrixCalculated = false;
    };

    Mesh.prototype.translate = function (x, y, z) {
        this.setPositionMatrix(Mat.mul4(this.positionMatrix, Mat.translation4(x, y, z)));
    };

    /**
     * Returns the rotation matrix describing the orientation of the mesh.
     * @returns {Float32Array} The 4x4 rotation matrix indicating the orientation.
     */
    Mesh.prototype.getOrientationMatrix = function () {
        return this.orientationMatrix;
    };

    Mesh.prototype.getXDirectionVector = function () {
        return [
            this.orientationMatrix[0],
            this.orientationMatrix[1],
            this.orientationMatrix[2]
        ];
    };

    Mesh.prototype.getYDirectionVector = function () {
        return [
            this.orientationMatrix[4],
            this.orientationMatrix[5],
            this.orientationMatrix[6]
        ];
    };

    Mesh.prototype.getZDirectionVector = function () {
        return [
            this.orientationMatrix[8],
            this.orientationMatrix[9],
            this.orientationMatrix[10]
        ];
    };

    Mesh.prototype.setOrientationMatrix = function (newValue) {
        this.orientationMatrix = newValue;
        this.modelMatrixCalculated = false;
    };

    Mesh.prototype.rotate = function (axis, angle) {
        this.setOrientationMatrix(Mat.mul4(this.orientationMatrix, Mat.rotation4(axis, angle)));
    };

    /**
     * Returns the scaling matrix describing the size of the mesh.
     * @returns {Float32Array} The 4x4 scaling matrix indicating the size.
     */
    Mesh.prototype.getScalingMatrix = function () {
        return this.scalingMatrix;
    };

    Mesh.prototype.setScalingMatrix = function (newValue) {
        this.scalingMatrix = newValue;
        this.modelMatrixCalculated = false;
    };

    /**
     * Returns the size of the largest model of the mesh.
     * @returns {number} The size of the largest model of the mesh.
     */
    Mesh.prototype.getSize = function () {
        return this.modelSize;
    };

    /**
     * Returns the model transformation matrix of the mesh.
     * @returns {Float32Array} The 4x4 model transformation matrix of the object.
     */
    Mesh.prototype.getModelMatrix = function () {
        if (this.modelMatrixCalculated === false) {
            this.modelMatrix = Mat.mul4(Mat.mul4(this.scalingMatrix, this.orientationMatrix), this.positionMatrix);
            this.modelMatrixCalculated = true;
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
    Mesh.prototype.needsToBeRendered = function (screenWidth, screenHeight, lodContext, depthMask) {
        // choose the model of appropriate LOD
        var visibleSize = Math.max(this.visibleWidth * screenWidth / 2, this.visibleHeight * screenHeight / 2);
        var closestLOD = -1;
        for (var i = 0; i < this.modelsWithLOD.length; i++) {
            if (
                    (closestLOD === -1) ||
                    (this.modelsWithLOD[i].lod <= lodContext.maxEnabledLOD) &&
                    (
                            (closestLOD > lodContext.maxEnabledLOD) ||
                            ((lodContext.thresholds[closestLOD] > visibleSize) && (lodContext.thresholds[this.modelsWithLOD[i].lod] <= visibleSize)) ||
                            ((lodContext.thresholds[closestLOD] <= visibleSize) && (lodContext.thresholds[this.modelsWithLOD[i].lod] <= visibleSize) && (this.modelsWithLOD[i].lod > closestLOD)) ||
                            ((lodContext.thresholds[closestLOD] > visibleSize) && (lodContext.thresholds[this.modelsWithLOD[i].lod] > visibleSize) && (this.modelsWithLOD[i].lod < closestLOD))
                            )) {
                closestLOD = this.modelsWithLOD[i].lod;
                this.model = this.modelsWithLOD[i].model;
            }
        }

        if (this.lineMode === true) {
            return true;
        } else {
            if (depthMask === true) {
                if (this.model.getNumOpaqueTriangles() > 0) {
                    return true;
                }
            } else if ((depthMask === false) && (this.model.getNumTransparentTriangles() > 0)) {
                return true;
            }
        }
        return false;
    };

    /**
     * Renders the appropriate model of the mesh.
     * @param {ManagedGLContext} context
     * @param {boolean} depthMask Tells whether the depth mask is turned on during this render pass.
     */
    Mesh.prototype.render = function (context, depthMask) {
        var i = 0;
        for (var textureType in this.textures) {
            context.bindTexture(this.textures[textureType], i);
            i++;
        }
        this.model.render(context, this.lineMode, depthMask);
    };

    Mesh.prototype.renderShadowMap = function (context, scene, screenWidth, screenHeight) {
        if (this.isInsideViewFrustum(scene.activeCamera)
                && this.needsToBeRendered(screenWidth, screenHeight, scene.lodContext, true)) {
            context.getCurrentShader().assignUniforms(context, this.uniformValueFunctions);
            this.model.render(context, this.lineMode);
        }
    };

    Mesh.prototype.getNumberOfDrawnTriangles = function () {
        return this.model._triangles.length;
    };

    function ShipMesh(modelsWithLOD, shader, textures, positionMatrix, orientationMatrix, scalingMatrix, lineMode, smallestParentSizeWhenDrawn) {
        Mesh.call(this, modelsWithLOD, shader, textures, positionMatrix, orientationMatrix, scalingMatrix, lineMode, smallestParentSizeWhenDrawn);

        this.luminosityFactors = new Float32Array(20);
        for (var i = 0; i < this.luminosityFactors.length; i++) {
            this.luminosityFactors[i] = 0.0;
        }

        var self = this;

        this.uniformValueFunctions["u_luminosityFactors"] = function () {
            return self.luminosityFactors;
        };
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
    function Billboard(model, shader, texture, size, positionMatrix, orientationMatrix) {
        VisualObject.call(this, shader, false, true);
        this.model = model;
        this.texture = texture;
        this.positionMatrix = positionMatrix;
        this.orientationMatrix = orientationMatrix;
        this.scalingMatrix = Mat.scaling4(size);

        var self = this;

        this.uniformValueFunctions["u_modelMatrix"] = function () {
            return Mat.mul4(Mat.mul4(self.scalingMatrix, self.orientationMatrix), self.positionMatrix);
        };
        this.uniformValueFunctions["u_colorTexture"] = function () {
            return 0;
        };
    }

    Billboard.prototype = new VisualObject();
    Billboard.prototype.constructor = Billboard;

    Billboard.prototype.addToContext = function (context) {
        VisualObject.prototype.addToContext.call(this, context);
        this.model.addToContext(context, false);
        this.texture.addToContext(context);
    };

    /**
     * Always returns true as is it faster to skip the check because anyway we are
     * only rendering 2 triangles here.
     * @param {Camera} camera Irrelevant in this case.
     * @returns {boolean} Always true.
     */
    Billboard.prototype.isInsideViewFrustum = function (camera) {
        return true;
    };

    /**
     * Renders the billboard, binding the texture.
     * @param {Managed3DContext} context
     */
    Billboard.prototype.render = function (context) {
        context.bindTexture(this.texture, 0);

        this.model.render(context, false);
    };

    Billboard.prototype.getNumberOfDrawnTriangles = function () {
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
    function DynamicParticle(model, shader, texture, color, size, positionMatrix, duration, smallestParentSizeWhenDrawn) {
        VisualObject.call(this, shader, false, true, smallestParentSizeWhenDrawn);
        this.model = model;
        this.texture = texture;
        this.color = color;
        this.positionMatrix = positionMatrix;
        this.scalingMatrix = Mat.scaling4(size);

        this.creationTime = new Date().getTime();
        this.duration = duration;
        var self = this;

        this.uniformValueFunctions["u_modelMatrix"] = function () {
            return self.getCascadeModelMatrix();
        };
        this.uniformValueFunctions["u_billboardSize"] = function () {
            return self.scalingMatrix[0];
        };
        this.uniformValueFunctions["u_relAge"] = function () {
            return (new Date().getTime() - self.creationTime) / self.duration;
        };
        this.uniformValueFunctions["u_color"] = function () {
            return self.color;
        };
        this.uniformValueFunctions["u_colorTexture"] = function () {
            return 0;
        };
    }

    DynamicParticle.prototype = new VisualObject();
    DynamicParticle.prototype.constructor = DynamicParticle;

    DynamicParticle.prototype.getModelMatrix = function () {
        return Mat.mul4(this.scalingMatrix, this.positionMatrix);
    };

    DynamicParticle.prototype.addToContext = function (context) {
        VisualObject.prototype.addToContext.call(this, context);
        this.model.addToContext(context, false);
        this.texture.addToContext(context);
    };

    /**
     * Always returns true as is it faster to skip the check because anyway we are
     * only rendering 2 triangles here.
     * @param {Camera} camera Irrelevant in this case.
     * @returns {boolean} Always true.
     */
    DynamicParticle.prototype.isInsideViewFrustum = function (camera) {
        return (this.renderParent === null ? true : this.renderParent.lastInsideFrustumState);
    };

    /**
     * Renders the particle, binding the needed texture.
     * @param {Managed3DContext} context
     */
    DynamicParticle.prototype.render = function (context) {
        context.bindTexture(this.texture, 0);
        if (new Date().getTime() >= this.creationTime + this.duration) {
            this.toBeDeleted = true;
        } else {
            this.model.render(context, false);
        }
    };

    DynamicParticle.prototype.getNumberOfDrawnTriangles = function () {
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
    function StaticParticle(model, shader, texture, color, size, positionMatrix, smallestParentSizeWhenDrawn) {
        DynamicParticle.call(this, model, shader, texture, color, size, positionMatrix, 1000, smallestParentSizeWhenDrawn);
        this._relSize = 0;
        var self = this;
        this.uniformValueFunctions["u_relAge"] = function () {
            return 1.0 - self._relSize;
        };
        this.uniformValueFunctions["u_colorTexture"] = function () {
            return 0;
        };
    }

    StaticParticle.prototype = new DynamicParticle();
    StaticParticle.prototype.constructor = StaticParticle;

    /**
     * Getter function for the _relSize member.
     * @returns {number} The value of the relative size.
     */
    StaticParticle.prototype.getRelSize = function () {
        return this._relSize;
    };

    /**
     * Setter function for the _relSize member. Also updates the visibility.
     * @param {number} newValue The new value of the relative size.
     */
    StaticParticle.prototype.setRelSize = function (newValue) {
        this._relSize = newValue;
        this.visible = this._relSize >= 0.001;
    };

    /**
     * Renders the particle, binding the needed texture.
     * @param {Managed3DContext} context
     */
    StaticParticle.prototype.render = function (context) {
        context.bindTexture(this.texture, 0);
        if (this._relSize > 0) {
            this.model.render(context, false);
        }
    };

    /**
     * 
     * @param {Shader} shader
     * @param {Number[]} color The RGBA components of the color of the points.
     * @returns {PointCloud}
     */
    function PointCloud(shader, color) {
        VisualObject.call(this, shader, false, true);
        this.color = color;
        this.shift = [0.0, 0.0, 0.0];

        var self = this;

        this.uniformValueFunctions["u_color"] = function () {
            return self.color;
        };
        this.uniformValueFunctions["u_shift"] = function () {
            return self.shift;
        };
        this.uniformValueFunctions["u_length"] = function () {
            return Vec.length3(self.shift);
        };
        this.uniformValueFunctions["u_farthestZ"] = function () {
            return 25.0;
        };
    }

    PointCloud.prototype = new VisualObject();
    PointCloud.prototype.constructor = PointCloud;

    /**
     * We always need to render the dust cloud.
     * @returns {Boolean} Always true.
     */
    PointCloud.prototype.isInsideViewFrustum = function () {
        return true;
    };

    /**
     * Doesn't do anything, the cloud is rendered through rendering its particles.
     * This object only exists to set the uniforms common to all particles.
     */
    PointCloud.prototype.render = function () {
    };

    /**
     * Creates a dust particle type visual object.
     * @class Visual object that renders a point like object as a line as it is
     * moving. Used to represent dust particles that give a visual clue about the
     * motion of the camera.
     * @extends VisualObject
     * @param {Egom.Model} model A model of 2 vertices has to be passed (see lineModel()).
     * @param {Shader} shader The shader that should be active while rendering this object.
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     */
    function PointParticle(model, shader, positionMatrix) {
        VisualObject.call(this, shader, false, true);
        this.positionMatrix = positionMatrix;

        this.model = model;

        var self = this;

        this.uniformValueFunctions["u_modelMatrix"] = function () {
            return self.getCascadeModelMatrix();
        };
    }

    PointParticle.prototype = new VisualObject();
    PointParticle.prototype.constructor = PointParticle;

    PointParticle.prototype.addToContext = function (context) {
        VisualObject.prototype.addToContext.call(this, context);
        this.model.addToContext(context, false);
    };

    PointParticle.prototype.getModelMatrix = function () {
        return this.positionMatrix;
    };

    /**
     * Always returns true as is it faster to skip the check because anyway we are
     * only rendering one line here.
     * @param {Camera} camera Irrelevant in this case.
     * @returns {boolean} Always true.
     */
    PointParticle.prototype.isInsideViewFrustum = function (camera) {
        return true;
    };

    /**
     * Renders the particle.
     * @param {Managed3DContext} context
     */
    PointParticle.prototype.render = function (context) {
        this.model.render(context, true);
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
    function Camera(aspect, fov, controllablePosition, controllableDirection, followedObject, followPositionMatrix, followOrientationMatrix, rotationCenterIsObject) {
        this._positionMatrix = Mat.identity4();
        this._orientationMatrix = Mat.identity4();
        this._matrix = Mat.identity4();
        this.velocityVector = [0, 0, 0];
        this.maxSpeed = 5;
        this.acceleration = 0.1;
        this.angularVelocityVector = [0, 0, 0];
        this.maxTurn = 0.2;
        this.angularAcceleration = 0.005;
        this.angularDecceleration = 0.05;
        if (followedObject) {
            this.followObject(followedObject, followPositionMatrix, followOrientationMatrix, rotationCenterIsObject);
        }
        this._aspect = aspect;
        this._maxFOV = 160;
        this._minFOV = 5;
        this._fov = fov;
        this.controllablePosition = controllablePosition;
        this.controllableDirection = controllableDirection;
        this.updatePerspectiveMatrix();
        this.nextView = null;
    }

    Camera.prototype._updateMatrix = function () {
        this._matrix = Mat.mul4(this._positionMatrix, this._orientationMatrix);
    };

    Camera.prototype.getPositionMatrix = function () {
        return this._positionMatrix;
    };

    Camera.prototype.getPositionVector = function () {
        return [
            this._positionMatrix[12],
            this._positionMatrix[13],
            this._positionMatrix[14]
        ];
    };

    Camera.prototype.setPositionMatrix = function (matrix) {
        this._positionMatrix = matrix;
        this._updateMatrix();
    };

    Camera.prototype.translate = function (x, y, z) {
        this._positionMatrix = Mat.mul4(this._positionMatrix, Mat.translation4(x, y, z));
        this._updateMatrix();
    };

    Camera.prototype.translatev = function (v) {
        this._positionMatrix = Mat.mul4(this._positionMatrix, Mat.translation4v(v));
        this._updateMatrix();
    };

    Camera.prototype.translateByMatrix = function (matrix) {
        this._positionMatrix = Mat.mul4(this._positionMatrix, matrix);
        this._updateMatrix();
    };

    Camera.prototype.getOrientationMatrix = function () {
        return this._orientationMatrix;
    };

    Camera.prototype.setOrientationMatrix = function (matrix) {
        this._orientationMatrix = matrix;
        this._updateMatrix();
    };

    Camera.prototype.rotate = function (axis, angle) {
        this._orientationMatrix = Mat.mul4(this._orientationMatrix, Mat.rotation4(axis, angle));
        this._updateMatrix();
    };

    Camera.prototype.rotateByMatrix = function (matrix) {
        this._orientationMatrix = Mat.mul4(this._orientationMatrix, matrix);
        this._updateMatrix();
    };

    Camera.prototype.getCameraMatrix = function () {
        return this._matrix;
    };

    Camera.prototype.getPerspectiveMatrix = function () {
        return this._perspectiveMatrix;
    };

    /**
     * Sets the camera up to follow the given visual object.
     * @param {VisualObject} followedObject The object to which the camera position and direction has to be interpredet.
     * If undefined, the camera position is interpreted as absolute (relative to scene center)
     * @param {Float32Array} followPositionMatrix The translation matrix describing the relative position to the followed object.
     * @param {Float32Array} followOrientationMatrix The rotation matrix describing the relative orientation to the followed object. 
     * @param {boolean} rotationCenterIsObject Whether the rotation of the camera has to be executed around the followed model.
     */
    Camera.prototype.followObject = function (followedObject, followPositionMatrix, followOrientationMatrix, rotationCenterIsObject) {
        this.followedObject = followedObject;
        if (followPositionMatrix === undefined) {
            followPositionMatrix = Mat.identity4();
        }
        if (followOrientationMatrix === undefined) {
            followOrientationMatrix = Mat.identity4();
        }
        this.followPositionMatrix = followPositionMatrix;
        this.followOrientationMatrix = followOrientationMatrix;
        this.originalFollowPositionMatrix = followPositionMatrix;
        this.originalFollowOrientationMatrix = followOrientationMatrix;
        this.rotationCenterIsObject = rotationCenterIsObject;
        if (!followedObject.getFirstView()) {
            followedObject.setFirstView(this);
        }
    };

    /**
     * Resets the camera's relative position and orientation to their original values.
     */
    Camera.prototype.reset = function () {
        this.followPositionMatrix = this.originalFollowPositionMatrix;
        this.followOrientationMatrix = this.originalFollowOrientationMatrix;
    };

    Camera.prototype.updatePerspectiveMatrix = function () {
        this._perspectiveMatrix = Mat.perspective4(this._aspect / 20, 1.0 / 20, this._aspect / Math.tan(this._fov * 3.1415 / 360 / 2) / 2 / 20, 5000.0);
    };

    /**
     * Sets the camera's Field Of View by also recalculating the perspective matrix.
     * @param {number} fov The new desired FOV in degrees.
     */
    Camera.prototype.setFOV = function (fov) {
        this._fov = fov;
        this.updatePerspectiveMatrix();
    };

    /**
     * Sets the camera's aspect ratio by also recalculating the perspective matrix.
     * @param {number} aspect The new desired aspect ratio.
     */
    Camera.prototype.setAspect = function (aspect) {
        this._aspect = aspect;
        this.updatePerspectiveMatrix();
    };

    Camera.prototype.decreaseFOV = function () {
        if (this._fov > this._minFOV) {
            this.setFOV(this._fov * 0.95);
        }
    };

    Camera.prototype.increaseFOV = function () {
        if (this._fov < this._maxFOV) {
            this.setFOV(this._fov * 1.05);
        }
    };

    Camera.prototype.turnLeft = function (intensity) {
        if (this.controllableDirection) {
            if ((intensity === undefined) || (intensity === null)) {
                if (this.angularVelocityVector[1] < this.maxTurn) {
                    this.angularVelocityVector[1] += this.angularAcceleration;
                }
            } else {
                this.angularVelocityVector[1] = intensity;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.turnLeft(intensity);
        }
    };

    Camera.prototype.stopLeftTurn = function () {
        if (this.angularVelocityVector[1] > 0) {
            this.angularVelocityVector[1] = 0;//-=
            //Math.min(this.angularDecceleration, this.angularVelocityVector[1]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopLeftTurn();
        }
    };

    Camera.prototype.turnRight = function (intensity) {
        if (this.controllableDirection) {
            if ((intensity === undefined) || (intensity === null)) {
                if (this.angularVelocityVector[1] > -this.maxTurn) {
                    this.angularVelocityVector[1] -= this.angularAcceleration;
                }
            } else {
                this.angularVelocityVector[1] = -intensity;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.turnRight(intensity);
        }
    };

    Camera.prototype.stopRightTurn = function () {
        if (this.angularVelocityVector[1] < 0) {
            this.angularVelocityVector[1] = 0;//+=
            //Math.min(this.angularDecceleration, -this.angularVelocityVector[1]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopRightTurn();
        }
    };

    Camera.prototype.turnUp = function (intensity) {
        if (this.controllableDirection) {
            if ((intensity === undefined) || (intensity === null)) {
                if (this.angularVelocityVector[0] < this.maxTurn) {
                    this.angularVelocityVector[0] += this.angularAcceleration;
                }
            } else {
                this.angularVelocityVector[0] = intensity;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.turnUp(intensity);
        }
    };

    Camera.prototype.stopUpTurn = function () {
        if (this.angularVelocityVector[0] > 0) {
            this.angularVelocityVector[0] = 0;//-=
            //Math.min(this.angularDecceleration, this.angularVelocityVector[0]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopUpTurn();
        }
    };

    Camera.prototype.turnDown = function (intensity) {
        if (this.controllableDirection) {
            if ((intensity === undefined) || (intensity === null)) {
                if (this.angularVelocityVector[0] > -this.maxTurn) {
                    this.angularVelocityVector[0] -= this.angularAcceleration;
                }
            } else {
                this.angularVelocityVector[0] = -intensity;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.turnDown(intensity);
        }
    };

    Camera.prototype.stopDownTurn = function () {
        if (this.angularVelocityVector[0] < 0) {
            this.angularVelocityVector[0] = 0;//+=
            //Math.min(this.angularDecceleration, -this.angularVelocityVector[0]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopDownTurn();
        }
    };

    Camera.prototype.moveLeft = function () {
        if (this.controllablePosition) {
            if (this.velocityVector[0] < this.maxSpeed) {
                this.velocityVector[0] += this.acceleration;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.moveLeft();
        }
    };

    Camera.prototype.stopLeftMove = function () {
        if (this.velocityVector[0] > 0) {
            this.velocityVector[0] -=
                    Math.min(this.acceleration, this.velocityVector[0]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopLeftMove();
        }
    };

    Camera.prototype.moveRight = function () {
        if (this.controllablePosition) {
            if (this.velocityVector[0] > -this.maxSpeed) {
                this.velocityVector[0] -= this.acceleration;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.moveRight();
        }
    };

    Camera.prototype.stopRightMove = function () {
        if (this.velocityVector[0] < 0) {
            this.velocityVector[0] +=
                    Math.min(this.acceleration, -this.velocityVector[0]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopRightMove();
        }
    };

    Camera.prototype.moveUp = function () {
        if (this.controllablePosition) {
            if (this.velocityVector[1] > -this.maxSpeed) {
                this.velocityVector[1] -= this.acceleration;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.moveUp();
        }
    };

    Camera.prototype.stopUpMove = function () {
        if (this.velocityVector[1] < 0) {
            this.velocityVector[1] +=
                    Math.min(this.acceleration, -this.velocityVector[1]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopUpMove();
        }
    };

    Camera.prototype.moveDown = function () {
        if (this.controllablePosition) {
            if (this.velocityVector[1] < this.maxSpeed) {
                this.velocityVector[1] += this.acceleration;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.moveDown();
        }
    };

    Camera.prototype.stopDownMove = function () {
        if (this.velocityVector[1] > 0) {
            this.velocityVector[1] -=
                    Math.min(this.acceleration, this.velocityVector[1]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopDownMove();
        }
    };

    Camera.prototype.moveForward = function () {
        if (this.controllablePosition) {
            if (this.velocityVector[2] < this.maxSpeed) {
                this.velocityVector[2] += this.acceleration;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.moveForward();
        }
    };

    Camera.prototype.stopForwardMove = function () {
        if (this.velocityVector[2] > 0) {
            this.velocityVector[2] -=
                    Math.min(this.acceleration, this.velocityVector[2]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopForwardMove();
        }
    };

    Camera.prototype.moveBackward = function () {
        if (this.controllablePosition) {
            if (this.velocityVector[2] > -this.maxSpeed) {
                this.velocityVector[2] -= this.acceleration;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.moveBackward();
        }
    };

    Camera.prototype.stopBackwardMove = function () {
        if (this.velocityVector[2] < 0) {
            this.velocityVector[2] +=
                    Math.min(this.acceleration, -this.velocityVector[2]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopBackwardMove();
        }
    };

    Camera.prototype.updatePosition = function () {
        if (this.controllablePosition) {
            var inverseOrientationMatrix = Mat.transposed3(Mat.inverse3(Mat.matrix3from4(this.getOrientationMatrix())));
            var translationVector = Vec.mulMat3Vec3(
                    inverseOrientationMatrix,
                    this.velocityVector
                    );
            if (this.followedObject === undefined) {
                this.translatev(translationVector);
            } else {
                this.followPositionMatrix =
                        Mat.mul4(
                                this.followPositionMatrix,
                                Mat.translation4v(translationVector)
                                );
            }
        }
        if (this.followedObject) {
            var camPositionMatrix =
                    Mat.mul4(
                            Mat.mul4(
                                    this.rotationCenterIsObject ?
                                    Mat.translation4v(Mat.translationVector4(Mat.mul4(
                                            this.followPositionMatrix,
                                            Mat.inverseOfRotation4(this.followOrientationMatrix)
                                            )))
                                    :
                                    this.followPositionMatrix,
                                    this.followedObject.getOrientationMatrix()
                                    ),
                            this.followedObject.getPositionMatrix()
                            );
            var newPositionMatrix =
                    Mat.translation4(
                            -camPositionMatrix[12],
                            -camPositionMatrix[13],
                            -camPositionMatrix[14]
                            );
            var velocityMatrix = Mat.mul4(Mat.translation4(
                    newPositionMatrix[12] - this.getPositionMatrix()[12],
                    newPositionMatrix[13] - this.getPositionMatrix()[13],
                    newPositionMatrix[14] - this.getPositionMatrix()[14]), this.getOrientationMatrix());
            this.setPositionMatrix(newPositionMatrix);
        }
    };

    Camera.prototype.updateOrientation = function () {
        var rotationMatrix;
        if (this.controllableDirection) {
            if (this.followedObject === undefined) {
                rotationMatrix =
                        Mat.mul4(
                                Mat.rotation4(
                                        [0, 1, 0],
                                        this.angularVelocityVector[1]
                                        ),
                                Mat.rotation4(
                                        [1, 0, 0],
                                        this.angularVelocityVector[0]
                                        )
                                );
                this.rotateByMatrix(rotationMatrix);
            } else {
                rotationMatrix =
                        Mat.mul4(
                                Mat.rotation4(
                                        [0, 0, 1],
                                        this.angularVelocityVector[1]
                                        ),
                                Mat.rotation4(
                                        [1, 0, 0],
                                        this.angularVelocityVector[0]
                                        )
                                );
                this.followOrientationMatrix = Mat.mul4(this.followOrientationMatrix, rotationMatrix);
            }
        }
        if (this.followedObject) {
            // look in direction y instead of z:
            this.setOrientationMatrix(
                    Mat.mul4(
                            Mat.mul4(
                                    Mat.inverseOfRotation4(this.followedObject.getOrientationMatrix()),
                                    this.followOrientationMatrix
                                    ),
                            Mat.rotation4([1, 0, 0], 3.1415 / 2)
                            )
                    );
        }
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
    function SceneCamera(aspect, fov, adaptationTime, followedCamera) {
        Camera.call(this, aspect, fov, true, true);
        /**
         * @name SceneCamera#_scene
         * @type Scene
         */
        this._scene = null;
        this.adaptationTime = adaptationTime;
        /**
         * @name SceneCamera#followedCamera
         * @type Camera
         */
        this.followedCamera = null;
        this._previousFollowedPosition = null;
        this.followCamera(followedCamera);
    }

    SceneCamera.prototype = new Camera();
    SceneCamera.prototype.constructor = SceneCamera;

    SceneCamera.prototype.setScene = function (scene) {
        !this._scene ?
                this._scene = scene :
                Application.showError("Attempting to assign an already assigned camera to a different scene!", "minor");
    };

    /**
     * A temporary function needed as controllers have to set their controlled
     * entity at initialization, and they expect a controllable entity that has
     * this function, however ControllableEntity is defined in logic.js. The
     * scene camera has a controller so it needs this function (to be cleaned up
     * later)
     * @param {Controller} newController
     */
    SceneCamera.prototype.setControllerWithoutChecks = function (newController) {
        this.controller = newController;
    };

    SceneCamera.prototype.changeToNextView = function () {
        if ((this.followedCamera) && (this.followedCamera.nextView)) {
            this.followCamera(this.followedCamera.nextView, 500);
        }
    };

    SceneCamera.prototype.followNextObject = function () {
        if (this.followedCamera && this.followedCamera.followedObject) {
            var currentlyFollowedObject = this.followedCamera.followedObject;
            this.followCamera(this._scene.getNextObject(currentlyFollowedObject).getFirstView(), 4000);
            // if we are currently not following any cameras, just start following the first one
        } else {
            var firstObject = this._scene.getFirstObject();
            if (firstObject.getFirstView()) {
                this.followCamera(firstObject.getFirstView(), 4000);
            } else {
                for (
                        var currentObject = this._scene.getNextObject(firstObject);
                        currentObject !== firstObject;
                        currentObject = this._scene.getNextObject(currentObject)) {
                    if (currentObject.getFirstView()) {
                        this.followCamera(currentObject.getFirstView(), 4000);
                        break;
                    }
                }
            }
        }
    };

    SceneCamera.prototype.followPreviousObject = function () {
        if (this.followedCamera && this.followedCamera.followedObject) {
            var currentlyFollowedObject = this.followedCamera.followedObject;
            this.followCamera(this._scene.getPreviousObject(currentlyFollowedObject).getFirstView(), 4000);
            // if we are currently not following any cameras, just start following the first one
        } else {
            var firstObject = this._scene.getFirstObject();
            if (firstObject.getFirstView()) {
                this.followCamera(firstObject.getFirstView(), 4000);
            } else {
                for (
                        var currentObject = this._scene.getNextObject(firstObject);
                        currentObject !== firstObject;
                        currentObject = this._scene.getNextObject(currentObject)) {
                    if (currentObject.getFirstView()) {
                        this.followCamera(currentObject.getFirstView(), 4000);
                        break;
                    }
                }
            }
        }
    };

    SceneCamera.prototype.followObject = function (object) {
        if (object) {
            this.followCamera(object.getFirstView(), 500);
        } else {
            this.followCamera(null, 0);
        }
    };

    /**
     * Set the camera up to adapt to a virtual camera.
     * @param {Camera} camera The new camera to follow.
     * @param {number} adaptationTime The duration the camera will take when adapting its parameters
     * to the new followed camera in milliseconds. (optional)
     */
    SceneCamera.prototype.followCamera = function (camera, adaptationTime) {
        if (adaptationTime !== undefined) {
            this.adaptationTime = adaptationTime;
        }
        this.followedCamera = camera;
        this.adaptationStartTime = new Date().getTime();
        this.adaptationStartPositionMatrix = this._positionMatrix;
        this.adaptationStartOrientationMatrix = this._orientationMatrix;
        this.adaptationStartFOV = this._fov;
        this.adaptationTimeLeft = this.adaptationTime;
    };

    /**
     * Updates the transformation matrices of the scene camera to transition to a
     * new followed camera if it did not adapt to it fully yet.
     */
    SceneCamera.prototype.update = function () {
        if (this.followedCamera) {
            this.followedCamera.updateOrientation();
            this.followedCamera.updatePosition();
            if (this.adaptationTimeLeft > 0) {
                var currentTime = new Date().getTime();
                var adaptationProgress = Math.min(1.0, (currentTime - this.adaptationStartTime) / this.adaptationTime);
                this.adaptationTimeLeft = this.adaptationTime - (currentTime - this.adaptationStartTime);
                var trans = Mat.translation4(
                        (this.followedCamera._positionMatrix[12] - this.adaptationStartPositionMatrix[12]) * adaptationProgress,
                        (this.followedCamera._positionMatrix[13] - this.adaptationStartPositionMatrix[13]) * adaptationProgress,
                        (this.followedCamera._positionMatrix[14] - this.adaptationStartPositionMatrix[14]) * adaptationProgress
                        );
                var newPositionMatrix = Mat.translatedByM4(this.adaptationStartPositionMatrix, trans);
                var velocityMatrix = Mat.mul4(Mat.translation4(
                        newPositionMatrix[12] - this._positionMatrix[12],
                        newPositionMatrix[13] - this._positionMatrix[13],
                        newPositionMatrix[14] - this._positionMatrix[14]), this._orientationMatrix);
                this.velocityVector = [velocityMatrix[12], velocityMatrix[13], velocityMatrix[14]];
                this._positionMatrix = newPositionMatrix;
                this._orientationMatrix = Mat.correctedOrthogonal4(Mat.add4(
                        Mat.scaled4(this.adaptationStartOrientationMatrix, 1.0 - adaptationProgress),
                        Mat.scaled4(this.followedCamera._orientationMatrix, adaptationProgress)
                        ));
                this._updateMatrix();
                this.setFOV(this.adaptationStartFOV + (this.followedCamera._fov - this.adaptationStartFOV) * adaptationProgress);
                this._previousFollowedPosition = this.followedCamera.followedObject.getPositionMatrix();
            } else {
                this._positionMatrix = this.followedCamera._positionMatrix;
                this._orientationMatrix = this.followedCamera._orientationMatrix;
                this._perspectiveMatrix = this.followedCamera._perspectiveMatrix;
                this._updateMatrix();
                var newFollowedPosition = this.followedCamera.followedObject.getPositionMatrix();
                var velocityMatrix = Mat.mul4(Mat.translation4(
                        -newFollowedPosition[12] + this._previousFollowedPosition[12],
                        -newFollowedPosition[13] + this._previousFollowedPosition[13],
                        -newFollowedPosition[14] + this._previousFollowedPosition[14]), this._orientationMatrix);
                this.velocityVector = [velocityMatrix[12], velocityMatrix[13], velocityMatrix[14]];
                this._previousFollowedPosition = newFollowedPosition;
            }
        } else {
            this.updateOrientation();
            this.updatePosition();
        }
    };

    SceneCamera.prototype.getFollowedSpacecraft = function (logicContext) {
        var i;
        if ((this.followedCamera !== undefined) && (this.followedCamera.followedObject !== undefined)) {
            // look up the spacecraft being followed (these references need to be cleaned up
            // to make this part transparent)
            i = 0;
            while ((i < logicContext.level._spacecrafts.length) &&
                    (logicContext.level._spacecrafts[i].visualModel !== this.followedCamera.followedObject)) {
                i++;
            }
            // if we found it, set the proper controller
            if (i < logicContext.level._spacecrafts.length) {
                return logicContext.level._spacecrafts[i];
            }
        }
        return null;
    };

    /**
     * @class Represents a light source that can be taken into account when rendering.
     * @param {Number[3]} color
     * @param {Number[3]} direction
     * @returns {LightSource}
     */
    function LightSource(color, direction) {
        this.color = color;
        this.direction = Vec.normal3(direction);
        this.castsShadows = true;
        this._orientationMatrix = Mat.identity4();
        this.matrix = null;
        this._index = null;
        var vx, vy, vz, axis;
        vz = this.direction;
        axis = [Math.abs(vz[0]), Math.abs(vz[1]), Math.abs(vz[2])];
        axis = (axis[0] >= Math.max(axis[1], axis[2])) ? [1, 0, 0] :
                ((axis[1] >= Math.max(axis[0], axis[2])) ? [0, 1, 0] : [0, 0, 1]);
        vx = Vec.normal3(Vec.mulVec3Mat4(vz, Mat.rotation4(axis, Math.PI / 2)));
        vy = Vec.scaled3(Vec.normal3(Vec.cross3(vx, vz)), -1);
        vx = Vec.normal3(Vec.cross3(vy, vz));
        vy = Vec.normal3(Vec.cross3(vz, vx));
        this._orientationMatrix = Mat.fromVectorsTo4(vx, vy, vz);
        this.matrix = this._orientationMatrix;
        console.log(Vec.toString3(direction) + "\n" + Mat.toString4(this._orientationMatrix));
    }

    /**
     * 
     * @param {ManagedGLContext} context
     * @param {Number} index 
     * @param {Number} nRanges
     * @param {Number} shadowMapTextureSize
     */
    LightSource.prototype.addToContext = function (context, index, nRanges, shadowMapTextureSize) {
        this._index = index;
        if (this.castsShadows) {
            for (var i = 0; i < nRanges; i++) {
                context.addFrameBuffer(new GL.FrameBuffer("shadow-map-buffer-" + this._index + "-" + i, shadowMapTextureSize, shadowMapTextureSize));
            }
        }
    };

    /**
     * 
     * @param {ManagedGLContext} context
     * @param {SceneCamera} camera
     * @param {Number} rangeIndex
     * @param {Number} range
     */
    LightSource.prototype.startShadowMap = function (context, camera, rangeIndex, range) {
        context.setCurrentFrameBuffer("shadow-map-buffer-" + this._index + "-" + rangeIndex);

        var self = this;
        context.getCurrentShader().assignUniforms(context, {
            "u_lightMatrix": function () {
                self.matrix = Mat.mul4(camera.getPositionMatrix(), self._orientationMatrix);
                return self.matrix;
            },
            "u_shadowMapRange": function () {
                return range;
            },
            "u_projMatrix": function () {
                return Mat.orthographic4(range, range, -range, range);
            }
        });
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
     * @param {Shader} [shadowMappingShader]
     */
    function Scene(left, top, width, height, clearColorOnRender, colorMask, clearColor, clearDepthOnRender, lodContext, shadowMappingShader) {
        this.left = left;
        this.top = top;
        this.width = width;
        this.height = height;

        this.clearColorOnRender = clearColorOnRender;
        this.colorMask = colorMask;
        this.clearColor = clearColor;
        this.clearDepthOnRender = clearDepthOnRender;

        this._backgroundObjects = new Array();
        this.objects = new Array();
        this.cameras = new Array();
        this.lights = new Array();

        this.setActiveCamera(new SceneCamera(width / height, 60, 1000));

        this.lodContext = lodContext;

        this._shadowMappingShader = shadowMappingShader || null;
        this._shadowMapTextureSize = 2048;
        this._shadowMapRanges = [100,300,600,1200];

        this.uniformValueFunctions = new Object();

        this.firstRender = true;
        this._drawnTriangles = 0;

        var self = this;
        // setting uniform valuables that are universal to all scene graph 
        // objects, so any shader used in the scene will be able to get their
        // values
        this.uniformValueFunctions['u_numLights'] = function () {
            return self.lights.length;
        };
        this.uniformValueFunctions['u_lights'] = function () {
            return self.lights;
        };

        this.uniformValueFunctions['u_cameraMatrix'] = function () {
            return self.activeCamera.getCameraMatrix();
        };
        this.uniformValueFunctions['u_cameraOrientationMatrix'] = function () {
            return self.activeCamera.getOrientationMatrix();
        };
        this.uniformValueFunctions['u_projMatrix'] = function () {
            return self.activeCamera.getPerspectiveMatrix();
        };
        this.uniformValueFunctions['u_eyePos'] = function () {
            return new Float32Array(Vec.scaled3(self.activeCamera.getPositionVector(), -1));
        };
        this.uniformValueFunctions["u_shadows"] = function () {
            return !!self._shadowMappingShader;
        };
        if (this._shadowMappingShader) {
            this.uniformValueFunctions["u_numRanges"] = function () {
                return self._shadowMapRanges.length;
            };
            this.uniformValueFunctions["u_shadowMapRanges"] = function () {
                return new Float32Array(self._shadowMapRanges);
            };
        }
    }

    Scene.prototype.setActiveCamera = function (sceneCamera) {
        this.activeCamera = sceneCamera;
        sceneCamera.setScene(this);
    };

    /**
     * Appends a new visual object to the list of background objects.
     * @param {VisualObject} newVisualObject The object to append.
     */
    Scene.prototype.addBackgroundObject = function (newVisualObject) {
        this._backgroundObjects.push(newVisualObject);
    };

    /**
     * Appends a new visual object to the topmost level of the scene graph.
     * @param {VisualObject} newVisualObject The object to append.
     */
    Scene.prototype.addObject = function (newVisualObject) {
        this.objects.push(newVisualObject);
    };

    Scene.prototype.clearObjects = function () {
        this._backgroundObjects = new Array();
        this.objects = new Array();
    };

    /**
     * 
     * @returns {VisualObject}
     */
    Scene.prototype.getFirstObject = function () {
        return this.objects[0];
    };

    /**
     * @param {VisualObject} currentObject
     * @returns {VisualObject}
     */
    Scene.prototype.getNextObject = function (currentObject) {
        for (var i = 0; i < this.objects.length; i++) {
            if (this.objects[i] === currentObject) {
                return ((i === (this.objects.length - 1)) ?
                        this.objects[0] :
                        this.objects[i + 1]);
            }
        }
        return this.objects[0];
    };

    /**
     * @param {VisualObject} currentObject
     * @returns {VisualObject}
     */
    Scene.prototype.getPreviousObject = function (currentObject) {
        for (var i = 0; i < this.objects.length; i++) {
            if (this.objects[i] === currentObject) {
                return ((i === 0) ?
                        this.objects[this.objects.length - 1] :
                        this.objects[i - 1]);
            }
        }
        return this.objects[0];
    };

    Scene.prototype.addLightSource = function (newLightSource) {
        this.lights.push(newLightSource);
    };

    Scene.prototype.getLODContext = function () {
        return this.lodContext;
    };

    Scene.prototype.getNumberOfDrawnTriangles = function () {
        return this._drawnTriangles;
    };

    Scene.prototype.setUniformValueFunction = function (uniformName, valueFunction) {
        this.uniformValueFunctions[uniformName] = valueFunction;
    };

    /**
     * 
     * @param {Camera} camera
     */
    Scene.prototype.addCamera = function (camera) {
        this.cameras.push(camera);
        if ((this.cameras.length >= 2) && (this.cameras[this.cameras.length - 1].followedObject === this.cameras[this.cameras.length - 2].followedObject)) {
            this.cameras[this.cameras.length - 1].nextView = this.cameras[this.cameras.length - 2].nextView;
            this.cameras[this.cameras.length - 2].nextView = this.cameras[this.cameras.length - 1];
        } else {
            this.cameras[this.cameras.length - 1].nextView = this.cameras[this.cameras.length - 1];
        }
    };

    /**
     * Recalculates the perspective matrices of cameras in case the viewport size
     * (and as a result, aspect) has changed.
     * @param {Number} newWidth
     * @param {Number} newHeight
     */
    Scene.prototype.resizeViewport = function (newWidth, newHeight) {
        var i;
        this.width = newWidth;
        this.height = newHeight;
        for (var i = 0; i < this.cameras.length; i++) {
            this.cameras[i].setAspect(this.width / this.height);
        }
        this.activeCamera.setAspect(this.width / this.height);
    };

    /**
     * Assigns all uniforms in the given shader program that
     * the scene has a value function for, using the appropriate webGL calls.
     * The matching is done based on the names of the uniforms.
     * @param {ManagedGLContext} context The webGL context to use
     * @param {Shader} shader The shader program in which to assign the uniforms.
     */
    Scene.prototype.assignUniforms = function (context, shader) {
        shader.assignUniforms(context, this.uniformValueFunctions);
    };

    /**
     * Cleans up the whole scene graph, removing all object that are deleted or are
     * marked for deletion.
     */
    Scene.prototype.cleanUp = function () {
        for (var i = 0; i < this.objects.length; i++) {
            this.objects[i].cascadeCleanUp();
            while ((i < this.objects.length) && ((this.objects[i] === undefined) || (this.objects[i].toBeDeleted))) {
                this.objects[i] = null;
                this.objects.splice(i, 1);
            }
        }
    };

    /**
     * 
     * @param {ManagedGLContext} context
     */
    Scene.prototype.addToContext = function (context) {
        var i;
        if (this._shadowMappingShader) {
            this._shadowMappingShader.addToContext(context);
            this.uniformValueFunctions['u_shadowMaps'] = function () {
                return new Int32Array([3, 4, 5, 6, 7, 8, 9, 10, 11, 12 ,13, 14]);
            };
        }
        for (i = 0; i < this.lights.length; i++) {
            this.lights[i].addToContext(context, i, this._shadowMapRanges.length, this._shadowMapTextureSize);
        }
        for (i = 0; i < this._backgroundObjects.length; i++) {
            this._backgroundObjects[i].cascadeAddToContext(context);
        }
        for (i = 0; i < this.objects.length; i++) {
            this.objects[i].cascadeAddToContext(context);
        }
    };

    Scene.prototype.renderShadowMap = function (context) {
        var gl = context.gl;

        gl.viewport(0, 0, this._shadowMapTextureSize, this._shadowMapTextureSize);
        gl.scissor(0, 0, this._shadowMapTextureSize, this._shadowMapTextureSize);

        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.colorMask(true, true, true, true);
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        for (var i = 0; i < this.objects.length; i++) {
            this.objects[i].cascadeRenderShadowMap(context, this, this.width, this.height);
        }
    };

    /**
     * Renders the whole scene applying the general configuration and then rendering
     * all visual objects in the graph.
     * @param {ManagedGLContext} context
     */
    Scene.prototype.render = function (context) {
        this._drawnTriangles = 0;

        var gl = context.gl;
        
        // ensuring that transformation matrices are only calculated once for 
        // each object in each render
        for (var i = 0; i < this.objects.length; i++) {
            this.objects[i].cascadeResetModelMatrixCalculated();
        }

        if (this._shadowMappingShader) {
            context.setCurrentShader(this._shadowMappingShader, this);
            for (var i = 0; i < this.lights.length; i++) {
                if (this.lights[i].castsShadows) {
                    for (var j = 0; j < this._shadowMapRanges.length; j++) {
                        this.lights[i].startShadowMap(context, this.activeCamera, j, this._shadowMapRanges[j]);
                        this.renderShadowMap(context);
                    }
                }
            }
            for (var i = 0; i < this.lights.length; i++) {
                if (this.lights[i].castsShadows) {
                    for (var j = 0; j < this._shadowMapRanges.length; j++) {
                        context.bindTexture(context.getFrameBuffer("shadow-map-buffer-" + i + "-" + j), 3 + i * 4 + j);
                    }
                }
            }
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.viewport(this.left, this.top, this.width, this.height);
        gl.scissor(this.left, this.top, this.width, this.height);

        if (this.clearColorOnRender) {
            gl.colorMask(this.colorMask[0], this.colorMask[1], this.colorMask[2], this.colorMask[3]);
            gl.clearColor(this.clearColor[0], this.clearColor[1], this.clearColor[2], this.clearColor[3]);
        }

        this.firstRender = false;

        // glClear is affected by the depth mask, so we need to turn it on here!
        // (it's disabled for the second (transparent) render pass)
        gl.depthMask(true);
        // clearing color and depth buffers as set for this scene
        var clear = this.clearColorOnRender ? gl.COLOR_BUFFER_BIT : 0;
        clear = this.clearDepthOnRender ? clear | gl.DEPTH_BUFFER_BIT : clear;
        gl.clear(clear);

        gl.enable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(false);

        // if only one shader is used in rendering the whole scene, we will need to
        // update its uniforms (as they are normally updated every time a new shader
        // is set)
        if (context.getCurrentShader() !== null) {
            this.assignUniforms(context, context.getCurrentShader());
        }

        for (var i = 0; i < this._backgroundObjects.length; i++) {
            this._backgroundObjects[i].cascadeResetModelMatrixCalculated();
            this._backgroundObjects[i].cascadeRender(context, this, this.width, this.height, false);
            this._drawnTriangles += this._backgroundObjects[i].cascadeGetNumberOfDrawnTriangles();
        }

        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);

        // first rendering pass: rendering the non-transparent triangles with 
        // Z buffer writing turned on
        gl.disable(gl.BLEND);
        for (var i = 0; i < this.objects.length; i++) {
            this.objects[i].cascadeRender(context, this, this.width, this.height, true);
            this._drawnTriangles += this.objects[i].cascadeGetNumberOfDrawnTriangles();
        }
        // second rendering pass: rendering the transparent triangles with 
        // Z buffer writing turned off
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        for (var i = 0; i < this.objects.length; i++) {
            this.objects[i].cascadeRender(context, this, this.width, this.height, false);
            this._drawnTriangles += this.objects[i].cascadeGetNumberOfDrawnTriangles();
        }
    };

    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        Scene: Scene,
        LightSource: LightSource,
        Camera: Camera,
        VisualObject: VisualObject,
        FVQ: FVQ,
        ModelWithLOD: ModelWithLOD,
        Mesh: Mesh,
        ShipMesh: ShipMesh,
        Billboard: Billboard,
        StaticParticle: StaticParticle,
        DynamicParticle: DynamicParticle,
        PointCloud: PointCloud,
        PointParticle: PointParticle
    };
});