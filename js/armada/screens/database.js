/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, white: true, plusplus: true  */
/*global define, setInterval, clearInterval, document */

/**
 * 
 * @param utils
 * @param mat
 * @param components
 * @param screens
 * @param budaScene
 * @param game
 * @param resources
 * @param armadaScreens
 * @param strings
 * @param graphics
 * @param classes
 * @param logic
 */
define([
    "utils/utils",
    "utils/matrices",
    "modules/components",
    "modules/screens",
    "modules/buda-scene",
    "modules/game",
    "modules/graphics-resources",
    "armada/screens/shared",
    "armada/strings",
    "armada/graphics",
    "armada/classes",
    "armada/logic",
    "utils/polyfill"
], function (utils, mat, components, screens, budaScene, game, resources, armadaScreens, strings, graphics, classes, logic) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            REVEAL_FPS = 60,
            REVEAL_DURATION = 2000,
            REVEAL_SOLID_DELAY_DURATION = 2000,
            REVEAL_WIREFRAME_START_STATE = 0,
            REVEAL_WIREFRAME_END_STATE = 1,
            REVEAL_SOLID_START_STATE = 1,
            REVEAL_SOLID_END_STATE = 2.2,
            ROTATION_FPS = 60,
            ROTATION_START_ANGLE = 90,
            ROTATION_RESTART_ANGLE = 180,
            ROTATION_VIEW_ANGLE = 60,
            ROTATION_DURATION = 4000,
            ROTATION_SENSITIVITY = 1,
            LOOP_CANCELED = -1,
            ITEM_NAME_HEADER_ID = "itemName",
            ITEM_TYPE_HEADER_ID = "itemType",
            ITEM_STATS_PARAGRAPH_ID = "itemStats",
            ITEM_DESCRIPTION_PARAGRAPH_ID = "itemDescription",
            BACK_BUTTON_ID = "backButton",
            PREV_BUTTON_ID = "prevButton",
            NEXT_BUTTON_ID = "nextButton",
            LOADING_BOX_ID_SUFFIX = screens.ELEMENT_ID_SEPARATOR + "loadingBox",
            DATABASE_CANVAS_NAME = "databaseCanvas",
            DATABASE_CANVAS_ID_SUFFIX = screens.ELEMENT_ID_SEPARATOR + DATABASE_CANVAS_NAME,
            LIGHT_SOURCES = [
                {
                    COLOR: [1.0, 1.0, 1.0],
                    DIRECTION: [0.0, 1.0, 1.0]
                },
                {
                    COLOR: [0.5, 0.5, 0.5],
                    DIRECTION: [1.0, 0.0, 0.0]
                }
            ],
            LOADING_INITIAL_PROGRESS = 15,
            LOADING_RESOURCES_START_PROGRESS = 15,
            LOADING_RESOURCE_PROGRESS = 60,
            EQUIPMENT_PROFILE_NAME = "default",
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * @type Scene
             */
            _itemViewScene = null,
            /**
             * @type Spacecraft
             */
            _currentItem = null,
            /**
             * @type Number
             */
            _currentItemIndex = 0,
            /**
             * @type Number
             */
            _revealLoop = -1,
            /**
             * @type Number
             */
            _revealState = 0,
            /**
             * @type Number
             */
            _rotationLoop = -1,
            /**
             * @type ParameterizedMesh
             */
            _solidModel = null,
            /**
             * @type ParameterizedMesh
             */
            _wireframeModel = null,
            /**
             * @type Number[2]
             */
            _mousePos = null,
            /**
             * @type Number
             */
            _currentItemLength = 0,
            /**
             * @type Number
             */
            _currentItemLengthInMeters = 0,
            /**
             * The Y coordinate of the frontmost point of the 3D model of the currently shown item
             * @type Number
             */
            _currentItemFront = 0;
    // ------------------------------------------------------------------------------
    // private functions

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
     * Stops the loop that updates the reveal state (without changing the reveal state itself)
     */
    function _stopRevealLoop() {
        clearInterval(_revealLoop);
        _revealLoop = LOOP_CANCELED;
    }
    /**
     * Resets the reveal state and sets a loop to update it according to the current settings
     */
    function _startRevealLoop() {
        var
                revealStartDate = new Date(),
                maxRevealState = (_showSolidModel() ? REVEAL_SOLID_END_STATE : REVEAL_WIREFRAME_END_STATE),
                elapsedTime;
        _revealState = _showWireframeModel() ? REVEAL_WIREFRAME_START_STATE : REVEAL_SOLID_START_STATE;
        // creating the reveal function on-the-fly so we can use closures, and as a new loop is not started frequently
        _revealLoop = setInterval(function () {
            elapsedTime = new Date() - revealStartDate;
            // applying the solid reveal delay
            if (elapsedTime > REVEAL_SOLID_START_STATE * REVEAL_DURATION) {
                elapsedTime = Math.max(REVEAL_SOLID_START_STATE * REVEAL_DURATION, elapsedTime - REVEAL_SOLID_DELAY_DURATION);
            }
            // calculating the current reveal state
            if (_revealState < maxRevealState) {
                _revealState = Math.min(elapsedTime / REVEAL_DURATION, maxRevealState);
            } else {
                _stopRevealLoop();
            }
        }, 1000 / REVEAL_FPS);
    }
    /**
     * Stops the loop that updates the orientation of the shown items automatically (without changing their orientation)
     */
    function _stopRotationLoop() {
        clearInterval(_rotationLoop);
        _rotationLoop = LOOP_CANCELED;
    }
    /*
     * Start the loop that will keep updating the orientation or the shown items automatically according to the current rotation settings
     */
    function _startRotationLoop(startAngle) {
        var
                prevDate = new Date(),
                curDate,
                startOrientationMatrix = mat.mul4(
                        mat.rotation4([0.0, 0.0, 1.0], Math.radians(startAngle)),
                        mat.rotation4([1.0, 0.0, 0.0], Math.radians(ROTATION_VIEW_ANGLE)));
        // setting the starting orientation
        if (_solidModel) {
            _solidModel.setOrientationMatrix(mat.matrix4(startOrientationMatrix));
        }
        if (_wireframeModel) {
            _wireframeModel.setOrientationMatrix(mat.matrix4(startOrientationMatrix));
        }
        // setting the loop function
        _rotationLoop = setInterval(function () {
            curDate = new Date();
            if (_solidModel) {
                _solidModel.rotate(_currentItem.getVisualModel().getZDirectionVector(), (curDate - prevDate) * Math.radians(360 / ROTATION_DURATION));
            }
            if (_wireframeModel) {
                _wireframeModel.rotate(_currentItem.getVisualModel().getZDirectionVector(), (curDate - prevDate) * Math.radians(360 / ROTATION_DURATION));
            }
            prevDate = curDate;
        }, 1000 / ROTATION_FPS);
    }
    /**
     * @param {MouseEvent} event
     */
    function handleMouseMove(event) {
        if (_solidModel) {
            _solidModel.rotate([0.0, 1.0, 0.0], -(event.screenX - _mousePos[0]) * Math.radians(ROTATION_SENSITIVITY));
            _solidModel.rotate([1.0, 0.0, 0.0], -(event.screenY - _mousePos[1]) * Math.radians(ROTATION_SENSITIVITY));
        }
        if (_wireframeModel) {
            _wireframeModel.rotate([0.0, 1.0, 0.0], -(event.screenX - _mousePos[0]) * Math.radians(ROTATION_SENSITIVITY));
            _wireframeModel.rotate([1.0, 0.0, 0.0], -(event.screenY - _mousePos[1]) * Math.radians(ROTATION_SENSITIVITY));
        }
        _mousePos = [event.screenX, event.screenY];
    }
    /**
     * @param {MouseEvent} event
     * @returns {Boolean}
     */
    function handleMouseUp(event) {
        document.body.onmousemove = null;
        document.body.onmouseup = null;
        _startRotationLoop(ROTATION_RESTART_ANGLE);
        event.preventDefault();
        return false;
    }
    /**
     * @param {MouseEvent} event
     * @returns {Boolean}
     */
    function handleMouseDown(event) {
        if (logic.getSetting(logic.DATABASE_SETTINGS.MODEL_ROTATION)) {
            _mousePos = [event.screenX, event.screenY];
            // automatic rotation should stop for the time of manual rotation
            _stopRotationLoop();
            // the mouse might go out from over the canvas during rotation, so register the
            // move event handler on the document body
            document.body.onmousemove = handleMouseMove;
            // once the user releases the mouse button, the event handlers should be cancelled
            // and the automatic rotation started again
            document.body.onmouseup = handleMouseUp;
        }
        event.preventDefault();
        return false;
    }
    // ##############################################################################
    /**
     * @class Represents the database screen.
     * @extends HTMLScreenWithCanvases
     */
    function DatabaseScreen() {
        screens.HTMLScreenWithCanvases.call(this,
                armadaScreens.DATABASE_SCREEN_NAME,
                armadaScreens.DATABASE_SCREEN_SOURCE,
                graphics.getAntialiasing(),
                graphics.getFiltering());
        /**
         * @type SimpleComponent
         */
        this._itemNameHeader = this.registerSimpleComponent(ITEM_NAME_HEADER_ID);
        /**
         * @type SimpleComponent
         */
        this._itemTypeHeader = this.registerSimpleComponent(ITEM_TYPE_HEADER_ID);
        /**
         * @type SimpleComponent
         */
        this._itemStatsParagraph = this.registerSimpleComponent(ITEM_STATS_PARAGRAPH_ID);
        /**
         * @type SimpleComponent
         */
        this._itemDescriptionParagraph = this.registerSimpleComponent(ITEM_DESCRIPTION_PARAGRAPH_ID);
        /**
         * @type SimpleComponent
         */
        this._backButton = this.registerSimpleComponent(BACK_BUTTON_ID);
        /**
         * @type SimpleComponent
         */
        this._prevButton = this.registerSimpleComponent(PREV_BUTTON_ID);
        /**
         * @type SimpleComponent
         */
        this._nextButton = this.registerSimpleComponent(NEXT_BUTTON_ID);
        /**
         * @type LoadingBox
         */
        this._loadingBox = this.registerExternalComponent(
                new components.LoadingBox(
                        this._name + LOADING_BOX_ID_SUFFIX,
                        armadaScreens.LOADING_BOX_SOURCE,
                        armadaScreens.LOADING_BOX_CSS,
                        strings.LOADING.HEADER.name));
    }
    DatabaseScreen.prototype = new screens.HTMLScreenWithCanvases();
    DatabaseScreen.prototype.constructor = DatabaseScreen;
    /**
     * @override
     * Nulls out the components and module objects
     */
    DatabaseScreen.prototype.removeFromPage = function () {
        screens.HTMLScreenWithCanvases.prototype.removeFromPage.call(this);
        _stopRevealLoop();
        _stopRotationLoop();
        _itemViewScene = null; //TODO: proper cleanup of the scene
        _currentItem = null;
        _solidModel = null;
        _wireframeModel = null;
    };
    /**
     * @override
     */
    DatabaseScreen.prototype._initializeComponents = function () {
        screens.HTMLScreenWithCanvases.prototype._initializeComponents.call(this);
        this._backButton.getElement().onclick = function () {
            _stopRevealLoop();
            _stopRotationLoop();
            game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
        };
        this._prevButton.getElement().onclick = function () {
            this.selectPreviousShip();
        }.bind(this);
        this._nextButton.getElement().onclick = function () {
            this.selectNextShip();
        }.bind(this);
    };
    /**
     * @override
     */
    DatabaseScreen.prototype._updateComponents = function () {
        screens.HTMLScreenWithCanvases.prototype._updateComponents.call(this);
        // TODO: update item info
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
    /**
     * 
     */
    DatabaseScreen.prototype.initializeCanvas = function () {
        var canvas, i;
        this._loadingBox.show();
        this.updateStatus(strings.get(strings.DATABASE.LOADING_INITIALIZING), 0);
        this.resizeCanvas(this._name + DATABASE_CANVAS_ID_SUFFIX);
        if (graphics.shouldUseShadowMapping()) {
            graphics.getShadowMappingShader();
        }
        canvas = this.getScreenCanvas(DATABASE_CANVAS_NAME).getCanvasElement();
        _itemViewScene = new budaScene.Scene(
                0, 0, canvas.clientWidth, canvas.clientHeight,
                true, [true, true, true, true],
                logic.getSetting(logic.DATABASE_SETTINGS.BACKGROUND_COLOR), true,
                graphics.getLODContext());
        for (i = 0; i < LIGHT_SOURCES.length; i++) {
            _itemViewScene.addLightSource(new budaScene.LightSource(LIGHT_SOURCES[i].COLOR, LIGHT_SOURCES[i].DIRECTION));
        }
        resources.executeOnResourceLoad(function (resourceName, totalResources, loadedResources) {
            this.updateStatus(
                    utils.formatString(strings.get(strings.LOADING.RESOURCE_READY), {
                        resource: resourceName,
                        loaded: loadedResources,
                        total: totalResources
                    }),
                    LOADING_RESOURCES_START_PROGRESS + (loadedResources / totalResources) * LOADING_RESOURCE_PROGRESS);
        }.bind(this));
        resources.executeWhenReady(function () {
            if (graphics.shouldUseShadowMapping()) {
                _itemViewScene.setShadowMapping({
                    enable: true,
                    shader: graphics.getShadowMappingShader().getManagedShader(),
                    textureSize: graphics.getShadowQuality(),
                    ranges: [],
                    depthRatio: graphics.getShadowDepthRatio()
                });
            } else {
                _itemViewScene.setShadowMapping(null);
            }
            this.updateStatus(strings.get(strings.LOADING.READY), 100);
            this._loadingBox.hide();
        }.bind(this));
        this.updateStatus(strings.get(strings.LOADING.RESOURCES_START), LOADING_INITIAL_PROGRESS);
        _currentItemIndex = 0;
        this.loadShip();
        // when the user presses the mouse on the canvas, he can start rotating the model
        // by moving the mouse
        canvas.onmousedown = handleMouseDown;
    };
    /**
     * @override
     */
    DatabaseScreen.prototype.show = function () {
        screens.HTMLScreenWithCanvases.prototype.show.call(this);
        this.executeWhenReady(function () {
            this.initializeCanvas();
        });
    };
    /**
     * @override
     */
    DatabaseScreen.prototype.hide = function () {
        screens.HTMLScreenWithCanvases.prototype.hide.call(this);
        this.executeWhenReady(function () {
            _itemViewScene.clearNodes();
            this.render();
        });
    };
    /**
     * Selects and displays the previous spacecraft class from the list on the database
     * screen. Loops around.
     */
    DatabaseScreen.prototype.selectPreviousShip = function () {
        // using % operator does not work with -1, reverted to "if"
        _currentItemIndex -= 1;
        if (_currentItemIndex === -1) {
            _currentItemIndex = classes.getSpacecraftClassesInArray(true).length - 1;
        }
        this.loadShip();
    };
    /**
     * Selects and displays the next spacecraft class from the list on the database
     * screen. Loops around.
     */
    DatabaseScreen.prototype.selectNextShip = function () {
        _currentItemIndex = (_currentItemIndex + 1) % classes.getSpacecraftClassesInArray(true).length;
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
        _stopRevealLoop();
        _stopRotationLoop();
        this.stopRenderLoop();
        // clear the previous scene graph and render the empty scene to clear the
        // background of the canvas 
        _itemViewScene.clearNodes();
        this.render();
        logic.executeWhenReady(function () {
            // display the data that can be displayed right away, and show loading
            // for the rest
            var shipClass = classes.getSpacecraftClassesInArray(true)[_currentItemIndex];
            this._itemNameHeader.setContent(shipClass.getFullName());
            this._itemTypeHeader.setContent(strings.get(
                    strings.SPACECRAFT_TYPE.PREFIX,
                    shipClass.getSpacecraftType().getName() + strings.SPACECRAFT_TYPE.NAME_SUFFIX.name,
                    shipClass.getSpacecraftType().getFullName()));
            this._itemStatsParagraph.setContent("");
            this._itemDescriptionParagraph.setContent("Loading...");
            // create a ship that can be used to add the models (ship with default weapons
            // to the scene
            _currentItem = new logic.Spacecraft(
                    shipClass,
                    mat.identity4(),
                    mat.identity4(),
                    null,
                    EQUIPMENT_PROFILE_NAME);
            // request the required shaders from the resource manager
            graphics.getShader("oneColorReveal"); //TODO: hardcoded
            if (graphics.shouldUseShadowMapping()) {
                graphics.getShader("shadowMapReveal"); //TODO: hardcoded
            } else {
                graphics.getShader("simpleReveal"); //TODO: hardcoded
            }
            if (_showSolidModel()) {
                // add the ship to the scene in triangle drawing mode
                _currentItem.addToScene(_itemViewScene, graphics.getMaxLoadedLOD(), false, {weapons: true}, function (model) {
                    _solidModel = model;
                    // set the shader to reveal, so that we have a nice reveal animation when a new ship is selected
                    _solidModel.getNode().setShader(graphics.shouldUseShadowMapping() ?
                            graphics.getShader("shadowMapReveal").getManagedShader() //TODO: hardcoded
                            : graphics.getShader("simpleReveal").getManagedShader()); //TODO: hardcoded
                    // set the necessary uniform functions for the reveal shader
                    _solidModel.setUniformValueFunction("u_revealFront", function () {
                        return true;
                    });
                    _solidModel.setUniformValueFunction("u_revealStart", function () {
                        return _currentItemFront - ((_revealState - 1.0) * _currentItemLength * 1.1);
                    }, this);
                    _solidModel.setUniformValueFunction("u_revealTransitionLength", function () {
                        return _currentItemLength / 10;
                    }, this);
                }.bind(this));
            } else {
                _solidModel = null;
            }
            if (_showWireframeModel()) {
                // add the ship to the scene in line drawing mode as well
                _currentItem.addToScene(_itemViewScene, graphics.getMaxLoadedLOD(), true, {weapons: true}, function (model) {
                    _wireframeModel = model;
                    // set the shader to one colored reveal, so that we have a nice reveal animation when a new ship is selected
                    _wireframeModel.getNode().setShader(graphics.getShader("oneColorReveal").getManagedShader()); //TODO: hardcoded
                    // set the necessary uniform functions for the one colored reveal shader
                    _wireframeModel.setUniformValueFunction("u_color", function () {
                        return logic.getSetting(logic.DATABASE_SETTINGS.WIREFRAME_COLOR);
                    });
                    _wireframeModel.setUniformValueFunction("u_revealFront", function () {
                        return (_revealState <= 1.0);
                    }, this);
                    _wireframeModel.setUniformValueFunction("u_revealStart", function () {
                        return _currentItemFront - ((_revealState > 1.0 ? (_revealState - 1.0) : _revealState) * _currentItemLength * 1.1);
                    }, this);
                    _wireframeModel.setUniformValueFunction("u_revealTransitionLength", function () {
                        return (_revealState <= 1.0) ? (_currentItemLength / 10) : 0;
                    }, this);
                }.bind(this));
            } else {
                _wireframeModel = null;
            }

            // set the callback for when the potentially needed additional file resources have 
            // been loaded
            resources.executeWhenReady(function () {
                // get the length of the ship based on the length of its model
                _currentItemLength = _currentItem.getVisualModel()._model.getHeight();
                _currentItemLengthInMeters = _currentItem.getVisualModel()._model.getHeightInMeters();
                _currentItemFront = _currentItem.getVisualModel()._model.getMaxY();
                this._itemStatsParagraph.setContent(
                        strings.get(strings.DATABASE.LENGTH) + ": " + utils.getLengthString(_currentItemLengthInMeters) + "<br/>" +
                        strings.get(strings.DATABASE.MASS) + ": " + utils.getMassString(shipClass.getMass()) + "<br/>" +
                        strings.get(strings.DATABASE.ARMOR) + ": " + shipClass.getHitpoints() + "<br/>" +
                        strings.get(strings.DATABASE.WEAPON_SLOTS) + ": " + shipClass.getWeaponSlots().length + "<br/>" +
                        strings.get(strings.DATABASE.THRUSTERS) + ": " + shipClass.getThrusterSlots().length);
                this._itemDescriptionParagraph.setContent(
                        shipClass.getDescription() + "<br/>" +
                        "<br/>" +
                        shipClass.getSpacecraftType().getDescription());
                // this will create the GL context if needed or update it with the new
                // data if it already exists
                this.bindSceneToCanvas(_itemViewScene, this.getScreenCanvas("databaseCanvas"));
                // set the camera position so that the whole ship nicely fits into the picture
                _itemViewScene.activeCamera.moveToPosition([0, 0, _currentItem.getVisualModel().getScaledSize()], 0);
                if (graphics.shouldUseShadowMapping()) {
                    _itemViewScene.setShadowMapRanges([
                        0.5 * _currentItem.getVisualModel().getScaledSize(),
                        _currentItem.getVisualModel().getScaledSize()
                    ]);
                    _itemViewScene.enableShadowMapping();
                } else {
                    _itemViewScene.disableShadowMapping();
                }

                var singleRender = true;
                if (logic.getSetting(logic.DATABASE_SETTINGS.MODEL_ROTATION)) {
                    _startRotationLoop(ROTATION_START_ANGLE);
                    singleRender = false;
                }
                if (_shouldReveal()) {
                    _startRevealLoop();
                    singleRender = false;
                } else {
                    _revealState = 2.2;
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
        databaseScreen: new DatabaseScreen()
    };
});