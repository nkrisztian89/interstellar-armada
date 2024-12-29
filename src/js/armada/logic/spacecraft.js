/**
 * Copyright 2014-2024 Krisztián Nagy
 * @file Implementation of the Spacecraft game-logic-level class
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used for Pi related constants
 * @param vec Vector operations are needed for several logic functions
 * @param mat Matrices are widely used for 3D simulation
 * @param application Used for file loading and logging functionality
 * @param managedGL Used for accessing shader variable types
 * @param egomModel Used for generating 3D models for hitboxes
 * @param physics Used for creating the physical model for spacecrafts and for constants
 * @param resources Used to access the loaded media (graphics and sound) resources
 * @param renderableObjects Used for creating visual models for spacecrafts
 * @param lights Used for creating light sources for spacecrafts
 * @param sceneGraph Used for creating the hitbox nodes
 * @param graphics Used to access graphics settings
 * @param audio Used for creating sound sources for spacecrafts
 * @param config Used to access game settings/configuration
 * @param strings Used for translation support
 * @param control Used to access control sound effects
 * @param networking Used to register kills for multiplayer games
 * @param classes Used to load and access the classes of Interstellar Armada
 * @param constants Used for light priority values
 * @param SpacecraftEvents Used for event handling
 * @param equipment Used for equipping spacecrafts
 * @param explosion Used to create the explosion for exploding spacecrafts
 */
