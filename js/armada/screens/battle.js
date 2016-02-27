/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, white: true*/
/*global define, document, setInterval, clearInterval, window*/

/**
 * @param utils
 * @param vec
 * @param mat
 * @param application
 * @param components
 * @param screens
 * @param budaScene
 * @param resources
 * @param strings
 * @param armadaScreens
 * @param graphics
 * @param logic
 * @param control
 */
define([
    "utils/utils",
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/components",
    "modules/screens",
    "modules/buda-scene",
    "modules/graphics-resources",
    "armada/strings",
    "armada/screens/shared",
    "armada/graphics",
    "armada/logic",
    "armada/control",
    "utils/polyfill"
], function (utils, vec, mat, application, components, screens, budaScene, resources, strings, armadaScreens, graphics, logic, control) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            STATS_PARAGRAPH_ID = "stats",
            UI_PARAGRAPH_ID = "ui",
            SMALL_HEADER_ID = "smallHeader",
            BIG_HEADER_ID = "bigHeader",
            DEBUG_LABEL_PARAGRAPH_ID = "debugLabel",
            CROSSHAIR_DIV_ID = "crosshair",
            LOADING_BOX_ID_SUFFIX = screens.ELEMENT_ID_SEPARATOR + "loadingBox",
            INFO_BOX_ID_SUFFIX = screens.ELEMENT_ID_SEPARATOR + "infoBox",
            BATTLE_CANVAS_ID = "battleCanvas",
            LOOP_CANCELED = -1,
            TARGET_INFO_SEPARATOR = "---------------",
            LOADING_RANDOM_ITEMS_PROGRESS = 5,
            LOADING_BUILDING_SCENE_PROGRESS = 10,
            LOADING_RESOURCES_START_PROGRESS = 20,
            LOADING_RESOURCE_PROGRESS = 60,
            LOADING_INIT_WEBGL_PROGRESS = LOADING_RESOURCES_START_PROGRESS + LOADING_RESOURCE_PROGRESS,
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * The level object storing and simulating the game-logic model of the battle
             * @type Level
             */
            _level,
            /**
             * The scene that is used to render the battle
             * @type Scene
             */
            _battleScene,
            /**
             * The ID of the loop function that is set to run the game simulation
             * @type Number
             */
            _simulationLoop,
            /**
             * This stores the value of the cursor as it was used in the battle, while some menu is active
             * @type String
             */
            _battleCursor,
            /**
             * Stores the timestamp of the last simulation step
             * @type Date
             */
            _prevDate,
            /**
             * Whether the time is stopped in the simulated battle currently
             * @type Boolean
             */
            _isTimeStopped,
            /**
             * A function handling the resizing of the window from the battle screen's perspective is stored in this variable
             * @type Function
             */
            _handleResize,
            /**
             * The object that will be returned as this module
             * @type Battle
             */
            _battle = {};
    // ------------------------------------------------------------------------------
    // private functions
    /**
     * Executes one simulation (and control) step for the battle.
     */
    function _simulationLoopFunction() {
        var curDate = new Date();
        control.control();
        if (!_isTimeStopped) {
            _level.tick(curDate - _prevDate);
        }
        _prevDate = curDate;
    }
    /**
     * Removes the stored renferences to the logic and graphical models of the battle.
     */
    function _clearData() {
        if (_level) {
            _level.destroy();
        }
        _level = null;
        if (_battleScene) {
            _battleScene.clearNodes();
        }
        _battleScene = null;
    }
    // ------------------------------------------------------------------------------
    // public functions
    /**
     * Stops the time in the battle simulation.
     */
    function stopTime() {
        _isTimeStopped = true;
        if (_battleScene) {
            _battleScene.setShouldAnimate(false);
        }
    }
    /**
     * Resumes the time in the battle simulation
     */
    function resumeTime() {
        if (_battleScene) {
            _battleScene.setShouldAnimate(true);
        }
        _isTimeStopped = false;
    }
    /**
     * Changes whether the time is stopped in the simulation to the opposite of the current value
     */
    function toggleTime() {
        if (_isTimeStopped) {
            resumeTime();
        } else {
            stopTime();
        }
    }
    /**
     * Pauses the battle by canceling all control and simulation (e.g. for when a menu is displayed)
     */
    function pauseBattle() {
        control.stopListening();
        _battleCursor = document.body.style.cursor;
        document.body.style.cursor = 'default';
        clearInterval(_simulationLoop);
        _simulationLoop = LOOP_CANCELED;
        if (_battleScene) {
            _battleScene.setShouldAnimate(false);
            _battleScene.setShouldUpdateCamera(false);
        }
    }
    /**
     * Resumes the simulation and control of the battle
     */
    function resumeBattle() {
        document.body.style.cursor = _battleCursor || 'default';
        if (_simulationLoop === LOOP_CANCELED) {
            _prevDate = new Date();
            if (_battleScene) {
                if (!_isTimeStopped) {
                    _battleScene.setShouldAnimate(true);
                }
                _battleScene.setShouldUpdateCamera(true);
            }
            _simulationLoop = setInterval(_simulationLoopFunction, 1000 / (logic.getSetting(logic.BATTLE_SETTINGS.SIMULATION_STEPS_PER_SECOND)));
            control.startListening();
        } else {
            application.showError("Trying to resume simulation while it is already going on!", "minor",
                    "No action was taken, to avoid double-running the simulation.");
        }
    }
    // ##############################################################################
    /**
     * @class Represents the battle screen.
     * @extends HTMLScreenWithCanvases
     */
    function BattleScreen() {
        screens.HTMLScreenWithCanvases.call(this, armadaScreens.BATTLE_SCREEN_NAME, armadaScreens.BATTLE_SCREEN_SOURCE, graphics.getAntialiasing(), graphics.getFiltering());
        /**
         * @type SimpleComponent
         */
        this._stats = this.registerSimpleComponent(STATS_PARAGRAPH_ID);
        /**
         * @type SimpleComponent
         */
        this._ui = this.registerSimpleComponent(UI_PARAGRAPH_ID);
        /**
         * @type SimpleComponent
         */
        this._smallHeader = this.registerSimpleComponent(SMALL_HEADER_ID);
        /**
         * @type SimpleComponent
         */
        this._bigHeader = this.registerSimpleComponent(BIG_HEADER_ID);
        /**
         * @type SimpleComponent
         */
        this._debugLabel = this.registerSimpleComponent(DEBUG_LABEL_PARAGRAPH_ID);
        /**
         * @type SimpleComponent
         */
        this._crosshair = this.registerSimpleComponent(CROSSHAIR_DIV_ID);
        /**
         * @type LoadingBox
         */
        this._loadingBox = this.registerExternalComponent(new components.LoadingBox(
                this._name + LOADING_BOX_ID_SUFFIX,
                armadaScreens.LOADING_BOX_SOURCE,
                armadaScreens.LOADING_BOX_CSS,
                strings.LOADING.HEADER.name));
        /**
         * @type InfoBox
         */
        this._infoBox = this.registerExternalComponent(new components.InfoBox(
                this._name + INFO_BOX_ID_SUFFIX,
                armadaScreens.INFO_BOX_SOURCE,
                armadaScreens.INFO_BOX_CSS,
                function () {
                    pauseBattle();
                },
                function () {
                    resumeBattle();
                }.bind(this),
                strings.INFO_BOX.HEADER.name,
                strings.INFO_BOX.OK_BUTTON.name));
    }
    BattleScreen.prototype = new screens.HTMLScreenWithCanvases();
    BattleScreen.prototype.constructor = BattleScreen;
    /**
     * @override
     */
    BattleScreen.prototype.hide = function () {
        screens.HTMLScreenWithCanvases.prototype.hide.call(this);
        pauseBattle();
        _clearData();
    };
    /**
     * @override
     */
    BattleScreen.prototype._initializeComponents = function () {
        var canvas;
        screens.HTMLScreenWithCanvases.prototype._initializeComponents.call(this);
        canvas = this.getScreenCanvas(BATTLE_CANVAS_ID).getCanvasElement();
        _handleResize = function () {
            control.setScreenCenter(canvas.width / 2, canvas.height / 2);
        };
        window.addEventListener("resize", _handleResize);
        _handleResize();
    };
    /**
     * @override
     */
    BattleScreen.prototype._updateComponents = function () {
        screens.HTMLScreenWithCanvases.prototype._updateComponents.call(this);
    };
    /**
     * @override
     */
    BattleScreen.prototype.removeFromPage = function () {
        screens.HTMLScreenWithCanvases.prototype.removeFromPage.call(this);
        window.removeEventListener("resize", _handleResize);
    };
    /**
     * Uses the loading box to show the status to the user.
     * @param {String} newStatus The status to show on the loading box. If
     * undefined, the status won't be updated.
     * @param {Number} newProgress The new value of the progress bar on the loading
     * box. If undefined, the value won't be updated.
     */
    BattleScreen.prototype._updateLoadingStatus = function (newStatus, newProgress) {
        if (newStatus !== undefined) {
            this._loadingBox.updateStatus(newStatus);
        }
        if (newProgress !== undefined) {
            this._loadingBox.updateProgress(newProgress);
        }
    };
    /**
     * Updates the loading box message and progress value to reflect the state given in the parameters.
     * @param {String} resourceName The name of the resource that have just finished loading
     * @param {Number} totalResources The number of total resources to be loaded
     * @param {Number} loadedResources The number of resources that have already been loaded
     */
    BattleScreen.prototype._updateLoadingBoxForResourceLoad = function (resourceName, totalResources, loadedResources) {
        this._updateLoadingStatus(
                utils.formatString(strings.get(strings.LOADING.RESOURCE_READY), {
                    resource: resourceName,
                    loaded: loadedResources,
                    total: totalResources
                }),
                LOADING_RESOURCES_START_PROGRESS + (loadedResources / totalResources) * LOADING_RESOURCE_PROGRESS);
    };
    /**
     * 
     * @param {String} message
     */
    BattleScreen.prototype.setDebugLabel = function (message) {
        this._debugLabel.setContent(message);
    };
    /**
     * Shows the stats (FPS, draw stats) component.
     */
    BattleScreen.prototype.showStats = function () {
        this._stats.show();
    };
    /**
     * Hides the stats (FPS, draw stats) component.
     */
    BattleScreen.prototype.hideStats = function () {
        this._stats.hide();
    };
    /**
     * Shows the UI (information about controlled spacecraft) component.
     */
    BattleScreen.prototype.showUI = function () {
        this._ui.show();
    };
    /**
     * Hides the UI (information about controlled spacecraft) component.
     */
    BattleScreen.prototype.hideUI = function () {
        this._ui.hide();
    };
    /**
     * Shows the headers in the top center of the screen.
     */
    BattleScreen.prototype.showHeaders = function () {
        this._bigHeader.show();
        this._smallHeader.show();
    };
    /**
     * Hides the headers.
     */
    BattleScreen.prototype.hideHeaders = function () {
        this._bigHeader.hide();
        this._smallHeader.hide();
    };
    /**
     * 
     */
    BattleScreen.prototype.showCrosshair = function () {
        this._crosshair.show();
    };
    /**
     * 
     */
    BattleScreen.prototype.hideCrosshair = function () {
        this._crosshair.hide();
    };
    /**
     * Toggles the visibility of the texts (headers and statistics) on the screen.
     * @returns {undefined}
     */
    BattleScreen.prototype.toggleTextVisibility = function () {
        if (this._bigHeader.isVisible()) {
            this.hideHeaders();
            this.hideStats();
        } else {
            this.showHeaders();
            this.showStats();
        }
    };
    /**
     * Shows the given message to the user in an information box.
     * @param {String} message
     */
    BattleScreen.prototype.showMessage = function (message) {
        this._infoBox.updateMessage(message);
        this._infoBox.show();
    };
    /**
     * Updates the big header's content on the screen.
     * @param {String} content
     * @param {Object} [replacements]
     */
    BattleScreen.prototype.setHeaderContent = function (content, replacements) {
        this._bigHeader.setContent(content, replacements);
    };
    /**
     * Updates the contents of the UI with information about the currently controlled spacecraft
     */
    BattleScreen.prototype._updateUI = function () {
        var craft = _level ? _level.getPilotedSpacecraft() : null;
        if (craft) {
            this._ui.setContent(
                    (craft.getTarget() ? (strings.get(strings.BATTLE.HUD_TARGET) + ": " + strings.getSpacecraftClassName(craft.getTarget().getClass()) + " (" + craft.getTarget().getHitpoints() + "/" + craft.getTarget().getClass().getHitpoints() + ")<br/>") : "") +
                    (craft.getTarget() ? (strings.get(strings.BATTLE.HUD_DISTANCE) + ": " + utils.getLengthString(vec.length3(vec.sub3(craft.getTarget().getVisualModel().getPositionVector(), craft.getVisualModel().getPositionVector())))) +
                            "<br/>" + TARGET_INFO_SEPARATOR + "<br/>" : "") +
                    utils.formatString(strings.get(strings.BATTLE.HUD_VIEW), {
                        view: strings.get(strings.OBJECT_VIEW.PREFIX, _battleScene.activeCamera.getConfiguration().getName(), _battleScene.activeCamera.getConfiguration().getName())
                    }) + "<br/>" +
                    strings.get(strings.SPACECRAFT_STATS.ARMOR) + ": " + craft.getHitpoints() + "/" + craft.getClass().getHitpoints() + "<br/>" +
                    utils.formatString(strings.get(strings.BATTLE.HUD_FLIGHT_MODE), {
                        flightMode: strings.get(strings.FLIGHT_MODE.PREFIX, craft.getFlightMode(), craft.getFlightMode())
                    }) + "<br/>" +
                    strings.get(strings.BATTLE.HUD_SPEED) + ": " + craft.getRelativeVelocityMatrix()[13].toFixed() +
                    ((craft.getFlightMode() !== logic.FlightMode.FREE) ? (" / " + craft._maneuveringComputer._speedTarget.toFixed()) : ""));
        }
    };
    /**
     * @override
     */
    BattleScreen.prototype.render = function () {
        screens.HTMLScreenWithCanvases.prototype.render.call(this);
        this._stats.setContent(
                this.getFPS() + "<br/>" +
                _battleScene.getNumberOfDrawnTriangles());
        this._updateUI();
    };
    /**
     * Loads the specified level description file and sets a callback to create a new game-logic model and scene for the simulated battle
     * based on the level description and current settings
     * @param {String} levelSourceFilename
     */
    BattleScreen.prototype.startNewBattle = function (levelSourceFilename) {
        var
                loadingStartTime = new Date(),
                canvas = this.getScreenCanvas(BATTLE_CANVAS_ID).getCanvasElement();
        _clearData();
        document.body.classList.add("wait");
        this.hideStats();
        this.hideUI();
        this.hideCrosshair();
        this._loadingBox.show();
        this.resizeCanvases();
        control.setScreenCenter(
                canvas.width / 2,
                canvas.height / 2);
        _level = new logic.Level();
        this._updateLoadingStatus(strings.get(strings.BATTLE.LOADING_BOX_LOADING_LEVEL), 0);
        _level.requestLoadFromFile(levelSourceFilename, function () {
            this._updateLoadingStatus(strings.get(strings.BATTLE.LOADING_BOX_ADDING_RANDOM_ELEMENTS), LOADING_RANDOM_ITEMS_PROGRESS);
            _level.addRandomShips(
                    logic.getSetting(logic.BATTLE_SETTINGS.RANDOM_SHIPS),
                    logic.getSetting(logic.BATTLE_SETTINGS.RANDOM_SHIPS_MAP_SIZE),
                    mat.rotation4([0, 0, 1], Math.radians(logic.getSetting(logic.BATTLE_SETTINGS.RANDOM_SHIPS_HEADING_ANGLE))),
                    false, false, logic.getSetting(logic.BATTLE_SETTINGS.RANDOM_SHIPS_RANDOM_HEADING));
            this._updateLoadingStatus(strings.get(strings.BATTLE.LOADING_BOX_BUILDING_SCENE), LOADING_BUILDING_SCENE_PROGRESS);
            if (graphics.shouldUseShadowMapping()) {
                graphics.getShadowMappingShader();
            }
            _battleScene = new budaScene.Scene(
                    0, 0, canvas.width, canvas.height,
                    true, [true, true, true, true],
                    [0, 0, 0, 1], true,
                    graphics.getLODContext());
            _level.addToScene(_battleScene);
            control.getController(control.GENERAL_CONTROLLER_NAME).setLevel(_level);
            control.getController(control.GENERAL_CONTROLLER_NAME).setBattle(_battle);
            control.getController(control.CAMERA_CONTROLLER_NAME).setControlledCamera(_battleScene.activeCamera);
            this._updateLoadingStatus(strings.get(strings.LOADING.RESOURCES_START), LOADING_RESOURCES_START_PROGRESS);
            resources.executeOnResourceLoad(this._updateLoadingBoxForResourceLoad.bind(this));
            resources.executeWhenReady(function () {
                _battleScene.setShadowMapping(graphics.getShadowMappingSettings());
                this._updateLoadingStatus(strings.get(strings.LOADING.INIT_WEBGL), LOADING_INIT_WEBGL_PROGRESS);
                utils.executeAsync(function () {
                    this.clearSceneCanvasBindings();
                    this.bindSceneToCanvas(_battleScene, this.getScreenCanvas(BATTLE_CANVAS_ID));
                    this._updateLoadingStatus(strings.get(strings.LOADING.READY), 100);
                    application.log("Game data loaded in " + ((new Date() - loadingStartTime) / 1000).toFixed(3) + " seconds!", 1);
                    this._smallHeader.setContent(strings.get(strings.BATTLE.DEVELOPMENT_VERSION_NOTICE), {version: application.getVersion()});
                    document.body.classList.remove("wait");
                    control.switchToSpectatorMode(false);
                    _battleCursor = document.body.style.cursor;
                    this.showMessage(strings.get(strings.BATTLE.MESSAGE_READY));
                    this._loadingBox.hide();
                    this.showStats();
                    this.startRenderLoop(1000 / logic.getSetting(logic.BATTLE_SETTINGS.RENDER_FPS));
                }.bind(this));
            }.bind(this));

            resources.requestResourceLoad();
        }.bind(this));
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    _battle.battleScreen = new BattleScreen();
    _battle.stopTime = stopTime;
    _battle.resumeTime = resumeTime;
    _battle.toggleTime = toggleTime;
    _battle.pauseBattle = pauseBattle;
    _battle.resumeBattle = resumeBattle;
    return _battle;
});