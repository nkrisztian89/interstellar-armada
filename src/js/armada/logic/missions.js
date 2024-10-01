/**
 * Copyright 2014-2024 Krisztián Nagy
 * @file Implementation of loading and managing missions - including the main game simulation loop
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/* global Map */

/**
 * @param utils Used for format strings and useful constants
 * @param types Used for type checking when loading from local storage
 * @param vec Vectors are used for collision calculations
 * @param mat Matrices are widely used for 3D simulation
 * @param application Used for file loading and logging functionality
 * @param asyncResource LogicContext is a subclass of AsyncResource
 * @param resources Used to access the loaded media (graphics and sound) resources
 * @param resourceManager Used for storing the mission descriptors in a resource manager 
 * @param pools Used to access the pools for particles and projectiles
 * @param egomModel Used to create models (e.g. grid) for mission preview
 * @param physics Used to set up global drag based on mission environment
 * @param camera Used for creating camera configurations for views
 * @param renderableObjects Used for creating visual models for game objects
 * @param constants Used for Accessing global localStorage prefixes
 * @param control Used to trigger gamepad vibration effects
 * @param graphics Used to access graphics settings
 * @param networking Used to query whether we are hosting the game
 * @param classes Used to load and access the classes of Interstellar Armada
 * @param config Used to access game settings/configuration
 * @param strings Used for translation support
 * @param logicConstants Used for accessing pool names
 * @param environments Used for creating environments
 * @param SpacecraftEvents Used to trigger spacecraft events
 * @param spacecraft Used for creating spacecrafts
 * @param equipment Used for accessing the common projectile pool
 * @param formations Used for setting up formations
 * @param explosion Used for explosion pool management
 * @param ai Used for setting the artificial intelligence pilots when creating a mission.
 * @param missionActions Used for accessing mission event action types
 * @param missionEvents Used for parsing and creating mission events from mission data
 */
