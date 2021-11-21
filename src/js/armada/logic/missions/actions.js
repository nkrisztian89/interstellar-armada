/**
 * Copyright 2014-2021 Krisztián Nagy
 * @file The classes defining actions which can be executed during mission events
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/*global define */

/**
 * @param utils Used for format strings and useful constants
 * @param application Used for file loading and logging functionality
 * @param game Used to dispatch messages to BattleScreen
 * @param strings Used for translation support
 * @param SpacecraftEvents Used to trigger spacecraft events
 * @param conditions Used for parsing and creating conditions from mission data
 */
define([
    "utils/utils",
    "modules/application",
    "modules/game",
    "armada/strings",
    "armada/logic/SpacecraftEvents",
    "armada/logic/missions/conditions",
    "utils/polyfill"
], function (
        utils,
        application, game,
        strings,
        SpacecraftEvents,
        conditions) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // enums
            ActionType = {
                /** Executing this action queues a message to be displayed on the HUD */
                MESSAGE: "message",
                /** Executing this action clears the HUD message queue */
                CLEAR_MESSAGES: "clearMessages",
                /** Executing this action sends a command to the subject spacecrafts (to be processed by their AIs) */
                COMMAND: "command",
                /** Executing this action changes the state of the HUD on the piloted spacecraft (e.g. hide / show / highlight an element) */
                HUD: "hud",
                /** Executing this action marks the mission as complete */
                WIN: "win",
                /** Executing this action marks the mission as failed */
                LOSE: "lose"
            },
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * Contains the constructor function of the Action subclass for each ActionType identifier.
             * @type Object.<String, Function>
             */
            _actionConstructors;
    // -------------------------------------------------------------------------
    // Freezing enums
    Object.freeze(ActionType);
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
        this._subjects = dataJSON ? new conditions.SubjectGroup(dataJSON.subjects) : null;
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
     * Whether the trigger belonging to this action has a chance of becoming impossible to fire
     * @returns {Boolean}
     */
    Action.prototype.triggerCanBeImpossible = function () {
        return this._trigger.canBeImpossible();
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
     * Returns the number of mission objectives corresponding to this action
     * @returns {Number}
     */
    WinAction.prototype.getObjectiveCount = function () {
        return this._trigger.getObjectiveCount(true);
    };
    /**
     * @returns {String[]}
     */
    WinAction.prototype.getObjectiveStrings = function () {
        return this._trigger.getObjectiveStrings(strings.MISSIONS.OBJECTIVE_WIN_PREFIX, true);
    };
    /**
     * @param {Mission} mission
     * @param {Boolean} missionEnded
     * @param {ObjectiveWithState[]} [objectivesState]
     * @param {Number} [index]
     * @returns {Number}
     */
    WinAction.prototype.getObjectivesState = function (mission, missionEnded, objectivesState, index) {
        return this._trigger.getObjectivesState(true, mission, missionEnded, objectivesState, index);
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
     * Returns the number of mission objectives corresponding to this action
     * @returns {Number}
     */
    LoseAction.prototype.getObjectiveCount = function () {
        return this._trigger.getObjectiveCount(false);
    };
    /**
     * @returns {String[]}
     */
    LoseAction.prototype.getObjectiveStrings = function () {
        return this._trigger.getObjectiveStrings(strings.MISSIONS.OBJECTIVE_LOSE_PREFIX, false);
    };
    /**
     * @param {Mission} mission
     * @param {Boolean} missionEnded
     * @param {ObjectiveWithState[]} [objectivesState]
     * @param {Number} [index]
     * @returns {Number}
     */
    LoseAction.prototype.getObjectivesState = function (mission, missionEnded, objectivesState, index) {
        return this._trigger.getObjectivesState(false, mission, missionEnded, objectivesState, index);
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
    /**
     * @param {Object} dataJSON
     * @param {Trigger} trigger 
     * @returns {WinAction|LoseAction|MessageAction|ClearMessagesAction|CommandAction|HUDAction|Action}
     */
    function createAction(dataJSON, trigger) {
        return new (_actionConstructors[dataJSON.type] || Action)(dataJSON, trigger);
    }
    // initialization
    // associating action constructors
    _actionConstructors = {};
    _actionConstructors[ActionType.WIN] = WinAction;
    _actionConstructors[ActionType.LOSE] = LoseAction;
    _actionConstructors[ActionType.MESSAGE] = MessageAction;
    _actionConstructors[ActionType.CLEAR_MESSAGES] = ClearMessagesAction;
    _actionConstructors[ActionType.COMMAND] = CommandAction;
    _actionConstructors[ActionType.HUD] = HUDAction;
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        ActionType: ActionType,
        createAction: createAction
    };
});