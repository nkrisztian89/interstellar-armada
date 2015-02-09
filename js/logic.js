"use strict";
/**
 * @fileOverview This file implements the game logic of the Interstellar 
 * Armada program.
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

Application.createModule({name: "Logic",
    dependencies: [
        {script: "polyfill.js"},
        {script: "matrices.js"},
        {module: "Resource", from: "resource.js"},
        {module: "Classes", from: "classes.js"},
        {module: "Physics", from: "physics.js"},
        {module: "Egom", from: "egom.js"},
        {module: "Scene", from: "scene.js"}]}, function () {
    // create a reference to the used modules in the local scope for cleaner and
    // faster access
    var Resource = Application.Resource.Resource;
    var Classes = Application.Classes;
    var Physics = Application.Physics;
    var Egom = Application.Egom;
    var Scene = Application.Scene;
    // a reference to this module which will be returned in the end
    var Module;
    /**
     * The length of impulse-like events in milliseconds (such as thruster bursts or 
     * weapon shots)
     * @type Number
     */
    var timeBurstLength = 50;
    /**
     * The length of time while muzzle flashes are visible (and shrinking).
     * @type Number
     */
    var muzzleFlashTimeLength = 500;
    /**
     * @class Represents a skybox that can be added to a scene to render the
     * background using a cube mapped texture defined by the passed class of the
     * skybox.
     * @param {SkyboxClass} skyboxClass
     * @returns {Skybox}
     */
    function Skybox(skyboxClass) {
        /**
         * The class storing the general characteristics of this skybox.
         * @name Skybox#_class
         * @type SkyboxClass
         */
        this._class = skyboxClass;
    }
    /**
     * Adds a background FVQ object to the passed scene and sets it up according
     * the properties of this skybox.
     * @param {Scene} scene
     */
    Skybox.prototype.addToScene = function (scene) {
        scene.addBackgroundObject(new Scene.FVQ(
                Armada.resources().getOrAddModelByName(Egom.fvqModel("fvqModel")),
                Armada.resources().getShader(this._class.shaderName),
                this._class.samplerName,
                Armada.resources().getCubemappedTexture(this._class.cubemap),
                scene.activeCamera));
    };
    /**
     * Represents an "infinitely far away" object in space (typically a star)
     * that serves as a light source as well as is rendered as a set of 2D texture
     * layers on the background.
     * @param {BackgroundObjectClass} backgroundObjectClass
     * @param {Number} degreesAlpha The angle between the positive X axis and the
     * direction in which this object is positioned on the XZ plane in degrees.
     * @param {Number} degreesBeta The angle between the XZ plane and the
     * direction in which this object is positioned.
     * @returns {BackgroundObject}
     */
    function BackgroundObject(backgroundObjectClass, degreesAlpha, degreesBeta) {
        /**
         * The class storing the general characteristics of this object.
         * @name BackgroundObject#_class
         * @type BackgroundObjectClass
         */
        this._class = backgroundObjectClass;
        /**
         * A unit length vector pointing in the direction of this object.
         * @name BackgroundObject#_position
         * @type Number[3]
         */
        this._position = [
            Math.cos(degreesAlpha / 180 * Math.PI) * Math.cos(degreesBeta / 180 * Math.PI),
            Math.sin(degreesAlpha / 180 * Math.PI) * Math.cos(degreesBeta / 180 * Math.PI),
            Math.sin(degreesBeta / 180 * Math.PI)
        ];
    }
    /**
     * Adds the layered texture object and the light source belonging to this
     * object to the passed scene.
     * @param {Scene} scene
     */
    BackgroundObject.prototype.addToScene = function (scene) {
        var i;
        var layerParticle;
        scene.addLightSource(new Scene.LightSource(this._class.lightColor, this._position));
        for (i = 0; i < this._class.layers.length; i++) {
            layerParticle = new Scene.StaticParticle(
                    Armada.resources().getOrAddModelByName(Egom.squareModel("squareModel")),
                    Armada.resources().getShader(this._class.layers[i].shaderName),
                    Armada.resources().getOrAddTextureFromDescriptor(this._class.layers[i].textureDescriptor),
                    this._class.layers[i].color,
                    this._class.layers[i].size,
                    Mat.translation4v(Vec.scaled3(this._position, 4500)));
            layerParticle.setRelSize(1.0);
            scene.addBackgroundObject(layerParticle);
        }
    };
    /**
     * Creates a dust particle object and adds it to the scene it's cloud it part
     * of right away.
     * @class A tiny piece of dust that is rendered as passing line to indicate the
     * direction and speed of movement to the player.
     * @param {DustCloud} cloud The cloud to which this dust particle belongs.
     * @param {Shader} shader
     * @param {Float32Array} positionMatrix
     * @returns {DustParticle}
     */
    function DustParticle(cloud, shader, positionMatrix) {
        /**
         * The renderable object representing this particle in the scene.
         * @name DustParticle#_visualModel
         * @type PointParticle
         */
        this._visualModel = new Scene.PointParticle(
                Armada.resources().getOrAddModelByName(Egom.lineModel("dust", [1.0, 1.0, 1.0], cloud.getColor())),
                shader,
                positionMatrix);
        /**
         * The distance up to how far away this particle can be from the camera.
         * @name DustParticle#_range
         * @type Number
         */
        this._range = cloud.getRange();
    }
    /**
     * Adds the visual model of this particle to a scene, using the passed node
     * as its rendering parent.
     * @param {PointCloud} cloudNode
     */
    DustParticle.prototype.addToScene = function (cloudNode) {
        cloudNode.addSubnode(new Scene.RenderableNode(this._visualModel));
    };
    /**
     * Updates the position of the particle to be acound the camera within proper
     * range.
     * @param {Camera} camera The camera relative to which to position the
     * particles.
     */
    DustParticle.prototype.simulate = function (camera) {
        var modelPos = this._visualModel.positionMatrix;
        var cameraPos = camera.getPositionMatrix();
        for (var i = 12; i < 15; i++) {
            if (modelPos[i] > -cameraPos[i] + this._range) {
                this._visualModel.positionMatrix[i] -= this._range * 2;
            } else if (modelPos[i] < -cameraPos[i] - this._range) {
                this._visualModel.positionMatrix[i] += this._range * 2;
            }
        }
        this._visualModel.matrix = this._visualModel.positionMatrix;
    };
    /**
     * @class Represents a dust cloud containing dust particles that can indicate
     * direction and speed of movement of the camera for the player.
     * @param {DustCloudClass} dustCloudClass The class of this cloud, storing
     * it's general properties.
     * @returns {DustCloud}
     */
    function DustCloud(dustCloudClass) {
        /**
         * The class storing the general characteristics of this cloud.
         * @name DustCloud#_class
         * @type DustCloudClass
         */
        this._class = dustCloudClass;
        /**
         * The array of particles this cloud consists of.
         * @name DustCloud#_particles
         * @type DustParticle[]
         */
        this._particles = null;
        /**
         * The renderable object representing this cloud in the scene.
         * @name DustCloud#_visualModel
         * @type PointCloud
         */
        this._visualModel = null;
    }
    /**
     * Return the color of particles of this cloud. 
     * @returns {Number[4]}
     */
    DustCloud.prototype.getColor = function () {
        return this._class.color.concat(1.0);
    };
    /**
     * Returns the range this cloud spans. (the maximum distance of particles
     * from the camera in world space coordinates on any angle)
     * @returns {Number}
     */
    DustCloud.prototype.getRange = function () {
        return this._class.range;
    };
    /**
     * Adds the needed objects to the scene to render this dust cloud.
     * @param {Scene} scene
     */
    DustCloud.prototype.addToScene = function (scene) {
        var i;
        this._visualModel = new Scene.PointCloud(
                Armada.resources().getShader(this._class.shaderName),
                this._class.color,
                this._class.range);
        var node = scene.addObject(this._visualModel);
        this._particles = new Array();
        for (i = 0; i < this._class.numberOfParticles; i++) {
            var particle = new DustParticle(
                    this,
                    Armada.resources().getShader(this._class.shaderName),
                    Mat.translation4(
                            (Math.random() - 0.5) * 2 * this._class.range,
                            (Math.random() - 0.5) * 2 * this._class.range,
                            (Math.random() - 0.5) * 2 * this._class.range));
            particle.addToScene(node);
            this._particles.push(particle);
        }
    };
    /**
     * Updates the position of the particles in the cloud.
     * @param {Camera} camera The camera around which the cloud should be rendered.
     */
    DustCloud.prototype.simulate = function (camera) {
        this._visualModel.shift = [-camera.velocityVector[0] / 2, -camera.velocityVector[1] / 2, -camera.velocityVector[2] / 2];
        for (var i = 0; i < this._class.numberOfParticles; i++) {
            this._particles[i].simulate(camera);
        }
    };
    /**
     * @class Represents a projectile fired from a weapon.
     * @param {ProjectileClass} projectileClass The class of the projectile
     * defining its general properties.
     * @param {Float32Array} [positionMatrix] The transformation matrix describing
     * the initial position of the projectile.
     * @param {Float32Array} [orientationMatrix] The transformation matrix describing
     * the initial oriantation of the projectile.
     * @param {Spacecraft} [spacecraft] The spacecraft which fired the projectile.
     * @param {Force} [startingForce] A force that will be applied to the (physical
     * model of) projectile to kick off its movement.
     * @returns {Projectile}
     */
    function Projectile(projectileClass, positionMatrix, orientationMatrix, spacecraft, startingForce) {
        /**
         * The class storing the general characteristics of this projectile.
         * @name Projectile#_class
         * @type ProjectileClass
         */
        this._class = projectileClass;
        /**
         * The renderable node that represents this projectile in a scene.
         * @name Projectile#_visualModel
         * @type RenderableObject
         */
        this._visualModel = null;
        /**
         * The object that represents and simulates the physical behaviour of
         * this projectile.
         * @name Projectile#_physicalModel
         * @type PhysicalObject
         */
        this._physicalModel = new Physics.PhysicalObject(
                projectileClass.mass,
                positionMatrix || Mat.identity4(),
                orientationMatrix || Mat.identity4(),
                Mat.scaling4(projectileClass.size),
                spacecraft ? spacecraft.getVelocityMatrix() : Mat.null4(),
                []);
        /**
         * The amount of time this projectile has left to "live", in milliseconds.
         * @name Porjectile#_timeLeft
         * @type Number
         */
        this._timeLeft = projectileClass.duration;
        /**
         * The spacecraft that originally fired this projectile. It will be 
         * excluded from hit check so that a projectile cannot hit the same craft
         * it was fired from.
         * @name Projectile#_origin
         * @type Spacecraft
         */
        this._origin = spacecraft;
        // kick off the movement of the projectile with the supplied force
        if (startingForce) {
            this._physicalModel.addForce(startingForce);
        }
    }
    /**
     * Returns whether this projectile object can be reused to represent a new
     * projectile.
     * @returns {Boolean}
     */
    Projectile.prototype.canBeReused = function () {
        return (this._timeLeft <= 0);
    };
    /**
     * Creates the renderable object that can be used to represent this projectile
     * in a visual scene, if it has not been created yet.
     */
    Projectile.prototype._createVisualModel = function () {
        this._visualModel = this._visualModel || new Scene.Billboard(
                Armada.resources().getOrAddModelByName(Egom.turningBillboardModel("projectileModel-" + this._class.name, this._class.intersections)),
                Armada.resources().getShader(this._class.shaderName),
                Armada.resources().getOrAddTextureFromDescriptor(this._class.textureDescriptor),
                this._class.size,
                this._physicalModel.getPositionMatrix(),
                this._physicalModel.getOrientationMatrix());
    };
    /**
     * Adds a renderable node representing this projectile to the passed scene.
     * @param {Scene} scene The scene to which to add the renderable object
     * presenting the projectile.
     */
    Projectile.prototype.addToScene = function (scene) {
        this._createVisualModel();
        scene.addObject(this._visualModel);
    };
    /**
     * Adds the resources required to render this projectile to the passed scene,
     * so they get loaded at the next resource load as well as added to any context
     * the scene is added to.
     * @param {Scene} scene
     */
    Projectile.prototype.addResourcesToScene = function (scene) {
        this._createVisualModel();
        scene.addResourcesOfObject(this._visualModel);
    };
    /**
     * Removes the renferences to the renderable and physics objects of the
     * projectile and marks it for removel / reuse.
     */
    Projectile.prototype.destroy = function () {
        this._timeLeft = 0;
        this._visualModel.markAsReusable();
        this._visualModel = null;
        this._physicalModel = null;
    };
    /**
     * Simulates the movement of the projectile and checks if it hit any objects.
     * @param {Number} dt The passed time since the last simulation in milliseconds.
     * @param {PhysicalObject[]} hitObjects The list of objects that is possible for
     * the projectile to hit.
     */
    Projectile.prototype.simulate = function (dt, hitObjects) {
        this._timeLeft -= dt;
        if (this._timeLeft <= 0) {
            this.destroy();
        } else {
            this._physicalModel.simulate(dt);
            this._visualModel.setPositionMatrix(this._physicalModel.getPositionMatrix());
            this._visualModel.setOrientationMatrix(this._physicalModel.getOrientationMatrix());
            var positionVector = Mat.translationVector3(this._physicalModel.getPositionMatrix());
            for (var i = 0; i < hitObjects.length; i++) {
                if ((hitObjects[i] !== this._origin) && (hitObjects[i].checkHit(positionVector, [], 0))) {
                    this.destroy();
                }
            }
        }
    };
    /**
     * @class Represents a weapon on a spacecraft.
     * @param {WeaponClass} weaponClass The class storing the general 
     * characteristics of this weapon.
     * @param {Spacecraft} spacecraft The spacecraft on which this weapon is 
     * located.
     * @param {WeaponSlot} slot The weapon slot that this weapon occupies on the 
     * spacecraft.
     * @returns {Weapon}
     */
    function Weapon(weaponClass, spacecraft, slot) {
        /**
         * The class storing the general characteristics of this weapon.
         * @name Weapon#_class
         * @type WeaponClass
         */
        this._class = weaponClass;
        /**
         * The spacecraft on which this weapon is located.
         * @name Weapon#_spacecraft
         * @type Spacecraft
         */
        this._spacecraft = spacecraft;
        /**
         * The weapon slot that this weapon occupies on the spacecraft.
         * @name Weapon#_slot
         * @type WeaponSlot
         */
        this._slot = slot;
        /**
         * The time stamp from when the weapon was last fired.
         * @name Weapon#_lastFireTime
         * @type Date
         */
        this._lastFireTime = 0;
        /**
         * The renderable node that represents this weapon in a scene.
         * @name Weapon#_visualModel
         * @type RenderableObject
         */
        this._visualModel = null;
    }
    /**
     * Adds a renderable node representing this weapon to the scene under the
     * passed parent node.
     * @param {ParameterizedMesh} parentNode The parent node to which to attach this
     * weapon in the scene. (normally the renderable node of the spacecraft
     * that has this weapon, but optionally can be different)
     * @param {Number} [lod] The level of detail to use for the added model. If no
     * value is given, all available LODs will be loaded for dynamic rendering.
     * @param {Boolean} wireframe Whether to add the model in wireframe rendering
     * mode.
     */
    Weapon.prototype.addToScene = function (parentNode, lod, wireframe) {
        var closestLOD = -1;
        // loading or setting models
        var modelsWithLOD = new Array();
        for (var i = 0; i < this._class.modelReferences.length; i++) {
            if (((lod === undefined) && (this._class.modelReferences[i].lod <= Armada.graphics().getMaxLoadedLOD())) ||
                    ((lod !== undefined) && (this._class.modelReferences[i].lod === lod))) {
                modelsWithLOD.push(new Scene.ModelWithLOD(
                        Armada.resources().getOrAddModelFromFile(this._class.modelReferences[i].filename),
                        this._class.modelReferences[i].lod));
            }
            // in case no suitable LOD is available, remember which one was the closest to make sure we
            // can load at least one
            if ((closestLOD === -1) || (
                    ((lod === undefined) && (this._class.modelReferences[i].lod < closestLOD)) ||
                    ((lod !== undefined) && (this._class.modelReferences[i].lod > closestLOD))
                    )) {
                closestLOD = this._class.modelReferences[i].lod;
            }
        }
        // if no suitable LOD could be found, load the closest one
        if (modelsWithLOD.length === 0) {
            for (i = 0; i < this._class.modelReferences.length; i++) {
                if (this._class.modelReferences[i].lod === closestLOD) {
                    modelsWithLOD.push(new Scene.ModelWithLOD(
                            Armada.resources().getOrAddModelFromFile(this._class.modelReferences[i].filename),
                            this._class.modelReferences[i].lod));
                }
            }
        }
        this._visualModel = new Scene.Mesh(
                modelsWithLOD,
                Armada.resources().getShader(this._spacecraft.getClass().shaderName),
                this._spacecraft.getTextures(),
                this._slot.positionMatrix,
                this._slot.orientationMatrix,
                Mat.identity4(),
                (wireframe === true));
        parentNode.addSubnode(new Scene.RenderableNode(this._visualModel));
    };
    /**
     * Returns the renderable object representing the muzzle flash that is visible
     * when the barrel having the passed index is firing a projectile.
     * @param {Number} barrelIndex
     * @returns {DynamicParticle}
     */
    Weapon.prototype._getMuzzleFlashForBarrel = function (barrelIndex) {
        var projectileClass = this._class.barrels[barrelIndex].projectileClass;
        var muzzleFlashPosMatrix = Mat.translation4v(this._class.barrels[barrelIndex].positionVector);
        return new Scene.DynamicParticle(
                Armada.resources().getOrAddModelByName(Egom.squareModel("squareModel")),
                Armada.resources().getShader(projectileClass.muzzleFlash.shaderName),
                Armada.resources().getOrAddTextureFromDescriptor(projectileClass.muzzleFlash.textureDescriptor),
                projectileClass.muzzleFlash.color,
                projectileClass.size,
                muzzleFlashPosMatrix,
                muzzleFlashTimeLength);
    };
    /**
     * Adds the resources required to render the projeciles fired by this weapon
     * to the passed scene, so they get loaded at the next resource load as well 
     * as added to any context the scene is added to.
     * @param {Scene} scene
     */
    Weapon.prototype.addProjectileResourcesToScene = function (scene) {
        for (var i = 0; i < this._class.barrels.length; i++) {
            scene.addResourcesOfObject(this._getMuzzleFlashForBarrel(i));
            var projectile = new Projectile(this._class.barrels[i].projectileClass);
            projectile.addResourcesToScene(scene);
        }
    };
    /**
     * Fires the weapon and adds the projectiles it fires (if any) to the passed
     * array.
     * @param {Projectile[]} projectiles
     */
    Weapon.prototype.fire = function (projectiles) {
        // check cooldown
        var curTime = new Date();
        if ((curTime - this._lastFireTime) > this._class.cooldown) {
            this._lastFireTime = curTime;
            // cache the matrices valid for the whole weapon
            var orientationMatrix = this._spacecraft.getOrientationMatrix();
            var scaledOriMatrix = Mat.mul4(this._spacecraft.getScalingMatrix(), orientationMatrix);
            var weaponSlotPosVector = Vec.mulVec4Mat4(Mat.translationVector4(this._slot.positionMatrix), scaledOriMatrix);
            var projectilePosMatrix = Mat.mul4(this._spacecraft.getPositionMatrix(), Mat.translation4v(weaponSlotPosVector));
            var projectileOriMatrix = Mat.mul4(this._slot.orientationMatrix, orientationMatrix);
            // generate the muzzle flashes and projectiles for each barrel
            for (var i = 0; i < this._class.barrels.length; i++) {
                // cache variables
                var projectileClass = this._class.barrels[i].projectileClass;
                var barrelPosVector = Vec.mulVec3Mat3(this._class.barrels[i].positionVector, Mat.matrix3from4(Mat.mul4(this._slot.orientationMatrix, scaledOriMatrix)));
                // add the muzzle flash of this barrel
                var muzzleFlash = this._getMuzzleFlashForBarrel(i);
                this._visualModel.getNode().addSubnode(new Scene.RenderableNode(muzzleFlash));
                // add the projectile of this barrel
                var p = new Projectile(
                        projectileClass,
                        Mat.mul4(projectilePosMatrix, Mat.translation4v(barrelPosVector)),
                        projectileOriMatrix,
                        this._spacecraft,
                        new Physics.Force("", this._class.barrels[i].force, [projectileOriMatrix[4], projectileOriMatrix[5], projectileOriMatrix[6]], timeBurstLength));
                p.addToScene(this._visualModel.getNode().getScene());
                projectiles.push(p);
            }
        }
    };
    /**
     * @class Represents a thruster on a spacecraft.
     * @param {ThusterSlot} slot The thruster slot to which this thruster is
     * equipped.
     * @returns {Thruster}
     */
    function Thruster(slot) {
        /**
         * The thruster slot to which this thruster is equipped.
         * @name Thruster#_slot
         * @type ThrusterSlot
         */
        this._slot = slot;
        /**
         * The renderable object that is used to render the thruster burn particle.
         * @name Thruster#_visualModel
         * @type RenderableObject
         */
        this._visualModel = null;
        /**
         * The renderable object corresponding to the ship this thruster is located on.
         * @name Thruster#_shipModel
         * @type RenderableObject
         */
        this._shipModel = null;
        /**
         * The level of intensity this thuster is currently used with. (0 is off,
         * 1 is maximum)
         * @name Thruster#_burnLevel
         * @type Number
         */
        this._burnLevel = 0;
    }
    /**
     * Adds a renderable node representing the particle that is rendered to show
     * the burn level of this thruster to the scene under the passed parent node.
     * @param {ParameterizedMesh} parentNode The parent node to which to attach the
     * particle in the scene. (normally the renderable node of the spacecraft
     * that has this thruster)
     * @param {ParticleDescriptor} particleDescriptor The descriptor of the 
     * particle that will be rendered to represent the thruster burn level.
     */
    Thruster.prototype.addToScene = function (parentNode, particleDescriptor) {
        this._visualModel = new Scene.StaticParticle(
                Armada.resources().getOrAddModelByName(Egom.squareModel("squareModel")),
                Armada.resources().getShader(particleDescriptor.shaderName),
                Armada.resources().getOrAddTextureFromDescriptor(particleDescriptor.textureDescriptor),
                particleDescriptor.color,
                this._slot.size,
                Mat.translation4v(this._slot.positionVector));
        parentNode.addSubnode(new Scene.RenderableNode(this._visualModel));
        this._shipModel = parentNode.getRenderableObject();
    };
    /**
     * Updates the visual representation of this thruster to represent the current
     * burn level.
     */
    Thruster.prototype._updateVisuals = function () {
        // set the size of the particle that shows the burn
        this._visualModel.setRelSize(this._burnLevel);
        // set the strength of which the luminosity texture is lighted
        this._shipModel.setParameter("luminosityFactors", this._slot.group, Math.min(1.0, 2 * this._burnLevel));
    };
    /**
     * Sets the burn level of this thruster to zero.
     */
    Thruster.prototype.resetBurn = function () {
        this._burnLevel = 0;
        this._updateVisuals();
    };
    /**
     * Adds the passed value to the current burn level of this thruster.
     * @param {Number} value
     */
    Thruster.prototype.addBurn = function (value) {
        this._burnLevel += value;
        this._updateVisuals();
    };
    /**
     * @class Represents the propulsion system equipped to a spacecraft.
     * @param {PropulsionClass} propulsionClass The class describing the general
     * properties of this propulsion.
     * @param {PhysicalObject} drivenPhysicalObject The physical object that is
     * driven by this propulsion (the physical model of the spacecraft)
     * @returns {Propulsion}
     */
    function Propulsion(propulsionClass, drivenPhysicalObject) {
        /**
         * The class describing the general properties of this propulsion.
         * @name Propulsion#_class
         * @type PropulsionClass
         */
        this._class = propulsionClass;
        /**
         * The physical object that is driven by this propulsion (the physical 
         * model of the spacecraft)
         * @name Propulsion#_drivenPhysicalObject
         * @type PhysicalObject
         */
        this._drivenPhysicalObject = drivenPhysicalObject;
        /**
         * An associative array containing the burn level and nozzles associated
         * with each thruster use command.
         * @name Propulsion#_thrusterUses
         * @type Object
         */
        this._thrusterUses = {
            "forward": {burn: 0, thrusters: []},
            "reverse": {burn: 0, thrusters: []},
            "strafeLeft": {burn: 0, thrusters: []},
            "strafeRight": {burn: 0, thrusters: []},
            "raise": {burn: 0, thrusters: []},
            "lower": {burn: 0, thrusters: []},
            "yawLeft": {burn: 0, thrusters: []},
            "yawRight": {burn: 0, thrusters: []},
            "pitchUp": {burn: 0, thrusters: []},
            "pitchDown": {burn: 0, thrusters: []},
            "rollLeft": {burn: 0, thrusters: []},
            "rollRight": {burn: 0, thrusters: []}
        };
    }
    /**
     * Returns the thrust power of this propulsion system, in newtowns.
     * @returns {Number}
     */
    Propulsion.prototype.getThrust = function () {
        return this._class.thrust;
    };
    /**
     * Returns the angular thrust power of this propulsion system, measured in
     * kg*rad/s^2.
     * @returns {Number}
     */
    Propulsion.prototype.getAngularThrust = function () {
        return this._class.angularThrust;
    };
    /**
     * Creates and adds thruster objects to all the thruster slots in the passed
     * array
     * @param {ThrusterSlot[]} slots
     */
    Propulsion.prototype.addThrusters = function (slots) {
        for (var i = 0; i < slots.length; i++) {
            var thruster = new Thruster(slots[i]);
            for (var j = 0; j < slots[i].uses.length; j++) {
                this._thrusterUses[slots[i].uses[j]].thrusters.push(thruster);
            }
        }
    };
    /**
     * Adds all necessary renderable objects under the passed parent node that
     * can be used to render the propulsion system (and its thrusters).
     * @param {RenderableNode} parentNode
     */
    Propulsion.prototype.addToScene = function (parentNode) {
        for (var use in this._thrusterUses) {
            for (var i = 0; i < this._thrusterUses[use].thrusters.length; i++) {
                this._thrusterUses[use].thrusters[i].addToScene(parentNode, this._class.thrusterBurnParticle);
            }
        }
    };
    /**
     * Return the currently set thruster burn level corresponding to the thrusters
     * of the passed use command. (e.g. "forward")
     * @param {String} use
     * @returns {Number}
     */
    Propulsion.prototype.getThrusterBurn = function (use) {
        return this._thrusterUses[use].burn;
    };
    /**
     * Adds to the thruster burn level corresponding to the thrusters of the passed 
     * use command.
     * @param {String} use The use identifying which thrusters' level to increase. 
     * e.g. "forward" or "yawLeft"
     * @param {Number} value The amount added to the thruster burn level.
     */
    Propulsion.prototype.addThrusterBurn = function (use, value) {
        this._thrusterUses[use].burn += value;
        for (var i = 0; i < this._thrusterUses[use].thrusters.length; i++) {
            this._thrusterUses[use].thrusters[i].addBurn(value);
        }
    };
    /**
     * Resets the all the thruster burn levels to zero.
     */
    Propulsion.prototype.resetThrusterBurn = function () {
        for (var use in this._thrusterUses) {
            this._thrusterUses[use].burn = 0;
            for (var i = 0; i < this._thrusterUses[use].thrusters.length; i++) {
                this._thrusterUses[use].thrusters[i].resetBurn();
            }
        }
    };
    /**
     * Applies the forces and torques that are created by this propulsion system
     * to the physical object it drives.
     */
    Propulsion.prototype.simulate = function () {
        var directionVector = Mat.getRowB4(this._drivenPhysicalObject.getOrientationMatrix());
        var yawAxis = Mat.getRowC4(this._drivenPhysicalObject.getOrientationMatrix());
        var pitchAxis = Mat.getRowA4(this._drivenPhysicalObject.getOrientationMatrix());
        if (this._thrusterUses["forward"].burn > 0) {
            this._drivenPhysicalObject.addOrRenewForce("forwardThrust", 2 * this._class.thrust * this._thrusterUses["forward"].burn, directionVector, timeBurstLength);
        }
        if (this._thrusterUses["reverse"].burn > 0) {
            this._drivenPhysicalObject.addOrRenewForce("reverseThrust", -2 * this._class.thrust * this._thrusterUses["reverse"].burn, directionVector, timeBurstLength);
        }
        if (this._thrusterUses["strafeRight"].burn > 0) {
            this._drivenPhysicalObject.addOrRenewForce("strafeRightThrust", 2 * this._class.thrust * this._thrusterUses["strafeRight"].burn, pitchAxis, timeBurstLength);
        }
        if (this._thrusterUses["strafeLeft"].burn > 0) {
            this._drivenPhysicalObject.addOrRenewForce("strafeLeftThrust", -2 * this._class.thrust * this._thrusterUses["strafeLeft"].burn, pitchAxis, timeBurstLength);
        }
        if (this._thrusterUses["raise"].burn > 0) {
            this._drivenPhysicalObject.addOrRenewForce("raiseThrust", 2 * this._class.thrust * this._thrusterUses["raise"].burn, yawAxis, timeBurstLength);
        }
        if (this._thrusterUses["lower"].burn > 0) {
            this._drivenPhysicalObject.addOrRenewForce("lowerThrust", -2 * this._class.thrust * this._thrusterUses["lower"].burn, yawAxis, timeBurstLength);
        }
        if (this._thrusterUses["yawRight"].burn > 0) {
            this._drivenPhysicalObject.addOrRenewTorque("yawRightThrust", 2 * this._class.angularThrust * this._thrusterUses["yawRight"].burn, yawAxis, timeBurstLength);
        }
        if (this._thrusterUses["yawLeft"].burn > 0) {
            this._drivenPhysicalObject.addOrRenewTorque("yawLeftThrust", -2 * this._class.angularThrust * this._thrusterUses["yawLeft"].burn, yawAxis, timeBurstLength);
        }
        if (this._thrusterUses["pitchUp"].burn > 0) {
            this._drivenPhysicalObject.addOrRenewTorque("pitchUpThrust", -2 * this._class.angularThrust * this._thrusterUses["pitchUp"].burn, pitchAxis, timeBurstLength);
        }
        if (this._thrusterUses["pitchDown"].burn > 0) {
            this._drivenPhysicalObject.addOrRenewTorque("pitchDownThrust", 2 * this._class.angularThrust * this._thrusterUses["pitchDown"].burn, pitchAxis, timeBurstLength);
        }
        if (this._thrusterUses["rollRight"].burn > 0) {
            this._drivenPhysicalObject.addOrRenewTorque("rollRightThrust", -2 * this._class.angularThrust * this._thrusterUses["rollRight"].burn, directionVector, timeBurstLength);
        }
        if (this._thrusterUses["rollLeft"].burn > 0) {
            this._drivenPhysicalObject.addOrRenewTorque("rollLeftThrust", 2 * this._class.angularThrust * this._thrusterUses["rollLeft"].burn, directionVector, timeBurstLength);
        }
    };
    /**
     * @class A class that can translate higher level maneuvering commands given to
     * a spacecraft (by user input or an AI) to low level thruster commands.
     * @param {Spacecraft} spacecraft The spacecraft the thrusters of which this
     * computer controls.
     * @returns {ManeuveringComputer}
     */
    function ManeuveringComputer(spacecraft) {
        /**
         * The spacecraft the thrusters of which this computer controls.
         * @name ManeuveringComputer#_spacecraft
         * @type Spacecraft
         */
        this._spacecraft = spacecraft;
        /**
         * Whether automatic inertia (drift) compensation is turned on.
         * @name ManeuveringComputer#_compensated
         * @type Boolean
         */
        this._compensated = true;
        /**
         * Whether automatic turning restriction is turned on.
         * @name ManeuveringComputer#_restricted
         * @type Boolean
         */
        this._restricted = false;
        /**
         * The target angle in radian between the identity orientation and the
         * relative angular velocity matrix on the yawing (XY) plane. The computer
         * will use the yawing thursters to reach this angle.
         * (representing rad/5ms turn)
         * @name ManeuveringComputer#_yawTarget
         * @type Number
         */
        this._yawTarget = 0;
        /**
         * The target angle in radian between the identity orientation and the
         * relative angular velocity matrix on the pitching (YZ) plane. The computer
         * will use the pitching thursters to reach this angle.
         * (representing rad/5ms turn)
         * @name ManeuveringComputer#_pitchTarget
         * @type Number
         */
        this._pitchTarget = 0;
        /**
         * The target angle in radian between the identity orientation and the
         * relative angular velocity matrix on the rolling (XZ) plane. The computer
         * will use the rolling thursters to reach this angle. 
         * (representing rad/5ms turn)
         * @name ManeuveringComputer#_rollTarget
         * @type Number
         */
        this._rollTarget = 0;
        /**
         * The target speed along the Y axis (in model space). The computer will
         * use forward and reverse thrusters to reach this speed if interia
         * compensation is turned on. (in m/s)
         * @name ManeuveringComputer#_speedTarget
         * @type Number
         */
        this._speedTarget = 0;
        /**
         * The target speed along the X axis (in model space). The computer will
         * use left and right thrusters to reach this speed if interia
         * compensation is turned on. (in m/s)
         * @name ManeuveringComputer#_strafeTarget
         * @type Number
         */
        this._strafeTarget = 0;
        /**
         * The target speed along the Z axis (in model space). The computer will
         * use dorsal and lateral thrusters to reach this speed if interia
         * compensation is turned on. (in m/s)
         * @name ManeuveringComputer#_liftTarget
         * @type Number
         */
        this._liftTarget = 0;
        /**
         * How much speed should be added to the target when the pilot accelerates
         * continuously for one second, in m/s.
         * @name ManeuveringComputer#_speedIncrementPerSecond
         * @type Number
         */
        this._speedIncrementPerSecond = 50;
        /**
         * How much speed should be added to the target in one control step when
         * the pilot is using continuous acceleration. (in m/s)
         * @name ManeuveringComputer#_speedIncrement
         * @type Number
         */
        this._speedIncrement = 1;
        /**
         * The maximum angle between vectors of the relative angular acceleration 
         * matrix and the identity axes on each 2D plane (yaw, pitch, roll)
         * (representing rad/5ms turn)
         * @name ManeuveringComputer#_turningLimit
         * @type Number
         */
        this._turningLimit = null;
        this.updateSpeedIncrementPerSecond();
        this.updateTurningLimit();
    }
    /**
     * Updates the speed increment per second to how much the ship can accelerate 
     * in one second with the current propulsion system.
     */
    ManeuveringComputer.prototype.updateSpeedIncrementPerSecond = function () {
        this._speedIncrementPerSecond = this._spacecraft.getMaxAcceleration() || 50;
    };
    /**
     * Updates the calculated speed increment according to how much time has
     * elapsed since the last control step.
     * @param {Number} dt The elapsed time since the last control step.
     */
    ManeuveringComputer.prototype.updateSpeedIncrement = function (dt) {
        this._speedIncrement = dt * this._speedIncrementPerSecond / 1000;
    };
    /**
     * Updates the turning limit to how much the ship can accelerate its
     * turning to in one second with the current propulsion system.
     */
    ManeuveringComputer.prototype.updateTurningLimit = function () {
        this._turningLimit = this._spacecraft.getMaxAngularAcceleration() / 200;
    };
    /**
     * Returns a string representation of the current flight mode.
     * (free / compensated / restricted)
     * @returns {String}
     */
    ManeuveringComputer.prototype.getFlightMode = function () {
        return this._compensated ?
                (this._restricted ? "restricted" : "compensated") : "free";
    };
    /**
     * Switches to the next flight mode. (free / compensated / restricted)
     */
    ManeuveringComputer.prototype.changeFlightMode = function () {
        if (!this._compensated) {
            this._compensated = true;
            this._speedTarget = Mat.translationLength(this._spacecraft.getVelocityMatrix());
        } else if (!this._restricted) {
            this._restricted = true;
        } else {
            this._compensated = false;
            this._restricted = false;
        }
    };
    /**
     * Increases the target speed or sets it to maximum in free mode.
     * @param {Number} [intensity] If given, the speed will be increased by this
     * value instead of the regular continuous increment.
     */
    ManeuveringComputer.prototype.forward = function (intensity) {
        this._compensated ?
                this._speedTarget += (intensity || this._speedIncrement) :
                this._speedTarget = Number.MAX_VALUE;
    };
    /**
     * Sets the target speed to the current speed if it is bigger. Only works 
     * in free flight mode.
     */
    ManeuveringComputer.prototype.stopForward = function () {
        if (!this._compensated) {
            var speed = this._spacecraft.getRelativeVelocityMatrix()[13];
            (this._speedTarget > speed) && (this._speedTarget = speed);
        }
    };
    /**
     * Decreases the target speed or sets it to negative maximum in free mode.
     * @param {Number} [intensity] If given, the speed will be decreased by this
     * value instead of the regular continuous increment.
     */
    ManeuveringComputer.prototype.reverse = function (intensity) {
        this._compensated ?
                this._speedTarget -= (intensity || this._speedIncrement) :
                this._speedTarget = -Number.MAX_VALUE;
    };
    /**
     * Sets the target speed to the current speed if it is smaller. Only works 
     * in free flight mode.
     */
    ManeuveringComputer.prototype.stopReverse = function () {
        if (!this._compensated) {
            var speed = this._spacecraft.getRelativeVelocityMatrix()[13];
            (this._speedTarget < speed) && (this._speedTarget = speed);
        }
    };
    /**
     * Sets the target speed for strafing to the left to intensity, or if not
     * given, to maximum. This target is reset to zero in each control step after 
     * the thrusters have been ignited accoringly.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.strafeLeft = function (intensity) {
        intensity ?
                this._strafeTarget = -intensity :
                this._strafeTarget = -Number.MAX_VALUE;
    };
    /**
     * Sets the target speed for strafing to zero, if was set to a speed to the
     * left.
     */
    ManeuveringComputer.prototype.stopLeftStrafe = function () {
        (this._strafeTarget < 0) && (this._strafeTarget = 0);
    };
    /**
     * Sets the target speed for strafing to the right to intensity, or if not
     * given, to maximum. This target is reset to zero in each control step after 
     * the thrusters have been ignited accoringly.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.strafeRight = function (intensity) {
        intensity ?
                this._strafeTarget = intensity :
                this._strafeTarget = Number.MAX_VALUE;
    };
    /**
     * Sets the target speed for strafing to zero, if was set to a speed to the
     * right.
     */
    ManeuveringComputer.prototype.stopRightStrafe = function () {
        (this._strafeTarget > 0) && (this._strafeTarget = 0);
    };
    /**
     * Sets the target speed for lifting downwards to intensity, or if not
     * given, to maximum. This target is reset to zero in each control step after 
     * the thrusters have been ignited accoringly.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.lower = function (intensity) {
        intensity ?
                this._liftTarget = -intensity :
                this._liftTarget = -Number.MAX_VALUE;
    };
    /**
     * Sets the target speed for lifting to zero, if was set to a speed to lift
     * downwards
     */
    ManeuveringComputer.prototype.stopLower = function () {
        (this._liftTarget < 0) && (this._liftTarget = 0);
    };
    /**
     * Sets the target speed for lifting upwards to intensity, or if not
     * given, to maximum. This target is reset to zero in each control step after 
     * the thrusters have been ignited accoringly.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.raise = function (intensity) {
        intensity ?
                this._liftTarget = intensity :
                this._liftTarget = Number.MAX_VALUE;
    };
    /**
     * Sets the target speed for strafing to zero, if was set to a speed to lift
     * upwards.
     */
    ManeuveringComputer.prototype.stopRaise = function () {
        (this._liftTarget > 0) && (this._liftTarget = 0);
    };
    /**
     * Resets the target (forward/reverse) speed to zero. (except in free flight 
     * mode)
     */
    ManeuveringComputer.prototype.resetSpeed = function () {
        this._compensated && (this._speedTarget = 0);
    };
    /**
     * Sets the target angular velocity to yaw to the left with intensity (maxed
     * out at the turning limit), or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.yawLeft = function (intensity) {
        // if no intensity was given for the turn, turn with maximum power (mouse or
        // joystick control can have fine intensity control, while with keyboard,
        // when the key is pressed, we just call this without parameter)
        if ((intensity === null) || (intensity === undefined)) {
            this._yawTarget = -this._turningLimit;
            // if a specific intensity was set, set the target to it, capping it out at
            // the maximum allowed turning speed
        } else if (intensity > 0) {
            this._yawTarget = -Math.min(intensity, this._turningLimit);
            // if a zero or negative intensity was given, set the target to zero,
            // but only if it is set to turn to left
        } else if (this._yawTarget < 0) {
            this._yawTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to yaw to the right with intensity (maxed
     * out at the turning limit), or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.yawRight = function (intensity) {
        if ((intensity === null) || (intensity === undefined)) {
            this._yawTarget = this._turningLimit;
        } else if (intensity > 0) {
            this._yawTarget = Math.min(intensity, this._turningLimit);
        } else if (this._yawTarget > 0) {
            this._yawTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to pitch down with intensity (maxed
     * out at the turning limit), or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.pitchDown = function (intensity) {
        if ((intensity === null) || (intensity === undefined)) {
            this._pitchTarget = -this._turningLimit;
        } else if (intensity > 0) {
            this._pitchTarget = -Math.min(intensity, this._turningLimit);
        } else if (this._pitchTarget < 0) {
            this._pitchTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to pitch up with intensity (maxed
     * out at the turning limit), or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.pitchUp = function (intensity) {
        if ((intensity === null) || (intensity === undefined)) {
            this._pitchTarget = this._turningLimit;
        } else if (intensity > 0) {
            this._pitchTarget = Math.min(intensity, this._turningLimit);
        } else if (this._pitchTarget > 0) {
            this._pitchTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to roll to the left with intensity (maxed
     * out at the turning limit), or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.rollLeft = function (intensity) {
        if ((intensity === null) || (intensity === undefined)) {
            this._rollTarget = -this._turningLimit;
        } else if (intensity > 0) {
            this._rollTarget = -Math.min(intensity, this._turningLimit);
        } else if (this._rollTarget < 0) {
            this._rollTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to roll to the right with intensity (maxed
     * out at the turning limit), or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.rollRight = function (intensity) {
        if ((intensity === null) || (intensity === undefined)) {
            this._rollTarget = this._turningLimit;
        } else if (intensity > 0) {
            this._rollTarget = Math.min(intensity, this._turningLimit);
        } else if (this._rollTarget > 0) {
            this._rollTarget = 0;
        }
    };
    /**
     * Sets the burn levels of all the thrusters of the ship according to the
     * current flight mode, flight parameters and control actions issued by the 
     * pilot.
     */
    ManeuveringComputer.prototype.controlThrusters = function () {
        // we will add the needed burn levels together, so start from zero
        this._spacecraft.resetThrusterBurn();
        // grab flight parameters for velocity control
        var relativeVelocityMatrix = this._spacecraft.getRelativeVelocityMatrix();
        var speed = relativeVelocityMatrix[13];
        var speedThreshold = 0.01;
        // grab flight parameters for turning control
        var turningMatrix = this._spacecraft.getTurningMatrix();
        var turnThreshold = 0.00002;
        // cash possibly restricted turn parameters (in rad/5ms)
        var turningLimit = this._turningLimit;
        var yawTarget = this._yawTarget;
        var pitchTarget = this._pitchTarget;
        // restrict turning according to current speed in restricted mode
        if (this._restricted && (speed !== 0.0)) {
            // restrict the limit if needed (convert from rad/sec to rad/5ms)
            turningLimit = Math.min(turningLimit, this._spacecraft.getMaxTurnRateAtSpeed(speed) / 200);
            //apply the restricted limit
            yawTarget = Math.min(Math.max(yawTarget, -turningLimit), turningLimit);
            pitchTarget = Math.min(Math.max(pitchTarget, -turningLimit), turningLimit);
        }
        // controlling yaw
        var yawAngle = Math.sign(turningMatrix[4]) * Vec.angle2u([0, 1], Vec.normal2([turningMatrix[4], turningMatrix[5]]));
        if ((yawTarget - yawAngle) > turnThreshold) {
            this._spacecraft.addThrusterBurn("yawRight",
                    Math.min(0.5, this._spacecraft.getNeededBurnForAngularVelocityChange(yawTarget - yawAngle)));
        } else if ((yawTarget - yawAngle) < -turnThreshold) {
            this._spacecraft.addThrusterBurn("yawLeft",
                    Math.min(0.5, this._spacecraft.getNeededBurnForAngularVelocityChange(yawAngle - yawTarget)));
        }
        // controlling pitch
        var pitchAngle = Math.sign(turningMatrix[6]) * Vec.angle2u([1, 0], Vec.normal2([turningMatrix[5], turningMatrix[6]]));
        if ((pitchTarget - pitchAngle) > turnThreshold) {
            this._spacecraft.addThrusterBurn("pitchUp",
                    Math.min(0.5, this._spacecraft.getNeededBurnForAngularVelocityChange(pitchTarget - pitchAngle)));
        } else if ((pitchTarget - pitchAngle) < -turnThreshold) {
            this._spacecraft.addThrusterBurn("pitchDown",
                    Math.min(0.5, this._spacecraft.getNeededBurnForAngularVelocityChange(pitchAngle - pitchTarget)));
        }
        // controlling roll
        var rollAngle = Math.sign(-turningMatrix[2]) * Vec.angle2u([1, 0], Vec.normal2([turningMatrix[0], turningMatrix[2]]));
        if ((this._rollTarget - rollAngle) > turnThreshold) {
            this._spacecraft.addThrusterBurn("rollRight",
                    Math.min(0.5, this._spacecraft.getNeededBurnForAngularVelocityChange(this._rollTarget - rollAngle)));
        } else if ((this._rollTarget - rollAngle) < -turnThreshold) {
            this._spacecraft.addThrusterBurn("rollLeft",
                    Math.min(0.5, this._spacecraft.getNeededBurnForAngularVelocityChange(rollAngle - this._rollTarget)));
        }
        // controlling forward/reverse
        if ((this._speedTarget - speed) > speedThreshold) {
            this._spacecraft.addThrusterBurn("forward",
                    Math.min(0.5, this._spacecraft.getNeededBurnForSpeedChange(this._speedTarget - speed)));
        } else if ((this._speedTarget - speed) < -speedThreshold) {
            this._spacecraft.addThrusterBurn("reverse",
                    Math.min(0.5, this._spacecraft.getNeededBurnForSpeedChange(speed - this._speedTarget)));
        }
        // controlling horizontal drift
        if (this._compensated || (this._strafeTarget !== 0)) {
            speed = relativeVelocityMatrix[12];
            if ((this._strafeTarget - speed) > speedThreshold) {
                this._spacecraft.addThrusterBurn("strafeRight",
                        Math.min(0.5, this._spacecraft.getNeededBurnForSpeedChange(this._strafeTarget - speed)));
            } else if ((this._strafeTarget - speed) < -speedThreshold) {
                this._spacecraft.addThrusterBurn("strafeLeft",
                        Math.min(0.5, this._spacecraft.getNeededBurnForSpeedChange(speed - this._strafeTarget)));
            }
        }
        // controlling vertical drift
        if (this._compensated || (this._liftTarget !== 0)) {
            speed = relativeVelocityMatrix[14];
            if ((this._liftTarget - speed) > speedThreshold) {
                this._spacecraft.addThrusterBurn("raise",
                        Math.min(0.5, this._spacecraft.getNeededBurnForSpeedChange(this._liftTarget - speed)));
            } else if ((this._liftTarget - speed) < -speedThreshold) {
                this._spacecraft.addThrusterBurn("lower",
                        Math.min(0.5, this._spacecraft.getNeededBurnForSpeedChange(speed - this._liftTarget)));
            }
        }
        // reset the targets, as new controls are needed from the pilot in the
        // next step to keep these targets up (e.g. continuously pressing the
        // key, moving the mouse or keeping the mouse displaced from center)
        this._yawTarget = 0;
        this._pitchTarget = 0;
        this._rollTarget = 0;
        this._strafeTarget = 0;
        this._liftTarget = 0;
    };
    // #########################################################################
    /**
     * @class Represents a specific spacecraft (fighter, warship, freighter, space
     * station etc.) in the game.
     * @param {SpacecraftClass} spacecraftClass The class of the spacecraft that
     * describes its general properties.
     * @param {Float32Array} [positionMatrix] The translation matrix describing
     * the initial position of the spacecraft.
     * @param {Float32Array} [orientationMatrix] The rotation matrix describing
     * the initial orientation of the spacecraft.
     * @param {Projectile[]} [projectileArray=null] The array to which the
     * spacecraft will add its fired projectiles.
     * @param {String} [equipmentProfileName] The name of the equipment profile
     * to use to equip the spacecraft. If not given, the spacecraft will not be
     * equipped.
     * @returns {Spacecraft}
     */
    function Spacecraft(spacecraftClass, positionMatrix, orientationMatrix, projectileArray, equipmentProfileName) {
        /**
         * The class of this spacecraft that describes its general properties.
         * @name Spacecraft#_class
         * @type SpacecraftClass
         */
        this._class = null;
        /**
         * The renderable node that represents this spacecraft in a scene.
         * @name Spacecraft#_visualModel
         * @type ParameterizedMesh
         */
        this._visualModel = null;
        /**
         * The object representing the physical properties of this spacecraft.
         * Used to calculate the movement and rotation of the craft as well as
         * check for collisions and hits.
         * @name Spacecraft#_physicalModel
         * @type PhysicalObject
         */
        this._physicalModel = null;
        /**
         * The list of weapons this spacecraft is equipped with.
         * @name Spacecraft#_weapons
         * @type Weapon[]
         */
        this._weapons = null;
        /**
         * The propulsion system this spacecraft is equipped with.
         * @name Spacecraft#_propulsion
         * @type Propulsion
         */
        this._propulsion = null;
        /**
         * The maneuvering computer of this spacecraft that translates high
         * level maneuvering commands issued to this craft into thruster control.
         * @name Spacecraft#_maneuveringComputer
         * @type ManeuveringComputer
         */
        this._maneuveringComputer = null;
        /**
         * The renderable object that is used as the parent for the visual
         * representation of the hitboxes of this craft.
         * @name Spacecraft#_hitbox
         * @type RenderableObject
         */
        this._hitbox = null;
        /**
         * The array to which the spacecraft will add its fired projectiles.
         * @name Spacecraft#_projectileArray
         * @type Projectile[]
         */
        this._projectileArray = null;
        // initializing the properties based on the parameters
        if (spacecraftClass) {
            this._init(spacecraftClass, positionMatrix, orientationMatrix, projectileArray, equipmentProfileName);
        }
    }
    // #########################################################################
    // initializer
    /**
     * Initializes the properties of the spacecraft. Used by the constructor
     * and the methods that load the data from an external source.
     * @param {SpacecraftClass} spacecraftClass
     * @param {Float32Array} [positionMatrix]
     * @param {Float32Array} [orientationMatrix]
     * @param {Projectile[]} [projectileArray]
     * @param {String} [equipmentProfileName]
     * @see Spacecraft
     */
    Spacecraft.prototype._init = function (spacecraftClass, positionMatrix, orientationMatrix, projectileArray, equipmentProfileName) {
        this._class = spacecraftClass;
        this._physicalModel = new Physics.PhysicalObject(
                this._class.mass,
                positionMatrix || Mat.identity4(),
                orientationMatrix || Mat.identity4(),
                Mat.scaling4(this._class.modelSize),
                Mat.identity4(),
                this._class.bodies);
        this._weapons = new Array();
        this._maneuveringComputer = new ManeuveringComputer(this);
        this._projectileArray = projectileArray || null;
        // equipping the craft if a profile name was given
        if (equipmentProfileName !== undefined) {
            this.equipProfile(this._class.equipmentProfiles[equipmentProfileName]);
        }
    };
    // #########################################################################
    // direct getters and setters
    /**
     * Returns the object describing class of this spacecraft.
     * @returns {SpacecraftClass}
     */
    Spacecraft.prototype.getClass = function () {
        return this._class;
    };
    /**
     * Returns the renderable object that represents this spacecraft in a scene.
     * @returns {RenderableObject}
     */
    Spacecraft.prototype.getVisualModel = function () {
        return this._visualModel;
    };
    /**
     * Returns the object used for the physics simulation of this spacecraft.
     * @returns {PhysicalObject}
     */
    Spacecraft.prototype.getPhysicalModel = function () {
        return this._physicalModel;
    };
    // #########################################################################
    // indirect getters and setters
    /**
     * Returns the name of the class of this spacecraft. (e.g. Falcon or Aries)
     * @returns {String}
     */
    Spacecraft.prototype.getClassName = function () {
        return this._class.fullName;
    };
    /**
     * Returns the name of the type of this spacecraft. (e.g. Interceptor or
     * Corvette)
     * @returns {String}
     */
    Spacecraft.prototype.getTypeName = function () {
        return this._class.spacecraftType.fullName;
    };
    /**
     * Returns whether this spacecraft object can be reused to represent a new
     * spacecraft.
     * @returns {Boolean}
     */
    Spacecraft.prototype.canBeReused = function () {
        return false;
    };
    /**
     * Returns the 4x4 translation matrix describing the position of this 
     * spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getPositionMatrix = function () {
        return this._physicalModel.getPositionMatrix();
    };
    /**
     * Returns the 4x4 rotation matrix describing the orientation of this 
     * spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getOrientationMatrix = function () {
        return this._physicalModel.getOrientationMatrix();
    };
    /**
     * Returns the 4x4 scaling matrix describing the scaling of the meshes and
     * physical model representing this spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getScalingMatrix = function () {
        return this._physicalModel.getScalingMatrix();
    };
    /**
     * Returns the 4x4 translation matrix describing the current velocity of this
     * spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getVelocityMatrix = function () {
        return this._physicalModel.getVelocityMatrix();
    };
    /**
     * Returns the 4x4 translation matrix describing the current velocity of this
     * spacecraft in relative (model) space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getRelativeVelocityMatrix = function () {
        return Mat.mul4(
                this._physicalModel.getVelocityMatrix(),
                Mat.matrix4from3(Mat.matrix3from4(this._physicalModel.getRotationMatrixInverse())));
    };
    /**
     * Returns the 4x4 rotation matrix describing the current rotation of this
     * spacecraft in relative (model) space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getTurningMatrix = function () {
        return Mat.mul4(
                Mat.mul4(
                        this._physicalModel.getOrientationMatrix(),
                        this._physicalModel.getAngularVelocityMatrix()),
                Mat.matrix4from3(Mat.matrix3from4(this._physicalModel.getRotationMatrixInverse())));
    };
    /**
     * Returns the maximum acceleration the spacecraft can achieve using its
     * currently equipped propulsion system.
     * @returns {Number|null} The acceleration, in m/s^2. Null, if no propulsion
     * is equipped.
     */
    Spacecraft.prototype.getMaxAcceleration = function () {
        return this._propulsion ?
                this._propulsion.getThrust() / this._physicalModel.getMass() :
                null;
    };
    /**
     * Returns the maximum angular acceleration the spacecraft can achieve using
     * its currently equipped propulsion system.
     * @returns {Number|null} The angular acceleration, in rad/s^2. Null, if
     * no propulsion is equipped.
     */
    Spacecraft.prototype.getMaxAngularAcceleration = function () {
        return this._propulsion ?
                this._propulsion.getAngularThrust() / this._physicalModel.getMass() :
                null;
    };
    /**
     * Returns the maximum turning rate the spacecraft can keep at the passed
     * speed while providing the needed centripetal force with its thrusters
     * to keep itself on a circular path.
     * @param {Number} speed The speed in m/s.
     * @returns {Number} Thre turning rate in rad/s.
     */
    Spacecraft.prototype.getMaxTurnRateAtSpeed = function (speed) {
        return Math.abs(this._propulsion.getThrust() / (this._physicalModel.getMass() * speed));
    };
    /**
     * Returns an associative array containing the texture resources that this
     * spacecraft uses for rendering, organized by the texture roles (types),
     * e.g. "specular".
     * @returns {Object}
     */
    Spacecraft.prototype.getTextures = function () {
        var result = new Object();
        for (var textureType in this._class.textureDescriptors) {
            result[textureType] = Armada.resources().getOrAddTextureFromDescriptor(this._class.textureDescriptors[textureType]);
        }
        return result;
    };
    /**
     * Returns the thruster burn level that is needed to produce the passed
     * difference in speed using the current propulsion system.
     * @param {Number} speedDifference The speed different that needs to be produced,
     * in m/s.
     * @returns {Number}
     */
    Spacecraft.prototype.getNeededBurnForSpeedChange = function (speedDifference) {
        // division by 2 because the full thrust is produced at 0.5 burn level
        // (full burn level is for both turning and accelerating)
        // final division because one burst of thrust lasts for a small fraction
        // of a second, while the basic calculation gives the needed thrust for
        // one second (as units of measurement are SI aligned)
        return speedDifference * this._physicalModel.getMass() / this._propulsion.getThrust() / 2 / (timeBurstLength / 1000);
    };
    /**
     * Returns the thruster burn level that is needed to produce the passed 
     * difference in angular velocity using the current propulsion system.
     * @param {Number} angularVelocityDifference The angular velocity difference
     * that needs to be produced, in rad/5ms !!.
     * @returns {Number}
     */
    Spacecraft.prototype.getNeededBurnForAngularVelocityChange = function (angularVelocityDifference) {
        // multiply by 200 to convert given difference from rad/5ms to rad/s
        // division by 2 because the full angular thrust is produced at 0.5 burn level
        // (full burn level is for both turning and accelerating) 
        // final division because one burst of thrust lasts for a small fraction
        // of a second, while the basic calculation gives the needed thrust for
        // one second (as units of measurement are SI aligned)
        return angularVelocityDifference * 200 * this._physicalModel.getMass() / this._propulsion.getAngularThrust() / 2 / (timeBurstLength / 1000);
    };
    // #########################################################################
    // methods
    /**
     * Initializes the properties of this spacecraft based on the data stored
     * in the passed XML tag.
     * @param {Element} xmlTag
     * @param {Projectile[]} [projectileArray=null] The array to which the
     * spacecraft will add its fired projectiles.
     */
    Spacecraft.prototype.loadFromXMLTag = function (xmlTag, projectileArray) {
        this._init(
                Armada.logic().getSpacecraftClass(xmlTag.getAttribute("class")),
                Mat.translationFromXMLTag(xmlTag.getElementsByTagName("position")[0]),
                Mat.rotation4FromXMLTags(xmlTag.getElementsByTagName("turn")),
                projectileArray);
        // equipping the created spacecraft
        // if there is an quipment tag...
        if (xmlTag.getElementsByTagName("equipment").length > 0) {
            var equipmentTag = xmlTag.getElementsByTagName("equipment")[0];
            // if a profile is referenced in the equipment tag, look up that profile 
            // and equip according to that
            if (equipmentTag.hasAttribute("profile")) {
                this.equipProfile(this._class.equipmentProfiles[equipmentTag.getAttribute("profile")]);
                // if no profile is referenced, simply create a custom profile from the tags inside
                // the equipment tag, and equip that
            } else {
                var equipmentProfile = new Classes.EquipmentProfile(equipmentTag);
                this.equipProfile(equipmentProfile);
            }
            // if there is no equipment tag, attempt to load the profile named "default"    
        } else if (this._class.equipmentProfiles["default"] !== undefined) {
            this.equipProfile(this._class.equipmentProfiles["default"]);
        }
    };
    /**
     * Returns a string representation of the current flight mode set for this
     * craft. (free / compensated / restricted)
     * @returns {String}
     */
    Spacecraft.prototype.getFlightMode = function () {
        return this._maneuveringComputer.getFlightMode();
    };
    /**
     * Switches to the next available flight mode.
     */
    Spacecraft.prototype.changeFlightMode = function () {
        this._maneuveringComputer.changeFlightMode();
    };
    /**
     * Control command for forward thrust for the maneuvering computer.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.forward = function (intensity) {
        this._maneuveringComputer.forward(intensity);
    };
    /**
     * Control command for stopping forward thrust for the maneuvering computer.
     */
    Spacecraft.prototype.stopForward = function () {
        this._maneuveringComputer.stopForward();
    };
    /**
     * Control command for reverse thrust for the maneuvering computer.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.reverse = function (intensity) {
        this._maneuveringComputer.reverse(intensity);
    };
    /**
     * Control command for stopping reverse thrust for the maneuvering computer.
     */
    Spacecraft.prototype.stopReverse = function () {
        this._maneuveringComputer.stopReverse();
    };
    /**
     * Control command for strafing to the left for the maneuvering computer.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.strafeLeft = function (intensity) {
        this._maneuveringComputer.strafeLeft(intensity);
    };
    /**
     * Control command for stopping strafing to the left for the maneuvering computer.
     */
    Spacecraft.prototype.stopLeftStrafe = function () {
        this._maneuveringComputer.stopLeftStrafe();
    };
    /**
     * Control command for strafing to the right for the maneuvering computer.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.strafeRight = function (intensity) {
        this._maneuveringComputer.strafeRight(intensity);
    };
    /**
     * Control command for stopping strafing to the right for the maneuvering computer.
     */
    Spacecraft.prototype.stopRightStrafe = function () {
        this._maneuveringComputer.stopRightStrafe();
    };
    /**
     * Control command for lifting upwards for the maneuvering computer.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.raise = function (intensity) {
        this._maneuveringComputer.raise(intensity);
    };
    /**
     * Control command for stopping lifting upwards for the maneuvering computer.
     */
    Spacecraft.prototype.stopRaise = function () {
        this._maneuveringComputer.stopRaise();
    };
    /**
     * Control command for lifting downwards for the maneuvering computer.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.lower = function (intensity) {
        this._maneuveringComputer.lower(intensity);
    };
    /**
     * Control command for stopping lifting downwards for the maneuvering computer.
     */
    Spacecraft.prototype.stopLower = function () {
        this._maneuveringComputer.stopLower();
    };
    /**
     * Control command for the maneuvering computer to reset the target speed to
     * zero.
     */
    Spacecraft.prototype.resetSpeed = function () {
        this._maneuveringComputer.resetSpeed();
    };
    /**
     * Control command for the maneuvering computer to yaw to the left.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.yawLeft = function (intensity) {
        this._maneuveringComputer.yawLeft(intensity);
    };
    /**
     * Control command for the maneuvering computer to yaw to the right.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.yawRight = function (intensity) {
        this._maneuveringComputer.yawRight(intensity);
    };
    /**
     * Control command for the maneuvering computer to pitch upwards.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.pitchUp = function (intensity) {
        this._maneuveringComputer.pitchUp(intensity);
    };
    /**
     * Control command for the maneuvering computer to pitch downwards.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.pitchDown = function (intensity) {
        this._maneuveringComputer.pitchDown(intensity);
    };
    /**
     * Control command for the maneuvering computer to roll to the left.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.rollLeft = function (intensity) {
        this._maneuveringComputer.rollLeft(intensity);
    };
    /**
     * Control command for the maneuvering computer to roll to the right.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.rollRight = function (intensity) {
        this._maneuveringComputer.rollRight(intensity);
    };
    /**
     * Adds a renderable object that represents the index'th body of the physical
     * model of this spacecraft.
     * @param {Number} index The index of the body to represent.
     */
    Spacecraft.prototype._addHitboxModel = function (index) {
        var phyModelWithLOD = new Scene.ModelWithLOD(
                Armada.resources().getOrAddModelByName(
                Egom.cuboidModel(
                        this._class.name + "-body" + index,
                        this._class.bodies[index].getWidth(),
                        this._class.bodies[index].getHeight(),
                        this._class.bodies[index].getDepth(),
                        [0.0, 1.0, 1.0, 0.5])),
                0);
        var hitZoneMesh = new Scene.Mesh(
                [phyModelWithLOD],
                Armada.resources().getShader(this._class.shaderName),
                {
                    color: Armada.resources().getOrAddTexture("textures/white.png"),
                    specular: Armada.resources().getOrAddTexture("textures/white.png"),
                    luminosity: Armada.resources().getOrAddTexture("textures/white.png")
                },
        Mat.translation4v(Mat.translationVector3(this._class.bodies[index].getPositionMatrix())),
                this._class.bodies[index].getOrientationMatrix(),
                Mat.identity4(),
                false);
        this._hitbox.addSubnode(new Scene.RenderableNode(hitZoneMesh));
    };
    /**
     * Creates and adds the renderable objects to represent this spacecraft to
     * the passed scene.
     * @param {Scene} scene The scene to which the objects will be added.
     * @param {Number} [lod] The level of detail to use for adding the models.
     * If not given, all available LODs will be added for dynamic LOD rendering.
     * @param {Boolean} [wireframe=false] Whether to add the models in wireframe
     * drawing mode (or in solid).
     * @param {Object} [addSupplements] An object describing what additional
     * supplementary objects / resources to add to the scene along with the
     * basic representation of the ship. Contains boolean properties for each
     * possible supplement, marking if that particular supplement should be 
     * added. Supported properties:
     * <ul>
     * <li>hitboxes</li>
     * <li>weapons</li>
     * <li>thursterParticles</li>
     * <li>projectileResources</li>
     * </ul>
     * @returns {ParameterizedMesh} The renderable object created to represent the 
     * spacecraft.
     */
    Spacecraft.prototype.addToScene = function (scene, lod, wireframe, addSupplements) {
        var i, j;
        var modelsWithLOD;
        // loading or setting models
        modelsWithLOD = new Array();
        // if no specific level of detail is given, load all that are within the global LOD load limit
        // if a specific LOD is given only load that one
        for (i = 0; i < this._class.modelReferences.length; i++) {
            if (((lod === undefined) && (Armada.graphics().getMaxLoadedLOD() >= this._class.modelReferences[i].lod)) ||
                    ((lod !== undefined) && (this._class.modelReferences[i].lod === lod))) {
                modelsWithLOD.push(new Scene.ModelWithLOD(
                        Armada.resources().getOrAddModelFromFile(this._class.modelReferences[i].filename),
                        this._class.modelReferences[i].lod
                        ));
            }
        }
        // cash the references to the textures
        var textures = this.getTextures();
        // add the main model of the spacecraft
        this._visualModel = new Scene.ParameterizedMesh(
                modelsWithLOD,
                Armada.resources().getShader(this._class.shaderName),
                textures,
                this._physicalModel.getPositionMatrix(),
                this._physicalModel.getOrientationMatrix(),
                Mat.scaling4(this._class.modelSize),
                (wireframe === true),
                [{name: "luminosityFactors", length: 20}]);
        var node = scene.addObject(this._visualModel);
        // visualize physical model (hitboxes)
        if ((addSupplements) && (addSupplements.hitboxes === true)) {
            // add the parent objects for the hitboxes
            this._hitbox = new Scene.RenderableNode(new Scene.RenderableObject(Armada.resources().getShader(this._class.shaderName), false, false));
            // add the models for the hitboxes themselves
            for (i = 0; i < this._class.bodies.length; i++) {
                this._addHitboxModel(i);
            }
            this._hitbox.hide();
            node.addSubnode(this._hitbox);
        }
        // add the weapons
        if ((addSupplements) && (addSupplements.weapons === true)) {
            for (i = 0; i < this._weapons.length; i++) {
                this._weapons[i].addToScene(node, lod, wireframe);
            }
        }
        // add the thruster particles
        if ((addSupplements) && (addSupplements.thrusterParticles === true)) {
            this._propulsion.addThrusters(this._class.thrusterSlots);
            this._propulsion.addToScene(node);
        }
        // add projectile resources
        if ((addSupplements) && (addSupplements.projectileResources === true)) {
            for (i = 0; i < this._weapons.length; i++) {
                this._weapons[i].addProjectileResourcesToScene(scene);
            }
        }
        return this._visualModel;
    };
    /**
     * Adds camera objects that correspond to the views defined for this 
     * spacecraft type and follow this specific spacecraft.
     * @param {Scene} scene The scene to add the cameras to.
     */
    Spacecraft.prototype.addCamerasForViews = function (scene) {
        for (var i = 0; i < this._class.views.length; i++) {
            scene.addCamera(this._class.views[i].createCameraForObject(scene.width / scene.height, this._visualModel));
        }
    };
    /**
     * Equips a weapon of the given class to the ship's next free weapon hard
     * point, if any are available.
     * @param {WeaponClass} weaponClass
     */
    Spacecraft.prototype.addWeapon = function (weaponClass) {
        if (this._weapons.length < this._class.weaponSlots.length) {
            var slot = this._class.weaponSlots[this._weapons.length];
            this._weapons.push(new Weapon(weaponClass, this, slot));
        }
    };
    /**
     * Equips a propulsion system of the given class to the ship, replacing the
     * previous propulsion system, if one was equipped.
     * @param {PropulsionClass} propulsionClass
     */
    Spacecraft.prototype.addPropulsion = function (propulsionClass) {
        this._propulsion = new Propulsion(propulsionClass, this._physicalModel);
        this._maneuveringComputer.updateSpeedIncrementPerSecond();
        this._maneuveringComputer.updateTurningLimit();
    };
    /**
     * Equips the spacecraft according to the specifications in the given equipment
     * profile.
     * @param {EquipmentProfile} equipmentProfile
     */
    Spacecraft.prototype.equipProfile = function (equipmentProfile) {
        var i;
        for (i = 0; i < equipmentProfile.getWeaponDescriptors().length; i++) {
            this.addWeapon(Armada.logic().getWeaponClass(equipmentProfile.getWeaponDescriptors()[i].className));
        }
        if (equipmentProfile.propulsionDescriptor !== null) {
            this.addPropulsion(Armada.logic().getPropulsionClass(equipmentProfile.getPropulsionDescriptor().className));
        }
    };
    /**
     * Fires all of the ship's weapons.
     */
    Spacecraft.prototype.fire = function () {
        for (var i = 0; i < this._weapons.length; i++) {
            this._weapons[i].fire(this._projectileArray);
        }
    };
    /**
     * Resets all the thruster burn levels of the spacecraft to zero.
     */
    Spacecraft.prototype.resetThrusterBurn = function () {
        this._propulsion.resetThrusterBurn();
    };
    /**
     * Adds to the current burn level to all thrusters that have the specified
     * use.
     * @param {String} use The use of the thrusters to add burn to (e.g. "forward")
     * @param {Number} value The value to add to the current burn level.
     */
    Spacecraft.prototype.addThrusterBurn = function (use, value) {
        this._propulsion.addThrusterBurn(use, value);
    };
    /**
     * Toggles the visibility of the models representing the hitboxes of this
     * spacecraft.
     */
    Spacecraft.prototype.toggleHitboxVisibility = function () {
        this._hitbox.toggleVisibility();
    };
    /**
     * Resets the parameters (position and orientation) of the cameras that 
     * correspond to the different views fixed on this spacecraft in the scene.
     */
    Spacecraft.prototype.resetViewCameras = function () {
        this._visualModel.getNode().resetViewCameras();
    };
    /**
     * Performs all the phyics and logic simulation of this spacecraft.
     * @param {Number} dt The elapsed time since the last simulation step, in
     * milliseconds.
     */
    Spacecraft.prototype.simulate = function (dt) {
        this._maneuveringComputer.controlThrusters();
        this._propulsion.simulate(dt);
        this._physicalModel.simulate(dt);
        this._visualModel.setPositionMatrix(this._physicalModel.getPositionMatrix());
        this._visualModel.setOrientationMatrix(this._physicalModel.getOrientationMatrix());
        this._maneuveringComputer.updateSpeedIncrement(dt);
    };
    // #########################################################################
    /**
     * @class Represents an environment that can be used to build a visual 
     * representation and perform the game logic on a virtual environment where 
     * the game takes place.
     * @param {Element} xmlTag If given, the data of the environment will be
     * initialized from this XML tag.
     * @returns {Environment}
     */
    function Environment(xmlTag) {
        /**
         * The list of skyboxes this environment contains as background.
         * @name Environment#_skyboxes
         * @type Skybox[]
         */
        this._skyboxes = null;
        /**
         * The list of background objects (stars, nebulae) this environment contains.
         * @name Environment#_backgroundObjects
         * @type BackgroundObject[]
         */
        this._backgroundObjects = null;
        /**
         * The list of dust clouds this environment contains.
         * @name Environment#_dustClouds
         * @type DustCloud[]
         */
        this._dustClouds = null;
        /**
         * The camera relative to which the environment is rendered.
         * @name Environment#_camera
         * @type Camera
         */
        this._camera = null;
        // if given, load the data from the XML tag
        xmlTag && this.loadFromXMLTag(xmlTag);
    }
    // #########################################################################
    // methods
    /**
     * Loads all the data about this environment stored in the passed XML tag.
     * @param {Element} xmlTag
     */
    Environment.prototype.loadFromXMLTag = function (xmlTag) {
        var i;
        this._skyboxes = new Array();
        var skyboxTags = xmlTag.getElementsByTagName("Skybox");
        for (i = 0; i < skyboxTags.length; i++) {
            this._skyboxes.push(new Skybox(Armada.logic().getSkyboxClass(skyboxTags[i].getAttribute("class"))));
        }

        this._backgroundObjects = new Array();
        var backgroundObjectTags = xmlTag.getElementsByTagName("BackgroundObject");
        for (i = 0; i < backgroundObjectTags.length; i++) {
            this._backgroundObjects.push(new BackgroundObject(
                    Armada.logic().getBackgroundObjectClass(backgroundObjectTags[i].getAttribute("class")),
                    backgroundObjectTags[i].getElementsByTagName("position")[0].getAttribute("angleAlpha"),
                    backgroundObjectTags[i].getElementsByTagName("position")[0].getAttribute("angleBeta")
                    ));
        }

        this._dustClouds = new Array();
        var dustCloudTags = xmlTag.getElementsByTagName("DustCloud");
        for (i = 0; i < dustCloudTags.length; i++) {
            this._dustClouds.push(new DustCloud(Armada.logic().getDustCloudClass(dustCloudTags[i].getAttribute("class"))));
        }
    };
    /**
     * Adds renderable objects representing all visual elements of the 
     * environment to the passed scene.
     * @param {Scene} scene
     */
    Environment.prototype.addToScene = function (scene) {
        var i;
        for (i = 0; i < this._skyboxes.length; i++) {
            this._skyboxes[i].addToScene(scene);
        }
        for (i = 0; i < this._backgroundObjects.length; i++) {
            this._backgroundObjects[i].addToScene(scene);
        }
        for (i = 0; i < this._dustClouds.length; i++) {
            this._dustClouds[i].addToScene(scene);
        }
        this._camera = scene.activeCamera;
    };
    /**
     * Performs a simulation step to update the state of the environment.
     */
    Environment.prototype.simulate = function () {
        for (var i = 0; i < this._dustClouds.length; i++) {
            this._dustClouds[i].simulate(this._camera);
        }
    };
    // #########################################################################
    /**
     * @class Represents a battle scene with an environment, spacecrafts, 
     * projectiles. Can create scenes for visual representation using the held
     * references as well as perform the game logic and physics simulation
     * among the contained objects.
     * @returns {Level}
     */
    function Level() {
        /**
         * Stores the attributes of the environment where this level is situated.
         * @name Level#_environment
         * @type Environment
         */
        this._environment = null;
        /**
         * The starting position of the camera if a scene is generated for this 
         * level.
         * @name Level#_cameraStartPositionMatrix
         * @type Float32Array
         */
        this._cameraStartPositionMatrix = null;
        /**
         * The starting orientation of the camera if a scene is generated for this 
         * level.
         * @name Level#_cameraStartOrientationMatrix
         * @type Float32Array
         */
        this._cameraStartOrientationMatrix = null;
        /**
         * The list of spacecrafts that are placed on the map of this level.
         * @name Level#_spacecrafts
         * @type Spacecraft[]
         */
        this._spacecrafts = null;
        /**
         * An array to store the projectiles fired by the spacecrafts.
         * @name Level#_projectiles
         * @type Projectile[]
         */
        this._projectiles = null;
        /**
         * The index of the spacecraft that is piloted by the player.
         * @name Level#_pilotedCraftIndex
         * @type Number
         */
        this._pilotedCraftIndex = null;
        /**
         * A list of references to all the physical objects that take part in
         * collision / hit check in this level to easily pass them to such
         * simulation methods.
         * @name Level#_hitObjects
         * @type PhysicalObject[]
         */
        this._hitObjects = null;
    }
    // #########################################################################
    // indirect getters and setters
    Level.prototype.getPilotedSpacecraft = function () {
        if (this._pilotedCraftIndex !== null) {
            return this._spacecrafts[this._pilotedCraftIndex];
        } else {
            return null;
        }
    };
    // #########################################################################
    // methods
    /**
     * Sends an asynchronous request to grab the file with the passed name from
     * the level folder and initializes the level data when the file has been
     * loaded.
     * @param {String} filename
     * @param {Function} [callback] An optional function to execute after the
     * level has been loaded.
     */
    Level.prototype.requestLoadFromFile = function (filename, callback) {
        var self = this;
        Application.requestXMLFile("level", filename, function (xmlDoc) {
            self.loadFromXML(xmlDoc);
            if (callback) {
                callback();
            }
        });
    };
    /**
     * Loads all the data describing this level from the passed XML document.
     * @param {Document} xmlDoc
     */
    Level.prototype.loadFromXML = function (xmlDoc) {
        Module.log("Loading level from XML file...", 2);

        this._environment = new Environment();
        var environmentTag = Application.getFirstXMLElement(xmlDoc, "Environment");
        if (environmentTag.hasAttribute("createFrom")) {
            this._environment = Armada.logic().getEnvironment(environmentTag.getAttribute("createFrom"));
        } else {
            this._environment.loadFromXMLTag(environmentTag);
        }

        this._cameraStartPositionMatrix = Mat.identity4();
        this._cameraStartOrientationMatrix = Mat.identity4();
        var cameraTags = xmlDoc.getElementsByTagName("Camera");
        if (cameraTags.length > 0) {
            if (cameraTags[0].getElementsByTagName("position").length > 0) {
                this._cameraStartPositionMatrix = Mat.translation4v(Vec.scaled3(Vec.fromXMLTag3(cameraTags[0].getElementsByTagName("position")[0]), -1));
            }
            if (cameraTags[0].getElementsByTagName("orientation").length > 0) {
                this._cameraStartOrientationMatrix = Mat.rotation4FromXMLTags(cameraTags[0].getElementsByTagName("orientation")[0].getElementsByTagName("turn"));
            }
        }

        this._projectiles = new Array();
        this._spacecrafts = new Array();
        var spacecraftTags = xmlDoc.getElementsByTagName("Spacecraft");
        for (var i = 0; i < spacecraftTags.length; i++) {
            var spacecraft = new Spacecraft();
            spacecraft.loadFromXMLTag(spacecraftTags[i], this._projectiles);
            if (spacecraftTags[i].getAttribute("piloted") === "true") {
                this._pilotedCraftIndex = i;
            }
            this._spacecrafts.push(spacecraft);
        }
        Module.log("Level successfully loaded.", 2);
    };
    /**
     * Adds spacecrafts to the level at random positions.
     * @param {Object} shipNumbersPerClass An associative array describing how
     * many ships of different classes to add. The keys are the class names, the
     * values are the number of ships to add.
     * @param {Number} mapSize The size (width, height and depth, all the same) 
     * of the area within to add the ships (centered at the origo)
     * @param {Float32Array} orientationMatrix The matrix describing the 
     * orientation of the added ships.
     * @param {Boolean} randomTurnAroundX Whether to randomly turn the placed
     * ships around the X axis of their orientation matrix.
     * @param {Boolean} randomTurnAroundY Whether to randomly turn the placed
     * ships around the Y axis of thier orientation matrix.
     * @param {Boolean} randomTurnAroundZ Whether to randomly turn the placed
     * ships around the Z axis of their orientation matrix.
     */
    Level.prototype.addRandomShips = function (shipNumbersPerClass, mapSize, orientationMatrix, randomTurnAroundX, randomTurnAroundY, randomTurnAroundZ) {
        for (var shipClass in shipNumbersPerClass) {
            for (var i = 0; i < shipNumbersPerClass[shipClass]; i++) {
                var orientation = orientationMatrix ?
                        Mat.matrix4(orientationMatrix) : Mat.identity4();
                if (randomTurnAroundZ) {
                    orientation = Mat.mul4(orientation, Mat.rotation4(Mat.getRowC4(orientation), Math.random() * Math.PI * 2));
                }
                if (randomTurnAroundX) {
                    orientation = Mat.mul4(orientation, Mat.rotation4(Mat.getRowA4(orientationMatrix || Mat.identity4()), Math.random() * Math.PI * 2));
                }
                if (randomTurnAroundY) {
                    orientation = Mat.mul4(orientation, Mat.rotation4(Mat.getRowB4(orientationMatrix || Mat.identity4()), Math.random() * Math.PI * 2));
                }
                this._spacecrafts.push(
                        new Spacecraft(
                                Armada.logic().getSpacecraftClass(shipClass),
                                Mat.translation4(Math.random() * mapSize - mapSize / 2, Math.random() * mapSize - mapSize / 2, Math.random() * mapSize - mapSize / 2),
                                orientation,
                                this._projectiles,
                                "default"));
            }
        }
    };
    /**
     * Adds renderable objects representing all visual elements of the level to
     * the passed scene.
     * @param {Scene} scene
     */
    Level.prototype.addToScene = function (scene) {
        var i;
        this._environment.addToScene(scene);
        this._hitObjects = new Array();
        for (i = 0; i < this._spacecrafts.length; i++) {
            this._spacecrafts[i].addToScene(scene, undefined, false, {
                hitboxes: true,
                weapons: true,
                thrusterParticles: true,
                projectileResources: true
            });
            this._spacecrafts[i].addCamerasForViews(scene);
            this._hitObjects.push(this._spacecrafts[i].getPhysicalModel());
        }
        if (this._cameraStartPositionMatrix) {
            scene.activeCamera.setPositionMatrix(this._cameraStartPositionMatrix);
        }
        if (this._cameraStartOrientationMatrix) {
            scene.activeCamera.setOrientationMatrix(this._cameraStartOrientationMatrix);
        }
    };
    /**
     * Toggles the visibility of the hitboxes of all spacecrafts in the level.
     */
    Level.prototype.toggleHitboxVisibility = function () {
        for (var i = 0; i < this._spacecrafts.length; i++) {
            this._spacecrafts[i].toggleHitboxVisibility();
        }
    };
    /**
     * Performs the physics and game logic simulation of all the object in the
     * level.
     * @param {Number} dt The time passed since the last simulation step, in
     * milliseconds.
     */
    Level.prototype.tick = function (dt) {
        this._environment.simulate();
        for (var i = 0; i < this._spacecrafts.length; i++) {
            if ((this._spacecrafts[i] === undefined) || (this._spacecrafts[i].canBeReused())) {
                this._spacecrafts[i] = null;
                this._spacecrafts.splice(i, 1);
                this._hitObjects[i] = null;
                this._hitObjects.splice(i, 1);
            } else {
                this._spacecrafts[i].simulate(dt);
            }
        }
        for (var i = 0; i < this._projectiles.length; i++) {
            if ((this._projectiles[i] === undefined) || (this._projectiles[i].canBeReused())) {
                Module.log("Projectile removed.", 2);
                this._projectiles[i] = null;
                this._projectiles.splice(i, 1);
            } else {
                this._projectiles[i].simulate(dt, this._hitObjects);
            }
        }
    };
    // #########################################################################
    /**
     * @class A class responsible for loading and storing game logic related 
     * settings and data as well and provide an interface to access them.
     * @returns {LogicContext}
     */
    function LogicContext() {
        Resource.call(this);
        /**
         * The name of the file (without path) that contains the descriptions
         * of the in-game classes.
         * @name LogicContext#_classesSourceFileName
         * @type String
         */
        this._classesSourceFileName = null;
        /**
         * The name of the file (without path) that contains the descriptions
         * of the reusable environments.
         * @name LogicContext#_environmentsSourceFileName
         * @type String
         */
        this._environmentsSourceFileName = null;
        /**
         * An associative array storing the SkyboxClass objects that describe
         * the available Skybox classes in the game. The keys are the name
         * properties of the stored class objects.
         * @name LogicContext#_skyboxClasses
         * @type Object
         */
        this._skyboxClasses = null;
        /**
         * An associative array storing the BackgroundObjectClass objects that 
         * describe the available BackgroundObject classes in the game. The keys 
         * are the name properties of the stored class objects.
         * @name LogicContext#_backgroundObjectClasses
         * @type Object
         */
        this._backgroundObjectClasses = null;
        /**
         * An associative array storing the DustCloudClass objects that describe
         * the available DustCloud classes in the game. The keys are the name
         * properties of the stored class objects.
         * @name LogicContext#_dustCloudClasses
         * @type Object
         */
        this._dustCloudClasses = null;
        /**
         * An associative array storing the WeaponClass objects that describe
         * the available Weapon classes in the game. The keys are the name
         * properties of the stored class objects.
         * @name LogicContext#_weaponClasses
         * @type Object
         */
        this._weaponClasses = null;
        /**
         * An associative array storing the SpacecraftClass objects that describe
         * the available Spacecraft classes in the game. The keys are the name
         * properties of the stored class objects.
         * @name LogicContext#_spacecraftClasses
         * @type Object
         */
        this._spacecraftClasses = null;
        /**
         * An associative array storing the SpacecraftType objects that describe
         * the available Spacecraft types in the game. The keys are the name
         * properties of the stored type objects.
         * @name LogicContext#_spacecraftTypes
         * @type Object
         */
        this._spacecraftTypes = null;
        /**
         * An associative array storing the ProjectileClass objects that describe
         * the available Projectile classes in the game. The keys are the name
         * properties of the stored class objects.
         * @name LogicContext#_projectileClasses
         * @type Object
         */
        this._projectileClasses = null;
        /**
         * An associative array storing the PropulsionClass objects that describe
         * the available Propulsion classes in the game. The keys are the name
         * properties of the stored class objects.
         * @name LogicContext#_propulsionClasses
         * @type Object
         */
        this._propulsionClasses = null;
        /**
         * An associative array storing the reusable Environment objects that 
         * describe possible environments for levels. The keys are the names
         * of the environments.
         * @name LogicContext#_environments
         * @type Object
         */
        this._environments = null;
        /**
         * Whether the rotation of models (both automatic and manual) is enabled
         * on the database screen.
         * @name LogicContext#_databaseModelRotation
         * @type Boolean
         */
        this._databaseModelRotation = null;
    }
    LogicContext.prototype = new Resource();
    LogicContext.prototype.constructor = LogicContext;
    // #########################################################################
    // direct getters and setters
    /**
     * Returns whether the rotation (both automatic and manual) of models on the
     * database screen is currently turned on.
     * @returns {Boolean}
     */
    LogicContext.prototype.getDatabaseModelRotation = function () {
        return this._databaseModelRotation;
    };
    /**
     * Return the skybox class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {SkyboxClass}
     */
    LogicContext.prototype.getSkyboxClass = function (name) {
        return this._skyboxClasses[name] || null;
    };
    /**
     * Return the background object class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {BackgroundObjectClass}
     */
    LogicContext.prototype.getBackgroundObjectClass = function (name) {
        return this._backgroundObjectClasses[name] || null;
    };
    /**
     * Return the dust cloud class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {DustCloudClass}
     */
    LogicContext.prototype.getDustCloudClass = function (name) {
        return this._dustCloudClasses[name] || null;
    };
    /**
     * Return the projectile class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {ProjectileClass}
     */
    LogicContext.prototype.getProjectileClass = function (name) {
        return this._projectileClasses[name] || null;
    };
    /**
     * Return the weapon class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {WeaponClass}
     */
    LogicContext.prototype.getWeaponClass = function (name) {
        return this._weaponClasses[name] || null;
    };
    /**
     * Return the propulsion class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {PropulsionClass}
     */
    LogicContext.prototype.getPropulsionClass = function (name) {
        return this._propulsionClasses[name] || null;
    };
    /**
     * Return the spacecraft type with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {SpacecraftType}
     */
    LogicContext.prototype.getSpacecraftType = function (name) {
        return this._spacecraftTypes[name] || null;
    };
    /**
     * Return the spacecraft class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {SpacecraftClass}
     */
    LogicContext.prototype.getSpacecraftClass = function (name) {
        return this._spacecraftClasses[name] || null;
    };
    /**
     * Return the reusable environment with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {Environment}
     */
    LogicContext.prototype.getEnvironment = function (name) {
        return this._environments[name] || null;
    };
    // #########################################################################
    // indirect getters and setters
    /**
     * Returns all the available spacecraft classes in an array.
     * @returns {SpacecraftClass[]}
     */
    LogicContext.prototype.getSpacecraftClassesInArray = function () {
        var result = new Array();
        for (var p in this._spacecraftClasses) {
            result.push(this._spacecraftClasses[p]);
        }
        return result;
    };
    // #########################################################################
    // methods
    /**
     * Adds a class of a the given type of entity to the stored classes.
     * @param {String} entityClassName e.g. "Skybox", "BackgroundObject"
     * @param {SkyboxClass|BackgroundObjectClass|WeaponClass|...} entityClass
     */
    LogicContext.prototype.addClass = function (entityClassName, entityClass) {
        entityClassName = entityClassName[0].toLowerCase() + entityClassName.substring(1, entityClassName.length);
        this["_" + entityClassName + "Classes"][entityClass.name] = entityClass;
    };
    /**
     * Loads the available classes for the objects with the given class name from
     * the XML tags residing below the passed tag / document which have the
     * proper tag name.
     * @param {Element|Document} xmlDoc The parent of the elements which store
     * the class descriptions.
     * @param {String} entityClassName The name of the (JS) class of objects for which
     * the available in-game classes are to be loaded. e.g. "Skybox", "Weapon".
     * An in-game class has to exist for this kind of objects (with a JS class named
     * "SkyboxClass" for example) that has a constructor taking an XML element
     * as parameter to initialize the properties of the class from.
     */
    LogicContext.prototype.addClassesFromXML = function (xmlDoc, entityClassName) {
        // set first letter to lowercase to find and initialize the property storing these classes
        entityClassName = entityClassName[0].toLowerCase() + entityClassName.substring(1, entityClassName.length);
        this["_" + entityClassName + "Classes"] = new Object();
        // set the first letter to uppercase to find the XML tags by name and add the
        // class object themselves
        entityClassName = entityClassName[0].toUpperCase() + entityClassName.substring(1, entityClassName.length);
        var classTags = xmlDoc.getElementsByTagName(entityClassName + "Class");
        for (var i = 0; i < classTags.length; i++) {
            this.addClass(entityClassName, new Classes[entityClassName + "Class"](classTags[i]));
        }
    };
    /**
     * Loads the available spacecraft types from the XML tags residing below the 
     * passed tag / document.
     * @param {Element|Document} xmlDoc The parent of the elements which store
     * the type descriptions.
     */
    LogicContext.prototype.loadSpacecraftTypes = function (xmlDoc) {
        this._spacecraftTypes = new Object();
        var typeTags = xmlDoc.getElementsByTagName("SpacecraftType");
        for (var i = 0; i < typeTags.length; i++) {
            var spacecraftType = new Classes.SpacecraftType(typeTags[i]);
            this._spacecraftTypes[spacecraftType.name] = spacecraftType;
        }
    };
    /**
     * Sends an asynchronous request to grab the file containing the in-game
     * class descriptions and sets a callback to load those descriptions and
     * initiate the loading of reusable environments when ready.
     */
    LogicContext.prototype.requestClassesLoad = function () {
        var self = this;
        Application.requestXMLFile("config", this._classesSourceFileName, function (xmlDoc) {
            self.loadClassesFromXML(xmlDoc);
            self.requestEnvironmentsLoad();
        });
    };
    /**
     * Loads the desciptions of all in-game classes from the passed XML document,
     * creates and stores all the appropriate in-game class objects for them.
     * @param {Document} xmlDoc
     */
    LogicContext.prototype.loadClassesFromXML = function (xmlDoc) {
        this.addClassesFromXML(xmlDoc, "Skybox");
        this.addClassesFromXML(xmlDoc, "BackgroundObject");
        this.addClassesFromXML(xmlDoc, "DustCloud");
        this.addClassesFromXML(xmlDoc, "Projectile");
        this.addClassesFromXML(xmlDoc, "Weapon");
        this.addClassesFromXML(xmlDoc, "Propulsion");
        this.loadSpacecraftTypes(xmlDoc);
        this.addClassesFromXML(xmlDoc, "Spacecraft");
    };
    /**
     * Sends an asynchronous request to grab the file containing the reusable
     * environment descriptions and sets a callback to load those descriptions 
     * and set the resource state of this context to ready when done.
     */
    LogicContext.prototype.requestEnvironmentsLoad = function () {
        var self = this;
        Application.requestXMLFile("environment", this._environmentsSourceFileName, function (xmlDoc) {
            self.loadEnvironmentsFromXML(xmlDoc);
            self.setToReady();
        });
    };
    /**
     * Loads the desciptions of all reusable environments from the passed XML 
     * document, creates and stores all the objects for them.
     * @param {Document} xmlDoc
     */
    LogicContext.prototype.loadEnvironmentsFromXML = function (xmlDoc) {
        this._environments = new Object();
        var environmentTags = xmlDoc.getElementsByTagName("Environment");
        for (var i = 0; i < environmentTags.length; i++) {
            var environment = new Environment(environmentTags[i]);
            this._environments[environmentTags[i].getAttribute("name")] = environment;
        }
    };
    /**
     * Loads all the setting and references from the passed XML document and
     * initiates the request(s) necessary to load additional configuration from
     * referenced files.
     * @param {Document} xmlDoc
     */
    LogicContext.prototype.loadFromXML = function (xmlDoc) {
        this._databaseModelRotation = (xmlDoc.getElementsByTagName("database")[0].getAttribute("modelRotation") === "true");
        this._classesSourceFileName = xmlDoc.getElementsByTagName("classes")[0].getAttribute("source");
        this._environmentsSourceFileName = xmlDoc.getElementsByTagName("environments")[0].getAttribute("source");
        this.requestClassesLoad();
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    Module = {
        Spacecraft: Spacecraft,
        Level: Level,
        LogicContext: LogicContext
    };
    return Module;
});