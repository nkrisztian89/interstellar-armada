/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file Provides functionality to load and access control configuration and settings for Interstellar Armada.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, Element, localStorage, document, window, navigator */

/**
 * @param control This module builds its game-specific functionality on the general control module
 * @param cameraController This module uses the CameraController class made for BudaScene
 * @param game To access screen-changing functionality
 */
define([
    "modules/control",
    "modules/camera-controller",
    "modules/game"
], function (control, cameraController, game) {
    "use strict";
    var
            /**
             * The context storing the current control settings (controllers, input interpreters) that can be accessed through the interface of this module
             * @type ArmadaControlContext
             */
            _context;
    control.setModulePrefix("interstellarArmada_control_");
    // #########################################################################
    /**
     * Creates a general controller object.
     * @class The general controller processes and executes the actions that are related
     * to general game control during a battle, (such as 'pause' or 'quit') and not 
     * associated with any particular object.
     * @param {Object} dataJSON The JSON object which contains the data to load the properties
     * of the recognized actions from.
     * @returns {GeneralController}
     */
    function GeneralController(dataJSON) {
        control.Controller.call(this, dataJSON);
        /**
         * The level which this controller controls.
         * @type Level
         */
        this._level = null;
        // The superclass constructor above loads the data from the JSON, so all action
        // properties should be have been created by now.
        // quitting to the menu
        this.setActionFunction("quit", true, function () {
            game.getScreen().pauseBattle();
            game.setScreen("ingameMenu", true, [0.25, 0.25, 0.25, 0.5]);
        });
        // pausing the game
        this.setActionFunction("pause", true, function () {
            // showing an info box automatically pauses the game as implemented in
            // the BattleScreen class
            game.getScreen().showMessage("Game paused.");
        });
        this.setActionFunction("stopTime", true, function () {
            game.getScreen().toggleTime();
        });
        // switching to pilot mode
        this.setActionFunction("switchToPilotMode", true, function () {
            _context.switchToPilotMode(this._level.getPilotedSpacecraft());
        }.bind(this));
        // switching to spectator mode
        this.setActionFunction("switchToSpectatorMode", true, function () {
            _context.switchToSpectatorMode(true);
        });
        // toggling the visibility of hitboxes
        this.setActionFunction("toggleHitboxVisibility", true, function () {
            this._level.toggleHitboxVisibility();
        }.bind(this));
        // toggling the visibility of texts on screen
        this.setActionFunction("toggleTextVisibility", true, function () {
            game.getScreen().toggleTextVisibility();
        });
        // toggling the mouse controls
        this.setActionFunction("toggleMouseControls", true, function () {
            _context.getInputInterpreter("mouse").toggleEnabled();
            if (_context.isInPilotMode()) {
                if (_context.getInputInterpreter("mouse").isEnabled()) {
                    document.body.style.cursor = 'crosshair';
                } else {
                    document.body.style.cursor = 'default';
                }
            }
        });
        // toggling the joystick controls
        this.setActionFunction("toggleJoystickControls", true, function () {
            _context.getInputInterpreter("joystick").toggleEnabled();
        });
    }
    GeneralController.prototype = new control.Controller();
    GeneralController.prototype.constructor = GeneralController;
    /**
     * Returns the string representation of the type (domain) of the controller.
     * This will be shown to users on the control settings page, which groups controls
     * based on domains.
     * @returns {String}
     */
    GeneralController.prototype.getType = function () {
        return "General";
    };
    /**
     * Sets the controlled level to the one passed as parameter.
     * @param {Level} level
     */
    GeneralController.prototype.setLevel = function (level) {
        this._level = level;
    };
    // #########################################################################
    /**
     * Creates a fighter controller object.
     * @class The fighter controller pocesses and executes the actions with which
     * the user can control a space fighter.
     * @extends Controller
     * @param {Object} dataJSON The JSON object which contains the data to load the properties
     * of the recognized actions from.
     * @returns {FighterController}
     */
    function FighterController(dataJSON) {
        control.Controller.call(this, dataJSON);
        /**
         * A reference to the spacecraft (fighter) which this controller controls.
         * @type Spacecraft
         */
        this._controlledSpacecraft = null;
        // The superclass constructor above loads the data from the JSON, so all action
        // properties should have been created
        // fire the primary weapons of the fighter
        this.setActionFunction("fire", true, function () {
            this._controlledSpacecraft.fire();
        }.bind(this));
        // changing flight mode (free or compensated)
        this.setActionFunction("changeFlightMode", true, function () {
            this._controlledSpacecraft.changeFlightMode();
        }.bind(this));
        // switch to next target
        this.setActionFunction("nextTarget", true, function () {
            this._controlledSpacecraft.targetNext();
        }.bind(this));
        // forward burn
        this.setActionFunctions("forward", function (i) {
            this._controlledSpacecraft.forward(i);
        }.bind(this), function () {
            this._controlledSpacecraft.stopForward();
        }.bind(this));
        // reverse burn
        this.setActionFunctions("reverse", function (i) {
            this._controlledSpacecraft.reverse(i);
        }.bind(this), function () {
            this._controlledSpacecraft.stopReverse();
        }.bind(this));
        // strafing to left and right
        this.setActionFunctions("strafeLeft", function (i) {
            this._controlledSpacecraft.strafeLeft(i);
        }.bind(this), function () {
            this._controlledSpacecraft.stopLeftStrafe();
        }.bind(this));
        this.setActionFunctions("strafeRight", function (i) {
            this._controlledSpacecraft.strafeRight(i);
        }.bind(this), function () {
            this._controlledSpacecraft.stopRightStrafe();
        }.bind(this));
        // strafing up and down
        this.setActionFunctions("raise", function (i) {
            this._controlledSpacecraft.raise(i);
        }.bind(this), function () {
            this._controlledSpacecraft.stopRaise();
        }.bind(this));
        this.setActionFunctions("lower", function (i) {
            this._controlledSpacecraft.lower(i);
        }.bind(this), function () {
            this._controlledSpacecraft.stopLower();
        }.bind(this));
        // resetting speed to 0
        this.setActionFunction("resetSpeed", true, function () {
            this._controlledSpacecraft.resetSpeed();
        }.bind(this));
        // turning along the 3 axes
        this.setActionFunction("yawLeft", true, function (i) {
            this._controlledSpacecraft.yawLeft(i);
        }.bind(this));
        this.setActionFunction("yawRight", true, function (i) {
            this._controlledSpacecraft.yawRight(i);
        }.bind(this));
        this.setActionFunction("pitchUp", true, function (i) {
            this._controlledSpacecraft.pitchUp(i);
        }.bind(this));
        this.setActionFunction("pitchDown", true, function (i) {
            this._controlledSpacecraft.pitchDown(i);
        }.bind(this));
        this.setActionFunction("rollLeft", true, function (i) {
            this._controlledSpacecraft.rollLeft(i);
        }.bind(this));
        this.setActionFunction("rollRight", true, function (i) {
            this._controlledSpacecraft.rollRight(i);
        }.bind(this));
    }
    FighterController.prototype = new control.Controller();
    FighterController.prototype.constructor = FighterController;
    /**
     * Returns the string representation of the type (domain) of the controller.
     * This will be shown to users on the control settings page, which groups controls
     * based on domains.
     * @returns {String}
     */
    FighterController.prototype.getType = function () {
        return "Fighter";
    };
    /**
     * Sets the controlled spacecraft (fighter) for this controller. After called,
     * all controls will take effect on the spacecraft passed here as a parameter.
     * @param {Spacecraft} controlledSpacecraft
     */
    FighterController.prototype.setControlledSpacecraft = function (controlledSpacecraft) {
        this._controlledSpacecraft = controlledSpacecraft;
    };
    /**
     * Same as the method of the parent class, but with a check if there if there is
     * a controlled spacecraft present.
     * @param {Object[]} triggeredActions See {@link Controller#executeActions}
     */
    FighterController.prototype.executeActions = function (triggeredActions) {
        if (this._controlledSpacecraft) {
            if (!this._controlledSpacecraft.canBeReused()) {
                control.Controller.prototype.executeActions.call(this, triggeredActions);
            } else {
                this._controlledSpacecraft = null;
            }
        }
    };
    // #########################################################################
    /**
     * @class The control context used for the game, building on the general control context 
     * @extends ControlContext
     */
    function ArmadaControlContext() {
        control.ControlContext.call(this);
        /**
         * Whether the context is currently in the mode for controlling a spacecraft as a pilot (as opposed to spectator mode, controlling
         * a free camera)
         * @type Boolean
         */
        this._pilotingMode = false;
        this.registerInputInterpreterType("keyboard", control.KeyboardInputInterpreter);
        this.registerInputInterpreterType("mouse", control.MouseInputInterpreter);
        this.registerInputInterpreterType("joystick", control.GamepadInputInterpreter);
        this.registerControllerType("general", GeneralController);
        this.registerControllerType("fighter", FighterController);
        this.registerControllerType("camera", cameraController.CameraController);
    }
    ArmadaControlContext.prototype = new control.ControlContext();
    ArmadaControlContext.prototype.constructor = ArmadaControlContext;
    /**
     * Returns whether the context is currently in the mode for controlling a spacecraft as a pilot (as opposed to spectator mode, 
     * controlling a free camera)
     * @returns {Boolean}
     */
    ArmadaControlContext.prototype.isInPilotMode = function () {
        return this._pilotingMode;
    };
    /**
     * Switches to piloting game mode, putting the player in the pilot seat of the given spacecraft.
     * @param {Spacecraft} pilotedSpacecraft
     */
    ArmadaControlContext.prototype.switchToPilotMode = function (pilotedSpacecraft) {
        if (!pilotedSpacecraft || this._pilotingMode) {
            return;
        }
        this._pilotingMode = true;
        this.getController("fighter").setControlledSpacecraft(pilotedSpacecraft);
        this.getController("camera").setCameraToFollowObject(pilotedSpacecraft.getVisualModel());
        this.disableAction("followNext");
        this.disableAction("followPrevious");
        game.getScreen().setHeaderContent("Piloting " + pilotedSpacecraft.getClassName() + " " + pilotedSpacecraft.getTypeName());
        game.getScreen().showCrosshair();
        game.getScreen().showUI();
        if (this.getInputInterpreter("mouse").isEnabled()) {
            document.body.style.cursor = 'crosshair';
        }
    };
    /**
     * Switches to spectator mode, in which the player can freely move the camera
     * around or follow and inspect any object in the scene.
     * @param {Boolean} [freeCamera=false] Whether to set the camera free at the current position and location.
     */
    ArmadaControlContext.prototype.switchToSpectatorMode = function (freeCamera) {
        this._pilotingMode = false;
        this.getController("fighter").setControlledSpacecraft(null);
        if (freeCamera) {
            this.getController("camera").setToFreeCamera(false);
        }
        this.enableAction("followNext");
        this.enableAction("followPrevious");
        game.getScreen().setHeaderContent("Spectator mode");
        game.getScreen().hideCrosshair();
        game.getScreen().hideUI();
        document.body.style.cursor = 'default';
    };
    _context = new ArmadaControlContext();
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        KeyBinding: control.KeyBinding,
        loadConfigurationFromJSON: _context.loadConfigurationFromJSON.bind(_context),
        loadSettingsFromJSON: _context.loadSettingsFromJSON.bind(_context),
        loadSettingsFromLocalStorage: _context.loadSettingsFromLocalStorage.bind(_context),
        restoreDefaults: _context.restoreDefaults.bind(_context),
        getControllers: _context.getControllers.bind(_context),
        getController: _context.getController.bind(_context),
        getInputInterpreters: _context.getInputInterpreters.bind(_context),
        getInputInterpreter: _context.getInputInterpreter.bind(_context),
        control: _context.control.bind(_context),
        startListening: _context.startListening.bind(_context),
        stopListening: _context.stopListening.bind(_context),
        setScreenCenter: _context.setScreenCenter.bind(_context),
        executeWhenReady: _context.executeWhenReady.bind(_context),
        switchToSpectatorMode: _context.switchToSpectatorMode.bind(_context)
    };
});