define([
    "utils/utils",
    "utils/types",
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/async-resource",
    "modules/resource-manager",
    "modules/media-resources",
    "modules/pools",
    "modules/egom-model",
    "modules/physics",
    "modules/scene/camera",
    "modules/scene/renderable-objects",
    "armada/constants",
    "armada/control",
    "armada/graphics",
    "armada/networking",
    "armada/logic/classes",
    "armada/configuration",
    "armada/strings",
    "armada/logic/constants",
    "armada/logic/environments",
    "armada/logic/SpacecraftEvents",
    "armada/logic/spacecraft",
    "armada/logic/equipment",
    "armada/logic/formations",
    "armada/logic/explosion",
    "armada/logic/ai",
    "armada/logic/missions/actions",
    "armada/logic/missions/events",
    "utils/polyfill"
], function (
        utils, types, vec, mat,
        application, asyncResource, resourceManager, resources, pools, egomModel, physics,
        camera, renderableObjects,
        constants, control, graphics, networking, classes, config, strings,
        logicConstants, environments, SpacecraftEvents, spacecraft, equipment, formations, explosion, ai,
        missionActions, missionEvents) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // imports
            MissionState = missionEvents.MissionState,
            ObjectiveState = missionEvents.ObjectiveState,
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
             * this faction, with an index that equals the index of the spacecraft added + 1 (converted to string).
             * @type String
             */
            NUMBERED_FACTION_NAME = "numbered",
            GRID_MODEL_NAME = "grid",
            MARKER_MODEL_NAME = "marker",
            LINE_MODEL_NAME = "line",
            /**
             * The damage spacecrafts suffer from collisions is calculated as the square of the relative velocity (in m/s) multiplied
             * by this factor (and it cannot exceed the maximum hitpoints of either of the ships)
             * @type Number
             */
            COLLISION_DAMAGE_FACTOR = 0.00025,
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
             * A pool containing trails for reuse, so that creation of objects while creating trails can be decreased for optimization.
             * @type Pool
             */
            _trailPool,
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
             * This string is available to other modules through a public function so that an arbitrary piece of information from this 
             * module can be exposed for debug purposes.
             * @type String
             */
            _debugInfo = "";
    // -------------------------------------------------------------------------
    // Private functions
    /**
     * Helper function to sort spacecrafts within a squad according to their index in the squad
     * @param {Spacecraft} a
     * @param {Spacecraft} b
     * @returns {Number}
     */
    function _compareSpacecrafts(a, b) {
        return a.getIndexInSquad() - b.getIndexInSquad();
    }
    /**
     * Takes in a list of spacecraft descriptors as defined in a mission descriptor JSON file, and
     * extracts the ones that define multiple spacecrafts (through the count property) into individual
     * spacecraft descriptors in the output array (the others remain unchanged)
     * @param {Array} spacecrafts
     * @returns {Array}
     */
    function getIndividualSpacecraftDescriptors(spacecrafts) {
        var i, j, squad, names, loadouts, pilotedIndex, positions, formation, orientation, initialBlinkTime, initialBlinkTimeDelta,
                spacecraftDataTemplate, spacecraftData,
                result = [], squads = {}, index;
        for (i = 0; i < spacecrafts.length; i++) {
            if (spacecrafts[i].count) {
                // extracting data used for generating differing spacecraft data properties
                squad = spacecrafts[i].squad;
                squads[squad] = squads[squad] || 0;
                names = spacecrafts[i].names;
                loadouts = spacecrafts[i].loadouts;
                pilotedIndex = spacecrafts[i].pilotedIndex;
                positions = spacecrafts[i].positions;
                formation = spacecrafts[i].formation;
                orientation = mat.rotation4FromJSON(spacecrafts[i].rotations);
                initialBlinkTime = spacecrafts[i].initialBlinkTime;
                initialBlinkTimeDelta = spacecrafts[i].initialBlinkTimeDelta;
                // creating a template to be copied for individual spacecraft data objects, without the proprties that don't refer to individual spacecrafts
                spacecraftDataTemplate = utils.deepCopy(spacecrafts[i]);
                delete spacecraftDataTemplate.count;
                delete spacecraftDataTemplate.names;
                delete spacecraftDataTemplate.loadouts;
                delete spacecraftDataTemplate.pilotedIndex;
                delete spacecraftDataTemplate.positions;
                delete spacecraftDataTemplate.formation;
                for (j = 0; j < spacecrafts[i].count; j++) {
                    spacecraftData = utils.deepCopy(spacecraftDataTemplate);
                    if (squad) {
                        spacecraftData.squad = squad + " " + (squads[squad] + j + 1).toString();
                    }
                    if (names) {
                        spacecraftData.name = names[j];
                    }
                    if (loadouts) {
                        spacecraftData.loadout = loadouts[j % loadouts.length];
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
                        spacecraftData.position = formations.getPositionInFormation(formation, j, spacecraftData.position, orientation);
                    }
                    if (initialBlinkTime !== undefined) {
                        spacecraftData.initialBlinkTime = initialBlinkTime + (j * (initialBlinkTimeDelta || 0));
                    }
                    result.push(spacecraftData);
                }
                squads[squad] += spacecrafts[i].count;
            } else {
                if (spacecrafts[i].squad) {
                    squad = spacecraft.getSquadName(spacecrafts[i].squad);
                    index = spacecraft.getSquadIndex(spacecrafts[i].squad);
                    if (index > 0) {
                        if (index <= squads[squad]) {
                            application.showError("Spacecraft " + spacecrafts[i].squad + " defined after squad " + squad + " already having " + squads[squad] + " defined members!", application.ErrorSeverity.MINOR);
                        }
                        squads[squad] = index;
                        result.push(spacecrafts[i]);
                    } else {
                        squads[squad] = squads[squad] || 0;
                        spacecraftData = utils.deepCopy(spacecrafts[i]);
                        spacecraftData.squad = squad + " " + (squads[squad] + 1).toString();
                        squads[squad] += 1;
                        result.push(spacecraftData);
                    }
                } else {
                    result.push(spacecrafts[i]);
                }
            }
        }
        return result;
    }
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
     * @param {String|Object} nameOrParams
     */
    function Team(nameOrParams) {
        /**
         * The unique string ID of this team, also used for choosing the translated displayed name.
         * @type String
         */
        this._name = null;
        /**
         * Which faction this team belongs to.
         * @type String
         */
        this._faction = null;
        /**
         * The replacements to pass when formatting the display name for this team
         * @type Number
         */
        this._displayNameReplacements = {
            index: -1
        };
        /**
         * The color to use when replacing original faction colors of spacecrafts belonging to this team.
         * @tpye Number[4]
         */
        this._color = null;
        if (typeof nameOrParams === "string") {
            this._name = nameOrParams;
            this._faction = nameOrParams;
        } else if (typeof nameOrParams === "object") {
            this._name = nameOrParams.name || nameOrParams.faction || application.showError("Team defined without a name or faction!");
            this._faction = nameOrParams.faction;
            this._displayNameReplacements.index = nameOrParams.index;
            this._color = nameOrParams.color || null;
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
    Team.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the translated, human-readable unique name of this team.
     * @returns {String}
     */
    Team.prototype.getDisplayName = function () {
        return utils.formatString(strings.get(strings.FACTION.PREFIX, this._faction, this._faction || this._name), this._displayNameReplacements);
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
        var i, maxMembers, team = craft.getTeam(), squad = craft.getSquad();
        if (team) {
            team._removeSpacecraft(craft);
        }
        craft.setTeam(this);
        // setting squad info so that it can be queried later (for example to show wingmen status for this team)
        if (squad) {
            // if the squad of this new spacecraft is already registered, add the craft to it
            for (i = 0; i < this._squads.length; i++) {
                if (squad === this._squads[i].name) {
                    this._squads[i].crafts.push(craft);
                    this._squads[i].crafts.sort(_compareSpacecrafts);
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
     * Removes the passed spacecraft from this team (called by addSpacecraft() to remove the
     * craft from its previous team, do not call it separately)
     * @param {Spacecraft} craft
     */
    Team.prototype._removeSpacecraft = function (craft) {
        var i, index, squad = craft.getSquad();
        if (squad) {
            // find the squad the craft is part of, and remove it from there
            for (i = 0; i < this._squads.length; i++) {
                if (squad === this._squads[i].name) {
                    index = this._squads[i].crafts.indexOf(craft);
                    this._squads[i].crafts.splice(index, 1);
                    if (this._squads[i].crafts.length === 0) {
                        this._squads.splice(i, 1);
                    }
                    break;
                }
            }
        }
        this._initialCount--;
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
     * execute a callback for a subset of this list belonging to an area in space by choosing the appropriate subnodes.
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
         * to its subnodes.
         * @type Number
         */
        this._centerX = 0;
        /**
         * @type Number
         */
        this._centerY = 0;
        /**
         * @type Number
         */
        this._centerZ = 0;
        /*
         * The minimum and maximum coordinates for the 3 axes where any part of any of the contained spacecrafts reside.
         * @type Number[6]
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
            this._boundaries = [p[0] - s, p[0] + s, p[1] - s, p[1] + s, p[2] - s, p[2] + s];
        }
        for (i = 0, n = this._objects.length; i < n; i++) {
            p = this._objects[i].getPhysicalModel().getPositionMatrix();
            x += p[12];
            y += p[13];
            z += p[14];
            if (isRootNode) {
                s = this._objects[i].getPhysicalModel().getSize();
                if ((p[12] - s) < this._boundaries[0]) {
                    this._boundaries[0] = p[12] - s;
                }
                if ((p[12] + s) > this._boundaries[1]) {
                    this._boundaries[1] = p[12] + s;
                }
                if ((p[13] - s) < this._boundaries[2]) {
                    this._boundaries[2] = p[13] - s;
                }
                if ((p[13] + s) > this._boundaries[3]) {
                    this._boundaries[3] = p[13] + s;
                }
                if ((p[14] - s) < this._boundaries[4]) {
                    this._boundaries[4] = p[14] - s;
                }
                if ((p[14] + s) > this._boundaries[5]) {
                    this._boundaries[5] = p[14] + s;
                }
            }
        }
        x /= n;
        y /= n;
        z /= n;
        this._centerX = x;
        this._centerY = y;
        this._centerZ = z;
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
            if ((p[12] - size) < this._centerX) {
                if ((p[13] - size) < this._centerY) {
                    if ((p[14] - size) < this._centerZ) {
                        lxlylz = lxlylz || [];
                        lxlylz.push(o);
                    }
                    if ((p[14] + size) >= this._centerZ) {
                        lxlyhz = lxlyhz || [];
                        lxlyhz.push(o);
                    }
                }
                if ((p[13] + size) >= this._centerY) {
                    if ((p[14] - size) < this._centerZ) {
                        lxhylz = lxhylz || [];
                        lxhylz.push(o);
                    }
                    if ((p[14] + size) >= this._centerZ) {
                        lxhyhz = lxhyhz || [];
                        lxhyhz.push(o);
                    }
                }
            }
            if ((p[12] + size) >= this._centerX) {
                if ((p[13] - size) < this._centerY) {
                    if ((p[14] - size) < this._centerZ) {
                        hxlylz = hxlylz || [];
                        hxlylz.push(o);
                    }
                    if ((p[14] + size) >= this._centerZ) {
                        hxlyhz = hxlyhz || [];
                        hxlyhz.push(o);
                    }
                }
                if ((p[13] + size) >= this._centerY) {
                    if ((p[14] - size) < this._centerZ) {
                        hxhylz = hxhylz || [];
                        hxhylz.push(o);
                    }
                    if ((p[14] + size) >= this._centerZ) {
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
     * Executes the passed callback for all the spacecrafts inside the region specified by the given boundaries
     * using the spatial partitions represented by this node and its subnodes.
     * @param {Number} minX
     * @param {Number} maxX
     * @param {Number} minY
     * @param {Number} maxY
     * @param {Number} minZ
     * @param {Number} maxZ
     * @param {Function} callback Executed once for each spacecraft, the spacecraft is passed as the only argument.
     * If the function returns true, the execution stops there and the callback will not be called for the remaining spacecrafts.
     */
    Octree.prototype.executeForObjects = function (minX, maxX, minY, maxY, minZ, maxZ, callback) {
        var i;
        if (!this._subnodes) {
            for (i = 0; i < this._objects.length; i++) {
                if (callback(this._objects[i])) {
                    return true;
                }
            }
            return false;
        }
        if (this._boundaries) {
            if ((maxX < this._boundaries[0]) || (minX > this._boundaries[1]) ||
                    (maxY < this._boundaries[2]) || (minY > this._boundaries[3]) ||
                    (maxZ < this._boundaries[4]) || (minZ > this._boundaries[5])) {
                return false;
            }
        }
        if (minX < this._centerX) {
            if (minY < this._centerY) {
                if (minZ < this._centerZ) {
                    if (this._subnodes[0].executeForObjects(minX, maxX, minY, maxY, minZ, maxZ, callback)) {
                        return true;
                    }
                }
                if (maxZ >= this._centerZ) {
                    if (this._subnodes[1].executeForObjects(minX, maxX, minY, maxY, minZ, maxZ, callback)) {
                        return true;
                    }
                }
            }
            if (maxY >= this._centerY) {
                if (minZ < this._centerZ) {
                    if (this._subnodes[2].executeForObjects(minX, maxX, minY, maxY, minZ, maxZ, callback)) {
                        return true;
                    }
                }
                if (maxZ >= this._centerZ) {
                    if (this._subnodes[3].executeForObjects(minX, maxX, minY, maxY, minZ, maxZ, callback)) {
                        return true;
                    }
                }
            }
        }
        if (maxX >= this._centerX) {
            if (minY < this._centerY) {
                if (minZ < this._centerZ) {
                    if (this._subnodes[4].executeForObjects(minX, maxX, minY, maxY, minZ, maxZ, callback)) {
                        return true;
                    }
                }
                if (maxZ >= this._centerZ) {
                    if (this._subnodes[5].executeForObjects(minX, maxX, minY, maxY, minZ, maxZ, callback)) {
                        return true;
                    }
                }
            }
            if (maxY >= this._centerY) {
                if (minZ < this._centerZ) {
                    if (this._subnodes[6].executeForObjects(minX, maxX, minY, maxY, minZ, maxZ, callback)) {
                        return true;
                    }
                }
                if (maxZ >= this._centerZ) {
                    if (this._subnodes[7].executeForObjects(minX, maxX, minY, maxY, minZ, maxZ, callback)) {
                        return true;
                    }
                }
            }
        }
        return false;
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
         * Reference to the mission descriptor JSON object
         * @type Object
         */
        this._dataJSON = null;
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
         * Whether this mission has the implicit default objective (as it lacks any explicit completable objectives)
         * @type Boolean
         */
        this._defaultObjective = true;
        /**
         * A cached value of the last calculated objectives state
         * @type ObjectiveWithState[]
         */
        this._objectivesState = null;
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
        /**
         * A callback function to execute when the team assignments within the mission change (i.e. some spacecraft changes its team)
         * @type Function
         */
        this._onTeamsChanged = null;
        /**
         * Whether there are armed spacecrafts on the player's team at the start of the mission.
         * @type Boolean
         */
        this._initialTeamMission = false;
    }
    /**
     * Return the name identifying this mission (typically same as the filename e.g. someMission.json)
     * @returns {String}
     */
    Mission.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the reference to the mission descriptor JSON object
     * @returns {Object}
     */
    Mission.prototype.getData = function () {
        return this._dataJSON;
    };
    /**
     * Returns the numeric ID assigned to this mission if it is from the Mission Hub
     * @returns {Number}
     */
    Mission.prototype.getId = function () {
        return this._dataJSON.id;
    };
    /**
     * Returns the mission title as given in the data JSON
     * @returns {String} 
     */
    Mission.prototype.getTitle = function () {
        return this._title;
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
     * Returns the list of all the message event text IDs (the ones used as translation keys) used in this mission.
     * @returns {String[]}
     */
    Mission.prototype.getMessageIds = function () {
        var result = [], i;
        for (i = 0; i < this._events.length; i++) {
            result = result.concat(this._events[i].getMessageIds());
        }
        return result;
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
        if (((this._state === MissionState.IN_PROGRESS) || (this._state === MissionState.COMPLETED)) && (this._pilotedCraft && !this._pilotedCraft.isAway())) {
            this._state = MissionState.FAILED;
        }
    };
    /**
     * Updates the stored mission state value based on the current situation.
     */
    Mission.prototype._updateState = function () {
        var i, completed;
        // first check for missions with a player
        if (this._pilotedCraft) {
            if (!this._pilotedCraft.isAway()) {
                // update stored objectives state
                this._updateObjectivesState();
            }
            // if the player is destroyed, the mission state is always defeat
            if (!this._pilotedCraft.isAlive()) {
                this._state = MissionState.DEFEAT;
                return;
            } else {
                // a battle with a player can be completed if there are no hostiles left
                if (this._state === MissionState.BATTLE) {
                    for (i = 0; i < this._spacecrafts.length; i++) {
                        if (this._spacecrafts[i] && this._spacecrafts[i].isAlive() && this._pilotedCraft.isHostile(this._spacecrafts[i])) {
                            return;
                        }
                    }
                    this._state = MissionState.COMPLETED;
                    return;
                } else if ((this._state === MissionState.IN_PROGRESS) && !this._pilotedCraft.isAway()) {
                    // check the objectives - if any objective is failed, lose, if all of them are complete, win
                    completed = true;
                    for (i = 0; i < this._objectivesState.length; i++) {
                        if (this._objectivesState[i].state === ObjectiveState.FAILED) {
                            this._state = MissionState.FAILED;
                            return;
                        }
                        completed = completed && ((this._objectivesState[i].state === ObjectiveState.COMPLETED) || !this._objectivesState[i].completable) && this._objectivesState[i].text;
                    }
                    if (completed) {
                        this._state = MissionState.COMPLETED;
                        return;
                    }
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
            if (this._spacecrafts[i] && this._spacecrafts[i].isAlive()) {
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
            if (this._spacecrafts[i] && this._spacecrafts[i].isAlive()) {
                if (this._spacecrafts[i].getTeam() === team) {
                    result++;
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
            if (this._spacecrafts[i] && this._spacecrafts[i].isAlive() && (!presentOnly || !this._spacecrafts[i].isAway())) {
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
     * @param {String} name
     * @returns {Team}
     */
    Mission.prototype.getTeam = function (name) {
        var i;
        for (i = 0; i < this._teams.length; i++) {
            if (this._teams[i].getName() === name) {
                return this._teams[i];
            }
        }
        application.showError("No team exists with name '" + name + "'!");
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
        if (this._defaultObjective) {
            result.push(strings.get(strings.MISSIONS.OBJECTIVE_WIN_PREFIX, strings.OBJECTIVE.DESTROY_ALL_SUFFIX.name));
        }
        for (i = 0; i < this._winActions.length; i++) {
            result = result.concat(this._winActions[i].getObjectiveStrings(this));
        }
        for (i = 0; i < this._loseActions.length; i++) {
            result = result.concat(this._loseActions[i].getObjectiveStrings(this));
        }
        return result;
    };
    /**
     * Returns a list of translated strings along with objective state values for displaying the current state of mission objectives for
     * the player on the HUD
     * @param {Boolean} missionEnded
     * @returns {ObjectiveWithState[]}
     */
    Mission.prototype.getObjectivesState = function (missionEnded) {
        if (missionEnded) {
            this._updateObjectivesState(missionEnded);
        }
        return this._objectivesState;
    };
    /**
     * Updates the stores mission objective states
     * @param {Boolean} missionEnded
     */
    Mission.prototype._updateObjectivesState = function (missionEnded) {
        var i, index = 0, suffix, hostiles, craft;
        // handling the default "destroy all enemies" implicit mission objective
        if (this._defaultObjective) {
            craft = this.getPilotedSpacecraft();
            suffix = "";
            if (craft) {
                hostiles = this.getHostileSpacecraftCount(craft, true);
                if (hostiles > 0) {
                    suffix = " (" + hostiles + ")";
                }
            }
            this._objectivesState[0].text = strings.get(strings.BATTLE.OBJECTIVE_WIN_PREFIX, strings.OBJECTIVE.DESTROY_ALL_SUFFIX.name) + suffix;
            this._objectivesState[0].state = (craft && craft.isAlive()) ? ((this.getHostileSpacecraftCount(craft, false) > 0) ? ObjectiveState.IN_PROGRESS : ObjectiveState.COMPLETED) : ObjectiveState.FAILED;
            this._objectivesState[0].completable = true;
            index++;
        }
        // handling explicit mission objectives
        for (i = 0; i < this._winActions.length; i++) {
            index = this._winActions[i].getObjectivesState(this, missionEnded, this._objectivesState, index);
        }
        for (i = 0; i < this._loseActions.length; i++) {
            index = this._loseActions[i].getObjectivesState(this, missionEnded, this._objectivesState, index);
        }
        // we might not have all the objectives active
        while (index < this._objectivesState.length) {
            this._objectivesState[index].text = "";
            index++;
        }
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
        var i, j, actions, actionType, count, spacecrafts;
        // in case this method is called separately (not inside loadFromJSON()), we initialize
        // the piloted spacecraft as e.g. distance conditions can only be win/lose conditions
        // if the subject is the piloted craft, so we need to be able to check for that
        if (!this._spacecrafts) {
            this._spacecrafts = [];
            spacecrafts = getIndividualSpacecraftDescriptors(dataJSON.spacecrafts);
            for (i = 0; i < spacecrafts.length; i++) {
                if (spacecrafts[i].piloted) {
                    this._pilotedCraft = new spacecraft.Spacecraft();
                    this._pilotedCraft.loadFromJSON(spacecrafts[i]);
                    this._spacecrafts.push(this._pilotedCraft);
                    break;
                }
            }
        }
        this._events = [];
        if (dataJSON.events) {
            for (i = 0; i < dataJSON.events.length; i++) {
                this._events.push(new missionEvents.MissionEvent(dataJSON.events[i], this));
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
                if (actionType === missionActions.ActionType.WIN) {
                    this._winActions.push(actions[j]);
                } else if (actionType === missionActions.ActionType.LOSE) {
                    this._loseActions.push(actions[j]);
                }
            }
        }
        this._defaultObjective = (this._winActions.length === 0);
        if (this._defaultObjective) {
            for (i = 0; i < this._loseActions.length; i++) {
                if (this._loseActions[i].triggerCanBeImpossible()) {
                    this._defaultObjective = false;
                    break;
                }
            }
        }
        count = (this._defaultObjective ? 1 : 0);
        if (this._pilotedCraft) {
            for (i = 0; i < this._winActions.length; i++) {
                count += this._winActions[i].getObjectiveCount();
            }
            for (i = 0; i < this._loseActions.length; i++) {
                count += this._loseActions[i].getObjectiveCount();
            }
        }
        this._objectivesState = new Array(count);
        for (i = 0; i < count; i++) {
            this._objectivesState[i] = {};
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
     * Whether the directional lights in the mission environment should cast shadows
     * @returns {Boolean}
     */
    Mission.prototype.hasShadows = function () {
        return this._environment.hasShadows();
    };
    /**
     * Loads all the data describing this mission from the passed JSON object.
     * @param {Object} dataJSON
     * @param {String} difficulty The string ID of the difficulty level to use
     * @param {Boolean} demoMode If true, the data from the JSON object will be loaded in demo mode, so that the piloted craft is not set
     * and a suitable AI is added to all spacecrafts if possible.
     */
    Mission.prototype.loadFromJSON = function (dataJSON, difficulty, demoMode) {
        var i, j, craft, teamID, team, aiType, actions, count, factor, spacecrafts, vibrateCallback;
        application.log_DEBUG("Loading mission from JSON file...", 2);
        this._difficultyLevel = _context.getDifficultyLevel(difficulty);
        equipment.handleDifficultySet(this._difficultyLevel);
        formations.resetRandomSeed();
        this._dataJSON = dataJSON;
        this._title = dataJSON.title || "";
        this._nextMissionName = dataJSON.nextMission || null;
        this.loadEnvironment(dataJSON);
        physics.setDrag(this._environment.getDrag(), this._environment.getAngularDrag());
        this._anticipationTheme = dataJSON.anticipationTheme;
        this._combatTheme = dataJSON.combatTheme;
        this._teams = [];
        if (dataJSON.teams) {
            for (i = 0; i < dataJSON.teams.length; i++) {
                this._teams.push(new Team((typeof dataJSON.teams[i] === "string") ? dataJSON.teams[i] : Object.assign({index: (i + 1).toString()}, dataJSON.teams[i])));
            }
        }
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
        spacecrafts = getIndividualSpacecraftDescriptors(dataJSON.spacecrafts);
        // loading spacecrafts from expanded array
        for (i = 0; i < spacecrafts.length; i++) {
            craft = new spacecraft.Spacecraft();
            craft.loadFromJSON(spacecrafts[i], this._hitObjects, this._environment);
            if (!demoMode && spacecrafts[i].piloted) {
                this._pilotedCraft = craft;
                craft.multiplyMaxHitpoints(this._difficultyLevel.getPlayerHitpointsFactor());
                vibrateCallback = function (pilotedCraft, hitData) {
                    control.getInputInterpreter(control.GAMEPAD_NAME).vibrate((pilotedCraft.getHullIntegrity() <= 0) ? "destroyed" : (hitData.hullDamage > 0) ? "hull-hit" : "shield-hit");
                }.bind(this, craft);
                craft.addEventHandler(SpacecraftEvents.BEING_HIT, vibrateCallback);
                craft.addEventHandler(SpacecraftEvents.COLLIDED, vibrateCallback);
            }
            if (spacecrafts[i].multi) {
                craft.setAsMultiControlled(spacecrafts[i].piloted, i);
                if (!spacecrafts[i].piloted && spacecrafts[i].multiPiloted) {
                    craft.multiplyMaxHitpoints(this._difficultyLevel.getPlayerHitpointsFactor());
                }
            }
            craft.setPiloted(!!spacecrafts[i].piloted || !!spacecrafts[i].multiPiloted);
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
                    faction: NUMBERED_FACTION_NAME,
                    index: (this._teams.length + 1).toString()
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
        this._initialTeamMission = false;
        team = this._pilotedCraft && this._pilotedCraft.getTeam();
        count = 1;
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
                        if (!spacecrafts[i].multiPiloted) {
                            craft.multiplyMaxHitpoints(factor);
                        }
                        if (craft.hasWeapons() || craft.hasMissiles()) {
                            this._initialTeamMission = true;
                            count++;
                        }
                    }
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
        if (count > 1) {
            this._referenceScore /= count;
        }
        // load events and mission objectives
        this.loadObjectives(dataJSON);
        // cache target spacecrafts
        this._targetSpacecrafts = [];
        for (i = 0; i < this._events.length; i++) {
            actions = this._events[i].getActions();
            for (j = 0; j < actions.length; j++) {
                if (actions[j].getType() === missionActions.ActionType.WIN) {
                    this._targetSpacecrafts = this._targetSpacecrafts.concat(this._events[i].getTrigger().getTargetSpacecrafts(this));
                }
            }
        }
        // cache escorted spacecrafts
        this._escortedSpacecrafts = [];
        for (i = 0; i < this._events.length; i++) {
            actions = this._events[i].getActions();
            for (j = 0; j < actions.length; j++) {
                if (actions[j].getType() === missionActions.ActionType.LOSE) {
                    this._escortedSpacecrafts = this._escortedSpacecrafts.concat(this._events[i].getTrigger().getEscortedSpacecrafts(this));
                }
            }
        }
        // it doesn't matter if we have objectives when there is no player craft
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
     * Returns whether the mission has more than one spacecraft (alive or destroyed) on the player's team.
     * @returns {Boolean}
     */
    Mission.prototype.isTeamMission = function () {
        return this.getPilotedSpacecraft() && this.getPilotedSpacecraft().getTeam() && (this.getPilotedSpacecraft().getTeam().getInitialCount() > 1);
    };
    /**
     * Returns whether there are armed spacecrafts on the player's team at the start of the mission.
     * @returns {Boolean}
     */
    Mission.prototype.isInitialTeamMission = function () {
        return this._initialTeamMission;
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
     * Returns an object containing the required scores for the mission for all the stored mission performance levels.
     * The keys are the IDs of the performance levels and the values are the scores.
     * @returns {Object}
     */
    Mission.prototype.getPerformanceLevelScores = function () {
        return _context.getPerformanceLevelScores(this);
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
                mat.copy(view.getPositionMatrix()),
                view.getDistanceRange(),
                view.getConfines(),
                view.resetsWhenLeavingConfines());
        orientationConfiguration = new camera.CameraOrientationConfiguration(
                !view.isTurnable(),
                view.pointsTowardsObjects(),
                view.isFPS(),
                view.getOrientationFollowedObjectsForScene(scene),
                mat.copy(view.getOrientationMatrix()),
                Math.degrees(angles.yaw), Math.degrees(angles.pitch),
                view.getAlphaRange(),
                view.getBetaRange(),
                view.getBaseOrientation() || config.getDefaultCameraBaseOrientation(),
                view.getPointToFallback() || config.getDefaultCameraPointToFallback());
        return new camera.CameraConfiguration(
                view.getName(),
                positionConfiguration, orientationConfiguration,
                view.getFOV() || config.getDefaultCameraFOV(),
                view.getFOVRange(),
                view.getSpan() || config.getDefaultCameraSpan(),
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
     * @property {Number[4]} markerColorPositive
     * @property {Number[4]} markerColorNegative
     * @property {Number[4]} jumpMarkerColor
     * @property {Number[4]} friendlyColor 
     * @property {Number[4]} hostileColor 
     * @property {Number} smallestSizeWhenDrawn
     * @property {Number} awayColorFactor
     * @property {Number} awayAlphaFactor
     * @property {Function} [callback]
     */
    /**
     * Adds renderable objects representing all visual elements of the mission to
     * the passed scene.
     * @param {Scene} battleScene
     * @param {Scene} targetScene
     * @param {PreviewParams} [previewParams]
     */
    Mission.prototype.addToScene = function (battleScene, targetScene, previewParams) {
        var i, j, k, preview = !!previewParams, spacecraftCount, addedSpacecrafts, spacecraft, actions, data, positioned, index,
                friendly, friendlyColor, hostileColor, markerColorPositive, markerColorNegative, jumpMarkerColor, callback, jumpMarkers,
                getSpacecraftColor;
        this._environment.addToScene(battleScene);
        if (preview) {
            jumpMarkers = new Map();
            ai.resetJumpInPositionSeed();
            // add grids
            graphics.getShader(previewParams.gridShaderName);
            graphics.getShader(previewParams.markerShaderName);
            markerColorPositive = previewParams.markerColorPositive;
            markerColorNegative = previewParams.markerColorNegative;
            jumpMarkerColor = previewParams.jumpMarkerColor;
            resources.getOrAddModel(egomModel.gridModel(GRID_MODEL_NAME, 2 * previewParams.smallestGridSize, 2 * previewParams.smallestGridSize, 2 * previewParams.smallestGridSize + 1, 2 * previewParams.smallestGridSize + 1));
            resources.getOrAddModel(egomModel.positionMarkerModel(MARKER_MODEL_NAME, 8));
            resources.getOrAddModel(egomModel.lineModel(LINE_MODEL_NAME, [1, 1, 1]));
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
                        return (position[14] > 0) ? markerColorPositive : markerColorNegative;
                    });
                    battleScene.addObject(marker, false);
                }
                if (jumpMarkers.has(spacecraft)) {
                    marker = new renderableObjects.ShadedLODMesh(resources.getModel(LINE_MODEL_NAME).getEgomModel(), graphics.getManagedShader(previewParams.markerShaderName), {},
                            mat.translation4(position[12], position[13], position[14]), mat.identity4(), mat.scaling4(jumpMarkers.get(spacecraft)[0], jumpMarkers.get(spacecraft)[1], jumpMarkers.get(spacecraft)[2]), true, 0, previewParams.smallestSizeWhenDrawn);
                    marker.setUniformValueFunction(renderableObjects.UNIFORM_COLOR_NAME, function () {
                        return jumpMarkerColor;
                    });
                    marker.setModelSize(vec.length3(jumpMarkers.get(spacecraft)) / Math.max(Math.abs(jumpMarkers.get(spacecraft)[0]), Math.abs(jumpMarkers.get(spacecraft)[1]), Math.abs(jumpMarkers.get(spacecraft)[2])));
                    battleScene.addObject(marker, false);
                }
                addedSpacecrafts++;
                if ((addedSpacecrafts === spacecraftCount) && previewParams.callback) {
                    previewParams.callback();
                }
            };
        }
        spacecraftCount = this._spacecrafts.length;
        addedSpacecrafts = 0;
        for (i = 0; i < this._spacecrafts.length; i++) {
            if (preview) {
                spacecraft = this._spacecrafts[i];
                friendly = !this.getPilotedSpacecraft() || !spacecraft.isHostile(this.getPilotedSpacecraft());
                if (spacecraft.isAway() && (spacecraft.getPhysicalPositionMatrix()[12] === 0) && (spacecraft.getPhysicalPositionMatrix()[13] === 0) && (spacecraft.getPhysicalPositionMatrix()[14] === 0)) {
                    positioned = false;
                    for (j = 0; j < this._events.length; j++) {
                        actions = this._events[j].getActions();
                        for (k = 0; k < actions.length; k++) {
                            if ((actions[k].getType() === missionActions.ActionType.COMMAND) && (actions[k].getParams().command === ai.SpacecraftCommand.JUMP)) {
                                data = actions[k].getParams();
                                if (data.jump && (data.jump.way !== ai.JumpCommandWay.OUT) && data.jump.anchor) {
                                    index = actions[k].getSpacecrafts(this).indexOf(spacecraft);
                                    if (index >= 0) {
                                        data = utils.deepCopy(data);
                                        data.lead = actions[k].getSpacecrafts(this)[0];
                                        data.index = index;
                                        data.clearCache = true;
                                        ai.positionForInwardJump(spacecraft, data, this);
                                        positioned = true;
                                        if (index === 0) {
                                            if (data.jump.anchorSpacecraft) {
                                                jumpMarkers.set(spacecraft, vec.diff3(data.jump.anchorSpacecraft.getPhysicalPositionVector(), spacecraft.getPhysicalPositionVector()));
                                            } else {
                                                application.showError(spacecraft.getDisplayName() + " has invalid anchor: " + data.jump.anchor + "!");
                                            }
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                        if (positioned) {
                            break;
                        }
                    }
                }
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
                replaceVisualModel: preview,
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
                    battleScene.getCamera().followNode(this.getPilotedSpacecraft().getVisualModel().getNode(), true, 0, null, config.getDefaultCameraConfigurationName(this.getPilotedSpacecraft()));
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
                _trailPool.prefill(Math.ceil(this.getMaxMissileCount() * config.getSetting(config.BATTLE_SETTINGS.MISSILE_POOL_PREFILL_FACTOR)));
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
        projectile.simulate(dt, octree);
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
        missile.simulate(dt, octree);
        if (missile.canBeReused()) {
            _missilePool.markAsFree(indexInPool);
        }
    };
    /**
     * Function to execute during every simulation step on trails taken from the pool
     * @param {Trail} trail The trail to handle
     * @param {Number} indexInPool The index of the trail within the pool
     */
    Mission._handleTrail = function (trail, indexInPool) {
        if (trail.canBeReused()) {
            _trailPool.markAsFree(indexInPool);
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
     * Sets the passed callback to be executed whenever the team assignments within the mission change
     * @param {Function} callback
     */
    Mission.prototype.onTeamsChanged = function (callback) {
        this._onTeamsChanged = callback;
    };
    /**
     * Called when a spacecraft in this mission changes its team
     */
    Mission.prototype.handleTeamsChanged = function () {
        if (this._onTeamsChanged) {
            this._onTeamsChanged();
        }
    };
    /**
     * Call after resources have been loaded and the mission is ready to be started to finish off preparations.
     * Adds the particle systems to the scene and sets up their initial position.
     * @param {Scene} scene
     * @returns {Boolean}
     */
    Mission.prototype.prepareScene = function (scene) {
        if (this._environment.addParticleEffectsToScene(scene)) {
            this._environment.simulate();
            return true;
        }
        return false;
    };
    /**
     * Performs the physics and game logic simulation of all the object in the mission.
     * @param {Number} dt The time passed since the last simulation step, in milliseconds.
     * @param {Scene} mainScene When given, this scene is updated according to the simulation.
     * @param {Boolean} [multi=false] Whether the game is multiplayer
     */
    Mission.prototype.tick = function (dt, mainScene, multi) {
        var i, j, v, octree, index, collision, collA, collB, collisionDamage, collisionPosition;
        this._environment.simulate();
        for (i = 0; i < this._actionQueue.length; i++) {
            this._actionQueue[i].delay -= dt;
            if (this._actionQueue[i].delay <= 0) {
                this._actionQueue[i].action.execute(this);
            }
        }
        this._actionQueue = this._actionQueue.filter(Mission._filterActionEntry);
        for (i = 0; i < this._events.length; i++) {
            this._events[i].simulate(this, (!this._pilotedCraft || !this._pilotedCraft.isAway()) ? dt : 0); // event timers are stopped when the player jumps out
        }
        for (i = 0; i < this._spacecrafts.length; i++) {
            this._spacecrafts[i].simulate(dt);
            if (!this._spacecrafts[i].isAlive() || this._spacecrafts[i].isAway()) {
                index = this._hitObjects.indexOf(this._spacecrafts[i]);
                if (index >= 0) {
                    this._hitObjects[index] = null;
                    this._hitObjects.splice(index, 1);
                }
                if (!this._spacecrafts[i].isAlive()) {
                    this._spacecrafts[i].destroy(true);
                    if (!multi) {
                        this._spacecrafts[i] = null;
                        this._spacecrafts.splice(i, 1);
                        i--;
                    }
                }
            } else if (_showHitboxesForHitchecks) {
                this._spacecrafts[i].hideHitbox();
            }
        }
        // collision detection between spacecrafts
        for (i = 0; i < this._spacecrafts.length - 1; i++) {
            if ((this._spacecrafts[i].getHitpoints() > 0) && !this._spacecrafts[i].isAway()) {
                for (j = i + 1; j < this._spacecrafts.length; j++) {
                    if ((this._spacecrafts[j].getHitpoints() > 0) && !this._spacecrafts[j].isAway()) {
                        collision = this._spacecrafts[i].getPhysicalModel().checkCollision(this._spacecrafts[j].getPhysicalModel(), dt);
                        if (collision) {
                            collA = this._spacecrafts[collision.reverse ? j : i];
                            collB = this._spacecrafts[collision.reverse ? i : j];
                            collisionDamage = Math.min(Math.min(collision.magnitude * collision.magnitude * COLLISION_DAMAGE_FACTOR, this._spacecrafts[i].getClass().getHitpoints()), this._spacecrafts[j].getClass().getHitpoints());
                            collisionPosition = vec.prodVec4Mat4Aux(collision.position, collA.getPhysicalModel().getModelMatrix());
                            collA.damage(collisionDamage, collision.position, vec.scaled3(collision.direction, -1), collB, false, 0, true);
                            collB.damage(collisionDamage, vec.prodVec4Mat4Aux(collisionPosition, collB.getPhysicalModel().getModelMatrixInverse()), vec.normal3(vec.prodMat4Vec3Aux(collB.getPhysicalOrientationMatrix(), vec.prodVec3Mat4Aux(collision.direction, collA.getPhysicalOrientationMatrix()))), collA, false, 0, true);
                            vec.mulVec3ModelMat4(collisionPosition, mainScene.getCamera().getViewMatrix());
                            ((collA.getClass().getMass() <= collB.getClass().getMass()) ? collA : collB).playCollisionSound(collisionPosition);
                        }
                    }
                }
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
        if (_trailPool.hasLockedObjects()) {
            _trailPool.executeForLockedObjects(Mission._handleTrail);
        }
        if (_trailSegmentPool.hasLockedObjects()) {
            _trailSegmentPool.executeForLockedObjects(Mission._handleTrailSegment);
        }
        // moving the scene back to the origo if the camera is too far away to avoid floating point errors becoming visible
        if (mainScene && (!multi || networking.isHost())) {
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
                    "Trai: " + _trailPool.getLockedObjectCount() + " / " + _trailPool._objects.length + "<br/>" +
                    "TrSe: " + _trailSegmentPool.getLockedObjectCount() + " / " + _trailSegmentPool._objects.length;
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
        _trailPool.clear();
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
         * Whether this is mission descriptor loaded from a user selected file
         * @type Boolean
         */
        this._custom = (this._dataJSON.custom === true);
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
     * Returns whether the mission described is a test mission (to be listed only in debug mode)
     * @returns {Boolean}
     */
    MissionDescriptor.prototype.isCustom = function () {
        return this._custom;
    };
    /**
     * Returns the mission title as given in the data JSON
     * @returns {String} 
     */
    MissionDescriptor.prototype.getTitle = function () {
        return this._dataJSON.title || "";
    };
    /**
     * Returns the raw description of this mission (as given in the data JSON)
     * @returns {String} 
     */
    MissionDescriptor.prototype.getDescription = function () {
        return this._dataJSON.description || "";
    };
    /**
     * Returns the author who created this mission (for custom missions).
     * @returns {String}
     */
    MissionDescriptor.prototype.getAuthor = function () {
        return this._dataJSON.info ? this._dataJSON.info.author : null;
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
        var i, spacecrafts;
        if (!this._pilotedSpacecraftDescriptor) {
            spacecrafts = getIndividualSpacecraftDescriptors(this._dataJSON.spacecrafts);
            for (i = 0; i < spacecrafts.length; i++) {
                if (spacecrafts[i].piloted) {
                    this._pilotedSpacecraftDescriptor = spacecrafts[i];
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
                mission.getReferenceScore() * (mission.isInitialTeamMission() ? this._referenceBaseScoreFactor : 1),
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
     * Returns an object containing the required scores for the passed mission for all the stored mission performance levels.
     * The keys are the IDs of the performance levels and the values are the scores.
     * @param {Mission} mission
     * @returns {Object}
     */
    MissionContext.prototype.getPerformanceLevelScores = function (mission) {
        var i, result = {};
        for (i = 0; i < this._missionPerformanceLevels.length; i++) {
            result[this._missionPerformanceLevels[i].getName()] = this._missionPerformanceLevels[i].getRequiredScore(mission);
        }
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
        var missionAssignment = {}, setToReady = function () {
            this.setToReady();
            this._missionManager.setToReady();
        }.bind(this);
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
     * @param {Boolean} [custom]
     * @returns {String[]}
     */
    MissionContext.prototype.getMissionNames = function (custom) {
        var result = [];
        this._missionManager.executeForAllResourcesOfType(MISSION_ARRAY_NAME, function (missionDescriptor) {
            if ((application.isDebugVersion() || !missionDescriptor.isTest()) &&
                    ((custom === undefined) || (missionDescriptor.isCustom() === custom))) {
                result.push(missionDescriptor.getName());
            }
        }, false, true);
        return result;
    };
    /**
     * Returns a (new) array containing all of the mission descriptors (both loaded and not yet loaded ones)
     * @param {Boolean} [custom]
     * @returns {MissionDescriptor[]}
     */
    MissionContext.prototype.getMissionDescriptors = function (custom) {
        var result = [];
        this._missionManager.executeForAllResourcesOfType(MISSION_ARRAY_NAME, function (missionDescriptor) {
            if ((application.isDebugVersion() || !missionDescriptor.isTest()) &&
                    ((custom === undefined) || (missionDescriptor.isCustom() === custom))) {
                result.push(missionDescriptor);
            }
        }, false, true);
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
     * @param {Object} [params]
     */
    MissionContext.prototype.requestMissionDescriptor = function (name, callback, params) {
        var missionDescriptor = this._missionManager.getResource(MISSION_ARRAY_NAME, name, params);
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
    /**
     * Creates and returns a new Mission based on the passed data object and settings without saving it into the mission resource manager
     * @param {Object} data The JSON object data describing the mission
     * @param {String} difficulty The string ID of the difficulty level to use
     * @param {Boolean} demoMode Whether to load the created mission in demo mode
     * @returns {Mission} 
     */
    MissionContext.prototype.createMission = function (data, difficulty, demoMode) {
        return new MissionDescriptor(data).createMission(difficulty, demoMode);
    };
    // initialization
    // obtaining pool references
    _particlePool = pools.getPool(logicConstants.PARTICLE_POOL_NAME, renderableObjects.Particle);
    _projectilePool = pools.getPool(logicConstants.PROJECTILE_POOL_NAME, equipment.Projectile);
    _missilePool = pools.getPool(logicConstants.MISSILE_POOL_NAME, equipment.Missile);
    _trailPool = pools.getPool(logicConstants.TRAIL_POOL_NAME, renderableObjects.Trail);
    _trailSegmentPool = pools.getPool(logicConstants.TRAIL_SEGMENT_POOL_NAME, renderableObjects.TrailSegment);
    _explosionPool = pools.getPool(logicConstants.EXPLOSION_POOL_NAME, explosion.Explosion);
    // creating the default context
    _context = new MissionContext();
    // caching configuration settings
    config.executeWhenReady(function () {
        _showHitboxesForHitchecks = config.getSetting(config.BATTLE_SETTINGS.SHOW_HITBOXES_FOR_HITCHECKS);
        _groupTransformsArrayName = config.getSetting(config.GENERAL_SETTINGS.UNIFORM_GROUP_TRANSFORMS_ARRAY_NAME);
    });
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        FAILED_MISSION_PERFORMACE: FAILED_MISSION_PERFORMACE,
        MissionDescriptor: MissionDescriptor,
        loadConfigurationFromJSON: _context.loadConfigurationFromJSON.bind(_context),
        loadSettingsFromLocalStorage: _context.loadSettingsFromLocalStorage.bind(_context),
        requestLoad: _context.requestLoad.bind(_context),
        executeWhenReady: _context.executeWhenReady.bind(_context),
        getIndividualSpacecraftDescriptors: getIndividualSpacecraftDescriptors,
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
        createMissionDescriptor: _context.createMissionDescriptor.bind(_context),
        createMission: _context.createMission.bind(_context)
    };
});