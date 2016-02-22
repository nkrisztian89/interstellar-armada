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

/*jslint nomen: true, white: true*/
/*global define, document, setInterval, clearInterval, window*/
define([
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/components",
    "modules/screens",
    "modules/buda-scene",
    "modules/graphics-resources",
    "armada/graphics",
    "armada/logic",
    "armada/control"
], function (vec, mat, application, components, screens, budaScene, resources, graphics, logic, control) {
    "use strict";

    function _shouldUseShadowMapping() {
        return graphics.isShadowMappingEnabled() && (graphics.getShaderComplexity() === graphics.ShaderComplexity.NORMAL);
    }

    /**
     * @class Represents the battle screen.
     * @extends screens.HTMLScreenWithCanvases
     * @param {String} name The name by which this screen can be identified.
     * @param {String} source The name of the HTML file where the structure of this
     * screen is defined.
     */
    function BattleScreen(name, source) {
        screens.HTMLScreenWithCanvases.call(this, name, source, graphics.getAntialiasing(), graphics.getFiltering());

        this._stats = this.registerSimpleComponent("stats");
        this._ui = this.registerSimpleComponent("ui");
        this._smallHeader = this.registerSimpleComponent("smallHeader");
        this._bigHeader = this.registerSimpleComponent("bigHeader");

        this._debugLabel = this.registerSimpleComponent("debugLabel");

        this._crosshair = this.registerSimpleComponent("crosshair");

        this._loadingBox = this.registerExternalComponent(new components.LoadingBox(name + "_loadingBox", "loadingbox.html", "loadingbox.css"));
        this._infoBox = this.registerExternalComponent(new components.InfoBox(name + "_infoBox", "infobox.html", "infobox.css", function () {
            this.pauseBattle();
        }.bind(this), function () {
            this.resumeBattle();
        }.bind(this)));

        /**
         * @type Level
         */
        this._level = null;
        /**
         * @type Scene
         */
        this._battleScene = null;
        this._simulationLoop = null;
        this._battleCursor = null;
        this._prevDate = null;
        this._isTimeStopped = false;
    }

    BattleScreen.prototype = new screens.HTMLScreenWithCanvases();
    BattleScreen.prototype.constructor = BattleScreen;

    BattleScreen.prototype._simulationLoopFunction = function () {
        var curDate = new Date();
        control.control();
        if (!this._isTimeStopped) {
            this._level.tick(curDate - this._prevDate);
        }
        this._prevDate = curDate;
    };

    BattleScreen.prototype.stopTime = function () {
        this._isTimeStopped = true;
        if (this._battleScene) {
            this._battleScene.setShouldAnimate(false);
        }
    };

    BattleScreen.prototype.resumeTime = function () {
        if (this._battleScene) {
            this._battleScene.setShouldAnimate(true);
        }
        this._isTimeStopped = false;
    };

    BattleScreen.prototype.toggleTime = function () {
        if (this._isTimeStopped) {
            this.resumeTime();
        } else {
            this.stopTime();
        }
    };

    BattleScreen.prototype.pauseBattle = function () {
        control.stopListening();
        this._battleCursor = document.body.style.cursor;
        document.body.style.cursor = 'default';
        clearInterval(this._simulationLoop);
        this._simulationLoop = null;
        if (this._battleScene) {
            this._battleScene.setShouldAnimate(false);
            this._battleScene.setShouldUpdateCamera(false);
        }
    };

    BattleScreen.prototype.resumeBattle = function () {
        document.body.style.cursor = this._battleCursor || 'default';
        if (this._simulationLoop === null) {
            this._prevDate = new Date();
            if (this._battleScene) {
                if (!this._isTimeStopped) {
                    this._battleScene.setShouldAnimate(true);
                }
                this._battleScene.setShouldUpdateCamera(true);
            }
            this._simulationLoop = setInterval(this._simulationLoopFunction.bind(this), 1000 / (logic.getSetting(logic.BATTLE_SETTINGS.SIMULATION_STEPS_PER_SECOND)));
            control.startListening();
        } else {
            application.showError("Trying to resume simulation while it is already going on!", "minor",
                    "No action was taken, to avoid double-running the simulation.");
        }

    };

    BattleScreen.prototype.hide = function () {
        screens.HTMLScreenWithCanvases.prototype.hide.call(this);
        this.pauseBattle();
        if (this._level) {
            this._level.destroy();
        }
        this._level = null;
        this._battleScene = null;
    };

    /**
     * Initializes the components of the parent class, then the additional ones for
     * this class (the canvases).
     */
    BattleScreen.prototype._initializeComponents = function () {
        screens.HTMLScreenWithCanvases.prototype._initializeComponents.call(this);
        var canvas = this.getScreenCanvas("battleCanvas").getCanvasElement();
        this._resizeEventListener2 = function () {
            control.setScreenCenter(canvas.width / 2, canvas.height / 2);
        };
        window.addEventListener("resize", this._resizeEventListener2);
        this._resizeEventListener2();
    };

    /**
     * Getter for the _loadingBox property.
     * @returns {LoadingBox}
     */
    BattleScreen.prototype.getLoadingBox = function () {
        return this._loadingBox;
    };

    /**
     * Getter for the _infoBox property.
     * @returns {InfoBox}
     */
    BattleScreen.prototype.getInfoBox = function () {
        return this._infoBox;
    };

    /**
     * Uses the loading box to show the status to the user.
     * @param {String} newStatus The status to show on the loading box. If
     * undefined, the status won't be updated.
     * @param {Number} newProgress The new value of the progress bar on the loading
     * box. If undefined, the value won't be updated.
     */
    BattleScreen.prototype.updateStatus = function (newStatus, newProgress) {
        if (newStatus !== undefined) {
            this._loadingBox.updateStatus(newStatus);
        }
        if (newProgress !== undefined) {
            this._loadingBox.updateProgress(newProgress);
        }
    };

    BattleScreen.prototype.setDebugLabel = function (message) {
        this._debugLabel.setContent(message);
    };

    /**
     * Hides the stats (FPS, draw stats) component.
     */
    BattleScreen.prototype.hideStats = function () {
        this._stats.hide();
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
     * Shows the stats (FPS, draw stats) component.
     */
    BattleScreen.prototype.showStats = function () {
        this._stats.show();
    };

    BattleScreen.prototype.showCrosshair = function () {
        this._crosshair.show();
    };

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
     * Shows the UI (information about controlled spacecraft) component.
     */
    BattleScreen.prototype.showUI = function () {
        this._ui.show();
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
     */
    BattleScreen.prototype.setHeaderContent = function (content) {
        this._bigHeader.setContent(content);
    };

    BattleScreen.prototype.render = function () {
        var craft;
        screens.HTMLScreenWithCanvases.prototype.render.call(this);
        this._stats.setContent(
                //vec.toString3(this._battleScene.activeCamera.getVelocityVector()) + "<br/>" +
                this.getFPS() + "<br/>" +
                this._sceneCanvasBindings[0].scene.getNumberOfDrawnTriangles());
        craft = this._level ? this._level.getPilotedSpacecraft() : null;
        if (craft) {
            this._ui.setContent(
                    this._battleScene.activeCamera.getConfiguration().getName() + " view</br>" +
                    "Armor: " + craft.getHitpoints() + "/" + craft.getClass().getHitpoints() + "<br/>" +
                    (craft.getTarget() ? ("target: " + craft.getTarget().getClassName() + " (" + craft.getTarget().getHitpoints() + "/" + craft.getTarget().getClass().getHitpoints() + ")<br/>") : "") +
                    (craft.getTarget() ? ("distance: " + Math.round(vec.length3(vec.sub3(craft.getTarget().getVisualModel().getPositionVector(), craft.getVisualModel().getPositionVector())))) + "<br/>" : "") +
                    craft.getFlightMode() + " flight mode<br/>" +
                    "speed: " + craft.getRelativeVelocityMatrix()[13].toFixed() +
                    ((craft.getFlightMode() !== "free") ? (" / " + craft._maneuveringComputer._speedTarget.toFixed()) : ""));
        }
    };

    /**
     * 
     * @param {string} levelSourceFilename
     */
    BattleScreen.prototype.startNewBattle = function (levelSourceFilename) {
        var loadingStartTime;
        document.body.style.cursor = 'wait';
        loadingStartTime = new Date();
        this.hideStats();
        this.hideUI();
        this.hideCrosshair();
        this._loadingBox.show();
        this.resizeCanvases();
        control.setScreenCenter(
                this.getScreenCanvas("battleCanvas").getCanvasElement().width / 2,
                this.getScreenCanvas("battleCanvas").getCanvasElement().height / 2);

        this._level = new logic.Level();

        this.updateStatus("loading level information...", 0);
        this._level.requestLoadFromFile(levelSourceFilename, function () {
            var freq, canvas;
            this.updateStatus("loading additional configuration...", 5);
            this._level.addRandomShips(
                    logic.getSetting(logic.BATTLE_SETTINGS.RANDOM_SHIPS),
                    logic.getSetting(logic.BATTLE_SETTINGS.RANDOM_SHIPS_MAP_SIZE),
                    mat.rotation4([0, 0, 1], Math.PI / 2),
                    false, false, true);

            this.updateStatus("building scene...", 10);
            canvas = this.getScreenCanvas("battleCanvas").getCanvasElement();
            if (_shouldUseShadowMapping()) {
                graphics.getShader("shadowMapping"); //TODO: hardcoded
            }
            this._battleScene = new budaScene.Scene(
                    0, 0, canvas.width, canvas.height,
                    true, [true, true, true, true],
                    [0, 0, 0, 1], true,
                    graphics.getLODContext());
            this._level.addToScene(this._battleScene);

            control.getController("general").setLevel(this._level); //TODO: hardcoded
            control.getController("camera").setControlledCamera(this._battleScene.activeCamera);

            this.updateStatus("loading graphical resources...", 15);
            resources.executeOnResourceLoad(function (resourceName, totalResources, loadedResources) {
                this.updateStatus("loaded " + resourceName + ", total progress: " + loadedResources + "/" + totalResources, 20 + (loadedResources / totalResources) * 60);
            }.bind(this));
            freq = 60; //TODO: hardcoded
            resources.executeWhenReady(function () {
                if (_shouldUseShadowMapping()) {
                    this._battleScene.setShadowMapping(graphics.getShadowMappingSettingsForShader("shadowMapping")); //TODO: hardcoded
                } else {
                    this._battleScene.setShadowMapping(null);
                }
                this.updateStatus("initializing WebGL...", 75);
                this.clearSceneCanvasBindings();
                this.bindSceneToCanvas(this._battleScene, this.getScreenCanvas("battleCanvas"));
                this.updateStatus("", 100);
                application.log("Game data loaded in " + ((new Date() - loadingStartTime) / 1000).toFixed(3) + " seconds!", 1);
                this._smallHeader.setContent("running an early test of Interstellar Armada, version: " + application.getVersion());
                control.switchToSpectatorMode(false);
                this._battleCursor = document.body.style.cursor;
                this.showMessage("Ready!");
                this.getLoadingBox().hide();
                this.showStats();
                this.startRenderLoop(1000 / freq);
            }.bind(this));

            resources.requestResourceLoad();
        }.bind(this));
    };

    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        BattleScreen: BattleScreen
    };
});