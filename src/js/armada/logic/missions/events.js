/**
 * Copyright 2014-2021 Krisztián Nagy
 * @file Implementation of mission events - a list of actions that can be triggered by conditions
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used for format strings and useful constants
 * @param application Used for file loading and logging functionality
 * @param strings Used for translation support
 * @param conditions Used for parsing and creating conditions from mission data
 * @param eventActions Used for parsing and creating mission event actions from mission data
 */
define([
    "utils/utils",
    "modules/application",
    "armada/strings",
    "armada/logic/missions/conditions",
    "armada/logic/missions/actions",
    "utils/polyfill"
], function (
        utils,
        application,
        strings,
        conditions, eventActions) {
    "use strict";
    var
            MissionState = conditions.MissionState,
            // ------------------------------------------------------------------------------
            // enums
            TriggerWhich = {
                /** All the conditions need to be true / false (see TriggerWhen) for the trigger to fire */
                ALL: "all",
                /** Any of the conditions being true / false (see TriggerWhen) causes the trigger to fire */
                ANY: "any"
            },
            TriggerWhen = {
                /** The trigger fires when all / any (see TriggerWhich) of its conditions become true */
                BECOMES_TRUE: "becomesTrue",
                /** The trigger fires when all / any (see TriggerWhich) of its conditions become false */
                BECOMES_FALSE: "becomesFalse"
            },
            /**
             * Objectives displayed on the HUD are colored based on this
             */
            ObjectiveState = {
                IN_PROGRESS: 0,
                COMPLETED: 1,
                FAILED: 2
            };
    // -------------------------------------------------------------------------
    // Freezing enums
    Object.freeze(TriggerWhich);
    Object.freeze(TriggerWhen);
    Object.freeze(ObjectiveState);
    // #########################################################################
    /**
     * @callback Trigger~onFireCallback
     * @param {Mission} mission 
     */
    /**
     * @typedef {Object} ObjectiveWithState
     * @property {String} text A translated text to display the objective and its current progress state to the player on the HUD
     * @property {Number} state (enum ObjectiveState)
     * @property {Boolean} completable Whether this is a completable objective (if not, it is completed (if not failed) upon finishing the mission)
     */
    /**
     * @class Missions contain triggers, which fire based on a set of conditions that they evaluate in every simulation step, and can have
     * callbacks added to them which are invoked upon firing
     * that can be 
     * @param {Object} dataJSON
     * @param {Mission} mission
     */
    function Trigger(dataJSON, mission) {
        var i, when, which;
        /**
         * The list of conditions to evaluate when deciding whether to fire
         * @type Condition[]
         */
        this._conditions = null;
        if (dataJSON.conditions && (dataJSON.conditions.length > 0)) {
            this._conditions = [];
            for (i = 0; i < dataJSON.conditions.length; i++) {
                this._conditions.push(conditions.createCondition(dataJSON.conditions[i], mission));
            }
        }
        /**
         * (enum TriggerWhich) 
         * Determines the logical operation used to combine the conditions when deciding whether to fire
         * @type String
         */
        which = utils.getSafeEnumValue(TriggerWhich, dataJSON.which, TriggerWhich.ALL);
        /**
         * Cached value of whether we need to check for the state of all conditions to be true / false
         * @type Boolean
         */
        this._all = (which === TriggerWhich.ALL);
        /**
         * (enum TriggerWhen)
         * Determines at what logic state (or state change) should the trigger fire
         * @type String
         */
        when = utils.getSafeEnumValue(TriggerWhen, dataJSON.when, TriggerWhen.BECOMES_TRUE);
        /**
         * Cached value of whether we need to check for false values of conditions rather then true
         * @type Boolean
         */
        this._falsy = (when === TriggerWhen.BECOMES_FALSE);
        if (!this._all) {
            this._falsy = !this._falsy;
        }
        /**
         * When true, the trigger can only fire once during a mission, and then it does not evaluate its conditions anymore
         * @type Boolean
         */
        this._once = true;
        if (dataJSON.once !== undefined) {
            this._once = dataJSON.once;
        } else if (this._conditions) {
            for (i = 0; i < this._conditions.length; i++) {
                if (this._conditions[i].canChangeMultipleTimes()) {
                    this._once = false;
                    break;
                }
            }
        }
        /**
         * If this is set (to a larger than 0 value), the trigger will fire this much later after the first
         * time it is evaluated true, in milliseconds. "once" must be set to true.
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
        /**
         * Whether based on its conditions, this trigger can possibly become impossible to fire
         * @type Boolean
         */
        this._canBeImpossible = true;
        /**
         * (enum ObjectiveState) If this trigger belongs to a mission objective (win / lose event),
         * we track the state of the objective in this variable
         * @type Number
         */
        this._objectiveState = ObjectiveState.IN_PROGRESS;
        if (!this._falsy && this._conditions) {
            this._canBeImpossible = !this._all;
            for (i = 0; i < this._conditions.length; i++) {
                if (this._conditions[i].canBeImpossible()) {
                    this._canBeImpossible = this._all;
                    break;
                }
            }
        }
        // invalid state checks
        if (!this._conditions && !this._once) {
            application.showError("A trigger has no conditions, 'once' cannot be set to false!");
            this._once = true;
        }
        if (!this._once && this._delay) {
            application.showError("Triggers without 'once' cannot have delays!");
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
        if (this._once) {
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
        if (!this._conditions) {
            this.fire(mission);
            return;
        }
        conditionState = this._all;
        for (i = 0; i < this._conditions.length; i++) {
            // need to loop all conditions, to make sure timers are all updated with dt
            if (this._conditions[i].isSatisfied(mission, dt) === this._falsy) {
                conditionState = !this._all;
            }
        }
        if ((this._previousConditionState === this._falsy) && (conditionState !== this._falsy)) {
            this.fire(mission);
        }
        this._previousConditionState = conditionState;
    };
    /**
     * Returns the number of mission objectives corresponding to this trigger
     * @param {Boolean} triggersWinAction Whether this trigger firing causes the player to win 
     * @returns {Number}
     */
    Trigger.prototype.getObjectiveCount = function (triggersWinAction) {
        return triggersWinAction ? this._conditions.length : 1;
    };
    /**
     * Returns the list of HTML strings that can be used to display the objectives associated with the conditions of this trigger.
     * @param {Object} stringPrefix The translation string descriptor containing the prefix to be used to decide whether the conditions 
     * should be considered win or lose conditions
     * @param {Boolean} triggersWinAction Whether this trigger firing causes the player to win 
     * @param {Mission} mission
     * @returns {String[]}
     */
    Trigger.prototype.getObjectiveStrings = function (stringPrefix, triggersWinAction, mission) {
        var i, result = [], multi, text;
        if (!this._conditions) {
            application.showError("Win and lose events must have conditions!");
            return null;
        }
        if (!this._all) {
            application.showError("Triggers for mission objectives must be set to 'which' = '" + TriggerWhich.ALL + "'!");
            return null;
        }
        if (this._falsy) {
            application.showError("Triggers for mission objectives must be set to 'when' = '" + TriggerWhen.BECOMES_TRUE + "'!");
            return null;
        }
        multi = this._conditions.length > 1;
        if (triggersWinAction) {
            for (i = 0; i < this._conditions.length; i++) {
                result.push(this._conditions[i].getObjectiveString(stringPrefix, multi, mission));
            }
        } else {
            text = "";
            for (i = 0; i < this._conditions.length; i++) {
                text += ((i > 0) ? " " : "") + this._conditions[i].getObjectiveString(stringPrefix, multi, mission);
            }
            result.push(text);
        }
        return result;
    };
    /**
     * Updates the passed array starting from the passed index with the objectives and their states
     * belonging to this trigger.
     * To be used for the HUD objective indicator.
     * @param {Boolean} triggersWinAction Whether this trigger firing causes the player to win 
     * @param {Mission} mission 
     * @param {Boolean} missionEnded Whether the mission has already ended (and we are gathering objective 
     * states for display on the debriefing screen)
     * @param {ObjectiveWithState[]} [objectivesState] The array to update
     * @param {Number} [index] The starting index in the array to start the update from
     * @returns {Number} The index coming after the last updated element of the array
     */
    Trigger.prototype.getObjectivesState = function (triggersWinAction, mission, missionEnded, objectivesState, index) {
        var i, multi = this._conditions.length > 1, satisfied, impossible, text;
        if (triggersWinAction) {
            for (i = 0; i < this._conditions.length; i++) {
                if (this._objectiveState === ObjectiveState.IN_PROGRESS) {
                    this._objectiveState = this._conditions[i].isSatisfied(mission, 0) ?
                            ((this._conditions[i].canBeImpossible() && !missionEnded) ?
                                    ((mission.getState() === MissionState.COMPLETED) ?
                                            ObjectiveState.COMPLETED :
                                            ObjectiveState.IN_PROGRESS) :
                                    ObjectiveState.COMPLETED) :
                            this._conditions[i].isImpossible() ? ObjectiveState.FAILED : ObjectiveState.IN_PROGRESS;
                }
                if ((this._objectiveState !== ObjectiveState.IN_PROGRESS) || this._conditions[i].isActive() || missionEnded) {
                    objectivesState[index].text = this._conditions[i].getObjectiveStateString(strings.BATTLE.OBJECTIVE_WIN_PREFIX, multi, mission, this._objectiveState === ObjectiveState.IN_PROGRESS);
                    objectivesState[index].state = this._objectiveState;
                    objectivesState[index].completable = true;
                    index++;
                }
            }
        } else {
            satisfied = true;
            impossible = false;
            for (i = 0; i < this._conditions.length; i++) {
                if (!this._conditions[i].isSatisfied(mission, 0)) {
                    satisfied = false;
                    if (this._conditions[i].isImpossible()) {
                        impossible = true;
                        break;
                    }
                }
            }
            if (this._objectiveState !== ObjectiveState.FAILED) {
                this._objectiveState = satisfied ? ObjectiveState.FAILED : (impossible || missionEnded || (mission.getState() === MissionState.COMPLETED)) ? ObjectiveState.COMPLETED : ObjectiveState.IN_PROGRESS;
            }
            text = (this._conditions.length > 0) ? this._conditions[0].getObjectiveStateString(strings.BATTLE.OBJECTIVE_LOSE_PREFIX, multi, mission, this._objectiveState === ObjectiveState.IN_PROGRESS) : "";
            if (this._objectiveState === ObjectiveState.IN_PROGRESS) {
                for (i = 1; i < this._conditions.length; i++) {
                    if (this._conditions[i].isActive()) {
                        text += " " + this._conditions[i].getObjectiveStateString(strings.BATTLE.OBJECTIVE_LOSE_PREFIX, multi, mission, this._objectiveState === ObjectiveState.IN_PROGRESS);
                    }
                }
            }
            if (text) {
                objectivesState[index].text = text;
                objectivesState[index].state = this._objectiveState;
                objectivesState[index].completable = this._canBeImpossible;
                index++;
            }
        }
        return index;
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
    /**
     * Whether based on its conditions, this trigger can possibly become impossible to fire
     * @returns {Boolean}
     */
    Trigger.prototype.canBeImpossible = function () {
        return this._canBeImpossible;
    };
    // #########################################################################
    /**
     * @class A game event is a set of actions that are executed whenever an associated trigger (a set of conditions and parameters) fires 
     * during the mission.
     * @param {Object} dataJSON
     * @param {Mission} mission
     */
    function MissionEvent(dataJSON, mission) {
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
        this._trigger = new Trigger(dataJSON.trigger, mission);
        /**
         * Actions that are executed in every simulation step when their associated triggers fire
         * @type Action[]
         */
        this._actions = [];
        for (i = 0; i < dataJSON.actions.length; i++) {
            this._actions.push(eventActions.createAction(dataJSON.actions[i], this._trigger));
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
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        TriggerWhen: TriggerWhen,
        TriggerWhich: TriggerWhich,
        MissionState: MissionState,
        ObjectiveState: ObjectiveState,
        MissionEvent: MissionEvent
    };
});