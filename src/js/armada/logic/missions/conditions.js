/**
 * Copyright 2014-2021 Krisztián Nagy
 * @file The classes defining conditions which can trigger events during missions
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used for format strings and useful constants
 * @param application Used for file loading and logging functionality
 * @param strings Used for translation support
 */
define([
    "utils/utils",
    "modules/application",
    "armada/strings",
    "utils/polyfill"
], function (utils, application, strings) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // enums
            ConditionType = {
                /** The condition is evaluated true when any/all of its subjects are destroyed */
                DESTROYED: "destroyed",
                /** The condition is evaluated true based on the count of still alive spacecrafts from its subjects */
                COUNT: "count",
                /** The condition is evaluated true based on the time elapsed since the start of the mission or the firing of a trigger */
                TIME: "time",
                /** The condition is evaluated true when any/all of its subjects' hull integrity falls into a specified range */
                HULL_INTEGRITY: "hullIntegrity"
            },
            ConditionSubjectsWhich = {
                /** All the subjects need to be destroyed for the condition to be fulfilled */
                ALL: "all",
                /** Any of the subjects can be destroyed for the condition to be fulfilled */
                ANY: "any"
            },
            CountConditionRelation = {
                /** The condition is satisfied when there are less subjects alive than the specified count */
                BELOW: "below",
                /** The condition is satisfied when there are more subjects alive than the specified count */
                ABOVE: "above",
                /** The condition is satisfied when there are exactly as many subjects alive as the specified count */
                EQUALS: "equals"
            },
            TimeConditionWhen = {
                /** The condition is satisfied from the beginning of the mission until the specified time has elapsed (after start) */
                BEFORE: "before",
                /** The condition is satisfied starting from when the specified time has elapsed (after start) */
                AFTER: "after",
                /** The condition is satisfied after start, within the specified time */
                WITHIN: "within",
                /** The condition is satisfied when exactly the specified time has elapsed (after start) */
                ONCE: "once",
                /** The condition is satisfied every time the specified time has been elapsed (after start), in a looping fashion */
                REPEAT: "repeat"
            },
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * Contains the constructor function of the Condition subclass for each ConditionType identifier.
             * @type Object.<String, Function>
             */
            _conditionConstructors;
    // -------------------------------------------------------------------------
    // Freezing enums
    Object.freeze(ConditionType);
    Object.freeze(ConditionSubjectsWhich);
    Object.freeze(CountConditionRelation);
    Object.freeze(TimeConditionWhen);
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
                (this._descriptor.teams && (this._descriptor.teams.indexOf(spacecraft.getTeam().getName()) >= 0));
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
     * Whether this subject group (potentially) includes multiple spacecrafts
     * @returns {Boolean}
     */
    SubjectGroup.prototype.isMulti = function () {
        return (this._descriptor.spacecrafts && (this._descriptor.spacecrafts.length > 1)) ||
                (this._descriptor.squads && (this._descriptor.squads.length > 0)) ||
                (this._descriptor.teams && (this._descriptor.teams.length > 0));
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
        subjectID = strings.get(strings.SQUAD.PREFIX, subjectID, subjectID);
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
        subjectID = strings.get(strings.FACTION.PREFIX, subjectID, subjectID);
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
     * Returns the minimum hull integrity value from among the subject spacecrafts
     * @param {Boolean} [presentOnly=false] If true, only the spacecrafts that are present (not away) are considered 
     * @returns {Number}
     */
    SubjectGroup.prototype.getMinHullIntegrity = function (presentOnly) {
        var result = 100, i;
        for (i = 0; i < this._spacecrafts.length; i++) {
            if (this._spacecrafts[i].isAlive() && (!presentOnly || !this._spacecrafts[i].isAway())) {
                result = Math.min(result, this._spacecrafts[i].getHullIntegrity());
            }
        }
        return result;
    };
    /**
     * Returns the maximum hull integrity value from among the subject spacecrafts
     * @param {Boolean} [presentOnly=false] If true, only the spacecrafts that are present (not away) are considered 
     * @returns {Number}
     */
    SubjectGroup.prototype.getMaxHullIntegrity = function (presentOnly) {
        var result = 0, i;
        for (i = 0; i < this._spacecrafts.length; i++) {
            if (this._spacecrafts[i].isAlive() && (!presentOnly || !this._spacecrafts[i].isAway())) {
                result = Math.max(result, this._spacecrafts[i].getHullIntegrity());
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
                    this._shortString = strings.get(strings.SQUAD.PREFIX, this._descriptor.squads[0], this._descriptor.squads[0]);
                }
            } else if (!this._descriptor.spacecrafts && !this._descriptor.squads && this._descriptor.teams) {
                if (this._descriptor.teams.length > 1) {
                    this._shortString = utils.formatString(strings.get(strings.BATTLE.OBJECTIVE_SUBJECTS_TEAMS), {count: this._descriptor.teams.length});
                } else {
                    this._shortString = strings.get(strings.FACTION.PREFIX, this._descriptor.teams[0], this._descriptor.teams[0]);
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
     * - implement _checkParams() and isSatisfied() (see existing condition classes for details)
     * - add a new corresponding ConditionType and register the subclass for it in _conditionConstructors
     * - if the condition can correspond to a mission objective, implement 
     *   getObjectiveString(), getObjectiveStateString(), getTargetSpacecrafts() and getEscortedSpacecrafts() (see existing condition classes for details)
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
     * Returns true if this condition has a chance of becoming impossible to satisfy
     * @returns {Boolean}
     */
    Condition.prototype.canBeImpossible = function () {
        return false;
    };
    /**
     * Returns true if this condition can not be satisfied anymore during the current mission
     * @returns {Boolean}
     */
    Condition.prototype.isImpossible = function () {
        return false;
    };
    /**
     * For mission objective conditions, whether the objective corresponding to this condition should be considered active
     * @returns {Boolean}
     */
    Condition.prototype.isActive = function () {
        return true;
    };
    /**
     * Whether this condition can change between being satisfied and not multiple times during the mission
     * @returns {Boolean}
     */
    Condition.prototype.canChangeMultipleTimes = function () {
        return false;
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
     * @typedef DestroyedCondition~Params
     * @property {String} [which] (enum ConditionSubjectsWhich)
     */
    /**
     * @param {DestroyedCondition~Params} params
     * @returns {Boolean}
     */
    DestroyedCondition.prototype._checkParams = function (params) {
        /**
         * @type DestroyedCondition~Params
         */
        this._params = params;
        if (this._params && this._params.which &&
                !utils.getSafeEnumValue(ConditionSubjectsWhich, this._params.which)) {
            this._handleWrongParams();
            return false;
        }
        /**
         * @type Boolean
         */
        this._all = !this._params || !this._params.which || (this._params.which === ConditionSubjectsWhich.ALL);
        return true;
    };
    /**
     * @param {Mission} mission
     * @returns {Boolean}
     */
    DestroyedCondition.prototype.isSatisfied = function (mission) {
        var i, spacecrafts = this._subjects.getSpacecrafts(mission);
        for (i = 0; i < spacecrafts.length; i++) {
            if (spacecrafts[i].isAlive() === this._all) {
                return !this._all;
            }
        }
        return this._all;
    };
    /**
     * @param {Object} stringPrefix 
     * @returns {String}
     */
    DestroyedCondition.prototype.getObjectiveString = function (stringPrefix) {
        var result = utils.formatString(strings.get(stringPrefix,
                this._subjects.isMulti() ?
                (this._all ? strings.OBJECTIVE.DESTROY_SUFFIX.name : strings.OBJECTIVE.DESTROY_ANY_SUFFIX.name) :
                strings.OBJECTIVE.DESTROY_ONE_SUFFIX.name), {
            subjects: this._subjects.toString()
        });
        result = result.charAt(0).toUpperCase() + result.slice(1);
        return result;
    };
    /**
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
     * Note: this is only correct if this condition belongs to the trigger of a WIN event
     * @param {Mission} mission 
     * @returns {Spacecraft[]}
     */
    DestroyedCondition.prototype.getTargetSpacecrafts = function (mission) {
        return this._subjects.getSpacecrafts(mission);
    };
    /**
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
     * @param {Object} stringPrefix 
     * @returns {String}
     */
    CountCondition.prototype.getObjectiveStateString = function (stringPrefix) {
        var result, count;
        if (!this._subjects.getSpacecrafts()) {
            return "";
        }
        count = this._subjects.getLiveSubjectCount();
        result = utils.formatString(strings.get(stringPrefix, strings.OBJECTIVE.COUNT_BELOW_SUFFIX.name), {
            subjects: this._subjects.getShortString(),
            count: this._params.count,
            live: count,
            remaining: Math.max(0, count - this._params.count)
        });
        result = result.charAt(0).toUpperCase() + result.slice(1);
        return result;
    };
    /**
     * Note: this is only correct if this condition belongs to the trigger of a WIN event
     * @param {Mission} mission 
     * @returns {Spacecraft[]}
     */
    CountCondition.prototype.getTargetSpacecrafts = function (mission) {
        return this._subjects.getSpacecrafts(mission);
    };
    /**
     * Note: this is only correct if this condition belongs to the trigger of a LOSE event
     * @param {Mission} mission 
     * @returns {Spacecraft[]}
     */
    CountCondition.prototype.getEscortedSpacecrafts = function (mission) {
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
        this._running = !this._params || !this._params.start;
        /**
         * A reference to the trigger setting off the timer for this condition (if any)
         * @type Trigger
         */
        this._trigger = null;
        /**
         * The time elapsed while running the timer for this condition, in milliseconds
         * @type Number
         */
        this._timeElapsed = this._params ? this._params.startValue || 0 : 0;
        /**
         * The number of times this condition has already been satisfied (for repeat mode)
         * @type Number
         */
        this._count = 0;
        /**
         * When this condition can become impossible to be satisfied
         * @type Boolean
         */
        this._canBeImpossible = this._params ? (this._params.when === TimeConditionWhen.BEFORE) ||
                (this._params.when === TimeConditionWhen.WITHIN) ||
                (this._params.when === TimeConditionWhen.ONCE) ||
                ((this._params.when === TimeConditionWhen.REPEAT) && this._params.maxCount) : false;
        /**
         * Cached value of whether the time condition has the 'when' param set to 'before'
         * @type Boolean
         */
        this._before = !!this._params && (this._params.when === TimeConditionWhen.BEFORE);
        /**
         * Whether this condition cannot be satisfied anymore
         * @type Boolean
         */
        this._impossible = false;
    }
    TimeCondition.prototype = new Condition();
    TimeCondition.prototype.constructor = TimeCondition;
    /**
     * @typedef TimeCondition~Params
     * @property {Number} time The amount of time this condition refers to, in milliseconds
     * @property {String} when (enum TimeConditionWhen) How to determine when the condition is satisfied
     * @property {String} [start] The name of the event starting the timer for this condition (not set: start of mission)
     * @property {Number} [maxCount] The maximum number of times this condition can be satisfied (only for repeat mode)
     * @property {Number} [startValue] The value of the timer when started (for repeat mode)
     */
    /**
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
                !(utils.getSafeEnumValue(TimeConditionWhen, this._params.when)) ||
                ((this._params.start !== undefined) && (typeof this._params.start !== "string")) ||
                ((this._params.when !== TimeConditionWhen.REPEAT) && (this._params.maxCount !== undefined)) ||
                ((this._params.when === TimeConditionWhen.REPEAT) && (this._params.maxCount !== undefined) && (typeof this._params.maxCount !== "number")) ||
                ((this._params.startValue !== undefined) && (typeof this._params.startValue !== "number"))) {
            this._handleWrongParams();
            return false;
        }
        return true;
    };
    /**
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
        if (!this._running && !this._impossible && this._trigger && this._trigger.hasFired()) {
            this._running = true;
        }
        if (this._running) {
            this._timeElapsed += dt;
            switch (this._params.when) {
                case TimeConditionWhen.BEFORE:
                case TimeConditionWhen.WITHIN:
                    if (this._timeElapsed < this._params.time) {
                        return true;
                    } else {
                        this._impossible = true;
                    }
                    break;
                case TimeConditionWhen.AFTER:
                    if (this._timeElapsed > this._params.time) {
                        return true;
                    }
                    break;
                case TimeConditionWhen.ONCE:
                    if ((this._timeElapsed >= this._params.time) && (this._count === 0)) {
                        this._running = false;
                        this._count = 1;
                        this._impossible = true;
                        return true;
                    }
                    break;
                case TimeConditionWhen.REPEAT:
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
                        this._impossible = true;
                    }
                    break;
            }
        }
        return this._before ? (this._timeElapsed < this._params.time) : false;
    };
    /**
     * @param {Object} stringPrefix
     * @param {Boolean} multipleConditions
     * @returns {String}
     */
    TimeCondition.prototype.getObjectiveString = function (stringPrefix, multipleConditions) {
        var result;
        if (!multipleConditions && (!this._params || (this._params.when !== TimeConditionWhen.AFTER))) {
            application.showError("Single time conditions for mission objectives must have 'when' = '" + TimeConditionWhen.AFTER + "'!");
            return null;
        }
        if (multipleConditions && (!this._params || (this._params.when !== TimeConditionWhen.BEFORE))) {
            application.showError("Time conditions used in combination with other conditions for mission objectives must have 'when' = '" + TimeConditionWhen.BEFORE + "'!");
            return null;
        }
        result = utils.formatString(strings.get(stringPrefix, multipleConditions ? strings.OBJECTIVE.TIME_MULTI_SUFFIX.name : strings.OBJECTIVE.TIME_SUFFIX.name), {
            time: utils.formatTimeToMinutes(this._params.time)
        });
        if (!multipleConditions) {
            result = result.charAt(0).toUpperCase() + result.slice(1);
        }
        return result;
    };
    /**
     * @param {Object} stringPrefix 
     * @param {Boolean} multipleConditions
     * @returns {String}
     */
    TimeCondition.prototype.getObjectiveStateString = function (stringPrefix, multipleConditions) {
        var result, timeRemaining;
        timeRemaining = Math.ceil(Math.max(0, this._params.time - this._timeElapsed) * 0.001) * 1000;
        result = utils.formatString(strings.get(stringPrefix, multipleConditions ? strings.OBJECTIVE.TIME_MULTI_SUFFIX.name : strings.OBJECTIVE.TIME_SUFFIX.name), {
            time: utils.formatTimeToMinutes(timeRemaining)
        });
        result = result.charAt(0).toUpperCase() + result.slice(1);
        return result;
    };
    /**
     * @returns {Spacecraft[]}
     */
    TimeCondition.prototype.getTargetSpacecrafts = function () {
        return utils.EMPTY_ARRAY;
    };
    /**
     * @returns {Spacecraft[]}
     */
    TimeCondition.prototype.getEscortedSpacecrafts = function () {
        return utils.EMPTY_ARRAY;
    };
    /**
     * @override
     * @returns {Boolean}
     */
    TimeCondition.prototype.canBeImpossible = function () {
        return this._canBeImpossible;
    };
    /**
     * @override
     * @returns {Boolean}
     */
    TimeCondition.prototype.isImpossible = function () {
        return this._impossible;
    };
    /**
     * @override
     * @returns {Boolean}
     */
    TimeCondition.prototype.isActive = function () {
        return this._running && (!this._params || (this._timeElapsed < this._params.time));
    };
    /**
     * @override
     * @returns {Boolean}
     */
    TimeCondition.prototype.canChangeMultipleTimes = function () {
        return this._params.when === TimeConditionWhen.REPEAT;
    };
    // ##############################################################################
    /**
     * @class A condition that is satisfied based on the hull integrity of the
     * subjects
     * @extends Condition
     * @param {Object} dataJSON
     */
    function HullIntegrityCondition(dataJSON) {
        Condition.call(this, dataJSON);

    }
    HullIntegrityCondition.prototype = new Condition();
    HullIntegrityCondition.prototype.constructor = HullIntegrityCondition;
    /**
     * @typedef HullIntegrityCondition~Params
     * @property {String} [which] (enum ConditionSubjectsWhich)
     * @property {Number} [minIntegrity] The condition is satisfied if the hull integrity of the subjects is not below this value (in %)
     * @property {Number} [maxIntegrity] The condition is satisfied if the hull integrity of the subjects is not above this value (in %)
     */
    /**
     * @param {HullIntegrityCondition~Params} params 
     * @returns {Boolean}
     */
    HullIntegrityCondition.prototype._checkParams = function (params) {
        /**
         * @type DestroyedCondition~Params
         */
        this._params = params;
        if (this._params &&
                ((this._params.which && !utils.getSafeEnumValue(ConditionSubjectsWhich, this._params.which)) ||
                        (this._params.minIntegrity !== undefined && (this._params.minIntegrity < 0 || this._params.minIntegrity > 100)) ||
                        (this._params.maxIntegrity !== undefined && (this._params.maxIntegrity < 0 || this._params.maxIntegrity > 100)))) {
            this._handleWrongParams();
            return false;
        }
        /**
         * @type Boolean
         */
        this._all = !this._params || !this._params.which || (this._params.which === ConditionSubjectsWhich.ALL);
        return true;
    };
    /**
     * @param {Mission} mission
     * @returns {Boolean}
     */
    HullIntegrityCondition.prototype.isSatisfied = function (mission) {
        var i, integrity, spacecrafts = this._subjects.getSpacecrafts(mission);
        for (i = 0; i < spacecrafts.length; i++) {
            integrity = spacecrafts[i].getHullIntegrity() * 100;
            if ((((this._params.minIntegrity !== undefined) && (integrity < this._params.minIntegrity)) ||
                    ((this._params.maxIntegrity !== undefined) && (integrity > this._params.maxIntegrity))) === this._all) {
                return !this._all;
            }
        }
        return this._all;
    };
    /**
     * @param {Object} stringPrefix
     * @returns {String}
     */
    HullIntegrityCondition.prototype.getObjectiveString = function (stringPrefix) {
        var result;
        if (!this._params || (this._params.maxIntegrity === undefined) || (this._params.minIntegrity !== undefined)) {
            application.showError("Hull integrity conditions for mission objectives must specify a maximum and no minimum integrity!");
            return null;
        }
        result = utils.formatString(strings.get(stringPrefix,
                this._subjects.isMulti() ?
                (this._all ? strings.OBJECTIVE.MAX_HULL_INTEGRITY_SUFFIX.name : strings.OBJECTIVE.MAX_HULL_INTEGRITY_ANY_SUFFIX.name) :
                strings.OBJECTIVE.MAX_HULL_INTEGRITY_ONE_SUFFIX.name), {
            subjects: this._subjects.toString(),
            maxIntegrity: this._params.maxIntegrity
        });
        result = result.charAt(0).toUpperCase() + result.slice(1);
        return result;
    };
    /**
     * @param {Object} stringPrefix 
     * @returns {String}
     */
    HullIntegrityCondition.prototype.getObjectiveStateString = function (stringPrefix) {
        var result, suffix;
        if (!this._subjects.getSpacecrafts()) {
            return "";
        }
        if (this._subjects.getLiveSubjectCount(true) > 0) {
            suffix = " (" + Math.round((this._all ? this._subjects.getMaxHullIntegrity(true) : this._subjects.getMinHullIntegrity(true)) * 100) + "/" + this._params.maxIntegrity + "%)";
        } else {
            suffix = "";
        }
        result = utils.formatString(strings.get(stringPrefix, strings.OBJECTIVE.MAX_HULL_INTEGRITY_SUFFIX.name), {
            subjects: this._subjects.getShortString()
        }) + suffix;
        result = result.charAt(0).toUpperCase() + result.slice(1);
        return result;
    };
    /**
     * Note: this is only correct if this condition belongs to the trigger of a WIN event
     * @param {Mission} mission 
     * @returns {Spacecraft[]}
     */
    HullIntegrityCondition.prototype.getTargetSpacecrafts = function (mission) {
        return this._subjects.getSpacecrafts(mission);
    };
    /**
     * Note: this is only correct if this condition belongs to the trigger of a LOSE event
     * @param {Mission} mission 
     * @returns {Spacecraft[]}
     */
    HullIntegrityCondition.prototype.getEscortedSpacecrafts = function (mission) {
        return this._subjects.getSpacecrafts(mission);
    };
    /**
     * @override
     * @returns {Boolean}
     */
    HullIntegrityCondition.prototype.canChangeMultipleTimes = function () {
        return true;
    };
    /**
     * @param {Object} dataJSON
     * @returns {DestroyedCondition|CountCondition|TimeCondition|Condition}
     */
    function createCondition(dataJSON) {
        return new (_conditionConstructors[dataJSON.type] || Condition)(dataJSON);
    }
    // initialization
    // associating condition constructors
    _conditionConstructors = {};
    _conditionConstructors[ConditionType.DESTROYED] = DestroyedCondition;
    _conditionConstructors[ConditionType.COUNT] = CountCondition;
    _conditionConstructors[ConditionType.TIME] = TimeCondition;
    _conditionConstructors[ConditionType.HULL_INTEGRITY] = HullIntegrityCondition;
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        ConditionType: ConditionType,
        ConditionSubjectsWhich: ConditionSubjectsWhich,
        CountConditionRelation: CountConditionRelation,
        TimeConditionWhen: TimeConditionWhen,
        SubjectGroup: SubjectGroup,
        createCondition: createCondition
    };
});