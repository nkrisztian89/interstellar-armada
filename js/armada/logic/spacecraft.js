/**
 * Copyright 2014-2017 Krisztián Nagy
 * @file Implementation of the Spacecraft game-logic-level class
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
    "armada/logic/constants",
    "armada/logic/SpacecraftEvents",
    "armada/logic/equipment",
    "armada/logic/explosion",
    "utils/polyfill"
], function (
        utils, vec, mat,
        application, managedGL, egomModel, physics, resources,
        renderableObjects, lights, sceneGraph,
        graphics, audio, classes, config, strings,
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
             * The duration while the hum sound effects ramp to their normal volume after being started.
             * In seconds.
             * @type Number
             */
            HUM_SOUND_VOLUME_RAMP_DURATION = 0.020,
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
             * Precalculated value of an array containing as many identity matrices (flattened into a single one dimensional array) as the
             * number of available transform groups.
             * @type Float32Array
             */
            _groupTransformIdentityArray = null,
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
            _scoreFactorForKill;
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
        parentNode.addSubnode(new sceneGraph.RenderableNode(this._visualModel, false, config.getSetting(config.BATTLE_SETTINGS.MINIMUM_BLINKER_PARTICLE_COUNT_FOR_INSTANCING)));
        if ((addLightSource === true) && (this._descriptor.getIntensity() > 0)) {
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
     * @param {SpacecraftClass} spacecraftClass The class of the spacecraft that
     * describes its general properties.
     * @param {String} [name] An optional name to identify this spacecraft by.
     * @param {Float32Array} [positionMatrix] The translation matrix describing
     * the initial position of the spacecraft.
     * @param {Float32Array} [orientationMatrix] The rotation matrix describing
     * the initial orientation of the spacecraft.
     * @param {String} [equipmentProfileName] The name of the equipment profile
     * to use to equip the spacecraft. If not given, the spacecraft will not be
     * equipped.
     * @param {Spacecraft[]} spacecraftArray The array of spacecrafts participating
     * in the same battle simulation as this one.
     * @returns {Spacecraft}
     */
    function Spacecraft(spacecraftClass, name, positionMatrix, orientationMatrix, equipmentProfileName, spacecraftArray) {
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
         * Cached value of the matrix representing the relative velocity (translation in m/s in the coordinate space of the spacecraft)
         * of the spacecraft.
         * @type Float32Array
         */
        this._relativeVelocityMatrix = null;
        /**
         * Cached value of the matrix representing the turning the current angular velocity of the object causes over 
         * ANGULAR_VELOCITY_MATRIX_DURATION milliseconds in model space.
         * @type Float32Array
         */
        this._turningMatrix = null;
        // ---------------------------------------
        // equipment
        /**
         * The list of weapons this spacecraft is equipped with.
         * @type Weapon[]
         */
        this._weapons = null;
        /**
         * The targeting computer equipped on this spacecraft.
         * @type TargetingComputer
         */
        this._targetingComputer = null;
        /**
         * While true, the spacecraft is not allowed to fire (for example during jump sequences)
         * @type Boolean
         */
        this._firingDisabled = false;
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
         * The maneuvering computer of this spacecraft that translates high
         * level maneuvering commands issued to this craft into thruster control.
         * @type ManeuveringComputer
         */
        this._maneuveringComputer = null;
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
        // ---------------------------------------
        // sound
        /**
         * Sound clip used for playing the "hum" sound effect for this spacecraft.
         * @type SoundClip
         */
        this._humSoundClip = null;
        /**
         * The sound source used to position the sound effects beloning to this spacecraft in 3D sound (=camera) space
         * @type SoundSource
         */
        this._soundSource = null;
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
         * A counter for the shots fired during  the current mission (for hit ratio calculation)
         * @type Number
         */
        this._shotsFired = 0;
        /**
         * A counter for the shots that hit an enemry during the current mission (for hit ratio calculation)
         * @type Number
         */
        this._hitsOnEnemies = 0;
        // ---------------------------------------
        // other
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
        // initializing the properties based on the parameters
        if (spacecraftClass) {
            this._init(spacecraftClass, name, positionMatrix, orientationMatrix, equipmentProfileName, spacecraftArray);
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
     * @param {String} [equipmentProfileName]
     * @param {Spacecraft[]} [spacecraftArray]
     * @see Spacecraft
     */
    Spacecraft.prototype._init = function (spacecraftClass, name, positionMatrix, orientationMatrix, equipmentProfileName, spacecraftArray) {
        var i, blinkerDescriptors;
        this._class = spacecraftClass;
        this._name = name || "";
        this._alive = true;
        this._away = false;
        this._hitpoints = this._class.getHitpoints();
        this._physicalModel = new physics.PhysicalObject(
                this._class.getMass(),
                positionMatrix || mat.identity4(),
                orientationMatrix || mat.identity4(),
                mat.identity4(),
                mat.identity4(),
                this._class.getBodies());
        this._class.acquireResources();
        resources.executeWhenReady(function () {
            if (this.isAlive()) {
                this._physicalModel.setScalingMatrix(mat.scaling4(this._class.getModel().getScale()));
            }
        }.bind(this));
        this._weapons = [];
        this._targetingComputer = new equipment.TargetingComputer(this, spacecraftArray);
        this._firingDisabled = false;
        this._maneuveringComputer = new equipment.ManeuveringComputer(this);
        this._blinkers = [];
        blinkerDescriptors = this._class.getBlinkerDescriptors();
        for (i = 0; i < blinkerDescriptors.length; i++) {
            this._blinkers.push(new Blinker(blinkerDescriptors[i]));
        }
        // equipping the craft if a profile name was given
        if (equipmentProfileName) {
            this.equipProfile(this._class.getEquipmentProfile(equipmentProfileName));
        }
        this._targetedBy = [];
        this._eventHandlers = {};
        this._team = null;
        this._kills = 0;
        this._score = 0;
        this._damageDealt = 0;
        this._shotsFired = 0;
        this._hitsOnEnemies = 0;
        this._hitSounds = {};
        this._hitSoundTimestamp = 0;
        this._updateIDAndName();
        this._updateScoreValue();
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
                (strings.get(strings.SQUAD.PREFIX, this._squad)) + " " + this._indexInSquad.toString();
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
        if (this._away !== value) {
            this._away = value;
            if (this._away) {
                this.setTarget(null);
                if (this._visualModel) {
                    this._visualModel.getNode().hide();
                }
                if (this._humSoundClip) {
                    this._humSoundClip.stopPlaying(audio.SOUND_RAMP_DURATION);
                }
                if (this._propulsion) {
                    this._propulsion.resetThrusterBurn();
                    this._propulsion.simulate(this.getSoundSource(), false);
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
     * Returns the amount of hit points this spacecraft has at full hull integrity.
     * @returns {Number}
     */
    Spacecraft.prototype.getFullIntegrityHitpoints = function () {
        return this._class.getHitpoints();
    };
    /**
     * Returns the current hull integrity ratio of the spacecraft - a number between 0.0 (indicating zero
     * integrity at which the spacecraft is destroyed) and 1.0 (indicating full hull integrity).
     * @returns {Number}
     */
    Spacecraft.prototype.getHullIntegrity = function () {
        return this._hitpoints / this._class.getHitpoints();
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
     * Returns the array of weapon equipped on this spacecraft.
     * @returns {Weapon[]}
     */
    Spacecraft.prototype.getWeapons = function () {
        return this._weapons;
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
     * Call if this spacecrafts deals damage to an enemy to update the stored total of damage dealt
     * @param {Number} damage The amount of damage dealt to the enemy
     */
    Spacecraft.prototype.gainDamageDealt = function (damage) {
        this._damageDealt += damage;
    };
    /**
     * Returns how much score destroying this spacecraft should grant (completely, including dealing damage and scoring the final hit)
     * @returns {Number}
     */
    Spacecraft.prototype.getScoreValue = function () {
        return this._scoreValue;
    };
    /**
     * Sets a new position matrix for the physical model of the spacecrafts based on the passed 3D vector.
     * @param {Number[3]} vector
     */
    Spacecraft.prototype.setPhysicalPosition = function (vector) {
        this._physicalModel.setPositionMatrix(mat.translation4v(vector));
    };
    /**
     * Sets a new position matrix (directly) for the physical model of the spacecrafts.
     * @param {Float32Array} value
     */
    Spacecraft.prototype.setPhysicalPositionMatrix = function (value) {
        this._physicalModel.setPositionMatrix(value);
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
        return mat.translationVector3(this._physicalModel.getPositionMatrix());
    };
    /**
     * Sets a new orientation matrix (directly) for the physical model of the spacecrafts.
     * @param {Float32Array} value
     */
    Spacecraft.prototype.setPhysicalOrientationMatrix = function (value) {
        this._physicalModel.setOrientationMatrix(value);
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
     * Returns a 4x4 matrix describing the current scaling and rotation of this spacecraft.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getScaledOriMatrix = function () {
        return mat.prod3x3SubOf4(this.getPhysicalScalingMatrix(), this.getPhysicalOrientationMatrix());
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
    Spacecraft.prototype.getVelocityMatrix = function () {
        return this._physicalModel.getVelocityMatrix();
    };
    /**
     * Returns the 4x4 translation matrix describing the current velocity of this spacecraft in relative (model) space. Uses caching.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getRelativeVelocityMatrix = function () {
        if (!this._relativeVelocityMatrix) {
            this._relativeVelocityMatrix = mat.prodTranslationRotation4(
                    this._physicalModel.getVelocityMatrix(),
                    mat.rotation4m4(this._physicalModel.getRotationMatrixInverse()));
        }
        return this._relativeVelocityMatrix;
    };
    /**
     * Returns the 4x4 rotation matrix describing the current rotation of this spacecraft in relative (model) space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getTurningMatrix = function () {
        if (!this._turningMatrix) {
            this._turningMatrix = mat.prod3x3SubOf4(
                    mat.prod3x3SubOf4(
                            this._physicalModel.getOrientationMatrix(),
                            this._physicalModel.getAngularVelocityMatrix()),
                    mat.rotation4m4(this._physicalModel.getRotationMatrixInverse()));
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
     * Returns the maximum angular acceleration the spacecraft can achieve using its currently equipped propulsion system.
     * @returns {Number} The angular acceleration, in rad/s^2. Zero, if no propulsion is equipped.
     */
    Spacecraft.prototype.getMaxAngularAcceleration = function () {
        return this._propulsion ?
                this._propulsion.getAngularThrust() / this._physicalModel.getMass() :
                0;
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
        return speedDifference * this._physicalModel.getMass() / this._propulsion.getThrust() * this._propulsion.getMaxMoveBurnLevel() / (duration / 1000);
    };
    /**
     * Returns the thruster burn level that is needed to produce the passed difference in angular velocity using the current propulsion 
     * system for the given duration.
     * @param {Number} angularVelocityDifference The angular velocity difference that needs to be produced, in rad / physics.ANGULAR_VELOCITY_MATRIX_DURATION ms !!.
     * * @param {Number} duration The length of time during which the difference needs to be produced, in milliseconds
     * @returns {Number}
     */
    Spacecraft.prototype.getNeededBurnForAngularVelocityChange = function (angularVelocityDifference, duration) {
        return angularVelocityDifference / physics.ANGULAR_VELOCITY_MATRIX_DURATION_S * this._physicalModel.getMass() / this._propulsion.getAngularThrust() * this._propulsion.getMaxTurnBurnLevel() / (duration / 1000);
    };
    // methods
    /**
     * Initializes the properties of this spacecraft based on the data stored
     * in the passed JSON object.
     * @param {Object} dataJSON
     * @param {Spacecraft[]} [spacecraftArray=null] The array of spacecrafts
     * participating in the same battle.
     */
    Spacecraft.prototype.loadFromJSON = function (dataJSON, spacecraftArray) {
        var equipmentProfile;
        this._init(
                classes.getSpacecraftClass(dataJSON.class),
                dataJSON.name,
                dataJSON.position ? mat.translation4v(dataJSON.position) : null,
                mat.rotation4FromJSON(dataJSON.rotations),
                undefined,
                spacecraftArray);
        if (dataJSON.squad) {
            this.setSquad(dataJSON.squad.name, dataJSON.squad.index);
        }
        // equipping the created spacecraft
        // if there is an quipment tag...
        if (dataJSON.equipment) {
            // if a profile is referenced in the equipment tag, look up that profile 
            // and equip according to that
            if (dataJSON.equipment.profile) {
                this.equipProfile(this._class.getEquipmentProfile(dataJSON.equipment.profile));
                // if no profile is referenced, simply create a custom profile from the tags inside
                // the equipment tag, and equip that
            } else {
                equipmentProfile = new classes.EquipmentProfile(dataJSON.equipment);
                this.equipProfile(equipmentProfile);
            }
            // if there is no equipment tag, attempt to load the default profile
        } else if (this._class.getEquipmentProfile(config.getSetting(config.BATTLE_SETTINGS.DEFAULT_EQUIPMENT_PROFILE_NAME)) !== undefined) {
            this.equipProfile(this._class.getEquipmentProfile(config.getSetting(config.BATTLE_SETTINGS.DEFAULT_EQUIPMENT_PROFILE_NAME)));
        }
        if (dataJSON.away) {
            this.setAway(true);
        }
    };
    /**
     * Translates the position of the spacecraft by the given vector.
     * @param {Number[3]} v A 3D vector.
     */
    Spacecraft.prototype.moveByVector = function (v) {
        this._physicalModel.moveByVector(v);
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
     */
    Spacecraft.prototype.changeFlightMode = function (flightMode) {
        this._maneuveringComputer.changeFlightMode(flightMode);
    };
    /**
     * Toggles between free and combat flight modes
     */
    Spacecraft.prototype.toggleFlightAssist = function () {
        this._maneuveringComputer.toggleFlightAssist();
    };
    /**
     * Toggles between cruise and combat flight modes
     */
    Spacecraft.prototype.toggleCruise = function () {
        this._maneuveringComputer.toggleCruise();
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
            return _groupTransformIdentityArray;
        });
        this._hitbox.addSubnode(new sceneGraph.RenderableNode(hitZoneMesh));
    };
    /**
     * Returns the renderable node storing the hitbox models for this spacecraft.
     * @param {Number} [index] If given, the subnode with this index is returned instead
     * @returns {RenerableNode}
     */
    Spacecraft.prototype.getHitbox = function (index) {
        if (index === undefined) {
            return this._hitbox;
        }
        return this._hitbox.getSubnodes()[index];
    };
    /**
     * 
     * @param {Number} lod
     * @param {Boolean} hitbox
     * @param {Boolean} customShader
     */
    Spacecraft.prototype.acquireResources = function (lod, hitbox, customShader) {
        application.log_DEBUG("Requesting resources for spacecraft (" + this._class.getName() + ")...", 2);
        var params = (lod === undefined) ? {maxLOD: graphics.getMaxLoadedLOD()} : {lod: lod};
        if (hitbox) {
            graphics.getShader(config.getSetting(config.BATTLE_SETTINGS.HITBOX_SHADER_NAME));
            graphics.getTexture(config.getSetting(config.BATTLE_SETTINGS.HITBOX_TEXTURE_NAME));
        }
        params.omitShader = customShader;
        this._class.acquireResources(params);
    };
    /**
     * @typedef {Object} Spacecraft~Supplements
     * @property {Boolean} hitboxes
     * @property {Boolean} weapons
     * @property {Boolean} thrusterParticles
     * @property {Boolean} projectileResources
     * @property {Boolean} explosion
     * @property {Boolean} cameraConfigurations
     * @property {Boolean} lightSources
     * @property {Boolean} blinkers
     * @property {Boolean} jumpEngine
     * @property {Boolean} [self=true]
     */
    /**
     * @typedef {Object} Spacecraft~AddToSceneParams
     * @property {String} [shaderName]
     * @property {Float32Array} [positionMatrix]
     * @property {Float32Array} [orientationMatrix]
     * @property {Boolean} [replaceVisualModel=false] If true, the visual model of the spacecraft will be replaced by the newly created one, 
     * if it exists.
     * @property {Number[4]} [factionColor] If given, the faction color of the spacecraft will be replaced by this color (otherwise it is
     * based on the team's faction color)
     * @property {ParameterizedMesh} [visualModel] If a visual model for the spacecraft itself is not created (self from supplements is 
     * false), a visual model can be specified in this parameter that will be used instead of the existing one (when adding supplements)
     * @property {Boolean} [randomAnimationTime=false] If true, the blinking lights on the spacecraft will be set to a random animation
     * state (the same state for all of them)
     */
    /**
     * @function
     * Creates and adds the renderable objects to represent this spacecraft to
     * the passed scene.
     * @param {sceneGraph} scene The scene to which the objects will be added.
     * @param {Number} [lod] The level of detail to use for adding the models.
     * If not given, all available LODs will be added for dynamic LOD rendering.
     * @param {Boolean} [wireframe=false] Whether to add the models in wireframe
     * drawing mode (or in solid).
     * @param {Spacecraft~Supplements} [addSupplements] An object describing what additional
     * supplementary objects / resources to add to the scene along with the
     * basic representation of the ship. Contains boolean properties for each
     * possible supplement, marking if that particular supplement should be 
     * added.
     * @param {Spacecraft~AddToSceneParams} [params]
     * @param {logic~addToSceneCallback} [callback]
     * @param {logic~addToSceneCallback} [weaponCallback]
     */
    Spacecraft.prototype.addToScene = function (scene, lod, wireframe, addSupplements, params, callback, weaponCallback) {
        var i, blinkerDescriptors, visualModel, animationTime;
        addSupplements = addSupplements || {};
        params = params || {};
        // getting resources
        this.acquireResources(lod, addSupplements && (addSupplements.hitboxes === true), !!params.shaderName);
        if (params.shaderName) {
            graphics.getShader(params.shaderName);
        }
        if (addSupplements.weapons === true) {
            for (i = 0; i < this._weapons.length; i++) {
                this._weapons[i].acquireResources(lod, addSupplements.projectileResources);
            }
        }
        // add the thruster particles
        if (addSupplements.thrusterParticles === true) {
            if (this._propulsion) {
                this._propulsion.addThrusters(this._class.getThrusterSlots());
                this._propulsion.acquireResources();
            }
        }
        if (addSupplements.jumpEngine === true) {
            if (this._jumpEngine) {
                this._jumpEngine.acquireResources();
            }
        }
        if (addSupplements.explosion === true) {
            this._class.getExplosionClass().acquireResources();
        }
        if (addSupplements.blinkers === true) {
            blinkerDescriptors = this._class.getBlinkerDescriptors();
            for (i = 0; i < blinkerDescriptors.length; i++) {
                blinkerDescriptors[i].acquireResources();
            }
        }
        resources.executeWhenReady(function () {
            var j, n, node, exp, lightSources, parameterArrays = {}, originalFactionColor, replacementFactionColor;
            application.log_DEBUG("Adding spacecraft (" + this._class.getName() + ") to scene...", 2);
            if (addSupplements.self !== false) {
                // setting up parameter array declarations (name: type)
                parameterArrays[_groupTransformsArrayName] = managedGL.ShaderVariableType.MAT4;
                if (graphics.areLuminosityTexturesAvailable()) {
                    parameterArrays[_luminosityFactorsArrayName] = managedGL.ShaderVariableType.FLOAT;
                }
                visualModel = new renderableObjects.ParameterizedMesh(
                        this._class.getModel(),
                        params.shaderName ? graphics.getManagedShader(params.shaderName) : this._class.getShader(),
                        this._class.getTexturesOfTypes(this._class.getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                        params.positionMatrix || this._physicalModel.getPositionMatrix(),
                        params.orientationMatrix || this._physicalModel.getOrientationMatrix(),
                        mat.scaling4(this._class.getModel().getScale()),
                        (wireframe === true),
                        lod,
                        parameterArrays);
                if (!this._visualModel || params.replaceVisualModel) {
                    this._visualModel = visualModel;
                }
                if (this._name) {
                    visualModel.setName(this._name);
                }
                originalFactionColor = this._class.getFactionColor();
                replacementFactionColor = params.factionColor || (this._team && this._team.getColor()) || originalFactionColor;
                visualModel.setUniformValueFunction(UNIFORM_ORIGINAL_FACTION_COLOR_NAME, function () {
                    return originalFactionColor;
                });
                visualModel.setUniformValueFunction(UNIFORM_REPLACEMENT_FACTION_COLOR_NAME, function () {
                    return replacementFactionColor;
                });
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
                    for (j = 0, n = graphics.getMaxLuminosityFactors(); j < n; j++) {
                        visualModel.setFloatParameter(
                                _luminosityFactorsArrayName,
                                j,
                                this._class.getDefaultGroupLuminosity(j));
                    }
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
                // add the parent objects for the hitboxes
                this._hitbox = new sceneGraph.RenderableNode(new renderableObjects.RenderableObject3D(
                        this._class.getShader(),
                        false,
                        false));
                // add the models for the hitboxes themselves
                for (i = 0; i < this._class.getBodies().length; i++) {
                    this._addHitboxModel(i);
                }
                this._hitbox.hide();
                node.addSubnode(this._hitbox);
            }
            // add the weapons
            if (addSupplements.weapons === true) {
                for (i = 0; i < this._weapons.length; i++) {
                    this._weapons[i].addToScene(node, lod, wireframe, {shaderName: params.shaderName}, weaponCallback);
                }
            }
            // add the thruster particles
            if (addSupplements.thrusterParticles === true) {
                if (this._propulsion) {
                    this._propulsion.addToScene(node);
                }
            }
            // add projectile resources
            if (addSupplements.projectileResources === true) {
                for (i = 0; i < this._weapons.length; i++) {
                    this._weapons[i].addProjectileResourcesToScene(scene);
                }
            }
            // add projectile resources
            if (addSupplements.explosion === true) {
                exp = new explosion.Explosion(this._class.getExplosionClass(), mat.identity4(), mat.identity4(), [0, 0, 0], true);
                exp.addResourcesToScene(scene);
            }
            // add comera configurations
            if (addSupplements.cameraConfigurations === true) {
                this._addCameraConfigurationsForViews();
            }
            // add light sources
            if (addSupplements.lightSources === true) {
                lightSources = this._class.getLightSources();
                for (i = 0; i < lightSources.length; i++) {
                    if (lightSources[i].spotDirection) {
                        scene.addSpotLightSource(new lights.SpotLightSource(lightSources[i].color, lightSources[i].intensity, lightSources[i].position, lightSources[i].spotDirection, lightSources[i].spotCutoffAngle, lightSources[i].spotFullIntensityAngle, [visualModel]));
                    } else {
                        scene.addPointLightSource(
                                new lights.PointLightSource(lightSources[i].color, lightSources[i].intensity, lightSources[i].position, [visualModel]),
                                constants.SPACECRAFT_LIGHT_PRIORITY);
                    }
                }
            }
            // add blinking lights
            if (addSupplements.blinkers === true) {
                for (i = 0; i < this._blinkers.length; i++) {
                    this._blinkers[i].addToScene(node, addSupplements.lightSources);
                    if (params.randomAnimationTime) {
                        if (i === 0) {
                            animationTime = this._blinkers[i].setRandomTime();
                        } else {
                            this._blinkers[i].setTime(animationTime);
                        }
                    }
                }
            }
            // if the spacecraft is away, hide the visuals
            if (this._away) {
                node.hide();
            }
            if (callback) {
                callback(visualModel);
            }
        }.bind(this));
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
                config.getDefaultCameraFOVRange(),
                config.getDefaultCameraSpan(),
                config.getDefaultCameraSpanRange());
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
        if (this._propulsion) {
            this._scoreValue += this._propulsion.getScoreValue();
        }
    };
    /**
     * Equips a weapon of the given class to the ship's next free weapon hard
     * point, if any are available.
     * @param {WeaponClass} weaponClass
     */
    Spacecraft.prototype._addWeapon = function (weaponClass) {
        var slot, weaponSlots = this._class.getWeaponSlots();
        if (this._weapons.length < weaponSlots.length) {
            slot = weaponSlots[this._weapons.length];
            this._weapons.push(new equipment.Weapon(weaponClass, this, slot));
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
     * Removes all equipment from the spacecraft.
     */
    Spacecraft.prototype.unequip = function () {
        var i;
        for (i = 0; i < this._weapons.length; i++) {
            this._weapons[i].destroy();
        }
        this._weapons = [];
        this._propulsion = null;
        this._maneuveringComputer.updateForNewPropulsion();
        this._maneuveringComputer.updateTurningLimit();
        this._updateScoreValue();
    };
    /**
     * Equips the spacecraft according to the specifications in the given equipment
     * profile.
     * @param {EquipmentProfile} [equipmentProfile]
     */
    Spacecraft.prototype.equipProfile = function (equipmentProfile) {
        var i;
        if (equipmentProfile) {
            for (i = 0; i < equipmentProfile.getWeaponDescriptors().length; i++) {
                this._addWeapon(classes.getWeaponClass(equipmentProfile.getWeaponDescriptors()[i].className));
            }
            if (equipmentProfile.getPropulsionDescriptor() !== null) {
                this._addPropulsion(classes.getPropulsionClass(equipmentProfile.getPropulsionDescriptor().className));
            }
            if (equipmentProfile.getJumpEngineDescriptor() !== null) {
                this._addJumpEngine(classes.getJumpEngineClass(equipmentProfile.getJumpEngineDescriptor().className));
            }
        } else {
            application.log("WARNING: equipping empty profile on " + this._class.getName() + "!");
        }
        this._updateScoreValue();
    };
    /**
     * Returns the list of names (IDs) of the available equipment profiles for this spacecraft.
     * @returns {String[]}
     */
    Spacecraft.prototype.getEquipmentProfileNames = function () {
        return this._class.getEquipmentProfileNames();
    };
    /**
     * Fires all of the ship's weapons.
     * @param {Boolean} onlyIfAimedOrFixed Only those weapons are fired which are fixed (cannot be rotated) and those that can be rotated
     * and are currently aimed at their target.
     */
    Spacecraft.prototype.fire = function (onlyIfAimedOrFixed) {
        var i, scaledOriMatrix, fired = false, projectileCount, posInCameraSpace;
        if (!this._firingDisabled) {
            scaledOriMatrix = this.getScaledOriMatrix();
            posInCameraSpace = mat.translationVector3(this.getPositionMatrixInCameraSpace());
            if ((Math.abs(posInCameraSpace[0]) <= _weaponFireSoundStackMinimumDistance) &&
                    (Math.abs(posInCameraSpace[1]) <= _weaponFireSoundStackMinimumDistance) &&
                    (Math.abs(posInCameraSpace[2]) <= _weaponFireSoundStackMinimumDistance)) {
                posInCameraSpace = null;
            }
            for (i = 0; i < this._weapons.length; i++) {
                projectileCount = this._weapons[i].fire(scaledOriMatrix, onlyIfAimedOrFixed, posInCameraSpace ? this.getSoundSource() : null);
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
        }
    };
    /*
     * Increases the number of hits on enemies registered for this spacecraft (for hit ratio calculation)
     */
    Spacecraft.prototype.increaseHitsOnEnemies = function () {
        this._hitsOnEnemies++;
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
     * 
     * @returns {Propulsion}
     */
    Spacecraft.prototype.getPropulsion = function () {
        return this._propulsion;
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
     * @param {Number[3]} damagePosition The relative position vector of where the damage occured.
     * Needs to take into consideration the position, orientation and scaling of the spacecraft.
     * @param {Number[3]} damageDir The relative direction whector indicating where the damage came from.
     * Also needs to take into consideration the orientation of the spacecraft.
     * @param {Spacecraft} hitBy The spacecraft that caused the damage (fired the hitting projectile)
     */
    Spacecraft.prototype.damage = function (damage, damagePosition, damageDir, hitBy) {
        var i, damageIndicator, hitpointThreshold, exp, liveHit, scoreValue;
        // armor rating decreases damage
        damage = Math.max(0, damage - this._class.getArmor());
        liveHit = this._hitpoints > 0;
        // logic simulation: modify hitpoints
        this._hitpoints -= damage;
        if (this._hitpoints <= 0) {
            // granting kill and score to the spacecraft that destroyed this one
            if (liveHit && hitBy && this.isHostile(hitBy)) {
                scoreValue = this.getScoreValue();
                damage += this._hitpoints; // this subtracts the overkill hitpoints
                hitBy.gainDamageDealt(damage);
                // gain score for dealing the damage
                hitBy.gainScore((1 - _scoreFactorForKill) * damage / this._class.getHitpoints() * scoreValue);
                // gain score and kill for delivering the final hit
                hitBy.gainScore(_scoreFactorForKill * scoreValue);
                hitBy.gainKill();
            }
            this._hitpoints = 0;
        } else {
            // visual simulation: add damage indicators if needed
            for (i = 0; i < this._class.getDamageIndicators().length; i++) {
                damageIndicator = this._class.getDamageIndicators()[i];
                hitpointThreshold = damageIndicator.hullIntegrity / 100 * this._class.getHitpoints();
                if ((this._hitpoints <= hitpointThreshold) && (this._hitpoints + damage > hitpointThreshold)) {
                    exp = new explosion.Explosion(
                            damageIndicator.explosionClass,
                            mat.translation4v(damagePosition),
                            mat.identity4(),
                            damageDir,
                            true);
                    exp.addToScene(this._visualModel.getNode(), this.getSoundSource());
                    this._activeDamageIndicators.push(exp);
                }
            }
            // granting score to the spacecraft that hit this one for the damage
            if (liveHit && hitBy && hitBy.isAlive() && this.isHostile(hitBy)) {
                hitBy.gainDamageDealt(damage);
                hitBy.gainScore((1 - _scoreFactorForKill) * damage / this._class.getHitpoints() * this.getScoreValue());
            }
        }
        // callbacks
        this.handleEvent(SpacecraftEvents.BEING_HIT, {spacecraft: hitBy, hitPosition: damagePosition});
        if (hitBy.isAlive() && !hitBy.isAway()) {
            if (hitBy.getTarget() === this) {
                hitBy.handleEvent(SpacecraftEvents.TARGET_HIT);
            }
            hitBy.handleEvent(SpacecraftEvents.ANY_SPACECRAFT_HIT, {
                spacecraft: this
            });
        }
        if (this.isHostile(hitBy)) {
            hitBy.increaseHitsOnEnemies();
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
            if (target && !this._firingDisabled) {
                this._weapons[i].aimTowards(futureTargetPosition, turnThreshold, fireThreshold, this.getScaledOriMatrix(), dt);
            } else {
                this._weapons[i].rotateToDefaultPosition(turnThreshold, dt);
            }
        }
    };
    /**
     * Engages jump engines to leave the scene of the mission
     */
    Spacecraft.prototype.jumpOut = function () {
        if (!this._away && this._jumpEngine) {
            this._jumpEngine.jumpOut();
        } else {
            application.log("Warning! Spacecraft '" + this.getDisplayName() + "' cannot jump out because it is already away or has no jump engines!");
        }
    };
    /**
     * Engages jump engines to enter the scene of the mission
     */
    Spacecraft.prototype.jumpIn = function () {
        if (this._away && this._jumpEngine) {
            this._jumpEngine.jumpIn();
        } else {
            application.log("Warning! Spacecraft '" + this.getDisplayName() + "' cannot jump in because it is already present or has no jump engines!");
        }
    };
    /**
     * Returns a 3D vector that can be used to position the sound source of this spacecraft in the soundscape
     * @returns {Number[3]}
     */
    Spacecraft.prototype._getSoundSourcePosition = function () {
        var result = this.getPositionMatrixInCameraSpace();
        result = [
            parseFloat(result[12].toPrecision(1)),
            parseFloat(result[13].toPrecision(1)),
            parseFloat(result[14].toPrecision(1))
        ];
        return result;
    };
    /**
     * Returns the sound source beloning to this spacecraft (that can be used to play sound effects positioned in 3D)
     * @returns {SoundSource}
     */
    Spacecraft.prototype.getSoundSource = function () {
        if (!this._soundSource) {
            this._soundSource = audio.createSoundSource([0, 0, 0]);
        }
        return this._soundSource;
    };
    /**
     * Starts the playback of the spacecraft hum sound effect (ramping the volume up from zero to avoid popping)
     */
    Spacecraft.prototype._startHumSound = function () {
        var volume = this._humSoundClip.getVolume();
        this._humSoundClip.setVolume(0);
        this._humSoundClip.play();
        this._humSoundClip.rampVolume(volume, HUM_SOUND_VOLUME_RAMP_DURATION, true, true);
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
        this._hitpoints = this._class.getHitpoints();
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
        var i, p;
        if (!this._alive) {
            return;
        }
        if (this._away) {
            return;
        }
        params = params || Spacecraft.DEFAULT_SIMULATE_PARAMS;
        this._targetingComputer.simulate(dt);
        // update the sound source position - will be used either way (for the explosion or for hum / thrusters / weapons... )
        p = this._getSoundSourcePosition();
        this.getSoundSource().setPosition(p[0], p[1], p[2]);
        // destruction of the spacecraft
        if (this._hitpoints <= 0) {
            if (this._timeElapsedSinceDestruction < 0) {
                this._timeElapsedSinceDestruction = 0;
                if (this._humSoundClip) {
                    this._humSoundClip.stopPlaying(audio.SOUND_RAMP_DURATION);
                }
                if (this._propulsion) {
                    this._propulsion.resetThrusterBurn();
                    this._propulsion.simulate(this.getSoundSource(), false);
                }
                this._explosion = new explosion.Explosion(
                        this._class.getExplosionClass(),
                        mat.matrix4(this._physicalModel.getPositionMatrix()),
                        mat.matrix4(this._physicalModel.getOrientationMatrix()),
                        mat.getRowC43(this._physicalModel.getPositionMatrix()),
                        true,
                        mat.matrix4(this._physicalModel.getVelocityMatrix()));
                this._explosion.addToScene(this._visualModel.getNode().getScene().getRootNode(), this.getSoundSource());
                for (i = 0; i < this._activeDamageIndicators; i++) {
                    this._activeDamageIndicators[i].finish();
                }
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
            if (this._propulsion) {
                if (params.controlThrusters) {
                    this._maneuveringComputer.controlThrusters(dt);
                }
                this._propulsion.simulate(this._soundSource, params.applyThrusterForces);
            }
            if (this._jumpEngine) {
                this._jumpEngine.simulate(dt);
            }
            if (this._class.hasHumSound()) {
                if (!this._humSoundClip) {
                    this._humSoundClip = this._class.createHumSoundClip(this._soundSource);
                    if (this._humSoundClip) {
                        this._startHumSound();
                    }
                }
            }
        }
        this._physicalModel.simulate(dt);
        this._relativeVelocityMatrix = null;
        this._turningMatrix = null;
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
        if (this._propulsion) {
            this._propulsion.destroy();
            this._propulsion = null;
        }
        if (this._jumpEngine) {
            this._jumpEngine.destroy();
            this._jumpEngine = null;
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
            this._hitbox.markAsReusable();
        }
        this._hitbox = null;
        if (this._visualModel && this._visualModel.getNode() && !this._visualModel.getNode().canBeReused()) {
            this._visualModel.getNode().markAsReusable();
        }
        this._visualModel = null;
        this._physicalModel = null;
        if (this._activeDamageIndicators) {
            for (i = 0; i < this._activeDamageIndicators.length; i++) {
                this._activeDamageIndicators[i].destroy();
                this._activeDamageIndicators[i] = null;
            }
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
        var i;
        _luminosityFactorsArrayName = config.getSetting(config.GENERAL_SETTINGS.UNIFORM_LUMINOSITY_FACTORS_ARRAY_NAME);
        _groupTransformsArrayName = config.getSetting(config.GENERAL_SETTINGS.UNIFORM_GROUP_TRANSFORMS_ARRAY_NAME);
        _groupTransformIdentityArray = new Float32Array(graphics.getMaxGroupTransforms() * 16);
        for (i = 0; i < _groupTransformIdentityArray.length; i++) {
            _groupTransformIdentityArray[i] = mat.IDENTITY4[i % 16];
        }
        _hitZoneColor = config.getSetting(config.BATTLE_SETTINGS.HITBOX_COLOR);
        _weaponFireSoundStackMinimumDistance = config.getSetting(config.BATTLE_SETTINGS.WEAPON_FIRE_SOUND_STACK_MINIMUM_DISTANCE);
        _scoreFactorForKill = config.getSetting(config.BATTLE_SETTINGS.SCORE_FRACTION_FOR_KILL);
    });
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        Spacecraft: Spacecraft
    };
});