define([
    "utils/utils",
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/managed-gl",
    "modules/egom-model",
    "modules/physics",
    "modules/media-resources",
    "modules/scene/renderable-objects",
    "modules/scene/lights",
    "modules/scene/scene-graph",
    "armada/graphics",
    "armada/audio",
    "armada/logic/classes",
    "armada/configuration",
    "armada/strings",
    "armada/control",
    "armada/networking",
    "armada/logic/constants",
    "armada/logic/SpacecraftEvents",
    "armada/logic/equipment",
    "armada/logic/explosion",
    "utils/polyfill"
], function (
        utils, vec, mat,
        application, managedGL, egomModel, physics, resources,
        renderableObjects, lights, sceneGraph,
        graphics, audio, classes, config, strings, control, networking,
        constants, SpacecraftEvents, equipment, explosion) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            /**
             * The string to be inserted between the name of the spacecraft and the index of the body of its physical model, when the name for
             * the corresponding hitbox model is created
             * @type String
             */
            HITBOX_BODY_MODEL_NAME = "hitBox",
            /**
             * A nonexistent color to set the original faction color uniform to when there is no faction color set
             * @type Number[4]
             */
            FACTION_COLOR_NONE = [-1, -1, -1, -1],
            /**
             * The name (without prefixes and suffixes) of the uniform variable that stores the original faction color (the color included
             * in the model file) of spacecraft models.
             * @type String
             */
            UNIFORM_ORIGINAL_FACTION_COLOR_NAME = "originalFactionColor",
            /**
             * The name (without prefixes and suffixes) of the uniform variable that stores the faction color of the team of the spacecraft
             * that should replace the original faction color when rendering the spacecraft model.
             * @type String
             */
            UNIFORM_REPLACEMENT_FACTION_COLOR_NAME = "replacementFactionColor",
            /**
             * The name (without prefixes and suffixes) of the uniform variable that determines the state (color and strength) of shield animation
             * @type String
             */
            UNIFORM_SHIELD_STATE_NAME = "shieldState",
            /**
             * The duration while the hum sound effects ramp to their normal volume after being started.
             * In seconds.
             * @type Number
             */
            HUM_SOUND_VOLUME_RAMP_DURATION = 0.020,
            /**
             * Used to create strings which display spacecraft equipment lists to the user
             * @type String
             */
            DEFAULT_EQUIPMENT_STRING_SEPARATOR = ", ",
            /**
             * Used to create strings which display spacecraft weapon range lists to the user
             * @type String
             */
            DEFAULT_WEAPON_RANGE_STRING_SEPARATOR = "/",
            /**
             * The damage indicators will be positioned using a second hitcheck towards the ship center if its hit position is
             * farther from the original hit position that the square root of this value. (i.e. if there was a large enough
             * offset given for the original hitcheck, e.g. when a missile explodes with a proximity fuse several meters away from the
             * ship, the damage indicator should not be positioned where the missile exploded, but on the ship surface, and in this
             * case the ship surface is far away enough from the original hit position that it will be used as the damage indicator
             * position)
             * @type Number
             */
            MINIMUM_DISTANCE_FOR_DAMAGE_INDICATOR_HITCHECK_SQUARED = 0.01,
            /**
             * @type Number
             */
            MULTI_HOST_DATA_LENGTH = constants.MULTI_HOST_DATA_LENGTH,
            /**
             * @type Number
             */
            MULTI_GUEST_DATA_LENGTH = constants.MULTI_GUEST_DATA_LENGTH,
            /**
             * The minimum amount of time that needs to pass between two playbacks of the collision sound effect for the same spacecraft,
             * in milliseconds
             * @type Number
             */
            MINIMUM_COLLISION_SOUND_INTERVAL = 250,
            // ------------------------------------------------------------------------------
            // private variables
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
             * name: type format) to use when creating visual models for spacecraft
             * @type Object
             */
            _parameterArrays = null,
            /**
             * A cached value of whether dynamic lights are turned on / available
             * @type Boolean
             */
            _dynamicLights = false,
            /**
             * Cached value of the configuration setting for hit zone visualization color.
             * @type Number[4]
             */
            _hitZoneColor,
            /**
             * Cached value of the configuration setting for the minimum distance at which fire sounds of a spacecraft should be stacked.
             * @type Number
             */
            _weaponFireSoundStackMinimumDistance,
            /**
             * Cached value of the configuratino settings of the factor for score awarded for kills
             * @type Number
             */
            _scoreFactorForKill,
            /**
             * Whether we are playing multiplayer as a guest (not host)
             * @type Boolean
             */
            _isMultiGuest = false;
    // #########################################################################
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
     * Set whether we are playing multiplayer as a guest (not host)
     * @param {Boolean} value
     */
    function setMultiGuest(value) {
        _isMultiGuest = value;
    }
    /**
     * Extract the squad name from the squad property value of a spacecraft entry
     * in a mission file. e.g. "alpha" -> "alpha", "alpha 5" -> "alpha"
     * @param {String} squadString
     * @returns {String}
     */
    function getSquadName(squadString) {
        var index, indexInSquad;
        index = squadString.lastIndexOf(" ");
        if (index < 0) {
            return squadString;
        }
        indexInSquad = squadString.substring(index + 1);
        if (isNaN(indexInSquad)) {
            return squadString;
        }
        return squadString.substring(0, index);
    }
    /**
     * Extract the squad index from the squad property value of a spacecraft entry
     * in a mission file. Returns zero if the passed string contains no index.
     * e.g. "alpha" -> 0, "alpha 5" -> 5
     * @param {String} squadString
     * @returns {Number}
     */
    function getSquadIndex(squadString) {
        var index, indexInSquad;
        index = squadString.lastIndexOf(" ");
        if (index < 0) {
            return 0;
        }
        indexInSquad = parseInt(squadString.substring(index + 1), 10);
        if (isNaN(indexInSquad)) {
            return 0;
        }
        return indexInSquad;
    }
    // #########################################################################
    /**
     * @class
     * A blinking light on a spacecraft, represented by a particle (dynamically animating) and an accompanied point light source
     * @param {BlinkerDescriptor} descriptor The descriptor object holding the information based on which the particle and light source can
     * be set up
     */
    function Blinker(descriptor) {
        /**
         * Holds the information needed to set up the particle and the light source when the blinker is added to a scene
         * @type BlinkerDescriptor
         */
        this._descriptor = descriptor;
        /**
         * Reference to the particle representing this blinker
         * @type Particle
         */
        this._visualModel = null;
        /**
         * Reference to the light source corresponding to this blinker
         * @type PointLightSource
         */
        this._lightSource = null;
    }
    /**
     * Creates the visual representation (particle and light source) to represent this blinker and adds it to a scene below the passed node
     * @param {RenderableNode} parentNode
     * @param {Boolean} addLightSource Whether to create and add the light source
     */
    Blinker.prototype.addToScene = function (parentNode, addLightSource) {
        this._visualModel = new renderableObjects.Particle(
                this._descriptor.getParticle().getModel(),
                this._descriptor.getParticle().getShader(),
                this._descriptor.getParticle().getTexturesOfTypes(this._descriptor.getParticle().getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                mat.translation4v(this._descriptor.getPosition()),
                this._descriptor.getParticleStates(),
                true,
                this._descriptor.getParticle().getInstancedShader(),
                0);
        parentNode.addSubnode(new sceneGraph.RenderableNode(this._visualModel, false, false, true));
        if (_dynamicLights && (addLightSource === true) && (this._descriptor.getIntensity() > 0)) {
            this._lightSource = new lights.PointLightSource(
                    this._descriptor.getLightColor(),
                    0,
                    this._descriptor.getPosition(),
                    [parentNode.getRenderableObject()],
                    this._descriptor.getLightStates(),
                    true);
            parentNode.getScene().addPointLightSource(this._lightSource, constants.BLINKER_LIGHT_PRIORITY);
        }
    };
    /**
     * Sets the animation state of the particle and the light source to represent the blinking state occurring after the passed amount of 
     * time from  the start
     * @param {Number} elapsedTime In milliseconds. Can be larger than the period of the blinking, the appropriate state will be calculated
     */
    Blinker.prototype.setTime = function (elapsedTime) {
        this._visualModel.setAnimationTime(elapsedTime);
        if (this._lightSource) {
            this._lightSource.setAnimationTime(elapsedTime);
        }
    };
    /**
     * Sets a random animation time within the period of the blinking for the blinker and returns it
     * @returns {Number}
     */
    Blinker.prototype.setRandomTime = function () {
        var time = Math.round(Math.random() * this._descriptor.getPeriod());
        this.setTime(time);
        return time;
    };
    // #########################################################################
    /**
     * @class Represents a specific spacecraft (fighter, warship, freighter, space
     * station etc.) in the game.
     * @param {SpacecraftClass} [spacecraftClass] The class of the spacecraft that
     * describes its general properties.
     * @param {String} [name] An optional name to identify this spacecraft by.
     * @param {Float32Array} [positionMatrix] The translation matrix describing
     * the initial position of the spacecraft.
     * @param {Float32Array} [orientationMatrix] The rotation matrix describing
     * the initial orientation of the spacecraft.
     * @param {String} [loadoutName] The name of the loadout to use to equip the
     * spacecraft. If not given, the spacecraft will not be equipped.
     * @param {Spacecraft[]} spacecraftArray The array of spacecrafts participating
     * in the same battle simulation as this one.
     * @param {Environment} [environment] The environment the spacecraft is situated in
     */
    function Spacecraft(spacecraftClass, name, positionMatrix, orientationMatrix, loadoutName, spacecraftArray, environment) {
        // ---------------------------------------
        // basic info
        /**
         * The class of this spacecraft that describes its general properties.
         * @type SpacecraftClass
         */
        this._class = null;
        /**
         * A unique string ID that can identify this spacecraft within a mission.
         * @type String
         */
        this._id = null;
        /**
         * An optional name by which this spacecraft can be identified.
         * @type String
         */
        this._name = null;
        /**
         * A cached value of the translated designation of this spacecraft that can be displayed to the user.
         * @type String
         */
        this._displayName = null;
        // ---------------------------------------
        // current state
        /**
         * Set to false when the spacecraft object is destroyed and cannot be used anymore. At this
         * point, some references from it have also been removed. (some are kept as might be required
         * by for example the wingmen status indicator on the HUD to display fallen wingmen with the
         * icon appropriate for their class)
         * @type Boolean
         */
        this._alive = true;
        /**
         * True when the spacecraft has jumped out from or has not jumped in yet to the current mission scene.
         * @type Boolean
         */
        this._away = false;
        /**
         * The number of hitpoints indicate the amount of damage the ship can take. Successful hits by
         * projectiles on the ship reduce the amount of hitpoints based on the damage value of the 
         * projectile, and when it hits zero, the spacecraft explodes.
         * @type Number
         */
        this._hitpoints = 0;
        /**
         * The maximum hitpoints of this spacecraft. Based on the amount of hitpoints its spacecraft class has,
         * but can be modified by other factors (such as difficulty)
         * @type Number
         */
        this._maxHitpoints = 0;
        // ---------------------------------------
        // visuals
        /**
         * The renderable node that represents this spacecraft in a scene.
         * @type ParameterizedMesh
         */
        this._visualModel = null;
        /**
         * The renderable object that is used as the parent for the visual
         * representation of the hitboxes of this craft.
         * @type RenderableNode
         */
        this._hitbox = null;
        /**
         * The blinking lights on the spacecraft
         * @type Blinker[]
         */
        this._blinkers = null;
        /**
         * The spot lights attached to the visual model of this spacecraft
         * @type SpotLightSource[]
         */
        this._spotLights = null;
        /**
         * The time value to be set for the blinkers when the spacecraft is added to the
         * scene. -1 means there is no specified time (left at 0 or randomly chosen based
         * on the parameters passed when adding to the scene)
         * @type Number
         */
        this._initialBlinkTime = -1;
        // ---------------------------------------
        // physics
        /**
         * The object representing the physical properties of this spacecraft.
         * Used to calculate the movement and rotation of the craft as well as
         * check for collisions and hits.
         * @type PhysicalObject
         */
        this._physicalModel = null;
        /**
         * A cache/reuse value for the 3D position vector of the physical model of the spacecraft to avoid
         * creating new arrays every time it is needed
         * @type Number[3]
         */
        this._physicalPositionVector = [0, 0, 0];
        /**
         * Cached value of the matrix representing the relative velocity (translation in m/s in the coordinate space of the spacecraft)
         * of the spacecraft.
         * @type Float32Array
         */
        this._relativeVelocityMatrix = mat.identity4();
        /**
         * Whether the currently stored relative velocity matrix value is up-to-date.
         * @type Boolean
         */
        this._relativeVelocityMatrixValid = false;
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
         * The cached calculated values of the scaling * orientation matrix.
         * @type Float32Array
         */
        this._scaledOriMatrix = mat.identity4();
        // ---------------------------------------
        // equipment
        /**
         * The list of weapons this spacecraft is equipped with.
         * @type Weapon[]
         */
        this._weapons = null;
        /**
         * The list of missile launchers (that are loaded with missiles) this spacecraft is equipped with.
         * @type MissileLauncher[]
         */
        this._missileLaunchers = [];
        /**
         * The index currently active missile launcher (which launches a missile when the launchMissile()
         * method is called)
         * -1 means no active launcher (e.g. no missiles equipped)
         * @type Number
         */
        this._activeMissileLauncherIndex = -1;
        /**
         * An array of all the missile classes of currently equipped missiles on this ship
         * @type MissileClass[]
         */
        this._missileClasses = [];
        /**
         * The targeting computer equipped on this spacecraft.
         * @type TargetingComputer
         */
        this._targetingComputer = null;
        /**
         * The propulsion system this spacecraft is equipped with.
         * @type Propulsion
         */
        this._propulsion = null;
        /**
         * The jump engine this spacecraft is equipped with.
         * @type JumpEngine
         */
        this._jumpEngine = null;
        /**
         * The shield this spacecraft is equipped with.
         * @type Shield
         */
        this._shield = null;
        /**
         * The maneuvering computer of this spacecraft that translates high
         * level maneuvering commands issued to this craft into thruster control.
         * @type ManeuveringComputer
         */
        this._maneuveringComputer = null;
        /**
         * While true, the spacecraft is not allowed to fire
         * @type Boolean
         */
        this._firingDisabled = false;
        /**
         * Set to true by the jump engine while the jump sequence is underway - the
         * spacecraft is not allowed to fire during this time
         * @type Boolean
         */
        this._isJumping = false;
        // ---------------------------------------
        // effects
        /**
         * The list of damage indicators that are currently visible on the spacecraft.
         * @type Explosion[]
         */
        this._activeDamageIndicators = [];
        /**
         * A reference to the explosion if the spacecraft is exploding
         * @type Explosion
         */
        this._explosion = null;
        // ---------------------------------------
        // event handling
        /**
         * The functions to call when the various spacecraft events happen (see SpacecraftEvents.js for possible types) to this spacecraft.
         * The keys are the event type IDs, the values are the lists of functions to call for each event.
         * @type Object.<String, Function[]>
         */
        this._eventHandlers = null;
        /**
         * An array of references to the spacecrafts that have this spacecraft targeted currently.
         * @type Spacecraft[]
         */
        this._targetedBy = null;
        /**
         * The data passed to the event handlers for the "being hit" event (to avoid creating a new object on each hit)
         * @type SpacecraftEvents~BeingHitData
         */
        this._hitData = {
            spacecraft: null,
            hitPosition: null,
            hullDamage: 0,
            missile: false
        };
        /**
         * @type SpacecraftEvents~AnySpacecraftHitData
         */
        this._anySpacecraftHitData = {
            spacecraft: this
        };
        // ---------------------------------------
        // affiliation
        /**
         * A reference to the team this spacecraft belongs to (governing who is friend or foe).
         * @type Team
         */
        this._team = null;
        /**
         * A string ID of the squad this spacecraft belongs to.
         * @type String
         */
        this._squad = null;
        /**
         * The index of this spacecraft that specifies its place within its squad.
         * @type Number
         */
        this._indexInSquad = 0;
        /**
         * This flag is true if this spacecraft is piloted by any human player (including the local player
         * or any others in a multiplayer game)
         * @type Boolean
         */
        this._piloted = false;
        // ---------------------------------------
        // sound
        /**
         * Sound clip used for playing the "hum" sound effect for this spacecraft.
         * @type SoundClip
         */
        this._humSoundClip = null;
        /**
         * The (original) volume of the hum sound effect (to be able to restore it after it is set to zero)
         * @type Number
         */
        this._humSoundVolume = 0;
        /**
         * Sound clip used for playing the collision sound effect when this spacecraft collides with a heavier one.
         * @type SoundClip
         */
        this._collisionSoundClip = null;
        /**
         * The time elapsed since we last started playing the collision sound for this spacecraft, in milliseconds
         * @type Number 
         */
        this._timeSinceCollisionSoundPlayed = 0;
        /**
         * The sound source used to position the sound effects beloning to this spacecraft in 3D sound (=camera) space
         * @type SoundSource
         */
        this._soundSource = audio.createSoundSource(0, 0, 0);
        // ---------------------------------------
        // statistics
        /**
         * The kill count for this spacecraft (current mission)
         * @type Number
         */
        this._kills = 0;
        /**
         * The current score for this spacecraft (without bonuses)
         * @type Number
         */
        this._score = 0;
        /**
         * The amount of damage dealt to enemies by this spacecraft during the current mission
         * @type Number
         */
        this._damageDealt = 0;
        /**
         * The amount of damage dealt to enemies by this spacecraft using missiles during the current mission
         * @type Number
         */
        this._missileDamageDealt = 0;
        /**
         * A counter for the (projectile weapon) shots fired during the current mission (for hit ratio calculation)
         * @type Number
         */
        this._shotsFired = 0;
        /**
         * A counter for the (projectile weapon) shots that hit an enemy during the current mission (for hit ratio calculation)
         * @type Number
         */
        this._hitsOnEnemies = 0;
        /**
         * A counter for the missiles launched during the current mission (for hit ratio calculation)
         * @type Number
         */
        this._missilesLaunched = 0;
        /**
         * A counter for the launched missiles that hit an enemy during the current mission (for hit ratio calculation)
         * @type Number
         */
        this._missileHitsOnEnemies = 0;
        // ---------------------------------------
        // other
        /**
         * The score value of the currently equipped sensor array
         * @type Number
         */
        this._sensorsScoreValue = 0;
        /**
         * The calculated cached value of how many score points is destroying this spacecraft worth (based on spacecraft class and equipment
         * score values)
         * @type Number
         */
        this._scoreValue = 0;
        /**
         * Negative, while the ship is not destoyed, set to zero upon start of destruction animation so
         * that deletion of the spacecraft can take place at the appropriate time
         * @type Number
         */
        this._timeElapsedSinceDestruction = -1;
        // ---------------------------------------
        // optimization
        /**
         * Cached factor to work with when asking for needed burn for speed change
         * @type Number
         */
        this._burnForSpeedChangeFactor = 0;
        /**
         * Cached factor to work with when asking for needed burn for angular velocity change
         * @type Number
         */
        this._burnForAngularVelocityChangeFactor = 0;
        /**
         * Cached value of the calculated top speed of the spacecraft, using the currently equipped
         * propulsion and the globally set drag coefficient (zero if there is no drag)
         * @type Number
         */
        this._topSpeed = 0;
        // ---------------------------------------
        // multiplayer
        /**
         * Whether we should set the "fired" flag for this spacecraft in the next game update message
         * (if we are host) or game control message (if we are guest)
         * @type Boolean
         */
        this._fired = false;
        /**
         * This flag is true if the local client is the guest in a multiplayer game and this spacecraft
         * is piloted by the local player
         * @type Boolean
         */
        this._guestPiloted = false;
        /**
         * This flag is true if this spacecraft is controlled by messages received through the network
         * in a multiplayer game (true for all player-controlled spacecrafts except the spacecraft of
         * the host on the host machine)
         * @type Boolean
         */
        this._multiControlled = false;
        /**
         * A reusable array that is updated (when queried) with the data the host sends in its game 
         * update message to the guests about this spacecraft in a multiplayer game 
         * @type Float32Array
         */
        this._multiHostData = new Float32Array(MULTI_HOST_DATA_LENGTH);
        /**
         * A reusable array that is updated (when queried) with the data the guest sends in its game
         * control message to the host about this spacecraft in a multiplayer game 
         * @type Float32Array
         */
        this._multiGuestData = new Float32Array(MULTI_GUEST_DATA_LENGTH);
        // initializing the properties based on the parameters
        if (spacecraftClass) {
            this._init(spacecraftClass, name, positionMatrix, orientationMatrix, loadoutName, spacecraftArray, environment);
        }
    }
    // initializer
    /**
     * Initializes the properties of the spacecraft. Used by the constructor
     * and the methods that load the data from an external source.
     * @param {SpacecraftClass} spacecraftClass
     * @param {String} [name]
     * @param {Float32Array} [positionMatrix]
     * @param {Float32Array} [orientationMatrix]
     * @param {String} [loadoutName]
     * @param {Spacecraft[]} [spacecraftArray]
     * @param {Environment} [environment]
     * @see Spacecraft
     */
    Spacecraft.prototype._init = function (spacecraftClass, name, positionMatrix, orientationMatrix, loadoutName, spacecraftArray, environment) {
        var i, blinkerDescriptors;
        this._class = spacecraftClass;
        this._name = name || "";
        this._alive = true;
        this._away = false;
        this._hitpoints = this._class.getHitpoints();
        this._maxHitpoints = this._class.getHitpoints();
        this._physicalModel = new physics.PhysicalObject(
                this._class.getMass(),
                positionMatrix || mat.IDENTITY4,
                orientationMatrix || mat.IDENTITY4,
                1,
                mat.IDENTITY4,
                this._class.getBodies(),
                this._class.getDragFactor());
        this._weapons = [];
        this._missileLaunchers = [];
        this._missileClasses = [];
        this._activeMissileLauncherIndex = -1;
        this._targetingComputer = new equipment.TargetingComputer(this, spacecraftArray, environment);
        this._firingDisabled = false;
        this._isJumping = false;
        this._maneuveringComputer = new equipment.ManeuveringComputer(this);
        this._blinkers = [];
        blinkerDescriptors = this._class.getBlinkerDescriptors();
        for (i = 0; i < blinkerDescriptors.length; i++) {
            this._blinkers.push(new Blinker(blinkerDescriptors[i]));
        }
        this._spotLights = [];
        // equipping the craft if a loadout name was given
        if (loadoutName) {
            this.equipLoadout(this._class.getLoadout(loadoutName));
        }
        this._targetedBy = [];
        this._eventHandlers = {};
        this._team = null;
        this._kills = 0;
        this._score = 0;
        this._damageDealt = 0;
        this._missileDamageDealt = 0;
        this._shotsFired = 0;
        this._hitsOnEnemies = 0;
        this._missilesLaunched = 0;
        this._missileHitsOnEnemies = 0;
        this._hitSounds = {};
        this._hitSoundTimestamp = 0;
        this._updateIDAndName();
        this._updateScoreValue();
        this._updateBurnNeedFactors();
    };
    /**
     * Updates the cached values for the spacecraft ID and display name based on the designation (name / squad) of the spacecraft.
     */
    Spacecraft.prototype._updateIDAndName = function () {
        this._id = (this._name || !this._squad) ?
                this._name :
                this._squad + " " + this._indexInSquad.toString();
        this._displayName = (this._name || !this._squad) ?
                this._name :
                strings.get(strings.SQUAD.PREFIX, this._squad, this._squad) + " " + this._indexInSquad.toString();
    };
    /**
     * Updates the cached values for faster calculation of needed burn levels (depends on propulsion and phyiscal model (mass))
     */
    Spacecraft.prototype._updateBurnNeedFactors = function () {
        this._burnForSpeedChangeFactor = this._propulsion ? (this._physicalModel.getMass() / this._propulsion.getThrust() * this._propulsion.getMaxMoveBurnLevel() * 1000) : 0;
        this._burnForAngularVelocityChangeFactor = this._propulsion ? (1 / physics.ANGULAR_VELOCITY_MATRIX_DURATION_S * this._physicalModel.getMass() / this._propulsion.getAngularThrust() * this._propulsion.getMaxTurnBurnLevel() * 1000) : 0;
    };
    // direct getters and setters
    /**
     * Returns whether the spacecraft object is alive (has valid data) - does not refer to the spacecraft itself, check hitpoints for that,
     * as the object stays alive for some time during the explosion
     * @returns {Boolean}
     */
    Spacecraft.prototype.isAlive = function () {
        return this._alive;
    };
    /**
     * Returns true when the spacecraft has jumped out from or has not jumped in yet to the current mission scene.
     * @returns {Boolean}
     */
    Spacecraft.prototype.isAway = function () {
        return this._away;
    };
    /**
     * Sets a new away state for the spacecraft (to be used when it jumps in/out to/from the battlefield)
     * @param {Boolean} value 
     */
    Spacecraft.prototype.setAway = function (value) {
        var p;
        if (this._away !== value) {
            this._away = value;
            if (this._away) {
                this.setTarget(null);
                p = this.getPhysicalPositionMatrix();
                if (this._visualModel && (!this._visualModel.isWireframe() || ((p[12] === 0) && (p[13] === 0) && (p[14] === 0)))) {
                    this._visualModel.getNode().hide();
                }
                if (this._physicalModel) {
                    this._physicalModel.reset();
                }
                if (this._humSoundClip) {
                    this._humSoundClip.stopPlaying(audio.SOUND_RAMP_DURATION);
                }
                if (this._propulsion) {
                    this._propulsion.resetThrusterBurn();
                    this._propulsion.simulate(0, this._soundSource, false);
                }
            } else {
                if (this._visualModel) {
                    this._visualModel.getNode().show();
                }
            }
        }
    };
    /**
     * Sets a new team affiliation for the spacecraft.
     * @param {Team} value The team to set.
     */
    Spacecraft.prototype.setTeam = function (value) {
        this._team = value;
    };
    /**
     * Returns the team this spacecraft belongs to.
     * @returns {Team}
     */
    Spacecraft.prototype.getTeam = function () {
        return this._team;
    };
    /**
     * Sets a new squad and related index for this spacecraft.
     * @param {String} squadName
     * @param {Number} indexInSquad
     */
    Spacecraft.prototype.setSquad = function (squadName, indexInSquad) {
        this._squad = squadName;
        this._indexInSquad = indexInSquad;
        this._updateIDAndName();
    };
    /**
     * Returns the string ID of the squad this spacecraft belongs to.
     * @returns {String}
     */
    Spacecraft.prototype.getSquad = function () {
        return this._squad;
    };
    /**
     * Returns the index of this spacecraft that specifies its place within its squad.
     * @returns {Number}
     */
    Spacecraft.prototype.getIndexInSquad = function () {
        return this._indexInSquad;
    };
    /**
     * Returns whether the passed spacecraft is friendly to this one.
     * @param {Spacecraft} spacecraft
     * @returns {Boolean}
     */
    Spacecraft.prototype.isFriendly = function (spacecraft) {
        return (spacecraft.getTeam() === this._team);
    };
    /**
     * Returns whether the passed spacecraft is hostile to this one.
     * @param {Spacecraft} spacecraft
     * @returns {Boolean}
     */
    Spacecraft.prototype.isHostile = function (spacecraft) {
        return (spacecraft.getTeam() !== this._team);
    };
    /**
     * Set whether this spacecraft is controlled through network messages (either control
     * messages by a guest or update messages by the host) in a multiplayer game
     * @param {Boolean} piloted Whether the spacecraft is piloted by the local player
     * @param {Number} index The index of this spacecraft in the spacecrafts array
     */
    Spacecraft.prototype.setAsMultiControlled = function (piloted, index) {
        this._guestPiloted = piloted;
        this._multiControlled = !piloted;
        this._multiGuestData[0] = index;
    };
    /**
     * Set whether this spacecraft is piloted by a human player (either the local player
     * or someone remote in a multiplayer game)
     * @param {Boolean} value
     */
    Spacecraft.prototype.setPiloted = function (value) {
        this._piloted = value;
    };
    /**
     * Whether this spacecraft is piloted by a human player (either the local player
     * or someone remote in a multiplayer game)
     * @returns {Boolean}
     */
    Spacecraft.prototype.isPiloted = function () {
        return this._piloted;
    };
    /**
     * Returns the object describing class of this spacecraft.
     * @returns {SpacecraftClass}
     */
    Spacecraft.prototype.getClass = function () {
        return this._class;
    };
    /**
     * Returns whether this spacecraft belongs to a fighter class.
     * @returns {Boolean}
     */
    Spacecraft.prototype.isFighter = function () {
        return this._class.isFighterClass();
    };
    /**
     * Returns the id of this spacecraft that can be used to identify it within a mission.
     * @returns {String}
     */
    Spacecraft.prototype.getID = function () {
        return this._id;
    };
    /**
     * Returns the name of this spacecraft that can be displayed to the user.
     * @returns {String}
     */
    Spacecraft.prototype.getDisplayName = function () {
        return this._displayName;
    };
    /**
     * Returns the current amount of hit points this spacecraft has left.
     * @returns {Number}
     */
    Spacecraft.prototype.getHitpoints = function () {
        return this._hitpoints;
    };
    /**
     * Returns the current hull integrity ratio of the spacecraft - a number between 0.0 (indicating zero
     * integrity at which the spacecraft is destroyed) and 1.0 (indicating full hull integrity).
     * @returns {Number}
     */
    Spacecraft.prototype.getHullIntegrity = function () {
        return this._hitpoints / this._maxHitpoints;
    };
    /**
     * Directly set the hull integrity ratio of the spacecraft.
     * @param {Number} ratio A number between 0.0 (indicating zero integrity at which the spacecraft is destroyed) 
     * and 1.0 (indicating full hull integrity)
     */
    Spacecraft.prototype.setHullIntegrity = function (ratio) {
        var newHitpoints = Math.min(Math.max(0, ratio), 1) * this._maxHitpoints, repair = newHitpoints > this._hitpoints;
        this._hitpoints = newHitpoints;
        if (repair) {
            this._updateDamageIndicators();
        }
    };
    /**
     * Returns whether the spacecraft has a shield equipped.
     * @returns {Boolean}
     */
    Spacecraft.prototype.hasShield = function () {
        return !!this._shield;
    };
    /**
     * Returns the name of the shield equipped on this spacecraft in a way that can be presented to the user (translated)
     * @returns {String}
     */
    Spacecraft.prototype.getShieldDisplayName = function () {
        return this._shield.getDisplayName();
    };
    /**
     * Returns the current shield integrity ratio of the spacecraft - a number between 0.0 (indicating a depleted shield) and 1.0 (indicating a fully charged shield).
     * @returns {Number}
     */
    Spacecraft.prototype.getShieldIntegrity = function () {
        return this._shield ? this._shield.getIntegrity() : 0;
    };
    /**
     * Directly set the shiled integrity ratio of the spacecraft. Setting it to lower than the current value will
     * count as if the shield has been hit
     * @param {Number} ratio A number between 0.0 (indicating a depleted shield) and 1.0 (indicating a fully charged shield).
     */
    Spacecraft.prototype.setShieldIntegrity = function (ratio) {
        if (this._shield) {
            this._shield.setIntegrity(Math.min(Math.max(0, ratio), 1));
        }
    };
    /**
     * Returns the current capacity of the equipped shield (if any)
     * @returns {Number}
     */
    Spacecraft.prototype.getShieldCapacity = function () {
        return this._shield ? this._shield.getCapacity() : 0;
    };
    /**
     * Returns the recharge rate (in capacity / second) of the equipped shield (if any)
     * @returns {Number}
     */
    Spacecraft.prototype.getShieldRechargeRate = function () {
        return this._shield ? this._shield.getRechargeRate() : 0;
    };
    /**
     * Returns the state of the shield to be used for visuals (color and animation progress)
     * @returns {Number[4]}
     */
    Spacecraft.prototype.getShieldState = function () {
        return this._shield ? this._shield.getState() : vec.NULL4;
    };
    /**
     * Starts recharging the shield of the spacecraft (skipping any recharge delay that might be due)
     */
    Spacecraft.prototype.rechargeShield = function () {
        this._shield.startRecharge();
    };
    /**
     * Multiplies the amount of current and maximum hitpoints of the spacecraft has by the passed factor.
     * @param {Number} factor
     */
    Spacecraft.prototype.multiplyMaxHitpoints = function (factor) {
        this._hitpoints *= factor;
        this._maxHitpoints *= factor;
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
    /**
     * Returns the explosion of this spacecraft (if it is being destroyed, otherwise just null)
     * @returns {Explosion}
     */
    Spacecraft.prototype.getExplosion = function () {
        return this._explosion;
    };
    // indirect getters and setters
    /**
     * Returns the name (ID) of the class of this spacecraft. (e.g. falcon or aries)
     * @returns {String}
     */
    Spacecraft.prototype.getClassName = function () {
        return this._class.getName();
    };
    /**
     * Returns the name (ID) of the type of this spacecraft. (e.g. interceptor or corvette)
     * @returns {String}
     */
    Spacecraft.prototype.getTypeName = function () {
        return this._class.getSpacecraftType().getName();
    };
    /**
     * Returns whether this spacecraft is supposed to be effective against the passed spacecraft, based on the spacecraft types.
     * @param {Spacecraft} otherCraft
     * @returns {Boolean}
     */
    Spacecraft.prototype.isGoodAgainst = function (otherCraft) {
        return this._class.getSpacecraftType().isGoodAgainst(otherCraft.getClass().getSpacecraftType());
    };
    /**
     * Returns whether this spacecraft is supposed to be particularly non-effective against the passed spacecraft, based on the spacecraft
     * types.
     * @param {Spacecraft} otherCraft
     * @returns {Boolean}
     */
    Spacecraft.prototype.isBadAgainst = function (otherCraft) {
        return this._class.getSpacecraftType().isBadAgainst(otherCraft.getClass().getSpacecraftType());
    };
    /**
     * Resets the drag factor of the physical model of the spacecraft to to its original value based on the spacecraft's class
     */
    Spacecraft.prototype.resetDrag = function () {
        return this._physicalModel.setDragFactor(this._class.getDragFactor());
    };
    /**
     * Returns the (first) object view associated with this spacecraft that has the given name.
     * @param {String} name
     * @returns {ObjectView}
     */
    Spacecraft.prototype.getView = function (name) {
        return this._class.getView(name);
    };
    /**
     * Re-enables firing if it is disabled.
     */
    Spacecraft.prototype.enableFiring = function () {
        this._firingDisabled = false;
    };
    /**
     * After calling this, rotating weapons will assume their default positions and calling fire() will have no effect (until firing
     * controls are re-enabled)
     */
    Spacecraft.prototype.disableFiring = function () {
        this._firingDisabled = true;
    };
    /**
     * Returns the whether the spacecraft has any weapons equipped.
     * @returns {Boolean}
     */
    Spacecraft.prototype.hasWeapons = function () {
        return this._weapons && (this._weapons.length > 0);
    };
    /**
     * Returns the array of weapon equipped on this spacecraft.
     * @returns {Weapon[]}
     */
    Spacecraft.prototype.getWeapons = function () {
        return this._weapons;
    };
    /**
     * Returns a text listing the weapons of the spacecraft in a way that can be displayed to the user (translated)
     * @param {String} [separator=DEFAULT_EQUIPMENT_STRING_SEPARATOR]
     * @returns {String}
     */
    Spacecraft.prototype.getWeaponsDisplayText = function (separator) {
        var i, result = "", weaponCounts = {}, weaponName, weaponNames;
        separator = separator || DEFAULT_EQUIPMENT_STRING_SEPARATOR;
        for (i = 0; i < this._weapons.length; i++) {
            weaponName = this._weapons[i].getDisplayName();
            if (!weaponCounts[weaponName]) {
                weaponCounts[weaponName] = 1;
            } else {
                weaponCounts[weaponName] += 1;
            }
        }
        weaponNames = Object.keys(weaponCounts);
        for (i = 0; i < weaponNames.length; i++) {
            result += ((i > 0) ? separator : "") + weaponCounts[weaponNames[i]] + " × " + weaponNames[i];
        }
        return result;
    };
    /**
     * Returns a text listing the ranges of the weapons of the spacecraft in a way that can be displayed to the user
     * @param {String} [separator=DEFAULT_WEAPON_RANGE_STRING_SEPARATOR]
     * @returns {String}
     */
    Spacecraft.prototype.getWeaponRangesDisplayText = function (separator) {
        separator = separator || DEFAULT_WEAPON_RANGE_STRING_SEPARATOR;
        var i, range, ranges = [];
        for (i = 0; i < this._weapons.length; i++) {
            range = this._weapons[i].getRange(0);
            if (ranges.indexOf(range) < 0) {
                ranges.push(range);
            }
        }
        return ranges.join(separator);
    };
    /**
     * Returns the sum of the firepower the weapons on this spacecraft have, that is, the total damage per second
     * they could do to a target with the passed armor rating. (not consider that it might be impossible to aim 
     * all weapons at the same target, depending their positioning, gimbal and the size of the target)
     * @param {Number} [armorRating=0]
     * @returns {Number}
     */
    Spacecraft.prototype.getFirepower = function (armorRating) {
        var result = 0, i;
        for (i = 0; i < this._weapons.length; i++) {
            result += this._weapons[i].getFirepower(armorRating);
        }
        return result;
    };
    /**
     * Returns the whether the spacecraft has any missiles equipped.
     * @returns {Boolean}
     */
    Spacecraft.prototype.hasMissiles = function () {
        var i;
        if (this._missileLaunchers) {
            for (i = 0; i < this._missileLaunchers.length; i++) {
                if (this._missileLaunchers[i].getMissileCount() > 0) {
                    return true;
                }
            }
        }
        return false;
    };
    /**
     * Returns a text listing the missiles of the spacecraft in a way that can be displayed to the user (translated)
     * @param {String} [separator=DEFAULT_EQUIPMENT_STRING_SEPARATOR]
     * @returns {String}
     */
    Spacecraft.prototype.getMissilesDisplayText = function (separator) {
        var i, result = "", missileCounts = {}, missileName, missileNames;
        separator = separator || DEFAULT_EQUIPMENT_STRING_SEPARATOR;
        for (i = 0; i < this._missileLaunchers.length; i++) {
            missileName = this._missileLaunchers[i].getDisplayName();
            if (!missileCounts[missileName]) {
                missileCounts[missileName] = this._missileLaunchers[i].getMissileCount();
            } else {
                missileCounts[missileName] += this._missileLaunchers[i].getMissileCount();
            }
        }
        missileNames = Object.keys(missileCounts);
        for (i = 0; i < missileNames.length; i++) {
            result += ((i > 0) ? separator : "") + missileCounts[missileNames[i]] + " × " + missileNames[i];
        }
        return result;
    };
    /**
     * Returns a text listing the ranges of the missile of the spacecraft in a way that can be displayed to the user
     * @param {String} [separator=DEFAULT_WEAPON_RANGE_STRING_SEPARATOR]
     * @returns {String}
     */
    Spacecraft.prototype.getMissileRangesDisplayText = function (separator) {
        separator = separator || DEFAULT_WEAPON_RANGE_STRING_SEPARATOR;
        var i, range, ranges = [];
        for (i = 0; i < this._missileLaunchers.length; i++) {
            range = this._missileLaunchers[i].getNominalRange().toFixed(0);
            if (ranges.indexOf(range) < 0) {
                ranges.push(range);
            }
        }
        return ranges.join(separator);
    };
    /**
     * Returns the sum of the firepower the missiles on this spacecraft have, that is, the total damage 
     * they could do to a target with the passed armor rating.
     * @param {Number} [armorRating=0]
     * @returns {Number}
     */
    Spacecraft.prototype.getMissileFirepower = function (armorRating) {
        var result = 0, i;
        for (i = 0; i < this._missileLaunchers.length; i++) {
            result += this._missileLaunchers[i].getFirepower(armorRating || 0);
        }
        return result;
    };
    /**
     * Returns whether this spacecraft object can be reused to represent a new
     * spacecraft.
     * @returns {Boolean}
     */
    Spacecraft.prototype.canBeReused = function () {
        return !this._alive;
    };
    /**
     * Returns the hit ratio (only counting hitting the enemy) during the current mission
     * @returns {Number}
     */
    Spacecraft.prototype.getHitRatio = function () {
        return this._shotsFired ? (this._hitsOnEnemies / this._shotsFired) : 0;
    };
    /**
     * Returns the number of enemy spacecrafts destroyed (last hit delivered) by this spacecraft during the current mission
     * @returns {Number}
     */
    Spacecraft.prototype.getKills = function () {
        return this._kills;
    };
    /**
     * Increases the number of kills for this spacecraft
     * @type Number
     */
    Spacecraft.prototype.gainKill = function () {
        this._kills++;
    };
    /**
     * Returns the (base) score this spacecraft acquired during the current mission
     * @returns {Number}
     */
    Spacecraft.prototype.getScore = function () {
        return this._score;
    };
    /**
     * Increases the score of this spacecraft by the passed amount
     * @param {Number} score
     */
    Spacecraft.prototype.gainScore = function (score) {
        this._score += score;
    };
    /**
     * Returns the amount of damage dealt to enemies by this spacecraft during the current mission
     * @returns {Number}
     */
    Spacecraft.prototype.getDamageDealt = function () {
        return this._damageDealt;
    };
    /**
     * Returns the amount of damage dealt to enemies by this spacecraft using missiles during the current mission
     * @returns {Number}
     */
    Spacecraft.prototype.getMissileDamageDealt = function () {
        return this._missileDamageDealt;
    };
    /**
     * Call if this spacecrafts deals damage to an enemy to update the stored total of damage dealt
     * @param {Number} damage The amount of damage dealt to the enemy
     * @param {Boolean} [byMissile=false] Whether the damage was dealt using a missile
     */
    Spacecraft.prototype.gainDamageDealt = function (damage, byMissile) {
        this._damageDealt += damage;
        if (byMissile) {
            this._missileDamageDealt += damage;
        }
    };
    /**
     * Number of missiles launched during the current mission
     * @returns Number
     */
    Spacecraft.prototype.getMissilesLaunched = function () {
        return this._missilesLaunched;
    };
    /**
     * Number of launched missiles that hit an enemy during the current mission
     * @returns Number
     */
    Spacecraft.prototype.getMissileHitsOnEnemies = function () {
        return this._missileHitsOnEnemies;
    };
    /**
     * Returns the ratio of missiles that hit an enemy out of all launched missiles during the current mission
     * @returns {Number}
     */
    Spacecraft.prototype.getMissileHitRatio = function () {
        return this._missileHitsOnEnemies / this._missilesLaunched;
    };
    /**
     * Returns how much score destroying this spacecraft should grant (completely, including dealing damage and scoring the final hit)
     * @returns {Number}
     */
    Spacecraft.prototype.getScoreValue = function () {
        return this._scoreValue;
    };
    /**
     * Sets a new position for the physical model of the spacecraft based on the passed 3D vector.
     * @param {Number[3]} vector
     */
    Spacecraft.prototype.setPhysicalPosition = function (vector) {
        this._physicalModel.setPosition(vector[0], vector[1], vector[2]);
    };
    /**
     * Returns the 4x4 translation matrix describing the position of this 
     * spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getPhysicalPositionMatrix = function () {
        return this._physicalModel.getPositionMatrix();
    };
    /**
     * Returns the 3D vector describing the position of this spacecraft in world space.
     * @returns {Number[3]}
     */
    Spacecraft.prototype.getPhysicalPositionVector = function () {
        this._physicalModel.copyPositionToVector(this._physicalPositionVector);
        return this._physicalPositionVector;
    };
    /**
     * Updates the orientation matrix for the physical model of the spacecraft.
     * @param {Float32Array} value A 4x4 matrix to copy the values from
     */
    Spacecraft.prototype.updatePhysicalOrientationMatrix = function (value) {
        this._physicalModel.updateOrientationMatrix(value);
    };
    /**
     * Returns the 4x4 rotation matrix describing the orientation of this 
     * spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getPhysicalOrientationMatrix = function () {
        return this._physicalModel.getOrientationMatrix();
    };
    /**
     * Returns the 4x4 scaling matrix describing the scaling of the meshes and
     * physical model representing this spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getPhysicalScalingMatrix = function () {
        return this._physicalModel.getScalingMatrix();
    };
    /**
     * Updates (recalculates) the cached value of the scaling * orientation matrix.
     */
    Spacecraft.prototype.updateScaledOriMatrix = function () {
        mat.setProd3x3SubOf4(this._scaledOriMatrix, this.getPhysicalScalingMatrix(), this.getPhysicalOrientationMatrix());
    };
    /**
     * Returns a 4x4 matrix describing the current scaling and rotation of this spacecraft.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getScaledOriMatrix = function () {
        return this._scaledOriMatrix;
    };
    /**
     * A shortcut method
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getPositionMatrixInCameraSpace = function () {
        return this._visualModel.getPositionMatrixInCameraSpace(this._visualModel.getNode().getScene().getCamera());
    };
    /**
     * Returns the 4x4 translation matrix describing the current velocity of this spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getPhysicalVelocityMatrix = function () {
        return this._physicalModel.getVelocityMatrix();
    };
    /**
     * Returns the 4x4 translation matrix describing the current velocity of this spacecraft in relative (model) space. Uses caching.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getRelativeVelocityMatrix = function () {
        if (!this._relativeVelocityMatrixValid) {
            mat.updateProdTranslationRotationInverse4(this._relativeVelocityMatrix,
                    this._physicalModel.getVelocityMatrix(),
                    this._physicalModel.getOrientationMatrix());
            this._relativeVelocityMatrixValid = true;
        }
        return this._relativeVelocityMatrix;
    };
    /**
     * Returns the 4x4 rotation matrix describing the current rotation of this spacecraft in relative (model) space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getTurningMatrix = function () {
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
     * Returns the maximum acceleration the spacecraft can achieve using its currently equipped propulsion system.
     * @returns {?Number} The acceleration, in m/s^2. Null, if no propulsion is equipped.
     */
    Spacecraft.prototype.getMaxAcceleration = function () {
        return this._propulsion ?
                this._propulsion.getThrust() / this._physicalModel.getMass() :
                null;
    };
    /**
     * Returns the maximum forward speed the spacecraft can achieve in "combat" flight mode using its currently equipped propulsion system.
     * @returns {Number} The speed, in m/s. Zero, if no propulsion is equipped.
     */
    Spacecraft.prototype.getMaxCombatSpeed = function () {
        return (this.getMaxAcceleration() * config.getSetting(config.BATTLE_SETTINGS.MAX_COMBAT_FORWARD_SPEED_FACTOR)) || 0;
    };
    /**
     * Returns the maximum angular acceleration the spacecraft can achieve using its currently equipped propulsion system.
     * @returns {Number} The angular acceleration, in rad/s^2. Zero, if no propulsion is equipped.
     */
    Spacecraft.prototype.getMaxAngularAcceleration = function () {
        return this._propulsion ?
                this._propulsion.getAngularThrust() / this._physicalModel.getMass() :
                0;
    };
    /**
     * Returns the maximum turn rate the spacecraft can achieve in "combat" flight mode using its currently equipped propulsion system.
     * @returns {Number} The turn rate, in degrees/s. Zero, if no propulsion is equipped.
     */
    Spacecraft.prototype.getMaxCombatTurnRate = function () {
        return (this.getMaxAngularAcceleration() * utils.DEG * config.getSetting(config.BATTLE_SETTINGS.TURN_ACCELERATION_DURATION_S)) || 0;
    };
    /**
     * Returns the maximum thruster move burn level for the current propulsion
     * @returns {Number}
     */
    Spacecraft.prototype.getMaxThrusterMoveBurnLevel = function () {
        return this._propulsion ? this._propulsion.getMaxMoveBurnLevel() : 0;
    };
    /**
     * Returns the maximum thruster turn burn level for the current propulsion
     * @returns {Number}
     */
    Spacecraft.prototype.getMaxThrusterTurnBurnLevel = function () {
        return this._propulsion ? this._propulsion.getMaxTurnBurnLevel() : 0;
    };
    /**
     * Returns the maximum turning rate the spacecraft can keep at the passed
     * speed while providing the needed centripetal force with its thrusters
     * to keep itself on a circular path.
     * @param {Number} speed The speed in m/s.
     * @returns {Number} The turning rate in rad/s.
     */
    Spacecraft.prototype.getMaxTurnRateAtSpeed = function (speed) {
        var sinTurn = Math.abs(this._propulsion.getThrust() / (this._physicalModel.getMass() * speed));
        return (sinTurn <= 1) ? Math.asin(sinTurn) : Number.MAX_VALUE;
    };
    /**
     * Returns the managed textures to be used for rendering the hitboxes of this spacecraft, in an associated array, by texture types.
     * @returns {Object.<String, ManagedTexture>}
     */
    Spacecraft.prototype.getHitboxTextures = function () {
        var
                textureTypes = graphics.getManagedShader(config.getSetting(config.BATTLE_SETTINGS.HITBOX_SHADER_NAME)).getTextureTypes(),
                textureResource = graphics.getTexture(config.getSetting(config.BATTLE_SETTINGS.HITBOX_TEXTURE_NAME), {types: textureTypes});
        return textureResource.getManagedTexturesOfTypes(textureTypes, graphics.getTextureQualityPreferenceList());
    };
    /**
     * Returns the thruster burn level that is needed to produce the passed difference in speed using the current propulsion system for the
     * given duration.
     * @param {Number} speedDifference The speed difference that needs to be produced, in m/s.
     * @param {Number} duration The length of time during which the difference needs to be produced, in milliseconds
     * @returns {Number}
     */
    Spacecraft.prototype.getNeededBurnForSpeedChange = function (speedDifference, duration) {
        return speedDifference * this._burnForSpeedChangeFactor / duration;
    };
    /**
     * Returns the thruster burn level that is needed to produce the passed difference in angular velocity using the current propulsion 
     * system for the given duration.
     * @param {Number} angularVelocityDifference The angular velocity difference that needs to be produced, in rad / physics.ANGULAR_VELOCITY_MATRIX_DURATION ms !!.
     * * @param {Number} duration The length of time during which the difference needs to be produced, in milliseconds
     * @returns {Number}
     */
    Spacecraft.prototype.getNeededBurnForAngularVelocityChange = function (angularVelocityDifference, duration) {
        return angularVelocityDifference * this._burnForAngularVelocityChangeFactor / duration;
    };
    /**
     * Calculated top speed of the spacecraft, using the currently equipped
     * propulsion and the globally set drag coefficient (zero if there is no drag)
     * @returns {Number}
     */
    Spacecraft.prototype.getTopSpeed = function () {
        return this._topSpeed;
    };
    // methods
    /**
     * Initializes the properties of this spacecraft based on the data stored
     * in the passed JSON object.
     * @param {Object} dataJSON
     * @param {Spacecraft[]} [spacecraftArray=null] The array of spacecrafts
     * participating in the same battle.
     * @param {Environment} [environment] The environment the spacecraft is 
     * situated in
     */
    Spacecraft.prototype.loadFromJSON = function (dataJSON, spacecraftArray, environment) {
        var loadout;
        this._init(
                classes.getSpacecraftClass(dataJSON.class),
                dataJSON.name,
                dataJSON.position ? mat.translation4v(dataJSON.position) : null,
                mat.rotation4FromJSON(dataJSON.rotations),
                undefined,
                spacecraftArray,
                environment);
        if (dataJSON.squad) {
            this.setSquad(getSquadName(dataJSON.squad), getSquadIndex(dataJSON.squad));
        }
        // equipping the created spacecraft
        if (dataJSON.loadout) {
            // if a loadout is referenced, look up that loadout and equip according to that
            this.equipLoadout(this._class.getLoadout(dataJSON.loadout));
        } else if (dataJSON.equipment) {
            // if a custom loadout is specified, simply create it from the given object, and equip that
            loadout = new classes.Loadout(dataJSON.equipment, null, dataJSON.equipment.basedOn ? this._class.getLoadout(dataJSON.equipment.basedOn) : null);
            this.equipLoadout(loadout);
            // if there is no equipment specified, attempt to load the default loadout
        } else if (this._class.getDefaultLoadout()) {
            this.equipLoadout(this._class.getLoadout(this._class.getDefaultLoadout()));
        }
        if (dataJSON.away) {
            this.setAway(true);
        }
        this._initialBlinkTime = (dataJSON.initialBlinkTime !== undefined) ? dataJSON.initialBlinkTime : -1;
    };
    /**
     * Function to reset state before starting to execute the control actions triggered in the current simulation step.
     */
    Spacecraft.prototype.prepareForControl = function () {
        this._maneuveringComputer.prepareForControl();
    };
    /**
     * Returns whether the maneuvering computer is currently locked (not accepting new maneuvering commands)
     * @returns {Boolean}
     */
    Spacecraft.prototype.isManeuveringLocked = function () {
        return this._maneuveringComputer.isLocked();
    };
    /**
     * Locks maneuvering controls.
     */
    Spacecraft.prototype.lockManeuvering = function () {
        this._maneuveringComputer.setLocked(true);
    };
    /**
     * Unlocks maneuvering controls.
     */
    Spacecraft.prototype.unlockManeuvering = function () {
        this._maneuveringComputer.setLocked(false);
    };
    /**
     * Returns a string representation of the current flight mode set for this
     * craft. (free / combat / cruise)
     * @returns {String}
     */
    Spacecraft.prototype.getFlightMode = function () {
        return this._maneuveringComputer.getFlightMode();
    };
    /**
     * Switches to the given / next available flight mode.
     * @param {String} [flightMode]
     * @returns {Boolean} Whether the flight mode change happened.
     */
    Spacecraft.prototype.changeFlightMode = function (flightMode) {
        return this._maneuveringComputer.changeFlightMode(flightMode);
    };
    /**
     * Toggles between free and combat flight modes
     * @returns {Boolean} Whether the flight mode change happened.
     */
    Spacecraft.prototype.toggleFlightAssist = function () {
        return this._maneuveringComputer.toggleFlightAssist();
    };
    /**
     * Toggles between cruise and combat flight modes
     * @returns {Boolean} Whether the flight mode change happened.
     */
    Spacecraft.prototype.toggleCruise = function () {
        return this._maneuveringComputer.toggleCruise();
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
     * Control command for the maneuvering computer to toggle speed holding mode.
     * @returns {Boolean} Whether the speed holding mode has changed
     */
    Spacecraft.prototype.toggleSpeedHolding = function () {
        return this._maneuveringComputer.toggleSpeedHolding();
    };
    /**
     * Sets the speed holding mode of the maneuvering computer to the passed value.
     * @param {Boolean} value
     */
    Spacecraft.prototype.setSpeedHolding = function (value) {
        this._maneuveringComputer.setSpeedHolding(value);
    };
    /**
     * Control command for the maneuvering computer to reset the target speed to zero.
     */
    Spacecraft.prototype.resetSpeed = function () {
        this._maneuveringComputer.resetSpeed();
    };
    /**
     * Sets a new forward/reverse speed target in non-free flight modes.
     * @param {Number} value A positive number means a forward target, a negative one a reverse target, in m/s.
     */
    Spacecraft.prototype.setSpeedTarget = function (value) {
        this._maneuveringComputer.setSpeedTarget(value);
    };
    /**
     * Return the currently set target for forward (positive) / reverse (negative) speed, in m/s. Only meaningful in assisted flight modes.
     * @returns {Number}
     */
    Spacecraft.prototype.getSpeedTarget = function () {
        return this._maneuveringComputer.getSpeedTarget();
    };
    /**
     * Returns whether the spacecraft has a meaningful speed target in its current flight mode.
     * @returns {Boolean}
     */
    Spacecraft.prototype.hasSpeedTarget = function () {
        return this._maneuveringComputer.hasSpeedTarget();
    };
    /**
     * If the current flight mode imposes a speed limit, returns it. (in m/s) Otherwise returns undefined.
     * @returns {Number}
     */
    Spacecraft.prototype.getMaxSpeed = function () {
        return this._maneuveringComputer.getMaxSpeed();
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
        var
                phyModel =
                resources.getOrAddModel(
                        egomModel.cuboidModel(
                                HITBOX_BODY_MODEL_NAME,
                                1,
                                1,
                                1,
                                _hitZoneColor)),
                hitZoneMesh = new renderableObjects.ShadedLODMesh(
                        phyModel.getEgomModel(),
                        graphics.getManagedShader(config.getSetting(config.BATTLE_SETTINGS.HITBOX_SHADER_NAME)),
                        this.getHitboxTextures(),
                        mat.translation4m4(this._class.getBodies()[index].getPositionMatrix()),
                        this._class.getBodies()[index].getOrientationMatrix(),
                        mat.scaling4(
                                this._class.getBodies()[index].getWidth(),
                                this._class.getBodies()[index].getHeight(),
                                this._class.getBodies()[index].getDepth()),
                        false);
        hitZoneMesh.setUniformValueFunction(renderableObjects.UNIFORM_COLOR_NAME, function () {
            return _hitZoneColor;
        });
        hitZoneMesh.setUniformValueFunction(_groupTransformsArrayName, function () {
            return graphics.getGroupTransformIdentityArray();
        });
        this._hitbox.addSubnode(new sceneGraph.RenderableNode(hitZoneMesh, false));
    };
    /**
     * Returns the renderable node storing the hitbox models for this spacecraft.
     * @returns {RenerableNode}
     */
    Spacecraft.prototype.getHitbox = function () {
        return this._hitbox;
    };
    /**
     * @param {Boolean} hitbox
     * @param {SpacecraftClass~ResourceParams} params
     */
    Spacecraft.prototype.acquireResources = function (hitbox, params) {
        application.log_DEBUG("Requesting resources for spacecraft (" + this._class.getName() + ")...", 2);
        if (hitbox) {
            graphics.getShader(config.getSetting(config.BATTLE_SETTINGS.HITBOX_SHADER_NAME));
            graphics.getTexture(config.getSetting(config.BATTLE_SETTINGS.HITBOX_TEXTURE_NAME));
        }
        this._class.acquireResources(params);
        resources.executeWhenReady(function () {
            if (this.isAlive()) {
                this._physicalModel.setScaling(this._class.getModel().getScale());
            }
        }.bind(this));
    };
    /**
     * @typedef {Object} Spacecraft~Supplements
     * @property {Boolean} hitboxes
     * @property {Boolean} weapons
     * @property {Boolean} missilesInLaunchers Whether to add the loaded missiles
     * into the launch tubes (at least the first one for each tube)
     * @property {Boolean} allMissilesInLaunchers Whether to add the additional
     * loaded missiles behind the first one into the launch tubes (for displaying
     * missile loadout in wireframe)
     * @property {Boolean} thrusterParticles
     * @property {Boolean} thrusterLightSources
     * @property {Boolean} projectileResources
     * @property {Boolean} missileResources
     * @property {Boolean} explosion
     * @property {Boolean} damageIndicators
     * @property {Boolean} cameraConfigurations
     * @property {Boolean} lightSources
     * @property {Boolean} blinkers
     * @property {Boolean} jumpEngine
     * @property {Boolean} shield
     * @property {Boolean} sound
     * @property {Boolean} [self=true]
     */
    /**
     * @typedef {Object} Spacecraft~AddToSceneParams
     * @property {Boolean} [skipResources=false] If true, resources will not be acquired
     * @property {String} [shaderName]
     * @property {Boolean} [skipTextures=false]
     * @property {Float32Array} [positionMatrix]
     * @property {Float32Array} [orientationMatrix]
     * @property {Float32Array} [scalingMatrix]
     * @property {Boolean} [replaceVisualModel=false] If true, the visual model of the spacecraft will be replaced by the newly created one, 
     * if it exists.
     * @property {Number[4]} [factionColor] If given, the faction color of the spacecraft will be replaced by this color (otherwise it is
     * based on the team's faction color)
     * @property {ParameterizedMesh} [visualModel] If a visual model for the spacecraft itself is not created (self from supplements is 
     * false), a visual model can be specified in this parameter that will be used instead of the existing one (when adding supplements)
     * @property {Boolean} [randomAnimationTime=false] If true, the blinking lights on the spacecraft will be set to a random animation
     * state (the same state for all of them)
     * @property {Number} [smallestSizeWhenDrawn]
     */
    /**
     * Adds the spacecraft's visual representation to a scene, assuming that its resources have already been loaded.
     * @param {Scene} scene See addToScene()
     * @param {Number} [lod] See addToScene()
     * @param {Boolean} [wireframe=false] See addToScene()
     * @param {Spacecraft~Supplements} addSupplements See addToScene()
     * @param {Spacecraft~AddToSceneParams} params See addToScene()
     * @param {logic~addToSceneCallback} [callback] See addToScene()
     * @param {logic~addToSceneCallback} [weaponCallback] See addToScene()
     * @param {logic~addToSceneCallback} [missileCallback] See addToScene()
     */
    Spacecraft.prototype.addToSceneNow = function (scene, lod, wireframe, addSupplements, params, callback, weaponCallback, missileCallback) {
        var i, shader, node, exp, lightSources, originalFactionColor, replacementFactionColor, visualModel, light, emittingObjects, animationTime, weaponParams, missileParams;
        if (!this._class) {
            application.log_DEBUG("WARNING! Cannot add spacecraft to scene because it has already been destroyed!");
            return;
        }
        application.log_DEBUG("Adding spacecraft (" + this._class.getName() + ") to scene...", 2);
        if (addSupplements.self !== false) {
            shader = params.shaderName ? graphics.getManagedShader(params.shaderName) : this._class.getShader();
            visualModel = new renderableObjects.ParameterizedMesh(
                    this._class.getModel(),
                    shader,
                    params.skipTextures ? {} : this._class.getTexturesOfTypes(shader.getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                    params.positionMatrix || this._physicalModel.getPositionMatrix(),
                    params.orientationMatrix || this._physicalModel.getOrientationMatrix(),
                    params.scalingMatrix || mat.scaling4(this._class.getModel().getScale()),
                    (wireframe === true),
                    lod,
                    params.smallestSizeWhenDrawn,
                    _parameterArrays,
                    params.replaceVisualModel ? null : this._visualModel);
            if (this._name) {
                visualModel.setName(this._name);
            }
            originalFactionColor = this._class.getFactionColor() || FACTION_COLOR_NONE;
            replacementFactionColor = params.factionColor || (this._team && this._team.getColor()) || originalFactionColor;
            visualModel.setUniformValueFunction(UNIFORM_ORIGINAL_FACTION_COLOR_NAME, function () {
                return originalFactionColor;
            });
            visualModel.setUniformValueFunction(UNIFORM_REPLACEMENT_FACTION_COLOR_NAME, function () {
                return replacementFactionColor;
            });
            visualModel.setUniformValueFunction(UNIFORM_SHIELD_STATE_NAME, function () {
                return this.getShieldState();
            }.bind(this));
            if (!this._visualModel || params.replaceVisualModel) {
                // setting the starting values of the parameter arrays
                // setting an identity transformation for all transform groups
                if (visualModel.hasParameterArray(_groupTransformsArrayName)) {
                    visualModel.setParameterArray(_groupTransformsArrayName, graphics.getGroupTransformIdentityArray());
                }
                // setting the default luminosity for all luminosity groups
                if (graphics.areLuminosityTexturesAvailable() && visualModel.hasParameterArray(_luminosityFactorsArrayName)) {
                    visualModel.setParameterArray(_luminosityFactorsArrayName, this._class.getDefaultGroupLuminosityFactors());
                }
                this._visualModel = visualModel;
            }
            node = scene.addObject(visualModel);
            if (params.visualModel) {
                application.showError("Attempting to specify a visual model for the Spacecraft.addToScene() operation while a new one is also created!", application.ErrorSeverity.MINOR);
            }
        } else {
            visualModel = params.visualModel || this._visualModel;
            node = visualModel.getNode();
        }
        // visualize physical model (hitboxes)
        if (addSupplements.hitboxes === true) {
            shader = shader || (params.shaderName ? graphics.getManagedShader(params.shaderName) : this._class.getShader());
            // add the parent objects for the hitboxes
            this._hitbox = new sceneGraph.RenderableNode(new renderableObjects.ContainerObject(shader), false);
            // add the models for the hitboxes themselves
            for (i = 0; i < this._class.getBodies().length; i++) {
                this._addHitboxModel(i);
            }
            this._hitbox.hide();
            node.addSubnode(this._hitbox);
        }
        // add the weapons
        if (addSupplements.weapons === true) {
            weaponParams = {shaderName: params.shaderName, skipTextures: params.skipTextures};
            for (i = 0; i < this._weapons.length; i++) {
                this._weapons[i].addToSceneNow(node, lod, wireframe, weaponParams, weaponCallback);
            }
        }
        // add missiles into the launchers
        if (addSupplements.missilesInLaunchers === true) {
            missileParams = {shaderName: params.shaderName, skipTextures: params.skipTextures, allMissiles: addSupplements.allMissilesInLaunchers};
            for (i = 0; i < this._missileLaunchers.length; i++) {
                this._missileLaunchers[i].addToSceneNow(node, lod, wireframe, missileParams, missileCallback);
            }
        }
        // add the thruster particles
        if (addSupplements.thrusterParticles === true) {
            if (this._propulsion) {
                this._propulsion.addToScene(node, addSupplements.thrusterLightSources);
            }
        }
        // add projectile resources
        if (addSupplements.projectileResources === true) {
            for (i = 0; i < this._weapons.length; i++) {
                this._weapons[i].addProjectileResourcesToScene(scene);
            }
        }
        // add missile resources
        if (addSupplements.missileResources === true) {
            for (i = 0; i < this._missileLaunchers.length; i++) {
                this._missileLaunchers[i].addMissileResourcesToScene(scene);
            }
        }
        // add projectile resources
        if (addSupplements.explosion === true) {
            exp = new explosion.Explosion(this._class.getExplosionClass(), mat.IDENTITY4, mat.IDENTITY4, vec.NULL3, true);
            exp.addResourcesToScene(scene);
        }
        // add comera configurations
        if (addSupplements.cameraConfigurations === true) {
            this._addCameraConfigurationsForViews();
        }
        // add light sources
        if (_dynamicLights && addSupplements.lightSources === true) {
            lightSources = this._class.getLightSources();
            this._spotLights.length = 0;
            emittingObjects = [visualModel];
            for (i = 0; i < lightSources.length; i++) {
                if (lightSources[i].spotDirection) {
                    // only add spotlights for piloted spacecraft
                    if (this._piloted) {
                        light = new lights.SpotLightSource(lightSources[i].color, lightSources[i].intensity, lightSources[i].position, lightSources[i].spotDirection, lightSources[i].spotCutoffAngle, lightSources[i].spotFullIntensityAngle, visualModel);
                        this._spotLights.push(light);
                        scene.addSpotLightSource(light);
                    }
                } else {
                    light = new lights.PointLightSource(lightSources[i].color, lightSources[i].intensity, lightSources[i].position, emittingObjects);
                    scene.addPointLightSource(light, constants.SPACECRAFT_LIGHT_PRIORITY);
                }
            }
        }
        // add blinking lights
        if (addSupplements.blinkers === true) {
            for (i = 0; i < this._blinkers.length; i++) {
                this._blinkers[i].addToScene(node, addSupplements.lightSources);
                if (this._initialBlinkTime >= 0) {
                    this._blinkers[i].setTime(this._initialBlinkTime);
                } else {
                    if (params.randomAnimationTime) {
                        if (i === 0) {
                            animationTime = this._blinkers[i].setRandomTime();
                        } else {
                            this._blinkers[i].setTime(animationTime);
                        }
                    }
                }
            }
        }
        // if the spacecraft is away, hide the visuals
        if (this._away) {
            this._away = false;
            this.setAway(true);
        }
        if (callback) {
            callback(visualModel);
        }
    };
    /**
     * Creates and adds the renderable objects to represent this spacecraft to
     * the passed scene.
     * @param {Scene} scene The scene to which the objects will be added.
     * @param {Number} [lod] The level of detail to use for adding the models.
     * If not given, all available LODs will be added for dynamic LOD rendering.
     * @param {Boolean} [wireframe=false] Whether to add the models in wireframe
     * drawing mode (or in solid).
     * @param {Spacecraft~Supplements} addSupplements An object describing what additional
     * supplementary objects / resources to add to the scene along with the
     * basic representation of the ship. Contains boolean properties for each
     * possible supplement, marking if that particular supplement should be 
     * added.
     * @param {Spacecraft~AddToSceneParams} params
     * @param {logic~addToSceneCallback} [callback]
     * @param {logic~addToSceneCallback} [weaponCallback]
     * @param {logic~addToSceneCallback} [missileCallback]
     */
    Spacecraft.prototype.addToScene = function (scene, lod, wireframe, addSupplements, params, callback, weaponCallback, missileCallback) {
        var i, blinkerDescriptors, weaponParams, missileParams, resourceParams;
        // getting resources
        if (!params.skipResources) {
            this.acquireResources((addSupplements.hitboxes === true), {
                overrideShaderName: params.shaderName,
                omitTextures: params.skipTextures,
                explosion: addSupplements.explosion,
                damageIndicators: addSupplements.damageIndicators,
                blinkers: addSupplements.blinkers,
                sound: addSupplements.sound
            });
            if (addSupplements.weapons === true) {
                weaponParams = {overrideShaderName: params.shaderName, omitTextures: params.skipTextures, projectileResources: addSupplements.projectileResources, sound: addSupplements.sound};
                for (i = 0; i < this._weapons.length; i++) {
                    this._weapons[i].acquireResources(weaponParams);
                }
            }
            if (addSupplements.missileResources === true) {
                missileParams = {overrideShaderName: params.shaderName, omitTextures: params.skipTextures, missileOnly: false, sound: addSupplements.sound, trail: true};
                for (i = 0; i < this._missileLaunchers.length; i++) {
                    this._missileLaunchers[i].acquireResources(missileParams);
                }
            } else if (addSupplements.missilesInLaunchers === true) {
                missileParams = {overrideShaderName: params.shaderName, omitTextures: params.skipTextures, missileOnly: true, sound: addSupplements.sound};
                for (i = 0; i < this._missileLaunchers.length; i++) {
                    this._missileLaunchers[i].acquireResources(missileParams);
                }
            }
            resourceParams = {sound: addSupplements.sound, omitTextures: params.skipTextures};
            // add the thruster particles
            if (addSupplements.thrusterParticles === true) {
                if (this._propulsion) {
                    this._propulsion.addThrusters(this._class.getThrusterSlots());
                    this._propulsion.acquireResources(resourceParams);
                }
            }
            if (addSupplements.jumpEngine === true) {
                if (this._jumpEngine) {
                    this._jumpEngine.acquireResources(resourceParams);
                }
            }
            if (addSupplements.shield === true) {
                if (this._shield) {
                    this._shield.acquireResources(resourceParams);
                }
            }
            if (addSupplements.explosion === true) {
                this._class.getExplosionClass().acquireResources(resourceParams);
            }
            if (addSupplements.blinkers === true) {
                blinkerDescriptors = this._class.getBlinkerDescriptors();
                for (i = 0; i < blinkerDescriptors.length; i++) {
                    blinkerDescriptors[i].acquireResources(resourceParams);
                }
            }
        }
        resources.executeWhenReady(this.addToSceneNow.bind(this, scene, lod, wireframe, addSupplements, params, callback, weaponCallback, missileCallback));
    };
    /**
     * Creates and returns a camera configuration set up for following the spacecraft according to the view's parameters.
     * @param {ObjectView} view
     * @returns {CameraConfiguration} The created camera configuration.
     */
    Spacecraft.prototype.createCameraConfigurationForView = function (view) {
        return view.createCameraConfiguration(this._visualModel,
                config.getDefaultCameraBaseOrientation(),
                config.getDefaultCameraPointToFallback(),
                config.getDefaultCameraFOV(),
                config.getDefaultCameraSpan());
    };
    /**
     * Adds camera configuration objects that correspond to the views defined for this 
     * spacecraft type and follow this specific spacecraft.
     */
    Spacecraft.prototype._addCameraConfigurationsForViews = function () {
        var i;
        for (i = 0; i < this._class.getViews().length; i++) {
            this._visualModel.getNode().addCameraConfiguration(this.createCameraConfigurationForView(this._class.getViews()[i]));
        }
    };
    /**
     * Calculates and caches the score value. Needs to be called when the equipment changes
     */
    Spacecraft.prototype._updateScoreValue = function () {
        var i;
        this._scoreValue = this._class.getScoreValue();
        for (i = 0; i < this._weapons.length; i++) {
            this._scoreValue += this._weapons[i].getScoreValue();
        }
        for (i = 0; i < this._missileLaunchers.length; i++) {
            this._scoreValue += this._missileLaunchers[i].getScoreValue();
        }
        if (this._propulsion) {
            this._scoreValue += this._propulsion.getScoreValue();
        }
        this._scoreValue += this._sensorsScoreValue;
        if (this._shield) {
            this._scoreValue += this._shield.getScoreValue();
        }
    };
    /**
     * Equips a weapon of the given class on the ship.
     * @param {WeaponClass} weaponClass The class of the weapon to equip.
     * @param {Number} [slotIndex] The index of the weapon slot to equip the weapon to. If not given (or negative), the weapon will be 
     * equipped to the next slot (based on the number of already equipped weapons)
     */
    Spacecraft.prototype._addWeapon = function (weaponClass, slotIndex) {
        var slot, weaponSlots = this._class.getWeaponSlots();
        if ((slotIndex === undefined) || (slotIndex < 0)) {
            slotIndex = this._weapons.length;
        }
        if (slotIndex < weaponSlots.length) {
            slot = weaponSlots[slotIndex];
            this._weapons.push(new equipment.Weapon(weaponClass, this, slot));
        }
    };
    /**
     * Set the current active missile launcher to the one with the passed index (also updating targeting computer state for missile locking)
     * @param {Number} index
     */
    Spacecraft.prototype._setActiveMissileLauncherIndex = function (index) {
        this._activeMissileLauncherIndex = index;
        this._targetingComputer.setMissileLauncher((this._activeMissileLauncherIndex >= 0) ? this._missileLaunchers[this._activeMissileLauncherIndex] : null);
    };
    /**
     * Equips a number of missiles of the given class into a launcher on the ship.
     * @param {MissileClass} missileClass The class of the missiles to equip.
     * @param {Number} amount The amount of missiles to equip. (this many missiles
     * will be loaded into the launcher regardless of available capacity)
     * @param {Number} [launcherIndex] The index of the missile launcher to load the
     * missiles to. If not given (or negative), the first available launcher will be used.
     */
    Spacecraft.prototype._addMissiles = function (missileClass, amount, launcherIndex) {
        var descriptor, launchers = this._class.getMissileLaunchers();
        if ((launcherIndex === undefined) || (launcherIndex < 0)) {
            launcherIndex = this._missileLaunchers.length;
        }
        if (launcherIndex < launchers.length) {
            descriptor = launchers[launcherIndex];
            this._missileLaunchers.push(new equipment.MissileLauncher(missileClass, this, descriptor, amount));
            if (this._activeMissileLauncherIndex < 0) {
                this._setActiveMissileLauncherIndex(0);
            }
            if (this._missileClasses.indexOf(missileClass) < 0) {
                this._missileClasses.push(missileClass);
            }
        }
    };
    /**
     * Equips a propulsion system of the given class to the ship, replacing the
     * previous propulsion system, if one was equipped.
     * @param {PropulsionClass} propulsionClass
     */
    Spacecraft.prototype._addPropulsion = function (propulsionClass) {
        this._propulsion = new equipment.Propulsion(propulsionClass, this._physicalModel);
        this._maneuveringComputer.updateForNewPropulsion();
        this._maneuveringComputer.updateTurningLimit();
        this._topSpeed = (physics.getDrag() && this._class.getDragFactor()) ? Math.sqrt(this.getMaxAcceleration() / (physics.getDrag() * this._class.getDragFactor())) : 0;
        this._updateBurnNeedFactors();
    };
    /**
     * Equips a sensor array of the given class to the ship, replacing the previous
     * sensors, if they were equipped
     * @param {SensorsClass} sensorsClass
     */
    Spacecraft.prototype._addSensors = function (sensorsClass) {
        this._targetingComputer.updateSensors(sensorsClass);
        this._sensorsScoreValue = sensorsClass.getScoreValue();
    };
    /**
     * Equips a jump engine of the given class to the ship, replacing the
     * previous jump engine, if one was equipped.
     * @param {JumpEngineClass} jumpEngineClass
     */
    Spacecraft.prototype._addJumpEngine = function (jumpEngineClass) {
        this._jumpEngine = new equipment.JumpEngine(jumpEngineClass, this);
    };
    /**
     * Equips a shield of the given class to the ship, replacing the
     * previous shield, if one was equipped.
     * @param {ShieldClass} shieldClass
     */
    Spacecraft.prototype._addShield = function (shieldClass) {
        this._shield = new equipment.Shield(shieldClass, this);
    };
    /**
     * Removes all equipment from the spacecraft.
     */
    Spacecraft.prototype.unequip = function () {
        var i;
        for (i = 0; i < this._weapons.length; i++) {
            this._weapons[i].destroy();
        }
        this._weapons = [];
        for (i = 0; i < this._missileLaunchers.length; i++) {
            this._missileLaunchers[i].destroy();
        }
        this._missileLaunchers = [];
        this._missileClasses = [];
        this._setActiveMissileLauncherIndex(-1);
        if (this._propulsion) {
            this._propulsion.destroy();
        }
        this._propulsion = null;
        this._maneuveringComputer.updateForNewPropulsion();
        this._maneuveringComputer.updateTurningLimit();
        this._targetingComputer.updateSensors();
        this._sensorsScoreValue = 0;
        this._updateScoreValue();
    };
    /**
     * Equips the spacecraft according to the specifications in the given loadout.
     * @param {Loadout} [loadout]
     */
    Spacecraft.prototype.equipLoadout = function (loadout) {
        var i, weaponDescriptors, missileDescriptors;
        if (loadout) {
            weaponDescriptors = loadout.getWeaponDescriptors();
            for (i = 0; i < weaponDescriptors.length; i++) {
                this._addWeapon(classes.getWeaponClass(weaponDescriptors[i].className), weaponDescriptors[i].slotIndex);
            }
            missileDescriptors = loadout.getMissileDescriptors();
            for (i = 0; i < missileDescriptors.length; i++) {
                this._addMissiles(classes.getMissileClass(missileDescriptors[i].className), missileDescriptors[i].amount, missileDescriptors[i].launcherIndex);
            }
            if (loadout.getPropulsionDescriptor() !== null) {
                this._addPropulsion(classes.getPropulsionClass(loadout.getPropulsionDescriptor().className));
            }
            if (loadout.getSensorsDescriptor() !== null) {
                this._addSensors(classes.getSensorsClass(loadout.getSensorsDescriptor().className));
            }
            if (loadout.getJumpEngineDescriptor() !== null) {
                this._addJumpEngine(classes.getJumpEngineClass(loadout.getJumpEngineDescriptor().className));
            }
            if (loadout.getShieldDescriptor() !== null) {
                this._addShield(classes.getShieldClass(loadout.getShieldDescriptor().className));
            }
        } else {
            application.log_DEBUG("WARNING: equipping empty loadout on " + this._class.getName() + "!");
        }
        this._updateScoreValue();
    };
    /**
     * Returns the list of names (IDs) of the available loadouts for this spacecraft.
     * @returns {String[]}
     */
    Spacecraft.prototype.getLoadoutNames = function () {
        return this._class.getLoadoutNames();
    };
    /**
     * Returns the sound source of the ship if it is far away enough from the camera that fire/launch sound effects should
     * be stacked on it, otherwise returns null
     * @returns {SoundSource}
     */
    Spacecraft.prototype.getSoundSourceForFireSound = function () {
        var posInCameraSpace;
        posInCameraSpace = this.getPositionMatrixInCameraSpace();
        if ((Math.abs(posInCameraSpace[12]) <= _weaponFireSoundStackMinimumDistance) &&
                (Math.abs(posInCameraSpace[13]) <= _weaponFireSoundStackMinimumDistance) &&
                (Math.abs(posInCameraSpace[14]) <= _weaponFireSoundStackMinimumDistance)) {
            return null;
        }
        return this.getSoundSource();
    };
    /**
     * Fires all of the ship's weapons.
     * @param {Boolean} onlyIfAimedOrFixed Only those weapons are fired which are fixed (cannot be rotated) and those that can be rotated
     * and are currently aimed at their target.
     */
    Spacecraft.prototype.fire = function (onlyIfAimedOrFixed) {
        var i, scaledOriMatrix, fired = false, projectileCount, soundSource;
        if (!this._firingDisabled && !this._isJumping) {
            scaledOriMatrix = this.getScaledOriMatrix();
            soundSource = this.getSoundSourceForFireSound();
            for (i = 0; i < this._weapons.length; i++) {
                projectileCount = this._weapons[i].fire(scaledOriMatrix, onlyIfAimedOrFixed, soundSource);
                fired = (projectileCount > 0) || fired;
                this._shotsFired += projectileCount;
            }
            // executing callbacks
            if (fired) {
                for (i = 0; i < this._targetedBy.length; i++) {
                    this._targetedBy[i].handleEvent(SpacecraftEvents.TARGET_FIRED);
                }
                this.handleEvent(SpacecraftEvents.FIRED);
            }
            if (!this._guestPiloted) {
                this._fired = true;
            }
        }
    };
    /**
     * Fire the ship's weapons, or if we are a guest in a multiplayer game, notify the host in the next control message that we would
     * like to fire
     * @param {Boolean} onlyIfAimedOrFixed Only those weapons are fired which are fixed (cannot be rotated) and those that can be rotated
     * and are currently aimed at their target.
     */
    Spacecraft.prototype.requestFire = function (onlyIfAimedOrFixed) {
        if (this._guestPiloted) {
            this._fired = true;
        } else {
            this.fire(onlyIfAimedOrFixed);
        }
    };
    /**
     * Automatically switch to the next launcher with the same missile class or to the first non-empty launcher if the current one is empty
     */
    Spacecraft.prototype._autoChangeMissileLauncher = function () {
        var originalIndex, missileClass, salvo;
        originalIndex = this._activeMissileLauncherIndex;
        missileClass = this._missileLaunchers[originalIndex].getMissileClass();
        salvo = this._missileLaunchers[originalIndex].isInSalvoMode();
        // first, try to find another launcher that has the same missile class and has missiles left to launch
        do {
            this._activeMissileLauncherIndex = (this._activeMissileLauncherIndex + 1) % this._missileLaunchers.length;
        } while ((this._activeMissileLauncherIndex !== originalIndex) &&
                (!this._missileLaunchers[this._activeMissileLauncherIndex].hasMissilesLeftToLaunch() ||
                        (this._missileLaunchers[this._activeMissileLauncherIndex].getMissileClass() !== missileClass)));
        // if there is no other launcher with still available missiles of the same class, and we are out of missiles in
        // the current launcher, try to find a launcher with a different missile class (if we are not out of missiles
        // in the current launcher, we will settle for it once again and wait for it to load the next missile)
        if ((this._activeMissileLauncherIndex === originalIndex) && !this._missileLaunchers[originalIndex].hasMissilesLeftToLaunch()) {
            do {
                this._activeMissileLauncherIndex = (this._activeMissileLauncherIndex + 1) % this._missileLaunchers.length;
            } while ((this._activeMissileLauncherIndex !== originalIndex) &&
                    !this._missileLaunchers[this._activeMissileLauncherIndex].hasMissilesLeftToLaunch());
        }
        if (this._activeMissileLauncherIndex === originalIndex) {
            if (this._missileLaunchers[originalIndex].getMissileCount() <= 0) {
                // current launcher is out of missiles (even queued ones) and we haven't found any others with missiles either
                this._setActiveMissileLauncherIndex(-1);
            }
        } else {
            this._setActiveMissileLauncherIndex(this._activeMissileLauncherIndex);
            if (this._missileLaunchers[this._activeMissileLauncherIndex].getMissileClass() === missileClass) {
                this._missileLaunchers[this._activeMissileLauncherIndex].setSalvoMode(salvo);
            } else {
                this._missileLaunchers[this._activeMissileLauncherIndex].setMinimumCooldown(config.getSetting(config.BATTLE_SETTINGS.MISSILE_AUTO_CHANGE_COOLDOWN));
                if (config.getBattleSetting(config.BATTLE_SETTINGS.DEFAULT_SALVO_MODE)) {
                    this._missileLaunchers[this._activeMissileLauncherIndex].setSalvoMode(true);
                }
                control.playMissileChangeSound();
            }
        }
    };
    /**
     * If the currently active missile launcher is ready, launches a missile / starts a salvo from that launcher.
     * @returns {Missile} The missile that has been launched, if any
     */
    Spacecraft.prototype.launchMissile = function () {
        var i, scaledOriMatrix, missile;
        if (!this._firingDisabled && !this._isJumping && (this._activeMissileLauncherIndex >= 0) && this._targetingComputer.isMissileLocked()) {
            scaledOriMatrix = this.getScaledOriMatrix();
            missile = this._missileLaunchers[this._activeMissileLauncherIndex].launch(scaledOriMatrix, this.getSoundSourceForFireSound(), false);
            // executing callbacks
            if (missile) {
                this._missilesLaunched++;
                for (i = 0; i < this._targetedBy.length; i++) {
                    this._targetedBy[i].handleEvent(SpacecraftEvents.TARGET_FIRED);
                }
                this.handleEvent(SpacecraftEvents.FIRED);
                this._autoChangeMissileLauncher();
            }
            return missile;
        }
        return null;
    };
    /**
     * To be called when a missile launcher launches a missile automatically as part of a salvo
     */
    Spacecraft.prototype.handleSalvoMissileLaunched = function () {
        this._missilesLaunched++;
        if ((this._activeMissileLauncherIndex >= 0) && (this._missileLaunchers[this._activeMissileLauncherIndex].getMissileCount() <= 0)) {
            this._autoChangeMissileLauncher();
        }
    };
    /**
     * Change to a missile launcher with a different missile equipped
     * @returns {Boolean} Whether the active missile launcher has been changed
     */
    Spacecraft.prototype.changeMissile = function () {
        var originalIndex, missileClass, changed;
        if (this._activeMissileLauncherIndex >= 0) {
            originalIndex = this._activeMissileLauncherIndex;
            missileClass = this._missileLaunchers[originalIndex].getMissileClass();
            do {
                this._activeMissileLauncherIndex = (this._activeMissileLauncherIndex + 1) % this._missileLaunchers.length;
            } while ((this._activeMissileLauncherIndex !== originalIndex) &&
                    (!this._missileLaunchers[this._activeMissileLauncherIndex].hasMissilesLeftToLaunch() ||
                            (this._missileLaunchers[this._activeMissileLauncherIndex].getMissileClass() === missileClass)));
            changed = this._activeMissileLauncherIndex !== originalIndex;
            if (changed) {
                this._setActiveMissileLauncherIndex(this._activeMissileLauncherIndex);
                if (config.getBattleSetting(config.BATTLE_SETTINGS.DEFAULT_SALVO_MODE)) {
                    this._missileLaunchers[this._activeMissileLauncherIndex].setSalvoMode(true);
                }
            }
            return changed;
        }
        return false;
    };
    /**
     * Toggle salvo launch mode for the current active missile launcher
     * @returns {Boolean} Whether the salvo mode has been changed
     */
    Spacecraft.prototype.toggleSalvo = function () {
        if (this._activeMissileLauncherIndex >= 0) {
            return this._missileLaunchers[this._activeMissileLauncherIndex].toggleSalvoMode();
        }
        return false;
    };
    /**
     * An array of all the missile classes of currently equipped missiles on this ship
     * @returns {MissileClass[]}
     */
    Spacecraft.prototype.getMissileClasses = function () {
        return this._missileClasses;
    };
    /**
     * The currently active missile launcher of the spacecraft
     * @returns {MissileLauncher}
     */
    Spacecraft.prototype.getActiveMissileLauncher = function () {
        return (this._activeMissileLauncherIndex >= 0) ? this._missileLaunchers[this._activeMissileLauncherIndex] : null;
    };
    /**
     * The amount of missiles of the passed class currently equipped on this spacecraft
     * @param {MissileClass} missileClass
     * @returns {Number}
     */
    Spacecraft.prototype.getMissileCount = function (missileClass) {
        var i, result = 0;
        for (i = 0; i < this._missileLaunchers.length; i++) {
            if (this._missileLaunchers[i].getMissileClass() === missileClass) {
                result += this._missileLaunchers[i].getMissileCount();
            }
        }
        return result;
    };
    /*
     * Increases the number of hits on enemies registered for this spacecraft (for hit ratio calculation)
     * @param {Boolean} byMissile Whether the hit was by a missile
     */
    Spacecraft.prototype.increaseHitsOnEnemies = function (byMissile) {
        if (byMissile) {
            this._missileHitsOnEnemies++;
        } else {
            this._hitsOnEnemies++;
        }
    };
    /**
     * Sets up this spacecraft as being targeted by the passed spacecraft. (updating target reference list and executing the related callback)
     * @param {spacecraft} targetedBy
     */
    Spacecraft.prototype.setBeingTargeted = function (targetedBy) {
        if (this._targetedBy) {
            this._targetedBy.push(targetedBy);
            this.handleEvent(SpacecraftEvents.BEING_TARGETED, {
                spacecraft: targetedBy
            });
        }
    };
    /**
     * Sets up this spacecraft as not being targeted by the passed spacecraft anymore.
     * @param {Spacecraft} targetedBy
     */
    Spacecraft.prototype.setBeingUntargeted = function (targetedBy) {
        if (this._targetedBy) {
            this._targetedBy.splice(this._targetedBy.indexOf(targetedBy), 1);
        }
    };
    /**
     * Returns the array of spacecrafts targeting this one
     * @returns {Spacecraft[]}
     */
    Spacecraft.prototype.getTargetingSpacecrafts = function () {
        return this._targetedBy;
    };
    /**
     * Targets the given spacecraft and executes related operations, such as changing target views. 
     * @param {Spacecraft|null} target If null is given, the current target will be canceled.
     */
    Spacecraft.prototype.setTarget = function (target) {
        this._targetingComputer.setTarget(target);
    };
    /**
     * Targets the next hostile spacecraft, ordering the hostiles based on the angle between the spacecraft's direction and the vector
     * pointing to the hostile spacecraft
     * @returns {Boolean} Whether a new spacecraft has been targeted
     */
    Spacecraft.prototype.targetNextNearestHostile = function () {
        return this._targetingComputer.targetNextNearestHostile();
    };
    /**
     * Targets the previous hostile spacecraft, ordering the hostiles based on the angle between the spacecraft's direction and the vector
     * pointing to the hostile spacecraft
     * @returns {Boolean} Whether a new spacecraft has been targeted
     */
    Spacecraft.prototype.targetPreviousNearestHostile = function () {
        return this._targetingComputer.targetPreviousNearestHostile();
    };
    /**
     * Targets the next hostile spacecraft, ordering the hostiles based on a complex evaluation of how fitting targets they are.
     * (to be used by the AI)
     * @returns {Boolean} Whether a new spacecraft has been targeted
     */
    Spacecraft.prototype.targetNextBestHostile = function () {
        return this._targetingComputer.targetNextBestHostile();
    };
    /**
     * Targets the next non-hostile (friendly or neutral) spacecraft, ordering the hostiles based on the angle between the spacecraft's 
     * direction and the vector pointing to the hostile spacecraft
     * @returns {Boolean} Whether a new spacecraft has been targeted
     */
    Spacecraft.prototype.targetNextNearestNonHostile = function () {
        return this._targetingComputer.targetNextNearestNonHostile();
    };
    /**
     * Returns the currently targeted spacecraft.
     * @returns {Spacecraft|null}
     */
    Spacecraft.prototype.getTarget = function () {
        return this._targetingComputer.getTarget();
    };
    /**
     * Returns the estimated position towards which the spacecraft needs to fire to hit its current target in case both itself and the 
     * target retain their current velocity, based on the speed of the projectile fired from the first barrel of the first equipped weapon.
     * @returns {Number[3]}
     */
    Spacecraft.prototype.getTargetHitPosition = function () {
        return this._targetingComputer.getTargetHitPosition();
    };
    /**
     * Returns the progress ratio of the process of the currently active missile launcher locking on to the current target (0: not locked, 1: missile locked)
     * @returns {Number}
     */
    Spacecraft.prototype.getMissileLockRatio = function () {
        return this._targetingComputer.getMissileLockRatio();
    };
    /**
     * Whether the current target is within missile locking range (or in case of unguided missiles, within the reach
     * of the missile in a straight line)
     * @returns {Boolean}
     */
    Spacecraft.prototype.isInLockingRange = function () {
        return this._targetingComputer.isInLockingRange();
    };
    /**
     * 
     * @returns {Propulsion}
     */
    Spacecraft.prototype.getPropulsion = function () {
        return this._propulsion;
    };
    /**
     * Returns the name of the propulsion system equipped on this spacecraft in a way that can be presented to the user (translated)
     * @returns {String}
     */
    Spacecraft.prototype.getPropulsionDisplayName = function () {
        return this._propulsion.getDisplayName();
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
     * Updates the visual representation the propulsion of this spacecraft to represent its current state.
     */
    Spacecraft.prototype.updatePropulsionVisuals = function () {
        this._propulsion.updateVisuals();
    };
    /**
     * Whether the passed spacecraft is within sensor (targeting) range
     * @param {Spacecraft} craft
     * @returns {Boolean}
     */
    Spacecraft.prototype.isInSensorRange = function (craft) {
        return this._targetingComputer.isInRange(craft);
    };
    /**
     * Show the models representing the hitboxes of this spacecraft.
     */
    Spacecraft.prototype.showHitbox = function () {
        this._hitbox.show();
    };
    /**
     * Hide the models representing the hitboxes of this spacecraft.
     */
    Spacecraft.prototype.hideHitbox = function () {
        this._hitbox.hide();
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
        this._visualModel.getNode().resetCameraConfigurations();
    };
    /**
     * Simulates what happens when a given amount of damage is dealt to the spacecraft at a specific
     * point, coming from source coming from a specific direction.
     * @param {Number} damage The amount of damage done to the spacecraft (hitpoints)
     * @param {Number[4]} damagePosition The relative position vector of where the damage occured.
     * Needs to take into consideration the position, orientation and scaling of the spacecraft.
     * @param {Number[3]} damageDir The relative direction whector indicating where the damage came from.
     * Also needs to take into consideration the orientation of the spacecraft.
     * @param {Spacecraft} hitBy The spacecraft that caused the damage (fired the hitting projectile)
     * @param {Boolean} byMissile Whether the damage was caused by missile hit
     * @param {Number} offset The offset value that was used during the hitcheck (the distance by which
     * the hitbox sides have been extended outward)
     * @param {Boolean} collision Whether the damage was caused by colliding with something
     */
    Spacecraft.prototype.damage = function (damage, damagePosition, damageDir, hitBy, byMissile, offset, collision) {
        var originalHitpoints, i, damageIndicator, hitpointThreshold, exp, liveHit, scoreValue, damageIndicatorPosition, dirToCenter, distToCenter;
        originalHitpoints = this._hitpoints;
        // shield absorbs damage
        if (this._shield) {
            damage = this._shield.damage(damage, _isMultiGuest);
        }
        // armor rating decreases damage
        damage = Math.max(0, damage - this._class.getArmor());
        liveHit = this._hitpoints > 0;
        // logic simulation: modify hitpoints
        this._hitpoints -= damage;
        if (this._hitpoints <= 0) {
            if (!_isMultiGuest) {
                // granting kill and score to the spacecraft that destroyed this one
                if (liveHit && hitBy && this.isHostile(hitBy)) {
                    scoreValue = this.getScoreValue();
                    damage += this._hitpoints; // this subtracts the overkill hitpoints
                    hitBy.gainDamageDealt(damage, byMissile);
                    // gain score for dealing the damage
                    hitBy.gainScore((1 - _scoreFactorForKill) * damage / this._maxHitpoints * scoreValue);
                    // gain score and kill for delivering the final hit
                    hitBy.gainScore(_scoreFactorForKill * scoreValue);
                    hitBy.gainKill();
                    if (networking.isInGame()) {
                        networking.registerPlayerKill(hitBy.getID(), this.getID());
                    }
                    hitBy.handleEvent(SpacecraftEvents.GAIN_KILL, this._anySpacecraftHitData);
                }
            }
            this._hitpoints = 0;
        } else {
            // visual simulation: add damage indicators if needed
            for (i = this._activeDamageIndicators.length; i < this._class.getDamageIndicators().length; i++) {
                damageIndicator = this._class.getDamageIndicators()[i];
                hitpointThreshold = damageIndicator.hullIntegrity / 100 * this._maxHitpoints;
                if ((this._hitpoints <= hitpointThreshold) && (this._hitpoints + damage > hitpointThreshold)) {
                    // the original hitcheck might have had a large offset and so the hit position could be away from the ship
                    // putting the damage indicator there would look weird, so let's try to find a point that is on the ship (hitbox) surface
                    if (offset > 0) {
                        // first, try to elongate the path of the projectile that hit
                        damageIndicatorPosition = [0, 0, 0, 1];
                        distToCenter = this._physicalModel.getBodySize();
                        vec.setSum3(damageIndicatorPosition, damagePosition, vec.scaled3Aux(damageDir, -distToCenter));
                        damageIndicatorPosition = this._physicalModel.checkHitRelative(damageIndicatorPosition, vec.scaled3(damageDir, -1), distToCenter, 0);
                        if (!damageIndicatorPosition) {
                            // if that doesn't work, do a second hitcheck towards the ship center with 0 offset and compare this new point on the ship surface, if far away enough, 
                            // use it for damage indicator position instead of the original hit position
                            dirToCenter = vec.scaled3(damagePosition, -1);
                            distToCenter = vec.extractLength3(dirToCenter);
                            damageIndicatorPosition = this._physicalModel.checkHitRelative(vec.NULL4W1, dirToCenter, distToCenter, 0);
                        }
                        if (!damageIndicatorPosition || (vec.length3Squared(damageIndicatorPosition, damagePosition) < MINIMUM_DISTANCE_FOR_DAMAGE_INDICATOR_HITCHECK_SQUARED)) {
                            // the new position is close to the original one, just use the original one for the damage indicator
                            damageIndicatorPosition = damagePosition;
                        } else {
                            // if we got the new indicator position from the second hitcheck towards the center, change damage direction accordingly
                            if (dirToCenter) {
                                damageDir = vec.scaled3(dirToCenter, -1);
                            }
                        }
                    } else {
                        damageIndicatorPosition = damagePosition;
                    }
                    exp = explosion.getExplosion();
                    exp.init(
                            damageIndicator.explosionClass,
                            mat.translation4vAux(damageIndicatorPosition),
                            mat.IDENTITY4,
                            damageDir,
                            true);
                    exp.addToSceneNow(this._visualModel.getNode(), this.getSoundSource());
                    this._activeDamageIndicators.push(exp);
                }
            }
            if (!_isMultiGuest) {
                // granting score to the spacecraft that hit this one for the damage
                if (liveHit && hitBy && hitBy.isAlive() && this.isHostile(hitBy)) {
                    hitBy.gainDamageDealt(damage, byMissile);
                    hitBy.gainScore((1 - _scoreFactorForKill) * damage / this._maxHitpoints * this.getScoreValue());
                }
            }
        }
        // callbacks
        this._hitData.spacecraft = hitBy;
        this._hitData.hitPosition = damagePosition;
        this._hitData.hullDamage = damage;
        this._hitData.missile = byMissile;
        if (collision) {
            this.handleEvent(SpacecraftEvents.COLLIDED, this._hitData);
        } else {
            this.handleEvent(SpacecraftEvents.BEING_HIT, this._hitData);
            if (hitBy.isAlive() && !hitBy.isAway()) {
                if (hitBy.getTarget() === this) {
                    hitBy.handleEvent(SpacecraftEvents.TARGET_HIT, this._hitData);
                }
                hitBy.handleEvent(SpacecraftEvents.ANY_SPACECRAFT_HIT, this._anySpacecraftHitData);
            }
        }
        if (!_isMultiGuest) {
            if (!collision && this.isHostile(hitBy)) {
                hitBy.increaseHitsOnEnemies(byMissile);
            }
        } else {
            this._hitpoints = originalHitpoints;
        }
    };
    /**
     * Rotates all the non-fixed weapons of the spacecraft to aim towards the calculated hitting position of the current target.
     * @param {Number} turnThreshold Weapons will only be rotated if the angle between their current and the target direction is greater 
     * than this value, in radians.
     * @param {Number} fireThreshold Weapons will only report an aimed status if the angle between their current and the target direction is 
     * less than this value, in radians.
     * @param {Number} dt the elapsed time since the last simulation step, based on which the amount of rotation will be calculated.
     */
    Spacecraft.prototype.aimWeapons = function (turnThreshold, fireThreshold, dt) {
        var futureTargetPosition, i, target = this.getTarget();
        if (target && (this._weapons.length > 0)) {
            futureTargetPosition = this.getTargetHitPosition();
        }
        for (i = 0; i < this._weapons.length; i++) {
            if (target && !this._firingDisabled && !this._isJumping) {
                this._weapons[i].aimTowards(futureTargetPosition, turnThreshold, fireThreshold, this.getScaledOriMatrix(), dt);
            } else {
                this._weapons[i].rotateToDefaultPosition(turnThreshold, dt);
            }
        }
    };
    /**
     * This is to be used by the jump engine only! Signals whether the jump sequence is currently underway.
     * @param {Boolean} value
     */
    Spacecraft.prototype.setJumping = function (value) {
        this._isJumping = value;
    };
    /**
     * Whether the jump sequence is currently underway.
     * @returns {Boolean}
     */
    Spacecraft.prototype.isJumping = function () {
        return this._isJumping;
    };
    /**
     * Engages jump engines to leave the scene of the mission
     * @param {Boolean} toggle If true, calling the method while the jump out sequence is under way will cancel the jump
     * @returns {Boolean} Whether a jump out was initiated / toggled
     */
    Spacecraft.prototype.jumpOut = function (toggle) {
        if (!this._away && this._jumpEngine) {
            return this._jumpEngine.jumpOut(toggle);
        } else {
            application.log_DEBUG("Warning! Spacecraft '" + this.getDisplayName() + "' cannot jump out because it is already away or has no jump engines!");
        }
        return false;
    };
    /**
     * Engages jump engines to enter the scene of the mission
     */
    Spacecraft.prototype.jumpIn = function () {
        if (this._away && this._jumpEngine) {
            this._jumpEngine.jumpIn();
        } else {
            application.log_DEBUG("Warning! Spacecraft '" + this.getDisplayName() + "' cannot jump in because it is already present or has no jump engines!");
        }
    };
    /**
     * Returns the sound source beloning to this spacecraft (that can be used to play sound effects positioned in 3D)
     * @returns {SoundSource}
     */
    Spacecraft.prototype.getSoundSource = function () {
        return this._soundSource;
    };
    /**
     * Starts the playback of the spacecraft hum sound effect (ramping the volume up from zero to avoid popping)
     */
    Spacecraft.prototype._startHumSound = function () {
        this._humSoundClip.setVolume(0);
        this._humSoundClip.play();
        this._humSoundClip.rampVolume(this._humSoundVolume, HUM_SOUND_VOLUME_RAMP_DURATION, true, true);
    };
    /**
     * Plays the collision sound effect corresponding to this spacecraft
     * @param {Number[3]} position The camera-space coordinates of where the collision happened
     */
    Spacecraft.prototype.playCollisionSound = function (position) {
        if (this._timeSinceCollisionSoundPlayed >= MINIMUM_COLLISION_SOUND_INTERVAL) {
            this._class.playCollisionSound(position);
            this._timeSinceCollisionSoundPlayed = 0;
        }
    };
    /**
     * If the spacecraft object was not destroyed upon its destruction (by setting an onDestructed handler returning false), it retains its
     * data and can be respawned (returned to full hitpoints) using this method
     * @param {Boolean} [randomAnimationTime=false] If true, the blinking lights on the spacecraft will be set to a random blinking 
     * animation state (otherwise start from the beginning)
     */
    Spacecraft.prototype.respawn = function (randomAnimationTime) {
        var i;
        this._alive = true;
        this._hitpoints = this._maxHitpoints;
        this._timeElapsedSinceDestruction = -1;
        if (this._humSoundClip) {
            this._startHumSound();
        }
        for (i = 0; i < this._blinkers.length; i++) {
            if (randomAnimationTime) {
                this._blinkers[i].setRandomTime();
            } else {
                this._blinkers[i].setTime(0);
            }
        }
    };
    /**
     * Sets the hitpoints (hull integrity) of the spacecraft, causing it to explode the next time its simulate() method is called
     */
    Spacecraft.prototype.setHitpointsToZero = function () {
        this._hitpoints = 0;
    };
    /**
     * Removes damage indicators that are no longer needed in case the spacecraft has regained hitpoints
     */
    Spacecraft.prototype._updateDamageIndicators = function () {
        var i, classIndicators, count;
        i = this._activeDamageIndicators.length - 1;
        classIndicators = this._class.getDamageIndicators();
        while ((i >= 0) && (this._hitpoints > classIndicators[i].hullIntegrity / 100 * this._maxHitpoints)) {
            i--;
        }
        count = i + 1;
        while (i < this._activeDamageIndicators.length - 1) {
            i++;
            this._activeDamageIndicators[i].finish();
        }
        this._activeDamageIndicators.length = count;
    };
    /**
     * @typedef {Object} Spacecraft~SimulateParams
     * The named parameters that can be submitted to the simulate() method of spacecrafts
     * @property {Boolean} controlThrusters If false, the maneuvering computer will not control the thrusters in this simulation step
     * @property {Boolean} applyThrusterForces If false, the forces and torques from thrusters will not be applied to the spacecraft in this
     * simulation step
     */
    /**
     * The default parameters for simulate() calls (to avoid creating a new object every time)
     * @memberOf Spacecraft
     * @type Spacecraft~SimulateParams
     */
    Spacecraft.DEFAULT_SIMULATE_PARAMS = {
        controlThrusters: true,
        applyThrusterForces: true
    };
    /**
     * Performs all the phyics and logic simulation of this spacecraft.
     * @param {Number} dt The elapsed time since the last simulation step, in
     * milliseconds.
     * @param {Spacecraft~SimulateParams} [params=Spacecraft.DEFAULT_SIMULATE_PARAMS] Optional additional parameters affecting the behaviour
     * of the method
     */
    Spacecraft.prototype.simulate = function (dt, params) {
        var i, matrix, v;
        if (!this._alive) {
            return;
        }
        if (this._away) {
            return;
        }
        params = params || Spacecraft.DEFAULT_SIMULATE_PARAMS;
        this._targetingComputer.simulate(dt);
        // update the sound source position - will be used either way (for the explosion or for hum / thrusters / weapons... )
        matrix = this.getPositionMatrixInCameraSpace();
        this._soundSource.updatePosition(
                Math.round(matrix[12] * 10) * 0.1,
                Math.round(matrix[13] * 10) * 0.1,
                Math.round(matrix[14] * 10) * 0.1);
        // destruction of the spacecraft
        if (this._hitpoints <= 0) {
            if (this._timeElapsedSinceDestruction < 0) {
                this._timeElapsedSinceDestruction = 0;
                if (this._humSoundClip) {
                    this._humSoundClip.stopPlaying(audio.SOUND_RAMP_DURATION);
                }
                if (this._propulsion) {
                    this._propulsion.resetThrusterBurn();
                    this._propulsion.simulate(0, this.getSoundSource(), false);
                }
                this._explosion = explosion.getExplosion();
                this._explosion.init(
                        this._class.getExplosionClass(),
                        this._physicalModel.getPositionMatrix(),
                        this._physicalModel.getOrientationMatrix(),
                        vec.getRowC43Aux(this._physicalModel.getPositionMatrix()),
                        true,
                        true,
                        this._physicalModel.getVelocityMatrix());
                this._explosion.addToScene(this._visualModel.getNode().getScene().getRootNode(), this.getSoundSource());
                for (i = 0; i < this._activeDamageIndicators.length; i++) {
                    this._activeDamageIndicators[i].finish();
                }
                this._activeDamageIndicators.length = 0;
                v = mat.matrix4Aux(this._physicalModel.getVelocityMatrix());
                this._physicalModel.reset();
                this._physicalModel.setVelocity(v[12], v[13], v[14]);
            } else {
                this._timeElapsedSinceDestruction += dt;
                if (this._timeElapsedSinceDestruction > (this._class.getExplosionClass().getTotalDuration() * this._class.getShowTimeRatioDuringExplosion())) {
                    this._alive = false;
                    if (this.handleEvent(SpacecraftEvents.DESTRUCTED) !== false) {
                        this.destroy(true);
                    }
                    return;
                }
            }
        } else {
            // updating onboard systems, if the spacecraft is still functioning
            for (i = 0; i < this._weapons.length; i++) {
                this._weapons[i].simulate(dt);
            }
            for (i = 0; i < this._missileLaunchers.length; i++) {
                this._missileLaunchers[i].simulate(dt);
                if ((this._activeMissileLauncherIndex < 0) && this._missileLaunchers[i].hasMissilesLeftToLaunch()) {
                    this._setActiveMissileLauncherIndex(i);
                }
            }
            if (this._propulsion) {
                if (params.controlThrusters) {
                    this._maneuveringComputer.controlThrusters(dt, this._multiControlled);
                }
                this._propulsion.simulate(dt, this._soundSource, params.applyThrusterForces);
            }
            if (this._jumpEngine) {
                this._jumpEngine.simulate(dt);
            }
            if (this._shield) {
                this._shield.simulate(dt, _isMultiGuest);
            }
            if (this._class.hasHumSound()) {
                if (!this._humSoundClip) {
                    this._humSoundClip = this._class.createHumSoundClip(this._soundSource);
                    this._humSoundVolume = this._humSoundClip.getVolume();
                    if (this._humSoundClip) {
                        this._startHumSound();
                    }
                }
            }
            if (this._timeSinceCollisionSoundPlayed < MINIMUM_COLLISION_SOUND_INTERVAL) {
                this._timeSinceCollisionSoundPlayed += dt;
            }
        }
        this._physicalModel.simulate(dt);
        this._relativeVelocityMatrixValid = false;
        this._turningMatrixValid = false;
        this.updateScaledOriMatrix();
        this._visualModel.setPositionMatrix(this._physicalModel.getPositionMatrix());
        this._visualModel.setOrientationMatrix(this._physicalModel.getOrientationMatrix());
        if (this._propulsion) {
            this._maneuveringComputer.updateSpeedIncrement(dt);
        }
    };
    /**
     * Adds a new event handler function for events of the passed type
     * @param {String} eventID Identifies the event type - see SpacecraftEvents
     * @param {Function} handler The function to call when an event of the given type happens with this spacecraft
     */
    Spacecraft.prototype.addEventHandler = function (eventID, handler) {
        this._eventHandlers[eventID] = this._eventHandlers[eventID] || [];
        this._eventHandlers[eventID].push(handler);
    };
    /**
     * Executes the previously added event handlers for the passed event type.
     * Public, because equipment (e.g. jump engine) can trigger events for the spacecraft it is placed on.
     * @param {String} eventID (enum SpacecraftEvents)
     * @param {Object} data Data to pass to the event handlers (the exact structure depends on the event type)
     * @returns {Boolean} Returns true if all event handlers return true 
     */
    Spacecraft.prototype.handleEvent = function (eventID, data) {
        var i, result;
        if (this._eventHandlers && this._eventHandlers[eventID]) {
            result = true;
            for (i = 0; i < this._eventHandlers[eventID].length; i++) {
                result = this._eventHandlers[eventID][i](data) && result;
            }
        }
        return result;
    };
    /**
     * Returns the highest number of projectiles that might be used for the weapons of this spacecraft simultaneously in one battle.
     * @returns {Number}
     */
    Spacecraft.prototype.getMaxProjectileCount = function () {
        var result = 0, i;
        for (i = 0; i < this._weapons.length; i++) {
            result += this._weapons[i].getMaxProjectileCount();
        }
        return result;
    };
    /**
     * Returns the highest number of missiles that might be used (flying, rendered) for the missile launchers of this 
     * spacecraft simultaneously in one battle.
     * @returns {Number}
     */
    Spacecraft.prototype.getMaxMissileCount = function () {
        var result = 0, i;
        for (i = 0; i < this._missileLaunchers.length; i++) {
            result += this._missileLaunchers[i].getMaxMissileCount();
        }
        return result;
    };
    /**
     * Returns the highest number of explosions that might be used for this spacecraft simultaneously in one battle.
     * @returns {Number}
     */
    Spacecraft.prototype.getMaxExplosionCount = function () {
        var result = 0, i;
        result += 1; // main explosion when ship is destroyed
        result += this._class.getDamageIndicators().length;
        for (i = 0; i < this._weapons.length; i++) {
            result += this._weapons[i].getMaxExplosionCount();
        }
        for (i = 0; i < this._missileLaunchers.length; i++) {
            result += this._missileLaunchers[i].getMaxExplosionCount();
        }
        return result;
    };
    /**
     * Returns the highest number of particles that might be used for this spacecraft simultaneously in one battle.
     * @returns {Number}
     */
    Spacecraft.prototype.getMaxParticleCount = function () {
        var result = 0, i, damageIndicators;
        result += this._class.getExplosionClass().getMaxParticleCount();
        damageIndicators = this._class.getDamageIndicators();
        for (i = 0; i < damageIndicators.length; i++) {
            result += damageIndicators[i].explosionClass.getMaxParticleCount();
        }
        for (i = 0; i < this._weapons.length; i++) {
            result += this._weapons[i].getMaxParticleCount();
        }
        for (i = 0; i < this._missileLaunchers.length; i++) {
            result += this._missileLaunchers[i].getMaxParticleCount();
        }
        return result;
    };
    /**
     * When locking on to this spacecraft with a missile, the time it takes to achieve lock is multiplied by this factor
     * (smaller for larger ships, larger for more stealthy ships)
     * @returns {Number}
     */
    Spacecraft.prototype.getLockingTimeFactor = function () {
        return this._class.getLockingTimeFactor();
    };
    /**
     * Toggles the visibility of spot lights emitted by this spacecraft.
     */
    Spacecraft.prototype.toggleSpotLights = function () {
        var i;
        if (this._spotLights.length > 0) {
            if (this._spotLights[0].isVisible()) {
                for (i = 0; i < this._spotLights.length; i++) {
                    this._spotLights[i].hide();
                }
            } else {
                for (i = 0; i < this._spotLights.length; i++) {
                    this._spotLights[i].show();
                }
            }
        }
    };
    /**
     * Return the data to be sent to the guests by the host in the next game update message to synchronize the 
     * state of this spacecraft in a multiplayer game
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getMultiHostData = function () {
        var position, orientation, velocity;
        if (!this._alive) {
            return this._multiHostData;
        }
        position = this._physicalModel.getPositionMatrix();
        orientation = this._physicalModel.getOrientationMatrix();
        velocity = this._physicalModel.getVelocityMatrix();
        this._multiHostData[0] = position[12];
        this._multiHostData[1] = position[13];
        this._multiHostData[2] = position[14];
        this._multiHostData[3] = orientation[4];
        this._multiHostData[4] = orientation[5];
        this._multiHostData[5] = orientation[6];
        this._multiHostData[6] = orientation[8];
        this._multiHostData[7] = orientation[9];
        this._multiHostData[8] = orientation[10];
        this._multiHostData[9] = this.getHullIntegrity();
        this._multiHostData[10] = this.getShieldIntegrity();
        this._multiHostData[11] = this._fired ? 1 : 0;
        this._multiHostData[12] = velocity[12];
        this._multiHostData[13] = velocity[13];
        this._multiHostData[14] = velocity[14];
        this._multiHostData[15] = velocity[0];
        this._multiHostData[16] = velocity[1];
        this._multiHostData[17] = velocity[2];
        this._multiHostData[18] = velocity[4];
        this._multiHostData[19] = velocity[5];
        this._multiHostData[20] = velocity[6];
        this._multiHostData[21] = velocity[8];
        this._multiHostData[22] = velocity[9];
        this._multiHostData[23] = velocity[10];
        this._multiHostData[24] = this._maneuveringComputer.getSpeedTarget();
        this._multiHostData[25] = this._maneuveringComputer.getLastStrafeTarget();
        this._multiHostData[26] = this._maneuveringComputer.getLastLiftTarget();
        this._multiHostData[27] = this._maneuveringComputer.getLastYawTarget();
        this._multiHostData[28] = this._maneuveringComputer.getLastPitchTarget();
        this._multiHostData[29] = this._maneuveringComputer.getLastRollTarget();
        this._fired = false;
        return this._multiHostData;
    };
    /**
     * Synchronize the state of this spacecraft to the host based on the data received from it in the
     * last game update message in a multiplayer game
     * @param {Float32Array} data The last game update message received from the host
     * @param {Number} offset The index where the data segment about this spacecraft starts within the
     * message
     */
    Spacecraft.prototype.applyMultiHostData = function (data, offset) {
        if (!this._alive) {
            return;
        }
        this._physicalModel.setPosition(data[offset], data[offset + 1], data[offset + 2]);
        this._physicalModel.setOrientation(
                data[offset + 3], data[offset + 4], data[offset + 5],
                data[offset + 6], data[offset + 7], data[offset + 8]);
        this.setHullIntegrity(data[offset + 9]);
        this.setShieldIntegrity(data[offset + 10]);
        if (data[offset + 11]) {
            this.fire(false);
        }
        this._physicalModel.setVelocity(data[offset + 12], data[offset + 13], data[offset + 14]);
        this._physicalModel.setAngularVelocity(
                data[offset + 15], data[offset + 16], data[offset + 17],
                data[offset + 18], data[offset + 19], data[offset + 20],
                data[offset + 21], data[offset + 22], data[offset + 23]);
        if (this._multiControlled) {
            this._maneuveringComputer.setSpeedTarget(data[offset + 24]);
            this._maneuveringComputer.setStrafeTarget(data[offset + 25]);
            this._maneuveringComputer.setLiftTarget(data[offset + 26]);
            this._maneuveringComputer.setRollTarget(data[offset + 29]);
            this._maneuveringComputer.setYawTarget(data[offset + 27]);
            this._maneuveringComputer.setPitchTarget(data[offset + 28]);
        }
    };
    /**
     * Return the data to be sent to the host by the guest in the next game control message to synchronize the 
     * control state of this spacecraft in a multiplayer game
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getMultiGuestData = function () {
        if (!this._alive) {
            return this._multiGuestData;
        }
        this._multiGuestData[1] = this._maneuveringComputer.getSpeedTarget();
        this._multiGuestData[2] = this._maneuveringComputer.getLastStrafeTarget();
        this._multiGuestData[3] = this._maneuveringComputer.getLastLiftTarget();
        this._multiGuestData[4] = this._maneuveringComputer.getLastYawTarget();
        this._multiGuestData[5] = this._maneuveringComputer.getLastPitchTarget();
        this._multiGuestData[6] = this._maneuveringComputer.getLastRollTarget();
        this._multiGuestData[7] = this._fired ? 1 : 0;
        this._fired = false;
        return this._multiGuestData;
    };
    /**
     * Synchronize the control state of this spacecraft to the guest based on the data received from it in the
     * last game control message in a multiplayer game
     * @param {Float32Array} data
     */
    Spacecraft.prototype.applyMultiGuestData = function (data) {
        if (!this._alive) {
            return;
        }
        this._maneuveringComputer.setSpeedTarget(data[1]);
        this._maneuveringComputer.setStrafeTarget(data[2]);
        this._maneuveringComputer.setLiftTarget(data[3]);
        this._maneuveringComputer.setYawTarget(data[4]);
        this._maneuveringComputer.setPitchTarget(data[5]);
        this._maneuveringComputer.setRollTarget(data[6]);
        if (data[7]) {
            this.fire(false);
        }
    };
    /**
     * Cancels the held references and marks the renderable object, its node and its subtree as reusable.
     * @param {Boolean} [preserveClass=false] If true, the reference to the spacecraft's class is preserved (spacecraft classes objects are 
     * not destroyed during the game anyway, and this way it can be known, what type of spacecraft this was (for example for showing 
     * destroyed wingmen in the wingmen status panel during a mission)
     */
    Spacecraft.prototype.destroy = function (preserveClass) {
        var i;
        if (!preserveClass) {
            this._class = null;
        }
        if (this._weapons) {
            for (i = 0; i < this._weapons.length; i++) {
                if (this._weapons[i]) {
                    this._weapons[i].destroy();
                    this._weapons[i] = null;
                }
            }
        }
        this._weapons = null;
        if (this._missileLaunchers) {
            for (i = 0; i < this._missileLaunchers.length; i++) {
                if (this._missileLaunchers[i]) {
                    this._missileLaunchers[i].destroy();
                    this._missileLaunchers[i] = null;
                }
            }
        }
        this._missileLaunchers = null;
        this._missileClasses = null;
        if (this._propulsion) {
            this._propulsion.destroy();
            this._propulsion = null;
        }
        if (this._jumpEngine) {
            this._jumpEngine.destroy();
            this._jumpEngine = null;
        }
        if (this._shield) {
            this._shield.destroy();
            this._shield = null;
        }
        if (this._maneuveringComputer) {
            this._maneuveringComputer.destroy();
            this._maneuveringComputer = null;
        }
        if (this._targetingComputer) {
            this._targetingComputer.destroy();
            this._targetingComputer = null;
        }
        this._targetedBy = null;
        this._eventHandlers = null;
        this._explosion = null; // do not destroy the explosion - it might still be animating!
        if (this._hitbox) {
            this._hitbox.markAsReusable(true);
        }
        this._hitbox = null;
        if (this._visualModel && this._visualModel.getNode() && !this._visualModel.getNode().canBeReused()) {
            this._visualModel.getNode().markAsReusable(true);
        }
        this._visualModel = null;
        this._spotLights = null;
        this._physicalModel = null;
        if (this._activeDamageIndicators) {
            // damage indicators are pooled objects (Explosions), so we do not destroy them (properties and reusability state need to be 
            // preserved for reuse)
            this._activeDamageIndicators = null;
        }
        this._alive = false;
        if (this._humSoundClip) {
            this._humSoundClip.destroy();
            this._humSoundClip = null;
        }
        if (this._soundSource) {
            // do not destroy it, the explosion sound might still be playing, just remove the reference
            // the node will automatically be removed after playback finishes
            this._soundSource = null;
        }
    };
    // caching configuration settings
    config.executeWhenReady(function () {
        _luminosityFactorsArrayName = config.getSetting(config.GENERAL_SETTINGS.UNIFORM_LUMINOSITY_FACTORS_ARRAY_NAME);
        _groupTransformsArrayName = config.getSetting(config.GENERAL_SETTINGS.UNIFORM_GROUP_TRANSFORMS_ARRAY_NAME);
        _hitZoneColor = config.getSetting(config.BATTLE_SETTINGS.HITBOX_COLOR);
        _weaponFireSoundStackMinimumDistance = config.getSetting(config.BATTLE_SETTINGS.WEAPON_FIRE_SOUND_STACK_MINIMUM_DISTANCE);
        _scoreFactorForKill = config.getSetting(config.BATTLE_SETTINGS.SCORE_FRACTION_FOR_KILL);
        graphics.executeWhenReady(handleGraphicsSettingsChanged);
        graphics.onSettingsChange(handleGraphicsSettingsChanged);
    });
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        MULTI_HOST_DATA_LENGTH: MULTI_HOST_DATA_LENGTH,
        MULTI_GUEST_DATA_LENGTH: MULTI_GUEST_DATA_LENGTH,
        setMultiGuest: setMultiGuest,
        getSquadName: getSquadName,
        getSquadIndex: getSquadIndex,
        Spacecraft: Spacecraft
    };
});