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

/*jslint nomen: true, white: true */
/*global define, setInterval, clearInterval, document */

define([
    "utils/utils",
    "utils/matrices",
    "modules/components",
    "modules/screens",
    "modules/buda-scene",
    "modules/game",
    "modules/graphics-resources",
    "armada/graphics",
    "armada/classes",
    "armada/logic"
], function (utils, mat, components, screens, budaScene, game, resources, graphics, classes, logic) {
    "use strict";

    function _shouldUseShadowMapping() {
        return graphics.isShadowMappingEnabled() && (graphics.getShaderComplexity() === graphics.ShaderComplexity.NORMAL);
    }

    function _modelRotation() {
        return logic.getSetting(logic.DATABASE_SETTINGS.MODEL_ROTATION);
    }

    function _showSolidModel() {
        return logic.getSetting(logic.DATABASE_SETTINGS.SHOW_SOLID_MODEL);
    }

    function _showWireframeModel() {
        return (graphics.getShaderComplexity() === graphics.ShaderComplexity.NORMAL) ?
                logic.getSetting(logic.DATABASE_SETTINGS.SHOW_WIREFRAME_MODEL) :
                !_showSolidModel();
    }

    function _shouldReveal() {
        return (graphics.getShaderComplexity() === graphics.ShaderComplexity.NORMAL) &&
                logic.getSetting(logic.DATABASE_SETTINGS.MODEL_REVEAL_ANIMATION);
    }

    /**
     * Defines a database screen object.
     * @class Represents the database screen.
     * @extends screens.HTMLScreenWithCanvases
     * @param {String} name The name by which this screen can be identified.
     * @param {String} source The name of the HTML file where the structure of this
     * screen is defined.
     * @returns {DatabaseScreen}
     */
    function DatabaseScreen(name, source) {
        screens.HTMLScreenWithCanvases.call(this, name, source, graphics.getAntialiasing(), graphics.getFiltering());

        this._itemName = this.registerSimpleComponent("itemName");
        this._itemType = this.registerSimpleComponent("itemType");
        this._itemStats = this.registerSimpleComponent("itemStats");
        this._itemDescription = this.registerSimpleComponent("itemDescription");

        this._backButton = this.registerSimpleComponent("backButton");
        this._prevButton = this.registerSimpleComponent("prevButton");
        this._nextButton = this.registerSimpleComponent("nextButton");
        this._loadingBox = this.registerExternalComponent(new components.LoadingBox(name + "_loadingBox", "loadingbox.html", "loadingbox.css"));

        this._scene = null;
        this._item = null;
        this._itemIndex = null;
        this._animationLoop = null;
        this._revealLoop = null;
        this._rotationLoop = null;
        this._solidModel = null;
        this._wireframeModel = null;

        this._mousePos = null;
    }

    DatabaseScreen.prototype = new screens.HTMLScreenWithCanvases();
    DatabaseScreen.prototype.constructor = DatabaseScreen;

    /**
     * Nulls out the components.
     */
    DatabaseScreen.prototype.removeFromPage = function () {
        screens.HTMLScreenWithCanvases.prototype.removeFromPage.call(this);

        this._itemLength = null;
        this._itemLengthInMeters = null;
        this._itemFront = null;
        this._revealState = null;

        this.stopRevealLoop();
        this.stopRotationLoop();
        this._item = null;
        this._itemIndex = null;
        this._scene = null;
        this._solidModel = null;
        this._wireframeModel = null;

        this._mousePos = null;
    };

    /**
     * Initializes the components of the parent class, then the additional ones for
     * this class.
     */
    DatabaseScreen.prototype._initializeComponents = function () {
        screens.HTMLScreenWithCanvases.prototype._initializeComponents.call(this);

        this._backButton.getElement().onclick = function () {
            this.stopRevealLoop();
            this.stopRotationLoop();
            if (this.isSuperimposed()) {
                game.closeSuperimposedScreen();
            } else {
                game.setScreen('mainMenu');
            }
        }.bind(this);
        this._prevButton.getElement().onclick = function () {
            this.selectPreviousShip();
        }.bind(this);
        this._nextButton.getElement().onclick = function () {
            this.selectNextShip();
        }.bind(this);
    };

    /**
     * Getter for the _loadingBox property.
     * @returns {LoadingBox}
     */
    DatabaseScreen.prototype.getLoadingBox = function () {
        return this._loadingBox;
    };

    /**
     * Uses the loading box to show the status to the user.
     * @param {String} newStatus The status to show on the loading box. If
     * undefined, the status won't be updated.
     * @param {Number} newProgress The new value of the progress bar on the loading
     * box. If undefined, the value won't be updated.
     */
    DatabaseScreen.prototype.updateStatus = function (newStatus, newProgress) {
        if (newStatus !== undefined) {
            this._loadingBox.updateStatus(newStatus);
        }
        if (newProgress !== undefined) {
            this._loadingBox.updateProgress(newProgress);
        }
    };

    DatabaseScreen.prototype.startRevealLoop = function () {
        var prevDate = new Date(),
                maxRevealState = _showSolidModel() ? 2.2 : 1.0;
        this._revealState = _showWireframeModel() ? 0.0 : 1.0;
        this._revealLoop = setInterval(function () {
            var curDate = new Date();
            if (this._revealState < maxRevealState) {
                this._revealState = Math.min(this._revealState + (curDate - prevDate) / 1000 / 2, maxRevealState);
            } else {
                this.stopRevealLoop();
            }
            prevDate = curDate;
        }.bind(this), 1000 / 60); ///TODO: hardcoded value
    };

    DatabaseScreen.prototype.startRotationLoop = function () {
        var prevDate = new Date();
        // turn the ship to start the rotation facing the camera
        if (this._solidModel) {
            this._solidModel.setOrientationMatrix(mat.identity4());
            this._solidModel.rotate([0.0, 0.0, 1.0], Math.PI);
            this._solidModel.rotate([1.0, 0.0, 0.0], 60 / 180 * Math.PI);
        }
        if (this._wireframeModel) {
            this._wireframeModel.setOrientationMatrix(mat.identity4());
            this._wireframeModel.rotate([0.0, 0.0, 1.0], Math.PI);
            this._wireframeModel.rotate([1.0, 0.0, 0.0], 60 / 180 * Math.PI);
        }
        this._rotationLoop = setInterval(function () {
            var curDate = new Date();
            if (this._solidModel) {
                this._solidModel.rotate(this._item.getVisualModel().getZDirectionVector(), (curDate - prevDate) / 1000 * Math.PI / 2);
            }
            if (this._wireframeModel) {
                this._wireframeModel.rotate(this._item.getVisualModel().getZDirectionVector(), (curDate - prevDate) / 1000 * Math.PI / 2);
            }
            prevDate = curDate;
        }.bind(this), 1000 / 60); ///TODO: hardcoded value
    };

    DatabaseScreen.prototype.stopRevealLoop = function () {
        clearInterval(this._revealLoop);
        this._revealLoop = null;
    };

    DatabaseScreen.prototype.stopRotationLoop = function () {
        clearInterval(this._rotationLoop);
        this._rotationLoop = null;
    };

    DatabaseScreen.prototype.show = function () {
        screens.HTMLScreenWithCanvases.prototype.show.call(this);
        this.executeWhenReady(function () {
            this.initializeCanvas();
        });
    };

    DatabaseScreen.prototype.hide = function () {
        screens.HTMLScreenWithCanvases.prototype.hide.call(this);
        this.executeWhenReady(function () {
            this._scene.clearNodes();
            this.render();
        });
    };

    DatabaseScreen.prototype.initializeCanvas = function () {
        this._loadingBox.show();
        this.updateStatus("initializing database...", 0);

        this.resizeCanvas(this._name + "_databaseCanvas");
        var canvas = this.getScreenCanvas("databaseCanvas").getCanvasElement();
        if (_shouldUseShadowMapping()) {
            graphics.getShader("shadowMapping"); //TODO: hardcoded
        }
        // create a new scene and add a directional light source which will not change
        // while different objects are shown
        this._scene = new budaScene.Scene(
                0, 0, canvas.clientWidth, canvas.clientHeight,
                true, [true, true, true, true],
                logic.getSetting(logic.DATABASE_SETTINGS.BACKGROUND_COLOR), true,
                graphics.getLODContext());
        this._scene.addLightSource(new budaScene.LightSource([1.0, 1.0, 1.0], [0.0, 1.0, 1.0]));

        resources.executeOnResourceLoad(function (resourceName, totalResources, loadedResources) {
            this.updateStatus("loaded " + resourceName + ", total progress: " + loadedResources + "/" + totalResources, 20 + (loadedResources / totalResources) * 60);
        }.bind(this));
        resources.executeWhenReady(function () {
            if (_shouldUseShadowMapping()) {
                this._scene.setShadowMapping({
                    enable: true,
                    shader: graphics.getShader("shadowMapping").getManagedShader(), //TODO: hardcoded
                    textureSize: graphics.getShadowQuality(),
                    ranges: [],
                    depthRatio: graphics.getShadowDepthRatio()
                });
            } else {
                this._scene.setShadowMapping(null);
            }
            this.updateStatus("", 100);
            this._loadingBox.hide();
        }.bind(this));

        this.updateStatus("loading graphical resources...", 15);

        this._itemIndex = 0;
        this.loadShip();

        // when the user presses the mouse on the canvas, he can start rotating the model
        // by moving the mouse
        canvas.onmousedown = function (e) {
            if (_modelRotation()) {
                this._mousePos = [e.screenX, e.screenY];
                // automatic rotation should stop for the time of manual rotation
                this.stopRotationLoop();
                // the mouse might go out from over the canvas during rotation, so register the
                // move event handler on the document body
                document.body.onmousemove = function (e) {
                    if (this._solidModel) {
                        this._solidModel.rotate([0.0, 1.0, 0.0], -(e.screenX - this._mousePos[0]) / 180 * Math.PI);
                        this._solidModel.rotate([1.0, 0.0, 0.0], -(e.screenY - this._mousePos[1]) / 180 * Math.PI);
                    }
                    if (this._wireframeModel) {
                        this._wireframeModel.rotate([0.0, 1.0, 0.0], -(e.screenX - this._mousePos[0]) / 180 * Math.PI);
                        this._wireframeModel.rotate([1.0, 0.0, 0.0], -(e.screenY - this._mousePos[1]) / 180 * Math.PI);
                    }
                    this._mousePos = [e.screenX, e.screenY];
                }.bind(this);
                // once the user releases the mouse button, the event handlers should be cancelled
                // and the automatic rotation started again
                document.body.onmouseup = function (e) {
                    document.body.onmousemove = null;
                    document.body.onmouseup = null;
                    this.startRotationLoop();
                    e.preventDefault();
                    return false;
                }.bind(this);
            }
            e.preventDefault();
            return false;
        }.bind(this);
    };

    /**
     * Selects and displays the previous spacecraft class from the list on the database
     * screen. Loops around.
     */
    DatabaseScreen.prototype.selectPreviousShip = function () {
        // using % operator does not work with -1, reverted to "if"
        this._itemIndex -= 1;
        if (this._itemIndex === -1) {
            this._itemIndex = classes.getSpacecraftClassesInArray(true).length - 1;
        }
        this.loadShip();
    };

    /**
     * Selects and displays the next spacecraft class from the list on the database
     * screen. Loops around.
     */
    DatabaseScreen.prototype.selectNextShip = function () {
        this._itemIndex = (this._itemIndex + 1) % classes.getSpacecraftClassesInArray(true).length;
        this.loadShip();
    };

    /**
     * Load the information and model of the currently selected ship and display
     * them on the page.
     */
    DatabaseScreen.prototype.loadShip = function () {
        // the execution might take a few seconds, and is in the main thread, so
        // better inform the user
        document.body.style.cursor = 'wait';
        // stop the possible ongoing loops that display the previous ship to avoid
        // null reference
        this.stopRevealLoop();
        this.stopRotationLoop();
        this.stopRenderLoop();

        // clear the previous scene graph and render the empty scene to clear the
        // background of the canvas to transparent
        this._scene.clearNodes();
        this.render();

        logic.executeWhenReady(function () {
            // display the data that can be displayed right away, and show loading
            // for the rest
            var shipClass = classes.getSpacecraftClassesInArray(true)[this._itemIndex];
            this._itemName.setContent(shipClass.getFullName());
            this._itemType.setContent(shipClass.getSpacecraftType().getFullName());
            this._itemStats.setContent("");
            this._itemDescription.setContent("Loading...");

            // create a ship that can be used to add the models (ship with default weapons
            // to the scene
            this._item = new logic.Spacecraft(
                    shipClass,
                    mat.identity4(),
                    mat.identity4(),
                    null,
                    "default" //TODO: hardcoded
                    );
            // request the required shaders from the resource manager
            graphics.getShader("oneColorReveal"); //TODO: hardcoded
            if (_shouldUseShadowMapping()) {
                graphics.getShader("shadowMapReveal"); //TODO: hardcoded
            } else {
                graphics.getShader("simpleReveal"); //TODO: hardcoded
            }
            if (_showSolidModel()) {
                // add the ship to the scene in triangle drawing mode
                this._item.addToScene(this._scene, graphics.getMaxLoadedLOD(), false, {weapons: true}, function (model) {
                    this._solidModel = model;
                    // set the shader to reveal, so that we have a nice reveal animation when a new ship is selected
                    this._solidModel.getNode().setShader(_shouldUseShadowMapping() ?
                            graphics.getShader("shadowMapReveal").getManagedShader() //TODO: hardcoded
                            : graphics.getShader("simpleReveal").getManagedShader()); //TODO: hardcoded
                    // set the necessary uniform functions for the reveal shader
                    this._solidModel.setUniformValueFunction("u_revealFront", function () {
                        return true;
                    });
                    this._solidModel.setUniformValueFunction("u_revealStart", function () {
                        return this._itemFront - ((this._revealState - 1.0) * this._itemLength * 1.1);
                    }, this);
                    this._solidModel.setUniformValueFunction("u_revealTransitionLength", function () {
                        return this._itemLength / 10;
                    }, this);
                }.bind(this));
            } else {
                this._solidModel = null;
            }
            if (_showWireframeModel()) {
                // add the ship to the scene in line drawing mode as well
                this._item.addToScene(this._scene, graphics.getMaxLoadedLOD(), true, {weapons: true}, function (model) {
                    this._wireframeModel = model;
                    // set the shader to one colored reveal, so that we have a nice reveal animation when a new ship is selected
                    this._wireframeModel.getNode().setShader(graphics.getShader("oneColorReveal").getManagedShader()); //TODO: hardcoded
                    // set the necessary uniform functions for the one colored reveal shader
                    this._wireframeModel.setUniformValueFunction("u_color", function () {
                        return logic.getSetting(logic.DATABASE_SETTINGS.WIREFRAME_COLOR);
                    });
                    this._wireframeModel.setUniformValueFunction("u_revealFront", function () {
                        return (this._revealState <= 1.0);
                    }, this);
                    this._wireframeModel.setUniformValueFunction("u_revealStart", function () {
                        return this._itemFront - ((this._revealState > 1.0 ? (this._revealState - 1.0) : this._revealState) * this._itemLength * 1.1);
                    }, this);
                    this._wireframeModel.setUniformValueFunction("u_revealTransitionLength", function () {
                        return (this._revealState <= 1.0) ? (this._itemLength / 10) : 0;
                    }, this);
                }.bind(this));
            } else {
                this._wireframeModel = null;
            }

            // set the callback for when the potentially needed additional file resources have 
            // been loaded
            resources.executeWhenReady(function () {
                // get the length of the ship based on the length of its model
                this._itemLength = this._item.getVisualModel()._model.getHeight();
                this._itemLengthInMeters = this._item.getVisualModel()._model.getHeightInMeters();
                this._itemFront = this._item.getVisualModel()._model.getMaxY();
                this._itemStats.setContent(
                        "Length: " + utils.getLengthString(this._itemLengthInMeters) + "<br/>" +
                        "Mass: " + utils.getMassString(shipClass.getMass()) + "<br/>" +
                        "Armor: " + shipClass.getHitpoints() + "<br/>" +
                        "Weapon slots: " + shipClass.getWeaponSlots().length + "<br/>" +
                        "Thrusters: " + shipClass.getThrusterSlots().length);
                this._itemDescription.setContent(
                        shipClass.getDescription() + "<br/>" +
                        "<br/>" +
                        shipClass.getSpacecraftType().getDescription());
                // this will create the GL context if needed or update it with the new
                // data if it already exists
                this.bindSceneToCanvas(this._scene, this.getScreenCanvas("databaseCanvas"));
                // set the camera position so that the whole ship nicely fits into the picture
                this._scene.activeCamera.moveToPosition([0, 0, this._item.getVisualModel().getScaledSize()], 0);
                if (_shouldUseShadowMapping()) {
                    this._scene.setShadowMapRanges([
                        0.5 * this._item.getVisualModel().getScaledSize(),
                        this._item.getVisualModel().getScaledSize()
                    ]);
                    this._scene.enableShadowMapping();
                } else {
                    this._scene.disableShadowMapping();
                }

                var singleRender = true;
                if (_modelRotation()) {
                    this.startRotationLoop();
                    singleRender = false;
                }
                if (_shouldReveal()) {
                    this.startRevealLoop();
                    singleRender = false;
                } else {
                    this._revealState = 2.2;
                }
                if (singleRender) {
                    this._sceneCanvasBindings[0].canvas.getManagedContext().setup();
                    this.render();
                } else {
                    this.startRenderLoop(1000 / 60); //TODO: hardcoded
                }

                document.body.style.cursor = 'default';
            }.bind(this));

            // initiate the loading of additional file resources if they are needed
            resources.requestResourceLoad();
        }.bind(this));
    };

    return {
        DatabaseScreen: DatabaseScreen
    };
});