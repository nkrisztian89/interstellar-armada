/**
 * Copyright 2014-2018, 2020-2022 Krisztián Nagy
 * @file Provides general functionality to handle various types of user input.
 * Provides a base input interpreter class which can be subclassed for each needed input device to catch and process its inputs, 
 * translating it to actions using a list of bindings added to the interpreter.
 * Also provides a generic controller class can process the actions produced by interpreters and execute functions for each triggered /
 * non triggered action. 
 * Finally, provides a control context class to which interpreters and controllers can be added and which integrates the collection of 
 * actions from interpreters and passing it to the stored controllers.
 * To use this module, create your set of controllers, create your context, add interpreters for the needed input devices to it with your
 * bindings, add your controllers as well and then use the provided methods to start / stop listening for different devices and execute all
 * the functions bound for currently triggered / non-triggered actions by calling control() on the context.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used for the getting key of property value utility function
 * @param application Used for logging and error displaying functionality
 * @param asyncResource ControlContext is a subclass of AsyncResource
 */
define([
    "utils/utils",
    "modules/application",
    "modules/async-resource",
    "modules/strings"
], function (utils, application, asyncResource) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // constants
            DEFAULT_PROFILE_NAME = "default";
    // #########################################################################
    /**
     * @class A generic superclass for classes that represent the bindig of certain controls to an action.
     * A subclass should be created for each specific input device that implements setting, loading, saving,
     * comparing control settings for the binding and checking the action trigger state.
     * @param {Object} dataJSON
     * @param {String} [profileName] The name of the input profile this binding
     * belongs to
     */
    function ControlBinding(dataJSON, profileName) {
        /**
         * Name of the action the stored control is assigned to. {@link Controller}s
         * will process this name and execute the appropriate action.
         * @type String
         */
        this._actionName = null;
        /**
         * The name of the input profile this binding belongs to
         * @type String
         */
        this._profileName = profileName;
        // if a JSON object was specified, initialize the properties from there
        this.loadFromJSON(dataJSON);
    }
    /**
     * Returns the name of the action assigned in this binding. Has to be a name
     * that can be processed by the appropriate {@link Controller}s.
     * @returns {String}
     */
    ControlBinding.prototype.getActionName = function () {
        return this._actionName;
    };
    /**
     * Loads the properties of this binding from a JSON object. Needs to be overridden for each specific binding
     * subclass to load their properties.
     * @param {Object} dataJSON
     */
    ControlBinding.prototype.loadFromJSON = function (dataJSON) {
        this._actionName = dataJSON ? dataJSON.action : null;
    };
    // #########################################################################
    /**
     * @typedef {Object.<String, ControlBinding>} InputProfile
     */
    /**
     * @class A generic common superclass for input interpreters which needs to be subclassed for each different input device.
     * This class provides the common general functionality. The subclasses need to add their model of the input device's state,
     * additional operations for saving / loading its settings and a managing the trigger state check for the stored bindings.
     * @param {Function} bindingClass The constructor function of the binding class this interpreter will use (has te be a subclass
     * of ControlBinding)
     * @param {Object} dataJSON If given, any specific interpreter settings can be loaded from this JSON object
     */
    function InputInterpreter(bindingClass, dataJSON) {
        /**
         * Whether the interpreter is currently listening for input (the event  handlers are set) and is updating
         * the internal state it holds about its input device.
         * A listening interpreter will also disable most default actions for the input device it is listening to.
         * @type Boolean
         */
        this._listening = false;
        /**
         * Whether the interpreter is currently processing the input state it maintains to trigger actions based on its
         * stored binding. If the interpreter is not listening, processing is not possible, but the enabled state can
         * be set and is stored independently.
         * @type Boolean
         */
        this._enabled = true;
        /**
         * The constructor function of the binding class this interpreter uses (a subclass of ControlBinding).
         * @type Function
         */
        this._bindingClass = bindingClass;
        /**
         * Each profile contains control bindings, one profile can be set as the current one to use
         * @type Object.<String, InputProfile>
         */
        this._profiles = {};
        /**
         * The currently selected profile containing the active control bindings
         * @type InputProfile
         */
        this._currentProfile = null;
        /**
         * The string ID (key within the _profiles object) of the currently selected profile
         * @type String
         */
        this._currentProfileName = null;
        /**
         * Associative array of the names of disabled actions. The action names are
         * the keys, and if the corresponding action is disabled, the value is true.
         * Disabled actions are not passed to the controllers for processing, even
         * if they would be triggered user input from the device this interpreter
         * is handles.
         * @type Object
         */
        this._disabledActions = {};
        // if a JSON was specified, initialize the bindings from there
        if (dataJSON !== undefined) {
            this.loadFromJSON(dataJSON);
        }
    }
    /**
     * Returns a descriptive name of the device this interpreter handles to show for the user.
     * @returns {String}
     */
    InputInterpreter.prototype.getDeviceName = function () {
        return "Generic";
    };
    /**
     * Whether the interpreter is currently listening for input (and thus also intercepting it, preventing most default actions)
     * @returns {Boolean}
     */
    InputInterpreter.prototype.isListening = function () {
        return this._listening;
    };
    /**
     * Makes the interpreter start intercepting events related to its input device to update the internal state it stores about it as well
     * as prevent default actions for these events. If the interpreter is also enabled, it will also be able to query it for the list and
     * intensities of the actions that are triggered based on the current input state and its bindings.
     * Needs to be overridden to set add the setting of event handlers and other optional settings.
     */
    InputInterpreter.prototype.startListening = function () {
        if (!this._listening) {
            this.resetState();
            this._listening = true;
        }
    };
    /**
     * The interpreter will stop listening after calling this method, canceling any event handlers related to its input device. Since its
     * stored state of the device will not be updated any more, attempting to get the list of triggered actions will result in an empty
     * array, even if th interpeter is enabled.
     * Needs to be overridden to set add the canceling of event handlers and other optional settings.
     */
    InputInterpreter.prototype.stopListening = function () {
        if (this._listening) {
            this.resetState();
            this._listening = false;
        }
    };
    /**
     * Changes the listening state of the interpreter to its opposite.
     */
    InputInterpreter.prototype.toggleListening = function () {
        if (this._listening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    };
    /**
     * Returns whether the interpreter is currently at enabled state, meaning it can be queried for triggered actions (if it is currently
     * also in listening state)
     * @returns {Boolean}
     */
    InputInterpreter.prototype.isEnabled = function () {
        return this._enabled;
    };
    /**
     * Sets the interpreter to enabled state, in which it will return the list of triggered actions and their intensities when queried,
     * but only if it is also set to listen to events.
     * @returns {Boolean}
     */
    InputInterpreter.prototype.enable = function () {
        this._enabled = true;
    };
    /**
     * Sets the interpreter to disabled state, in which it will not return any triggered actions when queried, even if it is listening
     * to events and keeping its model of the input device state updated.
     * @returns {Boolean}
     */
    InputInterpreter.prototype.disable = function () {
        this._enabled = false;
    };
    /**
     * Changes the enabled state of the interpreter to its opposite.
     */
    InputInterpreter.prototype.toggleEnabled = function () {
        if (this._enabled) {
            this.disable();
        } else {
            this.enable();
        }
    };
    /**
     * Set the profile by its string ID (key). The profile determines the active control bindings
     * @param {String} name
     */
    InputInterpreter.prototype.setProfile = function (name) {
        if (this._profiles.hasOwnProperty(name)) {
            this._currentProfile = this._profiles[name];
            this._currentProfileName = name;
        }
    };
    /**
     * If there is no control bound yet to the action associated with the passed 
     * binding, adds the binding. If there already is a binding, overwrites it with
     * the passed binding, as there can be no two different controls bound to the
     * same action for now. This method is for setting default bindings.
     * @param {ControlBinding} binding
     */
    InputInterpreter.prototype.setBinding = function (binding) {
        this._currentProfile[binding.getActionName()] = binding;
    };
    /**
     * Sets (adds or overwrites) the binding associated with the action of the 
     * passed binding, and also stores the binding in HTML5 local storage. This 
     * method is for setting custom local bindings.
     * @param {Object} dataJSON
     */
    InputInterpreter.prototype.setAndStoreBinding = function (dataJSON) {
        var binding = new this._bindingClass(dataJSON, this._currentProfileName);
        this.setBinding(binding);
        binding.saveToLocalStorage();
    };
    /**
     * Loads the properties of the interpreter such as the (default) bindings
     * from the passed JSON object.
     * @param {Object} dataJSON
     */
    InputInterpreter.prototype.loadFromJSON = function (dataJSON) {
        var i, j, profileName, profile, chain;
        if (dataJSON.profiles) {
            for (profileName in dataJSON.profiles) {
                if (dataJSON.profiles.hasOwnProperty(profileName)) {
                    profile = dataJSON.profiles[profileName];
                    chain = [dataJSON.profiles[profileName].bindings];
                    while (profile.basedOn && dataJSON.profiles.hasOwnProperty(profile.basedOn)) {
                        chain.unshift(dataJSON.profiles[profile.basedOn].bindings);
                        profile = dataJSON.profiles[profile.basedOn];
                    }
                    this._profiles[profileName] = {};
                    this._currentProfile = this._profiles[profileName];
                    for (i = 0; i < chain.length; i++) {
                        for (j = 0; j < chain[i].length; j++) {
                            this.setBinding(new this._bindingClass(chain[i][j], profileName));
                        }

                    }
                }
            }
            this._currentProfile = this._profiles[dataJSON.defaultProfile];
            this._currentProfileName = dataJSON.defaultProfile;
        } else {
            this._profiles[DEFAULT_PROFILE_NAME] = {};
            this._currentProfile = this._profiles[DEFAULT_PROFILE_NAME];
            this._currentProfileName = DEFAULT_PROFILE_NAME;
            for (i = 0; i < dataJSON.bindings.length; i++) {
                this.setBinding(new this._bindingClass(dataJSON.bindings[i], DEFAULT_PROFILE_NAME));
            }
        }
    };
    /**
     * Loads the properties of the interpreter such as the (custom local) bindings
     * from HTML5 local storage.
     */
    InputInterpreter.prototype.loadFromLocalStorage = function () {
        var actionName;
        for (actionName in this._currentProfile) {
            if (this._currentProfile.hasOwnProperty(actionName)) {
                this._currentProfile[actionName].loadFromLocalStorage();
            }
        }
    };
    /**
     * Removes custom bindings stored in HTML5 local storage.
     */
    InputInterpreter.prototype.removeFromLocalStorage = function () {
        var actionName;
        for (actionName in this._currentProfile) {
            if (this._currentProfile.hasOwnProperty(actionName)) {
                this._currentProfile[actionName].removeFromLocalStorage();
            }
        }
    };
    /**
     * Returns a string describing the control assigned to the action with the passed name.
     * @param {String} actionName
     * @returns {String}
     */
    InputInterpreter.prototype.getControlStringForAction = function (actionName) {
        if (this._currentProfile[actionName] !== undefined) {
            return this._currentProfile[actionName].getControlString();
        }
        return "";
    };
    /**
     * @typedef {Object} ActionTrigger
     * @property {String} name
     * @property {Number} [intensity]
     */
    /**
     * Adds a new triggered action to the group that was triggered by the same controls
     * @param {Array} actionsByBindings A list of groups of triggered actions, where each group was triggered by the same controls
     * @param {(ActionTrigger|null)} action
     * @param {Binding} binding The binding that triggered the action
     */
    InputInterpreter.prototype._addActionByBinding = function (actionsByBindings, action, binding) {
        var i;
        if (!action) {
            return;
        }
        for (i = 0; i < actionsByBindings.length; i++) {
            if (binding.bindsTheSameControls(actionsByBindings[i].binding)) {
                actionsByBindings[i].actions.push(action);
                return;
            }
        }
        actionsByBindings.push({
            binding: binding,
            actions: [action]
        });
    };
    /**
     * Disables the action with the given name. While disabled, this action will not
     * be passed to the controllers for processing, even if user input would trigger
     * it.
     * @param {String} actionName
     */
    InputInterpreter.prototype.disableAction = function (actionName) {
        this._disabledActions[actionName] = true;
    };
    /**
     * Enables the action with the given name. (if it was disabled)
     * @param {String} actionName
     */
    InputInterpreter.prototype.enableAction = function (actionName) {
        this._disabledActions[actionName] = false;
    };
    /**
     * Returns the list of currently triggered actions based on the internally stored input device state and the control bindings.
     * @param {Function} [actionFilterFunction] If given, every triggered action will be tested against this function (by passing its name
     * as a parameter), and only added to the resulting list if the function returns true.
     * @returns {Object[][]} The lists of action names and intensities, grouped by the triggering controls (if two actions were triggered
     * by the same controls, they will be in the same array, and the result itself is an array of such arrays. The name (String) property 
     * stores the action's name and the intensity (Number) property the intensity.
     */
    InputInterpreter.prototype.getTriggeredActions = function (actionFilterFunction) {
        var result = [], actionName, actionsByBindings = [], i;
        if (!this.isListening() || !this.isEnabled()) {
            return result;
        }
        for (actionName in this._currentProfile) {
            if (this._currentProfile.hasOwnProperty(actionName)) {
                if (!this._disabledActions[actionName] && (!actionFilterFunction || actionFilterFunction(actionName))) {
                    this._addActionByBinding(actionsByBindings, this.checkAction(actionName), this._currentProfile[actionName]);
                }
            }
        }
        for (i = 0; i < actionsByBindings.length; i++) {
            result.push(actionsByBindings[i].actions);
        }
        return result;
    };
    // #########################################################################
    /**
     * @class Represents an in-game action that can be triggered by the user and a 
     * controller can execute certain functions on methods on their controlled 
     * entities based on whether or not the action is currently triggered.
     * @param {Object} [dataJSON] If given, the properties will be initialized from
     * the data stored in this JSON object.
     */
    function Action(dataJSON) {
        /**
         * The name of the action used to identify it. Has to be unique within the
         * game. Input interpreters generate a list of action names based on what
         * is stored in their bindings, and controllers process this list to execute
         * the actions stored in their recognized action list.
         * @type String
         */
        this._name = null;
        /**
         * A longer, human readable description to be display in the control settings
         * screen.
         * @type String
         */
        this._description = null;
        /**
         * Whether the action is to be continuously executed while being triggered,
         * or only to be executed once a new trigger has been initiated.
         * @type Boolean
         */
        this._continuous = false;
        /**
         * Whether the action is currently being triggered or not.
         * @type Boolean
         */
        this._triggered = false;
        /**
         * If the action is triggered, then with what intensity. The value null
         * corresponds to a trigger without a specific intensity (such as trigger by
         * a key press)
         * @type Number
         */
        this._intensity = this.INTENSITY_NOT_SPECIFIED;
        /**
         * Whether the action has already been executed for the current trigger.
         * (non continuous actions will not fire unless this is reset to false by
         * the end of the current trigger and then a new trigger starts)
         * @type Boolean
         */
        this._executed = false;
        /**
         * Whether the non-triggered action has already been executed after the last trigger.
         * (non continuous actions will not fire their non-trigger continuously either)
         */
        this._nonTriggeredExecuted = true;
        /**
         * The function to execute when the action is triggered.
         * @type Function
         */
        this._executeTriggered = null;
        /**
         * The function to execute when the action is not being triggered.
         * @type Function
         */
        this._executeNonTriggered = null;
        /**
         * If the action is triggered, this refers to the input interpreter that triggered it.
         * @type InputInterpreter
         */
        this._source = null;
        // if a JSON was specified, initialize the properties from there
        if (dataJSON !== undefined) {
            this.loadFromJSON(dataJSON);
        }
    }
    /**
     * Value for the intensity of an action that has not been set in this round
     * @constant 
     * @type Number
     */
    Action.prototype.INTENSITY_NOT_SPECIFIED = -3;
    /**
     * Value for the intensity of an action that has been triggered by a keypress (which does not have fine grades of intensity)
     * @constant 
     * @type Number
     */
    Action.prototype.INTENSITY_KEYPRESS = -2;
    /**
     * Returns the name of this action for identification within the program.
     * @returns {String}
     */
    Action.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the human readable description of this action that can be displayed
     * to the user.
     * @returns {String}
     */
    Action.prototype.getDescription = function () {
        return this._description;
    };
    /**
     * Loads the properties of the action as stored in the passed JSON object.
     * @param {Object} dataJSON
     */
    Action.prototype.loadFromJSON = function (dataJSON) {
        this._name = dataJSON.name;
        this._description = dataJSON.description;
        this._continuous = dataJSON.continuous === true;
        this._triggered = false;
        this._intensity = this.INTENSITY_NOT_SPECIFIED;
        this._executed = false;
        this._nonTriggeredExecuted = true;
    };
    /**
     * Sets the action's trigger state and intensity.
     * @param {Boolean} triggered The new trigger state of the action to be set.
     * @param {Number} intensity The new intensity of the action to be set. Will
     * be ignored if not given. If multiple triggers try to set the intensity, 
     * the highest one or the one with the  without intensity will be considered.
     * @param {InputInterpreter} source The input interpreter that triggered
     * this action
     */
    Action.prototype.setTriggered = function (triggered, intensity, source) {
        this._triggered = triggered;
        if ((intensity !== undefined) && ((this._intensity === this.INTENSITY_NOT_SPECIFIED) || ((this._intensity >= 0) && intensity > this._intensity))) {
            this._intensity = intensity;
        } else if (intensity === undefined) {
            this._intensity = this.INTENSITY_KEYPRESS;
        }
        this._source = source;
    };
    /**
     * Sets the function to be executed when the action is triggered.
     * @param {Function} executeTriggered
     */
    Action.prototype.setExecuteTriggered = function (executeTriggered) {
        this._executeTriggered = executeTriggered;
    };
    /**
     * Sets the function to be executed when the action is not triggered. (or has
     * already been executed for this trigger, if it is not continuous)
     * @param {Function} executeNonTriggered
     */
    Action.prototype.setExecuteNonTriggered = function (executeNonTriggered) {
        this._executeNonTriggered = executeNonTriggered;
    };
    /**
     * Executes the appropriate function based on whether the action is currently
     * triggered and if it is continuous. For continuous actions, the {@link Action#_executeTriggered}
     * function is executed continuously while the trigger lasts, whereas for 
     * non-continuous actions, it is executed once a new trigger starts. In any other
     * case, the {@link Action#_executeNonTriggered} function is executed. It also
     * resets the trigger state of the action.
     */
    Action.prototype.execute = function () {
        if (this._continuous === true) {
            if (this._triggered === true) {
                if (this._executeTriggered !== null) {
                    this._executeTriggered((this._intensity >= 0) ? this._intensity : undefined, this._source);
                }
            } else {
                if (this._executeNonTriggered !== null) {
                    this._executeNonTriggered();
                }
            }
        } else {
            if ((this._triggered === true) && (this._executed === false)) {
                if (this._executeTriggered !== null) {
                    this._executeTriggered((this._intensity >= 0) ? this._intensity : undefined, this._source);
                }
                this._executed = true;
            } else {
                if ((this._triggered === false) && (this._nonTriggeredExecuted === false)) {
                    if (this._executeNonTriggered !== null) {
                        this._executeNonTriggered();
                    }
                    this._nonTriggeredExecuted = true;
                }
                if (this._triggered === false) {
                    this._executed = false;
                } else {
                    this._nonTriggeredExecuted = false;
                }
            }
        }
        // We cancel the trigger after every execution. Before calling this function
        // the appropriate triggers have to be set by checking the current inputs.
        this._triggered = false;
        this._intensity = this.INTENSITY_NOT_SPECIFIED;
    };
    // #########################################################################
    /**
     * @class The superclass for all controllers. A controller is responsible for
     * processing triggered actions sent by the input interpreters and applying
     * them to the domain (entity) it is controlling. Controllers for different
     * domains are implemented as the subclasses for this class.
     * @param {Object} [dataJSON] If given, the properties will be initialized loading
     * the data from this JSON object
     */
    function Controller(dataJSON) {
        /**
         * A reference to the control context this controller has been added to.
         * @type ControlContext
         */
        this._context = null;
        /**
         * The associative array of the actions recognized by the controller. The keys
         * are the names of the actions, while the values are the {@link Action}s
         * themselves.
         * @type Object
         */
        this._actions = {};
        // if a JSON object was specified, initialize the properties from there
        if (dataJSON !== undefined) {
            this.loadFromJSON(dataJSON);
        }
    }
    /**
     * Sets the referenced control context for this controller. Call when it is added to the context.
     * @param {ControlContext} value
     */
    Controller.prototype.setContext = function (value) {
        this._context = value;
    };
    /**
     * Returns an array containing all the actions that are recognized by this controller.
     * @returns {Action[]}
     */
    Controller.prototype.getActions = function () {
        var result = [], actionName;
        for (actionName in this._actions) {
            if (this._actions.hasOwnProperty(actionName)) {
                result.push(this._actions[actionName]);
            }
        }
        return result;
    };
    /**
     * Loads the properties of the controller as stored in the passed JSON object.
     * @param {Object} dataJSON
     */
    Controller.prototype.loadFromJSON = function (dataJSON) {
        var i, actionData;
        for (i = 0; i < dataJSON.actions.length; i++) {
            actionData = dataJSON.actions[i];
            if (!actionData.debug || application.isDebugVersion()) {
                this._actions[actionData.name] = new Action(actionData);
            }
        }
    };
    /**
     * Assigns the given function to the action with the given name. After this,
     * the function will be executed whenever the action with the given name is
     * triggered or when it is not triggered, depending on the value of the 'triggered'
     * parameter.
     * @param {String} actionName The name of the action for the function to be
     * associated with.
     * @param {Boolean} triggered The function will be executed whenever the trigger
     * state of the action is the same as this value.
     * @param {Function} actionFunction The function to be assigned to the triggered/
     * non-triggered state of the action.
     */
    Controller.prototype.setActionFunction = function (actionName, triggered, actionFunction) {
        if (this._actions[actionName]) {
            if (triggered === true) {
                this._actions[actionName].setExecuteTriggered(actionFunction);
            } else {
                this._actions[actionName].setExecuteNonTriggered(actionFunction);
            }
        } else {
            application.showError("Attempting to initialize action '" + actionName + "', but no such action was defined " +
                    "for '" + this.getType() + "' type controllers.",
                    application.ErrorSeverity.SEVERE,
                    "The action definition might be missing from the " +
                    "settings file, or the settings file has not been loaded properly. The game is still playable, " +
                    "but this action will not work until the error with the settings file is corrected and the game " +
                    "is restarted.");
        }
    };
    /**
     * Associates the given function to the on and off trigger states of the action
     * with the given name
     * @param {String} actionName The name of the action for the functions to be
     * associated with.
     * @param {Function} functionWhenTriggered The function to execute when the
     * action is triggered.
     * @param {Function} functionWhenNotTriggered The function to execute when the
     * action is not triggered.
     */
    Controller.prototype.setActionFunctions = function (actionName, functionWhenTriggered, functionWhenNotTriggered) {
        this.setActionFunction(actionName, true, functionWhenTriggered);
        this.setActionFunction(actionName, false, functionWhenNotTriggered);
    };
    /**
     * Executes the list of passed actions. If an action is passed more times, this
     * will still execute it only once.
     * @param {Object[][]} triggeredActions The grouped lists of actions in the form of objects
     * where the 'name' (String) property identifies the name of the action and the
     * (optional) 'intensity' (Number) property determines the intensity with which
     * the action is to be executed. Actions that have been triggered by the same controls should
     * be grouped together, and therefore this method expects an array of arrays.
     */
    Controller.prototype.executeActions = function (triggeredActions) {
        var i, j, actionName, actionIntensity, actionSource;
        // first we go through the groups of actions
        for (i = 0; i < triggeredActions.length; i++) {
            // in each group, if there are multiple actions that this controller can handle then choose the one with the highest intensity
            // e.g. movement or turning in opposite directions can appear here together if bound to the same axis, but one will have an
            // intensity of 0
            actionName = null;
            actionIntensity = -1;
            actionSource = null;
            for (j = 0; j < triggeredActions[i].length; j++) {
                if (this._actions[triggeredActions[i][j].name] !== undefined) {
                    // non-graded (undefined) intensity always beats the graded ones
                    if (((triggeredActions[i][j].intensity !== undefined) && (actionIntensity !== undefined) && (triggeredActions[i][j].intensity > actionIntensity)) ||
                            ((actionIntensity !== undefined) && (triggeredActions[i][j].intensity === undefined))) {
                        actionName = triggeredActions[i][j].name;
                        actionIntensity = triggeredActions[i][j].intensity;
                        actionSource = triggeredActions[i][j].source;
                    }
                }
            }
            // if an action was chosen, set its trigger, but only if it has a non-zero intensity - e.g. turning in opposite directions can
            // both appear as 0 intensity actions (if bound to the same axis), to indicate that the axis is occupied with those actions even
            // if no turning has been triggered at the moment - this is why here this action group is cleared here anyway, to ensure that lower
            // priority controllers will not receive their conflicting actions from the same group
            if (actionName) {
                if ((actionIntensity === undefined) || (actionIntensity > 0)) {
                    this._actions[actionName].setTriggered(true, actionIntensity, actionSource);
                }
                triggeredActions[i] = [];
            }
        }
        // Execute all the stored actions, each exactly once.
        for (actionName in this._actions) {
            if (this._actions.hasOwnProperty(actionName)) {
                this._actions[actionName].execute();
            }
        }
    };
    // #########################################################################
    /**
     * @class A control context holds interpreter objects that translate the user 
     * input coming from different devices (such as keyboard or mouse) into actions,
     * and the controllers that can process those actions and execute the appropriate
     * methods of in-game entities they control.
     * @extends AsyncResource
     */
    function ControlContext() {
        asyncResource.AsyncResource.call(this);
        /**
         * The JSON object wich stores the control settings.
         * @type Object
         */
        this._dataJSON = null;
        /**
         * An associative array storing the input interpreter constructor functions of the recognized interpreter types that
         * can be initialized from JSON by this context. The keys are the names by which the interpreter type has to be referred to
         * in the JSON object.
         * @type Object.<String, Function>
         */
        this._inputInterpreterTypes = {};
        /**
         * The array of input interpreters wich collect the user input from different
         * devices (each interpreter is capable of querying one device) and translate
         * them into actions that can be processed by the controllers.
         * @type InputInterpreter[]
         */
        this._inputInterpreters = null;
        /**
         * An associative array of the stored input interpreters organized by a string representation of their types so that
         * they can be accessed by it quickly.
         * @type Object.<String, InputInterpreter>
         */
        this._inputInterpretersByType = {};
        /**
         * An associative array storing the controller constructor functions of the recognized controller types that
         * can be loaded from JSON by this context. The keys are the names by which the controller type has to be referred to
         * in the JSON object.
         * @type Object.<String, Function>
         */
        this._controllerTypes = {};
        /**
         * The list of controllers, which control various entities found in the game.
         * @type Controller[]
         */
        this._controllers = null;
        /**
         * Has the same references to controllers as the _controllers field, but in the current priority order (when multiple actions are
         * triggered by the same controls, the action of the controller coming first in the priority queue will be executed)
         * @type Controller[]
         */
        this._controllersPriorityQueue = null;
        /**
         * An associative array of the stored controllers organized by a string representation of their types so that
         * they can be accessed by it quickly.
         * @type Object.<String, Controller>
         */
        this._controllersByType = {};
        /**
         * Whether the control context is currently listening for user input (through
         * its interpreter objects).
         * @type Boolean
         */
        this._listening = false;
        /**
         * Associative array of the names of disabled actions. The action names are
         * the keys, and if the corresponding action is disabled, the value is true.
         * Disabled actions are not passed to the controllers for processing, even
         * if they would be triggered user input.
         * @type Object
         */
        this._disabledActions = {};
    }
    ControlContext.prototype = new asyncResource.AsyncResource();
    ControlContext.prototype.constructor = ControlContext;
    /**
     * Registers the input interpreter constructor function of the given intepreter type so that from this point on interpreter of such type
     * can be added or initialized from JSON when loading this context. The interpreter type has to be identified by the same name
     * in the JSON as given here.
     * @param {String} inputInterpreterTypeName
     * @param {Function} inputInterpreterTypeConstructor
     */
    ControlContext.prototype.registerInputInterpreterType = function (inputInterpreterTypeName, inputInterpreterTypeConstructor) {
        this._inputInterpreterTypes[inputInterpreterTypeName] = inputInterpreterTypeConstructor;
    };
    /**
     * Adds a new input interpreter to the list of interpreters that are used to
     * collect user input from supported devices and translate it to action name /
     * intensity pairs. It is only allowed to add interpreters of previously registered
     * types.
     * @param {InputInterpreter} inputInterpreter
     */
    ControlContext.prototype.addInputInterpreter = function (inputInterpreter) {
        var interpreterTypeName = utils.getKeyOfValue(this._inputInterpreterTypes, inputInterpreter.constructor);
        if (interpreterTypeName) {
            this._inputInterpreters.push(inputInterpreter);
            // saving another reference for easier access
            this._inputInterpretersByType[interpreterTypeName] = inputInterpreter;
        } else {
            application.showError(
                    "Attempting to add an input interpreter of an unregistered type to the control context!",
                    application.ErrorSeverity.SEVERE,
                    "Interpreter type: " + inputInterpreter.constructor.name);
        }
    };
    /**
     * Returns the list of current input interpreters.
     * @returns {InputInterpreter[]}
     */
    ControlContext.prototype.getInputInterpreters = function () {
        return this._inputInterpreters;
    };
    /**
     * Returns the stored intepreter of the given type. (indicating the input device)
     * @param {String} interpreterTypeName The same name that was used when registering this type 
     * @return {InputInterpreter}
     */
    ControlContext.prototype.getInputInterpreter = function (interpreterTypeName) {
        if (this._inputInterpretersByType[interpreterTypeName]) {
            return this._inputInterpretersByType[interpreterTypeName];
        }
        application.showError("Asked for a interpreter of type '" + interpreterTypeName + "', which does not exist!");
        return null;
    };
    /**
     * Registers the constructor function of the given controller type so that from this point on controllers of such type
     * can be added or initialized from JSON when loading this context. The controller type has to be identified by the same name
     * in the JSON as given here.
     * @param {String} controllerTypeName
     * @param {Function} controllerTypeConstructor
     */
    ControlContext.prototype.registerControllerType = function (controllerTypeName, controllerTypeConstructor) {
        this._controllerTypes[controllerTypeName] = controllerTypeConstructor;
    };
    /**
     * Adds a new controller to the list of controllers that are used to process actions translated by the input interpreters. 
     * It is only allowed to add controllers of previously registered types.
     * @param {Controller} controller
     */
    ControlContext.prototype.addController = function (controller) {
        var controllerTypeName = utils.getKeyOfValue(this._controllerTypes, controller.constructor);
        if (controllerTypeName) {
            this._controllers.push(controller);
            // saving another reference for easier access
            this._controllersByType[controllerTypeName] = controller;
            controller.setContext(this);
        } else {
            application.showError(
                    "Attempting to add a controller of an unregistered type to the control context!",
                    application.ErrorSeverity.SEVERE,
                    "Controller type: " + controller.prototype.constructor.name);
        }
    };
    /**
     * Returns the list of all controllers stored in the control context. This can
     * be used to display the available controls for all controllers on the control
     * settings screen.
     * @returns {Controller[]}
     */
    ControlContext.prototype.getControllers = function () {
        return this._controllers;
    };
    /**
     * Returns the stored controller of the given type.
     * @param {String} controllerTypeName The same name that was used when registering this type 
     * @return {Controller}
     */
    ControlContext.prototype.getController = function (controllerTypeName) {
        if (this._controllersByType[controllerTypeName]) {
            return this._controllersByType[controllerTypeName];
        }
        application.showError("Asked for a controller of type '" + controllerTypeName + "', which does not exist!");
        return null;
    };
    /**
     * Makes the passed controller the first in the priority queue, so that if one control would trigger actions of two different 
     * controllers, one of them being the passed controller, the action belonging to it will be executed. Can only be used with controllers
     * that have been previously added to the context, calling it with a different controller will have no effect. The other controllers
     * remain in the default priority order.
     * @param {Controller} controller
     */
    ControlContext.prototype.makeControllerPriority = function (controller) {
        var i;
        this._controllersPriorityQueue = [];
        for (i = 0; i < this._controllers.length; i++) {
            if (this._controllers[i] === controller) {
                this._controllersPriorityQueue.push(this._controllers[i]);
                break;
            }
        }
        for (i = 0; i < this._controllers.length; i++) {
            if (this._controllers[i] !== controller) {
                this._controllersPriorityQueue.push(this._controllers[i]);
            }
        }
    };
    /**
     * Returns whether the (/ a) controller with the given type name is th first in the controller priority queue.
     * @param {String} controllerTypeName
     * @returns {Boolean}
     */
    ControlContext.prototype.isControllerPriority = function (controllerTypeName) {
        return (this._controllersPriorityQueue.length > 0) && (this._controllersPriorityQueue[0] === this.getController(controllerTypeName));
    };
    /**
     * Resets the default priority order of the stored controllers (the order in which they were added).
     */
    ControlContext.prototype.restoreDefaultControllerPriorityOrder = function () {
        this._controllersPriorityQueue = this._controllers;
    };
    /**
     * Disables the action with the given name. While disabled, this action will not
     * be passed to the controllers for processing, even if user input would trigger
     * it.
     * @param {String} actionName
     */
    ControlContext.prototype.disableAction = function (actionName) {
        this._disabledActions[actionName] = true;
    };
    /**
     * Enables the action with the given name.
     * @param {String} actionName
     */
    ControlContext.prototype.enableAction = function (actionName) {
        this._disabledActions[actionName] = false;
    };
    /**
     * Executes the main control flow: gathers all the triggered and non-disabled 
     * actions translated  by the stored input interpreters and processes them using 
     * all stored controllers.
     * @param {Number} dt The time elapsed since the last control step, in milliseconds.
     */
    ControlContext.prototype.control = function (dt) {
        var
                i,
                triggeredActions,
                actionFilterFunction = function (actionName) {
                    return !this._disabledActions[actionName];
                }.bind(this);
        if (this._listening) {
            triggeredActions = [];
            for (i = 0; i < this._inputInterpreters.length; i++) {
                triggeredActions = triggeredActions.concat(this._inputInterpreters[i].getTriggeredActions(actionFilterFunction));
            }
            for (i = 0; i < this._controllersPriorityQueue.length; i++) {
                this._controllersPriorityQueue[i].executeActions(triggeredActions, dt);
            }
        }
    };
    /**
     * Loads the control configuration (the controllers) stored in a JSON object.
     * @param {Object} dataJSON The JSON object that stores the control settings.
     */
    ControlContext.prototype.loadConfigurationFromJSON = function (dataJSON) {
        var i, n;
        this._controllers = [];
        for (i = 0, n = dataJSON.controllers.length; i < n; i++) {
            if (this._controllerTypes[dataJSON.controllers[i].type]) {
                this.addController(new this._controllerTypes[dataJSON.controllers[i].type](dataJSON.controllers[i]));
            } else {
                application.showError("Attempting to load unregistered controller type: '" + dataJSON.controllers[i].type + "'!",
                        application.ErrorSeverity.SEVERE,
                        (Object.keys(this._controllerTypes).length > 0) ?
                        ("Every controller to be loaded must be of one of the registered types: " + Object.keys(this._controllerTypes).join(", ") + ".") :
                        "There are no types registered and thus loading controllers is not possible.");
            }
        }
        this._controllersPriorityQueue = this._controllers;
    };
    /**
     * Loads the control settings (input interpreters with bindings) stored in a JSON object.
     * @param {Object} dataJSON The JSON object that stores the control settings.
     * @param {Boolean} [onlyRestoreSettings=false] Whether to only restore the
     * default settings by overwriting the changed ones from the data in the JSON,
     * or to initialize the whole context from zero, creating all the necessary
     * objects.
     */
    ControlContext.prototype.loadSettingsFromJSON = function (dataJSON, onlyRestoreSettings) {
        var i, n;
        // if a whole new initialization is needed, create and load all controllers
        // and interpreters from the JSON
        if (!onlyRestoreSettings) {
            this._dataJSON = dataJSON;
            this._inputInterpreters = [];
            for (i = 0, n = dataJSON.inputDevices.length; i < n; i++) {
                if (this._inputInterpreterTypes[dataJSON.inputDevices[i].type]) {
                    this.addInputInterpreter(new this._inputInterpreterTypes[dataJSON.inputDevices[i].type](dataJSON.inputDevices[i]));
                } else if (!dataJSON.inputDevices[i].optional) {
                    application.showError("Attempting to load unregistered input device type: '" + dataJSON.inputDevices[i].type + "'!",
                            application.ErrorSeverity.SEVERE,
                            (Object.keys(this._inputInterpreterTypes).length > 0) ?
                            ("Every input device interpreter to be loaded must be of one of the registered types: " + Object.keys(this._inputInterpreterTypes).join(", ") + ".") :
                            "There are no types registered and thus loading input interpreters is not possible.");
                }
            }
            // if only the defaults need to be restored, go through the stored interpreters 
            // and delete their custom bindings as well as reload their default from the JSON
        } else {
            for (i = 0, n = dataJSON.inputDevices.length; i < n; i++) {
                if (this._inputInterpreterTypes[dataJSON.inputDevices[i].type]) {
                    this._inputInterpreters[i].removeFromLocalStorage();
                    this._inputInterpreters[i].loadFromJSON(dataJSON.inputDevices[i]);
                }
            }
        }
    };
    /**
     * Load custom settings for the stored input interpreters from HTML5 local storage.
     */
    ControlContext.prototype.loadSettingsFromLocalStorage = function () {
        var i;
        for (i = 0; i < this._inputInterpreters.length; i++) {
            this._inputInterpreters[i].loadFromLocalStorage();
        }
        this.setToReady();
    };
    /**
     * Restore the default settings stored in the JSON object from where they were originally
     * loaded.
     */
    ControlContext.prototype.restoreDefaults = function () {
        this.loadSettingsFromJSON(this._dataJSON, true);
    };
    /**
     * Activate all event handlers that listen for user inputs for each stored input
     * interpreter.
     */
    ControlContext.prototype.startListening = function () {
        this.executeWhenReady(function () {
            var i;
            for (i = 0; i < this._inputInterpreters.length; i++) {
                this._inputInterpreters[i].startListening();
            }
            this._listening = true;
        });
    };
    /**
     * Cancel all event handlers that listen for user input for each stored input interpreter.
     */
    ControlContext.prototype.stopListening = function () {
        this.executeWhenReady(function () {
            var i;
            for (i = 0; i < this._inputInterpreters.length; i++) {
                this._inputInterpreters[i].stopListening();
            }
            this._listening = false;
        });
    };
    /**
     * Returns whether the context is currently set to listen for user input through its interpreters.
     * @returns {Boolean}
     */
    ControlContext.prototype.isListening = function () {
        return this._listening;
    };
    /**
     * Sets the screen center to the given coordinates for all input interpreters
     * that need this data (e.g. mouse control interpreter for control based on relative 
     * pointer position)
     * @param {Number} x The X coordinate of the center.
     * @param {Number} y The Y coordinate of the center.
     */
    ControlContext.prototype.setScreenCenter = function (x, y) {
        this.executeWhenReady(function () {
            var i;
            for (i = 0; i < this._inputInterpreters.length; i++) {
                if (this._inputInterpreters[i].setScreenCenter) {
                    this._inputInterpreters[i].setScreenCenter(x, y);
                }
            }
        });
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        ControlBinding: ControlBinding,
        InputInterpreter: InputInterpreter,
        Controller: Controller,
        ControlContext: ControlContext
    };
});
