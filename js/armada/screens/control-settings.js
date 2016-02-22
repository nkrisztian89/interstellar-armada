/* 
 * Copyright (C) 2016 krisztian
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, document */

define([
    "utils/utils",
    "modules/screens",
    "modules/game",
    "armada/control"
], function (utils, screens, game, control) {
    "use strict";

    /**
     * Defines a controls screen object.
     * @class Represents the controls screen, where the user can set up the game
     * controls.
     * @extends screens.HTMLScreen
     * @param {String} name @see GameScreen
     * @param {String} source @see GameScreen
     * @returns {ControlsScreen}
     */
    function ControlsScreen(name, source) {
        screens.HTMLScreen.call(this, name, source);
        this._backButton = this.registerSimpleComponent("backButton");
        this._defaultsButton = this.registerSimpleComponent("defaultsButton");
        /**
         * The name of the action currently being set (to get triggered by a new 
         * key). If null, the user is not setting any actions.
         * @type String
         */
        this._actionUnderSetting = null;
        /**
         * While the user sets a new key, this property tells if shift is pressed
         * down.
         * @type Boolean
         */
        this._settingShiftState = false;
        /**
         * While the user sets a new key, this property tells if control is pressed
         * down.
         * @type Boolean
         */
        this._settingCtrlState = false;
        /**
         * While the user sets a new key, this property tells if alt is pressed
         * down.
         * @type Boolean
         */
        this._settingAltState = false;
    }

    ControlsScreen.prototype = new screens.HTMLScreen();
    ControlsScreen.prototype.constructor = ControlsScreen;

    /**
     * Refreshes the cell showing the currently set key for the given action in the
     * UI. (call after the key has changed)
     * @param {String} actionName
     */
    ControlsScreen.prototype.refreshKeyForAction = function (actionName) {
        document.getElementById(actionName).innerHTML = control.getInputInterpreter("keyboard").getControlStringForAction(actionName); //TODO: hardcoded
        document.getElementById(actionName).className = "clickable";
    };

    /**
     * Handler for the keydown event to be active while the user is setting a new key
     * for an action. Updates the shift, control and alt states if one of those keys
     * is pressed, so that key combinations such as "ctrl + left" can be set.
     * @param {KeyboardEvent} event
     */
    ControlsScreen.prototype.handleKeyDownWhileSetting = function (event) {
        if (event.keyCode === 16) {
            this._settingShiftState = true;
        }
        if (event.keyCode === 17) {
            this._settingCtrlState = true;
        }
        if (event.keyCode === 18) {
            this._settingAltState = true;
        }
    };

    /**
     * Handler for the keyp event to be active while the user is setting a new key
     * for an action. This actually sets the key to the one that has been released,
     * taking into account the shift, control and alt states as well.
     * @param {KeyboardEvent} event
     */
    ControlsScreen.prototype.handleKeyUpWhileSetting = function (event) {
        // if we released shift, ctrl or alt, update their state
        if (event.keyCode === 16) {
            this._settingShiftState = false;
        } else if (event.keyCode === 17) {
            this._settingCtrlState = false;
        } else if (event.keyCode === 18) {
            this._settingAltState = false;
        }
        // respect the shift, ctrl, alt states and set the new key for the action
        var interpreter = control.getInputInterpreter("keyboard");
        interpreter.setAndStoreBinding(new control.KeyBinding(
                this._actionUnderSetting,
                utils.getKeyOfCode(event.keyCode),
                this._settingShiftState,
                this._settingCtrlState,
                this._settingAltState));
        this.stopKeySetting();
    };

    /**
     * Cancels an ongoing key setting by updating the internal state, refreshing the
     * UI (cancelling highlight and restoring it to show the original key) and cancelling
     * key event handlers.
     */
    ControlsScreen.prototype.stopKeySetting = function () {
        if (this._actionUnderSetting !== null) {
            this.refreshKeyForAction(this._actionUnderSetting);
            this._actionUnderSetting = null;
            document.onkeydown = null;
            document.onkeyup = null;
        }
    };

    /**
     * Starts setting a new key for an action. Highlights the passed element and
     * sets up the key event handlers to update the action represented by this
     * element.
     * @param {Element} tdElement
     */
    ControlsScreen.prototype.startKeySetting = function (tdElement) {
        var actionName = tdElement.getAttribute("id");
        // if we are already in the process of setting this action, just cancel it,
        // so setting an action can be cancelled by clicking on the same cell again
        if (this._actionUnderSetting === actionName) {
            this.stopKeySetting();
            // otherwise cancel if we are in a process of setting another action, and 
            // then start setting this one
        } else {
            this.stopKeySetting();
            this._actionUnderSetting = actionName;
            tdElement.innerHTML = "?";
            tdElement.className = "highlightedItem";
            this._settingShiftState = false;
            this._settingCtrlState = false;
            this._settingAltState = false;
            document.onkeydown = function (event) {
                this.handleKeyDownWhileSetting(event);
            }.bind(this);
            document.onkeyup = function (event) {
                this.handleKeyUpWhileSetting(event);
            }.bind(this);
        }
    };

    /**
     * Initializes the buttons and adds the table showing the current control settings.
     */
    ControlsScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);

        this._backButton.getElement().onclick = function () {
            this.stopKeySetting();
            if (game.getScreen().isSuperimposed()) {
                game.closeSuperimposedScreen();
            } else {
                game.setScreen('settings'); //TODO: hardcoded
            }
            return false;
        }.bind(this);
        this._defaultsButton.getElement().onclick = function () {
            this.stopKeySetting();
            control.restoreDefaults();
            this.generateTables();
            return false;
        }.bind(this);

        this.generateTables();
    };

    /**
     * Adds the table showing available actions and their assigned keys as well as
     * sets up a click handler for the cells showing the keys to initiate a change
     * of that key binding.
     */
    ControlsScreen.prototype.generateTables = function () {
        control.executeWhenReady(function () {
            var i, j, k, n,
                    tablesContainer = document.getElementById(this._name + "_tablesContainer"),
                    gameControllers = control.getControllers(),
                    h2Element, tableElement, theadElement, thElement, tbodyElement, actions, trElement, td1Element, td2Element,
                    keySetterFunction = function (self) {
                        return function () {
                            self.startKeySetting(this);
                        };
                    };
            tablesContainer.innerHTML = "";
            for (i = 0; i < gameControllers.length; i++) {
                h2Element = document.createElement("h2");
                h2Element.innerHTML = gameControllers[i].getType() + " controls";
                tablesContainer.appendChild(h2Element);
                tableElement = document.createElement("table");
                tableElement.className = "horizontallyCentered outerContainer";
                theadElement = document.createElement("thead");
                for (j = 0, n = control.getInputInterpreters().length; j < n; j++) {
                    thElement = document.createElement("th");
                    thElement.innerHTML = control.getInputInterpreters()[j].getDeviceName();
                    theadElement.appendChild(thElement);
                }
                theadElement.innerHTML += "<th>Action</th>";
                tbodyElement = document.createElement("tbody");
                actions = gameControllers[i].getActions();
                for (j = 0; j < actions.length; j++) {
                    trElement = document.createElement("tr");
                    for (k = 0, n = control.getInputInterpreters().length; k < n; k++) {
                        td1Element = document.createElement("td");
                        if (control.getInputInterpreters()[k].getDeviceName() === "Keyboard") {
                            td1Element.setAttribute("id", actions[j].getName());
                            td1Element.className = "clickable";
                            td1Element.onclick = keySetterFunction(this);
                        }
                        td1Element.innerHTML = control.getInputInterpreters()[k].getControlStringForAction(actions[j].getName());
                        trElement.appendChild(td1Element);
                    }
                    td2Element = document.createElement("td");
                    td2Element.innerHTML = actions[j].getDescription();
                    trElement.appendChild(td2Element);
                    tbodyElement.appendChild(trElement);
                }
                tableElement.appendChild(theadElement);
                tableElement.appendChild(tbodyElement);
                tablesContainer.appendChild(tableElement);
            }
        }.bind(this));
    };

    return {
        ControlsScreen: ControlsScreen
    };
});