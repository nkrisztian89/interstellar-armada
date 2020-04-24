/**
 * Copyright 2014-2020 Krisztián Nagy
 * @file Implementation of loading and managing missions - including the main game simulation loop
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*global define, Element, Float32Array, performance, localStorage */

/**
 * @param utils Used for format strings and useful constants
 * @param types Used for type checking when loading from local storage
 * @param mat Matrices are widely used for 3D simulation
 * @param application Used for file loading and logging functionality
 * @param game Used to dispatch messages to BattleScreen
 * @param asyncResource LogicContext is a subclass of AsyncResource
 * @param resources Used to access the loaded media (graphics and sound) resources
 * @param resourceManager Used for storing the mission descriptors in a resource manager 
 * @param pools Used to access the pools for particles and projectiles
 * @param egomModel
 * @param camera Used for creating camera configurations for views
 * @param renderableObjects Used for creating visual models for game objects
 * @param constants Used for Accessing global localStorage prefixes
 * @param graphics Used to access graphics settings
 * @param classes Used to load and access the classes of Interstellar Armada
 * @param config Used to access game settings/configuration
 * @param strings Used for translation support
 * @param logicConstants Used for accessing pool names
 * @param environments Used for creating environments
 * @param SpacecraftEvents Used to trigger spacecraft events
 * @param spacecraft Used for creating spacecrafts
 * @param equipment Used for accessing the common projectile pool
 * @param explosion Used for explosion pool management
 * @param ai Used for setting the artificial intelligence pilots when creating a mission.
 */
