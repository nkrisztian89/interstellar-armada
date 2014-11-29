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
                scene.activeCamera
                ));
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
                    Mat.translation4v(Vec.scaled3(this._position, 4500))
                    );
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
     * @param {PointCloud} cloudVisualModel
     */
    DustParticle.prototype.addToScene = function (cloudVisualModel) {
        cloudVisualModel.addSubnode(this._visualModel);
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
        scene.addObject(this._visualModel);
        this._particles = new Array();
        for (i = 0; i < this._class.numberOfParticles; i++) {
            var particle = new DustParticle(
                    this,
                    Armada.resources().getShader(this._class.shaderName),
                    Mat.translation4(
                            (Math.random() - 0.5) * 2 * this._class.range,
                            (Math.random() - 0.5) * 2 * this._class.range,
                            (Math.random() - 0.5) * 2 * this._class.range));
            particle.addToScene(this._visualModel);
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
     * @param {Float32Array} positionMatrix The transformation matrix describing
     * the initial position of the projectile.
     * @param {Float32Array} orientationMatrix The transformation matrix describing
     * the initial oriantation of the projectile.
     * @param {Spacecraft} spacecraft The spacecraft which fired the projectile.
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
         * @type VisualObject
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
                positionMatrix,
                orientationMatrix,
                Mat.scaling4(projectileClass.size),
                spacecraft.getVelocityMatrix(),
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
     * Adds a renderable node representing this projectile to the passed scene.
     * @param {Scene} scene The scene to which to add the renderable object
     * presenting the projectile.
     */
    Projectile.prototype.addToScene = function (scene) {
        this._visualModel = new Scene.Billboard(
                Armada.resources().getOrAddModelByName(Egom.turningBillboardModel("projectileModel-" + this._class.name, this._class.intersections)),
                Armada.resources().getShader(this._class.shaderName),
                Armada.resources().getOrAddTextureFromDescriptor(this._class.textureDescriptor),
                this._class.size,
                this._physicalModel.positionMatrix,
                this._physicalModel.orientationMatrix
                );
        scene.addObject(this._visualModel);
    };
    /**
     * Removes the renferences to the renderable and physics objects of the
     * projectile and marks it for removel / reuse.
     */
    Projectile.prototype.destroy = function () {
        this._timeLeft = 0;
        this._visualModel.removeFromScene();
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
            this._visualModel.positionMatrix = this._physicalModel.positionMatrix;
            this._visualModel.orientationMatrix = this._physicalModel.orientationMatrix;
            var positionVector = Mat.translationVector4(this._physicalModel.positionMatrix);
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
         * @type VisualObject
         */
        this._visualModel = null;
    }
    /**
     * Adds a renderable node representing this weapon to the scene under the
     * passed parent node.
     * @param {ShipMesh} parentNode The parent node to which to attach this
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
        parentNode.addSubnode(this._visualModel);
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
                var muzzleFlashPosMatrix = Mat.translation4v(this._class.barrels[i].positionVector);
                // add the muzzle flash of this barrel
                var muzzleFlash = new Scene.DynamicParticle(
                        Armada.resources().getOrAddModelByName(Egom.squareModel("squareModel")),
                        Armada.resources().getShader(projectileClass.muzzleFlash.shaderName),
                        Armada.resources().getOrAddTextureFromDescriptor(projectileClass.muzzleFlash.textureDescriptor),
                        projectileClass.muzzleFlash.color,
                        projectileClass.size,
                        muzzleFlashPosMatrix,
                        muzzleFlashTimeLength
                        );
                this._visualModel.addSubnode(muzzleFlash);
                // add the projectile of this barrel
                var p = new Projectile(
                        projectileClass,
                        Mat.mul4(projectilePosMatrix, Mat.translation4v(barrelPosVector)),
                        projectileOriMatrix,
                        this._spacecraft,
                        new Physics.Force("", this._class.barrels[i].force, [projectileOriMatrix[4], projectileOriMatrix[5], projectileOriMatrix[6]], timeBurstLength));
                p.addToScene(this._visualModel.getScene());
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
         * @type VisualObject
         */
        this._visualModel = null;
        /**
         * The renderable object corresponding to the ship this thruster is located on.
         * @name Thruster#_shipModel
         * @type VisualObject
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
     * @param {ShipMesh} parentNode The parent node to which to attach the
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
                Mat.translation4v(this._slot.positionVector),
                20);
        parentNode.addSubnode(this._visualModel);
        this._shipModel = parentNode;
    };
    /**
     * Updates the visual representation of this thruster to represent the current
     * burn level.
     */
    Thruster.prototype._updateVisuals = function () {
        // set the size of the particle that shows the burn
        this._visualModel.setRelSize(this._burnLevel);
        // set the strength of which the luminosity texture is lighted
        this._shipModel.setLuminosityFactor(this._slot.group, Math.min(1.0, 2 * this._burnLevel));
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
     * @param {VisualObject} parentNode
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
        var directionVector = [this._drivenPhysicalObject.orientationMatrix[4], this._drivenPhysicalObject.orientationMatrix[5], this._drivenPhysicalObject.orientationMatrix[6]];
        var yawAxis = [this._drivenPhysicalObject.orientationMatrix[8], this._drivenPhysicalObject.orientationMatrix[9], this._drivenPhysicalObject.orientationMatrix[10]];
        var pitchAxis = [this._drivenPhysicalObject.orientationMatrix[0], this._drivenPhysicalObject.orientationMatrix[1], this._drivenPhysicalObject.orientationMatrix[2]];

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
    /**
     * @class Represents a specific spacecraft (fighter, warship, freighter, space
     * station etc.) in the game.
     * @param {SpacecraftClass} spacecraftClass The class of the spacecraft that
     * describes its general properties.
     * @param {Float32Array} positionMatrix The translation matrix describing
     * the initial position of the spacecraft.
     * @param {Float32Array} orientationMatrix The rotation matrix describing
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
        this._class = spacecraftClass;
        /**
         * The renderable node that represents this spacecraft in a scene.
         * @name Spacecraft#_visualModel
         * @type ShipMesh
         */
        this._visualModel = null;
        /**
         * The object representing the physical properties of this spacecraft.
         * Used to calculate the movement and rotation of the craft as well as
         * check for collisions and hits.
         * @name Spacecraft#_physicalModel
         * @type PhysicalObject
         */
        this._physicalModel = new Physics.PhysicalObject(
                this._class.mass,
                positionMatrix,
                orientationMatrix,
                Mat.scaling4(this._class.modelSize),
                Mat.identity4(),
                this._class.bodies);
        /**
         * The list of weapons this spacecraft is equipped with.
         * @name Spacecraft#_weapons
         * @type Weapon[]
         */
        this._weapons = new Array();
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
        this._maneuveringComputer = new ManeuveringComputer(this);
        /**
         * The renderable object that is used as the parent for the visual
         * representation of the hitboxes of this craft.
         * @name Spacecraft#_hitbox
         * @type VisualObject
         */
        this._hitbox = null;
        /**
         * The array to which the spacecraft will add its fired projectiles.
         * @name Spacecraft#_projectileArray
         * @type Projectile[]
         */
        this._projectileArray = projectileArray || null;
        // equipping the craft if a profile name was given
        if (equipmentProfileName !== undefined) {
            this.equipProfile(this._class.equipmentProfiles[equipmentProfileName]);
        }
    }
    /**
     * Returns the object describing class of this spacecraft.
     * @returns {SpacecraftClass}
     */
    Spacecraft.prototype.getClass = function () {
        return this._class;
    };
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
     * Returns the renderable object that represents this spacecraft in a scene.
     * @returns {VisualObject}
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
    /**
     * Returns whether this spacecraft object can be reused to represent a new
     * spacecraft.
     * @returns {Boolean}
     */
    Spacecraft.prototype.canBeReused = function () {
        return false;
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
     * Returns the 4x4 translation matrix describing the position of this 
     * spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getPositionMatrix = function () {
        return this._physicalModel.positionMatrix;
    };
    /**
     * Returns the 4x4 rotation matrix describing the orientation of this 
     * spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getOrientationMatrix = function () {
        return this._physicalModel.orientationMatrix;
    };
    /**
     * Returns the 4x4 scaling matrix describing the scaling of the meshes and
     * physical model representing this spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getScalingMatrix = function () {
        return this._physicalModel.scalingMatrix;
    };
    /**
     * Returns the 4x4 translation matrix describing the current velocity of this
     * spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getVelocityMatrix = function () {
        return this._physicalModel.velocityMatrix;
    };
    /**
     * Returns the 4x4 translation matrix describing the current velocity of this
     * spacecraft in relative (model) space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getRelativeVelocityMatrix = function () {
        return Mat.mul4(
                this._physicalModel.velocityMatrix,
                Mat.matrix4from3(Mat.matrix3from4(this._physicalModel.rotationMatrixInverse))
                );
    };
    /**
     * Returns the 4x4 rotation matrix describing the current rotation of this
     * spacecraft in relative (model) space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getTurningMatrix = function () {
        return Mat.mul4(
                Mat.mul4(
                        this._physicalModel.orientationMatrix,
                        this._physicalModel.angularVelocityMatrix),
                Mat.matrix4from3(Mat.matrix3from4(this._physicalModel.rotationMatrixInverse)));
    };
    /**
     * Returns the maximum acceleration the spacecraft can achieve using its
     * currently equipped propulsion system.
     * @returns {Number|null} The acceleration, in m/s^2. Null, if no propulsion
     * is equipped.
     */
    Spacecraft.prototype.getMaxAcceleration = function () {
        return this._propulsion ?
                this._propulsion.getThrust() / this._physicalModel.mass :
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
                this._propulsion.getAngularThrust() / this._physicalModel.mass :
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
        return Math.abs(this._propulsion.getThrust() / (this._physicalModel.mass * speed));
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
     * Adds a renderable object that represents the index'th body of the physical
     * model of this spacecraft.
     * @param {Number} index The index of the body to represent.
     */
    Spacecraft.prototype._addHitboxModel = function (index) {
        var phyModelWithLOD = new Scene.ModelWithLOD(
                Armada.resources().getOrAddModelByName(
                Egom.cuboidModel(
                        this._class.name + "-body" + index,
                        this._class.bodies[index].width,
                        this._class.bodies[index].height,
                        this._class.bodies[index].depth,
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
        Mat.translation4v(Mat.translationVector3(this._class.bodies[index].positionMatrix)),
                this._class.bodies[index].orientationMatrix,
                Mat.identity4(),
                false);
        this._hitbox.addSubnode(hitZoneMesh);
    };
    /**
     * Creates and adds the renderable objects to represent this spacecraft to
     * the passed scene.
     * @param {Scene} scene The scene to which the objects will be added.
     * @param {Number} [lod] The level of detail to use for adding the models.
     * If not given, all available LODs will be added for dynamic LOD rendering.
     * @param {Boolean} [addHitboxes=true] Whether to add boxes to represent the
     * hitboxes corresponding to this spacecraft. (not set to visible by default)
     * @param {Boolean} [addWeapons=true] Whether to add the models of the weapons
     * equipped on the spacecraft.
     * @param {Boolean} [addThrusterParticles=true] Whether to add the particles
     * representing the glow of the ignited thrusters. (only visible when and as
     * much as thrusters are actually ignited)
     * @param {Boolean} [wireframe=false] Whether to add the models in wireframe
     * drawing mode (or in solid).
     * @returns {ShipMesh} The renderable object created to represent the 
     * spacecraft.
     */
    Spacecraft.prototype.addToScene = function (scene, lod, addHitboxes, addWeapons, addThrusterParticles, wireframe) {
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
        this._visualModel = new Scene.ShipMesh(
                modelsWithLOD,
                Armada.resources().getShader(this._class.shaderName),
                textures,
                this._physicalModel.positionMatrix,
                this._physicalModel.orientationMatrix,
                Mat.scaling4(this._class.modelSize),
                (wireframe === true));
        scene.addObject(this._visualModel);
        // visualize physical model (hitboxes)
        if ((addHitboxes === undefined) || (addHitboxes === true)) {
            // add the parent objects for the hitboxes
            this._hitbox = new Scene.VisualObject(Armada.resources().getShader(this._class.shaderName), false, false);
            // add the models for the hitboxes themselves
            for (i = 0; i < this._class.bodies.length; i++) {
                this._addHitboxModel(i);
            }
            this._hitbox.hide();
            this._visualModel.addSubnode(this._hitbox);
        }
        // add the weapons
        if ((addWeapons === undefined) || (addWeapons === true)) {
            for (i = 0; i < this._weapons.length; i++) {
                this._weapons[i].addToScene(this._visualModel, lod, wireframe);
            }
        }
        // add the thruster particles
        if ((addThrusterParticles === undefined) || (addThrusterParticles === true)) {
            this._propulsion.addThrusters(this._class.thrusterSlots);
            this._propulsion.addToScene(this._visualModel);
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
        return speedDifference * this._physicalModel.mass / this._propulsion.getThrust() / 2 / (timeBurstLength / 1000);
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
        return angularVelocityDifference * 200 * this._physicalModel.mass / this._propulsion.getAngularThrust() / 2 / (timeBurstLength / 1000);
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
        this._visualModel.resetViewCameras();
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
        this._visualModel.setPositionMatrix(this._physicalModel.positionMatrix);
        this._visualModel.setOrientationMatrix(this._physicalModel.orientationMatrix);
        this._maneuveringComputer.updateSpeedIncrement(dt);
    };

    /**
     * @class The domain specific part of the model of what happens in the game, 
     * with spaceships, projectiles and so.
     * @returns {Level}
     */
    function Level() {
        /**
         * The associative array of players that compete on this level. The keys
         * are the names of the players.
         * @name Level#_players
         * @type Object
         */
        this._players = null;
        /**
         * The list of skyboxes this level contains as background.
         * @name Level#_skyboxes
         * @type Skybox[]
         */
        this._skyboxes = null;
        /**
         * The list of background objects (stars, nebulae) this level contains.
         * @name Level#_backgroundObject
         * @type BackgroundObject[]
         */
        this._backgroundObjects = null;
        /**
         * The list of dust clouds this level contains.
         * @name Level#_dustClouds
         * @type DustCloud[]
         */
        this._dustClouds = null;
        /**
         * The starting position and orientation of the camera if a scene is 
         * generated for this level. The position and orientation matrices has to be
         * stored in this object.
         * @name Level#_cameraStartPosition
         * @type Object
         */
        this._cameraStartPosition = null;
        /**
         * The list of spacecrafts that are placed on the map of this level.
         * @name Level#_spacecrafts
         * @type Spacecraft[]
         */
        this._spacecrafts = null;
        /**
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
         * @name Level#_hitObjects
         * @type PhysicalObject[]
         */
        this._hitObjects = null;

        this.camera = null;
        this.cameraController = null;

        this.onLoad = null;
    }

    Level.prototype.getPlayer = function (name) {
        return this._players[name];
    };

    Level.prototype.addPlayer = function (player) {
        this._players[player.name] = player;
    };

    Level.prototype.getPilotedSpacecraft = function () {
        if (this._pilotedCraftIndex !== null) {
            return this._spacecrafts[this._pilotedCraftIndex];
        } else {
            return null;
        }
    };

    Level.prototype.requestLoadFromFile = function (filename) {
        var self = this;
        Application.requestXMLFile("level", filename, function (levelSource) {
            self.loadFromXML(levelSource);
            if (self.onLoad !== null) {
                self.onLoad();
            }
        });
    };

    Level.prototype.loadFromXML = function (levelSource) {
        var i;

        this._players = new Object();
        var playerTags = levelSource.getElementsByTagName("Player");
        for (var i = 0; i < playerTags.length; i++) {
            this.addPlayer(new Player(playerTags[i].getAttribute("name")));
        }

        this._skyboxes = new Array();
        var skyboxTags = levelSource.getElementsByTagName("Skybox");
        for (i = 0; i < skyboxTags.length; i++) {
            this._skyboxes.push(new Skybox(Armada.logic().getSkyboxClass(skyboxTags[i].getAttribute("class"))));
        }

        this._backgroundObjects = new Array();
        var backgroundObjectTags = levelSource.getElementsByTagName("BackgroundObject");
        for (i = 0; i < backgroundObjectTags.length; i++) {
            this._backgroundObjects.push(new BackgroundObject(
                    Armada.logic().getBackgroundObjectClass(backgroundObjectTags[i].getAttribute("class")),
                    backgroundObjectTags[i].getElementsByTagName("position")[0].getAttribute("angleAlpha"),
                    backgroundObjectTags[i].getElementsByTagName("position")[0].getAttribute("angleBeta")
                    ));
        }

        this._dustClouds = new Array();
        var dustCloudTags = levelSource.getElementsByTagName("DustCloud");
        for (i = 0; i < dustCloudTags.length; i++) {
            this._dustClouds.push(new DustCloud(Armada.logic().getDustCloudClass(dustCloudTags[i].getAttribute("class"))));
        }

        this._cameraStartPosition = new Object();
        var cameraTags = levelSource.getElementsByTagName("Camera");
        if (cameraTags.length > 0) {
            if (cameraTags[0].getElementsByTagName("position").length > 0) {
                this._cameraStartPosition.positionMatrix = Mat.translation4v(Vec.scaled3(Vec.fromXMLTag3(cameraTags[0].getElementsByTagName("position")[0]), -1));
            }
            if (cameraTags[0].getElementsByTagName("orientation").length > 0) {
                this._cameraStartPosition.orientationMatrix = Mat.rotation4FromXMLTags(cameraTags[0].getElementsByTagName("orientation")[0].getElementsByTagName("turn"));
            }
        }

        this._projectiles = new Array();
        this._spacecrafts = new Array();
        var spacecraftTags = levelSource.getElementsByTagName("Spacecraft");
        for (i = 0; i < spacecraftTags.length; i++) {
            var spacecraft = new Spacecraft(
                    Armada.logic().getSpacecraftClass(spacecraftTags[i].getAttribute("class")),
                    Mat.translationFromXMLTag(spacecraftTags[i].getElementsByTagName("position")[0]),
                    Mat.rotation4FromXMLTags(spacecraftTags[i].getElementsByTagName("turn")),
                    this._projectiles
                    );
            if (spacecraftTags[i].getAttribute("piloted") === "true") {
                this._pilotedCraftIndex = i;
            }
            // equipping the created spacecraft
            // if there is an quipment tag...
            if (spacecraftTags[i].getElementsByTagName("equipment").length > 0) {
                var equipmentTag = spacecraftTags[i].getElementsByTagName("equipment")[0];
                // if a profile is referenced in the equipment tag, look up that profile 
                // and equip according to that
                if (equipmentTag.hasAttribute("profile")) {
                    spacecraft.equipProfile(spacecraft._class.equipmentProfiles[equipmentTag.getAttribute("profile")]);
                    // if no profile is referenced, simply create a custom profile from the tags inside
                    // the equipment tag, and equip that
                } else {
                    var equipmentProfile = new Classes.EquipmentProfile(equipmentTag);
                    spacecraft.equipProfile(equipmentProfile);
                }
                // if there is no equipment tag, attempt to load the profile named "default"    
            } else if (spacecraft._class.equipmentProfiles["default"] !== undefined) {
                spacecraft.equipProfile(spacecraft._class.equipmentProfiles["default"]);
            }
            this._spacecrafts.push(spacecraft);
        }
    };

    Level.prototype.addRandomShips = function (shipNumbersPerClass, mapSize) {
        for (var shipClass in shipNumbersPerClass) {
            for (var i = 0; i < shipNumbersPerClass[shipClass]; i++) {
                this._spacecrafts.push(
                        new Spacecraft(
                                Armada.logic().getSpacecraftClass(shipClass),
                                Mat.translation4(Math.random() * mapSize - mapSize / 2, Math.random() * mapSize - mapSize / 2, Math.random() * mapSize - mapSize / 2),
                                Mat.identity4(),
                                this._projectiles,
                                "default"
                                )
                        );
            }
        }
    };

    /**
     * 
     * @param {Scene} scene
     */
    Level.prototype.buildScene = function (scene) {
        var i, j;

        for (i = 0; i < this._skyboxes.length; i++) {
            this._skyboxes[i].addToScene(scene);
        }

        for (i = 0; i < this._backgroundObjects.length; i++) {
            this._backgroundObjects[i].addToScene(scene);
        }

        for (i = 0; i < this._dustClouds.length; i++) {
            this._dustClouds[i].addToScene(scene);
        }

        this.camera = scene.activeCamera;
        if (this._cameraStartPosition.positionMatrix !== undefined) {
            this.camera.setPositionMatrix(this._cameraStartPosition.positionMatrix);
        }
        if (this._cameraStartPosition.orientationMatrix !== undefined) {
            this.camera.setOrientationMatrix(this._cameraStartPosition.orientationMatrix);
        }

        this._hitObjects = new Array();
        for (i = 0; i < this._spacecrafts.length; i++) {
            this._spacecrafts[i].addToScene(scene);
            this._spacecrafts[i].addCamerasForViews(scene);
            this._hitObjects.push(this._spacecrafts[i].getPhysicalModel());
        }


        // adding the projectile resources to make sure they will be requested for
        // loading, as they are not added to the scene in the beginning
        for (var i = 0; i < Armada.logic().projectileClasses.length; i++) {
            Armada.resources().getShader(Armada.logic().projectileClasses[i].shaderName);
            Armada.resources().getOrAddTextureFromDescriptor(Armada.logic().projectileClasses[i].textureDescriptor);
            Armada.resources().getShader(Armada.logic().projectileClasses[i].muzzleFlash.shaderName);
            Armada.resources().getOrAddTextureFromDescriptor(Armada.logic().projectileClasses[i].muzzleFlash.textureDescriptor);
            Armada.resources().getOrAddModelByName(Egom.turningBillboardModel("projectileModel-" + Armada.logic().projectileClasses[i].name, Armada.logic().projectileClasses[i].intersections));
        }
        Armada.resources().getOrAddModelByName(Egom.squareModel("squareModel"));
    };

    Level.prototype.addProjectileResourcesToContext = function (context) {
        for (var i = 0; i < Armada.logic().projectileClasses.length; i++) {
            Armada.resources().getShader(Armada.logic().projectileClasses[i].shaderName).addToContext(context);
            Armada.resources().getOrAddTextureFromDescriptor(Armada.logic().projectileClasses[i].textureDescriptor).addToContext(context);
            Armada.resources().getShader(Armada.logic().projectileClasses[i].muzzleFlash.shaderName).addToContext(context);
            Armada.resources().getOrAddTextureFromDescriptor(Armada.logic().projectileClasses[i].muzzleFlash.textureDescriptor).addToContext(context);
            Armada.resources().getOrAddModelByName(Egom.turningBillboardModel("projectileModel-" + Armada.logic().projectileClasses[i].name, Armada.logic().projectileClasses[i].intersections)).addToContext(context, false);
        }
        Armada.resources().getOrAddModelByName(Egom.squareModel("squareModel")).addToContext(context);
    };

    Level.prototype.toggleHitboxVisibility = function () {
        for (var i = 0; i < this._spacecrafts.length; i++) {
            this._spacecrafts[i].toggleHitboxVisibility();
        }
    };

    Level.prototype.tick = function (dt) {
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
                Application.log("Projectile removed.", 2);
                this._projectiles[i] = null;
                this._projectiles.splice(i, 1);
            } else {
                this._projectiles[i].simulate(dt, this._hitObjects);
            }
        }
        for (var i = 0; i < this._dustClouds.length; i++) {
            this._dustClouds[i].simulate(this.camera);
        }
        this.camera.update();
    };

    function Player(name) {
        this.name = name;
    }

    /**
     * @class A class responsible for loading and storing game logic related settings
     * and data as well and provide an interface to access them.
     * @returns {LogicContext}
     */
    function LogicContext() {
        Resource.call(this);

        this._classesSourceFileName = null;

        this.skyboxClasses = new Array();
        this.backgroundObjectClasses = new Array();
        this.dustCloudClasses = new Array();
        this.weaponClasses = new Array();
        this.spacecraftClasses = new Array();
        this._spacecraftTypes = null;
        this.projectileClasses = new Array();
        this.propulsionClasses = new Array();

        this._databaseModelRotation = null;
    }

    LogicContext.prototype = new Resource();
    LogicContext.prototype.constructor = LogicContext;

    LogicContext.prototype.loadSkyboxClasses = function (classesXML) {
        var result = new Array();

        var classTags = classesXML.getElementsByTagName("SkyboxClass");
        for (var i = 0; i < classTags.length; i++) {
            result.push(new Classes.SkyboxClass(classTags[i]));
        }

        this.skyboxClasses = result;
        return result;
    };

    LogicContext.prototype.loadBackgroundObjectClasses = function (classesXML) {
        var result = new Array();

        var classTags = classesXML.getElementsByTagName("BackgroundObjectClass");
        for (var i = 0; i < classTags.length; i++) {
            result.push(new Classes.BackgroundObjectClass(classTags[i]));
        }
        this.backgroundObjectClasses = result;
        return result;
    };

    /**
     * 
     * @param {Element} classesXML
     * @returns {DustCloudClass[]}
     */
    LogicContext.prototype.loadDustCloudClasses = function (classesXML) {
        var result = new Array();

        var classTags = classesXML.getElementsByTagName("DustCloudClass");
        for (var i = 0; i < classTags.length; i++) {
            result.push(new Classes.DustCloudClass(classTags[i]));
        }

        this.dustCloudClasses = result;
        return result;
    };

    LogicContext.prototype.loadProjectileClasses = function (classesXML) {
        var result = new Array();

        var classTags = classesXML.getElementsByTagName("ProjectileClass");
        for (var i = 0; i < classTags.length; i++) {
            result.push(new Classes.ProjectileClass(classTags[i]));
        }

        this.projectileClasses = result;
        return result;
    };

    LogicContext.prototype.loadWeaponClasses = function (classesXML) {
        var result = new Array();

        var classTags = classesXML.getElementsByTagName("WeaponClass");
        for (var i = 0; i < classTags.length; i++) {
            result.push(new Classes.WeaponClass(classTags[i]));
        }

        this.weaponClasses = result;
        return result;
    };

    LogicContext.prototype.loadPropulsionClasses = function (classesXML) {
        var result = new Array();

        var classTags = classesXML.getElementsByTagName("PropulsionClass");
        for (var i = 0; i < classTags.length; i++) {
            result.push(new Classes.PropulsionClass(classTags[i]));
        }

        this.propulsionClasses = result;
        return result;
    };

    LogicContext.prototype.loadSpacecraftTypes = function (classesXML) {
        var result = new Object();

        var typeTags = classesXML.getElementsByTagName("SpacecraftType");
        for (var i = 0; i < typeTags.length; i++) {
            var spacecraftType = new Classes.SpacecraftType(typeTags[i]);
            result[spacecraftType.name] = spacecraftType;
        }

        this._spacecraftTypes = result;
        return result;
    };

    LogicContext.prototype.loadSpacecraftClasses = function (classesXML) {
        var result = new Array();

        var classTags = classesXML.getElementsByTagName("SpacecraftClass");
        for (var i = 0; i < classTags.length; i++) {
            result.push(new Classes.SpacecraftClass(classTags[i]));
        }

        this.spacecraftClasses = result;
        return result;
    };


    LogicContext.prototype.loadClassesFromXML = function (xmlSource) {
        this.loadSkyboxClasses(xmlSource);
        this.loadBackgroundObjectClasses(xmlSource);
        this.loadDustCloudClasses(xmlSource);
        this.loadProjectileClasses(xmlSource);
        this.loadWeaponClasses(xmlSource);
        this.loadPropulsionClasses(xmlSource);
        this.loadSpacecraftTypes(xmlSource);
        this.loadSpacecraftClasses(xmlSource);
    };

    LogicContext.prototype.requestClassesLoad = function () {
        var self = this;
        Application.requestXMLFile("config", this._classesSourceFileName, function (classesXML) {
            self.loadClassesFromXML(classesXML);
            self.setToReady();
        });
    };


    LogicContext.prototype.loadFromXML = function (xmlSource) {
        this._databaseModelRotation = (xmlSource.getElementsByTagName("database")[0].getAttribute("modelRotation") === "true");
        this._classesSourceFileName = xmlSource.getElementsByTagName("classes")[0].getAttribute("source");
        this.requestClassesLoad();
    };

    LogicContext.prototype.getDatabaseModelRotation = function () {
        return this._databaseModelRotation;
    };

    LogicContext.prototype.getSkyboxClass = function (name) {
        var i = 0;
        while ((i < this.skyboxClasses.length) && (this.skyboxClasses[i].name !== name)) {
            i++;
        }
        if (i < this.skyboxClasses.length) {
            return this.skyboxClasses[i];
        } else {
            return null;
        }
    };

    LogicContext.prototype.getBackgroundObjectClass = function (name) {
        var i = 0;
        while ((i < this.backgroundObjectClasses.length) && (this.backgroundObjectClasses[i].name !== name)) {
            i++;
        }
        if (i < this.backgroundObjectClasses.length) {
            return this.backgroundObjectClasses[i];
        } else {
            return null;
        }
    };

    LogicContext.prototype.getDustCloudClass = function (name) {
        var i = 0;
        while ((i < this.dustCloudClasses.length) && (this.dustCloudClasses[i].name !== name)) {
            i++;
        }
        if (i < this.dustCloudClasses.length) {
            return this.dustCloudClasses[i];
        } else {
            return null;
        }
    };

    LogicContext.prototype.getProjectileClass = function (name) {
        var i = 0;
        while ((i < this.projectileClasses.length) && (this.projectileClasses[i].name !== name)) {
            i++;
        }
        if (i < this.projectileClasses.length) {
            return this.projectileClasses[i];
        } else {
            return null;
        }
    };


    LogicContext.prototype.getWeaponClass = function (name) {
        var i = 0;
        while ((i < this.weaponClasses.length) && (this.weaponClasses[i].name !== name)) {
            i++;
        }
        if (i < this.weaponClasses.length) {
            return this.weaponClasses[i];
        } else {
            return null;
        }
    };

    LogicContext.prototype.getPropulsionClass = function (name) {
        var i = 0;
        while ((i < this.propulsionClasses.length) && (this.propulsionClasses[i].name !== name)) {
            i++;
        }
        if (i < this.propulsionClasses.length) {
            return this.propulsionClasses[i];
        } else {
            return null;
        }
    };

    LogicContext.prototype.getSpacecraftType = function (name) {
        return this._spacecraftTypes[name];
    };

    LogicContext.prototype.getSpacecraftClass = function (name) {
        var i = 0;
        while ((i < this.spacecraftClasses.length) && (this.spacecraftClasses[i].name !== name)) {
            i++;
        }
        if (i < this.spacecraftClasses.length) {
            return this.spacecraftClasses[i];
        } else {
            return null;
        }
    };

    LogicContext.prototype.getSpacecraftClasses = function () {
        return this.spacecraftClasses;
    };

    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        Spacecraft: Spacecraft,
        Level: Level,
        LogicContext: LogicContext
    };
});