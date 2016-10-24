/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file Implementations of the various classes that represent all the different types of equipment to be added to spacecrafts
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, Element, this, Float32Array, performance */

/**
 * @param vec Vector operations are needed for several logic functions
 * @param mat Matrices are widely used for 3D simulation
 * @param application Used for file loading and logging functionality
 * @param managedGL Used for accessing shader variable types
 * @param physics Physics simulation is done using this module
 * @param resources Used to access the loaded media (graphics and sound) resources
 * @param pools Used to access the common pools for particles and projectiles
 * @param renderableObjects Used for creating visual models for game objects
 * @param lights Used for creating light sources for game objects and levels
 * @param sceneGraph Creating and managing the scene graph for visual simulation is done using this module
 * @param graphics Used to access graphics settings
 * @param config Used to access game settings/configuration
 * @param classes Used to load and access the classes of Interstellar Armada
 * @param constants Used to access the light priorities
 * @param explosion Used to create explosion for e.g. hits
 */
define([
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/managed-gl",
    "modules/physics",
    "modules/media-resources",
    "modules/pools",
    "modules/scene/renderable-objects",
    "modules/scene/lights",
    "modules/scene/scene-graph",
    "armada/graphics",
    "armada/classes",
    "armada/configuration",
    "armada/logic/constants",
    "armada/logic/explosion",
    "utils/polyfill"
], function (
        vec, mat,
        application, managedGL, physics, resources, pools,
        renderableObjects, lights, sceneGraph,
        graphics, classes, config,
        constants, explosion) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // enums
            /**
             * @enum {String}
             * The available flight modes.
             */
            FlightMode = {
                /**
                 * The pilot can freely control all thrusters
                 */
                FREE: "free",
                /**
                 * The maneuvering computer automatically adds thrust to compensate for drift and keep the set speed
                 */
                COMPENSATED: "compensated",
                /**
                 * Turning faster than it would be possible to compensate for drift is not allowed by the maneuvering computer 
                 */
                RESTRICTED: "restricted"
            },
            /**
             * @enum {Number}
             * When aiming (rotating), weapons determine in which of these states they are within the aiming process. It is used when 
             * deciding whether to fire or not.
             * @type Object
             */
            WeaponAimStatus = {
                /**
                 * The weapon cannot be rotated and thus cannot be aimed at targets.
                 */
                FIXED: 0,
                /**
                 * The weapon can be rotated, but it currently does not have a target to aim for (and is rotating back to the default position)
                 */
                NO_TARGET: 1,
                /**
                 * The weapon is currently trying to aim at a target, but the target lies out of the region accessible based on the restrictions
                 * of the weapon's rotators.
                 */
                AIMING_OUT_OF_REACH: 2,
                /**
                 * The weapon is in the process of aiming at a target (rotating).
                 */
                AIMING: 3,
                /**
                 * The weapon is currently aimed at the direction towards the target, but the target is out of its range.
                 */
                AIMED_OUT_OF_RANGE: 4,
                /**
                 * The weapon is currently aimed at the direction towards the target, and the target is within its range (ready to fire).
                 */
                AIMED_IN_RANGE: 5
            },
            // ------------------------------------------------------------------------------
            // constants
            /**
             * When adding the resources of a projectile (class) to a scene, this prefix is used in the ID to avoid adding the same one multiple
             * times
             * @type String
             */
            PROJECTILE_RESOURCE_ID_PREFIX = "projectile/",
            /**
             * When adding the resources of a weapon (class) to a scene, this prefix is used in the ID to avoid adding the same one multiple
             * times
             * @type String
             */
            WEAPON_RESOURCE_ID_PREFIX = "weapon/",
            /**
             * The number of discrete volume levels to which the thruster sounds can be set according to the rate at which the thrusters
             * are firing (so that the sound source is not ramping the volume all the time as the thruster fire rate changes)
             * @type Number
             */
            THRUSTER_SOUND_VOLUME_GRADES = 3,
            /**
             * The duration while the thruster sound effects ramp to a new volume if needed as the firing rate of the thrusters change.
             * In seconds.
             * @type Number
             */
            THRUSTER_SOUND_VOLUME_RAMP_DURATION = 0.020,
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * Cached value of the configuration setting whether self-fire (a spacecraft hitting itself with its own projectiles) is enabled.
             * @type Boolean
             */
            _isSelfFireEnabled = false,
            /**
             * Cached value of the configuration setting of how long does a momentary action (e.g. firing a projectile) take in terms of 
             * physics simulation, in milliseconds.
             * @type Number
             */
            _momentDuration = 0,
            /**
             * Cached value of the configuration setting of minimum number of muzzle flash particles that should trigger their instanced rendering.
             * @type Number
             */
            _minimumMuzzleFlashParticleCountForInstancing = 0,
            /**
             * Cached value of the configuration setting of minimum number of projectiles that should trigger their instanced rendering.
             * @type Number
             */
            _minimumProjectileCountForInstancing = 0,
            /**
             * Cached value of the configuration setting for compensated forward speed factor.
             * @type Number
             */
            _compensatedForwardSpeedFactor,
            /**
             * Cached value of the configuration setting for compensated  reverse speed factor.
             * @type Number
             */
            _compensatedReverseSpeedFactor,
            /**
             * Cached value of the configuration setting for toggling hitbox visibility based on for which objects are hitchecks calculated.
             * @type Boolean
             */
            _showHitboxesForHitchecks,
            /**
             * Cached value of the configuration setting of the name of the uniform array storing the luminosity factors for models.
             * @type String
             */
            _luminosityFactorsArrayName = null,
            /**
             * Cached value of the configuration setting of the name of the uniform array storing the group transforms for models.
             * @type String
             */
            _groupTransformsArrayName = null,
            /**
             * Cached value of the configuration setting of the same name (see configuration.json)
             * @type Number
             */
            _fireSoundStackingTimeThreshold,
            /**
             * Cached value of the configuration setting of the same name (see configuration.json)
             * @type Number
             */
            _fireSoundStackingVolumeFactor,
            /**
             * A pool containing dynamic particles (such as particles for muzzle flashes and explosions) for reuse, so that creation of
             * new particle objects can be decreased for optimization.
             * @type Pool
             */
            _particlePool,
            /**
             * A pool containing projectiles for reuse, so that creation of new projectile objects can be decreased for optimization.
             * @type Pool
             */
            _projectilePool;
    Object.freeze(FlightMode);
    Object.freeze(WeaponAimStatus);
// ##############################################################################
    /**
     * @class Represents a projectile fired from a weapon.
     * @param {ProjectileClass} projectileClass The class of the projectile defining its general properties.
     * @param {Float32Array} [positionMatrix] The transformation matrix describing the initial position of the projectile.
     * @param {Float32Array} [orientationMatrix] The transformation matrix describing the initial oriantation of the projectile.
     * @param {Spacecraft} [spacecraft] The spacecraft which fired the projectile.
     * @param {Force} [startingForce] A force that will be applied to the (physical model of) projectile to kick off its movement.
     */
    function Projectile(projectileClass, positionMatrix, orientationMatrix, spacecraft, startingForce) {
        /**
         * The class storing the general characteristics of this projectile.
         * @type ProjectileClass
         */
        this._class = null;
        /**
         * The renderable node that represents this projectile in a scene.
         * @type RenderableObject
         */
        this._visualModel = null;
        /**
         * The object that represents and simulates the physical behaviour of
         * this projectile.
         * @type PhysicalObject
         */
        this._physicalModel = null;
        /**
         * The amount of time this projectile has left to "live", in milliseconds.
         * @type Number
         */
        this._timeLeft = 0;
        /**
         * The spacecraft that originally fired this projectile. It will be 
         * excluded from hit check so that a projectile cannot hit the same craft
         * it was fired from.
         * @type Spacecraft
         */
        this._origin = null;
        if (projectileClass) {
            this.init(projectileClass, positionMatrix, orientationMatrix, spacecraft, startingForce);
        }
    }
    /**
     * @param {ProjectileClass} projectileClass The class of the projectile defining its general properties.
     * @param {Float32Array} [positionMatrix] The transformation matrix describing the initial position of the projectile.
     * @param {Float32Array} [orientationMatrix] The transformation matrix describing the initial oriantation of the projectile.
     * @param {Spacecraft} [spacecraft] The spacecraft which fired the projectile.
     * @param {Force} [startingForce] A force that will be applied to the (physical model of) projectile to kick off its movement.
     */
    Projectile.prototype.init = function (projectileClass, positionMatrix, orientationMatrix, spacecraft, startingForce) {
        this._class = projectileClass;
        if (!this._physicalModel) {
            this._physicalModel = new physics.PhysicalObject();
        }
        this._physicalModel.init(
                projectileClass.getMass(),
                positionMatrix || mat.identity4(),
                orientationMatrix || mat.identity4(),
                mat.scaling4(projectileClass.getSize()),
                spacecraft ? spacecraft.getVelocityMatrix() : mat.null4(),
                [],
                true);
        this._timeLeft = projectileClass.getDuration();
        this._origin = spacecraft;
        // kick off the movement of the projectile with the supplied force
        if (startingForce) {
            this._physicalModel.addForce(startingForce);
        }
    };
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
     * @param {Boolean} [wireframe=false] Whether to create the model in wireframe mode
     */
    Projectile.prototype._createVisualModel = function (wireframe) {
        if (!this._visualModel) {
            this._visualModel = new renderableObjects.Billboard();
        }
        this._visualModel.init(
                this._class.getModel(),
                this._class.getShader(),
                this._class.getTexturesOfTypes(this._class.getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                this._class.getSize(),
                wireframe,
                this._physicalModel.getPositionMatrix(),
                this._physicalModel.getOrientationMatrix(),
                this._class.getInstancedShader());
    };
    /**
     * Returns the visual model of the projectile.
     * @returns {Billboard}
     */
    Projectile.prototype.getVisualModel = function () {
        return this._visualModel;
    };
    /**
     * Translates the position of the projectile by the given vector.
     * @param {Number[3]} v A 3D vector.
     */
    Projectile.prototype.moveByVector = function (v) {
        this._physicalModel.moveByVector(v);
    };
    /**
     * Adds a renderable node representing this projectile to the passed scene.
     * @param {Scene} scene The scene to which to add the renderable object presenting the projectile.
     * @param {Boolean} [wireframe=false] Whether to add the model for wireframe rendering
     * @param {Function} [callback] If given, this function will be executed right after the projectile is addded to the scene, with the 
     * visual model of the projectile passed to it as its only argument
     */
    Projectile.prototype.addToScene = function (scene, wireframe, callback) {
        resources.executeWhenReady(function () {
            this._createVisualModel(wireframe);
            scene.addObject(this._visualModel, _minimumProjectileCountForInstancing);
            if (callback) {
                callback(this._visualModel);
            }
        }.bind(this));
    };
    /**
     * Adds the resources required to render this projectile to the passed scene,
     * so they get loaded at the next resource load as well as added to any context
     * the scene is added to.
     * @param {Scene} scene
     * @param {Boolean} [wireframe=false] Whether to add the model resource for wireframe rendering
     */
    Projectile.prototype.addResourcesToScene = function (scene, wireframe) {
        var exp, resourceID = PROJECTILE_RESOURCE_ID_PREFIX + this._class.getName();
        this._class.acquireResources();
        resources.executeWhenReady(function () {
            if (!scene.hasResourcesOfObject(resourceID)) {
                this._createVisualModel(wireframe);
                scene.addResourcesOfObject(this._visualModel, resourceID);
                exp = new explosion.Explosion(this._class.getExplosionClass(), mat.identity4(), mat.identity4(), [0, 0, 0], true);
                exp.addResourcesToScene(scene);
            }
        }.bind(this));
    };
    /**
     * Simulates the movement of the projectile and checks if it hit any objects.
     * @param {Number} dt The passed time since the last simulation in milliseconds.
     * @param {Octree} hitObjectOctree The root node of the octree that is used to spatially partition the spacecrafts this projectile can
     * hit.
     */
    Projectile.prototype.simulate = function (dt, hitObjectOctree) {
        var i, hitObjects,
                positionVectorInWorldSpace, relativeVelocityDirectionInObjectSpace, velocityVectorInWorldSpace,
                relativeVelocityVectorInWorldSpace, relativeVelocity, relativeVelocityDirectionInWorldSpace,
                exp, physicalHitObject, hitPositionVectorInObjectSpace, hitPositionVectorInWorldSpace, relativeHitPositionVectorInWorldSpace, hitCheckDT;
        if (this.canBeReused()) {
            return;
        }
        // avoid hit checking right after the projectile is fired, as it could hit the firing ship
        hitCheckDT = Math.min(dt, this._class.getDuration() - this._timeLeft);
        this._timeLeft -= dt;
        if (this._timeLeft > 0) {
            this._physicalModel.simulate(dt);
            this._visualModel.setPositionMatrix(this._physicalModel.getPositionMatrix());
            this._visualModel.setOrientationMatrix(this._physicalModel.getOrientationMatrix());
            positionVectorInWorldSpace = mat.translationVector3(this._physicalModel.getPositionMatrix());
            velocityVectorInWorldSpace = mat.translationVector3(this._physicalModel.getVelocityMatrix());
            hitObjects = hitObjectOctree.getObjects(
                    Math.min(positionVectorInWorldSpace[0], positionVectorInWorldSpace[0] - velocityVectorInWorldSpace[0] * hitCheckDT / 1000),
                    Math.max(positionVectorInWorldSpace[0], positionVectorInWorldSpace[0] - velocityVectorInWorldSpace[0] * hitCheckDT / 1000),
                    Math.min(positionVectorInWorldSpace[1], positionVectorInWorldSpace[1] - velocityVectorInWorldSpace[1] * hitCheckDT / 1000),
                    Math.max(positionVectorInWorldSpace[1], positionVectorInWorldSpace[1] - velocityVectorInWorldSpace[1] * hitCheckDT / 1000),
                    Math.min(positionVectorInWorldSpace[2], positionVectorInWorldSpace[2] - velocityVectorInWorldSpace[2] * hitCheckDT / 1000),
                    Math.max(positionVectorInWorldSpace[2], positionVectorInWorldSpace[2] - velocityVectorInWorldSpace[2] * hitCheckDT / 1000));
            // checking for hits
            for (i = 0; i < hitObjects.length; i++) {
                if (_showHitboxesForHitchecks) {
                    hitObjects[i].showHitbox();
                }
                physicalHitObject = hitObjects[i].getPhysicalModel();
                if (physicalHitObject && (_isSelfFireEnabled || (hitObjects[i] !== this._origin))) {
                    hitPositionVectorInObjectSpace = physicalHitObject.checkHit(positionVectorInWorldSpace, velocityVectorInWorldSpace, hitCheckDT);
                    if (hitPositionVectorInObjectSpace) {
                        relativeVelocityVectorInWorldSpace = vec.diff3(velocityVectorInWorldSpace, mat.translationVector3(physicalHitObject.getVelocityMatrix()));
                        relativeVelocityDirectionInWorldSpace = vec.normal3(relativeVelocityVectorInWorldSpace);
                        relativeVelocity = vec.length3(relativeVelocityVectorInWorldSpace);
                        relativeVelocityDirectionInObjectSpace = vec.mulVec3Mat4(relativeVelocityDirectionInWorldSpace, mat.inverseOfRotation4(hitObjects[i].getVisualModel().getOrientationMatrix()));
                        hitPositionVectorInWorldSpace = vec.mulVec4Mat4(hitPositionVectorInObjectSpace, hitObjects[i].getVisualModel().getModelMatrix());
                        relativeHitPositionVectorInWorldSpace = vec.diff3(hitPositionVectorInWorldSpace, mat.translationVector3(physicalHitObject.getPositionMatrix()));
                        physicalHitObject.addForceAndTorque(relativeHitPositionVectorInWorldSpace, relativeVelocityDirectionInWorldSpace, relativeVelocity * this._physicalModel.getMass() * 1000 / _momentDuration, _momentDuration);
                        exp = new explosion.Explosion(this._class.getExplosionClass(), mat.translation4v(hitPositionVectorInWorldSpace), mat.identity4(), vec.scaled3(relativeVelocityDirectionInWorldSpace, -1), true);
                        exp.addToScene(this._visualModel.getNode().getScene().getRootNode(), hitObjects[i].getSoundSource(), true);
                        hitObjects[i].damage(this._class.getDamage(), hitPositionVectorInObjectSpace, vec.scaled3(relativeVelocityDirectionInObjectSpace, -1), this._origin);
                        this._timeLeft = 0;
                        this._visualModel.markAsReusable();
                        return;
                    }
                }
            }
        } else {
            this._visualModel.markAsReusable();
        }
    };
    /**
     * Removes the renferences to the renderable and physics objects of the
     * projectile and marks it for removel / reuse.
     */
    Projectile.prototype.destroy = function () {
        this._timeLeft = 0;
        this._class = null;
        this._origin = null;
        if (this._visualModel && this._visualModel.getNode()) {
            this._visualModel.getNode().markAsReusable();
        }
        this._visualModel = null;
        this._physicalModel = null;
    };
    // #########################################################################
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
         * @type WeaponClass
         */
        this._class = weaponClass;
        /**
         * The spacecraft on which this weapon is located.
         * @type Spacecraft
         */
        this._spacecraft = spacecraft;
        /**
         * The weapon slot that this weapon occupies on the spacecraft.
         * @type WeaponSlot
         */
        this._slot = slot;
        /**
         * The time passed since the last firing in milliseconds
         * @type Number
         */
        this._cooldown = 0;
        /**
         * The renderable node that represents this weapon in a scene.
         * @type RenderableObject
         */
        this._visualModel = null;
        /**
         * Stores the calculated value of the position of the origo of the weapon in model space based on the position and orientation of
         * the weapon slot and the point of attachment. (4x4 translation matrix)
         * @type Float32Array
         */
        this._origoPositionMatrix = null;
        /**
         * Stores the calculated value of the scaling matrix of the parent spacecraft and the orientation of the weapon slot for speeding
         * up calculations.
         * @type Float32Array
         */
        this._scaledOriMatrix = null;
        /**
         * The current angles at which the weapon is positioned (if it is turnable), in radians. The first number belong to the first 
         * rotator and the second one to the second rotator.
         * @type Number[2]
         */
        this._rotationAngles = [0, 0];
        /**
         * A flag indicating whether the rotation angles of the weapon have changed in this simulation step (triggering a recalculation of
         * the respective matrices).
         * @type Boolean
         */
        this._rotationChanged = false;
        /**
         * A 4x4 matrix describing the transformation (translation and rotation) corresponding to the current position (determined by 
         * rotation angles) of the weapon, considering all the rotators. Used to transform the base point (for aiming) or the barrel
         * positions (for firing). Interim matrices (considering only some, but not all rotators) are not stored, but directly feeded to the
         * visual model as parameters when calculated.
         * @type Float32Array
         */
        this._transformMatrix = mat.identity4();
        /**
         * A shortcut flag indicating whether this weapon can rotate or is fixed in pointing to one direction.
         * @type Boolean
         */
        this._fixed = this._class.isFixed();
        /**
         * The saved value of the current aiming state of the weapon refreshed every time the weapon is rotated.
         * @type Number
         */
        this._lastAimStatus = this._fixed ? WeaponAimStatus.FIXED : WeaponAimStatus.NO_TARGET;
    }
    /**
     * Returns the weapon slot this weapon is equipped to.
     * @returns {WeaponSlot}
     */
    Weapon.prototype.getSlot = function () {
        return this._slot;
    };
    /**
     * Returns the class of the projectiles the first barrel of this weapon fires.
     * @returns {ProjectileClass}
     */
    Weapon.prototype.getProjectileClass = function () {
        return this._class.getProjectileClass();
    };
    /**
     * Returns the velocity in m/s at which the first barrel of this weapon is firing projectiles.
     */
    Weapon.prototype.getProjectileVelocity = function () {
        return this._class.getProjectileVelocity();
    };
    /**
     * Returns the relative range of the weapon, based on the first barrel, that is the farthest distance the fired projectiles will reach
     * if the weapon itself is travelling with the given speed along its firing line in world space.
     * @param {Number} baseSpeed
     * @returns {Number}
     */
    Weapon.prototype.getRange = function (baseSpeed) {
        return (this._class.getProjectileVelocity() + (baseSpeed || 0)) * this._class.getProjectileClass().getDuration() / 1000;
    };
    /**
     * Return the duration this weapon needs between shots, in milliseconds.
     * @returns {Number}
     */
    Weapon.prototype.getCooldown = function () {
        return this._class.getCooldown();
    };
    /**
     * Returns the calculated value of the position of the origo of the weapon in model space based on the position and orientation of
     * the weapon slot and the point of attachment. (4x4 translation matrix)
     * @returns {Float32Array}
     */
    Weapon.prototype.getOrigoPositionMatrix = function () {
        this._origoPositionMatrix = this._origoPositionMatrix || mat.translatedByVector(
                this._slot ? this._slot.positionMatrix : mat.IDENTITY4,
                vec.mulVec3Mat4(
                        vec.scaled3(this._class.getAttachmentPoint(), -1),
                        mat.prod3x3SubOf4(
                                mat.scaling4(this._class.getModel().getScale() / (this._spacecraft ? this._spacecraft.getPhysicalScalingMatrix()[0] : 1)),
                                this._slot ? this._slot.orientationMatrix : mat.IDENTITY4)));
        return this._origoPositionMatrix;
    };
    /**
     * Returns the calculated value of the scaling matrix of the parent spacecraft and the orientation of the weapon slot.
     * @returns {Float32Array}
     */
    Weapon.prototype.getScaledOriMatrix = function () {
        this._scaledOriMatrix = this._scaledOriMatrix || mat.prod3x3SubOf4(this._visualModel.getScalingMatrix(), this._slot.orientationMatrix);
        return this._scaledOriMatrix;
    };
    /**
     * Returns whether this weapon is fixed i.e. is pointing in one fix direction and does not have any rotators.
     * @returns {Boolean}
     */
    Weapon.prototype.isFixed = function () {
        return this._fixed;
    };
    /**
     * Returns a 3D vector indicating the position of the base point of this weapon in world space.
     * @param {Float32Array} shipScaledOriMatrix A 4x4 matrix describing the scaling and rotation of the spacecraft that has this weapon.
     * it is more effective to calculate this separately once and pass it to all functions that need it.
     * @returns {Number[3]}
     */
    Weapon.prototype.getBasePointPosVector = function (shipScaledOriMatrix) {
        var
                basePointPosVector = this._class.getBasePoint(),
                weaponSlotPosVector = vec.mulVec3Mat4(mat.translationVector3(this.getOrigoPositionMatrix()), shipScaledOriMatrix);
        vec.add3(weaponSlotPosVector, this._spacecraft.getPhysicalPositionVector());
        basePointPosVector = vec.mulVec4Mat4(basePointPosVector, this._transformMatrix);
        basePointPosVector = vec.mulVec3Mat4(basePointPosVector, mat.prod3x3SubOf4(this.getScaledOriMatrix(), shipScaledOriMatrix));
        vec.add3(basePointPosVector, weaponSlotPosVector);
        return basePointPosVector;
    };
    /**
     * Returns a 4x4 rotation matrix describing the orientation of projectiles fired by this weapon in world space.
     * @returns {Float32Array}
     */
    Weapon.prototype.getProjectileOrientationMatrix = function () {
        var m = mat.prod3x3SubOf4(this._slot.orientationMatrix, this._spacecraft.getPhysicalOrientationMatrix());
        if (!this._fixed) {
            m = mat.prod3x3SubOf4(this._transformMatrix, m);
        }
        return m;
    };
    /**
     * Marks the resources necessary to render this weapon for loading.
     * @param {Object} params
     */
    Weapon.prototype.acquireResources = function (params) {
        this._class.acquireResources(params);
    };
    /**
     * @typedef {Object} Weapon~AddToSceneParams
     * @property {String} [shaderName] If given, the original shader of this weapon will be substituted by the shader with this name.
     * @property {Float32Array} [orientationMatrix]
     */
    /**
     * @typedef {Function} logic~addToSceneCallback
     * @param {ParameterizedMesh} model
     */
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
     * @param {Weapon~AddToSceneParams} [params] 
     * @param {logic~addToSceneCallback} [callback]
     */
    Weapon.prototype.addToScene = function (parentNode, lod, wireframe, params, callback) {
        var i, n;
        this.acquireResources({omitShader: !!params.shaderName});
        if (params.shaderName) {
            graphics.getShader(params.shaderName);
        }
        resources.executeWhenReady(function () {
            var visualModel, scale, parameterArrays = {};
            application.log_DEBUG("Adding weapon (" + this._class.getName() + ") to scene...", 2);
            scale = this._class.getModel().getScale() / parentNode.getRenderableObject().getScalingMatrix()[0];
            // setting up parameter array declarations (name: type)
            parameterArrays[_groupTransformsArrayName] = managedGL.ShaderVariableType.MAT4;
            if (graphics.areLuminosityTexturesAvailable()) {
                parameterArrays[_luminosityFactorsArrayName] = managedGL.ShaderVariableType.FLOAT;
            }
            visualModel = new renderableObjects.ParameterizedMesh(
                    this._class.getModel(),
                    params.shaderName ? graphics.getManagedShader(params.shaderName) : this._class.getShader(),
                    this._class.getTexturesOfTypes(this._class.getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                    this._slot ? this.getOrigoPositionMatrix() : mat.identity4(),
                    params.orientationMatrix || (this._slot ? this._slot.orientationMatrix : mat.identity4()),
                    mat.scaling4(scale),
                    (wireframe === true),
                    lod,
                    parameterArrays);
            parentNode.addSubnode(new sceneGraph.RenderableNode(visualModel));
            // setting the starting values of the parameter arrays
            // setting an identity transformation for all transform groups
            for (i = 0, n = graphics.getMaxGroupTransforms(); i < n; i++) {
                visualModel.setMat4Parameter(
                        _groupTransformsArrayName,
                        i,
                        mat.identity4());
            }
            // setting the default luminosity for all luminosity groups
            if (graphics.areLuminosityTexturesAvailable()) {
                for (i = 0, n = graphics.getMaxLuminosityFactors(); i < n; i++) {
                    visualModel.setFloatParameter(
                            _luminosityFactorsArrayName,
                            i,
                            this._class.getDefaultGroupLuminosity(i));
                }
            }
            if (!this._visualModel) {
                this._visualModel = visualModel;
            }
            if (callback) {
                callback(visualModel);
            }
        }.bind(this));
    };
    /**
     * Returns the renderable object representing the muzzle flash that is visible
     * when the barrel having the passed index is firing a projectile.
     * @param {Number} barrelIndex
     * @param {Number[3] relativeBarrelPosVector The position of the barrel (muzzle) in object-space (where the object is the spacecraft
     * having this weapon)
     * @returns {Particle}
     */
    Weapon.prototype._getMuzzleFlashForBarrel = function (barrelIndex, relativeBarrelPosVector) {
        var
                projectileClass = this._class.getBarrel(barrelIndex).getProjectileClass(),
                muzzleFlashPosMatrix = mat.translation4v(relativeBarrelPosVector),
                particle = _particlePool.getObject();
        renderableObjects.initDynamicParticle(
                particle,
                projectileClass.getMuzzleFlash().getModel(),
                projectileClass.getMuzzleFlash().getShader(),
                projectileClass.getMuzzleFlash().getTexturesOfTypes(projectileClass.getMuzzleFlash().getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                projectileClass.getMuzzleFlash().getColor(),
                projectileClass.getMuzzleFlash().getSize(),
                muzzleFlashPosMatrix,
                projectileClass.getMuzzleFlash().getDuration() || config.getSetting(config.BATTLE_SETTINGS.DEFAULT_MUZZLE_FLASH_DURATION),
                projectileClass.getMuzzleFlash().getInstancedShader());
        return particle;
    };
    /**
     * 
     * @param {Scene} scene
     * @param {Number} barrelIndex
     * @param {String} resourceID
     * @returns {Function}
     */
    Weapon.prototype.getResourceAdderFunction = function (scene, barrelIndex, resourceID) {
        return function () {
            var particle;
            if (!scene.hasResourcesOfObject(resourceID)) {
                particle = this._getMuzzleFlashForBarrel(barrelIndex, [0, 0, 0]);
                scene.addResourcesOfObject(particle);
            }
        }.bind(this);
    };
    /**
     * Adds the resources required to render the projeciles fired by this weapon
     * to the passed scene, so they get loaded at the next resource load as well 
     * as added to any context the scene is added to.
     * @param {Scene} scene
     */
    Weapon.prototype.addProjectileResourcesToScene = function (scene) {
        var i, projectile, barrels, resourceID = WEAPON_RESOURCE_ID_PREFIX + this._class.getName();
        barrels = this._class.getBarrels();
        for (i = 0; i < barrels.length; i++) {
            projectile = new Projectile(barrels[i].getProjectileClass());
            projectile.addResourcesToScene(scene);
            resources.executeWhenReady(this.getResourceAdderFunction(scene, i, resourceID).bind(this));
        }
        resources.executeWhenReady(function () {
            scene.addResourcesOfObject(null, resourceID);
        });
    };
    /**
     * Does all the needed updates to the weapon's state for one simulation step.
     * @param {Number} dt The time elapsed since the last simulation step, in milliseconds
     */
    Weapon.prototype.simulate = function (dt) {
        var i, rotators;
        this._cooldown = Math.min(this._cooldown + dt, this._class.getCooldown());
        // updating the group transform matrices of the visual model if needed as well as recalculating the final transform matrix
        if (this._rotationChanged) {
            mat.setIdentity4(this._transformMatrix);
            rotators = this._class.getRotators();
            for (i = 0; i < rotators.length; i++) {
                mat.rotateAroundPoint4(
                        this._transformMatrix,
                        vec.mulVec3Mat4(rotators[i].center, this._transformMatrix),
                        vec.mulVec3Mat4(rotators[i].axis, this._transformMatrix),
                        this._rotationAngles[i]);
                this._visualModel.setMat4Parameter(
                        _groupTransformsArrayName,
                        rotators[i].transformGroupIndex,
                        this._transformMatrix);
            }
            this._rotationChanged = false;
        }
    };
    /**
     * Fires the weapon and adds the projectiles it fires (if any) to the passed pool.
     * @param {Float32Array} shipScaledOriMatrix A 4x4 matrix describing the scaling and rotation of the spacecraft having this weapon - it
     * is more effective to calculate it once for a spacecraft and pass it to all weapons as a parameter.
     * @param {Boolean} onlyIfAimedOrFixed The weapon only fires if it is fixed (cannot be rotated) or if it is aimed at its current target
     * and it is in range (based on the last aiming status of the weapon)
     * @param {SoundSource} shipSoundSource The sound source belonging to the spacecraft that fires this weapon
     * @returns {Number} How many projectiles did the weapon fire.
     */
    Weapon.prototype.fire = function (shipScaledOriMatrix, onlyIfAimedOrFixed, shipSoundSource) {
        var i, p, result,
                weaponSlotPosVector, weaponSlotPosMatrix,
                projectilePosMatrix, projectileOriMatrix,
                projectileClass, barrelPosVector, muzzleFlash, barrels, projectileLights, projClassName,
                soundPosition,
                scene = this._visualModel.getNode().getScene();
        if (onlyIfAimedOrFixed && (this._lastAimStatus !== WeaponAimStatus.FIXED) && (this._lastAimStatus !== WeaponAimStatus.AIMED_IN_RANGE)) {
            return 0;
        }
        // check cooldown
        if (this._cooldown >= this._class.getCooldown()) {
            this._cooldown = 0;
            // cache the matrices valid for the whole weapon
            weaponSlotPosVector = vec.mulVec3Mat4(mat.translationVector3(this.getOrigoPositionMatrix()), shipScaledOriMatrix);
            weaponSlotPosMatrix = mat.translatedByVector(this._spacecraft.getPhysicalPositionMatrix(), weaponSlotPosVector);
            projectileOriMatrix = this.getProjectileOrientationMatrix();
            barrels = this._class.getBarrels();
            projectileLights = {};
            result = 0;
            // generate the muzzle flashes and projectiles for each barrel
            for (i = 0; i < barrels.length; i++) {
                // cache variables
                projectileClass = barrels[i].getProjectileClass();
                barrelPosVector = barrels[i].getPositionVector();
                if (!this._fixed) {
                    barrelPosVector = vec.mulVec4Mat4(barrelPosVector, this._transformMatrix);
                }
                // add the muzzle flash of this barrel
                muzzleFlash = this._getMuzzleFlashForBarrel(i, barrelPosVector);
                barrelPosVector = vec.mulVec3Mat4(barrelPosVector, mat.prod3x3SubOf4(this.getScaledOriMatrix(), shipScaledOriMatrix));
                projectilePosMatrix = mat.translatedByVector(weaponSlotPosMatrix, barrelPosVector);
                this._visualModel.getNode().addSubnode(new sceneGraph.RenderableNode(muzzleFlash), false, _minimumMuzzleFlashParticleCountForInstancing);
                // add the projectile of this barrel
                p = _projectilePool.getObject();
                p.init(
                        projectileClass,
                        projectilePosMatrix,
                        projectileOriMatrix,
                        this._spacecraft,
                        new physics.Force("", barrels[i].getForceForDuration(_momentDuration), [projectileOriMatrix[4], projectileOriMatrix[5], projectileOriMatrix[6]], _momentDuration));
                p.addToScene(scene);
                // creating the light source / adding the projectile to the emitting objects if a light source for this class of fired projectiles has already
                // been created, so that projectiles from the same weapon and of the same class only use one light source object
                if (!projectileLights[projectileClass.getName()]) {
                    projectileLights[projectileClass.getName()] = new lights.PointLightSource(projectileClass.getLightColor(), projectileClass.getLightIntensity(), vec.NULL3, [p.getVisualModel()]);
                } else {
                    projectileLights[projectileClass.getName()].addEmittingObject(p.getVisualModel());
                }
                // create the counter-force affecting the firing ship
                this._spacecraft.getPhysicalModel().addForceAndTorque(
                        vec.diff3(
                                mat.translationVector3(projectilePosMatrix),
                                mat.translationVector3(this._spacecraft.getPhysicalPositionMatrix())),
                        mat.getRowB43Neg(projectileOriMatrix),
                        barrels[i].getForceForDuration(_momentDuration),
                        _momentDuration
                        );
                result++;
            }
            for (projClassName in projectileLights) {
                if (projectileLights.hasOwnProperty(projClassName)) {
                    scene.addPointLightSource(projectileLights[projClassName], constants.PROJECTILE_LIGHT_PRIORITY);
                }
            }
            if (!shipSoundSource) {
                soundPosition = mat.translationVector3(p.getVisualModel().getPositionMatrixInCameraSpace(scene.getCamera()));
            }
            this._class.playFireSound(soundPosition, shipSoundSource, _fireSoundStackingTimeThreshold, _fireSoundStackingVolumeFactor);
            return result;
        }
        return 0;
    };
    /**
     * Sets new rotation angles (instantly) for this weapon (if it can be rotated)
     * @param {Number} angleOne The angle to be set for the first rotator, in degrees
     * @param {Number} angleTwo The angle to be set for the second rotator, in degrees
     */
    Weapon.prototype.setRotation = function (angleOne, angleTwo) {
        if (!this._fixed) {
            this._rotationAngles[0] = Math.radians(angleOne);
            this._rotationAngles[1] = Math.radians(angleTwo);
            this._rotationChanged = true;
        }
    };
    /**
     * Rotates the weapon towards a desired angle according to its rotation speed and the passed elapsed time.
     * @param {Number} angleOne The angle towards which to rotate the first rotator, in radians
     * @param {Number} angleTwo The angle towards which to rotate the second rotator, in radians
     * @param {Number} turnThreshold The weapon will not be rotated if it is closer to the desired angle than this value (in radians)
     * @param {Number} fireThreshold The weapon will only set an aimed status if it is closer to the desired angle than this value (in 
     * radians)
     * @param {Number} dt The elapsed time, in milliseconds
     */
    Weapon.prototype.rotateTo = function (angleOne, angleTwo, turnThreshold, fireThreshold, dt) {
        var angleDifference, rotators, i, rotationAmount;
        if (!this._fixed) {
            this._lastAimStatus = WeaponAimStatus.AIMED_IN_RANGE;
            rotators = this._class.getRotators();
            for (i = 0; i < rotators.length; i++) {
                switch (i) {
                    case 0:
                        angleDifference = angleOne - this._rotationAngles[0];
                        // roll-yaw type weapons can yaw in the opposite direction if that results in less rolling
                        if (this._class.getRotationStyle() === classes.WeaponRotationStyle.ROLL_YAW) {
                            if (Math.abs(angleDifference - Math.sign(angleDifference) * Math.PI) < Math.abs(angleDifference)) {
                                angleDifference -= Math.sign(angleDifference) * Math.PI;
                                angleTwo = -angleTwo;
                            }
                        }
                        break;
                    case 1:
                        angleDifference = angleTwo - this._rotationAngles[1];
                        break;
                    default:
                        application.crash();
                }
                // if the weapon can freely turn around in 360 degrees, it is faster to turn in the other direction in case the angle 
                // difference is larger than 180 degrees
                if (!rotators[i].restricted) {
                    if (angleDifference > Math.PI) {
                        angleDifference -= 2 * Math.PI;
                    } else if (angleDifference < -Math.PI) {
                        angleDifference += 2 * Math.PI;
                    }
                }
                // perform the actual turn, if needed
                rotationAmount = 0;
                if (Math.abs(angleDifference) > turnThreshold) {
                    rotationAmount = rotators[i].rotationRate * dt / 1000;
                    if (angleDifference > 0) {
                        this._rotationAngles[i] += Math.min(rotationAmount, angleDifference);
                    } else {
                        this._rotationAngles[i] -= Math.min(rotationAmount, -angleDifference);
                    }
                    this._rotationChanged = true;
                    if ((Math.abs(angleDifference) - rotationAmount) > fireThreshold) {
                        this._lastAimStatus = WeaponAimStatus.AIMING;
                    }
                }
                if (!rotators[i].restricted) {
                    // if the weapon can turn around in 360 degrees, make sure its angle stays in the -180,180 range
                    if (this._rotationAngles[i] > Math.PI) {
                        this._rotationAngles[i] -= 2 * Math.PI;
                    }
                    if (this._rotationAngles[i] < -Math.PI) {
                        this._rotationAngles[i] += 2 * Math.PI;
                    }
                } else {
                    // if the weapon is restricted in turning around, apply the restriction
                    if (this._rotationAngles[i] > rotators[i].range[1]) {
                        this._rotationAngles[i] = rotators[i].range[1];
                        if ((Math.abs(angleDifference) - rotationAmount) > fireThreshold) {
                            this._lastAimStatus = WeaponAimStatus.AIMING_OUT_OF_REACH;
                        }
                    }
                    if (this._rotationAngles[i] < rotators[i].range[0]) {
                        this._rotationAngles[i] = rotators[i].range[0];
                        if ((Math.abs(angleDifference) - rotationAmount) > fireThreshold) {
                            this._lastAimStatus = WeaponAimStatus.AIMING_OUT_OF_REACH;
                        }
                    }
                }
            }
        }
    };
    /**
     * Rotates the weapon towards the angles necessary to make it point towards the passed position. (based on the weapon's rotation speed
     * and the elapsed time)
     * @param {Number[3]} targetPositionVector The position towards which the weapon should aim, in world-space coordinates.
     * @param {Number} turnThreshold The weapon will rotate if the angle between its current direction and the one pointing towards the given
     * target is greater than this value, in radians.
     * @param {Number} fireThreshold The weapon will set an aimed status if the angle between its current direction and the one pointing 
     * towards the given target is less than this value, in radians.
     * @param {Float32Array} shipScaledOriMatrix A 4x4 transformation matrix describing the scalin and rotation of the spacecraft that has
     * this weapon.
     * @param {Number} dt The elapsed time, in milliseconds.
     */
    Weapon.prototype.aimTowards = function (targetPositionVector, turnThreshold, fireThreshold, shipScaledOriMatrix, dt) {
        var basePointPosVector, vectorToTarget, yawAndPitch, rollAndYaw, inRange;
        if (!this._fixed) {
            // as a basis for calculating the direction pointing towards the target, the base point of the weapon is considered (in world 
            // space, transformed according to the current rotation angles of the weapon)
            basePointPosVector = this.getBasePointPosVector(shipScaledOriMatrix);
            // calculate the vector pointing towards the target in world coordinates
            vectorToTarget = vec.diff3(targetPositionVector, basePointPosVector);
            // transform to object space - relative to the weapon
            vectorToTarget = vec.mulMat4Vec3(this._spacecraft.getPhysicalOrientationMatrix(), vectorToTarget);
            vectorToTarget = vec.mulMat4Vec3(this._slot.orientationMatrix, vectorToTarget);
            inRange = vec.length3(vectorToTarget) <= this.getRange();
            vec.normalize3(vectorToTarget);
            switch (this._class.getRotationStyle()) {
                case classes.WeaponRotationStyle.YAW_PITCH:
                    yawAndPitch = vec.getYawAndPitch(vectorToTarget);
                    this.rotateTo(-yawAndPitch.yaw, -yawAndPitch.pitch, turnThreshold, fireThreshold, dt);
                    break;
                case classes.WeaponRotationStyle.ROLL_YAW:
                    rollAndYaw = vec.getRollAndYaw(vectorToTarget);
                    this.rotateTo(rollAndYaw.roll, rollAndYaw.yaw, turnThreshold, fireThreshold, dt);
                    break;
                default:
                    application.crash();
            }
            if (!inRange && this._lastAimStatus === WeaponAimStatus.AIMED_IN_RANGE) {
                this._lastAimStatus = WeaponAimStatus.AIMED_OUT_OF_RANGE;
            }
        }
    };
    /**
     * Rotates the weapon towards its default rotation angles according to its rotation speed and the passed elapsed time.
     * @param {Number} threshold The weapon will not be rotated if it is closer to the desired angle than this value (in radians)
     * @param {Number} dt The elapsed time, in milliseconds
     */
    Weapon.prototype.rotateToDefaultPosition = function (threshold, dt) {
        var rotators;
        if (!this._fixed) {
            rotators = this._class.getRotators();
            this.rotateTo(rotators[0].defaultAngle, rotators[1].defaultAngle, threshold, 0, dt);
            this._lastAimStatus = WeaponAimStatus.NO_TARGET;
        }
    };
    /**
     * Returns the amount of score points to be added to the total score value of spacecrafts that have this weapon equipped
     * @returns {Number}
     */
    Weapon.prototype.getScoreValue = function () {
        return this._class.getScoreValue();
    };
    /**
     * Removes all references stored by this object
     */
    Weapon.prototype.destroy = function () {
        this._class = null;
        this._spacecraft = null;
        this._slot = null;
        if (this._visualModel) {
            this._visualModel.markAsReusable();
        }
        this._visualModel = null;
    };
    // #########################################################################
    /**
     * @class Represents a thruster on a spacecraft.
     * @param {PropulsionClass} propulsionClass
     * @param {ThusterSlot} slot The thruster slot to which this thruster is
     * equipped.
     */
    function Thruster(propulsionClass, slot) {
        /**
         * @type PropulsionClass
         */
        this._propulsionClass = propulsionClass;
        /**
         * The thruster slot to which this thruster is equipped.
         * @type ThrusterSlot
         */
        this._slot = slot;
        /**
         * The renderable object that is used to render the thruster burn particle.
         * @type RenderableObject
         */
        this._visualModel = null;
        /**
         * The renderable object corresponding to the ship this thruster is located on.
         * @type RenderableObject
         */
        this._shipModel = null;
        /**
         * The level of intensity this thuster is currently used with. (0 is off, 1 is maximum)
         * @type Number
         */
        this._burnLevel = 0;
        /**
         * Maximum thrust for acceleration is applied at this burn level. (cache variable)
         * @type Number
         */
        this._maxMoveBurnLevel = this._propulsionClass.getMaxMoveBurnLevel();
    }
    /**
     * Adds a renderable node representing the particle that is rendered to show
     * the burn level of this thruster to the scene under the passed parent node.
     * @param {ParameterizedMesh} parentNode The parent node to which to attach the
     * particle in the scene. (normally the renderable node of the spacecraft
     * that has this thruster)
     */
    Thruster.prototype.addToScene = function (parentNode) {
        var visualModel;
        this._propulsionClass.acquireResources();
        resources.executeWhenReady(function () {
            visualModel = renderableObjects.staticParticle(
                    this._propulsionClass.getThrusterBurnParticle().getModel(),
                    this._propulsionClass.getThrusterBurnParticle().getShader(),
                    this._propulsionClass.getThrusterBurnParticle().getTexturesOfTypes(this._propulsionClass.getThrusterBurnParticle().getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                    this._propulsionClass.getThrusterBurnParticle().getColor(),
                    this._slot.size,
                    mat.translation4v(this._slot.positionVector),
                    this._propulsionClass.getThrusterBurnParticle().getInstancedShader());
            visualModel.setRelativeSize(0);
            parentNode.addSubnode(new sceneGraph.RenderableNode(visualModel, false, config.getSetting(config.BATTLE_SETTINGS.MINIMUM_THRUSTER_PARTICLE_COUNT_FOR_INSTANCING)));
            if (!this._visualModel) {
                this._visualModel = visualModel;
                this._shipModel = parentNode.getRenderableObject();
            }
        }.bind(this));
    };
    /**
     * Updates the visual representation of this thruster to represent the current
     * burn level.
     */
    Thruster.prototype._updateVisuals = function () {
        // set the size of the particle that shows the burn
        this._visualModel.setRelativeSize(this._burnLevel);
        // set the strength of which the luminosity texture is lighted
        if (graphics.areLuminosityTexturesAvailable()) {
            this._shipModel.setFloatParameter(
                    _luminosityFactorsArrayName,
                    this._slot.group,
                    Math.min(1.0, this._burnLevel / this._maxMoveBurnLevel));
        }
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
     * Removes all references stored by this object
     */
    Thruster.prototype.destroy = function () {
        this._propulsionClass = null;
        this._slot = null;
        this._visualModel = null;
        this._shipModel = null;
    };
    // #########################################################################
    /**
     * @class Represents the propulsion system equipped to a spacecraft.
     * @param {PropulsionClass} propulsionClass The class describing the general
     * properties of this propulsion.
     * @param {PhysicalObject} drivenPhysicalObject The physical object that is
     * driven by this propulsion (the physical model of the spacecraft)
     */
    function Propulsion(propulsionClass, drivenPhysicalObject) {
        /**
         * The class describing the general properties of this propulsion.
         * @type PropulsionClass
         */
        this._class = propulsionClass;
        /**
         * The physical object that is driven by this propulsion (the physical 
         * model of the spacecraft)
         * @type PhysicalObject
         */
        this._drivenPhysicalObject = drivenPhysicalObject;
        /**
         * An associative array containing the burn level and nozzles associated
         * with each thruster use command.
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
        /**
         * Sound clip used for playing the thruster sound effect for this propulsion.
         * @type SoundClip
         */
        this._thrusterSoundClip = null;
    }
    /**
     * 
     */
    Propulsion.prototype.acquireResources = function () {
        this._class.acquireResources();
    };
    /**
     * Returns the thrust power of this propulsion system, in newtowns.
     * @returns {Number}
     */
    Propulsion.prototype.getThrust = function () {
        return this._class.getThrust();
    };
    /**
     * Returns the angular thrust power of this propulsion system, measured in
     * kg*rad/s^2.
     * @returns {Number}
     */
    Propulsion.prototype.getAngularThrust = function () {
        return this._class.getAngularThrust();
    };
    /**
     * Returns the maximum move burn level of the class of this propulsion
     * @returns {Number}
     */
    Propulsion.prototype.getMaxMoveBurnLevel = function () {
        return this._class.getMaxMoveBurnLevel();
    };
    /**
     * Returns the maximum turn burn level of the class of this propulsion
     * @returns {Number}
     */
    Propulsion.prototype.getMaxTurnBurnLevel = function () {
        return this._class.getMaxTurnBurnLevel();
    };
    /**
     * Creates and adds thruster objects to all the thruster slots in the passed
     * array
     * @param {ThrusterSlot[]} slots
     */
    Propulsion.prototype.addThrusters = function (slots) {
        var i, j, thruster;
        for (i = 0; i < slots.length; i++) {
            thruster = new Thruster(this._class, slots[i]);
            for (j = 0; j < slots[i].uses.length; j++) {
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
        var use, i;
        for (use in this._thrusterUses) {
            if (this._thrusterUses.hasOwnProperty(use)) {
                for (i = 0; i < this._thrusterUses[use].thrusters.length; i++) {
                    this._thrusterUses[use].thrusters[i].addToScene(parentNode);
                }
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
        var i;
        this._thrusterUses[use].burn += value;
        for (i = 0; i < this._thrusterUses[use].thrusters.length; i++) {
            this._thrusterUses[use].thrusters[i].addBurn(value);
        }
    };
    /**
     * Resets the all the thruster burn levels to zero.
     */
    Propulsion.prototype.resetThrusterBurn = function () {
        var use, i;
        for (use in this._thrusterUses) {
            if (this._thrusterUses.hasOwnProperty(use)) {
                this._thrusterUses[use].burn = 0;
                for (i = 0; i < this._thrusterUses[use].thrusters.length; i++) {
                    this._thrusterUses[use].thrusters[i].resetBurn();
                }
            }
        }
    };
    /**
     * Returns the (relative) volume at which the thruster sound effect should be played for this propulsion accoding to its current
     * state (how much its thrusters are firing)
     * @returns {Number}
     */
    Propulsion.prototype._getSoundVolume = function () {
        var move, turn, max;
        max = this._class.getMaxMoveBurnLevel();
        move = max ? Math.max(
                this._thrusterUses.forward.burn, this._thrusterUses.reverse.burn,
                this._thrusterUses.strafeRight.burn, this._thrusterUses.strafeLeft.burn,
                this._thrusterUses.raise.burn, this._thrusterUses.lower.burn) / max : 0;
        max = this._class.getMaxTurnBurnLevel();
        turn = max ? Math.max(
                this._thrusterUses.yawRight.burn, this._thrusterUses.yawLeft.burn,
                this._thrusterUses.pitchUp.burn, this._thrusterUses.pitchDown.burn,
                this._thrusterUses.rollRight.burn, this._thrusterUses.rollLeft.burn) / max : 0;
        max = Math.round((move + turn) * THRUSTER_SOUND_VOLUME_GRADES) / THRUSTER_SOUND_VOLUME_GRADES;
        return max;
    };
    /**
     * Applies the forces and torques that are created by this propulsion system
     * to the physical object it drives.
     * @param {SoundSource} spacecraftSoundSource The sound source belonging to the spacecraft that has this propulsion equipped
     * @param {Boolean} [applyForces=true] If false, the forces and torques generated by the thrusters are not applied to the spacecraft 
     * (only e.g. sound effect volume is updated)
     */
    Propulsion.prototype.simulate = function (spacecraftSoundSource, applyForces) {
        var directionVector, yawAxis, pitchAxis;
        if (applyForces !== false) {
            directionVector = mat.getRowB4(this._drivenPhysicalObject.getOrientationMatrix());
            yawAxis = mat.getRowC4(this._drivenPhysicalObject.getOrientationMatrix());
            pitchAxis = mat.getRowA4(this._drivenPhysicalObject.getOrientationMatrix());
            if (this._thrusterUses.forward.burn > 0) {
                this._drivenPhysicalObject.addOrRenewForce("forwardThrust", this._class.getThrust() * this._thrusterUses.forward.burn / this._class.getMaxMoveBurnLevel(), directionVector);
            }
            if (this._thrusterUses.reverse.burn > 0) {
                this._drivenPhysicalObject.addOrRenewForce("reverseThrust", -this._class.getThrust() * this._thrusterUses.reverse.burn / this._class.getMaxMoveBurnLevel(), directionVector);
            }
            if (this._thrusterUses.strafeRight.burn > 0) {
                this._drivenPhysicalObject.addOrRenewForce("strafeRightThrust", this._class.getThrust() * this._thrusterUses.strafeRight.burn / this._class.getMaxMoveBurnLevel(), pitchAxis);
            }
            if (this._thrusterUses.strafeLeft.burn > 0) {
                this._drivenPhysicalObject.addOrRenewForce("strafeLeftThrust", -this._class.getThrust() * this._thrusterUses.strafeLeft.burn / this._class.getMaxMoveBurnLevel(), pitchAxis);
            }
            if (this._thrusterUses.raise.burn > 0) {
                this._drivenPhysicalObject.addOrRenewForce("raiseThrust", this._class.getThrust() * this._thrusterUses.raise.burn / this._class.getMaxMoveBurnLevel(), yawAxis);
            }
            if (this._thrusterUses.lower.burn > 0) {
                this._drivenPhysicalObject.addOrRenewForce("lowerThrust", -this._class.getThrust() * this._thrusterUses.lower.burn / this._class.getMaxMoveBurnLevel(), yawAxis);
            }
            if (this._thrusterUses.yawRight.burn > 0) {
                this._drivenPhysicalObject.addOrRenewTorque("yawRightThrust", this._class.getAngularThrust() * this._thrusterUses.yawRight.burn / this._class.getMaxTurnBurnLevel(), yawAxis);
            }
            if (this._thrusterUses.yawLeft.burn > 0) {
                this._drivenPhysicalObject.addOrRenewTorque("yawLeftThrust", -this._class.getAngularThrust() * this._thrusterUses.yawLeft.burn / this._class.getMaxTurnBurnLevel(), yawAxis);
            }
            if (this._thrusterUses.pitchUp.burn > 0) {
                this._drivenPhysicalObject.addOrRenewTorque("pitchUpThrust", -this._class.getAngularThrust() * this._thrusterUses.pitchUp.burn / this._class.getMaxTurnBurnLevel(), pitchAxis);
            }
            if (this._thrusterUses.pitchDown.burn > 0) {
                this._drivenPhysicalObject.addOrRenewTorque("pitchDownThrust", this._class.getAngularThrust() * this._thrusterUses.pitchDown.burn / this._class.getMaxTurnBurnLevel(), pitchAxis);
            }
            if (this._thrusterUses.rollRight.burn > 0) {
                this._drivenPhysicalObject.addOrRenewTorque("rollRightThrust", -this._class.getAngularThrust() * this._thrusterUses.rollRight.burn / this._class.getMaxTurnBurnLevel(), directionVector);
            }
            if (this._thrusterUses.rollLeft.burn > 0) {
                this._drivenPhysicalObject.addOrRenewTorque("rollLeftThrust", this._class.getAngularThrust() * this._thrusterUses.rollLeft.burn / this._class.getMaxTurnBurnLevel(), directionVector);
            }
        }
        if (!this._thrusterSoundClip) {
            this._thrusterSoundClip = this._class.createThrusterSoundClip(spacecraftSoundSource);
            if (this._thrusterSoundClip) {
                this._thrusterSoundClip.play();
            }
        }
        if (this._thrusterSoundClip) {
            this._thrusterSoundClip.rampVolume(this._getSoundVolume() * this._class.getThrusterSoundVolume(), THRUSTER_SOUND_VOLUME_RAMP_DURATION, true, true);
        }
    };
    /**
     * Returns the amount of score points to be added to the total score value of spacecrafts that have this propulsion equipped
     * @returns {Number}
     */
    Propulsion.prototype.getScoreValue = function () {
        return this._class.getScoreValue();
    };
    /**
     * Removes all references stored by this object
     */
    Propulsion.prototype.destroy = function () {
        this._class = null;
        this._drivenPhysicalObject = null;
        this._thrusterUses = null;
        if (this._thrusterSoundClip) {
            this._thrusterSoundClip.destroy();
            this._thrusterSoundClip = null;
        }
    };
    // #########################################################################
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
         * @type Spacecraft
         */
        this._spacecraft = spacecraft;
        /**
         * Whether automatic inertia (drift) compensation is turned on.
         * @type Boolean
         */
        this._compensated = true;
        /**
         * Whether automatic turning restriction is turned on.
         * @type Boolean
         */
        this._restricted = false;
        /**
         * The target angle in radian between the identity orientation and the
         * relative angular velocity matrix on the yawing (XY) plane. The computer
         * will use the yawing thursters to reach this angle.
         * (representing rad / physics.ANGULAR_VELOCITY_MATRIX_DURATION ms turn)
         * @type Number
         */
        this._yawTarget = 0;
        /**
         * The target angle in radian between the identity orientation and the
         * relative angular velocity matrix on the pitching (YZ) plane. The computer
         * will use the pitching thursters to reach this angle.
         * (representing rad / physics.ANGULAR_VELOCITY_MATRIX_DURATION ms turn)
         * @type Number
         */
        this._pitchTarget = 0;
        /**
         * The target angle in radian between the identity orientation and the
         * relative angular velocity matrix on the rolling (XZ) plane. The computer
         * will use the rolling thursters to reach this angle. 
         * (representing rad / physics.ANGULAR_VELOCITY_MATRIX_DURATION ms turn)
         * @type Number
         */
        this._rollTarget = 0;
        /**
         * The target speed along the Y axis (in model space). The computer will
         * use forward and reverse thrusters to reach this speed if interia
         * compensation is turned on. (in m/s)
         * @type Number
         */
        this._speedTarget = 0;
        /**
         * The target speed along the X axis (in model space). The computer will
         * use left and right thrusters to reach this speed if interia
         * compensation is turned on. (in m/s)
         * @type Number
         */
        this._strafeTarget = 0;
        /**
         * The target speed along the Z axis (in model space). The computer will
         * use dorsal and lateral thrusters to reach this speed if interia
         * compensation is turned on. (in m/s)
         * @type Number
         */
        this._liftTarget = 0;
        /**
         * How much speed should be added to the target when the pilot accelerates
         * continuously for one second, in m/s. This is always updated to be the same
         * as how much the spacecraft can accelerate with the current propulsion, whenever
         * a new propulsion is equipped.
         * @type Number
         */
        this._speedIncrementPerSecond = 0;
        /**
         * How much speed should be added to the target in one control step when
         * the pilot is using continuous acceleration. (in m/s)
         * @type Number
         */
        this._speedIncrement = 0;
        /**
         * In compensated modes, the forward speed target cannot exceed this. (in m/s)
         * @type Number
         */
        this._maxCompensatedForwardSpeed = 0;
        /**
         * In compensated modes, the forward speed target cannot go below this. (negative, in m/s)
         * @type Number
         */
        this._maxCompensatedReverseSpeed = 0;
        /**
         * The maximum angle between vectors of the relative angular acceleration 
         * matrix and the identity axes on each 2D plane (yaw, pitch, roll)
         * (representing rad / physics.ANGULAR_VELOCITY_MATRIX_DURATION ms turn)
         * @type Number
         */
        this._turningLimit = 0;
        /**
         * Maximum thrust for acceleration is applied at this burn level. (cache variable)
         * @type Number
         */
        this._maxMoveBurnLevel = 0;
        /**
         * Maximum angular thrust for turning is applied at this burn level. (cache variable)
         * @type Number
         */
        this._maxTurnBurnLevel = 0;
        this.updateForNewPropulsion();
    }
    /**
     * Updates the speed increment per second to how much the ship can accelerate 
     * in one second with the current propulsion system.
     */
    ManeuveringComputer.prototype.updateSpeedIncrementPerSecond = function () {
        this._speedIncrementPerSecond = this._spacecraft.getMaxAcceleration() || 0;
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
     * turning rate to in TURN_ACCELERATION_DURATION_S seconds with the current propulsion system.
     */
    ManeuveringComputer.prototype.updateTurningLimit = function () {
        this._turningLimit = this._spacecraft.getMaxAngularAcceleration() * config.getSetting(config.BATTLE_SETTINGS.TURN_ACCELERATION_DURATION_S) * physics.ANGULAR_VELOCITY_MATRIX_DURATION_S;
    };
    /**
     * Updates all stored state variables to reflect the current state of the propulsion on the spacecraft of this computer
     * @returns {undefined}
     */
    ManeuveringComputer.prototype.updateForNewPropulsion = function () {
        this.updateSpeedIncrementPerSecond();
        this._maxCompensatedForwardSpeed = _compensatedForwardSpeedFactor * this._spacecraft.getMaxAcceleration();
        this._maxCompensatedReverseSpeed = _compensatedReverseSpeedFactor * -this._spacecraft.getMaxAcceleration();
        this.updateTurningLimit();
        this._maxMoveBurnLevel = this._spacecraft.getMaxThrusterMoveBurnLevel();
        this._maxTurnBurnLevel = this._spacecraft.getMaxThrusterTurnBurnLevel();
    };
    /**
     * Returns a string representation of the current flight mode.
     * @returns {String} enum FlightMode
     */
    ManeuveringComputer.prototype.getFlightMode = function () {
        return this._compensated ?
                (this._restricted ? FlightMode.RESTRICTED : FlightMode.COMPENSATED) : FlightMode.FREE;
    };
    /**
     * Switches to the next flight mode. (free / compensated / restricted)
     */
    ManeuveringComputer.prototype.changeFlightMode = function () {
        if (!this._compensated) {
            this._compensated = true;
            this._speedTarget = Math.min(Math.max(
                    this._maxCompensatedReverseSpeed,
                    this._spacecraft.getRelativeVelocityMatrix()[13]),
                    this._maxCompensatedForwardSpeed);
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
        this._speedTarget = this._compensated ?
                Math.min(this._speedTarget + (intensity || this._speedIncrement), this._maxCompensatedForwardSpeed) :
                Number.MAX_VALUE;
    };
    /**
     * Sets the target speed to the current speed if it is bigger. Only works 
     * in free flight mode.
     */
    ManeuveringComputer.prototype.stopForward = function () {
        if (!this._compensated) {
            var speed = this._spacecraft.getRelativeVelocityMatrix()[13];
            if (this._speedTarget > speed) {
                this._speedTarget = speed;
            }
        }
    };
    /**
     * Decreases the target speed or sets it to negative maximum in free mode.
     * @param {Number} [intensity] If given, the speed will be decreased by this
     * value instead of the regular continuous increment.
     */
    ManeuveringComputer.prototype.reverse = function (intensity) {
        this._speedTarget = this._compensated ?
                Math.max(this._speedTarget - (intensity || this._speedIncrement), this._maxCompensatedReverseSpeed) :
                -Number.MAX_VALUE;
    };
    /**
     * Sets the target speed to the current speed if it is smaller. Only works 
     * in free flight mode.
     */
    ManeuveringComputer.prototype.stopReverse = function () {
        var speed;
        if (!this._compensated) {
            speed = this._spacecraft.getRelativeVelocityMatrix()[13];
            if (this._speedTarget < speed) {
                this._speedTarget = speed;
            }
        }
    };
    /**
     * Sets the target speed for strafing to the left to intensity, or if not
     * given, to maximum. This target is reset to zero in each control step after 
     * the thrusters have been ignited accoringly.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.strafeLeft = function (intensity) {
        this._strafeTarget = (this._compensated && intensity) ? -intensity : -Number.MAX_VALUE;
    };
    /**
     * Sets the target speed for strafing to zero, if was set to a speed to the
     * left.
     */
    ManeuveringComputer.prototype.stopLeftStrafe = function () {
        if (this._strafeTarget < 0) {
            this._strafeTarget = 0;
        }
    };
    /**
     * Sets the target speed for strafing to the right to intensity, or if not
     * given, to maximum. This target is reset to zero in each control step after 
     * the thrusters have been ignited accoringly.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.strafeRight = function (intensity) {
        this._strafeTarget = (this._compensated && intensity) || Number.MAX_VALUE;
    };
    /**
     * Sets the target speed for strafing to zero, if was set to a speed to the
     * right.
     */
    ManeuveringComputer.prototype.stopRightStrafe = function () {
        if (this._strafeTarget > 0) {
            this._strafeTarget = 0;
        }
    };
    /**
     * Sets the target speed for lifting downwards to intensity, or if not
     * given, to maximum. This target is reset to zero in each control step after 
     * the thrusters have been ignited accoringly.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.lower = function (intensity) {
        this._liftTarget = (this._compensated && intensity) ? -intensity : -Number.MAX_VALUE;
    };
    /**
     * Sets the target speed for lifting to zero, if was set to a speed to lift
     * downwards
     */
    ManeuveringComputer.prototype.stopLower = function () {
        if (this._liftTarget < 0) {
            this._liftTarget = 0;
        }
    };
    /**
     * Sets the target speed for lifting upwards to intensity, or if not
     * given, to maximum. This target is reset to zero in each control step after 
     * the thrusters have been ignited accoringly.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.raise = function (intensity) {
        this._liftTarget = (this._compensated && intensity) || Number.MAX_VALUE;
    };
    /**
     * Sets the target speed for strafing to zero, if was set to a speed to lift
     * upwards.
     */
    ManeuveringComputer.prototype.stopRaise = function () {
        if (this._liftTarget > 0) {
            this._liftTarget = 0;
        }
    };
    /**
     * Resets the target (forward/reverse) speed to zero. (except in free flight 
     * mode)
     */
    ManeuveringComputer.prototype.resetSpeed = function () {
        if (this._compensated) {
            this._speedTarget = 0;
        }
    };
    /**
     * Sets a new forward/reverse speed target in non-free flight modes.
     * @param {Number} value A positive number means a forward target, a negative one a reverse target, in m/s.
     */
    ManeuveringComputer.prototype.setSpeedTarget = function (value) {
        if (this._compensated) {
            this._speedTarget = value;
        }
    };
    /**
     * Return the currently set target for forward (positive) / reverse (negative) speed, in m/s. Only meaninful in compensated flight modes.
     * @returns {Number}
     */
    ManeuveringComputer.prototype.getSpeedTarget = function () {
        return this._speedTarget;
    };
    /**
     * Returns whether the maneuvering computer has a meaningful speed target in its current flight mode.
     * @returns {Boolean}
     */
    ManeuveringComputer.prototype.hasSpeedTarget = function () {
        return this._compensated;
    };
    /**
     * Sets the target angular velocity to yaw to the left with the given intensity 
     * multiplied by the turning limit, or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.yawLeft = function (intensity) {
        // if no intensity was given for the turn, turn with maximum power (mouse or
        // joystick control can have fine intensity control, while with keyboard,
        // when the key is pressed, we just call this without parameter)
        if (intensity === undefined) {
            this._yawTarget = -this._turningLimit;
            // if a specific intensity was set, set the target to it, capping it out at
            // the maximum allowed turning speed
        } else if (intensity > 0) {
            this._yawTarget = -intensity * this._turningLimit;
            // if a zero or negative intensity was given, set the target to zero,
            // but only if it is set to turn to left
        } else if (this._yawTarget < 0) {
            this._yawTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to yaw to the right with the given intensity 
     * multiplied by the turning limit, or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.yawRight = function (intensity) {
        if (intensity === undefined) {
            this._yawTarget = this._turningLimit;
        } else if (intensity > 0) {
            this._yawTarget = intensity * this._turningLimit;
        } else if (this._yawTarget > 0) {
            this._yawTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to pitch down with the given intensity 
     * multiplied by the turning limit, or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.pitchDown = function (intensity) {
        if (intensity === undefined) {
            this._pitchTarget = -this._turningLimit;
        } else if (intensity > 0) {
            this._pitchTarget = -intensity * this._turningLimit;
        } else if (this._pitchTarget < 0) {
            this._pitchTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to pitch up with the given intensity 
     * multiplied by the turning limit, or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.pitchUp = function (intensity) {
        if (intensity === undefined) {
            this._pitchTarget = this._turningLimit;
        } else if (intensity > 0) {
            this._pitchTarget = intensity * this._turningLimit;
        } else if (this._pitchTarget > 0) {
            this._pitchTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to roll to the left with the given intensity 
     * multiplied by the turning limit, or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.rollLeft = function (intensity) {
        if (intensity === undefined) {
            this._rollTarget = -this._turningLimit;
        } else if (intensity > 0) {
            this._rollTarget = -intensity * this._turningLimit;
        } else if (this._rollTarget < 0) {
            this._rollTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to roll to the right with the given intensity 
     * multiplied by the turning limit, or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.rollRight = function (intensity) {
        if (intensity === undefined) {
            this._rollTarget = this._turningLimit;
        } else if (intensity > 0) {
            this._rollTarget = intensity * this._turningLimit;
        } else if (this._rollTarget > 0) {
            this._rollTarget = 0;
        }
    };
    /**
     * Sets the burn levels of all the thrusters of the ship according to the
     * current flight mode, flight parameters and control actions issued by the 
     * pilot.
     * @param {Number} dt The elapsed time in this simulation step, in milliseconds.
     */
    ManeuveringComputer.prototype.controlThrusters = function (dt) {
        var
                // grab flight parameters for velocity control
                relativeVelocityMatrix = this._spacecraft.getRelativeVelocityMatrix(),
                speed = relativeVelocityMatrix[13],
                speedThreshold = physics.VELOCITY_MATRIX_ERROR_THRESHOLD,
                // grab flight parameters for turning control
                turningMatrix = this._spacecraft.getTurningMatrix(),
                turnThreshold = physics.ANGULAR_VELOCITY_MATRIX_ERROR_THRESHOLD,
                // cache possibly restricted turn parameters (in rad / ANGULAR_VELOCITY_MATRIX_DURATION ms)
                turningLimit = this._turningLimit,
                yawTarget = this._yawTarget,
                pitchTarget = this._pitchTarget,
                yawAngle, pitchAngle, rollAngle;
        // we will add the needed burn levels together, so start from zero
        this._spacecraft.resetThrusterBurn();
        // restrict turning according to current speed in restricted mode
        if (this._restricted && (speed !== 0.0)) {
            // restrict the limit if needed (convert from rad/sec to rad / ANGULAR_VELOCITY_MATRIX_DURATION ms)
            turningLimit = Math.min(turningLimit, this._spacecraft.getMaxTurnRateAtSpeed(speed) * physics.ANGULAR_VELOCITY_MATRIX_DURATION_S);
            //apply the restricted limit
            yawTarget = Math.min(Math.max(yawTarget, -turningLimit), turningLimit);
            pitchTarget = Math.min(Math.max(pitchTarget, -turningLimit), turningLimit);
        }
        // controlling yaw
        yawAngle = Math.sign(turningMatrix[4]) * vec.angle2u([0, 1], vec.normal2([turningMatrix[4], turningMatrix[5]]));
        if ((yawTarget - yawAngle) > turnThreshold) {
            this._spacecraft.addThrusterBurn("yawRight",
                    Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(yawTarget - yawAngle, dt)));
        } else if ((yawTarget - yawAngle) < -turnThreshold) {
            this._spacecraft.addThrusterBurn("yawLeft",
                    Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(yawAngle - yawTarget, dt)));
        }
        // controlling pitch
        pitchAngle = Math.sign(turningMatrix[6]) * vec.angle2u([1, 0], vec.normal2([turningMatrix[5], turningMatrix[6]]));
        if ((pitchTarget - pitchAngle) > turnThreshold) {
            this._spacecraft.addThrusterBurn("pitchUp",
                    Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(pitchTarget - pitchAngle, dt)));
        } else if ((pitchTarget - pitchAngle) < -turnThreshold) {
            this._spacecraft.addThrusterBurn("pitchDown",
                    Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(pitchAngle - pitchTarget, dt)));
        }
        // controlling roll
        rollAngle = Math.sign(-turningMatrix[2]) * vec.angle2u([1, 0], vec.normal2([turningMatrix[0], turningMatrix[2]]));
        if ((this._rollTarget - rollAngle) > turnThreshold) {
            this._spacecraft.addThrusterBurn("rollRight",
                    Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(this._rollTarget - rollAngle, dt)));
        } else if ((this._rollTarget - rollAngle) < -turnThreshold) {
            this._spacecraft.addThrusterBurn("rollLeft",
                    Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(rollAngle - this._rollTarget, dt)));
        }
        // controlling forward/reverse
        if ((this._speedTarget - speed) > speedThreshold) {
            this._spacecraft.addThrusterBurn("forward",
                    Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(this._speedTarget - speed, dt)));
        } else if ((this._speedTarget - speed) < -speedThreshold) {
            this._spacecraft.addThrusterBurn("reverse",
                    Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(speed - this._speedTarget, dt)));
        }
        // controlling horizontal drift
        if (this._compensated || (this._strafeTarget !== 0)) {
            speed = relativeVelocityMatrix[12];
            if ((this._strafeTarget - speed) > speedThreshold) {
                this._spacecraft.addThrusterBurn("strafeRight",
                        Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(this._strafeTarget - speed, dt)));
            } else if ((this._strafeTarget - speed) < -speedThreshold) {
                this._spacecraft.addThrusterBurn("strafeLeft",
                        Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(speed - this._strafeTarget, dt)));
            }
        }
        // controlling vertical drift
        if (this._compensated || (this._liftTarget !== 0)) {
            speed = relativeVelocityMatrix[14];
            if ((this._liftTarget - speed) > speedThreshold) {
                this._spacecraft.addThrusterBurn("raise",
                        Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(this._liftTarget - speed, dt)));
            } else if ((this._liftTarget - speed) < -speedThreshold) {
                this._spacecraft.addThrusterBurn("lower",
                        Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(speed - this._liftTarget, dt)));
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
     * Removes all references stored by this object
     */
    ManeuveringComputer.prototype.destroy = function () {
        this._spacecraft = null;
    };
    // initializazion
    // obtaining pool references
    _particlePool = pools.getPool(renderableObjects.Particle);
    _projectilePool = pools.getPool(Projectile);
    // caching configuration settings
    config.executeWhenReady(function () {
        _isSelfFireEnabled = config.getSetting(config.BATTLE_SETTINGS.SELF_FIRE);
        _momentDuration = config.getSetting(config.BATTLE_SETTINGS.MOMENT_DURATION);
        _minimumMuzzleFlashParticleCountForInstancing = config.getSetting(config.BATTLE_SETTINGS.MINIMUM_MUZZLE_FLASH_PARTICLE_COUNT_FOR_INSTANCING);
        _minimumProjectileCountForInstancing = config.getSetting(config.BATTLE_SETTINGS.MINIMUM_PROJECTILE_COUNT_FOR_INSTANCING);
        _compensatedForwardSpeedFactor = config.getSetting(config.BATTLE_SETTINGS.COMPENSATED_FORWARD_SPEED_FACTOR);
        _compensatedReverseSpeedFactor = config.getSetting(config.BATTLE_SETTINGS.COMPENSATED_REVERSE_SPEED_FACTOR);
        _showHitboxesForHitchecks = config.getSetting(config.BATTLE_SETTINGS.SHOW_HITBOXES_FOR_HITCHECKS);
        _luminosityFactorsArrayName = config.getSetting(config.GENERAL_SETTINGS.UNIFORM_LUMINOSITY_FACTORS_ARRAY_NAME);
        _groupTransformsArrayName = config.getSetting(config.GENERAL_SETTINGS.UNIFORM_GROUP_TRANSFORMS_ARRAY_NAME);
        _fireSoundStackingTimeThreshold = config.getSetting(config.BATTLE_SETTINGS.FIRE_SOUND_STACKING_TIME_THRESHOLD);
        _fireSoundStackingVolumeFactor = config.getSetting(config.BATTLE_SETTINGS.FIRE_SOUND_STACKING_VOLUME_FACTOR);
    });
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        FlightMode: FlightMode,
        Projectile: Projectile,
        Weapon: Weapon,
        Propulsion: Propulsion,
        ManeuveringComputer: ManeuveringComputer
    };
});