define([
    "utils/utils",
    "utils/types",
    "utils/matrices",
    "modules/application",
    "modules/game",
    "modules/async-resource",
    "modules/resource-manager",
    "modules/media-resources",
    "modules/pools",
    "modules/egom-model",
    "modules/scene/camera",
    "modules/scene/renderable-objects",
    "armada/constants",
    "armada/graphics",
    "armada/logic/classes",
    "armada/configuration",
    "armada/strings",
    "armada/logic/constants",
    "armada/logic/environments",
    "armada/logic/SpacecraftEvents",
    "armada/logic/spacecraft",
    "armada/logic/equipment",
    "armada/logic/explosion",
    "armada/logic/ai",
    "utils/polyfill"
], function (
        utils, types, mat,
        application, game, asyncResource, resourceManager, resources, pools, egomModel,
        camera, renderableObjects,
        constants, graphics, classes, config, strings,
        logicConstants, environments, SpacecraftEvents, spacecraft, equipment, explosion, ai) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // enums
            TriggerConditionsRequired = {
                /** All the conditions need to be satisfied for the trigger state to be considered true */
                ALL: "all",
                /** Any if the conditions being satisfied causes the trigger state to be considered true */
                ANY: "any"
            },
            TriggerFireWhen = {
                /** The trigger fires ones at the very first simulation step of the mission (must be oneShot) */
                MISSION_STARTS: "missionStarts",
                /** The trigger fires in every simulation step when its condition state is true */
                TRUE: "true",
                /** The trigger fires in every simulation step when its condition state is false */
                FALSE: "false",
                /** The trigger fires in every simulation step when its condition state is different from the previous step */
                CHANGE: "change",
                /** The trigger fires in every simulation step when its condition state changes to true from false */
                CHANGE_TO_TRUE: "changeToTrue",
                /** The trigger fires in every simulation step when its condition state changes to false from true */
                CHANGE_TO_FALSE: "changeToFalse"
            },
            ConditionType = {
                /** The condition is evaluated true when all of its subjects are destroyed */
                DESTROYED: "destroyed",
                /** The condition is evaluated true based on the count of still alive spacecrafts from its subjects */
                COUNT: "count",
                /** The condition is evaluated true based on the time elapsed since the start of the mission or the firing of a trigger */
                TIME_ELAPSED: "timeElapsed"
            },
            CountConditionRelation = {
                /** The condition is satisfied when there are less subjects alive than the specified count */
                BELOW: "below",
                /** The condition is satisfied when there are more subjects alive than the specified count */
                ABOVE: "above",
                /** The condition is satisfied when there are exactly as many subjects alive as the specified count */
                EQUALS: "equals"
            },
            TimeConditionSatisfiedWhen = {
                /** The condition is satisfied until the specified time has elapsed */
                BEFORE: "before",
                /** The condition is satisfied starting from when the specified time has elapsed */
                AFTER: "after",
                /** The condition is satisfied when exactly the specified time has elapsed (if the start
                 * is a trigger, counted from the first time the trigger is fired) */
                ONCE: "once",
                /** The condition is satisfied every time the specified time has been elapsed, in a looping fashion */
                REPEAT: "repeat"
            },
            ActionType = {
                /** Executing this action marks the mission as complete */
                WIN: "win",
                /** Executing this action marks the mission as failed */
                LOSE: "lose",
                /** Executing this action queues a message to be displayed on the HUD */
                MESSAGE: "message",
                /** Executing this action clears the HUD message queue */
                CLEAR_MESSAGES: "clearMessages",
                /** Executing this action sends a command to the subject spacecrafts (to be processed by their AIs) */
                COMMAND: "command",
                /** Executing this action changes the state of the HUD on the piloted spacecraft (e.g. hide / show / highlight an element) */
                HUD: "hud"
            },
            MissionState = {
                // in progress states
                /** There is no player or no objectives for the player, and no ships hostile to each other (peaceful sandbox) */
                NONE: 0,
                /** There is no player or no objectives for the player, but there are hostiles battling each other (demo, battle sandbox) */
                BATTLE: 1,
                /** There are objectives left to complete (regular mission) */
                IN_PROGRESS: 2,
                // finished states
                /** All the objectives have been completed, the mission is a success */
                COMPLETED: 3,
                /** The player failed at least one objective, the mission is a failure */
                FAILED: 4,
                /** The player's spacecraft has been destroyed */
                DEFEAT: 5,
                /** A battle without a piloted spacecraft (player) has ended */
                ENDED: 6
            },
            /**
             * Objectives displayed on the HUD are colored based on this
             */
            ObjectiveState = {
                IN_PROGRESS: 0,
                COMPLETED: 1,
                FAILED: 2
            },
            // ------------------------------------------------------------------------------
            // constants
            /**
             * The ID for mission performance indicating that the mission failed. Performance level IDs for successful missions are defined
             * in config.json
             * @type String
             */
            FAILED_MISSION_PERFORMACE = "failed",
            /**
             * Mission related local storage IDs start with this prefix
             * @type String
             */
            MODULE_LOCAL_STORAGE_PREFIX = constants.LOCAL_STORAGE_PREFIX + "missions_",
            /**
             * The key identifying the location where the default difficulty setting is stored in local storage.
             * @type String
             */
            DIFFICULTY_LOCAL_STORAGE_ID = MODULE_LOCAL_STORAGE_PREFIX + "difficulty",
            /**
             * Used to choose the array of mission descriptors when loading the configuration of the mission resource manager
             * @type String
             */
            MISSION_ARRAY_NAME = "missions",
            /**
             * When adding ships without a team to a mission in demo mode, they will be automatically put into a team with
             * this name, with an ID that equals the index of the spacecraft added + 1 (converted to string).
             * @type String
             */
            GENERIC_TEAM_NAME = "team",
            GRID_MODEL_NAME = "grid",
            MARKER_MODEL_NAME = "marker",
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * Cached value of the configuration setting for toggling hitbox visibility based on for which objects are hitchecks calculated.
             * @type Boolean
             */
            _showHitboxesForHitchecks,
            /**
             * Cached value of the configuration setting of the name of the uniform array storing the group transforms for models.
             * @type String
             */
            _groupTransformsArrayName = null,
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
             * A pool containing explosions for reuse, so that creation of new explosion objects can be decreased for optimization.
             * @type Pool
             */
            _explosionPool,
            /**
             * The context storing the current settings and game data that can be accessed through the interface of this module
             * @type MissionContext
             */
            _context,
            /**
             * Contains the constructor function of the Condition subclass for each ConditionType identifier.
             * @type Object.<String, Function>
             */
            _conditionConstructors,
            /**
             * Contains the constructor function of the Action subclass for each ActionType identifier.
             * @type Object.<String, Function>
             */
            _actionConstructors,
            /**
             * This string is available to other modules through a public function so that an arbitrary piece of information from this 
             * module can be exposed for debug purposes.
             * @type String
             */
            _debugInfo = "";
    // -------------------------------------------------------------------------
    // Freezing enums
    Object.freeze(TriggerConditionsRequired);
    Object.freeze(TriggerFireWhen);
    Object.freeze(ConditionType);
    Object.freeze(TimeConditionSatisfiedWhen);
    Object.freeze(ActionType);
    Object.freeze(MissionState);
    // -------------------------------------------------------------------------
    // Public functions
    /**
     * Queries a module-level string for debug purposes.
     * @returns {String}
     */
    function getDebugInfo() {
        return _debugInfo;
    }
    // #########################################################################
    /**
     * @class
     * A team to which spacecrafts can belong to that determines which spacecrafts are hostile and friendly towards each other.
     * @param {String|Object} idOrParams
     */
    function Team(idOrParams) {
        /**
         * The unique string ID of this team.
         * @type String
         */
        this._id = null;
        /**
         * A string name of this team to be used for chosing the translated displayed name.
         * @type String
         */
        this._name = null;
        /**
         * The color to use when replacing original faction colors of spacecrafts belonging to this team.
         * @tpye Number[4]
         */
        this._color = null;
        if (typeof idOrParams === "string") {
            this._id = idOrParams;
            this._name = idOrParams;
        } else if (typeof idOrParams === "object") {
            this._id = idOrParams.id || idOrParams.name || application.showError("Team defined without a name or id!");
            this._name = idOrParams.name || idOrParams.id;
            this._color = idOrParams.color || null;
        } else {
            application.showError("Invalid parameter specified for Team constructor!");
        }
        /**
         * The number of spacecrafts belonging to this team at the start of the current mission
         * @type Number
         */
        this._initialCount = 0;
        /**
         * Stores the names and craft references for all squads that are part of this team (i.e. for the wingmen status indicator)
         * (includes references to already destroyed spacecrafts)
         * format of one entry: {name: String (name (id) of squad), crafts: Array (references to the spacecrafts in the squad)}
         * @type Array
         */
        this._squads = [];
    }
    /**
     * Returns the unique string ID of this team.
     * @returns {String}
     */
    Team.prototype.getID = function () {
        return this._id;
    };
    /**
     * Returns the translated, human-readable unique name of this team.
     * @returns {String}
     */
    Team.prototype.getDisplayName = function () {
        return utils.formatString(strings.get(strings.TEAM.PREFIX, this._name), {
            id: this._id
        });
    };
    /**
     * Returns the color to use when replacing original faction colors of spacecrafts belonging to this team.
     * @returns {Number[4]}
     */
    Team.prototype.getColor = function () {
        return this._color;
    };
    /**
     * Returns the number of spacecrafts belonging to this team at the start of the current mission
     * @returns {Number}
     */
    Team.prototype.getInitialCount = function () {
        return this._initialCount;
    };
    /**
     * Registers the passed spacecraft as part of this team
     * @param {Spacecraft} craft 
     */
    Team.prototype.addSpacecraft = function (craft) {
        var i, maxMembers, squad = craft.getSquad();
        craft.setTeam(this);
        // setting squad info so that it can be queried later (for example to show wingmen status for this team)
        if (squad) {
            // if the squad of this new spacecraft is already registered, add the craft to it
            for (i = 0; i < this._squads.length; i++) {
                if (squad === this._squads[i].name) {
                    this._squads[i].crafts.push(craft);
                    break;
                }
            }
            // ...if not register the new squad
            if (i >= this._squads.length) {
                this._squads.push({
                    name: squad,
                    crafts: [craft]
                });
            }
            maxMembers = config.getHUDSetting(config.BATTLE_SETTINGS.HUD.WINGMEN_STATUS_CRAFT_POSITIONS).length;
            if (this._squads[i].crafts.length > maxMembers) {
                application.showError("Warning: squad '" + squad + "' of team '" + this._name + "' has more than " + maxMembers + " members, and thus cannot be displayed correctly in the wingmen status panel!");
            }
        }
        // using this counter the survival rate can be calculated at the end of the mission (and in case of the player's team, whether it
        // is/was a team mission)
        this._initialCount++;
    };
    /**
     * Returns the names and craft references for all squads that are part of this team (i.e. for the wingmen status indicator)
     * (includes references to already destroyed spacecrafts)
     * format of one entry: {name: String (name (id) of squad), crafts: Array (references to the spacecrafts in the squad)}
     * @returns {Array}
     */
    Team.prototype.getSquads = function () {
        return this._squads;
    };
    // #########################################################################
    /**
     * @class
     * An octree node that is used to partition spacecrafts. Recursively divides the given list of spacecrafts among its subnodes and can
     * retrieve a subset of this list belonging to an area in space by choosing the appropriate subnodes.
     * @param {Spacecraft[]} objects The list of spacecrafts belonging to this node. (to be divided among its subnodes)
     * @param {Number} maximumDepth The maximum number of levels below this node that should be created when dividing the objects.
     * @param {Number} maximumObjectCount If the node has this much or fewer objects, it will not divide them further (become a leaf node)
     * @param {Boolean} [isRootNode=false] If true, the node will calculate boundaries based on the contained spacecrafts and whenever
     * asked for spacecrafts in a region outside these boundaries, it will return an emptry list instead of recursively checking its
     * subnodes.
     */
    function Octree(objects, maximumDepth, maximumObjectCount, isRootNode) {
        /**
         * The list of spacecrafts belonging to this node.
         * @type Spacecraft[]
         */
        this._objects = objects;
        /**
         * The world coordinates of the point in space which divides the region beloning to this node to 8 subregions (2x2x2), which belong
         * to its subnodes. Null in the case of leaf nodes.
         * @type Number[3]
         */
        this._center = null;
        /*
         * The minimum and maximum coordinates for the 3 axes where any part of any of the contained spacecrafts reside.
         * @type Number[2][3]
         */
        this._boundaries = null;
        if (this._objects.length > 0) {
            this._calculateCenter(isRootNode);
        }
        /**
         * The subnodes of this node, or null in case of leaf nodes.
         * @type Octree[8]
         */
        this._subnodes = (maximumDepth > 0) && (this._objects.length > maximumObjectCount) ? this._generateSubnodes(maximumDepth - 1, maximumObjectCount) : null;
    }
    /**
     * Calculates and saves the center point for this node based on the associated spacecrafts. (their average position)
     * @param {Boolean} [isRootNode=false] If true, also calculates and saves boundaries.
     */
    Octree.prototype._calculateCenter = function (isRootNode) {
        var i, n, x = 0, y = 0, z = 0, p, s;
        if (isRootNode) {
            p = this._objects[0].getPhysicalModel().getPositionMatrix();
            s = this._objects[0].getPhysicalModel().getSize();
            this._boundaries = [[p[0] - s, p[0] + s], [p[1] - s, p[1] + s], [p[2] - s, p[2] + s]];
        }
        for (i = 0, n = this._objects.length; i < n; i++) {
            p = this._objects[i].getPhysicalModel().getPositionMatrix();
            x += p[12];
            y += p[13];
            z += p[14];
            if (isRootNode) {
                s = this._objects[i].getPhysicalModel().getSize();
                if ((p[12] - s) < this._boundaries[0][0]) {
                    this._boundaries[0][0] = p[12] - s;
                }
                if ((p[12] + s) > this._boundaries[0][1]) {
                    this._boundaries[0][1] = p[12] + s;
                }
                if ((p[13] - s) < this._boundaries[1][0]) {
                    this._boundaries[1][0] = p[13] - s;
                }
                if ((p[13] + s) > this._boundaries[1][1]) {
                    this._boundaries[1][1] = p[13] + s;
                }
                if ((p[14] - s) < this._boundaries[2][0]) {
                    this._boundaries[2][0] = p[14] - s;
                }
                if ((p[14] + s) > this._boundaries[2][1]) {
                    this._boundaries[2][1] = p[14] + s;
                }
            }
        }
        x /= n;
        y /= n;
        z /= n;
        this._center = [x, y, z];
    };
    /**
     * Creates and returns the list of subnodes for this node by dividing its objects among them based on its center point and the given 
     * parameters.
     * @param {Number} maximumDepth The subnodes will generate further subnodes up to this many times.
     * @param {Number} maximumObjectCount Nodes containing this much or fewer spacecrafts will become leaf nodes and not divide them 
     * further.
     * @returns {Octree[8]}
     */
    Octree.prototype._generateSubnodes = function (maximumDepth, maximumObjectCount) {
        var
                /** @type Number */
                i, n, size,
                /** @type Object */
                o,
                /** @type Float32Array */
                p,
                /** [l]ow/[h]igh[x]/[y]/[z] 
                 * @type Array */
                lxlylz, lxlyhz, lxhylz, lxhyhz, hxlylz, hxlyhz, hxhylz, hxhyhz, result;
        for (i = 0, n = this._objects.length; i < n; i++) {
            o = this._objects[i];
            p = o.getPhysicalModel().getPositionMatrix();
            size = o.getPhysicalModel().getSize();
            if ((p[12] - size) < this._center[0]) {
                if ((p[13] - size) < this._center[1]) {
                    if ((p[14] - size) < this._center[2]) {
                        lxlylz = lxlylz || [];
                        lxlylz.push(o);
                    }
                    if ((p[14] + size) >= this._center[2]) {
                        lxlyhz = lxlyhz || [];
                        lxlyhz.push(o);
                    }
                }
                if ((p[13] + size) >= this._center[1]) {
                    if ((p[14] - size) < this._center[2]) {
                        lxhylz = lxhylz || [];
                        lxhylz.push(o);
                    }
                    if ((p[14] + size) >= this._center[2]) {
                        lxhyhz = lxhyhz || [];
                        lxhyhz.push(o);
                    }
                }
            }
            if ((p[12] + size) >= this._center[0]) {
                if ((p[13] - size) < this._center[1]) {
                    if ((p[14] - size) < this._center[2]) {
                        hxlylz = hxlylz || [];
                        hxlylz.push(o);
                    }
                    if ((p[14] + size) >= this._center[2]) {
                        hxlyhz = hxlyhz || [];
                        hxlyhz.push(o);
                    }
                }
                if ((p[13] + size) >= this._center[1]) {
                    if ((p[14] - size) < this._center[2]) {
                        hxhylz = hxhylz || [];
                        hxhylz.push(o);
                    }
                    if ((p[14] + size) >= this._center[2]) {
                        hxhyhz = hxhyhz || [];
                        hxhyhz.push(o);
                    }
                }
            }
        }
        result = new Array(8);
        result[0] = new Octree(lxlylz || utils.EMPTY_ARRAY, maximumDepth, maximumObjectCount, false);
        result[1] = new Octree(lxlyhz || utils.EMPTY_ARRAY, maximumDepth, maximumObjectCount, false);
        result[2] = new Octree(lxhylz || utils.EMPTY_ARRAY, maximumDepth, maximumObjectCount, false);
        result[3] = new Octree(lxhyhz || utils.EMPTY_ARRAY, maximumDepth, maximumObjectCount, false);
        result[4] = new Octree(hxlylz || utils.EMPTY_ARRAY, maximumDepth, maximumObjectCount, false);
        result[5] = new Octree(hxlyhz || utils.EMPTY_ARRAY, maximumDepth, maximumObjectCount, false);
        result[6] = new Octree(hxhylz || utils.EMPTY_ARRAY, maximumDepth, maximumObjectCount, false);
        result[7] = new Octree(hxhyhz || utils.EMPTY_ARRAY, maximumDepth, maximumObjectCount, false);
        return result;
    };
    /**
     * Returns the list of spacecrafts inside the region specified by the given boundaries using the spatial partitions represented by this
     * node and its subnodes.
     * @param {Number} minX
     * @param {Number} maxX
     * @param {Number} minY
     * @param {Number} maxY
     * @param {Number} minZ
     * @param {Number} maxZ
     * @returns {Spacecraft[]}
     */
    Octree.prototype.getObjects = function (minX, maxX, minY, maxY, minZ, maxZ) {
        var result;
        if (!this._subnodes) {
            return this._objects;
        }
        if (this._boundaries) {
            if ((maxX < this._boundaries[0][0]) || (minX > this._boundaries[0][1]) ||
                    (maxY < this._boundaries[1][0]) || (minY > this._boundaries[1][1]) ||
                    (maxZ < this._boundaries[2][0]) || (minZ > this._boundaries[2][1])) {
                return utils.EMPTY_ARRAY;
            }
        }
        result = [];
        if (minX < this._center[0]) {
            if (minY < this._center[1]) {
                if (minZ < this._center[2]) {
                    result = result.concat(this._subnodes[0].getObjects(minX, maxX, minY, maxY, minZ, maxZ));
                }
                if (maxZ >= this._center[2]) {
                    result = result.concat(this._subnodes[1].getObjects(minX, maxX, minY, maxY, minZ, maxZ));
                }
            }
            if (maxY >= this._center[1]) {
                if (minZ < this._center[2]) {
                    result = result.concat(this._subnodes[2].getObjects(minX, maxX, minY, maxY, minZ, maxZ));
                }
                if (maxZ >= this._center[2]) {
                    result = result.concat(this._subnodes[3].getObjects(minX, maxX, minY, maxY, minZ, maxZ));
                }
            }
        }
        if (maxX >= this._center[0]) {
            if (minY < this._center[1]) {
                if (minZ < this._center[2]) {
                    result = result.concat(this._subnodes[4].getObjects(minX, maxX, minY, maxY, minZ, maxZ));
                }
                if (maxZ >= this._center[2]) {
                    result = result.concat(this._subnodes[5].getObjects(minX, maxX, minY, maxY, minZ, maxZ));
                }
            }
            if (maxY >= this._center[1]) {
                if (minZ < this._center[2]) {
                    result = result.concat(this._subnodes[6].getObjects(minX, maxX, minY, maxY, minZ, maxZ));
                }
                if (maxZ >= this._center[2]) {
                    result = result.concat(this._subnodes[7].getObjects(minX, maxX, minY, maxY, minZ, maxZ));
                }
            }
        }
        return result;
    };
    // #########################################################################
    /**
     * @typedef {Object} Missions~SubjectsDescriptor
     * @property {String[]} [spacecrafts] 
     * @property {String[]} [squads] 
     * @property {String[]} [teams] 
     */
    /**
     * @class Represents a group of spacecrafts within a mission. (which can be subjects of conditions or actions)
     * @param {Missions~SubjectsDescriptor} dataJSON
     */
    function SubjectGroup(dataJSON) {
        /**
         * Contains the IDs of the spacecrafts, squads and teams this group consists of
         * @type Missions~SubjectsDescriptor
         */
        this._descriptor = dataJSON || {};
        /**
         * References to the actual spacecrafts in the mission that are identified by instance are stored in this field for quicker 
         * access
         * @type Spacecraft[]
         */
        this._spacecrafts = null;
        /**
         * The cached string that can be used to display the subjects to the user in a short way, to be used on the HUD
         * @type String
         */
        this._shortString = null;
    }
    /**
     * Returns whether the passed spacecraft is a subject belonging to this subject group
     * @param {Spacecraft} spacecraft
     * @returns {Boolean}
     */
    SubjectGroup.prototype.has = function (spacecraft) {
        return (this._descriptor.spacecrafts && (this._descriptor.spacecrafts.indexOf(spacecraft.getID()) >= 0)) ||
                (this._descriptor.squads && (this._descriptor.squads.indexOf(spacecraft.getSquad()) >= 0)) ||
                (this._descriptor.teams && (this._descriptor.teams.indexOf(spacecraft.getTeam().getID()) >= 0));
    };
    /**
     * Gathers and caches references to the spacecrafts in the passed mission that are in this subject group, for faster future use
     * @param {Mission} mission
     */
    SubjectGroup.prototype._cacheSpacecrafts = function (mission) {
        var i, spacecrafts;
        this._spacecrafts = [];
        spacecrafts = mission.getSpacecrafts();
        for (i = 0; i < spacecrafts.length; i++) {
            if (this.has(spacecrafts[i])) {
                this._spacecrafts.push(spacecrafts[i]);
            }
        }
    };
    /**
     * Returns an array with the spacecrafts that are in this subject group (based on the passed mission)
     * @param {Mission} mission
     * @param {Boolean} [reload=false] If true, the list of spacecrafts is queried from the mission again, even if 
     * it has been cached before (and thus will not include ships that were destroyed, for example)
     * @returns {Spacecraft[]}
     */
    SubjectGroup.prototype.getSpacecrafts = function (mission, reload) {
        if (mission && (!this._spacecrafts || reload)) {
            this._cacheSpacecrafts(mission);
        }
        return this._spacecrafts;
    };
    /**
     * 
     * @param {String} subjectID
     * @returns {String}
     */
    SubjectGroup._mapSpacecraftID = function (subjectID) {
        return strings.getDefiniteArticleForWord(subjectID) + " <strong>" + subjectID + "</strong>";
    };
    /**
     * 
     * @param {Array} subjectIDs
     * @returns {String}
     */
    SubjectGroup._getMappedSpacecraftIDs = function (subjectIDs) {
        return strings.getList(subjectIDs.map(SubjectGroup._mapSpacecraftID));
    };
    /**
     * 
     * @param {String} subjectID
     * @returns {String}
     */
    SubjectGroup._mapSquadID = function (subjectID) {
        subjectID = strings.get(strings.SQUAD.PREFIX, subjectID);
        return strings.getDefiniteArticleForWord(subjectID) + " <strong>" + subjectID + "</strong>";
    };
    /**
     * 
     * @param {Array} subjectIDs
     * @returns {String}
     */
    SubjectGroup._getMappedSquadIDs = function (subjectIDs) {
        return strings.getList(subjectIDs.map(SubjectGroup._mapSquadID));
    };
    /**
     * 
     * @param {String} subjectID
     * @returns {String}
     */
    SubjectGroup._mapTeamID = function (subjectID) {
        subjectID = strings.get(strings.TEAM.PREFIX, subjectID);
        return strings.getDefiniteArticleForWord(subjectID) + " <strong>" + subjectID + "</strong>";
    };
    /**
     * 
     * @param {Array} subjectIDs
     * @returns {String}
     */
    SubjectGroup._getMappedTeamIDs = function (subjectIDs) {
        return strings.getList(subjectIDs.map(SubjectGroup._mapTeamID));
    };
    /**
     * Returns a translated string that can be used to display the subjects to the player (used in the Missions screen)
     * @returns {String}
     */
    SubjectGroup.prototype.toString = function () {
        var result = "";
        if (this._descriptor.spacecrafts) {
            result += SubjectGroup._getMappedSpacecraftIDs(this._descriptor.spacecrafts);
        }
        if (this._descriptor.squads) {
            if (result.length > 0) {
                result += "; ";
            }
            result += utils.formatString(strings.get((this._descriptor.squads.length > 1) ?
                    strings.MISSIONS.OBJECTIVE_SUBJECTS_SQUADS :
                    strings.MISSIONS.OBJECTIVE_SUBJECTS_SQUAD), {
                ids: SubjectGroup._getMappedSquadIDs(this._descriptor.squads)
            });
        }
        if (this._descriptor.teams) {
            if (result.length > 0) {
                result += "; ";
            }
            result += utils.formatString(strings.get((this._descriptor.teams.length > 1) ?
                    strings.MISSIONS.OBJECTIVE_SUBJECTS_TEAMS :
                    strings.MISSIONS.OBJECTIVE_SUBJECTS_TEAM), {
                ids: SubjectGroup._getMappedTeamIDs(this._descriptor.teams)
            });
        }
        return result;
    };
    /**
     * Returns how many of the subjects are still alive
     * @param {Boolean} [presentOnly=false] If true, only the spacecrafts that are present (not away) are counted 
     * @returns {Number}
     */
    SubjectGroup.prototype.getLiveSubjectCount = function (presentOnly) {
        var result = 0, i;
        for (i = 0; i < this._spacecrafts.length; i++) {
            if (this._spacecrafts[i].isAlive() && (!presentOnly || !this._spacecrafts[i].isAway())) {
                result++;
            }
        }
        return result;
    };
    /**
     * Returns a short translated string that can be used to display the subjects to the player (used on the HUD in battle)
     * @returns {String}
     */
    SubjectGroup.prototype.getShortString = function () {
        if (!this._shortString) {
            if (this._descriptor.spacecrafts && !this._descriptor.squads && !this._descriptor.teams) {
                if (this._spacecrafts.length > 1) {
                    this._shortString = utils.formatString(strings.get(strings.BATTLE.OBJECTIVE_SUBJECTS_SPACECRAFTS), {count: this._spacecrafts.length});
                } else {
                    this._shortString = this._spacecrafts[0].getDisplayName();
                }
            } else if (!this._descriptor.spacecrafts && this._descriptor.squads && !this._descriptor.teams) {
                if (this._descriptor.squads.length > 1) {
                    this._shortString = utils.formatString(strings.get(strings.BATTLE.OBJECTIVE_SUBJECTS_SQUADS), {count: this._descriptor.squads.length});
                } else {
                    this._shortString = strings.get(strings.SQUAD.PREFIX, this._descriptor.squads[0]);
                }
            } else if (!this._descriptor.spacecrafts && !this._descriptor.squads && this._descriptor.teams) {
                if (this._descriptor.teams.length > 1) {
                    this._shortString = utils.formatString(strings.get(strings.BATTLE.OBJECTIVE_SUBJECTS_TEAMS), {count: this._descriptor.teams.length});
                } else {
                    this._shortString = strings.get(strings.TEAM.PREFIX, this._descriptor.teams[0]);
                }
            } else {
                this._shortString = utils.formatString(strings.get(strings.BATTLE.OBJECTIVE_SUBJECTS_SPACECRAFTS), {count: this._spacecrafts.length});
            }
        }
        return this._shortString;
    };
    // #########################################################################
    /**
     * @class A condition that can be evaluated in every simulation step of the mission to be found either true (satisfied) or false, and 
     * can be used to fire triggers.
     * This is a base class that needs to be subclassed for each different condition type:
     * - override _checkParams() and isSatisfied() 
     * - add a new corresponding ConditionType and register the subclass for it in _conditionConstructors
     * - if the condition can correspond to a mission objective, override getObjectiveString() and getObjectiveStateString()
     * @param {Object} dataJSON The object storing the data for the condition
     */
    function Condition(dataJSON) {
        /**
         * (enum ConditionType) 
         * The nature of this condition, ultimately decides how the condition is evaluated
         * @type String
         */
        this._type = dataJSON ? utils.getSafeEnumValue(ConditionType, dataJSON.type, null) : null;
        /**
         * The spacecrafts / groups of spacecrafts that determine the subjects of the condition
         * @type SubjectGroup
         */
        this._subjects = dataJSON ? new SubjectGroup(dataJSON.subjects) : null;
        if (dataJSON) {
            this._checkParams(dataJSON.params);
        }
    }
    /**
     * Shows the error message indicating that there was a problem validating the parameters defined for this condition
     */
    Condition.prototype._handleWrongParams = function () {
        application.showError("Wrong parameters specified for condition of type: '" + this._type + "'!");
    };
    /**
     * Based on the type of the condition, checks whether it has all the appropriate parameters set in the passed object, 
     * and outputs errors if it doesn't
     * Override this to add the appropriate checks!
     * @returns {Boolean} Whether the parameters passed are valid for this condition
     */
    Condition.prototype._checkParams = function () {
        application.showError("Unrecognized condition type: '" + this._type + "'!");
        return false;
    };
    /**
     * Returns whether the condition is considered to be satisfied (true) according to the current state of the passed mission
     * Override this to add the appropriate satisfaction checks!
     * @returns {Boolean}
     */
    Condition.prototype.isSatisfied = function () {
        application.showError("Unrecognized condition type: '" + this._type + "'!");
        return false;
    };
    /**
     * Returns a translated sentence that can be used to display a mission objective to the user that is based on this condition (for either
     * winning or losing). The prefix to be passed determines whether it should be considered a winning or losing condition
     * Override this for conditions that can correspond to mission objectives.
     * @returns {String}
     */
    Condition.prototype.getObjectiveString = function () {
        application.showError("No mission objective string associated with condition type: '" + this._type + "'!");
        return null;
    };
    /**
     * Returns a translated string that can be used to display a mission objective and its status to the player based on this condition 
     * (for either winning or losing). The prefix to be passed determines whether it should be considered a winning or losing condition
     * To be used on the HUD for displaying live status of objectives
     * Overidde this for conditions that can correspond to mission objectives.
     * @returns {String}
     */
    Condition.prototype.getObjectiveStateString = function () {
        application.showError("No mission objective string associated with condition type: '" + this._type + "'!");
        return null;
    };
    /**
     * If the condition corresponds to a mission objective that requires the player to destroy some spacecrafts, this method
     * returns the list of these target spacecrafts.
     * Overidde this for conditions that can correspond to mission objectives.
     * @returns {Spacecraft[]}
     */
    Condition.prototype.getTargetSpacecrafts = function () {
        application.showError("No target spacecrafts associated with condition type: '" + this._type + "'!");
        return null;
    };
    /**
     * If the condition corresponds to a mission objective that requires the player to escort (protect) some spacecrafts, this method
     * returns the list of these escorted spacecrafts.
     * Overidde this for conditions that can correspond to mission objectives.
     * @returns {Spacecraft[]}
     */
    Condition.prototype.getEscortedSpacecrafts = function () {
        application.showError("No escorted spacecrafts associated with condition type: '" + this._type + "'!");
        return null;
    };
    // ##############################################################################
    /**
     * @class A condition that is satisfied when all of its subjects have been destroyed
     * @extends Condition
     * @param {Object} dataJSON
     */
    function DestroyedCondition(dataJSON) {
        Condition.call(this, dataJSON);
    }
    DestroyedCondition.prototype = new Condition();
    DestroyedCondition.prototype.constructor = DestroyedCondition;
    /**
     * @override
     * This condition has no parameters - always returns true.
     */
    DestroyedCondition.prototype._checkParams = function () {
        return true;
    };
    /**
     * @override
     * @param {Mission} mission
     * @returns {Boolean}
     */
    DestroyedCondition.prototype.isSatisfied = function (mission) {
        var i, spacecrafts = this._subjects.getSpacecrafts(mission);
        for (i = 0; i < spacecrafts.length; i++) {
            if (spacecrafts[i].isAlive()) {
                return false;
            }
        }
        return true;
    };
    /**
     * @override
     * @param {Object} stringPrefix 
     * @returns {String}
     */
    DestroyedCondition.prototype.getObjectiveString = function (stringPrefix) {
        var result = utils.formatString(strings.get(stringPrefix, strings.OBJECTIVE.DESTROY_SUFFIX.name), {
            subjects: this._subjects.toString()
        });
        result = result.charAt(0).toUpperCase() + result.slice(1);
        return result;
    };
    /**
     * @override
     * @param {Object} stringPrefix 
     * @returns {String}
     */
    DestroyedCondition.prototype.getObjectiveStateString = function (stringPrefix) {
        var result, count, suffix;
        if (!this._subjects.getSpacecrafts()) {
            return "";
        }
        count = this._subjects.getLiveSubjectCount(true);
        suffix = (count > 1) ? (" (" + count + ")") : "";
        result = utils.formatString(strings.get(stringPrefix, strings.OBJECTIVE.DESTROY_SUFFIX.name), {
            subjects: this._subjects.getShortString()
        }) + suffix;
        result = result.charAt(0).toUpperCase() + result.slice(1);
        return result;
    };
    /**
     * @override
     * Note: this is only correct if this condition belongs to the trigger of a WIN event
     * @param {Mission} mission 
     * @returns {Spacecraft[]}
     */
    DestroyedCondition.prototype.getTargetSpacecrafts = function (mission) {
        return this._subjects.getSpacecrafts(mission);
    };
    /**
     * @override
     * Note: this is only correct if this condition belongs to the trigger of a LOSE event
     * @param {Mission} mission 
     * @returns {Spacecraft[]}
     */
    DestroyedCondition.prototype.getEscortedSpacecrafts = function (mission) {
        return this._subjects.getSpacecrafts(mission);
    };
    // ##############################################################################
    /**
     * @class A condition that is satisfied based on the number of its currently alive subjects
     * @extends Condition
     * @param {Object} dataJSON
     */
    function CountCondition(dataJSON) {
        Condition.call(this, dataJSON);
    }
    CountCondition.prototype = new Condition();
    CountCondition.prototype.constructor = CountCondition;
    /**
     * @typedef CountCondition~Params
     * @property {Number} count The number relative to which to evaluate the number of alive subjects
     * @property {String} relation (enum CountConditionRelation) The relation determining when is this condition satisfied
     */
    /**
     * @override
     * @param {CountCondition~Params} params
     * @returns {Boolean}
     */
    CountCondition.prototype._checkParams = function (params) {
        /**
         * @type CountCondition~Params
         */
        this._params = params;
        if (!this._params ||
                ((typeof this._params.count) !== "number") ||
                !utils.getSafeEnumValue(CountConditionRelation, this._params.relation)) {
            this._handleWrongParams();
            return false;
        }
        return true;
    };
    /**
     * @override
     * @param {Mission} mission
     * @returns {Boolean}
     */
    CountCondition.prototype.isSatisfied = function (mission) {
        var i, count, spacecrafts = this._subjects.getSpacecrafts(mission);
        count = 0;
        for (i = 0; i < spacecrafts.length; i++) {
            if (spacecrafts[i].isAlive()) {
                count++;
            }
        }
        switch (this._params.relation) {
            case CountConditionRelation.BELOW:
                return count < this._params.count;
            case CountConditionRelation.ABOVE:
                return count > this._params.count;
            case CountConditionRelation.EQUALS:
                return count === this._params.count;
        }
        return false;
    };
    /**
     * @override
     * @param {Object} stringPrefix
     * @returns {String}
     */
    CountCondition.prototype.getObjectiveString = function (stringPrefix) {
        var result;
        if (this._params.relation !== CountConditionRelation.BELOW) {
            application.showError("Count conditions for mission objectives must have relation set to '" + CountConditionRelation.BELOW + "'!");
            return null;
        }
        result = utils.formatString(strings.get(stringPrefix, strings.OBJECTIVE.COUNT_BELOW_SUFFIX.name), {
            subjects: this._subjects.toString(),
            count: this._params.count
        });
        result = result.charAt(0).toUpperCase() + result.slice(1);
        return result;
    };
    /**
     * @override
     * @param {Object} stringPrefix 
     * @returns {String}
     */
    CountCondition.prototype.getObjectiveStateString = function (stringPrefix) {
        var result, count, suffix;
        if (this._params.relation !== CountConditionRelation.BELOW) {
            application.showError("Count conditions for mission objectives must have relation set to '" + CountConditionRelation.BELOW + "'!");
            return null;
        }
        if (!this._subjects.getSpacecrafts()) {
            return "";
        }
        count = this._subjects.getLiveSubjectCount();
        suffix = " (" + count + ")";
        result = utils.formatString(strings.get(stringPrefix, strings.OBJECTIVE.COUNT_BELOW_SUFFIX.name), {
            subjects: this._subjects.getShortString(),
            count: this._params.count
        }) + suffix;
        result = result.charAt(0).toUpperCase() + result.slice(1);
        return result;
    };
    /**
     * @override
     * Note: this is only correct if this condition belongs to the trigger of a WIN event
     * @param {Mission} mission 
     * @returns {Spacecraft[]}
     */
    CountCondition.prototype.getTargetSpacecrafts = function (mission) {
        if (this._params.relation !== CountConditionRelation.BELOW) {
            application.showError("Count conditions for mission objectives must have relation set to '" + CountConditionRelation.BELOW + "'!");
            return null;
        }
        return this._subjects.getSpacecrafts(mission);
    };
    /**
     * @override
     * Note: this is only correct if this condition belongs to the trigger of a LOSE event
     * @param {Mission} mission 
     * @returns {Spacecraft[]}
     */
    CountCondition.prototype.getEscortedSpacecrafts = function (mission) {
        if (this._params.relation !== CountConditionRelation.BELOW) {
            application.showError("Count conditions for mission objectives must have relation set to '" + CountConditionRelation.BELOW + "'!");
            return null;
        }
        return this._subjects.getSpacecrafts(mission);
    };
    // ##############################################################################
    /**
     * @class A condition that is satisfied based on the time elapsed since a start event (start of mission or
     * first firing of a specified trigger)
     * @extends Condition
     * @param {Object} dataJSON
     */
    function TimeCondition(dataJSON) {
        Condition.call(this, dataJSON);
        /**
         * Whether the timer for this condition is currently running.
         * @type Boolean
         */
        this._running = !this._params.start;
        /**
         * A reference to the trigger setting off the timer for this condition (if any)
         * @type Trigger
         */
        this._trigger = null;
        /**
         * The time elapsed while running the timer for this condition, in milliseconds
         * @type Number
         */
        this._timeElapsed = this._params.startOffset || 0;
        /**
         * The number of times this condition has already been satisfied (for repeat mode)
         * @type Number
         */
        this._count = 0;
    }
    TimeCondition.prototype = new Condition();
    TimeCondition.prototype.constructor = TimeCondition;
    /**
     * @typedef TimeCondition~Params
     * @property {Number} time The amount of time this condition refers to, in milliseconds
     * @property {String} satisfiedWhen (enum TimeConditionSatisfiedWhen) How to determine when the condition is satisfied
     * @property {String} [start] The name of the event starting the timer for this condition (not set: start of mission)
     * @property {Number} [maxCount] The maximum number of times this condition can be satisfied (only for repeat mode)
     * @property {Number} [startOffset] The value of the timer when started (for repeat mode)
     */
    /**
     * @override
     * @param {TimeCondition~Params} params 
     * @returns {Boolean}
     */
    TimeCondition.prototype._checkParams = function (params) {
        /**
         * @type TimeCondition~Params
         */
        this._params = params;
        if (!this._params ||
                ((typeof this._params.time) !== "number") ||
                !(utils.getSafeEnumValue(TimeConditionSatisfiedWhen, this._params.satisfiedWhen)) ||
                ((this._params.start !== undefined) && (typeof this._params.start !== "string")) ||
                ((this._params.satisfiedWhen !== TimeConditionSatisfiedWhen.REPEAT) && (this._params.maxCount !== undefined)) ||
                ((this._params.satisfiedWhen === TimeConditionSatisfiedWhen.REPEAT) && (this._params.maxCount !== undefined) && (typeof this._params.maxCount !== "number")) ||
                ((this._params.startOffset !== undefined) && (typeof this._params.startOffset !== "number"))) {
            this._handleWrongParams();
            return false;
        }
        return true;
    };
    /**
     * @override
     * @param {Mission} mission
     * @param {Number} dt
     * @returns {Boolean}
     */
    TimeCondition.prototype.isSatisfied = function (mission, dt) {
        var result = false;
        if (this._params.start && !this._trigger) {
            this._trigger = mission.getEvent(this._params.start) && mission.getEvent(this._params.start).getTrigger();
            if (!this._trigger) {
                this._params.start = null;
            }
        }
        if (!this._running && this._trigger && this._trigger.hasFired()) {
            this._running = true;
        }
        if (this._running) {
            this._timeElapsed += dt;
            switch (this._params.satisfiedWhen) {
                case TimeConditionSatisfiedWhen.BEFORE:
                    if (this._timeElapsed < this._params.time) {
                        return true;
                    }
                    break;
                case TimeConditionSatisfiedWhen.AFTER:
                    if (this._timeElapsed > this._params.time) {
                        return true;
                    }
                    break;
                case TimeConditionSatisfiedWhen.ONCE:
                    if ((this._timeElapsed >= this._params.time) && (this._count === 0)) {
                        this._running = false;
                        this._count = 1;
                        return true;
                    }
                    break;
                case TimeConditionSatisfiedWhen.REPEAT:
                    if (!this._params.maxCount || (this._count < this._params.maxCount)) {
                        while (this._timeElapsed >= this._params.time) {
                            this._timeElapsed -= this._params.time;
                            result = true;
                        }
                        if (result) {
                            this._count++;
                            return true;
                        }
                    } else {
                        this._running = false;
                    }
                    break;
            }
        }
        return false;
    };
    // #########################################################################
    /**
     * @callback Trigger~onFireCallback
     * @param {Mission} mission 
     */
    /**
     * @class Missions contain triggers, which fire based on a set of conditions that they evaluate in every simulation step, and can have
     * callbacks added to them which are invoked upon firing
     * that can be 
     * @param {Object} dataJSON
     */
    function Trigger(dataJSON) {
        var i;
        /**
         * The list of conditions to evaluate when deciding whether to fire
         * @type Condition[]
         */
        this._conditions = null;
        if (dataJSON.conditions) {
            this._conditions = [];
            for (i = 0; i < dataJSON.conditions.length; i++) {
                this._conditions.push(new (_conditionConstructors[dataJSON.conditions[i].type] || Condition)(dataJSON.conditions[i]));
            }
        }
        /**
         * (enum TriggerConditionsRequired) 
         * Determines the logical operation used to combine the conditions when deciding whether to fire
         * @type String
         */
        this._conditionsRequired = utils.getSafeEnumValue(TriggerConditionsRequired, dataJSON.conditionsRequired, TriggerConditionsRequired.ALL);
        /**
         * (enum TriggerFireWhen) 
         * Determines at what logic state (or state change) should the trigger fire
         * @type String
         */
        this._fireWhen = utils.getSafeEnumValue(TriggerFireWhen, dataJSON.fireWhen, TriggerFireWhen.CHANGE_TO_TRUE);
        /**
         * When true, the trigger can only fire once during a mission, and then it does not evaluate its conditions anymore
         * @type Boolean
         */
        this._oneShot = dataJSON.oneShot || false;
        /**
         * For oneShot triggers only - if this is set (to a larger than 0 value), the trigger will fire this much later after the first
         * time it is evaluated true, in milliseconds.
         * @type Number
         */
        this._delay = dataJSON.delay || 0;
        /**
         * A flag to indicate whether the countdown for delayed firing has been started.
         * @type Boolean
         */
        this._countDown = false;
        /**
         * The callbacks attached which should be invoked when the trigger fires
         * @type Trigger~onFireCallback[]
         */
        this._onFireHandlers = [];
        /**
         * The result of the condition evaluation in the last simulation step, to track condition changes
         * @type Boolean
         */
        this._previousConditionState = false;
        /**
         * Whether this trigger has already fired (at least once) during the current mission
         * @type Boolean
         */
        this._fired = false;
        // invalid state checks
        if (!this._conditions) {
            if (this._fireWhen !== TriggerFireWhen.MISSION_STARTS) {
                application.showError("A trigger has no conditions, and so its fireWhen state must be '" + TriggerFireWhen.MISSION_STARTS + "'!");
                this._fireWhen = TriggerFireWhen.MISSION_STARTS;
            }
            if (!this._oneShot) {
                application.showError("A trigger has no conditions, and so it must be set as oneShot!");
                this._oneShot = true;
            }
        }
        if (!this._oneShot && this._delay) {
            application.showError("Only oneShot triggers can have delays!");
            this._delay = 0;
        }
    }
    /**
     * Adds the passed callback function to be executed whenever this trigger fires
     * @param {Trigger~onFireCallback} value
     */
    Trigger.prototype.addFireHandler = function (value) {
        this._onFireHandlers.push(value);
    };
    /**
     * Fires the trigger, invoking every callback previously added to it
     * @param {Mission} mission 
     */
    Trigger.prototype.fire = function (mission) {
        var i;
        if (this._delay > 0) {
            this._countDown = true;
            return;
        }
        for (i = 0; i < this._onFireHandlers.length; i++) {
            this._onFireHandlers[i](mission);
        }
        this._fired = true;
    };
    /**
     * Returns whether the trigger has already fired (at least once) during this mission
     * @returns {Boolean}
     */
    Trigger.prototype.hasFired = function () {
        return this._fired;
    };
    /**
     * Checks the state of the passed mission to determine whether the trigger should fire, and fires it if necessary.
     * Should be called in every simulation step of the mission.
     * @param {Mission} mission
     * @param {Number} dt The time elapsed since the last simulation step, in milliseconds
     */
    Trigger.prototype.simulate = function (mission, dt) {
        var conditionState, i;
        if (this._oneShot) {
            if (this._fired) {
                return;
            }
            if (this._countDown) {
                this._delay -= dt;
                if (this._delay <= 0) {
                    this.fire(mission);
                }
                return;
            }
        }
        if (this._fireWhen === TriggerFireWhen.MISSION_STARTS) {
            this.fire(mission);
            return;
        }
        switch (this._conditionsRequired) {
            case TriggerConditionsRequired.ALL:
                conditionState = true;
                for (i = 0; i < this._conditions.length; i++) {
                    if (!this._conditions[i].isSatisfied(mission, dt)) {
                        conditionState = false;
                        break;
                    }
                }
                break;
            case TriggerConditionsRequired.ANY:
                conditionState = false;
                for (i = 0; i < this._conditions.length; i++) {
                    if (this._conditions[i].isSatisfied(mission, dt)) {
                        conditionState = true;
                        break;
                    }
                }
                break;
            default:
                application.showError("Unrecognized trigger condition requirement: '" + this._conditionsRequired + "'!");
        }
        switch (this._fireWhen) {
            case TriggerFireWhen.TRUE:
                if (conditionState) {
                    this.fire(mission);
                }
                break;
            case TriggerFireWhen.FALSE:
                if (!conditionState) {
                    this.fire(mission);
                }
                break;
            case TriggerFireWhen.CHANGE:
                if (conditionState !== this._previousConditionState) {
                    this.fire(mission);
                }
                break;
            case TriggerFireWhen.CHANGE_TO_TRUE:
                if (conditionState && !this._previousConditionState) {
                    this.fire(mission);
                }
                break;
            case TriggerFireWhen.CHANGE_TO_FALSE:
                if (!conditionState && this._previousConditionState) {
                    this.fire(mission);
                }
                break;
            default:
                application.showError("Unrecognized trigger firing requirement: '" + this._fireWhen + "'!");
        }
        this._previousConditionState = conditionState;
    };
    /**
     * Returns the list of HTML strings that can be used to display the objectives associated with the conditions of this trigger.
     * @param {Object} stringPrefix The translation string descriptor containing the prefix to be used to decide whether the conditions 
     * should be considered win or lose conditions
     * @returns {String[]}
     */
    Trigger.prototype.getObjectiveStrings = function (stringPrefix) {
        var i, result = [];
        if (this._conditionsRequired !== TriggerConditionsRequired.ALL) {
            application.showError("Triggers for mission objectives must be set to conditionsRequired state of '" + TriggerConditionsRequired.ALL + "'!");
            return null;
        }
        if (this._fireWhen !== TriggerFireWhen.CHANGE_TO_TRUE) {
            application.showError("Triggers for mission objectives must be set to fireWhen state of '" + TriggerFireWhen.CHANGE_TO_TRUE + "'!");
            return null;
        }
        for (i = 0; i < this._conditions.length; i++) {
            result.push(this._conditions[i].getObjectiveString(stringPrefix));
        }
        return result;
    };
    /**
     * @typedef {Object} ObjectiveWithState
     * @property {String} text A text to display the objective and its current state to the player
     * @property {Number} state (enum ObjectiveState)
     */
    /**
     * Returns the list of translated strings that can be used to display the objectives and their states associated with the conditions 
     * of this trigger. To be used on the HUD.
     * @param {Boolean} triggersWinAction Whether this trigger firing causes the player to win 
     * @param {Mission} mission 
     * @returns {ObjectiveWithState[]}
     */
    Trigger.prototype.getObjectivesState = function (triggersWinAction, mission) {
        var i, result = [];
        if (this._conditionsRequired !== TriggerConditionsRequired.ALL) {
            application.showError("Triggers for mission objectives must be set to conditionsRequired state of '" + TriggerConditionsRequired.ALL + "'!");
            return null;
        }
        if (this._fireWhen !== TriggerFireWhen.CHANGE_TO_TRUE) {
            application.showError("Triggers for mission objectives must be set to fireWhen state of '" + TriggerFireWhen.CHANGE_TO_TRUE + "'!");
            return null;
        }
        for (i = 0; i < this._conditions.length; i++) {
            result.push({
                text: this._conditions[i].getObjectiveStateString(triggersWinAction ?
                        strings.BATTLE.OBJECTIVE_WIN_PREFIX :
                        strings.BATTLE.OBJECTIVE_LOSE_PREFIX),
                state: this._conditions[i].isSatisfied(mission) ?
                        (triggersWinAction ?
                                ObjectiveState.COMPLETED :
                                ObjectiveState.FAILED) :
                        ((mission.getState() === MissionState.COMPLETED) ?
                                ObjectiveState.COMPLETED :
                                ObjectiveState.IN_PROGRESS)
            });
        }
        return result;
    };
    /**
     * If the event of the trigger corresponds to a mission objective that requires the player to destroy some spacecrafts, this 
     * method returns the list of these target spacecrafts.
     * @param {Mission} mission 
     * @returns {Spacecraft[]}
     */
    Trigger.prototype.getTargetSpacecrafts = function (mission) {
        var i, result = [];
        for (i = 0; i < this._conditions.length; i++) {
            result = result.concat(this._conditions[i].getTargetSpacecrafts(mission));
        }
        return result;
    };
    /**
     * If the event of the trigger corresponds to a mission objective that requires the player to escort (protect) some spacecrafts, this 
     * method returns the list of these escorted spacecrafts.
     * @param {Mission} mission 
     * @returns {Spacecraft[]}
     */
    Trigger.prototype.getEscortedSpacecrafts = function (mission) {
        var i, result = [];
        for (i = 0; i < this._conditions.length; i++) {
            result = result.concat(this._conditions[i].getEscortedSpacecrafts(mission));
        }
        return result;
    };
    // #########################################################################
    /**
     * @class 
     * An action to be executed whenever the associated trigger fires during the simulation of the mission
     * This is a base class, subclasses need to be created for each specific action type that is supported.
     * The subclasses need to implement _checkParams() and _execute().
     * @param {Object} dataJSON The object storing the data to initialize this action
     * @param {Trigger} trigger
     */
    function Action(dataJSON, trigger) {
        /**
         * (enum ActionType) Determines what the action to execute actually is
         * @type String
         */
        this._type = dataJSON ? utils.getSafeEnumValue(ActionType, dataJSON.type, null) : null;
        /**
         * The time that needs to be elapsed after the trigger fires before executing the action, in milliseconds
         * @type Number
         */
        this._delay = dataJSON ? dataJSON.delay || 0 : 0;
        /**
         * A reference to the trigger that needs to fire to execute this action
         * @type Trigger
         */
        this._trigger = trigger;
        if (this._trigger) {
            this._trigger.addFireHandler(this._addToExecutionQueue.bind(this));
        }
        /**
         * The subjects of this action (used in action types that do things with spacecrafts)
         * @type SubjectGroup
         */
        this._subjects = dataJSON ? new SubjectGroup(dataJSON.subjects) : null;
        if (dataJSON) {
            this._checkParams(dataJSON.params);
        }
    }
    /**
     * Return the value that identifies the nature of this action - i.e. what it does
     * @returns {String} (enum ActionType) 
     */
    Action.prototype.getType = function () {
        return this._type;
    };
    /**
     * Shows the error message indicating that there was a problem validating the parameters defined for this action
     */
    Action.prototype._handleWrongParams = function () {
        application.showError("Wrong parameters specified for action of type: '" + this._type + "'!");
    };
    /**
     * Based on the type of the action, checks whether it has all the appropriate parameters set in the passed object, 
     * and outputs errors if it doesn't
     * Override this to add the appropriate checks!
     * @returns {Boolean} Whether the parameters passed are valid for this condition
     */
    Action.prototype._checkParams = function () {
        application.showError("Unrecognized action type: '" + this._type + "'!");
        return false;
    };
    /**
     * If the action has a delay set, it is added to the execution queue of the passed mission with the set delay, otherwise
     * it is executed right away
     * @param {Mission} mission
     */
    Action.prototype._addToExecutionQueue = function (mission) {
        if (this._delay > 0) {
            mission.queueAction(this, this._delay);
        } else {
            this.execute(mission);
        }
    };
    /**
     * Executes the action - does whatever its type defines. Called whenever the associated trigger fires.
     * Override this implementing the specific logic for the corresponding Action sublcasses!
     * The mission is passed as the only argument when called.
     */
    Action.prototype.execute = function () {
        application.showError("Unrecognized action type: '" + this._type + "'!");
    };
    /**
     * Returns a list of strings that contain translated HTML text which can be used to display the mission objectives associated with this
     * action (if it is a win or lose action). Used on the Missions screen.
     * @returns {String[]}
     */
    Action.prototype.getObjectiveStrings = function () {
        application.showError("Action of type '" + this._type + "' does no correspond to a mission objective!");
        return null;
    };
    /**
     * Returns a list of translated strings along objective state values for displaying the current states of the objectives for the player
     * (used on the HUD) Works for win or lose events only.
     * @returns {ObjectiveWithState[]}
     */
    Action.prototype.getObjectivesState = function () {
        application.showError("Action of type '" + this._type + "' does no correspond to a mission objective!");
        return null;
    };
    // #########################################################################
    /**
     * @class 
     * @extends Action
     * @param {Object} dataJSON
     * @param {Trigger} trigger
     */
    function WinAction(dataJSON, trigger) {
        Action.call(this, dataJSON, trigger);
    }
    WinAction.prototype = new Action();
    WinAction.prototype.constructor = WinAction;
    /**
     * @override
     * @returns {Boolean}
     */
    WinAction.prototype._checkParams = function () {
        return true;
    };
    /**
     * @override
     * @param {Mission} mission 
     */
    WinAction.prototype.execute = function (mission) {
        mission.completeMission();
    };
    /**
     * @override
     * @returns {String[]}
     */
    WinAction.prototype.getObjectiveStrings = function () {
        return this._trigger.getObjectiveStrings(strings.MISSIONS.OBJECTIVE_WIN_PREFIX);
    };
    /**
     * @override
     * @param {Mission} mission
     * @returns {ObjectiveWithState[]}
     */
    WinAction.prototype.getObjectivesState = function (mission) {
        return this._trigger.getObjectivesState(true, mission);
    };
    // #########################################################################
    /**
     * @class 
     * @extends Action
     * @param {Object} dataJSON
     * @param {Trigger} trigger
     */
    function LoseAction(dataJSON, trigger) {
        Action.call(this, dataJSON, trigger);
    }
    LoseAction.prototype = new Action();
    LoseAction.prototype.constructor = LoseAction;
    /**
     * @override
     * @returns {Boolean}
     */
    LoseAction.prototype._checkParams = function () {
        return true;
    };
    /**
     * @override
     * @param {Mission} mission 
     */
    LoseAction.prototype.execute = function (mission) {
        mission.failMission();
    };
    /**
     * @override
     * @returns {String[]}
     */
    LoseAction.prototype.getObjectiveStrings = function () {
        return this._trigger.getObjectiveStrings(strings.MISSIONS.OBJECTIVE_LOSE_PREFIX);
    };
    /**
     * @override
     * @param {Mission} mission
     * @returns {ObjectiveWithState[]}
     */
    LoseAction.prototype.getObjectivesState = function (mission) {
        return this._trigger.getObjectivesState(false, mission);
    };
    // #########################################################################
    /**
     * @class 
     * @extends Action
     * @param {Object} dataJSON
     * @param {Trigger} trigger
     */
    function MessageAction(dataJSON, trigger) {
        Action.call(this, dataJSON, trigger);
    }
    MessageAction.prototype = new Action();
    MessageAction.prototype.constructor = MessageAction;
    /**
     * @typedef MessageAction~Params
     * @property {String|Object} [text] The text of the message (formatted, can contain '\n'-s). Used when no
     * translation (or no translation ID) is available. Alternatively, an object can be given with multiple language
     * versions of the text, with the language IDs as the keys.
     * @property {String} [textID] The translation ID to use for the text to be displayed. The full translation
     * ID will be mission.<missionName>.messages.<textID>
     * If a translation is found, it overrides the value of the text property.
     * @property {String} [source] The name (id) of the spacecraft that this message originates from. Its display name will be added at the beginning
     * of the message, and the message is not played if the ship is already destroyed
     * @property {Number} [duration] The duration to display the message for, in milliseconds. If not given, an automatic
     * duration will be set based on the length of the text
     * @property {Boolean} [permanent] If true, the message keeps being displayed until a new urgent
     * message is added or the queue is cleared
     * @property {Boolean} [urgent] Whether the message should be displayed before non-urgent messages (interrupting already displayed
     * non-urgent messages)
     * @property {Number[4]} [color] When given, the message should be displayed using this text color 
     */
    /**
     * @override
     * @param {MessageAction~Params} params 
     * @returns {Boolean}
     */
    MessageAction.prototype._checkParams = function (params) {
        /**
         * @type MessageAction~Params
         */
        this._params = params;
        if (!this._params ||
                ((!this._params.text) && (!this._params.textID)) ||
                ((this._params.text !== undefined) && (typeof this._params.text !== "string") && (typeof this._params.text !== "object")) ||
                ((this._params.textID !== undefined) && (typeof this._params.textID !== "string")) ||
                ((this._params.source !== undefined) && (typeof this._params.source !== "string")) ||
                ((this._params.duration !== undefined) && (typeof this._params.duration !== "number")) ||
                ((this._params.permanent !== undefined) && (typeof this._params.permanent !== "boolean")) ||
                ((this._params.urgent !== undefined) && (typeof this._params.urgent !== "boolean")) ||
                ((this._params.color !== undefined) && ((typeof this._params.color !== "object") || !(this._params.color instanceof Array)))) {
            this._handleWrongParams();
            return false;
        }
        return true;
    };
    /**
     * @override
     * @param {Mission} mission 
     */
    MessageAction.prototype.execute = function (mission) {
        var source;
        if (this._params.source) {
            source = mission.getSpacecraft(this._params.source);
            if (!source) {
                application.log_DEBUG("Warning: message not played, because the source spacecraft '" + this._params.source + "' does not exist (might have been destroyed)!");
                return;
            }
        }
        game.getScreen().queueHUDMessage({
            text: (this._params.source ? ("{spacecrafts/" + this._params.source + "}: ") : "") + strings.get(
                    strings.MISSION.PREFIX,
                    utils.getFilenameWithoutExtension(mission.getName()) + strings.MISSION.MESSAGES_SUFFIX.name + this._params.textID,
                    (typeof this._params.text === "object") ? this._params.text[strings.getLanguage()] : this._params.text),
            duration: this._params.duration,
            appearAnimation: true,
            permanent: this._params.permanent,
            color: this._params.color,
            source: source
        }, this._params.urgent);
    };
    // #########################################################################
    /**
     * @class 
     * @extends Action
     * @param {Object} dataJSON
     * @param {Mission} mission
     */
    function ClearMessagesAction(dataJSON, mission) {
        Action.call(this, dataJSON, mission);
    }
    ClearMessagesAction.prototype = new Action();
    ClearMessagesAction.prototype.constructor = ClearMessagesAction;
    /**
     * @override
     * @returns {Boolean}
     */
    ClearMessagesAction.prototype._checkParams = function () {
        return true;
    };
    /**
     * @override
     */
    ClearMessagesAction.prototype.execute = function () {
        game.getScreen().clearHUDMessages();
    };
    // #########################################################################
    /**
     * @class 
     * @extends Action
     * @param {Object} dataJSON
     * @param {Trigger} trigger
     */
    function CommandAction(dataJSON, trigger) {
        Action.call(this, dataJSON, trigger);
    }
    CommandAction.prototype = new Action();
    CommandAction.prototype.constructor = CommandAction;
    /**
     * @override
     * @param {SpacecraftEvents~CommandData} params 
     * @returns {Boolean}
     */
    CommandAction.prototype._checkParams = function (params) {
        /**
         * @type SpacecraftEvents~CommandData
         */
        this._params = params;
        if (!this._params ||
                ((this._params.command !== undefined) && (typeof this._params.command !== "string"))) {
            this._handleWrongParams();
            return false;
        }
        return true;
    };
    /**
     * @override
     * @param {Mission} mission 
     */
    CommandAction.prototype.execute = function (mission) {
        var i, spacecrafts = this._subjects.getSpacecrafts(mission, true);
        if (spacecrafts.length > 0) {
            this._params.lead = spacecrafts[0];
            this._params.clearCache = true;
            for (i = 0; i < spacecrafts.length; i++) {
                this._params.index = i;
                spacecrafts[i].handleEvent(SpacecraftEvents.COMMAND_RECEIVED, this._params);
            }
        }
    };
    // #########################################################################
    /**
     * @class 
     * @extends Action
     * @param {Object} dataJSON
     * @param {Trigger} trigger
     */
    function HUDAction(dataJSON, trigger) {
        Action.call(this, dataJSON, trigger);
    }
    HUDAction.prototype = new Action();
    HUDAction.prototype.constructor = HUDAction;
    /**
     * @override
     * @param {SpacecraftEvents~HUDData} params 
     * @returns {Boolean}
     */
    HUDAction.prototype._checkParams = function (params) {
        /**
         * @type SpacecraftEvents~HUDData
         */
        this._params = params;
        if (!this._params ||
                ((this._params.state !== undefined) && (typeof this._params.state !== "string"))) {
            this._handleWrongParams();
            return false;
        }
        return true;
    };
    /**
     * @override
     * @param {Mission} mission 
     */
    HUDAction.prototype.execute = function (mission) {
        var spacecraft = mission.getPilotedSpacecraft();
        if (spacecraft) {
            spacecraft.handleEvent(SpacecraftEvents.HUD, this._params);
        }
    };
    // #########################################################################
    /**
     * @class A game event is a set of actions that are executed whenever an associated trigger (a set of conditions and parameters) fires 
     * during the mission.
     * @param {Object} dataJSON
     */
    function MissionEvent(dataJSON) {
        var i;
        /**
         * A string to identify this event Might be needed to refer to it for example, as a timed trigger might start its countdown after 
         * a referred event happens.
         * @type String
         */
        this._name = dataJSON.name;
        /**
         * The trigger that is checked every simulation step whether to fire and invoke the associated actions or not
         * @type Trigger[]
         */
        this._trigger = new Trigger(dataJSON.trigger);
        /**
         * Actions that are executed in every simulation step when their associated triggers fire
         * @type Action[]
         */
        this._actions = [];
        for (i = 0; i < dataJSON.actions.length; i++) {
            this._actions.push(new (_actionConstructors[dataJSON.actions[i].type] || Action)(dataJSON.actions[i], this._trigger));
        }
    }
    /**
     * Returns the string that identifies this event within the mission.
     * @returns {String}
     */
    MissionEvent.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the trigger that sets this event off.
     * @returns {Trigger}
     */
    MissionEvent.prototype.getTrigger = function () {
        return this._trigger;
    };
    /**
     * Returns the set of actions that are executed when this event happens.
     * @returns {Action[]}
     */
    MissionEvent.prototype.getActions = function () {
        return this._actions;
    };
    /**
     * Checks the triggers and executes the actions if needed for the current mission simulation step.
     * @param {Mission} mission The mission we are simulating.
     * @param {Number} dt The time elapsed since the last simulation step, in milliseconds
     */
    MissionEvent.prototype.simulate = function (mission, dt) {
        this._trigger.simulate(mission, dt);
    };
    // #########################################################################
    /**
     * @class Represents a battle scene with an environment, spacecrafts, 
     * projectiles. Can create scenes for visual representation using the held
     * references as well as perform the game logic and physics simulation
     * among the contained objects.
     * @param {String} name The name of the mission (typically same as the filename e.g. someMission.json)
     */
    function Mission(name) {
        /**
         * The name of the mission (typically same as the filename e.g. someMission.json)
         * @type String
         */
        this._name = name;
        /**
         * The name of the mission that should be played after completing this one (typically same as the filename e.g. someMission.json)
         * @type String
         */
        this._nextMissionName = null;
        /**
         * Stores the attributes of the environment where this mission is situated.
         * @type Environment
         */
        this._environment = null;
        /**
         * Whether this mission has an own environment created by itself (described in the mission JSON)
         * or just refers one from the common environments. (if the latter is the case, the referred environment cannot be destroyed when
         * this mission is destroyed)
         * @type Boolean
         */
        this._ownsEnvironment = false;
        /**
         * The ID (resource name) of the music that should play during anticipation phase within this mission (if not given, a random one is chosen
         * from the available anticipation themes each time the mission starts)
         * @type String
         */
        this._anticipationTheme = null;
        /**
         * The ID (resource name) of the music that should play while in combat within this mission (if not given, a random one is chosen
         * from the available combat themes each time the mission starts)
         * @type String
         */
        this._combatTheme = null;
        /**
         * The list of views that will be used to add camera configurations to the scene of this mission. The first element of this list
         * will be the starting camera configuration.
         * @type SceneView[]
         */
        this._views = null;
        /**
         * The list of valid string IDs for teams in this mission (so that IDs can be validated against this list to detect typos)
         * @type String[]
         */
        this._teams = null;
        /**
         * The events that can happen during this mission. 
         * @type MissionEvent[]
         */
        this._events = null;
        /**
         * An array of all the actions that are scheduled to be executed and the corresponding time left before the execution (in milliseconds)
         * @type {action: Action, delay: Number}[]
         */
        this._actionQueue = null;
        /**
         * References to those actions of the mission that, when executed, cause it to be completed 
         * @type Action[]
         */
        this._winActions = null;
        /**
         * References to those actions of the mission that, when executed, cause it to be failed 
         * @type Action[]
         */
        this._loseActions = null;
        /**
         * The list of spacecrafts that are placed on the map of this mission.
         * @type Spacecraft[]
         */
        this._spacecrafts = null;
        /**
         * A reference to the spacecraft piloted by the player.
         * @type Spacecraft
         */
        this._pilotedCraft = null;
        /**
         * A list of references to all the physical objects that take part in
         * collision / hit check in this mission to easily pass them to such
         * simulation methods.
         * @type PhysicalObject[]
         */
        this._hitObjects = null;
        /**
         * Tracks the state of mission objective completion.
         * @type Number
         */
        this._state = MissionState.NONE;
        /**
         * How much score falls on the player in this mission, based on the total score that can be achieved and the number of teammates.
         * (e.g. in a 3v3 match, this would be the score value of one enemy, in a 3v6 match, the value of 2 enemies etc)
         * Needs to be calculated at the start of missions.
         * @type Number
         */
        this._referenceScore = 0;
        /**
         * The cached list of spacecrafts that needs to be destroyed by the player to complete this mission.
         * @type Spacecrafts
         */
        this._targetSpacecrafts = null;
        /**
         * The cached list of spacecrafts that needs to be escorted (protected) by the player for this mission.
         * @type Spacecrafts
         */
        this._escortedSpacecrafts = null;
        /**
         * @type DifficultyLevel
         */
        this._difficultyLevel = null;
    }
    /**
     * Return the name identifying this mission (typically same as the filename e.g. someMission.json)
     * @returns {String}
     */
    Mission.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the name of the mission that should be played after completing this one (typically same as the filename e.g. someMission.json)
     * @returns {String}
     */
    Mission.prototype.getNextMissionName = function () {
        return this._nextMissionName;
    };
    /**
     * Returns the ID (resource name) of the music that should play during anticipation phase within this mission (if it is specified)
     * @returns {String}
     */
    Mission.prototype.getAnticipationTheme = function () {
        return this._anticipationTheme;
    };
    /**
     * Returns the ID (resource name) of the music that should play while in combat within this mission (if it is specified)
     * @returns {String}
     */
    Mission.prototype.getCombatTheme = function () {
        return this._combatTheme;
    };
    /**
     * Returns the currently piloted spacecraft.
     * @returns {Spacecraft}
     */
    Mission.prototype.getPilotedSpacecraft = function () {
        return this._pilotedCraft;
    };
    /**
     * Returns the spacecraft added to this mission that is identified by the given id. Returns null if such spacecraft does not exist.
     * @param {String} id
     * @returns {Spacecraft}
     */
    Mission.prototype.getSpacecraft = function (id) {
        var i;
        for (i = 0; i < this._spacecrafts.length; i++) {
            if (this._spacecrafts[i].getID() === id) {
                return this._spacecrafts[i];
            }
        }
        return null;
    };
    /**
     * Returns the list of spacecrafts (that are alive) in this mission
     * @returns {Spacecraft[]}
     */
    Mission.prototype.getSpacecrafts = function () {
        return this._spacecrafts;
    };
    /**
     * Returns the list of spacecrafts (that are alive) that are members of the passed squad
     * @param {String} squad The string ID of the squad
     * @returns {Spacecraft[]}
     */
    Mission.prototype.getSpacecraftsInSquad = function (squad) {
        var i, result = [];
        for (i = 0; i < this._spacecrafts.length; i++) {
            if (this._spacecrafts[i].getSquad() === squad) {
                result.push(this._spacecrafts[i]);
            }
        }
        return result;
    };
    /**
     * Calls the passed function for every spacecraft this mission has, passing each of the spacecrafts as its single argument
     * @param {Function} method
     */
    Mission.prototype.applyToSpacecrafts = function (method) {
        var i;
        for (i = 0; i < this._spacecrafts.length; i++) {
            method(this._spacecrafts[i]);
        }
    };
    /**
     * Return a value from the enum MissionState
     * @returns {Number}
     */
    Mission.prototype.getState = function () {
        return this._state;
    };
    /**
     * Returns whether the mission is in one of the finishes state (it has been completed, failed, or it was a sandbox battle that has ended)
     * @returns {Boolean}
     */
    Mission.prototype.isFinished = function () {
        return (this._state === MissionState.COMPLETED) ||
                (this._state === MissionState.FAILED) ||
                (this._state === MissionState.DEFEAT) ||
                (this._state === MissionState.ENDED);
    };
    /**
     * Returns the list of spacecrafts that needs to be destroyed by the player to complete this mission.
     * @returns {Spacecraft[]}
     */
    Mission.prototype.getTargetSpacecrafts = function () {
        return this._targetSpacecrafts;
    };
    /**
     * Returns the list of spacecrafts that needs to be escorted (protected) by the player for this mission.
     * @returns {Spacecraft[]}
     */
    Mission.prototype.getEscortedSpacecrafts = function () {
        return this._escortedSpacecrafts;
    };
    /**
     * 
     * @returns {DifficultyLevel}
     */
    Mission.prototype.getDifficultyLevel = function () {
        return this._difficultyLevel;
    };
    /**
     * Marks the mission as completed (by achieving its objectives)
     */
    Mission.prototype.completeMission = function () {
        if (this._state === MissionState.IN_PROGRESS) {
            this._state = MissionState.COMPLETED;
        }
    };
    /**
     * Marks the mission as failed (by failing one of its objectives)
     */
    Mission.prototype.failMission = function () {
        // a completed mission can still be failed, if one of the lose conditions is satisfied after the win condition
        if ((this._state === MissionState.IN_PROGRESS) || (this._state === MissionState.COMPLETED)) {
            this._state = MissionState.FAILED;
        }
    };
    /**
     * Updates the stored mission state value based on the current situation.
     */
    Mission.prototype._updateState = function () {
        var i;
        // first check for missions with a player
        if (this._pilotedCraft) {
            // if the player is destroyed, the mission state is always defeat
            if (this._pilotedCraft.canBeReused()) {
                this._state = MissionState.DEFEAT;
                return;
            } else {
                // a battle with a player and missions with no win (only lose) objectives can be completed if there are no hostiles left
                // (missionState cannot change from NONE, and missions with win objectives are completed whenever the objectives are completed,
                // regardless of remaining hostiles)
                if (this._state === MissionState.BATTLE || ((this._state === MissionState.IN_PROGRESS) && (this._winActions.length === 0))) {
                    for (i = 0; i < this._spacecrafts.length; i++) {
                        if (this._spacecrafts[i] && !this._spacecrafts[i].canBeReused() && this._pilotedCraft.isHostile(this._spacecrafts[i])) {
                            return;
                        }
                    }
                    this._state = MissionState.COMPLETED;
                    return;
                }
            }
        } else {
            // checking for missions without a player (demo, sandbox) - these go to the ENDED state after there are no hostiles left
            if (this._state === MissionState.BATTLE) {
                if (this.noHostilesPresent()) {
                    this._state = MissionState.ENDED;
                    return;
                }
            }
        }
    };
    /**
     * Returns whether there are no spacecrafts present in the mission that are hostiles towards each other
     * @returns {Boolean}
     */
    Mission.prototype.noHostilesPresent = function () {
        var i, team = null, spacecraftTeam;
        for (i = 0; i < this._spacecrafts.length; i++) {
            if (this._spacecrafts[i] && !this._spacecrafts[i].canBeReused()) {
                spacecraftTeam = this._spacecrafts[i].getTeam();
                if (spacecraftTeam && team && (spacecraftTeam !== team)) {
                    return false;
                }
                team = spacecraftTeam;
            }
        }
        return true;
    };
    /**
     * Returns how many spacecrafts are currently alive in the passed team
     * @param {Team} team
     * @returns {Number}
     */
    Mission.prototype.getSpacecraftCountForTeam = function (team) {
        var i, result = 0;
        for (i = 0; i < this._spacecrafts.length; i++) {
            if (this._spacecrafts[i] && !this._spacecrafts[i].canBeReused()) {
                if (this._spacecrafts[i].getTeam() === team) {
                    result++;
                }
            }
        }
        return result;
    };
    /**
     * Returns the sum of the score values of spacecrafts hostile to the given spacecraft are currently alive 
     * @param {Spacecraft} craft
     * @returns {Number}
     */
    Mission.prototype.getTotalHostileSpacecraftValue = function (craft) {
        var i, result = 0;
        for (i = 0; i < this._spacecrafts.length; i++) {
            if (this._spacecrafts[i] && !this._spacecrafts[i].canBeReused()) {
                if (this._spacecrafts[i].isHostile(craft)) {
                    result += this._spacecrafts[i].getScoreValue();
                }
            }
        }
        return result;
    };
    /**
     * Returns how many spacecrafts hostile to the given spacecraft are currently alive 
     * @param {Spacecraft} craft
     * @param {Boolean} [presentOnly=false] Whether to count only present (= already jumped in, has not jumpoed out yet) spacecrafts
     * @returns {Number}
     */
    Mission.prototype.getHostileSpacecraftCount = function (craft, presentOnly) {
        var i, result = 0;
        for (i = 0; i < this._spacecrafts.length; i++) {
            if (this._spacecrafts[i] && !this._spacecrafts[i].canBeReused() && (!presentOnly || !this._spacecrafts[i].isAway())) {
                if (this._spacecrafts[i].isHostile(craft)) {
                    result++;
                }
            }
        }
        return result;
    };
    /**
     * Returns the spacecraft from this mission that the current view is following in the passed scene, if any.
     * @param {Scene} scene
     * @returns {Spacecraft|null}
     */
    Mission.prototype.getFollowedSpacecraftForScene = function (scene) {
        var visualModel, i;
        if (scene.getCamera().getFollowedNode()) {
            visualModel = scene.getCamera().getFollowedNode().getRenderableObject();
            for (i = 0; i < this._spacecrafts.length; i++) {
                if (this._spacecrafts[i].getVisualModel() === visualModel) {
                    return this._spacecrafts[i];
                }
            }
        }
        return null;
    };
    /**
     * Returns the environment of this mission
     * @returns {Environment}
     */
    Mission.prototype.getEnvironment = function () {
        return this._environment;
    };
    /**
     * Returns the team with the given ID from the list of teams added to this mission.
     * @param {String} id
     * @returns {Team}
     */
    Mission.prototype.getTeam = function (id) {
        var i;
        for (i = 0; i < this._teams.length; i++) {
            if (this._teams[i].getID() === id) {
                return this._teams[i];
            }
        }
        application.showError("No team exists with ID '" + id + "'!");
        return null;
    };
    /**
     * Returns the event identified by the passed string
     * @param {String} name
     * @returns {MissionEvent}
     */
    Mission.prototype.getEvent = function (name) {
        var i;
        for (i = 0; i < this._events.length; i++) {
            if (this._events[i].getName() === name) {
                return this._events[i];
            }
        }
        application.showError("No mission event exists with name '" + name + "'!");
        return null;
    };
    /**
     * Returns a list of translated HTML strings that can be used to dislay the objectives of this mission to the player.
     * @returns {String[]}
     */
    Mission.prototype.getObjectives = function () {
        var i, result = [];
        if (this._winActions.length === 0) {
            result.push(strings.get(strings.MISSIONS.OBJECTIVE_WIN_PREFIX, strings.OBJECTIVE.DESTROY_ALL_SUFFIX.name));
        } else {
            for (i = 0; i < this._winActions.length; i++) {
                result = result.concat(this._winActions[i].getObjectiveStrings());
            }
        }
        for (i = 0; i < this._loseActions.length; i++) {
            result = result.concat(this._loseActions[i].getObjectiveStrings());
        }
        return result;
    };
    /** 
     * @typedef {Object} ObjectiveWithState
     * @property {String} text 
     * @property {Number} state From enum ObjectiveState
     */
    /**
     * Returns a list of translated strings along with objective state values for displaying the current state of mission objectives for
     * the player on the HUD
     * @returns {ObjectiveWithState[]}
     */
    Mission.prototype.getObjectivesState = function () {
        var i, result = [], suffix, hostiles, craft;
        // handling the default "destroy all enemies" implicit mission objective
        if (this._winActions.length === 0) {
            craft = this.getPilotedSpacecraft();
            suffix = "";
            if (craft) {
                hostiles = this.getHostileSpacecraftCount(craft, true);
                if (hostiles > 0) {
                    suffix = " (" + hostiles + ")";
                }
            }
            result.push({
                text: strings.get(strings.BATTLE.OBJECTIVE_WIN_PREFIX, strings.OBJECTIVE.DESTROY_ALL_SUFFIX.name) + suffix,
                state: (craft && craft.isAlive()) ? ((this.getHostileSpacecraftCount(craft, false) > 0) ? ObjectiveState.IN_PROGRESS : ObjectiveState.COMPLETED) : ObjectiveState.FAILED
            });
            // handling explicit mission objectives
        } else {
            for (i = 0; i < this._winActions.length; i++) {
                result = result.concat(this._winActions[i].getObjectivesState(this));
            }
        }
        for (i = 0; i < this._loseActions.length; i++) {
            result = result.concat(this._loseActions[i].getObjectivesState(this));
        }
        return result;
    };
    // #########################################################################
    // methods
    /**
     * Loads the required data and sets up the environment for this mission, so that its data can be accessed
     * @param {Object} dataJSON The object storing the mission data
     */
    Mission.prototype.loadEnvironment = function (dataJSON) {
        if ((typeof dataJSON.environment) === "string") {
            this._environment = environments.getEnvironment(dataJSON.environment);
            if (!this._environment) {
                application.showError("Cannot load environment '" + dataJSON.environment + "' for mission: no such environment exists!");
            }
            this._ownsEnvironment = false;
        } else if ((typeof dataJSON.environment) === "object") {
            this._environment = new environments.Environment(dataJSON.environment);
            this._ownsEnvironment = true;
        } else {
            application.showError("Invalid environment specified for mission!");
        }
    };
    /**
     * Loads the required data and sets up the triggers and actions for this mission, so that mission objectives can be determined
     * @param {Object} dataJSON The object storing the mission data
     */
    Mission.prototype.loadObjectives = function (dataJSON) {
        var i, j, actions, actionType;
        this._events = [];
        if (dataJSON.events) {
            for (i = 0; i < dataJSON.events.length; i++) {
                this._events.push(new MissionEvent(dataJSON.events[i], this));
            }
        }
        this._actionQueue = [];
        this._state = MissionState.NONE;
        this._winActions = [];
        this._loseActions = [];
        for (i = 0; i < this._events.length; i++) {
            actions = this._events[i].getActions();
            for (j = 0; j < actions.length; j++) {
                actionType = actions[j].getType();
                if (actionType === ActionType.WIN) {
                    this._winActions.push(actions[j]);
                } else if (actionType === ActionType.LOSE) {
                    this._loseActions.push(actions[j]);
                }
            }
        }
        if ((this._winActions.length > 0) || (this._loseActions.length > 0)) {
            this._state = MissionState.IN_PROGRESS;
        }
    };
    /**
     * Adds the passed Action to the list of actions scheduled for execution with the passed delay
     * @param {Action} action
     * @param {Number} delay In milliseconds
     */
    Mission.prototype.queueAction = function (action, delay) {
        this._actionQueue.push({action: action, delay: delay});
    };
    /**
     * Returns the how much base score falls on the player in this mission (out of the total enemy score value, based on the team)
     * @returns {Number}
     */
    Mission.prototype.getReferenceScore = function () {
        return this._referenceScore;
    };
    /**
     * Loads all the data describing this mission from the passed JSON object.
     * @param {Object} dataJSON
     * @param {String} difficulty The string ID of the difficulty level to use
     * @param {Boolean} demoMode If true, the data from the JSON object will be loaded in demo mode, so that the piloted craft is not set
     * and a suitable AI is added to all spacecrafts if possible.
     */
    Mission.prototype.loadFromJSON = function (dataJSON, difficulty, demoMode) {
        var i, j, craft, teamID, team, aiType, actions, count, factor, squad, names, equipments, pilotedIndex, positions, formation, orientation, spacecrafts, spacecraftDataTemplate, spacecraftData;
        application.log_DEBUG("Loading mission from JSON file...", 2);
        this._difficultyLevel = _context.getDifficultyLevel(difficulty);
        equipment.handleDifficultySet(this._difficultyLevel);
        spacecraft.resetRandomSeed();
        this._nextMissionName = dataJSON.nextMission || null;
        this.loadEnvironment(dataJSON);
        this._anticipationTheme = dataJSON.anticipationTheme;
        this._combatTheme = dataJSON.combatTheme;
        this._teams = [];
        if (dataJSON.teams) {
            for (i = 0; i < dataJSON.teams.length; i++) {
                this._teams.push(new Team(dataJSON.teams[i]));
            }
        }
        this.loadObjectives(dataJSON);
        this._views = [];
        if (dataJSON.views) {
            for (i = 0; i < dataJSON.views.length; i++) {
                this._views.push(new classes.SceneView(dataJSON.views[i]));
            }
        }
        this._spacecrafts = [];
        this._hitObjects = [];
        ai.clearAIs();
        // expand squad entries in the spacecrafts array
        spacecrafts = [];
        for (i = 0; i < dataJSON.spacecrafts.length; i++) {
            if (dataJSON.spacecrafts[i].count) {
                // extracting data used for generating differing spacecraft data properties
                // NOTE: MissionDescriptor.getPilotedSpacecraftDescriptor() also does this extraction!
                squad = dataJSON.spacecrafts[i].squad;
                names = dataJSON.spacecrafts[i].names;
                equipments = dataJSON.spacecrafts[i].equipments;
                pilotedIndex = dataJSON.spacecrafts[i].pilotedIndex;
                positions = dataJSON.spacecrafts[i].positions;
                formation = dataJSON.spacecrafts[i].formation;
                orientation = mat.rotation4FromJSON(dataJSON.spacecrafts[i].rotations);
                // creating a template to be copied for individual spacecraft data objects, without the proprties that don't refer to individual spacecrafts
                spacecraftDataTemplate = utils.deepCopy(dataJSON.spacecrafts[i]);
                delete spacecraftDataTemplate.count;
                delete spacecraftDataTemplate.names;
                delete spacecraftDataTemplate.equipments;
                delete spacecraftDataTemplate.pilotedIndex;
                delete spacecraftDataTemplate.positions;
                delete spacecraftDataTemplate.formation;
                for (j = 0; j < dataJSON.spacecrafts[i].count; j++) {
                    spacecraftData = utils.deepCopy(spacecraftDataTemplate);
                    if (squad) {
                        spacecraftData.squad = squad + " " + (j + 1).toString();
                    }
                    if (names) {
                        spacecraftData.name = names[j];
                    }
                    if (equipments) {
                        spacecraftData.equipment = equipments[j % equipments.length];
                    }
                    if (pilotedIndex === (j + 1)) {
                        spacecraftData.piloted = true;
                        delete spacecraftData.ai;
                    }
                    if (positions) {
                        spacecraftData.position = positions[j];
                    }
                    if (formation) {
                        if (positions) {
                            application.showError("Both positions and formation have been defined for spacecraft group - formation will be used!", application.ErrorSeverity.MINOR);
                        }
                        spacecraftData.position = spacecraft.Spacecraft.getPositionInFormation(formation, j, spacecraftData.position, orientation);
                    }
                    spacecrafts.push(spacecraftData);
                }
            } else {
                spacecrafts.push(dataJSON.spacecrafts[i]);
            }
        }
        // loading spacecrafts from expanded array
        for (i = 0; i < spacecrafts.length; i++) {
            craft = new spacecraft.Spacecraft();
            craft.loadFromJSON(spacecrafts[i], this._hitObjects);
            if (!demoMode && spacecrafts[i].piloted) {
                this._pilotedCraft = craft;
                craft.multiplyMaxHitpoints(this._difficultyLevel.getPlayerHitpointsFactor());
            }
            teamID = spacecrafts[i].team;
            if (teamID) {
                team = this.getTeam(teamID);
                if (team) {
                    team.addSpacecraft(craft);
                } else {
                    application.showError("Invalid team ID '" + teamID + "' specified for " + craft.getClassName() + "!");
                }
            } else if (demoMode) {
                team = new Team({
                    name: GENERIC_TEAM_NAME,
                    id: (this._teams.length + 1).toString()
                });
                this._teams.push(team);
                craft.setTeam(team);
            }
            this._spacecrafts.push(craft);
        }
        // going through ships a second round
        // loading predefined initial targets, calculating reference score (both require that all the spacecrafts already exist),
        // applying difficulty hitpoint factor for friendly spacecrafts
        // adding AI
        this._referenceScore = 0;
        team = this._pilotedCraft && this._pilotedCraft.getTeam();
        count = 0;
        factor = this._difficultyLevel.getFriendlyHitpointsFactor();
        for (i = 0; i < spacecrafts.length; i++) {
            craft = this._spacecrafts[i];
            if (spacecrafts[i].initialTarget) {
                craft.setTarget(this.getSpacecraft(spacecrafts[i].initialTarget));
            }
            if (this._pilotedCraft) {
                if (!spacecrafts[i].excludeFromReferenceScore && this._pilotedCraft.isHostile(craft)) {
                    this._referenceScore += craft.getScoreValue();
                }
                if (this._pilotedCraft.isFriendly(craft)) {
                    if (craft !== this._pilotedCraft) {
                        craft.multiplyMaxHitpoints(factor);
                    }
                    count++;
                }
            }
            aiType = spacecrafts[i].ai;
            if (!aiType && demoMode) {
                if (craft.isFighter()) {
                    aiType = config.getSetting(config.BATTLE_SETTINGS.DEMO_FIGHTER_AI_TYPE);
                } else {
                    aiType = config.getSetting(config.BATTLE_SETTINGS.DEMO_SHIP_AI_TYPE);
                }
            }
            if (aiType) {
                ai.addAI(aiType, craft, this);
            }
        }
        if (count > 0) {
            this._referenceScore /= count;
        }
        // cache target spacecrafts
        this._targetSpacecrafts = [];
        for (i = 0; i < this._events.length; i++) {
            actions = this._events[i].getActions();
            for (j = 0; j < actions.length; j++) {
                if (actions[j].getType() === ActionType.WIN) {
                    this._targetSpacecrafts = this._targetSpacecrafts.concat(this._events[i].getTrigger().getTargetSpacecrafts(this));
                }
            }
        }
        // cache escorted spacecrafts
        this._escortedSpacecrafts = [];
        for (i = 0; i < this._events.length; i++) {
            actions = this._events[i].getActions();
            for (j = 0; j < actions.length; j++) {
                if (actions[j].getType() === ActionType.LOSE) {
                    this._escortedSpacecrafts = this._escortedSpacecrafts.concat(this._events[i].getTrigger().getEscortedSpacecrafts(this));
                }
            }
        }
        // it doesn't matter if we have objectives when there in no player craft
        if (!this._pilotedCraft) {
            this._state = MissionState.NONE;
        }
        // missions without objectives or player count as battles if there are hostile ships
        if ((this._state === MissionState.NONE) && !this.noHostilesPresent()) {
            this._state = MissionState.BATTLE;
        }
        application.log_DEBUG("Mission successfully loaded.", 2);
    };
    /**
     * Returns whether the mission is starting (has been started) with the player having teammates.
     * @returns {Boolean}
     */
    Mission.prototype.isTeamMission = function () {
        return this.getPilotedSpacecraft() && this.getPilotedSpacecraft().getTeam() && (this.getPilotedSpacecraft().getTeam().getInitialCount() > 1);
    };
    /**
     * Returns an object containing the final score and score breakdown granted in this mission for the performance described by the passed 
     * metrics.
     * @param {Number} baseScore The score achieved by the player before adding any bonuses
     * @param {Number} hitRatio Number of hits / fired projectiles
     * @param {Number} hullIntegrity Current / full hitpoints
     * @param {Number} teamSurvival Surviving / initial teammates
     * @param {Number} missileHitRatio Number of missile hits / launched missiles
     * @returns {Object}
     */
    Mission.prototype.getScoreStatistics = function (baseScore, hitRatio, hullIntegrity, teamSurvival, missileHitRatio) {
        var
                isTeamMission = this.isTeamMission(),
                hitRatioBonus, hullIntegrityBonus, teamSurvivalBonus, score;
        baseScore = Math.round(baseScore);
        hitRatioBonus = Math.round((baseScore || 0) * (hitRatio || ((missileHitRatio || 0) * config.getSetting(config.BATTLE_SETTINGS.MISSILE_HIT_RATIO_FACTOR))));
        hullIntegrityBonus = Math.round(hullIntegrity * (isTeamMission ?
                config.getSetting(config.BATTLE_SETTINGS.SCORE_BONUS_FOR_HULL_INTEGRITY_TEAM) :
                config.getSetting(config.BATTLE_SETTINGS.SCORE_BONUS_FOR_HULL_INTEGRITY)));
        if (isTeamMission) {
            teamSurvivalBonus = Math.round(teamSurvival * config.getSetting(config.BATTLE_SETTINGS.SCORE_BONUS_FOR_TEAM_SURVIVAL));
        }
        score = baseScore + hitRatioBonus + hullIntegrityBonus + (isTeamMission ? teamSurvivalBonus : 0);
        return {
            baseScore: baseScore,
            hitRatioBonus: hitRatioBonus,
            hullIntegrityBonus: hullIntegrityBonus,
            teamSurvivalBonus: teamSurvivalBonus,
            score: score
        };
    };
    /**
     * Returns an object containing the score breakdown and performance information achieved by the player in this mission.
     * (assuming the mission has been completed successfully)
     * @returns {Object}
     */
    Mission.prototype.getPerformanceStatistics = function () {
        var
                /**@type Spacecraft */craft = this.getPilotedSpacecraft(),
                /**@type Boolean */isTeamMission = this.isTeamMission(),
                /**@type Number */teamSurvival = isTeamMission ? (this.getSpacecraftCountForTeam(craft.getTeam()) - (craft.isAlive() ? 1 : 0)) / (craft.getTeam().getInitialCount() - 1) : 0,
                /**@type Object */scoreStats = this.getScoreStatistics(craft.getScore(), craft.getHitRatio(), craft.getHullIntegrity(), teamSurvival, craft.getMissileHitRatio()),
                /**@type Object */perfInfo = _context.getPerformanceInfo(this, scoreStats.score);
        return {
            baseScore: scoreStats.baseScore,
            hitRatioBonus: scoreStats.hitRatioBonus,
            hullIntegrityBonus: scoreStats.hullIntegrityBonus,
            teamSurvival: isTeamMission ? teamSurvival : undefined,
            teamSurvivalBonus: scoreStats.teamSurvivalBonus,
            score: scoreStats.score,
            performance: perfInfo.performance,
            nextPerformance: perfInfo.nextPerformance,
            nextPerformanceScore: perfInfo.nextPerformanceScore
        };
    };
    /**
     * Creates and returns a camera configuration for this given view set up according to the scene view's parameters.
     * @param {SceneView} view
     * @param {Scene} scene
     * @returns {CameraConfiguration} The created camera configuration.
     */
    Mission.prototype.createCameraConfigurationForSceneView = function (view, scene) {
        var positionConfiguration, orientationConfiguration, angles = mat.getYawAndPitch(view.getOrientationMatrix());
        positionConfiguration = new camera.CameraPositionConfiguration(
                !view.isMovable(),
                view.turnsAroundObjects(),
                view.movesRelativeToObject(),
                view.getPositionFollowedObjectsForScene(scene),
                view.startsWithRelativePosition(),
                mat.matrix4(view.getPositionMatrix()),
                view.getDistanceRange(),
                view.getConfines(),
                view.resetsWhenLeavingConfines());
        orientationConfiguration = new camera.CameraOrientationConfiguration(
                !view.isTurnable(),
                view.pointsTowardsObjects(),
                view.isFPS(),
                view.getOrientationFollowedObjectsForScene(scene),
                mat.matrix4(view.getOrientationMatrix()),
                Math.degrees(angles.yaw), Math.degrees(angles.pitch),
                view.getAlphaRange(),
                view.getBetaRange(),
                view.getBaseOrientation() || config.getDefaultCameraBaseOrientation(),
                view.getPointToFallback() || config.getDefaultCameraPointToFallback());
        return new camera.CameraConfiguration(
                view.getName(),
                positionConfiguration, orientationConfiguration,
                view.getFOV() || config.getDefaultCameraFOV(),
                view.getFOVRange() || config.getDefaultCameraFOVRange(),
                view.getSpan() || config.getDefaultCameraSpan(),
                view.getSpanRange() || config.getDefaultCameraSpanRange(),
                view.resetsOnFocusChange());
    };
    /**
     * Spacecrafts that start away and jump in during the mission need to be added to the hitObjects when they jump in, so that other will
     * be able to hit them
     * @param {Spacecraft} spacecraft
     */
    Mission.prototype._handleSpacecraftJumpIn = function (spacecraft) {
        if (this._hitObjects.indexOf(spacecraft) <= 0) {
            this._hitObjects.push(spacecraft);
        }
    };
    /**
     * Returns the highest number of projectiles that might be used by the spacecrafts of this mission simultaneously.
     * @returns {Number}
     */
    Mission.prototype.getMaxProjectileCount = function () {
        var result = 0, i;
        for (i = 0; i < this._spacecrafts.length; i++) {
            result += this._spacecrafts[i].getMaxProjectileCount();
        }
        return result;
    };
    /**
     * Returns the highest number of missiles that might be used by the spacecrafts of this mission simultaneously.
     * @returns {Number}
     */
    Mission.prototype.getMaxMissileCount = function () {
        var result = 0, i;
        for (i = 0; i < this._spacecrafts.length; i++) {
            result += this._spacecrafts[i].getMaxMissileCount();
        }
        return result;
    };
    /**
     * Returns the highest number of explosions that might be used by the spacecrafts of this mission simultaneously.
     * @returns {Number}
     */
    Mission.prototype.getMaxExplosionCount = function () {
        var result = 0, i;
        for (i = 0; i < this._spacecrafts.length; i++) {
            result += this._spacecrafts[i].getMaxExplosionCount();
        }
        return result;
    };
    /**
     * Returns the highest number of particles that might be used by the spacecrafts of this mission simultaneously.
     * @returns {Number}
     */
    Mission.prototype.getMaxParticleCount = function () {
        var result = 0, i;
        for (i = 0; i < this._spacecrafts.length; i++) {
            result += this._spacecrafts[i].getMaxParticleCount();
        }
        return result;
    };
    /**
     * @typedef {Object} PreviewParams
     * @property {String} spacecraftShaderName
     * @property {String} gridShaderName
     * @property {String} markerShaderName
     * @property {Number[4]} gridColor
     * @property {Number} gridCount
     * @property {Number} smallestGridSize
     * @property {Number} markerSize
     * @property {Number[4]} markerColor
     * @property {Number[4]} friendlyColor 
     * @property {Number[4]} hostileColor 
     * @property {Number} smallestSizeWhenDrawn
     * @property {Number} awayColorFactor
     * @property {Number} awayAlphaFactor
     */
    /**
     * Adds renderable objects representing all visual elements of the mission to
     * the passed scene.
     * @param {Scene} battleScene
     * @param {Scene} targetScene
     * @param {PreviewParams} [previewParams]
     */
    Mission.prototype.addToScene = function (battleScene, targetScene, previewParams) {
        var i, preview = !!previewParams,
                friendly, friendlyColor, hostileColor, markerColor, callback,
                white = [1, 1, 1],
                getSpacecraftColor;
        if (this._environment) {
            this._environment.addToScene(battleScene);
        }
        if (preview) {
            // add grids
            graphics.getShader(previewParams.gridShaderName);
            graphics.getShader(previewParams.markerShaderName);
            markerColor = previewParams.markerColor;
            resources.getOrAddModel(egomModel.gridModel(GRID_MODEL_NAME, 2 * previewParams.smallestGridSize, 2 * previewParams.smallestGridSize, 2 * previewParams.smallestGridSize + 1, 2 * previewParams.smallestGridSize + 1, white));
            resources.getOrAddModel(egomModel.positionMarkerModel(MARKER_MODEL_NAME, 8, white));
            resources.executeWhenReady(function () {
                var i, size, grid,
                        gridColor = previewParams.gridColor,
                        shader = graphics.getManagedShader(previewParams.gridShaderName),
                        model = graphics.getModel(GRID_MODEL_NAME).getEgomModel();
                size = previewParams.smallestGridSize;
                for (i = 0; i < previewParams.gridCount; i++) {
                    grid = new renderableObjects.ShadedLODMesh(model, shader, {}, mat.identity4(), mat.identity4(), mat.scaling4(size), true, 0, previewParams.smallestSizeWhenDrawn);
                    grid.setUniformValueFunction(renderableObjects.UNIFORM_COLOR_NAME, function () {
                        return gridColor;
                    });
                    grid.setUniformValueFunction(_groupTransformsArrayName, function () {
                        return graphics.getGroupTransformIdentityArray();
                    });
                    battleScene.addObject(grid, false);
                    size *= previewParams.smallestGridSize;
                }
            });
            // set up the callback to be used on added spacecrafts
            friendlyColor = previewParams.friendlyColor;
            hostileColor = previewParams.hostileColor;
            getSpacecraftColor = function (spacecraft, color) {
                return spacecraft.isAway() ?
                        [
                            previewParams.awayColorFactor * color[0],
                            previewParams.awayColorFactor * color[1],
                            previewParams.awayColorFactor * color[2],
                            previewParams.awayAlphaFactor * color[3]
                        ] :
                        color;
            };
            callback = function (spacecraft, color, model) {
                var marker, position = model.getPositionMatrix(), ownColor = getSpacecraftColor(spacecraft, color);
                model.setUniformValueFunction(renderableObjects.UNIFORM_COLOR_NAME, function () {
                    return ownColor;
                });
                if (position[14] !== 0) {
                    marker = new renderableObjects.ShadedLODMesh(resources.getModel(MARKER_MODEL_NAME).getEgomModel(), graphics.getManagedShader(previewParams.markerShaderName), {},
                            mat.translation4(position[12], position[13], 0), mat.identity4(), mat.scaling4(previewParams.markerSize, previewParams.markerSize, position[14]), true, 0, previewParams.smallestSizeWhenDrawn);
                    marker.setUniformValueFunction(renderableObjects.UNIFORM_COLOR_NAME, function () {
                        return markerColor;
                    });
                    battleScene.addObject(marker, false);
                }
            };
        }
        for (i = 0; i < this._spacecrafts.length; i++) {
            if (preview) {
                friendly = !this.getPilotedSpacecraft() || !this._spacecrafts[i].isHostile(this.getPilotedSpacecraft());
            }
            this._spacecrafts[i].addToScene(battleScene, undefined, preview, {
                hitboxes: application.isDebugVersion(),
                weapons: true,
                missilesInLaunchers: graphics.areMissilesInLaunchersVisible(),
                thrusterParticles: !preview,
                projectileResources: !preview,
                missileResources: !preview,
                explosion: !preview,
                damageIndicators: !preview,
                cameraConfigurations: !preview,
                lightSources: !preview,
                blinkers: !preview,
                jumpEngine: !preview,
                shield: !preview,
                sound: !preview
            }, {
                randomAnimationTime: true,
                smallestSizeWhenDrawn: preview ? previewParams.smallestSizeWhenDrawn : undefined,
                shaderName: preview ? previewParams.spacecraftShaderName : null
            }, preview ? callback.bind(this, this._spacecrafts[i], friendly ? friendlyColor : hostileColor) : null);
            if (targetScene) {
                this._spacecrafts[i].addToScene(targetScene, graphics.getMaxLoadedLOD(), true, {
                    weapons: true
                }, {
                    shaderName: config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_VIEW_TARGET_ITEM_SHADER)
                });
            }
            if (!this._spacecrafts[i].isAway()) {
                this._hitObjects.push(this._spacecrafts[i]);
            } else {
                this._spacecrafts[i].addEventHandler(SpacecraftEvents.JUMPED_IN, this._handleSpacecraftJumpIn.bind(this, this._spacecrafts[i]));
            }
        }
        if (!preview) {
            resources.executeWhenReady(function () {
                if (this._views.length > 0) {
                    for (i = 0; i < this._views.length; i++) {
                        battleScene.addCameraConfiguration(this.createCameraConfigurationForSceneView(this._views[i], battleScene));
                        if (i === 0) {
                            battleScene.getCamera().followNode(null, true, 0);
                        }
                    }
                } else if (this.getPilotedSpacecraft()) {
                    battleScene.getCamera().followNode(this.getPilotedSpacecraft().getVisualModel().getNode(), true, 0, null, config.getDefaultCamerConfigurationName(this.getPilotedSpacecraft()));
                }
                battleScene.getCamera().update(0);
                // prefilling the pools with objects to avoid creating lots of new objects at the start of the mission as the pools grow
                _particlePool.prefill(Math.ceil(this.getMaxParticleCount() * config.getSetting(config.BATTLE_SETTINGS.PARTICLE_POOL_PREFILL_FACTOR)));
                _projectilePool.prefill(Math.ceil(this.getMaxProjectileCount() * config.getSetting(config.BATTLE_SETTINGS.PROJECTILE_POOL_PREFILL_FACTOR)), function (proj) {
                    proj.createVisualModel();
                });
                _missilePool.prefill(Math.ceil(this.getMaxMissileCount() * config.getSetting(config.BATTLE_SETTINGS.MISSILE_POOL_PREFILL_FACTOR)), function (miss) {
                    miss.createVisualModel();
                });
                _explosionPool.prefill(Math.ceil(this.getMaxExplosionCount() * config.getSetting(config.BATTLE_SETTINGS.EXPLOSION_POOL_PREFILL_FACTOR)), function (exp) {
                    exp.createVisualModel();
                });
                _trailSegmentPool.prefill(Math.ceil(this.getMaxMissileCount() * config.getSetting(config.BATTLE_SETTINGS.MISSILE_POOL_PREFILL_FACTOR) * config.getSetting(config.BATTLE_SETTINGS.TRAIL_SEGMENT_POOL_PREFILL_FACTOR)));
            }.bind(this));
        }
    };
    /**
     * Toggles the visibility of the hitboxes of all spacecrafts in the mission.
     */
    Mission.prototype.toggleHitboxVisibility = function () {
        var i;
        for (i = 0; i < this._spacecrafts.length; i++) {
            this._spacecrafts[i].toggleHitboxVisibility();
        }
    };
    /**
     * Function to execute during every simulation step on projectiles taken from the projectile pool
     * @param {Number} dt The elapsed time since the last simulation step
     * @param {Octree} octree An octree containing the objects that can be hit by the projectiles
     * @param {Projectile} projectile The projectile to handle 
     * @param {Number} indexInPool The index of the projectile within the projectile pool
     */
    Mission._handleProjectile = function (dt, octree, projectile, indexInPool) {
        projectile.simulate(dt, octree, this._pilotedCraft);
        if (projectile.canBeReused()) {
            _projectilePool.markAsFree(indexInPool);
        }
    };
    /**
     * Function to execute during every simulation step on missiles taken from the missile pool
     * @param {Number} dt The elapsed time since the last simulation step
     * @param {Octree} octree An octree containing the objects that can be hit by the missiles
     * @param {Missile} missile The missile to handle
     * @param {Number} indexInPool The index of the missile within the missile pool
     */
    Mission._handleMissile = function (dt, octree, missile, indexInPool) {
        missile.simulate(dt, octree, this._pilotedCraft);
        if (missile.canBeReused()) {
            _missilePool.markAsFree(indexInPool);
        }
    };
    /**
     * Function to execute during every simulation step on trail segments taken from the pool
     * @param {TrailSegment} segment The trail segment to handle
     * @param {Number} indexInPool The index of the segment within the pool
     */
    Mission._handleTrailSegment = function (segment, indexInPool) {
        if (segment.canBeReused()) {
            _trailSegmentPool.markAsFree(indexInPool);
        }
    };
    /**
     * Function to execute during every simulation step on explosions taken from the explosion pool
     * @param {Explosion} explosion The explosion to handle
     * @param {Number} indexInPool The index of the explosion within the explosion pool
     */
    Mission._handleExplosion = function (explosion, indexInPool) {
        if (explosion.canBeReused()) {
            _explosionPool.markAsFree(indexInPool);
        }
    };
    /**
     * Function to execute during every simulation step on particles taken from the particle pool
     * @param {Particle} particle The particle to handle
     * @param {Number} indexInPool The index of the particle within the particle pool
     */
    Mission._handleParticle = function (particle, indexInPool) {
        if (particle.canBeReused()) {
            _particlePool.markAsFree(indexInPool);
        }
    };
    /**
     * Function to filter out those actions from the scheduled action list that still need to be executed after this simulation step
     * @param {Object} actionEntry
     * @returns {Boolean}
     */
    Mission._filterActionEntry = function (actionEntry) {
        return actionEntry.delay > 0;
    };
    /**
     * Performs the physics and game logic simulation of all the object in the mission.
     * @param {Number} dt The time passed since the last simulation step, in milliseconds.
     * @param {Scene} mainScene When given, this scene is updated according to the simulation.
     */
    Mission.prototype.tick = function (dt, mainScene) {
        var i, v, octree, index;
        if (this._environment) {
            this._environment.simulate();
        }
        for (i = 0; i < this._actionQueue.length; i++) {
            this._actionQueue[i].delay -= dt;
            if (this._actionQueue[i].delay <= 0) {
                this._actionQueue[i].action.execute(this);
            }
        }
        this._actionQueue = this._actionQueue.filter(Mission._filterActionEntry);
        for (i = 0; i < this._events.length; i++) {
            this._events[i].simulate(this, dt);
        }
        for (i = 0; i < this._spacecrafts.length; i++) {
            this._spacecrafts[i].simulate(dt);
            if (this._spacecrafts[i].canBeReused() || this._spacecrafts[i].isAway()) {
                index = this._hitObjects.indexOf(this._spacecrafts[i]);
                if (index >= 0) {
                    this._hitObjects[index] = null;
                    this._hitObjects.splice(index, 1);
                }
                if (this._spacecrafts[i].canBeReused()) {
                    this._spacecrafts[i].destroy(true);
                    this._spacecrafts[i] = null;
                    this._spacecrafts.splice(i, 1);
                    i--;
                }
            } else if (_showHitboxesForHitchecks) {
                this._spacecrafts[i].hideHitbox();
            }
        }
        if (_projectilePool.hasLockedObjects()) {
            octree = new Octree(this._hitObjects, 2, 1, true);
            _projectilePool.executeForLockedObjects(Mission._handleProjectile.bind(this, dt, octree));
        }
        if (_missilePool.hasLockedObjects()) {
            octree = octree || new Octree(this._hitObjects, 2, 1, true);
            _missilePool.executeForLockedObjects(Mission._handleMissile.bind(this, dt, octree));
        }
        if (_explosionPool.hasLockedObjects()) {
            _explosionPool.executeForLockedObjects(Mission._handleExplosion);
        }
        if (_particlePool.hasLockedObjects()) {
            _particlePool.executeForLockedObjects(Mission._handleParticle);
        }
        if (_trailSegmentPool.hasLockedObjects()) {
            _trailSegmentPool.executeForLockedObjects(Mission._handleTrailSegment);
        }
        // moving the scene back to the origo if the camera is too far away to avoid floating point errors becoming visible
        if (mainScene) {
            v = mainScene.moveCameraToOrigoIfNeeded(config.getSetting(config.BATTLE_SETTINGS.MOVE_TO_ORIGO_DISTANCE));
            if (v) {
                ai.handleSceneMoved(v);
            }
        }
        this._updateState();
        if (application.isDebugVersion()) {
            _debugInfo =
                    "Part: " + _particlePool.getLockedObjectCount() + " / " + _particlePool._objects.length + "<br/>" +
                    "Proj: " + _projectilePool.getLockedObjectCount() + " / " + _projectilePool._objects.length + "<br/>" +
                    "Miss: " + _missilePool.getLockedObjectCount() + " / " + _missilePool._objects.length + "<br/>" +
                    "Expl: " + _explosionPool.getLockedObjectCount() + " / " + _explosionPool._objects.length + "<br/>" +
                    "Trai: " + _trailSegmentPool.getLockedObjectCount() + " / " + _trailSegmentPool._objects.length;
        }
    };
    /**
     * Removes all references to other objects for proper cleanup of memory.
     */
    Mission.prototype.destroy = function () {
        var i;
        if (this._environment) {
            if (this._ownsEnvironment) {
                this._environment.destroy();
            } else {
                this._environment.removeFromScene();
            }
        }
        this._environment = null;
        if (this._views) {
            for (i = 0; i < this._views.length; i++) {
                if (this._views[i]) {
                    this._views[i].destroy();
                    this._views[i] = null;
                }
            }
            this._views = null;
        }
        if (this._spacecrafts) {
            for (i = 0; i < this._spacecrafts.length; i++) {
                if (this._spacecrafts[i]) {
                    this._spacecrafts[i].destroy();
                    this._spacecrafts[i] = null;
                }
            }
            this._spacecrafts = null;
        }
        this._pilotedCraft = null;
        this._hitObjects = null;
        _particlePool.clear();
        _projectilePool.clear();
        _missilePool.clear();
        _explosionPool.clear();
        _trailSegmentPool.clear();
    };
    // #########################################################################
    /**
     * @typedef {Object} MissionDescriptor~LocalData
     * @property {Number} bestScore 
     * @property {String} bestPerformance
     * @property {Number} winCount
     * @property {Number} loseCount
     */
    /**
     * @class Stores the data needed to initialize a mission. Used so that the data can be accessed (such as description, objectives) before
     * creating the Mission object itself (with all spacecrafts etc for the battle simulation) i.e. during mission briefing
     * @extends JSONResource
     * @param {Object} dataJSON The object storing the mission data or a reference to the file which stores the data
     * @param {String} folder The ID of the folder from where to load the data file in case the data passed here just stores a reference
     */
    function MissionDescriptor(dataJSON, folder) {
        resourceManager.JSONResource.call(this, dataJSON, folder, true);
        /**
         * Returns whether the mission described is a test mission (to be listed only in debug mode)
         * @type Boolean
         */
        this._test = (this._dataJSON.test === true);
        /**
         * The cached value of the spacecraft descriptor object belonging to the piloted spacecraft
         * (since it might need to be extracted from a bulk spacecraft descriptor, so that the extraction is only done the first time)
         * @type Object
         */
        this._pilotedSpacecraftDescriptor = null;
        /**
         * The data that is saved to / loaded from local storage about this mission
         * @type MissionDescriptor~LocalData
         */
        this._localData = JSON.parse(localStorage[this._getLocalStorageID()] || "{}");
        this._initLocalData();
    }
    MissionDescriptor.prototype = new resourceManager.JSONResource();
    MissionDescriptor.prototype.constructor = MissionDescriptor;
    /**
     * Initializes missing values within the object storing the local data for the mission descriptor
     * (those which are not allowed to be undefined)
     */
    MissionDescriptor.prototype._initLocalData = function () {
        var i, data, difficulties = _context.getDifficultyNames();
        for (i = 0; i < difficulties.length; i++) {
            this._localData[difficulties[i]] = this._localData[difficulties[i]] || {};
            data = this._localData[difficulties[i]];
            data.winCount = data.winCount || 0;
            data.loseCount = data.loseCount || 0;
        }
    };
    /**
     * Returns the location ID to use when saving/loading the best score value to/from local storage
     * @returns {String}
     */
    MissionDescriptor.prototype._getLocalStorageID = function () {
        return MODULE_LOCAL_STORAGE_PREFIX + this.getName();
    };
    /**
     * Updates the data saved of this mission in local storage
     */
    MissionDescriptor.prototype._saveLocalData = function () {
        localStorage[this._getLocalStorageID()] = JSON.stringify(this._localData);
    };
    /**
     * Returns whether the mission described is a test mission (to be listed only in debug mode)
     * @returns {Boolean}
     */
    MissionDescriptor.prototype.isTest = function () {
        return this._test;
    };
    /**
     * Returns the raw description of this mission (as given in the data JSON)
     * @returns {String} 
     */
    MissionDescriptor.prototype.getDescription = function () {
        return this._dataJSON.description || "";
    };
    /**
     * Returns the user-friendly, translated and fallback protected version of the description of this mission.
     * @returns {String} 
     */
    MissionDescriptor.prototype.getDisplayDescription = function () {
        return strings.get(
                strings.MISSION.PREFIX, utils.getFilenameWithoutExtension(this.getName()) + strings.MISSION.DESCRIPTION_SUFFIX.name,
                (this.getDescription() ?
                        utils.formatString(strings.get(strings.MISSIONS.NO_TRANSLATED_DESCRIPTION), {
                            originalDescription: this.getDescription()
                        }) :
                        strings.get(strings.MISSIONS.NO_DESCRIPTION)));
    };
    /**
     * Returns the descriptor of the spacecraft the user is piloting in this mission.
     * @returns {Object}
     */
    MissionDescriptor.prototype.getPilotedSpacecraftDescriptor = function () {
        var i, result;
        if (!this._pilotedSpacecraftDescriptor) {
            for (i = 0; i < this._dataJSON.spacecrafts.length; i++) {
                if (this._dataJSON.spacecrafts[i].piloted) {
                    this._pilotedSpacecraftDescriptor = this._dataJSON.spacecrafts[i];
                    break;
                }
                if (this._dataJSON.spacecrafts[i].pilotedIndex) {
                    result = utils.deepCopy(this._dataJSON.spacecrafts[i]);
                    if (result.names) {
                        result.name = result.names[result.pilotedIndex - 1];
                        delete result.names;
                    }
                    if (result.equipments) {
                        result.equipment = result.equipments[result.pilotedIndex - 1];
                        delete result.equipments;
                    }
                    delete result.count;
                    delete result.pilotedIndex;
                    delete result.positions;
                    delete result.formation;
                    this._pilotedSpacecraftDescriptor = result;
                    break;
                }
            }
        }
        return this._pilotedSpacecraftDescriptor;
    };
    /**
     * Returns the environment of the described mission.
     * Only works after the mission data has been loaded!
     * @returns {Environment}
     */
    MissionDescriptor.prototype.getEnvironment = function () {
        var mission = null;
        if (this.isReadyToUse()) {
            mission = new Mission(this.getName());
            mission.loadEnvironment(this._dataJSON);
            return mission.getEnvironment();
        }
        application.showError("Cannot get mission environment from mission descriptor that has not yet been initialized!");
        return null;
    };
    /**
     * Returns a list of translated HTML strings that can be used to display the objectives of this mission to the player.
     * Only works if the mission data file has already been loaded!
     * @returns {String[]}
     */
    MissionDescriptor.prototype.getMissionObjectives = function () {
        var mission = null;
        if (this.isReadyToUse()) {
            mission = new Mission(this.getName());
            mission.loadObjectives(this._dataJSON);
            return mission.getObjectives();
        }
        application.showError("Cannot get mission objectives from mission descriptor that has not yet been initialized!");
        return null;
    };
    /**
     * Returns the list of string IDs for gameplay tips that can be displayed for the player at the start of this mission.
     * (overrides the global list)
     * @returns {String[]}
     */
    MissionDescriptor.prototype.getTipIDs = function () {
        return this._dataJSON.tips;
    };
    /**
     * Creates and returns a Mission object based on the data stored in this descriptor. Only works if the data has been loaded - either it
     * was given when constructing this object, or it was requested and has been loaded
     * @param {String} difficulty The string ID of the difficulty level to use
     * @param {Boolean} demoMode Whether to load the created mission in demo mode
     * @returns {Mission}
     */
    MissionDescriptor.prototype.createMission = function (difficulty, demoMode) {
        var result = null;
        if (this.isReadyToUse()) {
            result = new Mission(this.getName());
            result.loadFromJSON(this._dataJSON, difficulty, demoMode);
        } else {
            application.showError("Cannot create mission from descriptor that has not yet been initialized!");
        }
        return result;
    };
    /**
     * Returns the current best score reached for the mission (also stored in local storage)
     * @param {String} [difficulty] The string ID of the difficulty level to consider (if not given, the currently set difficulty will be used)
     * @returns {Number}
     */
    MissionDescriptor.prototype.getBestScore = function (difficulty) {
        difficulty = difficulty || _context.getDifficulty();
        return this._localData[difficulty].bestScore;
    };
    /**
     * Returns the ID of the best performance level reached for the mission (also stored in local storage)
     * @param {String} [difficulty] The string ID of the difficulty level to consider (if not given, the currently set difficulty will be used)
     * @returns {String}
     */
    MissionDescriptor.prototype.getBestPerformance = function (difficulty) {
        difficulty = difficulty || _context.getDifficulty();
        return this._localData[difficulty].bestPerformance;
    };
    /**
     * Checks whether the passed score exceeds the current best score of the mission, and if so, updates the value both in this object and in
     * local storage
     * @param {Number} score
     * @param {String} performance The ID of the achieved performance level
     * @param {String} [difficulty] The string ID of the difficulty level to consider (if not given, the currently set difficulty will be used)
     * @returns {Boolean}
     */
    MissionDescriptor.prototype.updateBestScore = function (score, performance, difficulty) {
        difficulty = difficulty || _context.getDifficulty();
        var data = this._localData[difficulty];
        if ((data.bestScore === undefined) || (score > data.bestScore)) {
            data.bestScore = score;
            data.bestPerformance = performance;
            this._saveLocalData();
            return true;
        }
        return false;
    };
    /**
     * Increases the win or lose count of the mission depending on the passed parameter, and saves the new data to local storage
     * @param {Boolean} victory
     * @param {String} [difficulty] The string ID of the difficulty level to consider (if not given, the currently set difficulty will be used)
     */
    MissionDescriptor.prototype.increasePlaythroughCount = function (victory, difficulty) {
        difficulty = difficulty || _context.getDifficulty();
        if (victory) {
            this._localData[difficulty].winCount++;
        } else {
            this._localData[difficulty].loseCount++;
        }
        this._saveLocalData();
    };
    /**
     * Returns the number of times this mission has been won by the player
     * @param {String} [difficulty] The string ID of the difficulty level to consider (if not given, the currently set difficulty will be used)
     * @returns {Number}
     */
    MissionDescriptor.prototype.getWinCount = function (difficulty) {
        difficulty = difficulty || _context.getDifficulty();
        return this._localData[difficulty].winCount;
    };
    // #########################################################################
    /**
     * @class Represents a game difficulty level the player can set which is then used to adjust the values of some
     * in-game variables (e.g. armor of the player) to make the game more or less challenging. Mision performance is
     * tracked separately for each difficulty level.
     * The levels can be defined in config.json.
     * @param {Object} dataJSON Contains the data to initialize the difficulty level from
     */
    function DifficultyLevel(dataJSON) {
        /**
         * The string ID of this difficulty level
         * @type String
         */
        this._name = dataJSON.name;
        /*
         * The number of hitpoints the player's spacecraft has at the start of the mission is multiplied by this factor
         * (when playing on the corresponding difficulty level)
         * @type Number
         */
        this._playerHitpointsFactor = dataJSON.playerHitpointsFactor;
        /*
         * The number of hitpoints the friendly spacecrafts have at the start of the mission is multiplied by this factor
         * (when playing on the corresponding difficulty level)
         * @type Number
         */
        this._friendlyHitpointsFactor = dataJSON.friendlyHitpointsFactor;
        /*
         * The reaction time of hostile AI is multiplied by this factor
         * (when playing on the corresponding difficulty level)
         * @type Number
         */
        this._enemyReactionTimeFactor = dataJSON.enemyReactionTimeFactor;
        /**
         * Whether the player ship can damage itself (e.g. by flying into its own launched missile)
         * (when playing on the corresponding difficulty level)
         * @type Boolean
         */
        this._playerSelfDamage = dataJSON.playerSelfDamage;
        /**
         * Whether friendly fire can damage the player ship
         * (when playing on the corresponding difficulty level)
         * @type Boolean
         */
        this._playerFriendlyFireDamage = dataJSON.playerFriendlyFireDamage;
        /**
         * The offset (i.e. enlargement) to apply to hitboxes when the player is shooting hostiles, in meters
         * (when playing on the corresponding difficulty level)
         * @type Number
         */
        this._hitboxOffset = dataJSON.hitboxOffset;
    }
    /**
     * Returns the string ID for this difficulty level
     * @returns {String}
     */
    DifficultyLevel.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the factor by which to multiply the hitpoints of the player's spacecraft at the start of the mission.
     * @returns {Number}
     */
    DifficultyLevel.prototype.getPlayerHitpointsFactor = function () {
        return this._playerHitpointsFactor;
    };
    /**
     * Returns the factor by which to multiply the hitpoints of friendly spacecrafts at the start of the mission.
     * @returns {Number}
     */
    DifficultyLevel.prototype.getFriendlyHitpointsFactor = function () {
        return this._friendlyHitpointsFactor;
    };
    /**
     * Returns the factor by which to multiply the reaction time of enemy AIs.
     * @returns {Number}
     */
    DifficultyLevel.prototype.getEnemyReactionTimeFactor = function () {
        return this._enemyReactionTimeFactor;
    };
    /**
     * Whether the player ship can damage itself (e.g. by flying into its own launched missile)
     * @returns {Boolean}
     */
    DifficultyLevel.prototype.getPlayerSelfDamage = function () {
        return this._playerSelfDamage;
    };
    /**
     * Whether friendly fire can damage the player ship
     * @returns {Boolean}
     */
    DifficultyLevel.prototype.getPlayerFriendlyFireDamage = function () {
        return this._playerFriendlyFireDamage;
    };
    /**
     * The offset (i.e. enlargement) to apply to hitboxes when the player is shooting hostiles, in meters
     * @returns {Number}
     */
    DifficultyLevel.prototype.getHitboxOffset = function () {
        return this._hitboxOffset;
    };
    // #########################################################################
    /**
     * @class The performance of players during missions is evaluated and classified into one of several levels upon the completion of the
     * missions. A corresponding medal can be earned for each performance level. The levels can be defined in config.json.
     * @param {Object} dataJSON Contains the data to initialize the performance level from
     */
    function MissionPerformanceLevel(dataJSON) {
        /**
         * The string ID of this performance level
         * @type String
         */
        this._name = dataJSON.name;
        /*
         * To achieve this performance level, the player needs to earn a base score that is not less than the reference score for the 
         * mission multiplied by this factor (for team missions only)
         * @type Number
         */
        this._referenceBaseScoreFactor = dataJSON.referenceBaseScoreFactor;
        /*
         * To achieve this performance level, the player needs to complete the mission with a hit ratio not less than this value
         * @type Number
         */
        this._referenceHitRatio = dataJSON.referenceHitRatio;
        /*
         * To achieve this performance level, the player needs to complete the mission with a hull integrity not less than this value
         * @type Number
         */
        this._referenceHullIntegrity = dataJSON.referenceHullIntegrity;
        /*
         * To achieve this performance level, the player needs to complete the mission with a team survival rate not less than this value
         * (for team missions only)
         * @type Number
         */
        this._referenceTeamSurvival = dataJSON.referenceTeamSurvival;
    }
    /**
     * Returns the string ID for this performance level
     * @returns {String}
     */
    MissionPerformanceLevel.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the amount of score points required in the passed mission to earn this performance level.
     * @param {Mission} mission
     * @returns {Number}
     */
    MissionPerformanceLevel.prototype.getRequiredScore = function (mission) {
        return this._referenceBaseScoreFactor ? mission.getScoreStatistics(
                mission.getReferenceScore() * (mission.isTeamMission() ? this._referenceBaseScoreFactor : 1),
                this._referenceHitRatio,
                this._referenceHullIntegrity,
                this._referenceTeamSurvival).score : 0;
    };
    // #########################################################################
    /**
     * @class A class responsible for loading and storing game logic related 
     * settings and data as well and provide an interface to access them.
     * @extends AsyncResource
     */
    function MissionContext() {
        asyncResource.AsyncResource.call(this);
        /**
         * The string ID of the currently set (default) difficulty level
         * @type String
         */
        this._difficulty = null;
        /**
         * Stores the available difficulty levels the player can choose from (defined in config.json)
         * @type DifficultyLevel[]
         */
        this._difficultyLevels = null;
        /**
         * Stores them achievable mission performance levels defined in config.json
         * @type MissionPerformanceLevel[]
         */
        this._missionPerformanceLevels = null;
        /**
         * The string IDs for gameplay tips that can be displayed for the player at the start of missions.
         * The list is defined in config.json.
         * @type String[]
         */
        this._tipIDs = null;
        /**
         * Stores (and manages the loading of) the descriptors for the missions.
         * @type ResourceManager
         */
        this._missionManager = new resourceManager.ResourceManager();
    }
    MissionContext.prototype = new asyncResource.AsyncResource();
    MissionContext.prototype.constructor = MissionContext;
    /**
     * Returns an object containing the performance level the player earned in this mission as well as (if available) the next (one level
     * higher) performance level that can be achieved and how many score points are necessary for earning it.
     * (assuming the mission has been successfully completed)
     * @param {Mission} mission The mission the player completed
     * @param {Number} score The final score the player achieved
     * @returns {Object}
     */
    MissionContext.prototype.getPerformanceInfo = function (mission, score) {
        var i, result = {}, length = this._missionPerformanceLevels.length;
        for (i = 0; i < length; i++) {
            if (score < this._missionPerformanceLevels[i].getRequiredScore(mission)) {
                break;
            }
        }
        result.performance = (i > 0) ? this._missionPerformanceLevels[i - 1].getName() : FAILED_MISSION_PERFORMACE;
        result.nextPerformance = (i < length) ? this._missionPerformanceLevels[i].getName() : null;
        result.nextPerformanceScore = result.nextPerformance ? this._missionPerformanceLevels[i].getRequiredScore(mission) : 0;
        return result;
    };
    /**
     * Loads the general game logic configuration defined in the passed JSON object (from config.json), such as available mission 
     * performance or difficulty levels.
     * @param {Object} dataJSON
     */
    MissionContext.prototype.loadConfigurationFromJSON = function (dataJSON) {
        var i;
        this._difficultyLevels = [];
        for (i = 0; i < dataJSON.difficultyLevels.length; i++) {
            this._difficultyLevels.push(new DifficultyLevel(dataJSON.difficultyLevels[i]));
        }
        this._missionPerformanceLevels = [];
        for (i = 0; i < dataJSON.missionPerformanceLevels.length; i++) {
            this._missionPerformanceLevels.push(new MissionPerformanceLevel(dataJSON.missionPerformanceLevels[i]));
        }
        this._tipIDs = dataJSON.tips;
    };
    /**
     * Loads the values of the settings which are stored in local storage, such as the chosen default difficulty level.
     */
    MissionContext.prototype.loadSettingsFromLocalStorage = function () {
        var value, params;
        // load default difficulty
        this._difficulty = _context.getDifficultyNames()[0];
        if (localStorage[DIFFICULTY_LOCAL_STORAGE_ID] !== undefined) {
            // settings might be saved in different formats in different game versions, so do not show errors for invalid type if the version
            // has changed since the last run
            params = {
                silentFallback: application.hasVersionChanged(),
                defaultValue: _context.getDifficultyNames()[0]
            };
            value = types.getValueOfTypeFromLocalStorage({baseType: "enum", values: _context.getDifficultyNames()}, DIFFICULTY_LOCAL_STORAGE_ID, params);
            // apply the setting if it is valid or if the game version has changed, in which case the fallback of the invalid setting 
            // (namely the first difficulty level) will be applied and also saved to local storage
            if (!params.error || application.hasVersionChanged()) {
                this.setDifficulty(value, !!params.error && (params.error !== types.Errors.INVALID_ENUM_OBJECT_ERROR));
            }
        }
    };
    // methods
    /**
     * Sends an asynchronous request to grab the file containing the mission
     * descriptions and sets a callback to load those descriptions 
     * and set the resource state of this context to ready when done.
     * @param {Boolean} [loadDescriptors=false] If true, the mission descriptors are also requested and loaded (used for the editor)
     */
    MissionContext.prototype.requestLoad = function (loadDescriptors) {
        var missionAssignment = {}, setToReady = this.setToReady.bind(this);
        missionAssignment[MISSION_ARRAY_NAME] = MissionDescriptor;
        this._missionManager.requestConfigLoad(
                config.getConfigurationSetting(config.CONFIGURATION.MISSION_FILES).filename,
                config.getConfigurationSetting(config.CONFIGURATION.MISSION_FILES).folder,
                missionAssignment,
                (loadDescriptors ? function () {
                    this._missionManager.requestAllResources();
                    this._missionManager.executeWhenReady(setToReady);
                    this._missionManager.requestResourceLoad();
                }.bind(this) :
                        setToReady));
    };
    /**
     * Returns the string ID of the currently chosen (default) difficulty level.
     * @returns {String}
     */
    MissionContext.prototype.getDifficulty = function () {
        return this._difficulty;
    };
    /**
     * Sets a new default difficulty level.
     * @param {String} value The string ID identifying the desired option.
     * @param {Boolean} [saveToLocalStorage=true]
     */
    MissionContext.prototype.setDifficulty = function (value, saveToLocalStorage) {
        if (saveToLocalStorage === undefined) {
            saveToLocalStorage = true;
        }
        if (this._difficulty !== value) {
            this._difficulty = value;
            if (saveToLocalStorage) {
                localStorage[DIFFICULTY_LOCAL_STORAGE_ID] = value;
            }
        }
    };
    /**
     * Returns the list of the string IDs of all the available game difficulty levels.
     * @returns {String}
     */
    MissionContext.prototype.getDifficultyNames = function () {
        var i, result = [];
        for (i = 0; i < this._difficultyLevels.length; i++) {
            result.push(this._difficultyLevels[i].getName());
        }
        return result;
    };
    /**
     * Returns the difficulty level object corresponding to the difficulty level identified by the passed string
     * @param {String} name
     * @returns {DifficultyLevel} If no such level exists, null is returned.
     */
    MissionContext.prototype.getDifficultyLevel = function (name) {
        var i;
        for (i = 0; i < this._difficultyLevels.length; i++) {
            if (this._difficultyLevels[i].getName() === name) {
                return this._difficultyLevels[i];
            }
        }
        return null;
    };
    /**
     * Returns the list of string IDs for gameplay tips that can be displayed for the player at the start of missions.
     * The list is defined in config.json.
     * (can be overridden by individual missions)
     * @returns {String[]}
     */
    MissionContext.prototype.getTipIDs = function () {
        return this._tipIDs;
    };
    /**
     * Returns the (file)names of the mission( descriptor)s stored in the mission manager
     * @returns {String[]}
     */
    MissionContext.prototype.getMissionNames = function () {
        var result = [];
        this._missionManager.executeForAllResourcesOfType(MISSION_ARRAY_NAME, function (missionDescriptor) {
            if (application.isDebugVersion() || !missionDescriptor.isTest()) {
                result.push(missionDescriptor.getName());
            }
        });
        return result;
    };
    /**
     * Returns a (new) array containing all of the mission descriptors (both loaded and not yet loaded ones)
     * @returns {MissionDescriptor[]}
     */
    MissionContext.prototype.getMissionDescriptors = function () {
        var result = [];
        this._missionManager.executeForAllResourcesOfType(MISSION_ARRAY_NAME, function (missionDescriptor) {
            if (application.isDebugVersion() || !missionDescriptor.isTest()) {
                result.push(missionDescriptor);
            }
        });
        return result;
    };
    /**
     * Returns the mission descriptor identified by the passed name (typically the filename e.g. someMission.json)
     * @param {String} name
     * @returns {MissionDescriptor}
     */
    MissionContext.prototype.getMissionDescriptor = function (name) {
        return this._missionManager.getResource(MISSION_ARRAY_NAME, name);
    };
    /**
     * Requests the data (descriptor) for the mission with the passed name to be loaded (if it is not loaded already) and calls the passed 
     * callback with the descriptor as its argument when it is loaded
     * @param {String} name
     * @param {Function} callback
     */
    MissionContext.prototype.requestMissionDescriptor = function (name, callback) {
        var missionDescriptor = this._missionManager.getResource(MISSION_ARRAY_NAME, name);
        if (missionDescriptor) {
            this._missionManager.requestResourceLoad();
            this._missionManager.executeWhenReady(function () {
                callback(missionDescriptor);
            });
        } else {
            callback(null);
        }
    };
    /**
     * Requests the data (descriptor) for the mission with the passed name to be loaded (if it is not loaded already), creates a mission based 
     * on it and calls the passed callback with the created mission as its argument when it is loaded
     * @param {String} name
     * @param {String} difficulty The string ID of the difficulty level to use
     * @param {Boolean} demoMode Whether to load the created mission in demo mode
     * @param {Function} callback
     */
    MissionContext.prototype.requestMission = function (name, difficulty, demoMode, callback) {
        var missionDescriptor = this._missionManager.getResource(MISSION_ARRAY_NAME, name);
        if (missionDescriptor) {
            this._missionManager.requestResourceLoad();
            this._missionManager.executeWhenReady(function () {
                callback(missionDescriptor.createMission(difficulty, demoMode));
            });
        } else {
            callback(null);
        }
    };
    /**
     * @param {Object} data
     */
    MissionContext.prototype.createMissionDescriptor = function (data) {
        this._missionManager.createResource(MISSION_ARRAY_NAME, data);
    };
    // initializazion
    // obtaining pool references
    _particlePool = pools.getPool(logicConstants.PARTICLE_POOL_NAME, renderableObjects.Particle);
    _projectilePool = pools.getPool(logicConstants.PROJECTILE_POOL_NAME, equipment.Projectile);
    _missilePool = pools.getPool(logicConstants.MISSILE_POOL_NAME, equipment.Missile);
    _trailSegmentPool = pools.getPool(logicConstants.TRAIL_SEGMENT_POOL_NAME, renderableObjects.TrailSegment);
    _explosionPool = pools.getPool(logicConstants.EXPLOSION_POOL_NAME, explosion.Explosion);
    // creating the default context
    _context = new MissionContext();
    // associating condition constructors
    _conditionConstructors = {};
    _conditionConstructors[ConditionType.DESTROYED] = DestroyedCondition;
    _conditionConstructors[ConditionType.COUNT] = CountCondition;
    _conditionConstructors[ConditionType.TIME_ELAPSED] = TimeCondition;
    // associating action constructors
    _actionConstructors = {};
    _actionConstructors[ActionType.WIN] = WinAction;
    _actionConstructors[ActionType.LOSE] = LoseAction;
    _actionConstructors[ActionType.MESSAGE] = MessageAction;
    _actionConstructors[ActionType.CLEAR_MESSAGES] = ClearMessagesAction;
    _actionConstructors[ActionType.COMMAND] = CommandAction;
    _actionConstructors[ActionType.HUD] = HUDAction;
    // caching configuration settings
    config.executeWhenReady(function () {
        _showHitboxesForHitchecks = config.getSetting(config.BATTLE_SETTINGS.SHOW_HITBOXES_FOR_HITCHECKS);
        _groupTransformsArrayName = config.getSetting(config.GENERAL_SETTINGS.UNIFORM_GROUP_TRANSFORMS_ARRAY_NAME);
    });
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        ConditionType: ConditionType,
        TriggerFireWhen: TriggerFireWhen,
        TriggerConditionsRequired: TriggerConditionsRequired,
        CountConditionRelation: CountConditionRelation,
        TimeConditionSatisfiedWhen: TimeConditionSatisfiedWhen,
        ActionType: ActionType,
        MissionState: MissionState,
        ObjectiveState: ObjectiveState,
        FAILED_MISSION_PERFORMACE: FAILED_MISSION_PERFORMACE,
        loadConfigurationFromJSON: _context.loadConfigurationFromJSON.bind(_context),
        loadSettingsFromLocalStorage: _context.loadSettingsFromLocalStorage.bind(_context),
        requestLoad: _context.requestLoad.bind(_context),
        executeWhenReady: _context.executeWhenReady.bind(_context),
        getDebugInfo: getDebugInfo,
        getDifficulty: _context.getDifficulty.bind(_context),
        setDifficulty: _context.setDifficulty.bind(_context),
        getDifficultyNames: _context.getDifficultyNames.bind(_context),
        getTipIDs: _context.getTipIDs.bind(_context),
        getMissionNames: _context.getMissionNames.bind(_context),
        getMissionDescriptor: _context.getMissionDescriptor.bind(_context),
        getMissionDescriptors: _context.getMissionDescriptors.bind(_context),
        requestMissionDescriptor: _context.requestMissionDescriptor.bind(_context),
        requestMission: _context.requestMission.bind(_context),
        createMissionDescriptor: _context.createMissionDescriptor.bind(_context)
    };
});