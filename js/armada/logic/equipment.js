/**
 * Copyright 2014-2018 Krisztián Nagy
 * @file Implementations of the various classes that represent all the different types of equipment to be added to spacecrafts
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, Element, Float32Array, performance */

/**
 * @param utils Used for solving quadratic equations
 * @param vec Vector operations are needed for several logic functions
 * @param mat Matrices are widely used for 3D simulation
 * @param application Used for file loading and logging functionality
 * @param managedGL Used for accessing shader variable types
 * @param physics Physics simulation is done using this module
 * @param resources Used to access the loaded media (graphics and sound) resources
 * @param pools Used to access the common pools for particles and projectiles
 * @param renderableObjects Used for creating visual models for game objects
 * @param lights Used for creating light sources for game objects
 * @param sceneGraph Creating and managing the scene graph for visual simulation is done using this module
 * @param graphics Used to access graphics settings
 * @param audio Used to access constants
 * @param config Used to access game settings/configuration
 * @param classes Used to load and access the classes of Interstellar Armada
 * @param SpacecraftEvents Used to call spacecraft events handlers for events triggered by equipment
 * @param constants Used to access the light priorities
 * @param explosion Used to create explosion for e.g. hits
 */
define([
    "utils/utils",
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
    "armada/audio",
    "armada/logic/classes",
    "armada/logic/SpacecraftEvents",
    "armada/configuration",
    "armada/logic/constants",
    "armada/logic/explosion",
    "utils/polyfill"
], function (
        utils, vec, mat,
        application, managedGL, physics, resources, pools,
        renderableObjects, lights, sceneGraph,
        graphics, audio, classes, SpacecraftEvents, config,
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
                COMBAT: "combat",
                /**
                 * Turning faster than it would be possible to compensate for drift is not allowed by the maneuvering computer 
                 */
                CRUISE: "cruise"
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
            /**
             * @enum {String}
             * The valid thruster use identifiers.
             * @type Object
             */
            ThrusterUse = {
                FORWARD: "forward",
                REVERSE: "reverse",
                STRAFE_LEFT: "strafeLeft",
                STRAFE_RIGHT: "strafeRight",
                RAISE: "raise",
                LOWER: "lower",
                YAW_LEFT: "yawLeft",
                YAW_RIGHT: "yawRight",
                PITCH_UP: "pitchUp",
                PITCH_DOWN: "pitchDown",
                ROLL_LEFT: "rollLeft",
                ROLL_RIGHT: "rollRight"
            },
            // ------------------------------------------------------------------------------
            // constants
            /**
             * The list of valid thruster use identifiers
             * @type String[]
             */
            THRUSTER_USES = [
                ThrusterUse.FORWARD, ThrusterUse.REVERSE, ThrusterUse.STRAFE_LEFT, ThrusterUse.STRAFE_RIGHT, ThrusterUse.RAISE, ThrusterUse.LOWER,
                ThrusterUse.YAW_LEFT, ThrusterUse.YAW_RIGHT, ThrusterUse.PITCH_UP, ThrusterUse.PITCH_DOWN, ThrusterUse.ROLL_LEFT, ThrusterUse.ROLL_RIGHT],
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
            /**
             * When mapping potential targets to numerical values for ordering, the bearing angle of the target will be multiplied by this
             * factor
             * @type Number
             */
            TARGET_MAPPING_ANGLE_FACTOR = 200,
            /**
             * When mapping potential targets to numerical values for ordering, the final value will be multiplied by this factor, if the
             * targeting spacecraft has a spacecraft type effective against the target
             * @type Number
             */
            TARGET_MAPPING_GOOD_AGAINST_FACTOR = 0.5,
            /**
             * When mapping potential targets to numerical values for ordering, the final value will be multiplied by this factor, if the
             * targeting spacecraft has a spacecraft type that is not effective against the target
             * @type Number
             */
            TARGET_MAPPING_BAD_AGAINST_FACTOR = 2.0,
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
             * Cached value of the configuration setting for maximum combat forward speed factor.
             * @type Number
             */
            _maxCombatForwardSpeedFactor,
            /**
             * Cached value of the configuration setting for maximum combat reverse speed factor.
             * @type Number
             */
            _maxCombatReverseSpeedFactor,
            /**
             * Cached value of the configuration setting for maximum cruise forward speed factor.
             * @type Number
             */
            _maxCruiseForwardSpeedFactor,
            /**
             * Cached value of the configuration setting for maximum cruise reverse speed factor.
             * @type Number
             */
            _maxCruiseReverseSpeedFactor,
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
    Object.freeze(ThrusterUse);
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
        this._physicalModel = new physics.PhysicalObject();
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
        this._physicalModel.init(
                projectileClass.getMass(),
                positionMatrix || mat.IDENTITY4,
                orientationMatrix || mat.IDENTITY4,
                mat.scaling4Aux(projectileClass.getSize()),
                spacecraft ? spacecraft.getVelocityMatrix() : mat.NULL4,
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
     * Creates a new billboard to be used as the visual model for this projectile. Safe to be called on Projectile objects that have not
     * been set up yet, so that the visual model objects can be created in advance.
     */
    Projectile.prototype.createVisualModel = function () {
        this._visualModel = new renderableObjects.Billboard();
    };
    /**
     * Sets up the renderable object that can be used to represent this projectile in a visual scene.
     * @param {Boolean} [wireframe=false] Whether to set up the model in wireframe mode
     */
    Projectile.prototype._initVisualModel = function (wireframe) {
        if (!this._visualModel) {
            this.createVisualModel();
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
     * Private function used as a callback after resource load to add the projectile to a scene.
     * @param {Scene} scene The scene to which to add the renderable object presenting the projectile.
     * @param {Boolean} [wireframe=false] Whether to add the model for wireframe rendering
     * @param {Function} [callback] If given, this function will be executed right after the projectile is addded to the scene, with the 
     * visual model of the projectile passed to it as its only argument
     */
    Projectile.prototype._addToSceneCallback = function (scene, wireframe, callback) {
        this._initVisualModel(wireframe);
        scene.addObject(this._visualModel, false, _minimumProjectileCountForInstancing);
        if (callback) {
            callback(this._visualModel);
        }
    };
    /**
     * Adds a renderable node representing this projectile to the passed scene.
     * @param {Scene} scene The scene to which to add the renderable object presenting the projectile.
     * @param {Boolean} [wireframe=false] Whether to add the model for wireframe rendering
     * @param {Function} [callback] If given, this function will be executed right after the projectile is addded to the scene, with the 
     * visual model of the projectile passed to it as its only argument
     */
    Projectile.prototype.addToScene = function (scene, wireframe, callback) {
        resources.executeWhenReady(this._addToSceneCallback.bind(this, scene, wireframe, callback));
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
                this._initVisualModel(wireframe);
                scene.addResourcesOfObject(this._visualModel, resourceID);
                exp = new explosion.Explosion(this._class.getExplosionClass(), mat.IDENTITY4, mat.IDENTITY4, [0, 0, 0], true);
                exp.addResourcesToScene(scene);
                exp = new explosion.Explosion(this._class.getShieldExplosionClass(), mat.IDENTITY4, mat.IDENTITY4, [0, 0, 0], true);
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
            positionVectorInWorldSpace = mat.translationVector3(this._physicalModel.getPositionMatrix());
            velocityVectorInWorldSpace = mat.translationVector3(this._physicalModel.getVelocityMatrix());
            hitObjects = hitObjectOctree.getObjects(
                    Math.min(positionVectorInWorldSpace[0], positionVectorInWorldSpace[0] - velocityVectorInWorldSpace[0] * hitCheckDT * 0.001),
                    Math.max(positionVectorInWorldSpace[0], positionVectorInWorldSpace[0] - velocityVectorInWorldSpace[0] * hitCheckDT * 0.001),
                    Math.min(positionVectorInWorldSpace[1], positionVectorInWorldSpace[1] - velocityVectorInWorldSpace[1] * hitCheckDT * 0.001),
                    Math.max(positionVectorInWorldSpace[1], positionVectorInWorldSpace[1] - velocityVectorInWorldSpace[1] * hitCheckDT * 0.001),
                    Math.min(positionVectorInWorldSpace[2], positionVectorInWorldSpace[2] - velocityVectorInWorldSpace[2] * hitCheckDT * 0.001),
                    Math.max(positionVectorInWorldSpace[2], positionVectorInWorldSpace[2] - velocityVectorInWorldSpace[2] * hitCheckDT * 0.001));
            // checking for hits
            if (_showHitboxesForHitchecks) {
                for (i = 0; i < hitObjects.length; i++) {
                    hitObjects[i].showHitbox();
                }
            }
            for (i = 0; i < hitObjects.length; i++) {
                physicalHitObject = hitObjects[i].getPhysicalModel();
                if (physicalHitObject && (_isSelfFireEnabled || (hitObjects[i] !== this._origin))) {
                    hitPositionVectorInObjectSpace = physicalHitObject.checkHit(positionVectorInWorldSpace, velocityVectorInWorldSpace, hitCheckDT);
                    if (hitPositionVectorInObjectSpace) {
                        relativeVelocityVectorInWorldSpace = vec.diff3Aux(velocityVectorInWorldSpace, mat.translationVector3(physicalHitObject.getVelocityMatrix()));
                        relativeVelocityDirectionInWorldSpace = vec.normal3(relativeVelocityVectorInWorldSpace);
                        relativeVelocity = vec.length3(relativeVelocityVectorInWorldSpace);
                        relativeVelocityDirectionInObjectSpace = vec.prodVec3Mat4Aux(relativeVelocityDirectionInWorldSpace, mat.inverseOfRotation4Aux(hitObjects[i].getVisualModel().getOrientationMatrix()));
                        hitPositionVectorInWorldSpace = vec.prodVec4Mat4Aux(hitPositionVectorInObjectSpace, hitObjects[i].getVisualModel().getModelMatrix());
                        relativeHitPositionVectorInWorldSpace = vec.diff3Aux(hitPositionVectorInWorldSpace, mat.translationVector3(physicalHitObject.getPositionMatrix()));
                        physicalHitObject.addForceAndTorque(relativeHitPositionVectorInWorldSpace, relativeVelocityDirectionInWorldSpace, relativeVelocity * this._physicalModel.getMass() * 1000 / _momentDuration, _momentDuration);
                        exp = explosion.getExplosion();
                        exp.init(((hitObjects[i].getShieldIntegrity() > 0) ? this._class.getShieldExplosionClass() : this._class.getExplosionClass()), mat.translation4vAux(hitPositionVectorInWorldSpace), mat.IDENTITY4, vec.scaled3(relativeVelocityDirectionInWorldSpace, -1), true, physicalHitObject.getVelocityMatrix());
                        exp.addToScene(this._visualModel.getNode().getScene().getRootNode(), hitObjects[i].getSoundSource(), true);
                        hitObjects[i].damage(this._class.getDamage(), hitPositionVectorInObjectSpace, vec.scaled3(relativeVelocityDirectionInObjectSpace, -1), this._origin);
                        this._timeLeft = 0;
                        this._visualModel.markAsReusable(true);
                        return;
                    }
                }
            }
        } else {
            this._visualModel.markAsReusable(true);
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
            this._visualModel.getNode().markAsReusable(true);
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
     * Returns the name of the weapon in a way that can be displayed to the user (translated)
     * @returns {String}
     */
    Weapon.prototype.getDisplayName = function () {
        return this._class.getDisplayName();
    };
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
     * Returns the damage one shot (from all barrels) this weapon deals to a target with the passed armor rating.
     * @param {Number} [armorRating=0]
     * @returns {Number}
     */
    Weapon.prototype.getDamage = function (armorRating) {
        return this._class.getDamage(armorRating);
    };
    /**
     * Returns the damage per second dealt this a weapon to a target with the passed armor rating.
     * @param {Number} [armorRating=0]
     * @returns {Number}
     */
    Weapon.prototype.getFirepower = function (armorRating) {
        return this._class.getFirepower(armorRating);
    };
    /**
     * Returns the rate of fire of this weapon, in shots per second
     * @returns {Number}
     */
    Weapon.prototype.getFireRate = function () {
        return this._class.getFireRate();
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
                vec.prodVec3Mat4Aux(
                        vec.scaled3(this._class.getAttachmentPoint(), -1),
                        mat.prod3x3SubOf4Aux(
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
                basePointPosVector,
                weaponSlotPosVector = vec.prodVec3Mat4Aux(mat.translationVector3(this.getOrigoPositionMatrix()), shipScaledOriMatrix);
        vec.add3(weaponSlotPosVector, this._spacecraft.getPhysicalPositionVector());
        basePointPosVector = vec.prodVec4Mat4(this._class.getBasePoint(), this._transformMatrix);
        vec.mulVec3Mat4(basePointPosVector, mat.prod3x3SubOf4Aux(this.getScaledOriMatrix(), shipScaledOriMatrix));
        vec.add3(basePointPosVector, weaponSlotPosVector);
        return basePointPosVector;
    };
    /**
     * Returns a 4x4 rotation matrix describing the orientation of projectiles fired by this weapon in world space.
     * Uses an auxiliary matrix common to all Weapons.
     * @returns {Float32Array}
     */
    Weapon.prototype.getProjectileOrientationMatrix = function () {
        mat.setProd3x3SubOf4(Weapon._projectileOriMatrix, this._slot.orientationMatrix, this._spacecraft.getPhysicalOrientationMatrix());
        if (!this._fixed) {
            mat.setProd3x3SubOf4(Weapon._projectileOriMatrix, this._transformMatrix, mat.matrix4Aux(Weapon._projectileOriMatrix));
        }
        return Weapon._projectileOriMatrix;
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
                        mat.IDENTITY4);
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
                muzzleFlashPosMatrix = mat.translation4vAux(relativeBarrelPosVector),
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
                        vec.prodVec3Mat4Aux(rotators[i].center, this._transformMatrix),
                        vec.prodVec3Mat4Aux(rotators[i].axis, this._transformMatrix),
                        this._rotationAngles[i]);
                this._visualModel.setMat4Parameter(
                        _groupTransformsArrayName,
                        rotators[i].transformGroupIndex,
                        this._transformMatrix);
            }
            this._rotationChanged = false;
        }
    };
    // static auxiliary matrices to be used in the fire() method (to avoid created new matrices during each execution of the method)
    Weapon._weaponSlotPosMatrix = mat.identity4();
    Weapon._projectilePosMatrix = mat.identity4();
    Weapon._projectileOriMatrix = mat.identity4();
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
                weaponSlotPosVector,
                projectileOriMatrix,
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
            weaponSlotPosVector = vec.prodVec3Mat4Aux(mat.translationVector3(this.getOrigoPositionMatrix()), shipScaledOriMatrix);
            mat.setTranslatedByVector(Weapon._weaponSlotPosMatrix, this._spacecraft.getPhysicalPositionMatrix(), weaponSlotPosVector);
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
                    barrelPosVector = vec.prodVec4Mat4(barrelPosVector, this._transformMatrix);
                }
                // add the muzzle flash of this barrel
                muzzleFlash = this._getMuzzleFlashForBarrel(i, barrelPosVector);
                barrelPosVector = vec.prodVec3Mat4(barrelPosVector, mat.prod3x3SubOf4Aux(this.getScaledOriMatrix(), shipScaledOriMatrix));
                mat.setTranslatedByVector(Weapon._projectilePosMatrix, Weapon._weaponSlotPosMatrix, barrelPosVector);
                this._visualModel.getNode().addSubnode(new sceneGraph.RenderableNode(muzzleFlash, false), false, _minimumMuzzleFlashParticleCountForInstancing);
                // add the projectile of this barrel
                p = _projectilePool.getObject();
                p.init(
                        projectileClass,
                        Weapon._projectilePosMatrix,
                        projectileOriMatrix,
                        this._spacecraft,
                        new physics.Force(barrels[i].getForceForDuration(_momentDuration), [projectileOriMatrix[4], projectileOriMatrix[5], projectileOriMatrix[6]], _momentDuration));
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
                                mat.translationVector3(Weapon._projectilePosMatrix),
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
            vectorToTarget = vec.prodMat4Vec3(this._spacecraft.getPhysicalOrientationMatrix(), vectorToTarget);
            vectorToTarget = vec.prodMat4Vec3(this._slot.orientationMatrix, vectorToTarget);
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
     * Returns the highest number of projectiles that might be used for this weapon simultaneously in one battle.
     * @returns {Number}
     */
    Weapon.prototype.getMaxProjectileCount = function () {
        return this._class.getMaxProjectileCount();
    };
    /**
     * Returns the highest number of explosions that might be used for this weapon simultaneously in one battle.
     * @returns {Number}
     */
    Weapon.prototype.getMaxExplosionCount = function () {
        return this._class.getMaxExplosionCount();
    };
    /**
     * Returns the highest number of particles that might be used for this weapon simultaneously in one battle.
     * @returns {Number}
     */
    Weapon.prototype.getMaxParticleCount = function () {
        return this._class.getMaxParticleCount();
    };
    /**
     * Removes all references stored by this object
     */
    Weapon.prototype.destroy = function () {
        this._class = null;
        this._spacecraft = null;
        this._slot = null;
        if (this._visualModel) {
            this._visualModel.markAsReusable(true);
        }
        this._visualModel = null;
    };
    // #########################################################################
    /**
     * @class The targeting computer keeps track of all targeting related data and performs targeting related tasks for the spacecraft it
     * is equipped on.
     * @param {Spacecraft} spacecraft The spacecraft this computer is equipped on
     * @param {Spacecraft[]} spacecraftArray The list of spacecrafts from which this computer can choose its target
     */
    function TargetingComputer(spacecraft, spacecraftArray) {
        /**
         * The spacecraft this computer is equipped on
         * @type Spacecraft
         */
        this._spacecraft = spacecraft;
        /**
         * The currently targeted spacecraft.
         * @type Spacecraft
         */
        this._target = null;
        /**
         * The list of spacecrafts from which this computer can choose its target
         * @type Spacecraft[]
         */
        this._spacecraftArray = spacecraftArray || null;
        /**
         * Cached value of the estimated future target position where the spacecraft should fire to hit it.
         * @type Number[3]
         */
        this._targetHitPosition = null;
        /**
         * A cached list of hostile targets from the list, ordered based on how much the spacecrat needs to turn to face them
         * @type Spacecraft[]
         */
        this._orderedHostileTargets = null;
        /**
         * A cached list of non-hostile targets from the list, ordered based on how much the spacecrat needs to turn to face them
         * @type Spacecraft[]
         */
        this._orderedNonHostileTargets = null;
        /**
         * The amount of time while the current ordered hostile list is still valid and should be used for cycling targets, in milliseconds
         * @type Number
         */
        this._timeUntilHostileOrderReset = 0;
        /**
         * The amount of time while the current ordered non-hostile list is still valid and should be used for cycling targets, in milliseconds
         * @type Number
         */
        this._timeUntilNonHostileOrderReset = 0;
    }
    /**
     * Targets the given spacecraft and executes related operations, such as changing target views. 
     * @param {Spacecraft|null} target If null is given, the current target will be canceled.
     */
    TargetingComputer.prototype.setTarget = function (target) {
        var i, camConfigs, node, camera;
        if (target !== this._target) {
            if (this._target) {
                this._target.setBeingUntargeted(this._spacecraft);
            }
            this._target = target;
            this._targetHitPosition = null;
            if (this._spacecraft.getVisualModel()) {
                node = this._spacecraft.getVisualModel().getNode();
                camera = node.getScene().getCamera();
                // set the target following views to follow the new target
                camConfigs = node.getCameraConfigurationsWithName(config.getSetting(config.BATTLE_SETTINGS.TARGET_VIEW_NAME));
                for (i = 0; i < camConfigs.length; i++) {
                    if (camera.getConfiguration() === camConfigs[i]) {
                        camera.transitionToSameConfiguration(
                                config.getSetting(config.BATTLE_SETTINGS.TARGET_CHANGE_TRANSITION_DURATION),
                                config.getSetting(config.BATTLE_SETTINGS.TARGET_CHANGE_TRANSITION_STYLE));
                    }
                    camConfigs[i].setOrientationFollowedObjects(this._target ? [this._target.getVisualModel()] : [], true);
                }
            }
            if (this._target) {
                this._target.setBeingTargeted(this._spacecraft);
            }
        }
    };
    /**
     * Used to filter the potential target list to include only hostiles
     * @param {Spacecraft} craft
     * @returns {unresolved}
     */
    TargetingComputer.prototype._filterHostileTarget = function (craft) {
        return this._spacecraft.isHostile(craft);
    };
    /**
     * Used to filter the potential target list to include only non-hostiles
     * @param {Spacecraft} craft
     * @returns {Boolean}
     */
    TargetingComputer.prototype._filterNonHostileTarget = function (craft) {
        return (craft !== this._spacecraft) && !this._spacecraft.isHostile(craft);
    };
    /**
     * @typedef {Object} TargetingComputer~MappedTarget
     * @property {Number} index The index of the potential target within the unordered target array
     * @property {Number} value The numerical value assigned to this potential target based on which it can be ordered (in ascending order)
     */
    /**
     * @callback TargetingComputer~mappingFunction
     * @param {Spacecraft} craft
     * @param {Number} index
     * @returns {TargetingComputer~MappedTarget}
     */
    /**
     * Maps the passed spacecraft to an object that contains a numeric value based on which it should be placed in the ordered target list
     * (ascending), as well as includes the passed, original index in the object
     * Calculates the value based on the bearing of the spacecraft, favouring targets that are closer to the direction vector of the
     * spacecraft.
     * @param {Spacecraft} craft
     * @param {Number} index
     * @returns {TargetingComputer~MappedTarget}
     */
    TargetingComputer.prototype._mapTargetByBearing = function (craft, index) {
        return {
            index: index,
            value: vec.angle3u(
                    mat.getRowB43(this._spacecraft.getPhysicalOrientationMatrix()),
                    vec.normal3(vec.diff3(
                            craft.getPhysicalPositionVector(), this._spacecraft.getPhysicalPositionVector())))
        };
    };
    /**
     * Maps the passed spacecraft to an object that contains a numeric value based on which it should be placed in the ordered target list
     * (ascending), as well as includes the passed, original index in the object
     * Calculates the value based on a complex formula that represents how ideal the target is. (to be used for the AI)
     * @param {Spacecraft} craft
     * @param {Number} index
     * @returns {TargetingComputer~MappedTarget}
     */
    TargetingComputer.prototype._mapTargetToCombinedValue = function (craft, index) {
        var
                vector = vec.diff3(craft.getPhysicalPositionVector(), this._spacecraft.getPhysicalPositionVector()),
                distance = vec.length3(vector);
        return {
            index: index,
            value: (distance +
                    TARGET_MAPPING_ANGLE_FACTOR * vec.angle3u(
                            mat.getRowB43(this._spacecraft.getPhysicalOrientationMatrix()),
                            vec.scaled3(vector, 1 / distance))
                    ) *
                    (this._spacecraft.isGoodAgainst(craft) ? TARGET_MAPPING_GOOD_AGAINST_FACTOR : (
                            this._spacecraft.isBadAgainst(craft) ? TARGET_MAPPING_BAD_AGAINST_FACTOR : 1))
        };
    };
    /**
     * Can be used for sorting the list of mapped target objects
     * @param {TargetingComputer~MappedTarget} first
     * @param {TargetingComputer~MappedTarget} second
     * @returns {Number}
     */
    TargetingComputer._compareMappedTargets = function (first, second) {
        return first.value - second.value;
    };
    /**
     * If the current cached ordered hostile target list is not valid, created a new ordered list based on the current game state.
     * @param {TargetingComputer~mappingFunction} mapFunction The mapping function to use on which the order will depend.
     * @returns {Boolean} Whether the list was updated
     */
    TargetingComputer.prototype._updateHostileOrder = function (mapFunction) {
        var filteredTargets, orderedMappedTargets, i;
        if (this._spacecraftArray) {
            filteredTargets = this._spacecraftArray.filter(this._filterHostileTarget, this);
            // if the order is invalid (expired), generate a new list with a new, up-to-date order
            if (this._timeUntilHostileOrderReset <= 0) {
                orderedMappedTargets = filteredTargets.map(mapFunction, this).sort(TargetingComputer._compareMappedTargets);
                this._orderedHostileTargets = [];
                for (i = 0; i < orderedMappedTargets.length; i++) {
                    this._orderedHostileTargets.push(filteredTargets[orderedMappedTargets[i].index]);
                }
                return true;
            } else {
                // if the order was not updated, still check for new potential targets (e.g. ships that
                // jumped in) and append them to the list
                for (i = 0; i < filteredTargets.length; i++) {
                    if (this._orderedHostileTargets.indexOf(filteredTargets[i]) < 0) {
                        this._orderedHostileTargets.push(filteredTargets[i]);
                    }
                }
            }
        }
        return false;
    };
    /**
     * If the current cached ordered non-hostile target list is not valid, created a new ordered list based on the current game state.
     * @returns {Boolean} Whether the list was updated
     */
    TargetingComputer.prototype._updateNonHostileOrder = function () {
        var filteredTargets, orderedMappedTargets, i;
        if (this._spacecraftArray) {
            filteredTargets = this._spacecraftArray.filter(this._filterNonHostileTarget, this);
            // if the order is invalid (expired), generate a new list with a new, up-to-date order
            if (this._timeUntilNonHostileOrderReset <= 0) {
                orderedMappedTargets = filteredTargets.map(this._mapTargetByBearing, this).sort(TargetingComputer._compareMappedTargets);
                this._orderedNonHostileTargets = [];
                for (i = 0; i < orderedMappedTargets.length; i++) {
                    this._orderedNonHostileTargets.push(filteredTargets[orderedMappedTargets[i].index]);
                }
                return true;
            } else {
                // if the order was not updated, still check for new potential targets (e.g. ships that
                // jumped in) and append them to the list
                for (i = 0; i < filteredTargets.length; i++) {
                    if (this._orderedNonHostileTargets.indexOf(filteredTargets[i]) < 0) {
                        this._orderedNonHostileTargets.push(filteredTargets[i]);
                    }
                }
            }
        }
        return false;
    };
    /**
     * Can be used to check whether a target chosen from one of the cached ordered list is a valid new target
     * @param {Spacecraft} craft
     * @returns {Boolean}
     */
    TargetingComputer.prototype._isValidNewTarget = function (craft) {
        // the game state might have changed, since the ordered list was cached, so check if the craft is still alive and present
        return craft.isAlive() && !craft.isAway() && (craft !== this._target);
    };
    /**
     * Targets the next spacecraft, ordering the potential targets using the passed mapping function.
     * @param {TargetingComputer~mappingFunction} mapFunction
     * @returns {Boolean} Whether a new spacecraft has been targeted
     */
    TargetingComputer.prototype._targetNextHostile = function (mapFunction) {
        var index, count, length, newOrder = this._updateHostileOrder(mapFunction);
        if (this._orderedHostileTargets && (this._orderedHostileTargets.length > 0)) {
            // the game state might have changed since the ordered list was updated, so check until we find a still valid target
            length = this._orderedHostileTargets.length;
            index = newOrder ? 0 : (this._orderedHostileTargets.indexOf(this._target) + 1) % length;
            // count invalid targets in the array
            count = 0;
            while ((count < length) && !this._isValidNewTarget(this._orderedHostileTargets[index])) {
                index = (index + 1) % length;
                count++;
            }
            // if there is at least one valid target, select it
            if (count < length) {
                this.setTarget(this._orderedHostileTargets[index]);
                this._timeUntilHostileOrderReset = config.getSetting(config.BATTLE_SETTINGS.TARGET_ORDER_DURATION);
                return true;
            }   
        }
        this._timeUntilHostileOrderReset = 0;
        return false;
    };
    /**
     * Targets the previous spacecraft, ordering the potential targets using the passed mapping function.
     * @param {TargetingComputer~mappingFunction} mapFunction
     * @returns {Boolean} Whether a new spacecraft has been targeted
     */
    TargetingComputer.prototype._targetPreviousHostile = function (mapFunction) {
        var index, count, length, newOrder = this._updateHostileOrder(mapFunction);
        if (this._orderedHostileTargets && (this._orderedHostileTargets.length > 0)) {
            // the game state might have changed since the ordered list was updated, so check until we find a still valid target
            length = this._orderedHostileTargets.length;
            index = newOrder ? (length - 1) : (this._orderedHostileTargets.indexOf(this._target) + length - 1) % length;
            // count invalid targets in the array
            count = 0;
            while ((count < length) && !this._isValidNewTarget(this._orderedHostileTargets[index])) {
                index = (index + length - 1) % length;
                count++;
            }
            // if there is at least one valid target, select it
            if (count < length) {
                this.setTarget(this._orderedHostileTargets[index]);
                this._timeUntilHostileOrderReset = config.getSetting(config.BATTLE_SETTINGS.TARGET_ORDER_DURATION);
                return true;
            }
        }
        this._timeUntilHostileOrderReset = 0;
        return false;
    };
    /**
     * Targets the next hostile spacecraft, ordering the hostiles based on the angle between the spacecraft's direction and the vector
     * pointing to the hostile spacecraft
     * @returns {Boolean} Whether a new spacecraft has been targeted
     */
    TargetingComputer.prototype.targetNextNearestHostile = function () {
        return this._targetNextHostile(this._mapTargetByBearing);
    };
    /**
     * Targets the previous hostile spacecraft, ordering the hostiles based on the angle between the spacecraft's direction and the vector
     * pointing to the hostile spacecraft
     * @returns {Boolean} Whether a new spacecraft has been targeted
     */
    TargetingComputer.prototype.targetPreviousNearestHostile = function () {
        return this._targetPreviousHostile(this._mapTargetByBearing);
    };
    /**
     * Targets the next hostile spacecraft, ordering the hostiles based on a complex evaluation of how fitting targets they are.
     * (to be used by the AI)
     * @returns {Boolean}
     */
    TargetingComputer.prototype.targetNextBestHostile = function () {
        return this._targetNextHostile(this._mapTargetToCombinedValue);
    };
    /**
     * Targets the next non-hostile (friendly or neutral) spacecraft, ordering the hostiles based on the angle between the spacecraft's 
     * direction and the vector pointing to the hostile spacecraft
     * @returns {Boolean} Whether a new spacecraft has been targeted
     */
    TargetingComputer.prototype.targetNextNearestNonHostile = function () {
        var index, count, length, newOrder = this._updateNonHostileOrder();
        if (this._orderedNonHostileTargets && (this._orderedNonHostileTargets.length > 0)) {
            // the game state might have changed since the ordered list was updated, so check until we find a still valid target
            length = this._orderedNonHostileTargets.length;
            index = newOrder ? 0 : (this._orderedNonHostileTargets.indexOf(this._target) + 1) % length;
            // count invalid targets in the array
            count = 0;
            while ((count < length) && !this._isValidNewTarget(this._orderedNonHostileTargets[index])) {
                index = (index + 1) % length;
                count++;
            }
            // if there is at least one valid target, select it
            if (count < length) {
                this.setTarget(this._orderedNonHostileTargets[index]);
                this._timeUntilNonHostileOrderReset = config.getSetting(config.BATTLE_SETTINGS.TARGET_ORDER_DURATION);
                return true;
            }
        }
        this._timeUntilNonHostileOrderReset = 0;
        return false;
    };
    /**
     * Returns the currently targeted spacecraft.
     * @returns {Spacecraft|null}
     */
    TargetingComputer.prototype.getTarget = function () {
        if (this._target && (this._target.canBeReused() || this._target.isAway())) {
            this.setTarget(null);
        }
        return this._target;
    };
    /**
     * Returns the estimated position towards which the spacecraft needs to fire to hit its current target in case both itself and the 
     * target retain their current velocity, based on the speed of the projectile fired from the first barrel of the first equipped weapon.
     * @returns {Number[3]}
     */
    TargetingComputer.prototype.getTargetHitPosition = function () {
        var
                position, targetPosition,
                relativeTargetVelocity,
                weapons,
                projectileSpeed,
                a, b, c, i, hitTime;
        if (!this._targetHitPosition) {
            targetPosition = this._target.getPhysicalPositionVector();
            weapons = this._spacecraft.getWeapons();
            if (weapons.length === 0) {
                return targetPosition;
            }
            position = this._spacecraft.getPhysicalPositionVector();
            relativeTargetVelocity = vec.diff3(mat.translationVector3(this._target.getVelocityMatrix()), mat.translationVector3(this._spacecraft.getVelocityMatrix()));
            projectileSpeed = weapons[0].getProjectileVelocity();
            a = projectileSpeed * projectileSpeed - (relativeTargetVelocity[0] * relativeTargetVelocity[0] + relativeTargetVelocity[1] * relativeTargetVelocity[1] + relativeTargetVelocity[2] * relativeTargetVelocity[2]);
            b = 0;
            for (i = 0; i < 3; i++) {
                b += (2 * relativeTargetVelocity[i] * (position[i] - targetPosition[i]));
            }
            c = 0;
            for (i = 0; i < 3; i++) {
                c += (-targetPosition[i] * targetPosition[i] - position[i] * position[i] + 2 * targetPosition[i] * position[i]);
            }
            hitTime = utils.getGreaterSolutionOfQuadraticEquation(a, b, c);
            this._targetHitPosition = [
                targetPosition[0] + hitTime * relativeTargetVelocity[0],
                targetPosition[1] + hitTime * relativeTargetVelocity[1],
                targetPosition[2] + hitTime * relativeTargetVelocity[2]
            ];
        }
        return this._targetHitPosition;
    };
    /**
     * Updates the internal state of the computer for the current simulation step
     * @param {Number} dt The time elapsed since the last simulation step, in milliseconds
     */
    TargetingComputer.prototype.simulate = function (dt) {
        if (this._target && (this._target.canBeReused() || this._target.isAway())) {
            this.setTarget(null);
        }
        this._targetHitPosition = null;
        if (this._timeUntilHostileOrderReset > 0) {
            this._timeUntilHostileOrderReset -= dt;
        }
        if (this._timeUntilNonHostileOrderReset > 0) {
            this._timeUntilNonHostileOrderReset -= dt;
        }
    };
    /**
     * Removes all references from this object
     */
    TargetingComputer.prototype.destroy = function () {
        this._spacecraft = null;
        this._spacecraftArray = null;
        this._target = null;
        this._targetHitPosition = null;
        this._orderedHostileTargets = null;
        this._orderedNonHostileTargets = null;
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
            parentNode.addSubnode(new sceneGraph.RenderableNode(visualModel, false, false, config.getSetting(config.BATTLE_SETTINGS.MINIMUM_THRUSTER_PARTICLE_COUNT_FOR_INSTANCING)));
            if (!this._visualModel) {
                this._visualModel = visualModel;
                this._shipModel = parentNode.getRenderableObject();
            }
        }.bind(this));
    };
    /**
     * Updates the visual representation of this thruster to represent the current burn level.
     */
    Thruster.prototype.updateVisuals = function () {
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
    };
    /**
     * Adds the passed value to the current burn level of this thruster.
     * @param {Number} value
     */
    Thruster.prototype.addBurn = function (value) {
        this._burnLevel += value;
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
        var i;
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
         * An array storing direct references to all the thrusters.
         * @type Thruster[]
         */
        this._thrusters = [];
        /**
         * An associative array containing the burn level and nozzles associated
         * with each thruster use command.
         * @type Object
         */
        this._thrusterUses = {};
        for (i = 0; i < THRUSTER_USES.length; i++) {
            this._thrusterUses[THRUSTER_USES[i]] = {burn: 0, thrusters: []};
        }
        /**
         * Sound clip used for playing the thruster sound effect for this propulsion.
         * @type SoundClip
         */
        this._thrusterSoundClip = null;
        // the continuous forces and torques used to move the ship
        /**
         * Force to move along Y axis (forward/reverse)
         * @type Force
         */
        this._yForce = null;
        /**
         * Force to move along X axis (strafe left/right)
         * @type Force
         */
        this._xForce = null;
        /**
         * Force to move along Z axis (strafe up/down)
         * @type Force
         */
        this._zForce = null;
        /**
         * Torque to rotate along Z axis (yaw left/right)
         * @type Torque
         */
        this._yawTorque = null;
        /**
         * Torque to rotate along X axis (pitch up/down)
         * @type Torque
         */
        this._pitchTorque = null;
        /**
         * Torque to rotate along Y axis (roll left/right)
         * @type Torque
         */
        this._rollTorque = null;
        // cache variables
        /**
         * Cached value to calculate thrust forces faster
         * @type Number
         */
        this._thrustFactor = this._class.getThrust() / this._class.getMaxMoveBurnLevel();
        /**
         * Cached value to calculate angular thrust torques faster
         * @type Number
         */
        this._angularThrustFactor = this._class.getAngularThrust() / this._class.getMaxTurnBurnLevel();
    }
    /**
     * Nulls out the stored forces and torques - to be called afte the physical model of the spacecraft is reset and so
     * the forces and torques should be readded to it.
     */
    Propulsion.prototype.resetForcesAndTorques = function () {
        this._yForce = null;
        this._xForce = null;
        this._zForce = null;
        this._yawTorque = null;
        this._pitchTorque = null;
        this._rollTorque = null;
    };
    /**
     * 
     */
    Propulsion.prototype.acquireResources = function () {
        this._class.acquireResources();
    };
    /**
     * Returns the name of the propulsion system in a way that can be displayed to the user (translated)
     * @returns {String}
     */
    Propulsion.prototype.getDisplayName = function () {
        return this._class.getDisplayName();
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
            this._thrusters.push(thruster);
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
        var i;
        for (i = 0; i < this._thrusters.length; i++) {
            this._thrusters[i].addToScene(parentNode);
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
        var i;
        for (i = THRUSTER_USES.length - 1; i >= 0; i--) {
            this._thrusterUses[THRUSTER_USES[i]].burn = 0;
        }
        for (i = 0; i < this._thrusters.length; i++) {
            this._thrusters[i].resetBurn();
        }
    };
    /**
     * Updates the visual representations of all thrusters of this propulsion to represent their current burn levels.
     */
    Propulsion.prototype.updateVisuals = function () {
        var i;
        for (i = 0; i < this._thrusters.length; i++) {
            this._thrusters[i].updateVisuals();
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
                this._yForce = this._drivenPhysicalObject.addOrRenewForce(this._yForce, this._thrustFactor * this._thrusterUses.forward.burn, directionVector);
            } else if (this._thrusterUses.reverse.burn > 0) {
                this._yForce = this._drivenPhysicalObject.addOrRenewForce(this._yForce, -this._thrustFactor * this._thrusterUses.reverse.burn, directionVector);
            }
            if (this._thrusterUses.strafeRight.burn > 0) {
                this._xForce = this._drivenPhysicalObject.addOrRenewForce(this._xForce, this._thrustFactor * this._thrusterUses.strafeRight.burn, pitchAxis);
            } else if (this._thrusterUses.strafeLeft.burn > 0) {
                this._xForce = this._drivenPhysicalObject.addOrRenewForce(this._xForce, -this._thrustFactor * this._thrusterUses.strafeLeft.burn, pitchAxis);
            }
            if (this._thrusterUses.raise.burn > 0) {
                this._zForce = this._drivenPhysicalObject.addOrRenewForce(this._zForce, this._thrustFactor * this._thrusterUses.raise.burn, yawAxis);
            } else if (this._thrusterUses.lower.burn > 0) {
                this._zForce = this._drivenPhysicalObject.addOrRenewForce(this._zForce, -this._thrustFactor * this._thrusterUses.lower.burn, yawAxis);
            }
            if (this._thrusterUses.yawRight.burn > 0) {
                this._yawTorque = this._drivenPhysicalObject.addOrRenewTorque(this._yawTorque, this._angularThrustFactor * this._thrusterUses.yawRight.burn, yawAxis);
            } else if (this._thrusterUses.yawLeft.burn > 0) {
                this._yawTorque = this._drivenPhysicalObject.addOrRenewTorque(this._yawTorque, -this._angularThrustFactor * this._thrusterUses.yawLeft.burn, yawAxis);
            }
            if (this._thrusterUses.pitchUp.burn > 0) {
                this._pitchTorque = this._drivenPhysicalObject.addOrRenewTorque(this._pitchTorque, -this._angularThrustFactor * this._thrusterUses.pitchUp.burn, pitchAxis);
            } else if (this._thrusterUses.pitchDown.burn > 0) {
                this._pitchTorque = this._drivenPhysicalObject.addOrRenewTorque(this._pitchTorque, this._angularThrustFactor * this._thrusterUses.pitchDown.burn, pitchAxis);
            }
            if (this._thrusterUses.rollRight.burn > 0) {
                this._rollTorque = this._drivenPhysicalObject.addOrRenewTorque(this._rollTorque, -this._angularThrustFactor * this._thrusterUses.rollRight.burn, directionVector);
            } else if (this._thrusterUses.rollLeft.burn > 0) {
                this._rollTorque = this._drivenPhysicalObject.addOrRenewTorque(this._rollTorque, this._angularThrustFactor * this._thrusterUses.rollLeft.burn, directionVector);
            }
        }
        if (!this._thrusterSoundClip) {
            this._thrusterSoundClip = this._class.createThrusterSoundClip(spacecraftSoundSource);
            if (this._thrusterSoundClip) {
                this._thrusterSoundClip.setVolume(0);
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
        this._thrusters = null;
        this._thrusterUses = null;
        if (this._thrusterSoundClip) {
            this._thrusterSoundClip.stopPlaying(audio.SOUND_RAMP_DURATION);
            setTimeout(function () {
                this._thrusterSoundClip.destroy();
                this._thrusterSoundClip = null;
            }.bind(this), audio.SOUND_RAMP_DURATION);
        }
    };
    // #########################################################################
    /**
     * @class A class that can translate higher level maneuvering commands given to
     * a spacecraft (by user input or an AI) to low level thruster commands.
     * @param {Spacecraft} spacecraft The spacecraft the thrusters of which this
     * computer controls.
     */
    function ManeuveringComputer(spacecraft) {
        /**
         * The spacecraft the thrusters of which this computer controls.
         * @type Spacecraft
         */
        this._spacecraft = spacecraft;
        /**
         * Whether automatic inertia (drift) compensation is turned on. (combat and cruise flight modes)
         * @type Boolean
         */
        this._assisted = true;
        /**
         * Whether automatic turning restriction is turned on. (cruise flight mode)
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
         * When true, a speed target will be persistently remembered (with forward/reverse
         * commands increasing/decreasing it) and thrusters will automatically fire to
         * reach / hold it.
         * @type Boolean
         */
        this._holdSpeed = false;
        /**
         * This will be true while the speed target (along the Y axis) is controlled by actions with
         * specific intensity (such as the throttle on a joystick), as in this case the speed target
         * should be displayed to the user, even when not it speed holding mode.
         * @type Boolean
         */
        this._speedThrottled = false;
        /**
         * The target speed along the Y axis (in model space). The computer will
         * use forward and reverse thrusters to reach this speed if interia
         * compensation and speed holding are turned on. (in m/s)
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
         * When true, the maneuvering computer does not accept new commands.
         * @type Boolean
         */
        this._locked = false;
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
         * In combat mode, the forward speed target cannot exceed this. (in m/s)
         * @type Number
         */
        this._maxCombatForwardSpeed = 0;
        /**
         * In combat mode, the forward speed target cannot go below this. (negative, in m/s)
         * @type Number
         */
        this._maxCombatReverseSpeed = 0;
        /**
         * In cruise mode, the forward speed target cannot exceed this. (in m/s)
         * @type Number
         */
        this._maxCruiseForwardSpeed = 0;
        /**
         * In cruise mode, the forward speed target cannot go below this. (negative, in m/s)
         * @type Number
         */
        this._maxCruiseReverseSpeed = 0;
        /**
         * The maximum angle between vectors of the relative angular acceleration 
         * matrix and the identity axes on each 2D plane (yaw, pitch, roll)
         * (representing rad / physics.ANGULAR_VELOCITY_MATRIX_DURATION ms turn)
         * This is the general limit based on the ship's engines, does not consider flight mode restrictions!
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
     * Function to reset state before starting to execute the control actions triggered in the current simulation step.
     */
    ManeuveringComputer.prototype.prepareForControl = function () {
        this._speedThrottled = false;
    };
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
        var maxAcceleration = this._spacecraft.getMaxAcceleration();
        this.updateSpeedIncrementPerSecond();
        this._maxCombatForwardSpeed = _maxCombatForwardSpeedFactor * maxAcceleration;
        this._maxCombatReverseSpeed = _maxCombatReverseSpeedFactor * -maxAcceleration;
        this._maxCruiseForwardSpeed = _maxCruiseForwardSpeedFactor * maxAcceleration;
        this._maxCruiseReverseSpeed = _maxCruiseReverseSpeedFactor * -maxAcceleration;
        this.updateTurningLimit();
        this._maxMoveBurnLevel = this._spacecraft.getMaxThrusterMoveBurnLevel();
        this._maxTurnBurnLevel = this._spacecraft.getMaxThrusterTurnBurnLevel();
    };
    /**
     * Returns the turning limit restricted to disallow drifting (use for restricted flight modes)
     * @param {Number} [speed] The speed of the spacecraft at which to calculate the limit. If omitted, the current speed will be used
     * @returns {Number}
     */
    ManeuveringComputer.prototype.getRestrictedTurningLimit = function (speed) {
        return Math.min(
                this._turningLimit,
                this._spacecraft.getMaxTurnRateAtSpeed((speed === undefined) ? this._spacecraft.getRelativeVelocityMatrix()[13] : speed) * physics.ANGULAR_VELOCITY_MATRIX_DURATION_S);
    };
    /**
     * Returns whether the maneuvering computer is currently locked (not accepting new commands)
     * @returns {Boolean}
     */
    ManeuveringComputer.prototype.isLocked = function () {
        return this._locked;
    };
    /**
     * Locks / unlocks the maneuvering computer. While locked, no new commands are accepted.
     * @param {Boolean} value
     */
    ManeuveringComputer.prototype.setLocked = function (value) {
        this._locked = value;
        if (this._locked) {
            this._yawTarget = 0;
            this._pitchTarget = 0;
            this._rollTarget = 0;
        }
    };
    /**
     * Returns a string representation of the current flight mode.
     * @returns {String} enum FlightMode
     */
    ManeuveringComputer.prototype.getFlightMode = function () {
        return this._assisted ?
                (this._restricted ? FlightMode.CRUISE : FlightMode.COMBAT) : FlightMode.FREE;
    };
    /**
     * Switches to the specified (if any) or to the next flight mode. (free / combat / cruise)
     * @param {String} [flightMode]
     * @returns {Boolean} Whether the flight mode change happened.
     */
    ManeuveringComputer.prototype.changeFlightMode = function (flightMode) {
        if (this._locked) {
            return false;
        }
        if (!flightMode) {
            if (!this._assisted) {
                flightMode = FlightMode.COMBAT;
            } else if (!this._restricted) {
                flightMode = FlightMode.CRUISE;
            } else {
                flightMode = FlightMode.FREE;
            }
        }
        switch (flightMode) {
            case FlightMode.COMBAT:
                this._speedTarget = Math.min(Math.max(
                        this._maxCombatReverseSpeed,
                        this._assisted ? this._speedTarget : this._spacecraft.getRelativeVelocityMatrix()[13]),
                        this._maxCombatForwardSpeed);
                this._assisted = true;
                this._restricted = false;
                break;
            case FlightMode.CRUISE:
                this._speedTarget = Math.min(Math.max(
                        this._maxCruiseReverseSpeed,
                        this._assisted ? this._speedTarget : this._spacecraft.getRelativeVelocityMatrix()[13]),
                        this._maxCruiseForwardSpeed);
                this._assisted = true;
                this._restricted = true;
                break;
            case FlightMode.FREE:
                this._assisted = false;
                this._restricted = false;
                break;
            default:
                application.showError("Cannot switch to unknown flight mode: '" + flightMode + "'!");
                return false;
        }
        return true;
    };
    /**
     * Toggles between free and combat flight modes
     * @returns {Boolean} Whether the flight mode change happened.
     */
    ManeuveringComputer.prototype.toggleFlightAssist = function () {
        return this.changeFlightMode(this._assisted ? FlightMode.FREE : FlightMode.COMBAT);
    };
    /**
     * Toggles between cruise and combat flight modes
     * @returns {Boolean} Whether the flight mode change happened.
     */
    ManeuveringComputer.prototype.toggleCruise = function () {
        return this.changeFlightMode(this._restricted ? FlightMode.COMBAT : FlightMode.CRUISE);
    };
    /**
     * Increases the target speed if speed holding is turned on or sets it to maximum otherwise.
     * @param {Number} [intensity] If given, it will be factored into the amount of increase / set target
     */
    ManeuveringComputer.prototype.forward = function (intensity) {
        var maxSpeed;
        if (!this._locked) {
            if (this._assisted) {
                maxSpeed = this._restricted ? this._maxCruiseForwardSpeed : this._maxCombatForwardSpeed;
                this._speedThrottled = (intensity !== undefined);
                this._speedTarget = (this._holdSpeed && !this._speedThrottled) ?
                        Math.min(
                                Math.max(
                                        this._spacecraft.getRelativeVelocityMatrix()[13],
                                        this._speedTarget
                                        ) + this._speedIncrement,
                                maxSpeed) :
                        (intensity || 1) * maxSpeed;
            } else {
                this._speedTarget = Number.MAX_VALUE;
            }
        }
    };
    /**
     * Sets the target speed to the current speed if it is bigger. Only works 
     * in free flight mode.
     */
    ManeuveringComputer.prototype.stopForward = function () {
        var speed;
        if (!this._locked) {
            if (!this._assisted) {
                speed = this._spacecraft.getRelativeVelocityMatrix()[13];
                if (this._speedTarget > speed) {
                    this._speedTarget = speed;
                }
            } else if (!this._holdSpeed) {
                if (this._speedTarget > 0) {
                    this._speedTarget = 0;
                }
            }
        }
    };
    /**
     * Decreases the target speed if speed holding is turned on or sets it to negative maximum otherwise.
     * @param {Number} [intensity] If given, it will be factored into the amount of decrease / set target
     */
    ManeuveringComputer.prototype.reverse = function (intensity) {
        var maxSpeed;
        if (!this._locked) {
            if (this._assisted) {
                maxSpeed = this._restricted ? this._maxCruiseReverseSpeed : this._maxCombatReverseSpeed;
                this._speedThrottled = (intensity !== undefined);
                this._speedTarget = (this._holdSpeed && !this._speedThrottled) ?
                        Math.max(
                                Math.min(
                                        this._spacecraft.getRelativeVelocityMatrix()[13],
                                        this._speedTarget
                                        ) - this._speedIncrement,
                                maxSpeed) :
                        (intensity || 1) * maxSpeed;
            } else {
                this._speedTarget = -Number.MAX_VALUE;
            }
        }
    };
    /**
     * Sets the target speed to the current speed if it is smaller. Only works 
     * in free flight mode.
     */
    ManeuveringComputer.prototype.stopReverse = function () {
        var speed;
        if (!this._locked) {
            if (!this._assisted) {
                speed = this._spacecraft.getRelativeVelocityMatrix()[13];
                if (this._speedTarget < speed) {
                    this._speedTarget = speed;
                }
            } else if (!this._holdSpeed) {
                if (this._speedTarget < 0) {
                    this._speedTarget = 0;
                }
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
        if (!this._locked) {
            this._strafeTarget = this._restricted ? 0 : ((this._assisted && intensity) ? -intensity : -Number.MAX_VALUE);
        }
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
        if (!this._locked) {
            this._strafeTarget = this._restricted ? 0 : ((this._assisted && intensity) || Number.MAX_VALUE);
        }
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
        if (!this._locked) {
            this._liftTarget = this._restricted ? 0 : ((this._assisted && intensity) ? -intensity : -Number.MAX_VALUE);
        }
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
        if (!this._locked) {
            this._liftTarget = this._restricted ? 0 : ((this._assisted && intensity) || Number.MAX_VALUE);
        }
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
     * Toggles speed holding (in assisted flight modes)
     * @returns {Boolean} Whether the speed holding mode has changed
     */
    ManeuveringComputer.prototype.toggleSpeedHolding = function () {
        if (!this._locked) {
            if (this._assisted) {
                this._holdSpeed = !this._holdSpeed;
                if (this._holdSpeed) {
                    this._speedTarget = this._spacecraft.getRelativeVelocityMatrix()[13];
                    if (this._restricted) {
                        this._speedTarget = Math.min(Math.max(
                                this._maxCruiseReverseSpeed,
                                this._speedTarget),
                                this._maxCruiseForwardSpeed);
                    } else {
                        this._speedTarget = Math.min(Math.max(
                                this._maxCombatReverseSpeed,
                                this._speedTarget),
                                this._maxCombatForwardSpeed);
                    }

                }
                return true;
            }
        }
        return false;
    };
    /**
     * Sets speed holding to the passed value
     * @param {Boolean} value
     */
    ManeuveringComputer.prototype.setSpeedHolding = function (value) {
        this._holdSpeed = value;
    };
    /**
     * Resets the target (forward/reverse) speed to zero. (when speed holding is on)
     */
    ManeuveringComputer.prototype.resetSpeed = function () {
        if (!this._locked) {
            if (this._assisted && this._holdSpeed) {
                this._speedTarget = 0;
            }
        }
    };
    /**
     * Sets a new forward/reverse speed target in non-free flight modes.
     * @param {Number} value A positive number means a forward target, a negative one a reverse target, in m/s.
     */
    ManeuveringComputer.prototype.setSpeedTarget = function (value) {
        if (!this._locked) {
            if (this._assisted) {
                this._speedTarget = value;
            }
        }
    };
    /**
     * Return the currently set target for forward (positive) / reverse (negative) speed, in m/s. Only meaningful in assisted flight modes.
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
        return this._assisted && (this._holdSpeed || this._speedThrottled);
    };
    /**
     * If the current flight mode imposes a speed limit, returns it. (in m/s) Otherwise returns undefined.
     * @returns {Number}
     */
    ManeuveringComputer.prototype.getMaxSpeed = function () {
        return this._assisted ? (this._restricted ? this._maxCruiseForwardSpeed : this._maxCombatForwardSpeed) : undefined;
    };
    /**
     * Sets the target angular velocity to yaw to the left with the given intensity 
     * multiplied by the turning limit, or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.yawLeft = function (intensity) {
        if (!this._locked) {
            // if no intensity was given for the turn, turn with maximum power (mouse or
            // joystick control can have fine intensity control, while with keyboard,
            // when the key is pressed, we just call this without parameter)
            if (intensity === undefined) {
                this._yawTarget = -this._turningLimit;
                // if a specific intensity was set, set the target to it, capping it out at
                // the maximum allowed turning speed
            } else if (intensity > 0) {
                this._yawTarget = -intensity * (this._restricted ? this.getRestrictedTurningLimit() : this._turningLimit);
                // if a zero or negative intensity was given, set the target to zero,
                // but only if it is set to turn to left
            } else if (this._yawTarget < 0) {
                this._yawTarget = 0;
            }
        }
    };
    /**
     * Sets the target angular velocity to yaw to the right with the given intensity 
     * multiplied by the turning limit, or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.yawRight = function (intensity) {
        if (!this._locked) {
            if (intensity === undefined) {
                this._yawTarget = this._turningLimit;
            } else if (intensity > 0) {
                this._yawTarget = intensity * (this._restricted ? this.getRestrictedTurningLimit() : this._turningLimit);
            } else if (this._yawTarget > 0) {
                this._yawTarget = 0;
            }
        }
    };
    /**
     * Sets the target angular velocity to pitch down with the given intensity 
     * multiplied by the turning limit, or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.pitchDown = function (intensity) {
        if (!this._locked) {
            if (intensity === undefined) {
                this._pitchTarget = -this._turningLimit;
            } else if (intensity > 0) {
                this._pitchTarget = -intensity * (this._restricted ? this.getRestrictedTurningLimit() : this._turningLimit);
            } else if (this._pitchTarget < 0) {
                this._pitchTarget = 0;
            }
        }
    };
    /**
     * Sets the target angular velocity to pitch up with the given intensity 
     * multiplied by the turning limit, or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.pitchUp = function (intensity) {
        if (!this._locked) {
            if (intensity === undefined) {
                this._pitchTarget = this._turningLimit;
            } else if (intensity > 0) {
                this._pitchTarget = intensity * (this._restricted ? this.getRestrictedTurningLimit() : this._turningLimit);
            } else if (this._pitchTarget > 0) {
                this._pitchTarget = 0;
            }
        }
    };
    /**
     * Sets the target angular velocity to roll to the left with the given intensity 
     * multiplied by the turning limit, or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.rollLeft = function (intensity) {
        if (!this._locked) {
            if (intensity === undefined) {
                this._rollTarget = -this._turningLimit;
            } else if (intensity > 0) {
                this._rollTarget = -intensity * this._turningLimit;
            } else if (this._rollTarget < 0) {
                this._rollTarget = 0;
            }
        }
    };
    /**
     * Sets the target angular velocity to roll to the right with the given intensity 
     * multiplied by the turning limit, or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.rollRight = function (intensity) {
        if (!this._locked) {
            if (intensity === undefined) {
                this._rollTarget = this._turningLimit;
            } else if (intensity > 0) {
                this._rollTarget = intensity * this._turningLimit;
            } else if (this._rollTarget > 0) {
                this._rollTarget = 0;
            }
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
                turningLimit,
                yawTarget = this._yawTarget,
                pitchTarget = this._pitchTarget,
                yawAngle, pitchAngle, rollAngle;
        // we will add the needed burn levels together, so start from zero
        this._spacecraft.resetThrusterBurn();
        // restrict turning according to current speed in restricted mode
        if (this._restricted && (speed !== 0.0)) {
            // restrict the limit if needed (convert from rad/sec to rad / ANGULAR_VELOCITY_MATRIX_DURATION ms)
            turningLimit = this.getRestrictedTurningLimit(speed);
            //apply the restricted limit
            yawTarget = Math.min(Math.max(yawTarget, -turningLimit), turningLimit);
            pitchTarget = Math.min(Math.max(pitchTarget, -turningLimit), turningLimit);
        }
        // controlling yaw
        yawAngle = Math.sign(turningMatrix[4]) * vec.angle2u(vec.UNIT2_Y, vec.normalize2([turningMatrix[4], turningMatrix[5]]));
        if ((yawTarget - yawAngle) > turnThreshold) {
            this._spacecraft.addThrusterBurn(ThrusterUse.YAW_RIGHT,
                    Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(yawTarget - yawAngle, dt)));
        } else if ((yawTarget - yawAngle) < -turnThreshold) {
            this._spacecraft.addThrusterBurn(ThrusterUse.YAW_LEFT,
                    Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(yawAngle - yawTarget, dt)));
        }
        // controlling pitch
        pitchAngle = Math.sign(turningMatrix[6]) * vec.angle2u(vec.UNIT2_X, vec.normalize2([turningMatrix[5], turningMatrix[6]]));
        if ((pitchTarget - pitchAngle) > turnThreshold) {
            this._spacecraft.addThrusterBurn(ThrusterUse.PITCH_UP,
                    Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(pitchTarget - pitchAngle, dt)));
        } else if ((pitchTarget - pitchAngle) < -turnThreshold) {
            this._spacecraft.addThrusterBurn(ThrusterUse.PITCH_DOWN,
                    Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(pitchAngle - pitchTarget, dt)));
        }
        // controlling roll
        rollAngle = Math.sign(-turningMatrix[2]) * vec.angle2u(vec.UNIT2_X, vec.normalize2([turningMatrix[0], turningMatrix[2]]));
        if ((this._rollTarget - rollAngle) > turnThreshold) {
            this._spacecraft.addThrusterBurn(ThrusterUse.ROLL_RIGHT,
                    Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(this._rollTarget - rollAngle, dt)));
        } else if ((this._rollTarget - rollAngle) < -turnThreshold) {
            this._spacecraft.addThrusterBurn(ThrusterUse.ROLL_LEFT,
                    Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(rollAngle - this._rollTarget, dt)));
        }
        // controlling forward/reverse
        if ((this._speedTarget - speed) > speedThreshold) {
            this._spacecraft.addThrusterBurn(ThrusterUse.FORWARD,
                    Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(this._speedTarget - speed, dt)));
        } else if ((this._speedTarget - speed) < -speedThreshold) {
            this._spacecraft.addThrusterBurn(ThrusterUse.REVERSE,
                    Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(speed - this._speedTarget, dt)));
        }
        // controlling horizontal drift
        if (this._assisted || (this._strafeTarget !== 0)) {
            speed = relativeVelocityMatrix[12];
            if ((this._strafeTarget - speed) > speedThreshold) {
                this._spacecraft.addThrusterBurn(ThrusterUse.STRAFE_RIGHT,
                        Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(this._strafeTarget - speed, dt)));
            } else if ((this._strafeTarget - speed) < -speedThreshold) {
                this._spacecraft.addThrusterBurn(ThrusterUse.STRAFE_LEFT,
                        Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(speed - this._strafeTarget, dt)));
            }
        }
        // controlling vertical drift
        if (this._assisted || (this._liftTarget !== 0)) {
            speed = relativeVelocityMatrix[14];
            if ((this._liftTarget - speed) > speedThreshold) {
                this._spacecraft.addThrusterBurn(ThrusterUse.RAISE,
                        Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(this._liftTarget - speed, dt)));
            } else if ((this._liftTarget - speed) < -speedThreshold) {
                this._spacecraft.addThrusterBurn(ThrusterUse.LOWER,
                        Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(speed - this._liftTarget, dt)));
            }
        }
        this._spacecraft.updatePropulsionVisuals();
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
    // #########################################################################
    /**
     * @class This piece of equipment governs the hyperspace jump sequences by managing an internal state about them, triggering 
     * corresponding spacecraft events, controlling the spacecraft itself, adding the appripriate effects to the scene and playing sound 
     * effects
     * @param {JumpEngineClass} jumpEngineClass
     * @param {Spacecraft} spacecraft The spacecraft to equip this jump engine on
     */
    function JumpEngine(jumpEngineClass, spacecraft) {
        /**
         * The class specifying the characteristics of how the jumps should look / sound like
         * @type JumpEngineClass
         */
        this._class = jumpEngineClass;
        /**
         * The spacecraft this engine is equipped on
         * @type Spacecraft
         */
        this._spacecraft = spacecraft;
        /**
         * In which overall stage of the jump sequence are we
         * @type Number
         */
        this._state = JumpEngine.JumpState.NONE;
        /**
         * How much time is left from the current jump state
         * @type Number
         */
        this._timeLeft = 0;
        /**
         * A reference to the currently played sound clip, if any
         * @type SoundClip
         */
        this._soundClip = null;
        /**
         * Stores the flight mode that was set on the spacecraft when the jump sequence was initiated, so that it can be reset if the jump
         * is cancelled.
         * @type String
         */
        this._originalFlightMode = null;
        /**
         * Stores a copy of the original scaling matrix of the spacecraft (it is altered during the jump sequences, stretching the 
         * spacecraft along the Y axis)
         * @type Float32Array
         */
        this._originalScalingMatrix = null;
    }
    /**
     * The threshold for tolerating drift / speed difference when aligning the velocity of the spacecraft for preparation
     * @type Number
     */
    JumpEngine.VELOCITY_TOLERANCE = 0.01;
    /**
     * @enum Defines the possible states a jump engine can be in
     * @type Object
     */
    JumpEngine.JumpState = {
        /** No jump in progress */
        NONE: 0,
        /** A jump out has been initiated, the correct velocity needs to be reached without drift - controls disabled */
        ALIGNING_VELOCITY: 1,
        /** The engine is powering up for a jump out, spacecraft travelling with the correct velocity */
        PREPARING: 2,
        /** Jump out is in progress, spacecraft rapidly accelerating until it disappears in a flash */
        JUMPING_OUT: 3,
        /** Jump in is in progress, spacecraft rapidly decelerating until it becomes controllable */
        JUMPING_IN: 4
    };
    Object.freeze(JumpEngine.JumpOutState);
    /**
     * Call to make sure all needed resources are going to be loaded
     */
    JumpEngine.prototype.acquireResources = function () {
        this._class.acquireResources();
    };
    /**
     * Initiates the jump out sequence
     * @param {Boolean} toggle If true, calling the method while the jump out sequence is under way will cancel the jump
     */
    JumpEngine.prototype.jumpOut = function (toggle) {
        var wasPreparing;
        switch (this._state) {
            // initiating jump out sequence
            case JumpEngine.JumpState.NONE:
                this._state = JumpEngine.JumpState.ALIGNING_VELOCITY;
                // setting up the maneuvering computer to guide the spacecraft to the required velocity
                this._originalFlightMode = this._spacecraft.getFlightMode();
                this._spacecraft.changeFlightMode(FlightMode.CRUISE);
                this._spacecraft.setSpeedTarget(this._class.getPrepareVelocity());
                this._spacecraft.lockManeuvering();
                this._spacecraft.disableFiring();
                // the starting sound effect (computer blips) only need to be played for the piloted spacecraft - the event handler should
                // return true if the event handling included the HUD and other piloted spacecraft related updates
                if (this._spacecraft.handleEvent(SpacecraftEvents.JUMP_ENGAGED)) {
                    this._soundClip = this._class.createEngageSoundClip();
                    if (this._soundClip) {
                        this._soundClip.play();
                    }
                }
                break;
                // cancelling jump out sequence
            case JumpEngine.JumpState.ALIGNING_VELOCITY:
            case JumpEngine.JumpState.PREPARING:
                if (toggle) {
                    wasPreparing = this._state === JumpEngine.JumpState.PREPARING;
                    this._state = JumpEngine.JumpState.NONE;
                    this._spacecraft.unlockManeuvering();
                    this._spacecraft.changeFlightMode(this._originalFlightMode);
                    this._spacecraft.enableFiring();
                    if (this._soundClip) {
                        this._soundClip.stopPlaying(audio.SOUND_RAMP_DURATION);
                        this._soundClip = null;
                    }
                    // the disengage sound effect (computer blips) only need to be played for the piloted spacecraft - the event handler should
                    // return true if the event handling included the HUD and other piloted spacecraft related updates
                    if (this._spacecraft.handleEvent(SpacecraftEvents.JUMP_CANCELLED)) {
                        this._soundClip = this._class.createDisengageSoundClip();
                        if (this._soundClip) {
                            this._soundClip.play();
                        }
                    }
                    // the longer cancellation sound (a "power down" type sound effect) is played (for all spacecrafts) and the reference is set
                    // to this one so that it can be stopped if the spacecraft is destroyed while it is playing
                    if (wasPreparing) {
                        this._soundClip = this._class.createCancelSoundClip();
                        if (this._soundClip) {
                            this._soundClip.play();
                        }
                    }
                }
                break;
        }
    };
    /**
     * Initiates the jump in sequence
     */
    JumpEngine.prototype.jumpIn = function () {
        var directionVector, exp, physicalModel;
        // initiating jump in sequence
        if (this._state === JumpEngine.JumpState.NONE) {
            this._state = JumpEngine.JumpState.JUMPING_IN;
            this._timeLeft = this._class.getJumpInDuration();
            this._spacecraft.unlockManeuvering();
            this._spacecraft.setSpeedTarget(0);
            this._spacecraft.lockManeuvering();
            this._spacecraft.disableFiring();
            exp = explosion.getExplosion();
            exp.init(
                    this._class.getJumpInExplosionClass(),
                    this._spacecraft.getPhysicalPositionMatrix(),
                    this._spacecraft.getPhysicalOrientationMatrix(),
                    mat.getRowC43(this._spacecraft.getPhysicalPositionMatrix()),
                    true,
                    mat.IDENTITY4);
            exp.addToScene(this._spacecraft.getVisualModel().getNode().getScene().getRootNode(), this._spacecraft.getSoundSource());
            this._originalScalingMatrix = mat.matrix4(this._spacecraft.getVisualModel().getScalingMatrix());
            physicalModel = this._spacecraft.getPhysicalModel();
            directionVector = mat.getRowB4(physicalModel.getOrientationMatrix());
            // calculate and set the starting velocity based on the set final velocity and total deceleration during the jump in sequence
            physicalModel.setVelocityMatrix(mat.translation4v(vec.scaled3(directionVector, this._class.getJumpInVelocity() + this._class.getJumpInDeceleration() * this._class.getJumpInDuration() / 1000)));
            physicalModel.addForce(new physics.Force(physicalModel.getMass() * this._class.getJumpInDeceleration(), vec.scaled3(directionVector, -1), this._class.getJumpInDuration()));
            this._soundClip = this._class.createJumpInSoundClip(this._spacecraft.getSoundSource());
            if (this._soundClip) {
                this._soundClip.play();
            }
            this._spacecraft.setAway(false);
            this._spacecraft.handleEvent(SpacecraftEvents.JUMPED_IN);
        }
    };
    /**
     * Call in every simulation step to update the internal state and initiate the appropriate events / effects
     * @param {Number} dt The amount of time passed since the last simulation step, in milliseonds
     */
    JumpEngine.prototype.simulate = function (dt) {
        var velocityMatrix, directionVector, exp, physicalModel;
        switch (this._state) {
            case JumpEngine.JumpState.ALIGNING_VELOCITY:
                velocityMatrix = this._spacecraft.getRelativeVelocityMatrix();
                if ((Math.abs(velocityMatrix[12]) < JumpEngine.VELOCITY_TOLERANCE) &&
                        (Math.abs(velocityMatrix[14]) < JumpEngine.VELOCITY_TOLERANCE) &&
                        (Math.abs(velocityMatrix[13] - this._class.getPrepareVelocity()) < JumpEngine.VELOCITY_TOLERANCE)) {
                    // switching to next state if the alignment is reached
                    this._state = JumpEngine.JumpState.PREPARING;
                    this._timeLeft = this._class.getPrepareDuration();
                    this._soundClip = this._class.createPrepareSoundClip(this._spacecraft.getSoundSource());
                    if (this._soundClip) {
                        this._soundClip.play();
                    }
                }
                break;
            case JumpEngine.JumpState.PREPARING:
                // this event is triggered every step (so that the countdown timer on the HUD can be updated)
                this._spacecraft.handleEvent(SpacecraftEvents.PREPARING_JUMP, {
                    duration: this._class.getPrepareDuration(),
                    timeLeft: this._timeLeft
                });
                // switching to the next state when the time is up
                if (this._timeLeft <= 0) {
                    this._state = JumpEngine.JumpState.JUMPING_OUT;
                    this._timeLeft = this._class.getJumpOutDuration();
                    this._soundClip = this._class.createJumpOutSoundClip(this._spacecraft.getSoundSource());
                    if (this._soundClip) {
                        this._soundClip.play();
                    }
                    physicalModel = this._spacecraft.getPhysicalModel();
                    directionVector = mat.getRowB4(physicalModel.getOrientationMatrix());
                    physicalModel.addForce(new physics.Force(physicalModel.getMass() * this._class.getJumpOutAcceleration(), directionVector, this._class.getJumpOutDuration()));
                    // make sure the forward engines of the spacecraft are firing during the jump out sequence, despite the high velocity it will reach
                    this._spacecraft.unlockManeuvering();
                    this._spacecraft.setSpeedTarget(Number.MAX_VALUE);
                    this._spacecraft.lockManeuvering();
                    this._originalScalingMatrix = mat.matrix4(this._spacecraft.getVisualModel().getScalingMatrix());
                    this._spacecraft.handleEvent(SpacecraftEvents.JUMP_OUT_STARTED);
                }
                this._timeLeft -= dt;
                break;
            case JumpEngine.JumpState.JUMPING_OUT:
                // stretching the spacecraft along the Y axis (by a linearly incrasing factor)
                this._spacecraft.getVisualModel().setScalingMatrix(mat.prod3x3SubOf4(
                        this._originalScalingMatrix,
                        mat.scaling4(1, 1 + (1 - this._timeLeft / this._class.getJumpOutDuration()) * (this._class.getJumpOutScaling() - 1), 1)));
                // finishing up the particle effect when the time is up
                if (this._timeLeft <= 0) {
                    this._state = JumpEngine.JumpState.NONE;
                    exp = explosion.getExplosion();
                    exp.init(
                            this._class.getJumpOutExplosionClass(),
                            this._spacecraft.getPhysicalPositionMatrix(),
                            this._spacecraft.getPhysicalOrientationMatrix(),
                            mat.getRowC43(this._spacecraft.getPhysicalPositionMatrix()),
                            true,
                            mat.IDENTITY4);
                    exp.addToScene(this._spacecraft.getVisualModel().getNode().getScene().getRootNode(), this._spacecraft.getSoundSource());
                    this._spacecraft.getVisualModel().setScalingMatrix(this._originalScalingMatrix);
                    this._spacecraft.setAway(true);
                    this._spacecraft.handleEvent(SpacecraftEvents.JUMPED_OUT);
                }
                this._timeLeft -= dt;
                break;
            case JumpEngine.JumpState.JUMPING_IN:
                // the stretching needs to be poperly calculated - do not allow negative timeLeft values
                if (this._timeLeft < 0) {
                    this._timeLeft = 0;
                }
                // stretching the spacecraft along the Y axis (by a linearly decreasing factor)
                this._spacecraft.getVisualModel().setScalingMatrix(mat.prod3x3SubOf4(
                        this._originalScalingMatrix,
                        mat.scaling4(1, 1 + (this._timeLeft / this._class.getJumpInDuration()) * (this._class.getJumpInScaling() - 1), 1)));
                // finishing the sequence if the time is up
                if (this._timeLeft <= 0) {
                    this._state = JumpEngine.JumpState.NONE;
                    this._spacecraft.unlockManeuvering();
                    this._spacecraft.enableFiring();
                    this._spacecraft.handleEvent(SpacecraftEvents.ARRIVED);
                }
                this._timeLeft -= dt;
                break;
        }
    };
    /**
     * Deletes stored references, stops sound playback. Call when the spacecraft is destroyed.
     */
    JumpEngine.prototype.destroy = function () {
        this._class = null;
        this._spacecraft = null;
        if (this._soundClip) {
            this._soundClip.destroy();
            this._soundClip = null;
        }
        this._originalScalingMatrix = null;
    };
    // #########################################################################
    /**
     * @class This piece of equipment absorbs incoming damage, preserving the hull integrity of the spacecraft it is
     * equipped on, and regenerates its capacity over time.
     * @param {ShieldClass} shieldClass
     * @param {Spacecraft} spacecraft The spacecraft to equip this shield on
     */
    function Shield(shieldClass, spacecraft) {
        var color;
        /**
         * The class specifying the characteristics of the shield
         * @type ShieldClass
         */
        this._class = shieldClass;
        /**
         * The spacecraft this shield is equipped on
         * @type Spacecraft
         */
        this._spacecraft = spacecraft;
        /**
         * The current capacity (the amount of damage the shield can yet absorb before being depleted)
         * @type Number
         */
        this._capacity = shieldClass.getCapacity();
        /**
         * The amount of time elapsed since the shield was last hit, in milliseconds
         * @type Number
         */
        this._timeSinceHit = 0;
        /**
         * The amount of time elapsed since the shield started recharging, in milliseconds
         * @type Number
         */
        this._timeSinceRecharge = shieldClass ? shieldClass.getRechargeAnimationDuration() : 0;
        /**
         * Current shield state for visuals (RGB color + animation progress)
         * @type Number[4]
         */
        this._state = [0, 0, 0, 0];
        if (shieldClass) {
            color = shieldClass.getRechargeColor();
            this._state[0] = color[0];
            this._state[1] = color[1];
            this._state[2] = color[2];
        }
        /**
         * A reference to the currently played sound clip, if any
         * @type SoundClip
         */
        this._soundClip = null;
    }
    /**
     * Call to make sure all needed resources are going to be loaded
     */
    Shield.prototype.acquireResources = function () {
        this._class.acquireResources();
    };
    /**
     * Returns the name of the shield in a way that can be displayed to the user (translated)
     * @returns {String}
     */
    Shield.prototype.getDisplayName = function () {
        return this._class.getDisplayName();
    };
    /**
     * Returns the shield's integrity ratio (current / maximum capacity)
     * @returns {Number}
     */
    Shield.prototype.getIntegrity = function () {
        return this._capacity / this._class.getCapacity();
    };
    /**
     * Returns the shield's current capacity
     * @returns {Number}
     */
    Shield.prototype.getCapacity = function () {
        return this._capacity;
    };
    /**
     * Returns the shield's recharge rate (in capacity / second)
     * @returns {Number}
     */
    Shield.prototype.getRechargeRate = function () {
        return this._class.getRechargeRate();
    };
    /**
     * Returns the state of the shield to be used for visuals (color and animation progress)
     * @returns {Number[4]}
     */
    Shield.prototype.getState = function () {
        return this._state;
    };
    /**
     * Call when the shield (the spacecraft that has the shield) is damaged
     * @param {Number} damage The amount of damage (to be) dealt to the spacecraft
     * @returns {Number} The amount of damage that should be dealt to the armor of the spacecraft (original minus the amount absorbed by the shield)
     */
    Shield.prototype.damage = function (damage) {
        var absorbed = Math.min(this._capacity, damage);
        this._timeSinceHit = 0;
        this._capacity -= absorbed;
        return damage - absorbed;
    };
    /**
     * Startes recharging the shield (skipping any delay that might be left, playing sound/animation even if the shield was already full)
     */
    Shield.prototype.startRecharge = function () {
        this._soundClip = this._class.createRechargeStartSoundClip(this._spacecraft.getSoundSource());
        if (this._soundClip) {
            this._soundClip.play();
        }
        this._timeSinceRecharge = 0;
    };
    /**
     * Call in every simulation step to update the internal state and initiate the appropriate events / effects
     * @param {Number} dt The amount of time passed since the last simulation step, in milliseonds
     */
    Shield.prototype.simulate = function (dt) {
        var duration = this._class.getRechargeAnimationDuration();
        if (this._capacity < this._class.getCapacity()) {
            if (this._timeSinceHit < this._class.getRechargeDelay()) {
                this._timeSinceHit += dt;
                if (this._timeSinceHit >= this._class.getRechargeDelay()) {
                    this.startRecharge();
                }
            } else {
                // recharging
                this._capacity = Math.min(this._class.getCapacity(), this._capacity + this._class.getRechargeRate() * dt * 0.001); // sec -> ms
            }
        }
        this._timeSinceRecharge = Math.min(duration, this._timeSinceRecharge + dt);
        this._state[3] = this._timeSinceRecharge / duration;
    };
    /**
     * Returns the amount of score points to be added to the total score value of spacecrafts that have this shield equipped
     * @returns {Number}
     */
    Shield.prototype.getScoreValue = function () {
        return this._class.getScoreValue();
    };
    /**
     * Deletes stored references. Call when the spacecraft is destroyed.
     */
    Shield.prototype.destroy = function () {
        this._class = null;
        this._spacecraft = null;
        if (this._soundClip) {
            this._soundClip.destroy();
            this._soundClip = null;
        }
    };
    // ##############################################################################
    // initialization
    // obtaining pool references
    _particlePool = pools.getPool(renderableObjects.Particle);
    _projectilePool = pools.getPool(Projectile);
    // caching configuration settings
    config.executeWhenReady(function () {
        _isSelfFireEnabled = config.getSetting(config.BATTLE_SETTINGS.SELF_FIRE);
        _momentDuration = config.getSetting(config.BATTLE_SETTINGS.MOMENT_DURATION);
        _minimumMuzzleFlashParticleCountForInstancing = config.getSetting(config.BATTLE_SETTINGS.MINIMUM_MUZZLE_FLASH_PARTICLE_COUNT_FOR_INSTANCING);
        _minimumProjectileCountForInstancing = config.getSetting(config.BATTLE_SETTINGS.MINIMUM_PROJECTILE_COUNT_FOR_INSTANCING);
        _maxCombatForwardSpeedFactor = config.getSetting(config.BATTLE_SETTINGS.MAX_COMBAT_FORWARD_SPEED_FACTOR);
        _maxCombatReverseSpeedFactor = config.getSetting(config.BATTLE_SETTINGS.MAX_COMBAT_REVERSE_SPEED_FACTOR);
        _maxCruiseForwardSpeedFactor = config.getSetting(config.BATTLE_SETTINGS.MAX_CRUISE_FORWARD_SPEED_FACTOR);
        _maxCruiseReverseSpeedFactor = config.getSetting(config.BATTLE_SETTINGS.MAX_CRUISE_REVERSE_SPEED_FACTOR);
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
        ThrusterUse: ThrusterUse,
        Projectile: Projectile,
        Weapon: Weapon,
        TargetingComputer: TargetingComputer,
        Propulsion: Propulsion,
        JumpEngine: JumpEngine,
        Shield: Shield,
        ManeuveringComputer: ManeuveringComputer
    };
});