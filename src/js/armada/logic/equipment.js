/**
 * Copyright 2014-2022 Krisztián Nagy
 * @file Implementations of the various classes that represent all the different types of equipment to be added to spacecrafts
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

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
             * When adding the resources of a projectile (class) to a scene, this prefix is used in the ID to avoid adding the same one multiple
             * times
             * @type String
             */
            PROJECTILE_RESOURCE_ID_PREFIX = "projectile/",
            /**
             * When adding the resources of a missile (class) to a scene, this prefix is used in the ID to avoid adding the same one multiple
             * times
             * @type String
             */
            MISSILE_RESOURCE_ID_PREFIX = "missile/",
            /**
             * When adding the resources of a weapon (class) to a scene, this prefix is used in the ID to avoid adding the same one multiple
             * times
             * @type String
             */
            WEAPON_RESOURCE_ID_PREFIX = "weapon/",
            /**
             * When adding the resources of a missile launcher to a scene, this prefix is used in the ID to avoid adding the same one multiple
             * times
             * @type String
             */
            MISSILE_LAUNCHER_RESOURCE_ID_PREFIX = "missileLauncher/",
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
            /**
             * Missiles will stop turning towards the specified direction when reaching this angle (in radians).
             * (note that they will activate their main thruster to accelerate with a higher threshold defined
             * for the specific missile class)
             * @type Number
             */
            MISSILE_TURN_THRESHOLD_ANGLE = Math.radians(0.05),
            /**
             * The factor to apply when converting angular velocity (turning) matrix angles to rad / s.
             * @type Number
             */
            ANGULAR_VELOCITY_CONVERSION_FACTOR = 1000 / physics.ANGULAR_VELOCITY_MATRIX_DURATION,
            /**
             * Missiles will use their maneuvering thrusters for maximum this long bursts to spin
             * them up for the proper rotation towards the desired orientation, in seconds
             * @type Number
             */
            MISSILE_TURN_ACCELERATION_DURATION_S = 0.2,
            /**
             * Cached value of the reciprocal of the missile turn acceleration duration (converted to
             * 1 / ms) for faster missile turn calculations
             * @type Number
             */
            MISSILE_TURN_INTENSITY_BASE_FACTOR = 1000 / MISSILE_TURN_ACCELERATION_DURATION_S,
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * Cached value of the configuration setting whether self-fire (a spacecraft hitting itself with its own projectiles) is enabled.
             * @type Boolean
             */
            _isSelfFireEnabled = false,
            /**
             * Cached value of the setting for the current difficulty whether the player ship can damage itself
             * @type Boolean
             */
            _isPlayerSelfDamageEnabled = false,
            /**
             * Cached value of the setting for the current difficulty whether the player ship can be damaged by friendly fire
             * @type Boolean
             */
            _isPlayerFriendlyFireDamageEnabled = false,
            /**
             * Cached value of the setting for the current difficulty of how big of an offset should be applied for hitboxes when the player ship is shooting hostiles
             * @type Number
             */
            _hitboxOffset = 0,
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
             * Stores the uniform parameter array definitions (what arrays are there and what are their types in
             * name: type format) to use when creating visual models for equipment
             * @type Object
             */
            _parameterArrays = null,
            /**
             * A cached value of whether dynamic lights are turned on / available
             * @type Boolean
             */
            _dynamicLights = false,
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
            _projectilePool,
            /**
             * A pool containing missiles for reuse, so that creation of new missile objects can be decreased for optimization.
             * @type Pool
             */
            _missilePool,
            /**
             * A pool containing trail segments for reuse, so that creation of objects while creating trails can be decreased for optimization.
             * @type Pool
             */
            _trailSegmentPool,
            /**
             * A reusable object to store the result of angle calculations
             * @type Object
             */
            _angles = {
                yaw: 0,
                pitch: 0,
                roll: 0
            },
            // auxiliary variables to use during hit checking
            /**
             * Whether the projectile/missile currently being checked was fired by the piloted spacecraft
             * @type Boolean
             */
            _isPiloted = false,
            /**
             * Whether the projectile/missile currently being checked can damage the spacecraft it was fired from
             * @type Boolean
             */
            _canDamageSelf = false,
            /**
             * Whether the projectile/missile currently being checked can damage the player (the piloted spacecraft)
             * @type Boolean
             */
            _canDamagePlayer = false,
            /**
             * The callback to calculate the offset for the current hitcheck
             * @type Function
             */
            _offsetCallback = null,
            /**
             * The callback to execute if the hit check passes
             * @type Function
             */
            _hitCallback = null,
            /**
             * The spacecraft that fired the currently checked projectile/missile
             * @type Function
             */
            _origin,
            /**
             * The spacecraft piloted by the player
             * @type Spacecraft
             */
            _pilotedCraft,
            /**
             * The position matrix of the currently checked projectile/missile
             * @type Float32Array
             */
            _positionMatrix,
            /**
             * The velocity matrix of the currently checked projectile/missile
             * @type Float32Array
             */
            _velocityMatrix,
            /**
             * The amount of time to consider for the hit check, in milliseconds
             * @type Number
             */
            _hitCheckDT,
            /**
             * Reusable vector to store the relative velocity in
             * @type Number[3]
             */
            _relativeVelocityDirectionInWorldSpace = [0, 0, 0];
    Object.freeze(FlightMode);
    Object.freeze(WeaponAimStatus);
    Object.freeze(ThrusterUse);
    // #########################################################################
    // public functions
    /**
     * Needs to be executed whenever the settings in the graphics module change
     */
    function handleGraphicsSettingsChanged() {
        _parameterArrays = {};
        // setting up parameter array declarations (name: type)
        _parameterArrays[_groupTransformsArrayName] = managedGL.ShaderVariableType.MAT4;
        if (graphics.areLuminosityTexturesAvailable()) {
            _parameterArrays[_luminosityFactorsArrayName] = managedGL.ShaderVariableType.FLOAT;
        }
        _dynamicLights = graphics.areDynamicLightsAvailable() && (graphics.getMaxPointLights() > 0);
    }
    /**
     * Needs to be called when the difficulty level is set / changed (i.e. when a mission is started)
     * @param {DifficultyLevel} difficulty
     */
    function handleDifficultySet(difficulty) {
        _isPlayerSelfDamageEnabled = difficulty.getPlayerSelfDamage();
        _isPlayerFriendlyFireDamageEnabled = difficulty.getPlayerFriendlyFireDamage();
        _hitboxOffset = difficulty.getHitboxOffset();
    }
    // ------------------------------------------------------------------------------
    // private functions
    /**
     * Adds to the thruster burn level corresponding to a specific use command
     * @param {Object} use The object storing the burn level and thruster list
     * corresponding to the use command
     * @param {Number} value The amount added to the thruster burn level.
     */
    function _addThrusterBurn(use, value) {
        var i;
        use.burn += value;
        for (i = 0; i < use.thrusters.length; i++) {
            use.thrusters[i].addBurn(value);
        }
    }
    /**
     * Get the offset to be used for hit checks for projectiles (the sides of the hitboxes
     * are offset towards the outside (i.e. the hitbox is enlarged in all directions) by this
     * much, in meters)
     * @param {Spacecraft} hitObject The spacecraft getting hit
     * @param {Boolean} pilotedToHostile Whether this is for a projectile fired by the player ship hit checking a hostile
     * @returns {Number}
     */
    function _getDefaultOffset(hitObject, pilotedToHostile) {
        return pilotedToHostile ? _hitboxOffset : 0;
    }
    /**
     * Checks if the projectile/missile set up according to the module variables has hit the passed spacecraft, and also calls the necessary
     * callbacks to handle the hit if it did.
     * @param {Spacecraft} hitObject
     * @returns {Boolean} Whether there was a hit or not
     */
    function _checkHitForObject(hitObject) {
        var
                relativeVelocityDirectionInObjectSpace,
                relativeVelocity,
                physicalHitObject, hitPositionVectorInObjectSpace, hitPositionVectorInWorldSpace, relativeHitPositionVectorInWorldSpace, offset;
        if (_showHitboxesForHitchecks) {
            hitObject.showHitbox();
        }
        physicalHitObject = hitObject.getPhysicalModel();
        if (physicalHitObject && (
                ((hitObject === _origin) && _canDamageSelf) ||
                ((hitObject !== _origin) && (_canDamagePlayer || (hitObject !== _pilotedCraft))))) {
            offset = _offsetCallback(hitObject, _isPiloted && _pilotedCraft.isHostile(hitObject));
            hitPositionVectorInObjectSpace = physicalHitObject.checkHit(_positionMatrix, _velocityMatrix, _hitCheckDT, offset);
            if (hitPositionVectorInObjectSpace) {
                vec.setDiffTranslation3(_relativeVelocityDirectionInWorldSpace, _velocityMatrix, physicalHitObject.getVelocityMatrix());
                relativeVelocity = vec.extractLength3(_relativeVelocityDirectionInWorldSpace);
                relativeVelocityDirectionInObjectSpace = vec.prodMat4Vec3Aux(hitObject.getVisualModel().getOrientationMatrix(), _relativeVelocityDirectionInWorldSpace);
                hitPositionVectorInWorldSpace = vec.prodVec4Mat4Aux(hitPositionVectorInObjectSpace, hitObject.getVisualModel().getModelMatrix());
                relativeHitPositionVectorInWorldSpace = vec.diffVec3Mat4Aux(hitPositionVectorInWorldSpace, physicalHitObject.getPositionMatrix());
                _hitCallback(hitObject, physicalHitObject, hitPositionVectorInObjectSpace, hitPositionVectorInWorldSpace, relativeHitPositionVectorInWorldSpace, relativeVelocityDirectionInObjectSpace, _relativeVelocityDirectionInWorldSpace, relativeVelocity, offset);
                return true;
            }
        }
        return false;
    }
    /**
     * @callback HitCallback
     * @param {Spacecraft} hitObject 
     * @param {PhysicalObject} physicalHitObject 
     * @param {Number[4]} hitPositionVectorInObjectSpace 
     * @param {Number[4]} hitPositionVectorInWorldSpace 
     * @param {Number[3]} relativeHitPositionVectorInWorldSpace
     * @param {Number[3]} relativeVelocityDirectionInObjectSpace
     * @param {Number[3]} relativeVelocityDirectionInWorldSpace
     * @param {Number} relativeVelocity
     * @param {Number} offset
     */
    /**
     * The common code to use for both projectile and missile hitchecks.
     * @param {Float32Array} positionMatrix The position matrix of the object (i.e. projectile or missile) that can hit the others
     * @param {Float32Array} velocityMatrix The velocity matrix of the object (i.e. projectile or missile) that can hit the others
     * @param {Octree} hitObjectOctree The octree containing the objects that our projectile/missile can hit
     * @param {Number} hitCheckDT The elapsed time to consider for the hit check (since last hitcheck, in ms)
     * @param {Spacecraft} origin The spacecraft that fired our projectile / missile (for self hit checks)
     * @param {Spacecraft} [pilotedCraft] The spacecraft the player pilots in the current mission
     * @param {Function} offsetCallback The function to return the offset to be used for the hitchecks (modifying
     * the hitbox sizes so that e.g. missiles can already hit the object from farther away)
     * @param {HitCallback} hitCallback The function to call if an object is hit, passing the parameters of the hit to it
     */
    function _checkHit(positionMatrix, velocityMatrix, hitObjectOctree, hitCheckDT, origin, pilotedCraft, offsetCallback, hitCallback) {
        // we pass the _checkHitForObject as the callback to the octree, so we set up the module variables it uses to describe
        // the parameters of the hit check (to avoid creating new functions by binding for every hit check)
        _positionMatrix = positionMatrix;
        _velocityMatrix = velocityMatrix;
        _hitCheckDT = hitCheckDT;
        _origin = origin;
        _pilotedCraft = pilotedCraft;
        _offsetCallback = offsetCallback;
        _hitCallback = hitCallback;
        _isPiloted = (origin === pilotedCraft);
        _canDamageSelf = _isSelfFireEnabled && (_isPlayerSelfDamageEnabled || !_isPiloted);
        _canDamagePlayer = _isPlayerFriendlyFireDamageEnabled || !pilotedCraft || pilotedCraft.isHostile(origin);
        hitObjectOctree.executeForObjects(
                Math.min(positionMatrix[12], positionMatrix[12] - velocityMatrix[12] * hitCheckDT * 0.001),
                Math.max(positionMatrix[12], positionMatrix[12] - velocityMatrix[12] * hitCheckDT * 0.001),
                Math.min(positionMatrix[13], positionMatrix[13] - velocityMatrix[13] * hitCheckDT * 0.001),
                Math.max(positionMatrix[13], positionMatrix[13] - velocityMatrix[13] * hitCheckDT * 0.001),
                Math.min(positionMatrix[14], positionMatrix[14] - velocityMatrix[14] * hitCheckDT * 0.001),
                Math.max(positionMatrix[14], positionMatrix[14] - velocityMatrix[14] * hitCheckDT * 0.001),
                _checkHitForObject);
    }
    // ##############################################################################
    /**
     * @class Represents a projectile fired from a weapon.
     * @param {ProjectileClass} projectileClass The class of the projectile defining its general properties.
     * @param {Spacecraft} [spacecraft] The spacecraft which fired the projectile.
     */
    function Projectile(projectileClass, spacecraft) {
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
         * The translation component of this matrix holds the velocity of the projectile.
         * @type Float32Array
         */
        this._velocityMatrix = mat.identity4();
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
        /**
         * A reference to the light source associated with this projectile.
         * @type PointLightSource
         */
        this._lightSource = null;
        /**
         * The callback function to use when the projectile hits a spacecraft, bound to this instance
         * @type HitCallback
         */
        this._hitCallback = Projectile.prototype._hitCallback.bind(this);
        if (projectileClass) {
            this.init(projectileClass, spacecraft);
        }
    }
    /**
     * @param {ProjectileClass} projectileClass The class of the projectile defining its general properties.
     * @param {Spacecraft} [spacecraft] The spacecraft which fired the projectile.
     */
    Projectile.prototype.init = function (projectileClass, spacecraft) {
        this._class = projectileClass;
        this._timeLeft = projectileClass.getDuration();
        this._origin = spacecraft;
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
     * @param {Float32Array} [positionMatrix] The transformation matrix describing the initial position of the projectile.
     * @param {Float32Array} [orientationMatrix] The transformation matrix describing the initial oriantation of the projectile.
     * @param {Number} [muzzleVelocity] The starting velocity of the projectile, in its +Y direction, in m/s
     */
    Projectile.prototype._initVisualModel = function (wireframe, positionMatrix, orientationMatrix, muzzleVelocity) {
        if (!this._visualModel) {
            this.createVisualModel();
        }
        mat.setIdentity4(this._velocityMatrix);
        if (this._origin) {
            mat.copyTranslation4(this._velocityMatrix, this._origin.getPhysicalVelocityMatrix());
        }
        if (muzzleVelocity) {
            this._velocityMatrix[12] += orientationMatrix[4] * muzzleVelocity;
            this._velocityMatrix[13] += orientationMatrix[5] * muzzleVelocity;
            this._velocityMatrix[14] += orientationMatrix[6] * muzzleVelocity;
        }
        this._visualModel.init(
                this._class.getModel(),
                this._class.getShader(),
                this._class.getTexturesOfTypes(this._class.getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                this._class.getSize(),
                wireframe,
                positionMatrix || mat.IDENTITY4,
                orientationMatrix || mat.IDENTITY4,
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
     * Sets the associated light source for this projectile, so its intensity can be updated as the projectile dissipates (fades)
     * @param {PointLightSource} lightSource
     */
    Projectile.prototype.setLightSource = function (lightSource) {
        this._lightSource = lightSource;
    };
    /**
     * Adds the projectile to a scene immediately, assuming its resources have already been loaded.
     * @param {Scene} scene The scene to which to add the renderable object presenting the projectile.
     * @param {Boolean} [wireframe=false] Whether to add the model for wireframe rendering
     * @param {Float32Array} [positionMatrix] The transformation matrix describing the initial position of the projectile.
     * @param {Float32Array} [orientationMatrix] The transformation matrix describing the initial oriantation of the projectile.
     * @param {Number} [muzzleVelocity] The starting velocity of the projectile, in its +Y direction, in m/s
     * @param {Function} [callback] If given, this function will be executed right after the projectile is addded to the scene, with the 
     * visual model of the projectile passed to it as its only argument
     */
    Projectile.prototype.addToSceneNow = function (scene, wireframe, positionMatrix, orientationMatrix, muzzleVelocity, callback) {
        this._initVisualModel(wireframe, positionMatrix, orientationMatrix, muzzleVelocity);
        scene.addObject(this._visualModel, false, true);
        if (callback) {
            callback(this._visualModel);
        }
    };
    /**
     * Adds a renderable node representing this projectile to the passed scene.
     * @param {Scene} scene The scene to which to add the renderable object presenting the projectile.
     * @param {Boolean} [wireframe=false] Whether to add the model for wireframe rendering
     * @param {Float32Array} [positionMatrix] The transformation matrix describing the initial position of the projectile.
     * @param {Float32Array} [orientationMatrix] The transformation matrix describing the initial oriantation of the projectile.
     * @param {Number} [muzzleVelocity] The starting velocity of the projectile, in its +Y direction, in m/s
     * @param {Function} [callback] If given, this function will be executed right after the projectile is addded to the scene, with the 
     * visual model of the projectile passed to it as its only argument
     */
    Projectile.prototype.addToScene = function (scene, wireframe, positionMatrix, orientationMatrix, muzzleVelocity, callback) {
        resources.executeWhenReady(this.addToSceneNow.bind(this, scene, wireframe, positionMatrix, orientationMatrix, muzzleVelocity, callback));
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
        this._class.acquireResources({projectileOnly: false, sound: true});
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
     * The function to call when the projectile hits a spacecraft
     * @param {Spacecraft} hitObject 
     * @param {PhysicalObject} physicalHitObject 
     * @param {Number[4]} hitPositionVectorInObjectSpace 
     * @param {Number[4]} hitPositionVectorInWorldSpace 
     * @param {Number[3]} relativeHitPositionVectorInWorldSpace
     * @param {Number[3]} relativeVelocityDirectionInObjectSpace
     * @param {Number[3]} relativeVelocityDirectionInWorldSpace
     * @param {Number} relativeVelocity
     * @param {Number} offset
     */
    Projectile.prototype._hitCallback = function (hitObject, physicalHitObject, hitPositionVectorInObjectSpace, hitPositionVectorInWorldSpace, relativeHitPositionVectorInWorldSpace, relativeVelocityDirectionInObjectSpace, relativeVelocityDirectionInWorldSpace, relativeVelocity, offset) {
        var exp, power;
        power = Math.min(this._timeLeft / this._class.getDissipationDuration(), 1);
        physicalHitObject.applyForceAndTorque(relativeHitPositionVectorInWorldSpace, relativeVelocityDirectionInWorldSpace, power * relativeVelocity * this._class.getMass() * 1000, 1, 1);
        exp = explosion.getExplosion();
        exp.init(((hitObject.getShieldIntegrity() > 0) ? this._class.getShieldExplosionClass() : this._class.getExplosionClass()), mat.translation4vAux(hitPositionVectorInWorldSpace), mat.IDENTITY4, vec.scaled3Aux(relativeVelocityDirectionInWorldSpace, -1), true, true, physicalHitObject.getVelocityMatrix());
        exp.addToSceneNow(this._visualModel.getNode().getScene().getRootNode(), hitObject.getSoundSource(), true);
        hitObject.damage(power * this._class.getDamage(), hitPositionVectorInObjectSpace, vec.scaled3(relativeVelocityDirectionInObjectSpace, -1), this._origin, false, offset);
        this._timeLeft = 0;
        this._visualModel.markAsReusable(true);
    };
    /**
     * Simulates the movement of the projectile and checks if it hit any objects.
     * @param {Number} dt The passed time since the last simulation in milliseconds.
     * @param {Octree} hitObjectOctree The root node of the octree that is used to spatially partition the spacecrafts this projectile can
     * hit.
     * @param {Spacecraft} [pilotedCraft] The spacecraft the player pilots in the current mission
     */
    Projectile.prototype.simulate = function (dt, hitObjectOctree, pilotedCraft) {
        var hitCheckDT, power;
        if (this.canBeReused()) {
            return;
        }
        // avoid hit checking right after the projectile is fired, as it could hit the firing ship
        hitCheckDT = Math.min(dt, this._class.getDuration() - this._timeLeft);
        this._timeLeft -= dt;
        if (this._timeLeft > 0) {
            if ((physics.getDrag() > 0) && (this._class.getDragFactor() > 0)) {
                physics.applyDrag(this._velocityMatrix, dt, this._class.getDragFactor());
            }
            this._visualModel.translateByMatrixMul(this._velocityMatrix, dt * 0.001);
            if (this._timeLeft < this._class.getDissipationDuration()) {
                power = this._timeLeft / this._class.getDissipationDuration();
                this._visualModel.setDirectionW(power);
                if (this._lightSource) {
                    this._lightSource.setObjectIntensity(power * this._class.getLightIntensity());
                }
            }
            _checkHit(this._visualModel.getPositionMatrix(), this._velocityMatrix, hitObjectOctree, hitCheckDT, this._origin, pilotedCraft, _getDefaultOffset, this._hitCallback);
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
        this._velocityMatrix = null;
    };
    // ##############################################################################
    /**
     * @class Creates the trail that the missile leaves behind as it moves.
     * @param {TrailDescriptor} descriptor The descriptor storing the trail's
     * general properties.
     */
    function TrailEmitter(descriptor) {
        /**
         * The descriptor storing the general characteristics of this trail.
         * @type TrailDescriptor
         */
        this._descriptor = descriptor;
        /**
         * The world position of where this trail starts (first point emitted)
         * @type Number[3]
         */
        this._firstPoint = [0, 0, 0];
        /**
         * The last point where the trail was emitted (world coordinates)
         * @type Number[3]
         */
        this._lastPoint = [0, 0, 0];
        /**
         * Whether there is a trail currently being emitted
         * @type Boolean
         */
        this._emitting = false;
        /**
         * The last trail segment that was emitted
         * @type TrailSegment
         */
        this._lastSegment = null;
        /**
         * The renderable object that houses the current active section of the
         * trail (has its segments as its children)
         * @type Trail
         */
        this._visualModel = null;
        /**
         * The last scene where a trail was/is emitted by this emitter
         * @type Scene
         */
        this._lastScene = null;
    }
    /**
     * @returns {TrailDescriptor}
     */
    TrailEmitter.prototype.getDescriptor = function () {
        return this._descriptor;
    };
    /**
     * Whether there is a currently active / growing section of this trail to
     * which new points / segments can be added.
     * @returns {Boolean}
     */
    TrailEmitter.prototype.isEmitting = function () {
        return this._emitting;
    };
    /**
     * Call this before loading resources to make sure the trail can be rendered
     * onto this scene.
     * @param {Scene} scene
     */
    TrailEmitter.prototype.addResourcesToScene = function (scene) {
        this._descriptor.acquireResources();
        resources.executeWhenReady(function () {
            scene.addResourcesOfObject(new renderableObjects.TrailSegment(
                    this._descriptor.getModel(),
                    this._descriptor.getShader(),
                    this._descriptor.getTexturesOfTypes(this._descriptor.getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                    this._descriptor.getSize(),
                    false,
                    vec.NULL3,
                    vec.NULL3,
                    vec.NULL3,
                    vec.NULL3,
                    vec.NULL4,
                    0, 0, 0,
                    this._descriptor.getInstancedShader()));
        }.bind(this));
    };
    /**
     * Start a new active section for the trail (abandoning the current one if
     * there was already one), with a new parent node
     * @param {Scene} scene
     * @param {Number[3]} point The world coordinates of where this trail starts.
     * When calling addPoint() the first time after this call, the first segment
     * will connect this point with the one passed there
     */
    TrailEmitter.prototype.startNew = function (scene, point) {
        vec.setVector3(this._firstPoint, point);
        vec.setVector3(this._lastPoint, point);
        this._emitting = true;
        this._lastSegment = null;
        this._visualModel = new renderableObjects.Trail(this._descriptor.getSize());
        scene.addNode(new sceneGraph.RenderableNode(this._visualModel, false, true));
        if (this._lastScene !== scene) {
            scene.addObjectToMove(this);
            this._lastScene = scene;
        }
    };
    /**
     * Adds a new 3D point to the currently emitted section of the trail (there
     * needs to be one when calling this method), growing the section with a
     * new segment if needed.
     * @param {Number[3]} point The point to add.
     * @param {Number} dt The time elapsed since the last simulation step. This
     * is used when growing a new section to its maximum duration, to make sure
     * that process stays consistent across framerates
     */
    TrailEmitter.prototype.addPoint = function (point, dt) {
        var segment, prevTime, direction;
        this._visualModel.setPositionv(point);
        direction = vec.normalize3(vec.diff3Aux(point, this._lastPoint));
        prevTime = this._lastSegment ? this._lastSegment.getEndTimeLeft() : 0;
        segment = _trailSegmentPool.getObject();
        segment.init(
                this._descriptor.getModel(),
                this._descriptor.getShader(),
                this._descriptor.getTexturesOfTypes(this._descriptor.getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                this._descriptor.getSize(),
                false,
                this._lastPoint,
                this._lastSegment ? this._lastSegment.getEndDirection() : direction,
                point,
                direction,
                this._descriptor.getColor(),
                this._descriptor.getDuration(),
                prevTime,
                Math.min(this._descriptor.getDuration(), prevTime + this._descriptor.getGrowthRate() * dt),
                this._descriptor.getInstancedShader());
        this._visualModel.getNode().addSubnode(segment.getNode() || new sceneGraph.RenderableNode(segment, false, false, true));
        this._visualModel.setSize(vec.length3(vec.diff3Aux(this._firstPoint, point)));
        vec.setVector3(this._lastPoint, point);
        this._lastSegment = segment;
    };
    /**
     * Call this when the whole scene is moved, to make sure the next trail
     * segment is emitted at the right position
     * @param {Number[3]} v [x,y,z]
     */
    TrailEmitter.prototype.translatev = function (v) {
        vec.add3(this._lastPoint, v);
    };
    /**
     * Finishes the current emitted section fo the trail by removing
     * any references to it. No new points can be added to it after this point,
     * it simply expires through the default animation of the segments.
     */
    TrailEmitter.prototype.detach = function () {
        this._emitting = false;
        this._lastSegment = null;
        this._visualModel = null;
    };
    /**
     * Removes all references to other objects for proper cleanup of memory.
     * Segments already emitted by this emitter are not affected.
     */
    TrailEmitter.prototype.destroy = function () {
        this._descriptor = null;
        this._emitting = false;
        this._firstPoint = null;
        this._lastPoint = null;
        this._lastSegment = null;
        if (this._visualModel) {
            this._visualModel.getNode().markAsReusable(true);
            this._visualModel = null;
        }
    };
    // ##############################################################################
    /**
     * @class Represents a missile launched from a missile launcher.
     * @param {MissileClass} missileClass The class of the missile defining its general properties.
     * @param {Float32Array} [positionMatrix] The transformation matrix describing the initial position of the missile.
     * @param {Float32Array} [orientationMatrix] The transformation matrix describing the initial oriantation of the missile.
     * @param {Spacecraft} [spacecraft] The spacecraft which launched the missile.
     * @param {Number} [muzzleVelocity] The starting velocity of the missile, in its +Y direction, in m/s
     * @param {Spacecraft} [target] 
     */
    function Missile(missileClass, positionMatrix, orientationMatrix, spacecraft, muzzleVelocity, target) {
        /**
         * The class storing the general characteristics of this missile.
         * @type MissileClass
         */
        this._class = null;
        /**
         * The renderable node that represents this missile in a scene.
         * @type RenderableObject
         */
        this._visualModel = null;
        /**
         * Used to emit the trail a launched missile leaves behind when using its engine.
         * @type TrailEmitter
         */
        this._trailEmitter = null;
        /**
         * The object that represents and simulates the physical behaviour of
         * this missile.
         * @type PhysicalObject
         */
        this._physicalModel = new physics.PhysicalObject();
        /**
         * The amount of time this missile has before it explodes (even if not
         * hitting anything), in milliseconds.
         * @type Number
         */
        this._timeLeft = 0;
        /**
         * The spacecraft that originally launched this missile. If self fire is
         * off, it will be excluded from hit check so that a missile cannot hit 
         * the same craft it was launched from.
         * @type Spacecraft
         */
        this._origin = null;
        /**
         * Cached value of the matrix representing the turning the current angular velocity of the object causes over 
         * ANGULAR_VELOCITY_MATRIX_DURATION milliseconds in model space.
         * @type Float32Array
         */
        this._turningMatrix = mat.identity4();
        /**
         * Whether the currently stored turning matrix value is up-to-date.
         * @type Boolean
         */
        this._turningMatrixValid = false;
        /**
         * The target angle in radian between the identity orientation and the
         * relative angular velocity matrix on the yawing (XY) plane. The missile
         * will use the yawing thursters to reach this angle.
         * (representing rad / physics.ANGULAR_VELOCITY_MATRIX_DURATION ms turn)
         * @type Number
         */
        this._yawTarget = 0;
        /**
         * The target angle in radian between the identity orientation and the
         * relative angular velocity matrix on the pitching (YZ) plane. The missile
         * will use the pitching thursters to reach this angle.
         * (representing rad / physics.ANGULAR_VELOCITY_MATRIX_DURATION ms turn)
         * @type Number
         */
        this._pitchTarget = 0;
        /**
         * The maximum angle between vectors of the relative angular acceleration 
         * matrix and the identity axes on the yaw and pitch planes
         * (representing rad / physics.ANGULAR_VELOCITY_MATRIX_DURATION ms turn)
         * This is the general limit based on the missile's class (angular acceleration)
         * I.e. the missile will accelerate it's turning up to this rate and then 
         * decelerate from it when close to the target direction.
         * @type Number
         */
        this._turningLimit = 0;
        /**
         * An array storing direct references to all the thrusters of the missile.
         * @type Thruster[]
         */
        this._thrusters = [];
        /**
         * The burn level and nozzles associated with each thruster use command.
         * @type Object
         */
        this._forward = {burn: 0, thrusters: []};
        this._yawLeft = {burn: 0, thrusters: []};
        this._yawRight = {burn: 0, thrusters: []};
        this._pitchUp = {burn: 0, thrusters: []};
        this._pitchDown = {burn: 0, thrusters: []};
        /**
         * Cached value to enable faster calculation of the needed burn for 
         * specific angular velocity change, based on the missile's parameters.
         * @type Number
         */
        this._burnForAngularVelocityChangeFactor = 0;
        /**
         * Whether the main engine (forward thruster) is currently turned on.
         * (this thruster always operates at 100% burn when turned on)
         * The main thruster gets turned off if the missile is homing and the
         * target gets outside of its course too much, until the course is
         * corrected via the maneuvering thrusters.
         * @type Boolean
         */
        this._mainBurn = false;
        /**
         * Whether the missile has already ignited its engines (after its ignitionTime)
         * Once this is set to true, it remains true for the rest of the missile's lifetime.
         * @type Boolean
         */
        this._started = false;
        /**
         * Whether the missile is currently using its maneuvering thrusters to home in on the target
         * @type Boolean
         */
        this._homing = false;
        /**
         * Whether the missile is currently finishing its homing maneuver (only using maneuvering
         * thrusters to cancel any spin)
         * @type Boolean
         */
        this._stopHoming = false;
        /**
         * The target the missile is aiming for (for homing)
         * @type Spacecraft
         */
        this._target = null;
        /**
         * The estimated (calculated) position where the missile will (can) hit its target
         * (and thus which it should turn towards) based on the target's current
         * relative position and velocity and the acceleration capability of the missile.
         * @type Number[3]
         */
        this._targetHitPosition = [0, 0, 0];
        /**
         * Whether the stored target hit position has been updated for the current frame.
         * @type Boolean
         */
        this._targetHitPositionValid = false;
        /**
         * The light source associated with the missile (representing light from its main
         * thruster, with its intensity set according to whether the thruster is on)
         * @type PointLightSource
         */
        this._lightSource = null;
        /**
         * The sound source used to position the sound effects belonging to this missile in 3D sound (=camera) space
         * @type SoundSource
         */
        this._soundSource = audio.createSoundSource(0, 0, 0);
        /**
         * A reference to the sound clip playing the start sound for this missile so it can be stopped if needed
         * @type SoundClip
         */
        this._startSound = null;
        /**
         * The callback function to execute when the missile hits a spacecraft.
         * (bound to this in the constructor so it can be readily passed to _checkHit)
         * @tpye HitCallback
         */
        this._hitCallback = Missile.prototype._hitCallback.bind(this);
        /**
         * The callback to get the offset to be used for hit checks for this missile
         * (the sides of the hitboxes are offset towards the outside (i.e. the hitbox 
         * is enlarged in all directions) by this much, in meters)
         * (bound to this in the constructor so it can be readily passed to _checkHit)
         * @type Function
         */
        this._getHitOffset = Missile.prototype._getHitOffset.bind(this);
        if (missileClass) {
            this.init(missileClass, positionMatrix, orientationMatrix, spacecraft, muzzleVelocity, target);
        }
    }
    /**
     * We reuse the same Missile instance for multiple missiles in a single games, as old missiles are
     * destroyed. This method is called to reinitialize this Missile instance for a new missile.
     * @param {MissileClass} missileClass The class of the missile defining its general properties.
     * @param {Float32Array} [positionMatrix] The transformation matrix describing the initial position of the missile.
     * @param {Float32Array} [orientationMatrix] The transformation matrix describing the initial oriantation of the missile.
     * @param {Spacecraft} [spacecraft] The spacecraft which launched the missile.
     * @param {Number} [muzzleVelocity] The starting velocity of the missile, in its +Y direction, in m/s
     * @param {Spacecraft} [target] 
     */
    Missile.prototype.init = function (missileClass, positionMatrix, orientationMatrix, spacecraft, muzzleVelocity, target) {
        var i, velocityMatrix = mat.identity4Aux();
        if (spacecraft) {
            mat.copyTranslation4(velocityMatrix, spacecraft.getPhysicalVelocityMatrix());
        }
        if (muzzleVelocity) {
            velocityMatrix[12] += orientationMatrix[4] * muzzleVelocity;
            velocityMatrix[13] += orientationMatrix[5] * muzzleVelocity;
            velocityMatrix[14] += orientationMatrix[6] * muzzleVelocity;
        }
        this._class = missileClass;
        this._physicalModel.init(
                missileClass.getMass(),
                positionMatrix || mat.IDENTITY4,
                orientationMatrix || mat.IDENTITY4,
                mat.scaling4Aux(missileClass.getModelScale()),
                velocityMatrix,
                utils.EMPTY_ARRAY,
                missileClass.getDragFactor());
        this._timeLeft = missileClass.getDuration();
        this._timeLeftForIgnition = missileClass.getIgnitionTime();
        this._origin = spacecraft;
        this._turningLimit = missileClass.getAngularAcceleration() * MISSILE_TURN_ACCELERATION_DURATION_S * physics.ANGULAR_VELOCITY_MATRIX_DURATION_S;
        for (i = 0; i < this._thrusters.length; i++) {
            this._thrusters[i].destroy();
        }
        this._thrusters.length = 0;
        this._forward.thrusters.length = 0;
        this._yawLeft.thrusters.length = 0;
        this._yawRight.thrusters.length = 0;
        this._pitchUp.thrusters.length = 0;
        this._pitchDown.thrusters.length = 0;
        this.addThrusters(missileClass.getThrusterSlots());
        this._homing = (missileClass.getHomingMode() !== classes.MissileHomingMode.NONE);
        this._burnForAngularVelocityChangeFactor = this._homing ? (1 / physics.ANGULAR_VELOCITY_MATRIX_DURATION_S * missileClass.getMass() / missileClass.getAngularThrust() * 1000) : 0;
        this._target = target || null;
        this._targetHitPositionValid = false;
        this._mainBurn = false;
        this._started = false;
        this._stopHoming = false;
        this._startSound = null;
    };
    /**
     * Returns whether this missile object can be reused to represent a new
     * missile.
     * @returns {Boolean}
     */
    Missile.prototype.canBeReused = function () {
        return (this._timeLeft <= 0);
    };
    /**
     * Creates a new ParameterizedMesh to be used as the visual model for this missile. 
     * Safe to be called on Missile objects that have not been set up yet, so 
     * that the visual model objects can be created in advance.
     */
    Missile.prototype.createVisualModel = function () {
        this._visualModel = new renderableObjects.ParameterizedMesh();
    };
    /**
     * Sets up the renderable object that can be used to represent this missile in a visual scene.
     * @param {Boolean} [wireframe=false] Whether to set up the model in wireframe mode
     * @param {Number} [lod] Optional static LOD to use instead of automatic dynamic one
     * @param {String} [shaderName] Optional shader to use for the visual model instead of the one provided by the missile class
     * @param {Boolean} [trail=false] Whether to also initialize the trail for the missile
     */
    Missile.prototype._initVisualModel = function (wireframe, lod, shaderName, trail) {
        var shader = shaderName ? graphics.getManagedShader(shaderName) : this._class.getShader();
        if (!this._visualModel) {
            this.createVisualModel();
        }
        this._visualModel.init(
                this._class.getModel(),
                shader,
                this._class.getTexturesOfTypes(shader.getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                this._physicalModel.getPositionMatrix(),
                this._physicalModel.getOrientationMatrix(),
                this._physicalModel.getScalingMatrix(),
                wireframe,
                lod,
                undefined,
                _parameterArrays);
        // setting the starting values of the parameter arrays
        // setting an identity transformation for all transform groups
        if (this._visualModel.hasParameterArray(_groupTransformsArrayName)) {
            this._visualModel.setParameterArray(_groupTransformsArrayName, graphics.getGroupTransformIdentityArray());
        }
        // setting the default luminosity for all luminosity groups
        if (graphics.areLuminosityTexturesAvailable() && this._visualModel.hasParameterArray(_luminosityFactorsArrayName)) {
            this._visualModel.setParameterArray(_luminosityFactorsArrayName, this._class.getDefaultGroupLuminosityFactors());
        }
        if (trail) {
            this._trailEmitter = new TrailEmitter(this._class.getTrailDescriptor());
        }
    };
    /**
     * Returns the visual model of the missile.
     * @returns {ParameterizedMesh}
     */
    Missile.prototype.getVisualModel = function () {
        return this._visualModel;
    };
    /**
     * Returns the physical model of the missile.
     * @returns {PhysicalObject}
     */
    Missile.prototype.getPhysicalModel = function () {
        return this._physicalModel;
    };
    /**
     * Returns the target the missile is homing in on
     * @returns {Spacecraft}
     */
    Missile.prototype.getTarget = function () {
        return this._target;
    };
    /**
     * Returns the class of the missile
     * @returns {MissileClass}
     */
    Missile.prototype.getClass = function () {
        return this._class;
    };
    /**
     * Adds the missile to a scene immediately, assuming its resources have already been loaded.
     * @param {Scene} scene The scene to which to add the renderable object presenting the missile.
     * @param {Boolean} [wireframe=false] Whether to add the model for wireframe rendering
     * @param {Number} [lod] Optional static LOD to use instead of automatic dynamic one
     * @param {String} [shaderName] Optional shader to use for the visual model instead of the one provided by the missile class
     * @param {Boolean} [trail=false] Whether to add a trail for the missile
     * @param {Function} [callback] If given, this function will be executed right after the missile is addded to the scene, with the 
     * visual model of the missile passed to it as its only argument
     */
    Missile.prototype.addToSceneNow = function (scene, wireframe, lod, shaderName, trail, callback) {
        var i;
        this._initVisualModel(wireframe, lod, shaderName, trail);
        scene.addObject(this._visualModel, true);
        for (i = 0; i < this._thrusters.length; i++) {
            this._thrusters[i].addToScene(this._visualModel.getNode(), true);
        }
        if (_dynamicLights && this._class.getLightColor()) {
            if (!this._lightSource) {
                this._lightSource = new lights.PointLightSource(this._class.getLightColor(), 0, vec.NULL3, [this._visualModel]);
            }
            scene.addPointLightSource(this._lightSource, constants.MISSILE_LIGHT_PRIORITY);
        }
        if (callback) {
            callback(this._visualModel);
        }
    };
    /**
     * Adds a renderable node representing this missile to the passed scene.
     * @param {Scene} scene The scene to which to add the renderable object presenting the missile.
     * @param {Boolean} [wireframe=false] Whether to add the model for wireframe rendering
     * @param {Number} [lod] Optional static LOD to use instead of automatic dynamic one
     * @param {String} [shaderName] Optional shader to use for the visual model instead of the one provided by the missile class
     * @param {Boolean} [trail=false] Whether to add a trail for the missile
     * @param {Function} [callback] If given, this function will be executed right after the missile is addded to the scene, with the 
     * visual model of the missile passed to it as its only argument
     */
    Missile.prototype.addToScene = function (scene, wireframe, lod, shaderName, trail, callback) {
        resources.executeWhenReady(this.addToSceneNow.bind(this, scene, wireframe, lod, shaderName, trail, callback));
    };
    /**
     * Adds the resources required to render this missile to the passed scene,
     * so they get loaded at the next resource load as well as added to any context
     * the scene is added to.
     * @param {Scene} scene
     * @param {Boolean} [wireframe=false] Whether to add the model resource for wireframe rendering
     * @param {Number} [lod] Optional static LOD to use instead of automatic dynamic one
     * @param {String} [shaderName] Optional shader to use for the visual model instead of the one provided by the missile class
     * @param {Boolean} [trail=false] Whether to add the resources for rendering the trail for the missile
     */
    Missile.prototype.addResourcesToScene = function (scene, wireframe, lod, shaderName, trail) {
        var exp, resourceID = MISSILE_RESOURCE_ID_PREFIX + this._class.getName();
        this._class.acquireResources({missileOnly: false, sound: true, trail: trail});
        resources.executeWhenReady(function () {
            if (!scene.hasResourcesOfObject(resourceID)) {
                this._initVisualModel(wireframe, lod, shaderName, trail);
                scene.addResourcesOfObject(this._visualModel, resourceID);
                if (trail) {
                    this._trailEmitter.addResourcesToScene(scene);
                }
                exp = new explosion.Explosion(this._class.getExplosionClass(), mat.IDENTITY4, mat.IDENTITY4, [0, 0, 0], true);
                exp.addResourcesToScene(scene);
                exp = new explosion.Explosion(this._class.getShieldExplosionClass(), mat.IDENTITY4, mat.IDENTITY4, [0, 0, 0], true);
                exp.addResourcesToScene(scene);
            }
        }.bind(this));
    };
    /**
     * Returns the object storing the burn level and thruster list associated
     * with the passed thruster use command
     * @param {String} name
     * @returns {Object}
     */
    Missile.prototype.getThrusterUse = function (name) {
        switch (name) {
            case ThrusterUse.FORWARD:
                return this._forward;
            case ThrusterUse.YAW_LEFT:
                return this._yawLeft;
            case ThrusterUse.YAW_RIGHT:
                return this._yawRight;
            case ThrusterUse.PITCH_UP:
                return this._pitchUp;
            case ThrusterUse.PITCH_DOWN:
                return this._pitchDown;
            default:
                application.showError("Invalid thruster use specified for missile: '" + name + "'!", application.ErrorSeverity.SEVERE);
                return null;
        }
    };
    /**
     * Creates and adds thruster objects to all the thruster slots in the passed
     * array
     * @param {ThrusterSlot[]} slots
     */
    Missile.prototype.addThrusters = function (slots) {
        var i, j, thruster, use;
        for (i = 0; i < slots.length; i++) {
            thruster = new Thruster(this._class.getPropulsionClass(), slots[i]); //eslint-disable-line no-use-before-define
            this._thrusters.push(thruster);
            for (j = 0; j < slots[i].uses.length; j++) {
                use = this.getThrusterUse(slots[i].uses[j]);
                if (use) {
                    use.thrusters.push(thruster);
                }
            }
        }
    };
    /**
     * Returns the 4x4 rotation matrix describing the current rotation of this missile in relative (model) space.
     * @returns {Float32Array}
     */
    Missile.prototype.getTurningMatrix = function () {
        if (!this._turningMatrixValid) {
            mat.updateProdRotationRotationInverse4(this._turningMatrix,
                    mat.prod3x3SubOf4Aux(
                            this._physicalModel.getOrientationMatrix(),
                            this._physicalModel.getVelocityMatrix()),
                    this._physicalModel.getOrientationMatrix());
            this._turningMatrixValid = true;
        }
        return this._turningMatrix;
    };
    /**
     * Sets the target angular velocity to yaw to the left with the given intensity 
     * multiplied by the turning limit.
     * @param {Number} intensity
     */
    Missile.prototype.yawLeft = function (intensity) {
        this._yawTarget = -intensity * this._turningLimit;
    };
    /**
     * Sets the target angular velocity to yaw to the right with the given intensity 
     * multiplied by the turning limit.
     * @param {Number} intensity
     */
    Missile.prototype.yawRight = function (intensity) {
        this._yawTarget = intensity * this._turningLimit;
    };
    /**
     * Sets the target angular velocity to pitch down with the given intensity 
     * multiplied by the turning limit.
     * @param {Number} intensity
     */
    Missile.prototype.pitchDown = function (intensity) {
        this._pitchTarget = -intensity * this._turningLimit;
    };
    /**
     * Sets the target angular velocity to pitch up with the given intensity 
     * multiplied by the turning limit.
     * @param {Number} intensity
     */
    Missile.prototype.pitchUp = function (intensity) {
        this._pitchTarget = intensity * this._turningLimit;
    };
    /**
     * Resets the all the thruster burn levels to zero.
     */
    Missile.prototype.resetThrusterBurn = function () {
        var i;
        this._forward.burn = 0;
        this._yawLeft.burn = 0;
        this._yawRight.burn = 0;
        this._pitchUp.burn = 0;
        this._pitchDown.burn = 0;
        for (i = 0; i < this._thrusters.length; i++) {
            this._thrusters[i].resetBurn();
        }
    };
    Missile.prototype.addThrusterBurnForward = function (value) {
        _addThrusterBurn(this._forward, value);
    };
    Missile.prototype.addThrusterBurnYawLeft = function (value) {
        _addThrusterBurn(this._yawLeft, value);
    };
    Missile.prototype.addThrusterBurnYawRight = function (value) {
        _addThrusterBurn(this._yawRight, value);
    };
    Missile.prototype.addThrusterBurnPitchUp = function (value) {
        _addThrusterBurn(this._pitchUp, value);
    };
    Missile.prototype.addThrusterBurnPitchDown = function (value) {
        _addThrusterBurn(this._pitchDown, value);
    };
    /**
     * Returns the thruster burn level that is needed to produce the passed difference in angular velocity for the given duration.
     * @param {Number} angularVelocityDifference The angular velocity difference that needs to be produced, in rad / physics.ANGULAR_VELOCITY_MATRIX_DURATION ms !!.
     * @param {Number} duration The length of time during which the difference needs to be produced, in milliseconds
     * @returns {Number}
     */
    Missile.prototype.getNeededBurnForAngularVelocityChange = function (angularVelocityDifference, duration) {
        return angularVelocityDifference * this._burnForAngularVelocityChangeFactor / duration;
    };
    /**
     * Sets the appropriate thruster burn levels for the maneuvering thrusters of the missile 
     * based on the current targets (pitch and yaw)
     * @param {Number} dt The time elapsed since the last control step, in ms
     */
    Missile.prototype._controlTurnThrusters = function (dt) {
        var
                // grab flight parameters for turning control
                turningMatrix = this.getTurningMatrix(),
                turnThreshold = physics.ANGULAR_VELOCITY_MATRIX_ERROR_THRESHOLD,
                // for caching turn parameters (in rad / ANGULAR_VELOCITY_MATRIX_DURATION ms),
                yawAngle, pitchAngle, turnEnd;
        // controlling yaw
        yawAngle = Math.sign(turningMatrix[4]) * vec.angle2y(turningMatrix[4], turningMatrix[5]);
        if ((this._yawTarget - yawAngle) > turnThreshold) {
            this.addThrusterBurnYawRight(Math.min(1, this.getNeededBurnForAngularVelocityChange(this._yawTarget - yawAngle, dt)));
        } else if ((this._yawTarget - yawAngle) < -turnThreshold) {
            this.addThrusterBurnYawLeft(Math.min(1, this.getNeededBurnForAngularVelocityChange(yawAngle - this._yawTarget, dt)));
        } else {
            turnEnd = true;
        }
        // controlling pitch
        pitchAngle = Math.sign(turningMatrix[6]) * vec.angle2x(turningMatrix[5], turningMatrix[6]);
        if ((this._pitchTarget - pitchAngle) > turnThreshold) {
            this.addThrusterBurnPitchUp(Math.min(1, this.getNeededBurnForAngularVelocityChange(this._pitchTarget - pitchAngle, dt)));
        } else if ((this._pitchTarget - pitchAngle) < -turnThreshold) {
            this.addThrusterBurnPitchDown(Math.min(1, this.getNeededBurnForAngularVelocityChange(pitchAngle - this._pitchTarget, dt)));
        } else if (turnEnd && this._stopHoming) {
            this._homing = false;
        }
        // reset the targets, as they have been processed, the new targets will be set by the next control step
        this._yawTarget = 0;
        this._pitchTarget = 0;
    };
    /**
     * Apply the torques caused by the currently operating maneuvering thrusters to the physical
     * model of the missile
     * @param {Number} dt The time elapsed since the last simulation step, in milliseconds.
     */
    Missile.prototype._applyTurnThrust = function (dt) {
        var yawAxis, pitchAxis;
        yawAxis = mat.getRowC4(this._physicalModel.getOrientationMatrix());
        pitchAxis = mat.getRowA4(this._physicalModel.getOrientationMatrix());
        if (this._yawRight.burn > 0) {
            this._physicalModel.applyTorque(this._class.getAngularThrust() * this._yawRight.burn, yawAxis, dt);
        } else if (this._yawLeft.burn > 0) {
            this._physicalModel.applyTorque(-this._class.getAngularThrust() * this._yawLeft.burn, yawAxis, dt);
        }
        if (this._pitchUp.burn > 0) {
            this._physicalModel.applyTorque(-this._class.getAngularThrust() * this._pitchUp.burn, pitchAxis, dt);
        } else if (this._pitchDown.burn > 0) {
            this._physicalModel.applyTorque(this._class.getAngularThrust() * this._pitchDown.burn, pitchAxis, dt);
        }
    };
    /**
     * Calculate and return the expected (world) position where the missile can hit its current target, given
     * the target's relative position and velocity and the acceleration capabilities of the missile (assuming
     * it is constantly accelerating towards this point)
     * @returns {Number[3]}
     */
    Missile.prototype._getTargetHitPosition = function () {
        var
                targetPosition,
                relativeTargetVelocity,
                hitTime;
        if (!this._targetHitPositionValid) {
            targetPosition = this._target.getPhysicalPositionVector();
            relativeTargetVelocity = vec.diffTranslation3Aux(this._target.getPhysicalVelocityMatrix(), this._physicalModel.getVelocityMatrix());
            hitTime = this._class.getTargetHitTime(this._physicalModel.getPositionMatrix(), targetPosition, relativeTargetVelocity);
            this._targetHitPosition[0] = targetPosition[0] + hitTime * relativeTargetVelocity[0];
            this._targetHitPosition[1] = targetPosition[1] + hitTime * relativeTargetVelocity[1];
            this._targetHitPosition[2] = targetPosition[2] + hitTime * relativeTargetVelocity[2];
            this._targetHitPositionValid = true;
        }
        return this._targetHitPosition;
    };
    /**
     * Sets the yaw and pitch targets to turn the missile in the desired direction specified by the given two angles.
     * To be executed while the missile is actively homing.
     * @param {Number} yaw The yaw angle of the direction to turn towards, with a positive number meaning a direction to the left, in radians.
     * @param {Number} pitch The pitch angle of the direction to turn towards, with a positive number meaning a direction upwards, in radians.
     * @param {Number} dt The time passed since the last turn command in milliseconds - for an estimation of the time the set yaw and pitch 
     * angular velocity will be in effect, so that they can be limited to avoid overshooting the desired angles
     */
    Missile.prototype._turn = function (yaw, pitch, dt) {
        var turningMatrix, angularVelocity, angularAcceleration, turnStopAngle, turnIntensityFactor;
        turningMatrix = this.getTurningMatrix();
        angularAcceleration = this._class.getAngularAcceleration();
        // a turn intensity of 1 means to accelerate the angular velocity to TURN_ACCELERATION_DURATION_S * acceleration (in rad / sec) and
        // lower values represent a linear portion of this intended angular velocity
        // the base intensity factor converts dt to seconds and counts in TURN_ACCELERATION_DURATION_S
        // based on angle = angular velocity * time, we choose an angular velocity that will not overshoot the intended angle in the next dt
        // milliseconds (which will mean about the next simulation step with relatively stable framerates)
        turnIntensityFactor = MISSILE_TURN_INTENSITY_BASE_FACTOR / (angularAcceleration * dt);
        // calculating how much will the missile turn at the current angular velocity if it starts decelerating right now
        angularVelocity = Math.sign(turningMatrix[4]) * vec.angle2y(turningMatrix[4], turningMatrix[5]) * ANGULAR_VELOCITY_CONVERSION_FACTOR;
        turnStopAngle = Math.max(angularVelocity * angularVelocity / (2 * angularAcceleration), MISSILE_TURN_THRESHOLD_ANGLE);
        if (yaw > turnStopAngle) {
            this.yawLeft(Math.min(Math.max(0, turnIntensityFactor * (yaw - turnStopAngle)), 1));
        } else if (yaw < -turnStopAngle) {
            this.yawRight(Math.min(Math.max(0, turnIntensityFactor * (-yaw - turnStopAngle)), 1));
        }
        angularVelocity = Math.sign(turningMatrix[6]) * vec.angle2x(turningMatrix[5], turningMatrix[6]) * ANGULAR_VELOCITY_CONVERSION_FACTOR;
        turnStopAngle = Math.max(angularVelocity * angularVelocity / (2 * angularAcceleration), MISSILE_TURN_THRESHOLD_ANGLE);
        if (pitch > turnStopAngle) {
            this.pitchUp(Math.min(Math.max(0, turnIntensityFactor * (pitch - turnStopAngle)), 1));
        } else if (pitch < -turnStopAngle) {
            this.pitchDown(Math.min(Math.max(0, turnIntensityFactor * (-pitch - turnStopAngle)), 1));
        }
    };
    /**
     * Performs the destruction of the missile, complete with explosion
     * @param {ExplosionClass} explosionClass The class of the explosion to use
     * @param {Float32Array} positionMatrix The world position where the missile explodes
     * @param {Number[3]} direction The direction (unit) vector to use for the explosion (directional particle emitters)
     * @param {Float32Array} velocityMatrix The velocity matrix to use for the explosion
     * @param {SoundSource} soundSource The sound source to use for the explosion
     * @param {Boolean} isHit Whether the destruction was the result of the missile hitting a spacecraft
     */
    Missile.prototype._destruct = function (explosionClass, positionMatrix, direction, velocityMatrix, soundSource, isHit) {
        var exp;
        this._target = null;
        exp = explosion.getExplosion();
        exp.init(explosionClass, positionMatrix, mat.IDENTITY4, direction, true, true, velocityMatrix);
        exp.addToSceneNow(this._visualModel.getNode().getScene().getRootNode(), soundSource, isHit);
        this._visualModel.markAsReusable(true);
        if (this._startSound) {
            this._startSound.stopPlaying(audio.SOUND_RAMP_DURATION);
            this._startSound = null;
        }
        if (this._trailEmitter) {
            this._trailEmitter.detach();
        }
    };
    /**
     * The callback to get the offset to be used for hit checks for this missile
     * (the sides of the hitboxes are offset towards the outside (i.e. the hitbox 
     * is enlarged in all directions) by this much, in meters)
     * @param {Spacecraft} hitObject The spacecraft that is getting checked for hit
     * @returns {Number}
     */
    Missile.prototype._getHitOffset = function (hitObject) {
        return this._origin.isHostile(hitObject) ? this._class.getProximityRange() : 0;
    };
    /**
     * The function to call when the missile hits a spacecraft
     * @param {Spacecraft} hitObject 
     * @param {PhysicalObject} physicalHitObject 
     * @param {Number[4]} hitPositionVectorInObjectSpace 
     * @param {Number[4]} hitPositionVectorInWorldSpace 
     * @param {Number[3]} relativeHitPositionVectorInWorldSpace
     * @param {Number[3]} relativeVelocityDirectionInObjectSpace
     * @param {Number[3]} relativeVelocityDirectionInWorldSpace
     * @param {Number} relativeVelocity
     * @param {Number} offset
     */
    Missile.prototype._hitCallback = function (hitObject, physicalHitObject, hitPositionVectorInObjectSpace, hitPositionVectorInWorldSpace, relativeHitPositionVectorInWorldSpace, relativeVelocityDirectionInObjectSpace, relativeVelocityDirectionInWorldSpace, relativeVelocity, offset) {
        physicalHitObject.applyForceAndTorque(relativeHitPositionVectorInWorldSpace, relativeVelocityDirectionInWorldSpace, relativeVelocity * this._class.getKineticFactor() * this._physicalModel.getMass() * 1000, 1, 1);
        this._destruct(
                ((hitObject.getShieldIntegrity() > 0) ? this._class.getShieldExplosionClass() : this._class.getExplosionClass()),
                mat.translation4vAux(hitPositionVectorInWorldSpace),
                vec.scaled3(relativeVelocityDirectionInWorldSpace, -1),
                physicalHitObject.getVelocityMatrix(),
                hitObject.getSoundSource(),
                true);
        hitObject.damage(this._class.getDamage(0), hitPositionVectorInObjectSpace, vec.scaled3(relativeVelocityDirectionInObjectSpace, -1), this._origin, true, offset);
        this._timeLeft = 0;
    };
    /**
     * Simulates the movement of the missile and checks if it hit any objects.
     * @param {Number} dt The passed time since the last simulation in milliseconds.
     * @param {Octree} hitObjectOctree The root node of the octree that is used to spatially partition the spacecrafts this missile can
     * hit.
     * @param {Spacecraft} [pilotedCraft] The spacecraft the player pilots in the current mission
     */
    Missile.prototype.simulate = function (dt, hitObjectOctree, pilotedCraft) {
        var i, matrix, threshold, hitCheckDT, enginePosition;
        if (this.canBeReused()) {
            return;
        }
        // avoid hit checking right after the missile is launched, as it could hit the launching ship
        hitCheckDT = Math.min(dt, this._class.getDuration() - this._timeLeft);
        this._timeLeft -= dt;
        this._timeLeftForIgnition -= dt;
        // if the target the missile is trying to home in on has been destroyed, self-destruct the missile
        if (this._target && this._homing && !this._target.isAlive()) {
            this._target = null;
            if (this._timeLeftForIgnition <= 0) {
                this._timeLeft = 0;
            }
        }
        this._mainBurn = false;
        if (this._timeLeft > 0) {
            // set up and apply the main and maneuvering thrusters
            if ((this._timeLeftForIgnition <= 0) && this._target) {
                matrix = this._physicalModel.getOrientationMatrix();
                this.resetThrusterBurn();
                if (this._homing && !this._stopHoming) {
                    // for homing, calculate expected target hit position and the yaw and pitch angles towards it
                    vec.getYawAndPitch(_angles, vec.normalize3(vec.prodMat4Vec3Aux(
                            matrix,
                            vec.diffVec3Mat4Aux(this._getTargetHitPosition(), this._physicalModel.getPositionMatrix()))));
                    threshold = this._class.getMainBurnAngleThreshold();
                }
                // apply main thrust if the missile is not homing or is homing and sufficiently facing the target
                // direction
                if (!this._homing || this._stopHoming || (Math.abs(_angles.yaw) < threshold && Math.abs(_angles.pitch) < threshold)) {
                    this._physicalModel.applyForce(this._class.getThrust(), matrix[4], matrix[5], matrix[6], dt);
                    this._mainBurn = true;
                    this.addThrusterBurnForward(1);
                    if (!this._started) {
                        this._started = true;
                        if (this._class.getHomingMode() === classes.MissileHomingMode.INITIAL) {
                            this._stopHoming = true;
                        }
                        matrix = this._visualModel.getPositionMatrixInCameraSpace(this._visualModel.getNode().getScene().getCamera());
                        this._soundSource.setPositionImmediate(
                                Math.round(matrix[12] * 10) * 0.1,
                                Math.round(matrix[13] * 10) * 0.1,
                                Math.round(matrix[14] * 10) * 0.1);
                        this._startSound = this._class.playStartSound(this._soundSource);
                    }
                }
                // use maneuvering thrusters for homing
                if (this._homing) {
                    if (!this._stopHoming) {
                        this._turn(_angles.yaw, _angles.pitch, dt);
                    }
                    this._controlTurnThrusters(dt);
                    this._applyTurnThrust(dt);
                }
                for (i = 0; i < this._thrusters.length; i++) {
                    this._thrusters[i].updateVisuals();
                }
            }
            // update sound position
            if (this._started) {
                matrix = this._visualModel.getPositionMatrixInCameraSpace(this._visualModel.getNode().getScene().getCamera());
                this._soundSource.updatePosition(
                        Math.round(matrix[12] * 10) * 0.1,
                        Math.round(matrix[13] * 10) * 0.1,
                        Math.round(matrix[14] * 10) * 0.1);
            }
            // update lightsource
            if (this._lightSource) {
                this._lightSource.setObjectIntensity(this._mainBurn ? this._class.getLightIntensity() : 0);
            }
            this._physicalModel.simulate(dt);
            this._turningMatrixValid = false;
            this._targetHitPositionValid = false;
            this._visualModel.setPositionMatrix(this._physicalModel.getPositionMatrix());
            this._visualModel.setOrientationMatrix(this._physicalModel.getOrientationMatrix());
            // update the trail that the missile leaves behind
            if (this._trailEmitter) {
                if (this._mainBurn) {
                    enginePosition = this._visualModel.getPositionVector();
                    vec.add3(enginePosition, vec.prodVec3Mat3Aux(this._class.getEnginePosition(), mat.prodScalingRotation3Aux(this._visualModel.getScalingMatrix(), this._visualModel.getOrientationMatrix())));
                    if (!this._trailEmitter.isEmitting()) {
                        this._trailEmitter.startNew(this._visualModel.getNode().getScene(), enginePosition);
                    } else {
                        this._trailEmitter.addPoint(enginePosition, dt);
                    }
                } else {
                    if (this._trailEmitter.isEmitting()) {
                        this._trailEmitter.detach();
                    }
                }
            }
            if ((hitCheckDT > 0) && (this._timeLeftForIgnition <= 0)) {
                _checkHit(this._physicalModel.getPositionMatrix(), this._physicalModel.getVelocityMatrix(), hitObjectOctree, hitCheckDT, this._origin, pilotedCraft, this._getHitOffset, this._hitCallback);
            }
        } else {
            // self-destruct if the time has run out
            this._timeLeft = 0;
            if (!this._visualModel.canBeReused()) {
                matrix = this._visualModel.getPositionMatrixInCameraSpace(this._visualModel.getNode().getScene().getCamera());
                this._destruct(
                        this._class.getExplosionClass(),
                        this._physicalModel.getPositionMatrix(),
                        vec.scaled3Aux(vec.normalize3(mat.translationVector3(this._physicalModel.getVelocityMatrix())), -1),
                        this._physicalModel.getVelocityMatrix(),
                        audio.createSoundSource(matrix[12], matrix[13], matrix[14]),
                        false);
            }
        }
    };
    /**
     * Updates the thruster particle sizes and luminosity factors to reflect the
     * current thruster burn levels.
     */
    Missile.prototype.updateThrusterVisuals = function () {
        var i;
        for (i = 0; i < this._thrusters.length; i++) {
            this._thrusters[i].updateVisuals();
        }
    };
    /**
     * Removes all references from the missile.
     */
    Missile.prototype.destroy = function () {
        var i;
        this._timeLeft = 0;
        this._class = null;
        this._origin = null;
        this._turningMatrix = null;
        this._target = null;
        this._targetHitPosition = null;
        for (i = 0; i < this._thrusters.length; i++) {
            this._thrusters[i].destroy();
        }
        this._thrusters = null;
        this._forward = null;
        this._yawLeft = null;
        this._yawRight = null;
        this._pitchUp = null;
        this._pitchDown = null;
        if (this._visualModel && this._visualModel.getNode()) {
            this._visualModel.getNode().markAsReusable(true);
        }
        this._visualModel = null;
        if (this._trailEmitter) {
            this._trailEmitter.destroy();
            this._trailEmitter = null;
        }
        this._physicalModel = null;
        if (this._startSound) {
            this._startSound.stopPlaying(audio.SOUND_RAMP_DURATION);
            this._startSound = null;
        }
        this._soundSource = null;
        this._lightSource = null;
        this._hitCallback = null;
        this._getHitOffset = null;
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
         * The time remaining until the weapon can fire again, in milliseconds
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
        this._origoPositionMatrix = mat.identity4();
        /**
         * Stores the calculated value of the scaling matrix of the parent spacecraft and the orientation of the weapon slot for speeding
         * up calculations.
         * @type Float32Array
         */
        this._scaledOriMatrix = mat.identity4();
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
        return (this._class.getProjectileVelocity() + baseSpeed) * this._class.getProjectileClass().getDuration() * 0.001;
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
        return this._origoPositionMatrix;
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
                weaponSlotPosVector = vec.prodTranslationRotation3Aux(this.getOrigoPositionMatrix(), shipScaledOriMatrix);
        vec.addVec3Mat4(weaponSlotPosVector, this._spacecraft.getPhysicalPositionMatrix());
        basePointPosVector = vec.prodVec4Mat4Aux(this._class.getBasePoint(), this._transformMatrix);
        vec.mulVec3Mat4(basePointPosVector, this._scaledOriMatrix);
        vec.mulVec3Mat4(basePointPosVector, shipScaledOriMatrix);
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
     * @param {WeaponClass~ResourceParams} params
     */
    Weapon.prototype.acquireResources = function (params) {
        this._class.acquireResources(params);
    };
    /**
     * @typedef {Object} Weapon~AddToSceneParams
     * @property {Boolean} [skipResources=false] If true, resources will not be acquired
     * @property {String} [shaderName] If given, the original shader of this weapon will be substituted by the shader with this name.
     * @property {Float32Array} [orientationMatrix]
     * @property {Boolean} [projectileResources=false] Whether to acquire resources for firing projectiles
     * @property {Boolean} [sound=false] Whether to acquire resources for sound effects
     */
    /**
     * @typedef {Function} logic~addToSceneCallback
     * @param {ParameterizedMesh} model
     */
    /**
     * Adds a renderable node representing this weapon to the scene under the
     * passed parent node, assuming its resources have already been loaded.
     * @param {ParameterizedMesh} parentNode See addToScene()
     * @param {Number} [lod] See addToScene()
     * @param {Boolean} wireframe See addToScene()
     * @param {Weapon~AddToSceneParams} params See addToScene()
     * @param {logic~addToSceneCallback} [callback] See addToScene()
     */
    Weapon.prototype.addToSceneNow = function (parentNode, lod, wireframe, params, callback) {
        var visualModel, scale, shader;
        application.log_DEBUG("Adding weapon (" + this._class.getName() + ") to scene...", 2);
        shader = params.shaderName ? graphics.getManagedShader(params.shaderName) : this._class.getShader();
        scale = this._class.getModel().getScale() / parentNode.getRenderableObject().getScalingMatrix()[0];
        mat.setTranslatedByVector(this._origoPositionMatrix,
                this._slot ? this._slot.positionMatrix : mat.IDENTITY4,
                vec.prodVec3Mat4Aux(
                        vec.scaled3Aux(this._class.getAttachmentPoint(), -1),
                        mat.prodScalingRotationAux(
                                mat.scaling4Aux(scale),
                                this._slot ? this._slot.orientationMatrix : mat.IDENTITY4)));
        visualModel = new renderableObjects.ParameterizedMesh(
                this._class.getModel(),
                shader,
                this._class.getTexturesOfTypes(shader.getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                this._slot ? this.getOrigoPositionMatrix() : mat.identity4(),
                params.orientationMatrix || (this._slot ? this._slot.orientationMatrix : mat.identity4()),
                mat.scaling4(scale),
                (wireframe === true),
                lod,
                undefined,
                _parameterArrays);
        parentNode.addSubnode(new sceneGraph.RenderableNode(visualModel));
        // setting the starting values of the parameter arrays
        // setting an identity transformation for all transform groups
        if (visualModel.hasParameterArray(_groupTransformsArrayName)) {
            visualModel.setParameterArray(_groupTransformsArrayName, graphics.getGroupTransformIdentityArray());
        }
        // setting the default luminosity for all luminosity groups
        if (graphics.areLuminosityTexturesAvailable() && visualModel.hasParameterArray(_luminosityFactorsArrayName)) {
            visualModel.setParameterArray(_luminosityFactorsArrayName, this._class.getDefaultGroupLuminosityFactors());
        }
        if (!this._visualModel) {
            this._visualModel = visualModel;
        }
        mat.setProdScalingRotation(this._scaledOriMatrix, this._visualModel.getScalingMatrix(), this._slot ? this._slot.orientationMatrix : mat.IDENTITY4);
        if (callback) {
            callback(visualModel);
        }
    };
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
        if (!params.skipResources) {
            this.acquireResources({omitShader: !!params.shaderName, projectileResources: params.projectileResources, sound: params.sound});
            if (params.shaderName) {
                graphics.getShader(params.shaderName);
            }
        }
        resources.executeWhenReady(this.addToSceneNow.bind(this, parentNode, lod, wireframe, params, callback));
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
                muzzleFlash = this._class.getBarrel(barrelIndex).getProjectileClass().getMuzzleFlash(),
                particle = _particlePool.getObject();
        renderableObjects.initDynamicParticle(
                particle,
                muzzleFlash.getModel(),
                muzzleFlash.getShader(),
                muzzleFlash.getTexturesOfTypes(muzzleFlash.getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                muzzleFlash.getColor(),
                muzzleFlash.getSize(),
                mat.translation4vAux(relativeBarrelPosVector),
                muzzleFlash.getDuration() || config.getSetting(config.BATTLE_SETTINGS.DEFAULT_MUZZLE_FLASH_DURATION),
                muzzleFlash.getInstancedShader());
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
        this._cooldown = Math.max(this._cooldown - dt, 0);
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
    // static auxiliary matrices/vectors to be used in the fire() method (to avoid creating new matrices/vectors during each execution of the method)
    Weapon._weaponSlotPosMatrix = mat.identity4();
    Weapon._projectilePosMatrix = mat.identity4();
    Weapon._projectileOriMatrix = mat.identity4();
    Weapon._barrelPosVector = [0, 0, 0, 1];
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
                projectileClass, muzzleFlash, barrels, projectileLights, projClassName,
                soundPosition, lighSource,
                scene = this._visualModel.getNode().getScene();
        if (onlyIfAimedOrFixed && (this._lastAimStatus !== WeaponAimStatus.FIXED) && (this._lastAimStatus !== WeaponAimStatus.AIMED_IN_RANGE)) {
            return 0;
        }
        // check cooldown
        if (this._cooldown <= 0) {
            this._cooldown = this._class.getCooldown();
            // cache the matrices valid for the whole weapon
            weaponSlotPosVector = vec.prodTranslationRotation3Aux(this.getOrigoPositionMatrix(), shipScaledOriMatrix);
            mat.setTranslatedByVector(Weapon._weaponSlotPosMatrix, this._spacecraft.getPhysicalPositionMatrix(), weaponSlotPosVector);
            projectileOriMatrix = this.getProjectileOrientationMatrix();
            barrels = this._class.getBarrels();
            if (_dynamicLights) {
                projectileLights = {};
            }
            result = 0;
            // generate the muzzle flashes and projectiles for each barrel
            for (i = 0; i < barrels.length; i++) {
                // cache variables
                projectileClass = barrels[i].getProjectileClass();
                vec.setVector4(Weapon._barrelPosVector, barrels[i].getPositionVector());
                if (!this._fixed) {
                    vec.mulVec4Mat4(Weapon._barrelPosVector, this._transformMatrix);
                }
                // add the muzzle flash of this barrel
                muzzleFlash = this._getMuzzleFlashForBarrel(i, Weapon._barrelPosVector);
                vec.mulVec3Mat4(Weapon._barrelPosVector, mat.prod3x3SubOf4Aux(this._scaledOriMatrix, shipScaledOriMatrix));
                mat.setTranslatedByVector(Weapon._projectilePosMatrix, Weapon._weaponSlotPosMatrix, Weapon._barrelPosVector);
                this._visualModel.getNode().addSubnode(muzzleFlash.getNode() || new sceneGraph.RenderableNode(muzzleFlash, false, false, true));
                // add the projectile of this barrel
                p = _projectilePool.getObject();
                p.init(projectileClass, this._spacecraft);
                p.addToSceneNow(scene, false, Weapon._projectilePosMatrix, projectileOriMatrix, barrels[i].getProjectileVelocity());
                if (_dynamicLights && projectileClass.getLightColor()) {
                    // creating the light source / adding the projectile to the emitting objects if a light source for this class of fired projectiles has already
                    // been created, so that projectiles from the same weapon and of the same class only use one light source object
                    if (!projectileLights[projectileClass.getName()]) {
                        lighSource = new lights.PointLightSource(projectileClass.getLightColor(), projectileClass.getLightIntensity(), vec.NULL3, [p.getVisualModel()]);
                        projectileLights[projectileClass.getName()] = lighSource;
                        p.setLightSource(lighSource);
                    } else {
                        projectileLights[projectileClass.getName()].addEmittingObject(p.getVisualModel());
                    }
                }
                // create the counter-force affecting the firing ship
                this._spacecraft.getPhysicalModel().applyForceAndTorque(
                        vec.diffTranslation3Aux(
                                Weapon._projectilePosMatrix,
                                this._spacecraft.getPhysicalPositionMatrix()),
                        mat.getRowB43Neg(projectileOriMatrix),
                        barrels[i].getFireForce(),
                        1,
                        1
                        );
                result++;
            }
            if (_dynamicLights) {
                for (projClassName in projectileLights) {
                    if (projectileLights.hasOwnProperty(projClassName)) {
                        scene.addPointLightSource(projectileLights[projClassName], constants.PROJECTILE_LIGHT_PRIORITY);
                    }
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
            this._rotationAngles[0] = angleOne * utils.RAD;
            this._rotationAngles[1] = angleTwo * utils.RAD;
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
                        angleDifference -= utils.DOUBLE_PI;
                    } else if (angleDifference < -Math.PI) {
                        angleDifference += utils.DOUBLE_PI;
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
                        this._rotationAngles[i] -= utils.DOUBLE_PI;
                    }
                    if (this._rotationAngles[i] < -Math.PI) {
                        this._rotationAngles[i] += utils.DOUBLE_PI;
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
        var basePointPosVector, vectorToTarget, inRange;
        if (!this._fixed) {
            // as a basis for calculating the direction pointing towards the target, the base point of the weapon is considered (in world 
            // space, transformed according to the current rotation angles of the weapon)
            basePointPosVector = this.getBasePointPosVector(shipScaledOriMatrix);
            // calculate the vector pointing towards the target in world coordinates
            vectorToTarget = vec.diff3Aux(targetPositionVector, basePointPosVector);
            // transform to object space - relative to the weapon
            vectorToTarget = vec.prodMat4Vec3Aux(this._spacecraft.getPhysicalOrientationMatrix(), vectorToTarget);
            vectorToTarget = vec.prodMat4Vec3Aux(this._slot.orientationMatrix, vectorToTarget);
            inRange = vec.extractLength3(vectorToTarget) <= this.getRange(0);
            switch (this._class.getRotationStyle()) {
                case classes.WeaponRotationStyle.YAW_PITCH:
                    vec.getYawAndPitch(_angles, vectorToTarget);
                    this.rotateTo(-_angles.yaw, -_angles.pitch, turnThreshold, fireThreshold, dt);
                    break;
                case classes.WeaponRotationStyle.ROLL_YAW:
                    vec.getRollAndYaw(_angles, vectorToTarget, false);
                    this.rotateTo(_angles.roll, _angles.yaw, turnThreshold, fireThreshold, dt);
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
        this._origoPositionMatrix = null;
        this._scaledOriMatrix = null;
        if (this._visualModel) {
            this._visualModel.markAsReusable(true);
        }
        this._visualModel = null;
    };
    // #########################################################################
    /**
     * @class Represents a missile launcher with fixed tubes on a spacecraft.
     * @param {MissileClass} missileClass The class storing the general 
     * characteristics of the missiles loaded into this launcher.
     * (a launcher can only have one class of missiles equipped at a time)
     * @param {Spacecraft} spacecraft The spacecraft on which this launcher is 
     * located.
     * @param {MissileLauncherDescriptor} descriptor The descriptor belonging to
     * the spacecraft's class that corresponds to this launcher.
     * @param {Number} missileCount The amount of missiles currently loaded into this
     * launcher.
     */
    function MissileLauncher(missileClass, spacecraft, descriptor, missileCount) {
        /**
         * The class storing the general characteristics of the missiles loaded 
         * into this launcher.
         * (a launcher can only have one class of missiles equipped at a time)
         * @type MissileClass
         */
        this._class = missileClass;
        /**
         * The spacecraft on which this launcher is located.
         * @type Spacecraft
         */
        this._spacecraft = spacecraft;
        /**
         * The descriptor belonging to the spacecraft's class that corresponds 
         * to this launcher.
         * @type MissileLauncherDescriptor
         */
        this._descriptor = descriptor;
        /**
         * The amount of missiles loaded into this launcher.
         * @type Number
         */
        this._missileCount = missileCount;
        /**
         * The time remaining until the next missile can be launched, in milliseconds.
         * @type Number
         */
        this._cooldown = 0;
        /**
         * The index of the missile tube that will launch next
         * @type Number
         */
        this._activeTubeIndex = 0;
        /**
         * Whether salvo launching mode is turned on
         * @type Number
         */
        this._salvo = false;
        /**
         * The amount of missiles left to launch in the current salvo
         * @type Number
         */
        this._salvoLeft = 0;
        /**
         * The target of the current salvo (missiles launched in this salvo will
         * target this spacecraft, regardless of the current target of the
         * spacecraft the missile launcher is on)
         * @type Spacecraft
         */
        this._salvoTarget = null;
        /**
         * The array of meshes representing the missiles loaded into the launch tubes
         * of this missile launcher
         * @type ParameterizedMesh[]
         */
        this._visualModels = null;
    }
    /**
     * Returns the class of missiles loaded into this launcher
     * @returns {MissileClass}
     */
    MissileLauncher.prototype.getMissileClass = function () {
        return this._class;
    };
    /**
     * Returns the name of the missile loaded into this launcher  in a way that 
     * can be displayed to the user (translated)
     * @returns {String}
     */
    MissileLauncher.prototype.getDisplayName = function () {
        return this._class.getDisplayName();
    };
    /**
     * Returns the damage one missile from this launcher deals to a target with 
     * the passed armor rating.
     * @param {Number} [armorRating=0]
     * @returns {Number}
     */
    MissileLauncher.prototype.getDamage = function (armorRating) {
        return this._class.getDamage(armorRating);
    };
    /**
     * Returns the total damage dealt by all missiles from this launcher to a
     * target with the passed armor rating.
     * @param {Number} [armorRating=0]
     * @returns {Number}
     */
    MissileLauncher.prototype.getFirepower = function (armorRating) {
        return this._missileCount * this._class.getDamage(armorRating);
    };
    /**
     * Returns the range of the missile fired from a still fighter if it flies
     * straight forward. (actual effective range will depend on the relative 
     * velocity of the fighter and the maneuvering of the missile if homing)
     * @returns {Number}
     */
    MissileLauncher.prototype.getNominalRange = function () {
        return this._class.getNominalRange();
    };
    /**
     * Returns the rate of fire of this launcher, in shots per second
     * @returns {Number}
     */
    MissileLauncher.prototype.getFireRate = function () {
        return this._class.getFireRate();
    };
    /**
     * Returns the time it takes for this launcher to lock on to a target, in milliseconds
     * @returns {Number}
     */
    MissileLauncher.prototype.getLockingTime = function () {
        return this._class.getLockingTime();
    };
    /**
     * Return the duration this launcher needs between launches, in milliseconds.
     * @returns {Number}
     */
    MissileLauncher.prototype.getCooldown = function () {
        return this._class.getCooldown();
    };
    /**
     * Returns how close is the launcher to being ready for the next manual launch (from 0 to 1)
     * @returns {Number}
     */
    MissileLauncher.prototype.getLoadRatio = function () {
        return (this._missileCount > this._salvoLeft) ?
                (this._salvo ?
                        1 - (this._salvoLeft + this._cooldown / this._class.getCooldown()) / this._descriptor.salvo :
                        1 - this._cooldown / this._class.getCooldown()) :
                0;
    };
    /**
     * Whether the launcher is currently in salvo mode
     * @returns {Boolean}
     */
    MissileLauncher.prototype.isInSalvoMode = function () {
        return this._salvo;
    };
    /**
     * Turn salvo mode on or off
     * @param {Booelan} value
     */
    MissileLauncher.prototype.setSalvoMode = function (value) {
        this._salvo = value && (this._descriptor.salvo > 1);
    };
    /**
     * Toggle salvo mode
     * @returns {Boolean} Whether the salvo mode has been changed
     */
    MissileLauncher.prototype.toggleSalvoMode = function () {
        if (this._descriptor.salvo > 1) {
            this._salvo = !this._salvo;
            return true;
        }
        return false;
    };
    /**
     * The amount of missiles left to launch in the current salvo
     * @returns {Number}
     */
    MissileLauncher.prototype.getSalvoLeft = function () {
        return this._salvoLeft;
    };
    /**
     * The total amount of missiles launched in one salvo
     * @returns {Number}
     */
    MissileLauncher.prototype.getSalvo = function () {
        return this._descriptor.salvo;
    };
    /**
     * Sets the cooldown to the passed value, if it is larger than the currently remaining cooldown
     * @param {Number} value In milliseconds
     */
    MissileLauncher.prototype.setMinimumCooldown = function (value) {
        if (this._cooldown < value) {
            this._cooldown = value;
        }
    };
    /**
     * Returns a 4x4 rotation matrix describing the orientation of missiles launched by this launcher in world space.
     * Uses an auxiliary matrix common to all MissileLaunchers.
     * @returns {Float32Array}
     */
    MissileLauncher.prototype.getMissileOrientationMatrix = function () {
        mat.setProd3x3SubOf4(MissileLauncher._missileOriMatrix, this._descriptor.orientationMatrix, this._spacecraft.getPhysicalOrientationMatrix());
        return MissileLauncher._missileOriMatrix;
    };
    /**
     * Marks the resources necessary to render missiles from this launcher for loading.
     * @param {MissileClass~ResourceParams} params
     */
    MissileLauncher.prototype.acquireResources = function (params) {
        this._class.acquireResources(params);
    };
    /**
     * Adds the resources required to render the missiles launched by this launcher
     * to the passed scene, so they get loaded at the next resource load as well 
     * as added to any context the scene is added to.
     * @param {Scene} scene
     */
    MissileLauncher.prototype.addMissileResourcesToScene = function (scene) {
        var missile, resourceID = MISSILE_LAUNCHER_RESOURCE_ID_PREFIX + this._class.getName();
        missile = new Missile(this._class);
        missile.addResourcesToScene(scene, false, undefined, undefined, true);
        resources.executeWhenReady(function () {
            scene.addResourcesOfObject(null, resourceID);
        });
    };
    /**
     * @typedef {Object} MissileLauncher~AddToSceneParams
     * @property {String} [shaderName]
     * @property {Boolean} [allMissiles] Whether to add all the loaded missiles, not
     * just the first ones for each tube - use all missiles to display them in wireframe
     * inside the spacecraft, use the first missile only for displaying in solid mode
     * (updating visuals during simulation only works properly with the first missiles
     * added)
     */
    /**
     * Adds renderable nodes representing the missiles loaded into this launcher to 
     * the scene under the passed parent node, assuming its resources have already been loaded.
     * @param {ParameterizedMesh} parentNode
     * @param {Number} [lod]
     * @param {Boolean} wireframe
     * @param {MissileLauncher~AddToSceneParams} params 
     * @param {logic~addToSceneCallback} [callback]
     */
    MissileLauncher.prototype.addToSceneNow = function (parentNode, lod, wireframe, params, callback) {
        var visualModel, scale, shader, textures, i, j, count, newVisualModel = false;
        application.log_DEBUG("Adding missile launcher (" + this._class.getName() + ") to scene...", 2);
        scale = this._class.getModel().getScale() / parentNode.getRenderableObject().getScalingMatrix()[0];
        shader = params.shaderName ? graphics.getManagedShader(params.shaderName) : this._class.getShader();
        textures = this._class.getTexturesOfTypes(shader.getTextureTypes(), graphics.getTextureQualityPreferenceList());
        if (!this._visualModels) {
            this._visualModels = [];
            newVisualModel = true;
        }
        for (i = 0; i < this._descriptor.tubePositions.length; i++) {
            count = params.allMissiles ? Math.floor(this._missileCount / this._descriptor.tubePositions.length) + ((this._missileCount % this._descriptor.tubePositions.length > i) ? 1 : 0) : 1;
            for (j = 0; j < count; j++) {
                visualModel = new renderableObjects.ParameterizedMesh(
                        this._class.getModel(),
                        shader,
                        textures,
                        mat.translation4v(vec.sum3Aux(this._descriptor.tubePositions[i], [0, -j * scale * this._class.getLength(), 0])),
                        mat.identity4(),
                        mat.scaling4(scale),
                        (wireframe === true),
                        lod,
                        undefined,
                        _parameterArrays);
                parentNode.addSubnode(new sceneGraph.RenderableNode(visualModel));
                // setting the starting values of the parameter arrays
                // setting an identity transformation for all transform groups
                if (visualModel.hasParameterArray(_groupTransformsArrayName)) {
                    visualModel.setParameterArray(_groupTransformsArrayName, graphics.getGroupTransformIdentityArray());
                }
                // setting the default luminosity for all luminosity groups
                if (graphics.areLuminosityTexturesAvailable() && visualModel.hasParameterArray(_luminosityFactorsArrayName)) {
                    visualModel.setParameterArray(_luminosityFactorsArrayName, this._class.getDefaultGroupLuminosityFactors());
                }
                if (newVisualModel) {
                    this._visualModels.push(visualModel);
                }
                if (callback) {
                    callback(visualModel);
                }
            }
        }
    };
    /**
     * Does all the needed updates to the missile launcher's state for one simulation step.
     * @param {Number} dt The time elapsed since the last simulation step, in milliseconds
     */
    MissileLauncher.prototype.simulate = function (dt) {
        this._cooldown = Math.max(this._cooldown - dt, 0);
        // launch the next missile in the salvo, if we are in one
        if (this._salvoLeft > 0) {
            if (this._cooldown <= 0) {
                if ((this._missileCount > 0) && this._salvoTarget && this._salvoTarget.isAlive()) {
                    if (this.launch(this._spacecraft.getScaledOriMatrix(), this._spacecraft.getSoundSourceForFireSound(), true)) {
                        this._spacecraft.handleSalvoMissileLaunched();
                    }
                } else {
                    // cancel the salvo if we are out of missiles or the salvo target has been destroyed
                    this._salvoLeft = 0;
                    this._salvoTarget = null;
                }
            }
        }
        // if we have the loaded missiles displayed, remove the ones from empty tubes
        // note: this only works properly if only the first missiles were added to the
        // scene, not all! (use all missiles to display loadout in wireframe and first
        // missiles to display the loaded missiles in combat)
        if (this._visualModels !== null) {
            while (this._visualModels.length > this._missileCount) {
                this._visualModels.shift().markAsReusable(true);
            }
        }
    };
    // static auxiliary matrices to be used in the luanch() method (to avoid created new matrices during each execution of the method)
    MissileLauncher._tubePosMatrix = mat.identity4();
    MissileLauncher._missileOriMatrix = mat.identity4();
    /**
     * Launches a missile and adds it (if any) to the passed pool.
     * @param {Float32Array} shipScaledOriMatrix A 4x4 matrix describing the scaling and rotation of the spacecraft having this launcher - it
     * is more effective to calculate it once for a spacecraft and pass it to all launchers as a parameter.
     * @param {SoundSource} shipSoundSource The sound source belonging to the spacecraft this launcher is on
     * @param {Boolean} salvo Whether this is an automatic launch as part of a salvo (the first launch in a salvo is manual)
     * @returns {Missile} The missile that has been launched, if any
     */
    MissileLauncher.prototype.launch = function (shipScaledOriMatrix, shipSoundSource, salvo) {
        var m,
                tubePosVector,
                missileOriMatrix,
                soundPosition,
                scene = this._spacecraft.getVisualModel().getNode().getScene();
        // check missile count and cooldown
        if ((this._missileCount > 0) && (this._cooldown <= 0) && (salvo || (this._salvoLeft <= 0))) {
            if (!salvo) {
                // start a new salvo
                if (this._salvo && this._spacecraft.getTarget()) {
                    this._salvoLeft = this._descriptor.salvo;
                    this._salvoTarget = this._spacecraft.getTarget();
                } else {
                    // if not starting a salvo, set salvoLeft to one so after the launch it will be zero
                    this._salvoLeft = 1;
                }
            }
            this._missileCount--;
            this._salvoLeft--;
            this._cooldown = (this._salvoLeft > 0) ? this._class.getSalvoCooldown() : this._class.getCooldown();
            tubePosVector = vec.prodVec3Mat4Aux(this._descriptor.tubePositions[this._activeTubeIndex], shipScaledOriMatrix);
            mat.setTranslatedByVector(MissileLauncher._tubePosMatrix, this._spacecraft.getPhysicalPositionMatrix(), tubePosVector);
            missileOriMatrix = this.getMissileOrientationMatrix();
            // generate the missile
            m = _missilePool.getObject();
            m.init(
                    this._class,
                    MissileLauncher._tubePosMatrix,
                    missileOriMatrix,
                    this._spacecraft,
                    this._class.getLaunchVelocity(),
                    salvo ? this._salvoTarget : this._spacecraft.getTarget());
            m.addToSceneNow(scene, false, undefined, undefined, true);
            // create the counter-force affecting the firing ship
            this._spacecraft.getPhysicalModel().applyForceAndTorque(
                    tubePosVector,
                    mat.getRowB43Neg(missileOriMatrix),
                    this._class.getLaunchForce(),
                    1,
                    1
                    );
            if (!shipSoundSource) {
                soundPosition = mat.translationVector3(m.getVisualModel().getPositionMatrixInCameraSpace(scene.getCamera()));
            }
            this._class.playLaunchSound(soundPosition, shipSoundSource, _fireSoundStackingTimeThreshold, _fireSoundStackingVolumeFactor);
            this._activeTubeIndex = (this._activeTubeIndex + 1) % this._descriptor.tubePositions.length;
            return m;
        }
        return null;
    };
    /**
     * Whether the missile launcher is ready to launch the next missile
     * @returns {Boolean}
     */
    MissileLauncher.prototype.isReady = function () {
        return (this._cooldown <= 0) && (this._salvoLeft <= 0);
    };
    /**
     * Returns whether the passed spacecraft is within range of the missiles from this launcher.
     * Considers the current velocity of the spacecraft and the target, the launch velocity of the missile, the estimated time
     * it would take for homing missiles to turn towards the target before firing the main engine (based on angular acceleration
     * and main engine burn start threshold angle). Works with the center of the spacecraft and the target, does not consider
     * exact missile start position and target size for simplicity's sake (and to increase margin for error) as well as possible
     * range lost due to maneuvering on a curve instead of a straight line if the main burn start threshold angle is significant.
     * Also considers locking angle for homing missiles - is the target is outside of the allowed angle, it is considered out of
     * range
     * @param {Spacecraft} target
     * @returns {Boolean}
     */
    MissileLauncher.prototype.isInLockingRange = function (target) {
        var driftTime, burnTime, targetPosition, orientationMatrix, maxTurnAngle, turnTime, velocityVector, relativeTargetVelocity, angularAcceleration;
        orientationMatrix = this._spacecraft.getPhysicalOrientationMatrix();
        // velocity vector for the original drifting of the missile after it is launched, before igniting main engine
        velocityVector = vec.sumVec3Mat4Aux(vec.scaled3Aux(mat.getRowB43(orientationMatrix), this._class.getLaunchVelocity()), this._spacecraft.getPhysicalVelocityMatrix());
        relativeTargetVelocity = vec.diffMat4Vec3Aux(target.getPhysicalVelocityMatrix(), velocityVector);
        driftTime = 0.001 * this._class.getIgnitionTime();
        // first, consider drifting after launch
        targetPosition = vec.sum3Aux(target.getPhysicalPositionVector(), vec.scaled3Aux(relativeTargetVelocity, driftTime));
        // consider turning before firing main engine
        if (this._class.getHomingMode() === classes.MissileHomingMode.NONE) {
            turnTime = 0;
        } else {
            vec.getYawAndPitch(_angles, vec.normalize3(vec.prodMat4Vec3Aux(
                    orientationMatrix,
                    vec.diffVec3Mat4Aux(targetPosition, this._spacecraft.getPhysicalPositionMatrix()))));
            _angles.yaw = Math.abs(_angles.yaw);
            _angles.pitch = Math.abs(_angles.pitch);
            if (this._class.getLockingAngle() > 0) {
                if (Math.max(_angles.yaw, _angles.pitch) > this._class.getLockingAngle()) {
                    return false;
                }
            }
            maxTurnAngle = Math.max(0, Math.max(_angles.yaw, _angles.pitch) - this._class.getMainBurnAngleThreshold());
            angularAcceleration = this._class.getAngularAcceleration();
            turnTime = (angularAcceleration * MISSILE_TURN_ACCELERATION_DURATION_S * MISSILE_TURN_ACCELERATION_DURATION_S + maxTurnAngle) / (angularAcceleration * MISSILE_TURN_ACCELERATION_DURATION_S);
            if (turnTime < 2 * MISSILE_TURN_ACCELERATION_DURATION_S) {
                turnTime = Math.sqrt(4 * maxTurnAngle / angularAcceleration);
            }
            vec.add3(targetPosition, vec.scaled3Aux(relativeTargetVelocity, turnTime));
        }
        // consider the phase accelerating towards the target (assuming straight line for simplicity)
        burnTime = 0.001 * this._class.getDuration() - driftTime - turnTime;
        return this._class.getTargetHitTime(this._spacecraft.getPhysicalPositionMatrix(), targetPosition, relativeTargetVelocity) < burnTime;
    };
    /**
     * Returns the amount of score points to be added to the total score value of spacecrafts that have this launcher
     * (and the missiles loaded to it) equipped
     * @returns {Number}
     */
    MissileLauncher.prototype.getScoreValue = function () {
        return this._class.getScoreValue() * this._missileCount;
    };
    /**
     * Returns the amount of missiles currently loaded into this launcher.
     * @returns {Number}
     */
    MissileLauncher.prototype.getMissileCount = function () {
        return this._missileCount;
    };
    /**
     * Returns whether this missile launcher still has missiles loaded in it which are not yet queued for launch
     * @returns {Number}
     */
    MissileLauncher.prototype.hasMissilesLeftToLaunch = function () {
        return this._missileCount > this._salvoLeft;
    };
    /**
     * Returns the highest number of missiles that might be simultaneously used (flying, rendered on the battle)
     * for this launcher in one battle.
     * @returns {Number}
     */
    MissileLauncher.prototype.getMaxMissileCount = function () {
        return Math.min(this._missileCount, this._class.getMaxCount());
    };
    /**
     * Returns the highest number of explosions that might be used for this launcher simultaneously in one battle.
     * @returns {Number}
     */
    MissileLauncher.prototype.getMaxExplosionCount = function () {
        // all the missiles might theoretically explode at the same time
        return this.getMaxMissileCount();
    };
    /**
     * Returns the highest number of particles that might be used (rendered) for this launcher simultaneously in one battle.
     * @returns {Number}
     */
    MissileLauncher.prototype.getMaxParticleCount = function () {
        return this.getMaxMissileCount() * this._class.getParticleCount();
    };
    /**
     * Removes all references stored by this object
     */
    MissileLauncher.prototype.destroy = function () {
        var i;
        this._class = null;
        this._spacecraft = null;
        this._descriptor = null;
        this._salvoTarget = null;
        if (this._visualModels !== null) {
            for (i = 0; i < this._visualModels.length; i++) {
                this._visualModels[i].markAsReusable(true);
            }
            this._visualModels = null;
        }
    };
    // #########################################################################
    /**
     * @class The targeting computer keeps track of all targeting related data and performs targeting related tasks for the spacecraft it
     * is equipped on.
     * @param {Spacecraft} spacecraft The spacecraft this computer is equipped on
     * @param {Spacecraft[]} [spacecraftArray] The list of spacecrafts from which this computer can choose its target
     * @param {Environment} [environment] The environment the host spacecraft is situated in
     */
    function TargetingComputer(spacecraft, spacecraftArray, environment) {
        /**
         * The spacecraft this computer is equipped on
         * @type Spacecraft
         */
        this._spacecraft = spacecraft;
        /**
         * Cached value of the square of the range within which ships can be targeted, considering the
         * environmental factor as well
         * @type Number
         */
        this._rangeSquared = 0;
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
        this._targetHitPosition = [0, 0, 0];
        /**
         * Whether the calculated estimated future target position is currently up-to-date
         * @type Boolean
         */
        this._targetHitPositionValid = false;
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
        /**
         * The missile launcher for which the computer is locking the current target
         * @type MissileLauncher
         */
        this._missileLauncher = null;
        /**
         * The total amount of time needed until the current target is locked for missile launch, in milliseconds
         * @type Number
         */
        this._lockTime = 1;
        /**
         * The amount of time remaining until the current target is locked for missile launch, in milliseconds
         * @type Number
         */
        this._lockTimeLeft = 1;
        /**
         * Range is multiplied by this factor
         * @type Number
         */
        this._rangeFactor = environment ? environment.getSensorRangeFactor() : 1;
        /**
         * Missile locking time is multiplied by this factor
         * @type Number
         */
        this._lockingTimeFactor = environment ? environment.getLockingTimeFactor() : 1;
    }
    /**
     * Updates the targeting computer's properties with the passed sensor class being equipped on the spacecaft
     * @param {SensorsClass} [sensorsClass]
     */
    TargetingComputer.prototype.updateSensors = function (sensorsClass) {
        var range = sensorsClass ? sensorsClass.getRange() : 0;
        this._rangeSquared = range * range * this._rangeFactor * this._rangeFactor;
    };
    /**
     * Whether the passed spacecraft is in targeting range
     * @param {Spacecraft} craft
     * @returns {Boolean}
     */
    TargetingComputer.prototype.isInRange = function (craft) {
        return mat.distanceSquared(this._spacecraft.getPhysicalPositionMatrix(), craft.getPhysicalPositionMatrix()) <= this._rangeSquared;
    };
    /**
     * Reset locking time and time remaining according to missile launcher and target characteristics
     */
    TargetingComputer.prototype._resetMissileLock = function () {
        this._lockTime = (this._target && this._missileLauncher) ? (this._target.getLockingTimeFactor() * this._lockingTimeFactor * this._missileLauncher.getLockingTime()) : 1;
        this._lockTimeLeft = this._lockTime;
    };
    /**
     * Whether the current target is locked for missile launch
     * @returns {Boolean}
     */
    TargetingComputer.prototype.isMissileLocked = function () {
        return this._lockTimeLeft <= 0;
    };
    /**
     * Returns the progress ratio of the current missile locking process (0: not locked, 1: missile locked)
     * @returns {Number}
     */
    TargetingComputer.prototype.getMissileLockRatio = function () {
        return 1 - (this._lockTimeLeft / this._lockTime);
    };
    /**
     * Set a new missile launcher to use for locking on to the target with missiles
     * @param {MissileLauncher} missileLauncher 
     */
    TargetingComputer.prototype.setMissileLauncher = function (missileLauncher) {
        if (!this._missileLauncher || !missileLauncher || (missileLauncher.getMissileClass() !== this._missileLauncher.getMissileClass())) {
            this._missileLauncher = missileLauncher;
            this._resetMissileLock();
        } else {
            this._missileLauncher = missileLauncher;
        }
    };
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
            this._targetHitPositionValid = false;
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
            this._resetMissileLock();
        }
    };
    /**
     * Used to filter the potential target list to include only hostiles
     * @param {Spacecraft} craft
     * @returns {Boolean}
     */
    TargetingComputer.prototype._filterHostileTarget = function (craft) {
        return this._spacecraft.isHostile(craft) && (mat.distanceSquared(this._spacecraft.getPhysicalPositionMatrix(), craft.getPhysicalPositionMatrix()) <= this._rangeSquared);
    };
    /**
     * Used to filter the potential target list to include only non-hostiles
     * @param {Spacecraft} craft
     * @returns {Boolean}
     */
    TargetingComputer.prototype._filterNonHostileTarget = function (craft) {
        return (craft !== this._spacecraft) && !this._spacecraft.isHostile(craft) && (mat.distanceSquared(this._spacecraft.getPhysicalPositionMatrix(), craft.getPhysicalPositionMatrix()) <= this._rangeSquared);
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
                    vec.normalize3(vec.diffTranslation3Aux(
                            craft.getPhysicalPositionMatrix(), this._spacecraft.getPhysicalPositionMatrix())))
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
                vector = vec.diffTranslation3Aux(craft.getPhysicalPositionMatrix(), this._spacecraft.getPhysicalPositionMatrix()),
                distance = vec.extractLength3(vector);
        return {
            index: index,
            value: (distance +
                    TARGET_MAPPING_ANGLE_FACTOR * vec.angle3u(
                            mat.getRowB43(this._spacecraft.getPhysicalOrientationMatrix()),
                            vector)
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
                a, b, c, hitTime;
        if (!this._targetHitPositionValid) {
            this._targetHitPositionValid = true;
            targetPosition = this._target.getPhysicalPositionMatrix();
            weapons = this._spacecraft.getWeapons();
            if (weapons.length === 0) {
                this._targetHitPosition[0] = targetPosition[12];
                this._targetHitPosition[1] = targetPosition[13];
                this._targetHitPosition[2] = targetPosition[14];
                return targetPosition;
            }
            position = this._spacecraft.getPhysicalPositionMatrix();
            relativeTargetVelocity = vec.diffTranslation3Aux(this._target.getPhysicalVelocityMatrix(), this._spacecraft.getPhysicalVelocityMatrix());
            projectileSpeed = weapons[0].getProjectileVelocity();
            a = projectileSpeed * projectileSpeed - (relativeTargetVelocity[0] * relativeTargetVelocity[0] + relativeTargetVelocity[1] * relativeTargetVelocity[1] + relativeTargetVelocity[2] * relativeTargetVelocity[2]);
            b = 2 * (relativeTargetVelocity[0] * (position[12] - targetPosition[12]) +
                    relativeTargetVelocity[1] * (position[13] - targetPosition[13]) +
                    relativeTargetVelocity[2] * (position[14] - targetPosition[14]));
            c = -targetPosition[12] * targetPosition[12] - position[12] * position[12] + 2 * targetPosition[12] * position[12] -
                    targetPosition[13] * targetPosition[13] - position[13] * position[13] + 2 * targetPosition[13] * position[13] -
                    targetPosition[14] * targetPosition[14] - position[14] * position[14] + 2 * targetPosition[14] * position[14];
            hitTime = utils.getGreaterSolutionOfQuadraticEquation(a, b, c);
            this._targetHitPosition[0] = targetPosition[12] + hitTime * relativeTargetVelocity[0];
            this._targetHitPosition[1] = targetPosition[13] + hitTime * relativeTargetVelocity[1];
            this._targetHitPosition[2] = targetPosition[14] + hitTime * relativeTargetVelocity[2];
        }
        return this._targetHitPosition;
    };
    /**
     * Updates the internal state of the computer for the current simulation step
     * @param {Number} dt The time elapsed since the last simulation step, in milliseconds
     */
    TargetingComputer.prototype.simulate = function (dt) {
        if (this._rangeSquared === 0) {
            return;
        }
        if (this._target && (this._target.canBeReused() || this._target.isAway() || !this.isInRange(this._target))) {
            this.setTarget(null);
        }
        this._targetHitPositionValid = false;
        if (this._timeUntilHostileOrderReset > 0) {
            this._timeUntilHostileOrderReset -= dt;
        }
        if (this._timeUntilNonHostileOrderReset > 0) {
            this._timeUntilNonHostileOrderReset -= dt;
        }
        if (this._target && this._missileLauncher && this._missileLauncher.hasMissilesLeftToLaunch() && (this._missileLauncher.isInLockingRange(this._target))) {
            this._lockTimeLeft = Math.max(0, this._lockTimeLeft - dt);
        } else {
            this._resetMissileLock();
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
        this._missileLauncher = null;
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
     * @type PropulsionClass~ResourceParams
     */
    Thruster.PROPULSION_RESOURCE_PARAMS = {sound: true};
    /**
     * Adds a renderable node representing the particle that is rendered to show
     * the burn level of this thruster to the scene under the passed parent node.
     * @param {ParameterizedMesh} parentNode The parent node to which to attach the
     * particle in the scene. (normally the renderable node of the spacecraft
     * that has this thruster)
     * @param {Boolean} [replaceVisualModel=false] Whether to set the newly created
     * renderable node as the visual model of the thruster even if one already
     * existed before
     */
    Thruster.prototype.addToScene = function (parentNode, replaceVisualModel) {
        var visualModel;
        this._propulsionClass.acquireResources(Thruster.PROPULSION_RESOURCE_PARAMS);
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
            parentNode.addSubnode(new sceneGraph.RenderableNode(visualModel, false, false, true));
            if (!this._visualModel || replaceVisualModel) {
                if (this._visualModel) {
                    this._visualModel.markAsReusable(true);
                }
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
        if (this._visualModel) {
            this._visualModel.markAsReusable(true);
        }
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
         * An array storing direct references to all the thrusters.
         * @type Thruster[]
         */
        this._thrusters = [];
        /**
         * The burn level and nozzles associated with each thruster use command.
         * @type Object
         */
        this._forward = {burn: 0, thrusters: []};
        this._reverse = {burn: 0, thrusters: []};
        this._strafeLeft = {burn: 0, thrusters: []};
        this._strafeRight = {burn: 0, thrusters: []};
        this._raise = {burn: 0, thrusters: []};
        this._lower = {burn: 0, thrusters: []};
        this._yawLeft = {burn: 0, thrusters: []};
        this._yawRight = {burn: 0, thrusters: []};
        this._pitchUp = {burn: 0, thrusters: []};
        this._pitchDown = {burn: 0, thrusters: []};
        this._rollLeft = {burn: 0, thrusters: []};
        this._rollRight = {burn: 0, thrusters: []};
        /**
         * Sound clip used for playing the thruster sound effect for this propulsion.
         * @type SoundClip
         */
        this._thrusterSoundClip = null;
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
     * @param {PropulsionClass~ResourceParams} params 
     */
    Propulsion.prototype.acquireResources = function (params) {
        this._class.acquireResources(params);
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
     * Returns the object storing the burn level and thruster list associated
     * with the passed thruster use command
     * @param {String} name
     * @returns {Object}
     */
    Propulsion.prototype.getThrusterUse = function (name) {
        switch (name) {
            case ThrusterUse.FORWARD:
                return this._forward;
            case ThrusterUse.REVERSE:
                return this._reverse;
            case ThrusterUse.STRAFE_LEFT:
                return this._strafeLeft;
            case ThrusterUse.STRAFE_RIGHT:
                return this._strafeRight;
            case ThrusterUse.RAISE:
                return this._raise;
            case ThrusterUse.LOWER:
                return this._lower;
            case ThrusterUse.YAW_LEFT:
                return this._yawLeft;
            case ThrusterUse.YAW_RIGHT:
                return this._yawRight;
            case ThrusterUse.PITCH_UP:
                return this._pitchUp;
            case ThrusterUse.PITCH_DOWN:
                return this._pitchDown;
            case ThrusterUse.ROLL_LEFT:
                return this._rollLeft;
            case ThrusterUse.ROLL_RIGHT:
                return this._rollRight;
            default:
                application.showError("Invalid thruster use specified: '" + name + "'!", application.ErrorSeverity.SEVERE);
                return null;
        }
    };
    /**
     * Creates and adds thruster objects to all the thruster slots in the passed
     * array
     * @param {ThrusterSlot[]} slots
     */
    Propulsion.prototype.addThrusters = function (slots) {
        var i, j, thruster, use;
        for (i = 0; i < slots.length; i++) {
            thruster = new Thruster(this._class, slots[i]);
            this._thrusters.push(thruster);
            for (j = 0; j < slots[i].uses.length; j++) {
                use = this.getThrusterUse(slots[i].uses[j]);
                if (use) {
                    use.thrusters.push(thruster);
                }
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
            this._thrusters[i].addToScene(parentNode, false);
        }
    };
    /**
     * Adds to the thruster burn level corresponding to the thrusters of the passed 
     * use command.
     * This is slow, only to be used in non-performance-critical cases, when
     * the specific thruster use is not known. Otherwise, use the specific
     * methods for each thruster use instead. (below)
     * @param {String} use The use identifying which thrusters' level to increase. 
     * e.g. "forward" or "yawLeft"
     * @param {Number} value The amount added to the thruster burn level.
     */
    Propulsion.prototype.addThrusterBurn = function (use, value) {
        _addThrusterBurn(this.getThrusterUse(use), value);
    };
    Propulsion.prototype.addThrusterBurnForward = function (value) {
        _addThrusterBurn(this._forward, value);
    };
    Propulsion.prototype.addThrusterBurnReverse = function (value) {
        _addThrusterBurn(this._reverse, value);
    };
    Propulsion.prototype.addThrusterBurnLeft = function (value) {
        _addThrusterBurn(this._strafeLeft, value);
    };
    Propulsion.prototype.addThrusterBurnRight = function (value) {
        _addThrusterBurn(this._strafeRight, value);
    };
    Propulsion.prototype.addThrusterBurnUp = function (value) {
        _addThrusterBurn(this._raise, value);
    };
    Propulsion.prototype.addThrusterBurnDown = function (value) {
        _addThrusterBurn(this._lower, value);
    };
    Propulsion.prototype.addThrusterBurnYawLeft = function (value) {
        _addThrusterBurn(this._yawLeft, value);
    };
    Propulsion.prototype.addThrusterBurnYawRight = function (value) {
        _addThrusterBurn(this._yawRight, value);
    };
    Propulsion.prototype.addThrusterBurnPitchUp = function (value) {
        _addThrusterBurn(this._pitchUp, value);
    };
    Propulsion.prototype.addThrusterBurnPitchDown = function (value) {
        _addThrusterBurn(this._pitchDown, value);
    };
    Propulsion.prototype.addThrusterBurnRollLeft = function (value) {
        _addThrusterBurn(this._rollLeft, value);
    };
    Propulsion.prototype.addThrusterBurnRollRight = function (value) {
        _addThrusterBurn(this._rollRight, value);
    };
    /**
     * Resets the all the thruster burn levels to zero.
     */
    Propulsion.prototype.resetThrusterBurn = function () {
        var i;
        this._forward.burn = 0;
        this._reverse.burn = 0;
        this._strafeLeft.burn = 0;
        this._strafeRight.burn = 0;
        this._raise.burn = 0;
        this._lower.burn = 0;
        this._yawLeft.burn = 0;
        this._yawRight.burn = 0;
        this._pitchUp.burn = 0;
        this._pitchDown.burn = 0;
        this._rollLeft.burn = 0;
        this._rollRight.burn = 0;
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
                this._forward.burn, this._reverse.burn,
                this._strafeRight.burn, this._strafeLeft.burn,
                this._raise.burn, this._lower.burn) / max : 0;
        max = this._class.getMaxTurnBurnLevel();
        turn = max ? Math.max(
                this._yawRight.burn, this._yawLeft.burn,
                this._pitchUp.burn, this._pitchDown.burn,
                this._rollRight.burn, this._rollLeft.burn) / max : 0;
        max = Math.round((move + turn) * THRUSTER_SOUND_VOLUME_GRADES) / THRUSTER_SOUND_VOLUME_GRADES;
        return max;
    };
    /**
     * Applies the forces and torques that are created by this propulsion system
     * to the physical object it drives.
     * @param {Number} dt Time passed in the current simulation step, in milliseconds
     * @param {SoundSource} spacecraftSoundSource The sound source belonging to the spacecraft that has this propulsion equipped
     * @param {Boolean} [applyForces=true] If false, the forces and torques generated by the thrusters are not applied to the spacecraft 
     * (only e.g. sound effect volume is updated)
     */
    Propulsion.prototype.simulate = function (dt, spacecraftSoundSource, applyForces) {
        var directionVector, yawAxis, pitchAxis;
        if (applyForces !== false) {
            directionVector = mat.getRowB4(this._drivenPhysicalObject.getOrientationMatrix());
            yawAxis = mat.getRowC4(this._drivenPhysicalObject.getOrientationMatrix());
            pitchAxis = mat.getRowA4(this._drivenPhysicalObject.getOrientationMatrix());
            if (this._forward.burn > 0) {
                this._drivenPhysicalObject.applyForce(this._thrustFactor * this._forward.burn, directionVector[0], directionVector[1], directionVector[2], dt);
            } else if (this._reverse.burn > 0) {
                this._drivenPhysicalObject.applyForce(-this._thrustFactor * this._reverse.burn, directionVector[0], directionVector[1], directionVector[2], dt);
            }
            if (this._strafeRight.burn > 0) {
                this._drivenPhysicalObject.applyForce(this._thrustFactor * this._strafeRight.burn, pitchAxis[0], pitchAxis[1], pitchAxis[2], dt);
            } else if (this._strafeLeft.burn > 0) {
                this._drivenPhysicalObject.applyForce(-this._thrustFactor * this._strafeLeft.burn, pitchAxis[0], pitchAxis[1], pitchAxis[2], dt);
            }
            if (this._raise.burn > 0) {
                this._drivenPhysicalObject.applyForce(this._thrustFactor * this._raise.burn, yawAxis[0], yawAxis[1], yawAxis[2], dt);
            } else if (this._lower.burn > 0) {
                this._drivenPhysicalObject.applyForce(-this._thrustFactor * this._lower.burn, yawAxis[0], yawAxis[1], yawAxis[2], dt);
            }
            if (this._yawRight.burn > 0) {
                this._drivenPhysicalObject.applyTorque(this._angularThrustFactor * this._yawRight.burn, yawAxis, dt);
            } else if (this._yawLeft.burn > 0) {
                this._drivenPhysicalObject.applyTorque(-this._angularThrustFactor * this._yawLeft.burn, yawAxis, dt);
            }
            if (this._pitchUp.burn > 0) {
                this._drivenPhysicalObject.applyTorque(-this._angularThrustFactor * this._pitchUp.burn, pitchAxis, dt);
            } else if (this._pitchDown.burn > 0) {
                this._drivenPhysicalObject.applyTorque(this._angularThrustFactor * this._pitchDown.burn, pitchAxis, dt);
            }
            if (this._rollRight.burn > 0) {
                this._drivenPhysicalObject.applyTorque(-this._angularThrustFactor * this._rollRight.burn, directionVector, dt);
            } else if (this._rollLeft.burn > 0) {
                this._drivenPhysicalObject.applyTorque(this._angularThrustFactor * this._rollLeft.burn, directionVector, dt);
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
        this._forward = null;
        this._reverse = null;
        this._strafeLeft = null;
        this._strafeRight = null;
        this._raise = null;
        this._lower = null;
        this._yawLeft = null;
        this._yawRight = null;
        this._pitchUp = null;
        this._pitchDown = null;
        this._rollLeft = null;
        this._rollRight = null;
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
        /**
         * Keeps the value of yawTarget after it is reset in controlThrusters() to be used
         * for the rest of the simulation step (e.g. to use if for sending control messages
         * to the host in multiplayer games)
         * @type Number
         */
        this._lastYawTarget = 0;
        /**
         * Keeps the value of pitchTarget after it is reset in controlThrusters() to be used
         * for the rest of the simulation step (e.g. to use if for sending control messages
         * to the host in multiplayer games)
         * @type Number
         */
        this._lastPitchTarget = 0;
        /**
         * Keeps the value of rollTarget after it is reset in controlThrusters() to be used
         * for the rest of the simulation step (e.g. to use if for sending control messages
         * to the host in multiplayer games)
         * @type Number
         */
        this._lastRollTarget = 0;
        /**
         * Keeps the value of strafeTarget after it is reset in controlThrusters() to be used
         * for the rest of the simulation step (e.g. to use if for sending control messages
         * to the host in multiplayer games)
         * @type Number
         */
        this._lastStrafeTarget = 0;
        /**
         * Keeps the value of liftTarget after it is reset in controlThrusters() to be used
         * for the rest of the simulation step (e.g. to use if for sending control messages
         * to the host in multiplayer games)
         * @type Number
         */
        this._lastLiftTarget = 0;
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
     * Returns the value of strafe target (m/s target speed along the X axis) that has been last used in controlThrusters()
     * @returns {Number}
     */
    ManeuveringComputer.prototype.getLastStrafeTarget = function () {
        return this._lastStrafeTarget;
    };
    /**
     * Directly sets the strafe target (m/s target speed along the X axis)
     * @param {Number} value
     */
    ManeuveringComputer.prototype.setStrafeTarget = function (value) {
        this._strafeTarget = value;
    };
    /**
     * Returns the value of lift target (m/s target speed along the Z axis) that has been last used in controlThrusters()
     * @returns {Number}
     */
    ManeuveringComputer.prototype.getLastLiftTarget = function () {
        return this._lastLiftTarget;
    };
    /**
     * Directly sets the lift target (m/s target speed along the Z axis)
     * @param {Number} value
     */
    ManeuveringComputer.prototype.setLiftTarget = function (value) {
        this._liftTarget = value;
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
     * Returns the value of yaw target (target spin around the Z axis) that has been last used in controlThrusters()
     * @returns {Number}
     */
    ManeuveringComputer.prototype.getLastYawTarget = function () {
        return this._lastYawTarget;
    };
    /**
     * Directly sets the yaw target (target spin around the Z axis)
     * @param {Number} value
     */
    ManeuveringComputer.prototype.setYawTarget = function (value) {
        this._yawTarget = value;
    };
    /**
     * Returns the value of pitch target (target spin around the X axis) that has been last used in controlThrusters()
     * @returns {Number}
     */
    ManeuveringComputer.prototype.getLastPitchTarget = function () {
        return this._lastPitchTarget;
    };
    /**
     * Directly sets the pitch target (target spin around the X axis)
     * @param {Number} value
     */
    ManeuveringComputer.prototype.setPitchTarget = function (value) {
        this._pitchTarget = value;
    };
    /**
     * Returns the value of roll target (target spin around the Y axis) that has been last used in controlThrusters()
     * @returns {Number}
     */
    ManeuveringComputer.prototype.getLastRollTarget = function () {
        return this._lastRollTarget;
    };
    /**
     * Directly sets the roll target (target spin around the Y axis)
     * @param {Number} value
     */
    ManeuveringComputer.prototype.setRollTarget = function (value) {
        this._rollTarget = value;
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
     * @param {Boolean} [keepTargets=false] Whether to keep the speed and spin targets
     * after using them to control the thrusters
     */
    ManeuveringComputer.prototype.controlThrusters = function (dt, keepTargets) {
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
                yawAngle, pitchAngle, rollAngle,
                propulsion = this._spacecraft.getPropulsion();
        // we will add the needed burn levels together, so start from zero
        propulsion.resetThrusterBurn();
        // restrict turning according to current speed in restricted mode
        if (this._restricted && (speed !== 0.0)) {
            // restrict the limit if needed (convert from rad/sec to rad / ANGULAR_VELOCITY_MATRIX_DURATION ms)
            turningLimit = this.getRestrictedTurningLimit(speed);
            //apply the restricted limit
            yawTarget = Math.min(Math.max(yawTarget, -turningLimit), turningLimit);
            pitchTarget = Math.min(Math.max(pitchTarget, -turningLimit), turningLimit);
        }
        // controlling yaw
        yawAngle = Math.sign(turningMatrix[4]) * vec.angle2y(turningMatrix[4], turningMatrix[5]);
        if ((yawTarget - yawAngle) > turnThreshold) {
            propulsion.addThrusterBurnYawRight(Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(yawTarget - yawAngle, dt)));
        } else if ((yawTarget - yawAngle) < -turnThreshold) {
            propulsion.addThrusterBurnYawLeft(Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(yawAngle - yawTarget, dt)));
        }
        // controlling pitch
        pitchAngle = Math.sign(turningMatrix[6]) * vec.angle2x(turningMatrix[5], turningMatrix[6]);
        if ((pitchTarget - pitchAngle) > turnThreshold) {
            propulsion.addThrusterBurnPitchUp(Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(pitchTarget - pitchAngle, dt)));
        } else if ((pitchTarget - pitchAngle) < -turnThreshold) {
            propulsion.addThrusterBurnPitchDown(Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(pitchAngle - pitchTarget, dt)));
        }
        // controlling roll
        rollAngle = Math.sign(-turningMatrix[2]) * vec.angle2x(turningMatrix[0], turningMatrix[2]);
        if ((this._rollTarget - rollAngle) > turnThreshold) {
            propulsion.addThrusterBurnRollRight(Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(this._rollTarget - rollAngle, dt)));
        } else if ((this._rollTarget - rollAngle) < -turnThreshold) {
            propulsion.addThrusterBurnRollLeft(Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(rollAngle - this._rollTarget, dt)));
        }
        // controlling forward/reverse
        if ((this._speedTarget - speed) > speedThreshold) {
            propulsion.addThrusterBurnForward(Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(this._speedTarget - speed, dt)));
        } else if ((this._speedTarget - speed) < -speedThreshold) {
            propulsion.addThrusterBurnReverse(Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(speed - this._speedTarget, dt)));
        }
        // controlling horizontal drift
        if (this._assisted || (this._strafeTarget !== 0)) {
            speed = relativeVelocityMatrix[12];
            if ((this._strafeTarget - speed) > speedThreshold) {
                propulsion.addThrusterBurnRight(Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(this._strafeTarget - speed, dt)));
            } else if ((this._strafeTarget - speed) < -speedThreshold) {
                propulsion.addThrusterBurnLeft(Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(speed - this._strafeTarget, dt)));
            }
        }
        // controlling vertical drift
        if (this._assisted || (this._liftTarget !== 0)) {
            speed = relativeVelocityMatrix[14];
            if ((this._liftTarget - speed) > speedThreshold) {
                propulsion.addThrusterBurnUp(Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(this._liftTarget - speed, dt)));
            } else if ((this._liftTarget - speed) < -speedThreshold) {
                propulsion.addThrusterBurnDown(Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(speed - this._liftTarget, dt)));
            }
        }
        propulsion.updateVisuals();
        // keep the targets available for the latter part of the simulation step,
        // even if they are reset here
        this._lastYawTarget = this._yawTarget;
        this._lastPitchTarget = this._pitchTarget;
        this._lastRollTarget = this._rollTarget;
        this._lastStrafeTarget = this._strafeTarget;
        this._lastLiftTarget = this._liftTarget;
        // reset the targets, as new controls are needed from the pilot in the
        // next step to keep these targets up (e.g. continuously pressing the
        // key, moving the mouse or keeping the mouse displaced from center)
        if (!keepTargets) {
            this._yawTarget = 0;
            this._pitchTarget = 0;
            this._rollTarget = 0;
            this._strafeTarget = 0;
            this._liftTarget = 0;
        }
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
    JumpEngine.VELOCITY_TOLERANCE = 1;
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
     * @param {JumpEngineClass~ResourceParams} params 
     */
    JumpEngine.prototype.acquireResources = function (params) {
        this._class.acquireResources(params);
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
                this._spacecraft.setJumping(true);
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
                    this._spacecraft.setJumping(false);
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
        var directionVector, exp, physicalModel, matrix;
        // initiating jump in sequence
        if (this._state === JumpEngine.JumpState.NONE) {
            this._state = JumpEngine.JumpState.JUMPING_IN;
            this._timeLeft = this._class.getJumpInDuration();
            this._spacecraft.unlockManeuvering();
            this._spacecraft.setSpeedTarget(0);
            this._spacecraft.lockManeuvering();
            this._spacecraft.setJumping(true);
            exp = explosion.getExplosion();
            exp.init(
                    this._class.getJumpInExplosionClass(),
                    this._spacecraft.getPhysicalPositionMatrix(),
                    this._spacecraft.getPhysicalOrientationMatrix(),
                    mat.getRowC43(this._spacecraft.getPhysicalPositionMatrix()),
                    true,
                    true,
                    mat.IDENTITY4);
            exp.addToSceneNow(this._spacecraft.getVisualModel().getNode().getScene().getRootNode(), this._spacecraft.getSoundSource());
            this._originalScalingMatrix = mat.copy(this._spacecraft.getVisualModel().getScalingMatrix());
            physicalModel = this._spacecraft.getPhysicalModel();
            directionVector = mat.getRowB4(physicalModel.getOrientationMatrix());
            // calculate and set the starting velocity based on the set final velocity and total deceleration during the jump in sequence
            physicalModel.setVelocityv(vec.scaled3Aux(directionVector, this._class.getJumpInVelocity() + this._class.getJumpInDeceleration() * this._class.getJumpInDuration() * 0.001));
            physicalModel.setDragFactor(0);
            this._spacecraft.getVisualModel().setPositionM4(physicalModel.getPositionMatrix());
            matrix = this._spacecraft.getPositionMatrixInCameraSpace();
            this._spacecraft.getSoundSource().setPositionImmediate(
                    Math.round(matrix[12] * 10) * 0.1,
                    Math.round(matrix[13] * 10) * 0.1,
                    Math.round(matrix[14] * 10) * 0.1);
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
        var matrix, exp, physicalModel, speedTarget;
        switch (this._state) {
            case JumpEngine.JumpState.ALIGNING_VELOCITY:
                matrix = this._spacecraft.getRelativeVelocityMatrix();
                speedTarget = this._spacecraft.getTopSpeed() ? Math.min(this._spacecraft.getTopSpeed(), this._class.getPrepareVelocity()) : this._class.getPrepareVelocity();
                if ((Math.abs(matrix[12]) < JumpEngine.VELOCITY_TOLERANCE) &&
                        (Math.abs(matrix[14]) < JumpEngine.VELOCITY_TOLERANCE) &&
                        (Math.abs(matrix[13] - speedTarget) < JumpEngine.VELOCITY_TOLERANCE)) {
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
                    this._spacecraft.getPhysicalModel().setDragFactor(0);
                    // make sure the forward engines of the spacecraft are firing during the jump out sequence, despite the high velocity it will reach
                    this._spacecraft.unlockManeuvering();
                    this._spacecraft.setSpeedTarget(Number.MAX_VALUE);
                    this._spacecraft.lockManeuvering();
                    this._originalScalingMatrix = mat.copy(this._spacecraft.getVisualModel().getScalingMatrix());
                    this._spacecraft.handleEvent(SpacecraftEvents.JUMP_OUT_STARTED);
                }
                this._timeLeft -= dt;
                break;
            case JumpEngine.JumpState.JUMPING_OUT:
                // stretching the spacecraft along the Y axis (by a linearly incrasing factor)
                this._spacecraft.getVisualModel().setScaling(
                        this._originalScalingMatrix[0],
                        this._originalScalingMatrix[5] * (1 + (1 - this._timeLeft / this._class.getJumpOutDuration()) * (this._class.getJumpOutScaling() - 1)),
                        this._originalScalingMatrix[10]);
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
                            true,
                            mat.IDENTITY4);
                    exp.addToSceneNow(this._spacecraft.getVisualModel().getNode().getScene().getRootNode(), this._spacecraft.getSoundSource());
                    this._spacecraft.getVisualModel().setScale(this._originalScalingMatrix[0]);
                    this._spacecraft.setAway(true);
                    this._spacecraft.handleEvent(SpacecraftEvents.JUMPED_OUT);
                } else {
                    physicalModel = this._spacecraft.getPhysicalModel();
                    matrix = physicalModel.getOrientationMatrix();
                    physicalModel.applyForce(physicalModel.getMass() * this._class.getJumpOutAcceleration(), matrix[4], matrix[5], matrix[6], Math.min(dt, this._timeLeft));
                }
                this._timeLeft -= dt;
                break;
            case JumpEngine.JumpState.JUMPING_IN:
                // the stretching needs to be poperly calculated - do not allow negative timeLeft values
                if (this._timeLeft < 0) {
                    this._timeLeft = 0;
                } else {
                    physicalModel = this._spacecraft.getPhysicalModel();
                    matrix = physicalModel.getOrientationMatrix();
                    physicalModel.applyForce(physicalModel.getMass() * this._class.getJumpInDeceleration(), -matrix[4], -matrix[5], -matrix[6], Math.min(dt, this._timeLeft));
                }
                // stretching the spacecraft along the Y axis (by a linearly decreasing factor)
                this._spacecraft.getVisualModel().setScaling(
                        this._originalScalingMatrix[0],
                        this._originalScalingMatrix[5] * (1 + (this._timeLeft / this._class.getJumpInDuration()) * (this._class.getJumpInScaling() - 1)),
                        this._originalScalingMatrix[10]);
                // finishing the sequence if the time is up
                if (this._timeLeft <= 0) {
                    this._state = JumpEngine.JumpState.NONE;
                    this._spacecraft.unlockManeuvering();
                    this._spacecraft.setJumping(false);
                    this._spacecraft.handleEvent(SpacecraftEvents.ARRIVED);
                    this._spacecraft.resetDrag();
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
     * @param {ShieldClass~ResourceParams} params 
     */
    Shield.prototype.acquireResources = function (params) {
        this._class.acquireResources(params);
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
     * Directly set the integrity of the shield to specified ratio. Is smaller
     * than the current value, it will be taken as if the shield was hit.
     * @param {Number} ratio
     */
    Shield.prototype.setIntegrity = function (ratio) {
        var value = ratio * this._class.getCapacity();
        if (value < this._capacity) {
            this._timeSinceHit = 0;
        }
        this._capacity = value;
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
     * @param {Boolean} [isMultiGuest=false] Whether we are playing a multiplayer game as a guest (guests cannot modify shield or hull integrities,
     * just synchronize their values from the host)
     * @returns {Number} The amount of damage that should be dealt to the armor of the spacecraft (original minus the amount absorbed by the shield)
     */
    Shield.prototype.damage = function (damage, isMultiGuest) {
        var absorbed = Math.min(this._capacity, damage);
        this._timeSinceHit = 0;
        if (!isMultiGuest) {
            this._capacity -= absorbed;
        }
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
     * @param {Boolean} [isMultiGuest=false] Whether we are playing a multiplayer game as a guest (guests cannot modify shield or hull integrities,
     * just synchronize their values from the host)
     */
    Shield.prototype.simulate = function (dt, isMultiGuest) {
        var duration = this._class.getRechargeAnimationDuration();
        if (this._capacity < this._class.getCapacity()) {
            if (this._timeSinceHit < this._class.getRechargeDelay()) {
                this._timeSinceHit += dt;
                if (this._timeSinceHit >= this._class.getRechargeDelay()) {
                    this.startRecharge();
                }
            } else {
                // recharging
                if (!isMultiGuest) {
                    this._capacity = Math.min(this._class.getCapacity(), this._capacity + this._class.getRechargeRate() * dt * 0.001); // sec -> ms
                }
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
    _particlePool = pools.getPool(constants.PARTICLE_POOL_NAME, renderableObjects.Particle);
    _projectilePool = pools.getPool(constants.PROJECTILE_POOL_NAME, Projectile);
    _missilePool = pools.getPool(constants.MISSILE_POOL_NAME, Missile);
    _trailSegmentPool = pools.getPool(constants.TRAIL_SEGMENT_POOL_NAME, renderableObjects.TrailSegment);
    // caching configuration settings
    config.executeWhenReady(function () {
        _isSelfFireEnabled = config.getSetting(config.BATTLE_SETTINGS.SELF_FIRE);
        _maxCombatForwardSpeedFactor = config.getSetting(config.BATTLE_SETTINGS.MAX_COMBAT_FORWARD_SPEED_FACTOR);
        _maxCombatReverseSpeedFactor = config.getSetting(config.BATTLE_SETTINGS.MAX_COMBAT_REVERSE_SPEED_FACTOR);
        _maxCruiseForwardSpeedFactor = config.getSetting(config.BATTLE_SETTINGS.MAX_CRUISE_FORWARD_SPEED_FACTOR);
        _maxCruiseReverseSpeedFactor = config.getSetting(config.BATTLE_SETTINGS.MAX_CRUISE_REVERSE_SPEED_FACTOR);
        _showHitboxesForHitchecks = config.getSetting(config.BATTLE_SETTINGS.SHOW_HITBOXES_FOR_HITCHECKS);
        _luminosityFactorsArrayName = config.getSetting(config.GENERAL_SETTINGS.UNIFORM_LUMINOSITY_FACTORS_ARRAY_NAME);
        _groupTransformsArrayName = config.getSetting(config.GENERAL_SETTINGS.UNIFORM_GROUP_TRANSFORMS_ARRAY_NAME);
        _fireSoundStackingTimeThreshold = config.getSetting(config.BATTLE_SETTINGS.FIRE_SOUND_STACKING_TIME_THRESHOLD);
        _fireSoundStackingVolumeFactor = config.getSetting(config.BATTLE_SETTINGS.FIRE_SOUND_STACKING_VOLUME_FACTOR);
        graphics.executeWhenReady(handleGraphicsSettingsChanged);
        graphics.onSettingsChange(handleGraphicsSettingsChanged);
    });
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        FlightMode: FlightMode,
        ThrusterUse: ThrusterUse,
        handleDifficultySet: handleDifficultySet,
        Projectile: Projectile,
        Missile: Missile,
        Weapon: Weapon,
        MissileLauncher: MissileLauncher,
        TargetingComputer: TargetingComputer,
        Propulsion: Propulsion,
        JumpEngine: JumpEngine,
        Shield: Shield,
        ManeuveringComputer: ManeuveringComputer
    };
});