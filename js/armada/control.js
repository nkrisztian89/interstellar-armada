/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file Provides functionality to load and access control configuration and settings for Interstellar Armada.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, Element, localStorage, document, window, navigator */

/**
 * @param control This module builds its game-specific functionality on the general control module
 * @param cameraController This module uses the CameraController class made for SceneGraph
 * @param game To access screen-changing functionality
 * @param resources Used to access the sound effects triggered by controls
 * @param armadaScreens Used for navigation
 * @param strings Used for translation support
 * @param config Used to access settings
 */
define([
    "modules/control",
    "modules/camera-controller",
    "modules/game",
    "modules/media-resources",
    "armada/screens/shared",
    "armada/strings",
    "armada/configuration"
], function (control, cameraController, game, resources, armadaScreens, strings, config) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            KEYBOARD_NAME = "keyboard",
            MOUSE_NAME = "mouse",
            JOYSTICK_NAME = "joystick",
            GAMEPAD_NAME = JOYSTICK_NAME,
            GENERAL_CONTROLLER_NAME = "general",
            FIGHTER_CONTROLLER_NAME = "fighter",
            CAMERA_CONTROLLER_NAME = "camera",
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * Cached value of the configuration setting for strafe speed factor.
             * @type Number
             */
            _strafeSpeedFactor,
            /**
             * Cached value of the configuration setting for target switch sound.
             * @type SoundSource
             */
            _targetSwitchSound,
            /**
             * Cached value of the configuration setting for target switch denied sound.
             * @type SoundSource
             */
            _targetSwitchDeniedSound,
            /**
             * The context storing the current control settings (controllers, input interpreters) that can be accessed through the interface of this module
             * @type ArmadaControlContext
             */
            _context,
            /**
             * A shortcut reference to the input interpreter that handles mouse input stored in the context
             * @type MouseInputInterpreter
             */
            _mouseInputInterpreter;
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
         * The mission which this controller controls.
         * @type Mission
         */
        this._mission = null;
        /**
         * @type Battle
         */
        this._battle = null;
        // The superclass constructor above loads the data from the JSON, so all action
        // properties should be have been created by now.
        // quitting to the menu
        this.setActionFunction("quit", true, function () {
            this._battle.pauseBattle();
            game.setScreen(armadaScreens.INGAME_MENU_SCREEN_NAME, true, armadaScreens.SUPERIMPOSE_BACKGROUND_COLOR);
        }.bind(this));
        // pausing the game
        this.setActionFunction("pause", true, function () {
            // showing an info box automatically pauses the game as implemented in
            // the BattleScreen class
            game.getScreen().showMessage(strings.get(strings.BATTLE.MESSAGE_PAUSED));
        });
        this.setActionFunction("stopTime", true, function () {
            this._battle.toggleTime();
        }.bind(this));
        // switching to pilot mode
        this.setActionFunction("switchToPilotMode", true, function () {
            _context.switchToPilotMode(this._mission.getPilotedSpacecraft());
        }.bind(this));
        // switching to spectator mode
        this.setActionFunction("switchToSpectatorMode", true, function () {
            _context.switchToSpectatorMode(true, true);
        });
        // toggling the visibility of hitboxes
        this.setActionFunction("toggleHitboxVisibility", true, function () {
            this._mission.toggleHitboxVisibility();
        }.bind(this));
        // toggling the visibility of development-related info (version, FPS count) on screen
        this.setActionFunction("toggleDevInfoVisibility", true, function () {
            game.getScreen().toggleDevInfoVisibility();
        });
        // toggling the visibility of the HUD
        this.setActionFunction("toggleHUDVisibility", true, function () {
            this._battle.toggleHUDVisibility();
        }.bind(this));
        // toggling the mouse controls
        this.setActionFunction("toggleMouseControls", true, function () {
            _context.getInputInterpreter(MOUSE_NAME).toggleEnabled();
            if (_context.isInPilotMode()) {
                if (_context.getInputInterpreter(MOUSE_NAME).isEnabled()) {
                    document.body.style.cursor = 'none';
                    _context.enableMouseTurning();
                } else {
                    document.body.style.cursor = game.getDefaultCursor();
                }
            }
        });
        // toggling the joystick controls
        this.setActionFunction("toggleJoystickControls", true, function () {
            _context.getInputInterpreter(JOYSTICK_NAME).toggleEnabled();
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
        return "general";
    };
    /**
     * Sets the controlled mission to the one passed as parameter.
     * @param {Mission} mission
     */
    GeneralController.prototype.setMission = function (mission) {
        this._mission = mission;
    };
    /**
     * Sets the controlled battle to the one passed as parameter.
     * @param {Battle} battle
     */
    GeneralController.prototype.setBattle = function (battle) {
        this._battle = battle;
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
        /**
         * The strafing speed to be used for the controlled spacecraft, in m/s.
         * @type Number
         */
        this._strafeSpeed = 0;
        /**
         * Whether auto-targeting is currently turned on for this controller.
         * @type Boolean
         */
        this._autoTargeting = true;
        /**
         * The angle threshold which should be exceeded to trigger the rotation of non-fixed weapons for auto-aiming, in radians
         * @type Number
         */
        this._weaponAimThreshold = dataJSON.weaponAimThreshold;
        // The superclass constructor above loads the data from the JSON, so all action
        // properties should have been created
        // fire the primary weapons of the fighter
        this.setActionFunction("fire", true, function (i, source) {
            this._controlledSpacecraft.fire(false, i);
            if (source === _mouseInputInterpreter) {
                _context.enableMouseTurning();
            }
        }.bind(this));
        // changing flight mode (free / combat / cruise)
        this.setActionFunction("changeFlightMode", true, function () {
            this._controlledSpacecraft.changeFlightMode();
        }.bind(this));
        // switch to next hostile target
        this.setActionFunction("nextHostileTarget", true, function () {
            if (this._controlledSpacecraft.targetNextHostile()) {
                _targetSwitchSound.play();
            } else {
                _targetSwitchDeniedSound.play();
            }
        }.bind(this));
        // switch to next target (any)
        this.setActionFunction("nextNonHostileTarget", true, function () {
            if (this._controlledSpacecraft.targetNextNonHostile()) {
                _targetSwitchSound.play();
            } else {
                _targetSwitchDeniedSound.play();
            }
        }.bind(this));
        // toggle auto targeting
        this.setActionFunction("toggleAutoTargeting", true, function () {
            this._autoTargeting = !this._autoTargeting;
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
            this._controlledSpacecraft.strafeLeft(((i !== undefined) ? i : 1) * this._strafeSpeed);
        }.bind(this), function () {
            this._controlledSpacecraft.stopLeftStrafe();
        }.bind(this));
        this.setActionFunctions("strafeRight", function (i) {
            this._controlledSpacecraft.strafeRight(((i !== undefined) ? i : 1) * this._strafeSpeed);
        }.bind(this), function () {
            this._controlledSpacecraft.stopRightStrafe();
        }.bind(this));
        // strafing up and down
        this.setActionFunctions("raise", function (i) {
            this._controlledSpacecraft.raise(((i !== undefined) ? i : 1) * this._strafeSpeed);
        }.bind(this), function () {
            this._controlledSpacecraft.stopRaise();
        }.bind(this));
        this.setActionFunctions("lower", function (i) {
            this._controlledSpacecraft.lower(((i !== undefined) ? i : 1) * this._strafeSpeed);
        }.bind(this), function () {
            this._controlledSpacecraft.stopLower();
        }.bind(this));
        // resetting speed to 0
        this.setActionFunction("resetSpeed", true, function () {
            this._controlledSpacecraft.resetSpeed();
        }.bind(this));
        // turning along the 3 axes
        this.setActionFunction("yawLeft", true, function (i, source) {
            this._controlledSpacecraft.yawLeft(i);
            if (source !== _mouseInputInterpreter) {
                _context.disableMouseTurning();
            }
        }.bind(this));
        this.setActionFunction("yawRight", true, function (i, source) {
            this._controlledSpacecraft.yawRight(i);
            if (source !== _mouseInputInterpreter) {
                _context.disableMouseTurning();
            }
        }.bind(this));
        this.setActionFunction("pitchUp", true, function (i, source) {
            this._controlledSpacecraft.pitchUp(i);
            if (source !== _mouseInputInterpreter) {
                _context.disableMouseTurning();
            }
        }.bind(this));
        this.setActionFunction("pitchDown", true, function (i, source) {
            this._controlledSpacecraft.pitchDown(i);
            if (source !== _mouseInputInterpreter) {
                _context.disableMouseTurning();
            }
        }.bind(this));
        this.setActionFunction("rollLeft", true, function (i) {
            this._controlledSpacecraft.rollLeft(i);
        }.bind(this));
        this.setActionFunction("rollRight", true, function (i) {
            this._controlledSpacecraft.rollRight(i);
        }.bind(this));
        this.setActionFunction("jumpOut", true, function () {
            this._controlledSpacecraft.jumpOut();
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
        return "fighter";
    };
    /**
     * Sets the controlled spacecraft (fighter) for this controller. After called,
     * all controls will take effect on the spacecraft passed here as a parameter.
     * @param {Spacecraft} controlledSpacecraft
     */
    FighterController.prototype.setControlledSpacecraft = function (controlledSpacecraft) {
        this._controlledSpacecraft = controlledSpacecraft;
        if (this._controlledSpacecraft) {
            this._strafeSpeed = _strafeSpeedFactor * this._controlledSpacecraft.getMaxAcceleration();
        }
    };
    /**
     * Same as the method of the parent class, but with a check if there if there is
     * a controlled spacecraft present.
     * @param {Object[]} triggeredActions See Controller.executeActions
     * @param {Number} dt The elapsed time since the last control step, in milliseconds
     */
    FighterController.prototype.executeActions = function (triggeredActions, dt) {
        if (this._controlledSpacecraft) {
            if (!this._controlledSpacecraft.canBeReused()) {
                // executing user-triggered actions
                control.Controller.prototype.executeActions.call(this, triggeredActions);
                // executing automatic actions
                if (this._autoTargeting && !this._controlledSpacecraft.getTarget()) {
                    if (this._controlledSpacecraft.targetNextHostile()) {
                        _targetSwitchSound.play();
                    }
                }
                this._controlledSpacecraft.aimWeapons(this._weaponAimThreshold, 0, dt);
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
        /**
         * Whether mouse turning is currently disabled (automatically happens if the player uses another input device for turning)
         * @type Boolean
         */
        this._mouseTurningDisabled = false;
        this.registerInputInterpreterType(KEYBOARD_NAME, control.KeyboardInputInterpreter);
        this.registerInputInterpreterType(MOUSE_NAME, control.MouseInputInterpreter);
        this.registerInputInterpreterType(JOYSTICK_NAME, control.GamepadInputInterpreter);
        this.registerControllerType(GENERAL_CONTROLLER_NAME, GeneralController);
        this.registerControllerType(FIGHTER_CONTROLLER_NAME, FighterController);
        this.registerControllerType(CAMERA_CONTROLLER_NAME, cameraController.CameraController);
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
        _targetSwitchSound = resources.getSoundEffect(
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_SWITCH_SOUND).name).createSoundClip(
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_SWITCH_SOUND).volume);
        _targetSwitchDeniedSound = resources.getSoundEffect(
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_SWITCH_DENIED_SOUND).name).createSoundClip(
                config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_SWITCH_DENIED_SOUND).volume);
        this.getController(FIGHTER_CONTROLLER_NAME).setControlledSpacecraft(pilotedSpacecraft);
        this.getController(CAMERA_CONTROLLER_NAME).setCameraToFollowObject(
                pilotedSpacecraft.getVisualModel(),
                config.getSetting(config.BATTLE_SETTINGS.CAMERA_PILOTING_SWITCH_TRANSITION_DURATION),
                config.getSetting(config.BATTLE_SETTINGS.CAMERA_PILOTING_SWITCH_TRANSITION_STYLE));
        this.disableAction("followNext");
        this.disableAction("followPrevious");
        game.getScreen().setHeaderContent("");
        if (this.getInputInterpreter(MOUSE_NAME).isEnabled()) {
            document.body.style.cursor = 'none';
        }
    };
    /**
     * Switches to spectator mode, in which the player can freely move the camera
     * around or follow and inspect any object in the scene.
     * @param {Boolean} [freeCamera=false] Whether to set the camera free at the current position and location.
     * @param {Boolean} [force=false] If true, the settings for spectator mode will be (re)applied even if the current state is already set
     * as spectator mode (useful for first time initialization and to force switch to free camera when following a spacecraft in spectator 
     * mode)
     */
    ArmadaControlContext.prototype.switchToSpectatorMode = function (freeCamera, force) {
        if (this._pilotingMode || force) {
            this._pilotingMode = false;
            this.getController(FIGHTER_CONTROLLER_NAME).setControlledSpacecraft(null);
            if (freeCamera) {
                this.getController(CAMERA_CONTROLLER_NAME).setToFreeCamera(false);
            }
            this.enableAction("followNext");
            this.enableAction("followPrevious");
            game.getScreen().setHeaderContent(strings.get(strings.BATTLE.SPECTATOR_MODE));
            document.body.style.cursor = game.getDefaultCursor();
        }
    };
    /**
     * Disables the turning related actions from the mouse input interpreter.
     * To be called when the user turn using an input device other than the mouse.
     */
    ArmadaControlContext.prototype.disableMouseTurning = function () {
        if (!this._mouseTurningDisabled) {
            _mouseInputInterpreter.disableAction("yawLeft");
            _mouseInputInterpreter.disableAction("yawRight");
            _mouseInputInterpreter.disableAction("pitchUp");
            _mouseInputInterpreter.disableAction("pitchDown");
            _mouseInputInterpreter.disableAction("rollLeft");
            _mouseInputInterpreter.disableAction("rollRight");
            this._mouseTurningDisabled = true;
        }
    };
    /**
     * Enables the turning related actions from the mouse input interpreter
     * To be called when the user fires using the mouse.
     */
    ArmadaControlContext.prototype.enableMouseTurning = function () {
        if (this._mouseTurningDisabled) {
            _mouseInputInterpreter.enableAction("yawLeft");
            _mouseInputInterpreter.enableAction("yawRight");
            _mouseInputInterpreter.enableAction("pitchUp");
            _mouseInputInterpreter.enableAction("pitchDown");
            _mouseInputInterpreter.enableAction("rollLeft");
            _mouseInputInterpreter.enableAction("rollRight");
            this._mouseTurningDisabled = false;
        }
    };
    /**
     * Returns whether mouse turning has been auto-disabled by the player using another input device for turning.
     * @returns {Boolean}
     */
    ArmadaControlContext.prototype.isMouseTurningDisabled = function () {
        return this._mouseTurningDisabled;
    };
    // -------------------------------------------------------------------------
    // Initialization
    _context = new ArmadaControlContext();
    // -------------------------------------------------------------------------
    // Caching input interpreters
    _context.executeWhenReady(function () {
        _mouseInputInterpreter = _context.getInputInterpreter(MOUSE_NAME);
    });
    // -------------------------------------------------------------------------
    // Caching configuration settings
    config.executeWhenReady(function () {
        _strafeSpeedFactor = config.getSetting(config.BATTLE_SETTINGS.STRAFE_SPEED_FACTOR);
    });
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        KEYBOARD_NAME: KEYBOARD_NAME,
        MOUSE_NAME: MOUSE_NAME,
        JOYSTICK_NAME: JOYSTICK_NAME,
        GAMEPAD_NAME: GAMEPAD_NAME,
        GENERAL_CONTROLLER_NAME: GENERAL_CONTROLLER_NAME,
        FIGHTER_CONTROLLER_NAME: FIGHTER_CONTROLLER_NAME,
        CAMERA_CONTROLLER_NAME: CAMERA_CONTROLLER_NAME,
        KeyBinding: control.KeyBinding,
        loadConfigurationFromJSON: _context.loadConfigurationFromJSON.bind(_context),
        loadSettingsFromJSON: _context.loadSettingsFromJSON.bind(_context),
        loadSettingsFromLocalStorage: _context.loadSettingsFromLocalStorage.bind(_context),
        restoreDefaults: _context.restoreDefaults.bind(_context),
        getControllers: _context.getControllers.bind(_context),
        getController: _context.getController.bind(_context),
        isControllerPriority: _context.isControllerPriority.bind(_context),
        getInputInterpreters: _context.getInputInterpreters.bind(_context),
        getInputInterpreter: _context.getInputInterpreter.bind(_context),
        control: _context.control.bind(_context),
        startListening: _context.startListening.bind(_context),
        stopListening: _context.stopListening.bind(_context),
        isListening: _context.isListening.bind(_context),
        setScreenCenter: _context.setScreenCenter.bind(_context),
        executeWhenReady: _context.executeWhenReady.bind(_context),
        isInPilotMode: _context.isInPilotMode.bind(_context),
        switchToPilotMode: _context.switchToPilotMode.bind(_context),
        switchToSpectatorMode: _context.switchToSpectatorMode.bind(_context),
        isMouseTurningDisabled: _context.isMouseTurningDisabled.bind(_context)
    };
});
