/**
 * Copyright 2014-2017 Krisztián Nagy
 * @file This module manages and provides the in-game database screen.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, white: true, plusplus: true  */
/*global define, setInterval, clearInterval, document, performance */

/**
 * @param utils Used for string formatting and async calls.
 * @param mat Used for the rotation and scaling of item view models.
 * @param components Used for the components (i.e. the loading box) of the screen.
 * @param screens The database screen is a HTMLScreenWithCanvases.
 * @param lights Used for creating and setting up light sources
 * @param sceneGraph Used for creating and setting up the item view scene.
 * @param game Used for navigation.
 * @param resources Used for requesting and waiting for resource loads.
 * @param armadaScreens Used for common screen constants.
 * @param strings Used for translation support.
 * @param graphics Used for accessing graphics settings and shaders appropriate for current graphics settings.
 * @param classes Used for accessing the array of displayable spacecraft classes.
 * @param config Used for accessing settings 
 * @param missions Used for waiting for environment loading
 * @param spacecraft Used for creating the spacecraft to be shown in the item view box.
 */
define([
    "utils/utils",
    "utils/matrices",
    "modules/components",
    "modules/screens",
    "modules/game",
    "modules/media-resources",
    "modules/scene/lights",
    "modules/scene/scene-graph",
    "armada/screens/shared",
    "armada/strings",
    "armada/graphics",
    "armada/logic/classes",
    "armada/configuration",
    "armada/logic/missions",
    "armada/logic/spacecraft",
    "utils/polyfill"
], function (
        utils, mat,
        components, screens, game, resources,
        lights, sceneGraph,
        armadaScreens, strings, graphics, classes, config, missions, spacecraft) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            REVEAL_WIREFRAME_START_STATE = 0,
            REVEAL_WIREFRAME_END_STATE = REVEAL_WIREFRAME_START_STATE + 1,
            REVEAL_SOLID_START_STATE = REVEAL_WIREFRAME_END_STATE,
            REVEAL_SOLID_END_STATE = REVEAL_SOLID_START_STATE + 1,
            LOOP_CANCELED = -1,
            ITEM_NAME_HEADER_ID = "itemName",
            ITEM_TYPE_HEADER_ID = "itemType",
            ITEM_STATS_PARAGRAPH_ID = "itemStats",
            ITEM_DESCRIPTION_PARAGRAPH_ID = "itemDescription",
            BACK_BUTTON_ID = "backButton",
            PREV_BUTTON_ID = "prevButton",
            NEXT_BUTTON_ID = "nextButton",
            LOADING_BOX_ID = "loadingBox",
            DATABASE_CANVAS_NAME = "databaseCanvas",
            LOADING_INITIAL_PROGRESS = 15,
            LOADING_RESOURCES_START_PROGRESS = 15,
            LOADING_RESOURCE_PROGRESS = 60,
            LOADING_INIT_WEBGL_PROGRESS = LOADING_RESOURCES_START_PROGRESS + LOADING_RESOURCE_PROGRESS,
            UNIFORM_REVEAL_FRONT_NAME = "revealFront",
            UNIFORM_REVEAL_START_NAME = "revealStart",
            UNIFORM_REVEAL_TRANSITION_LENGTH_NAME = "revealTransitionLength",
            UNIFORM_REVEAL_COLOR_NAME = "revealColor",
            UNIFORM_WIREFRAME_COLOR_NAME = "color",
            ENLARGE_FACTOR = 1.05,
            SHRINK_FACTOR = 0.95,
            SETTINGS = config.DATABASE_SETTINGS,
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * This is the scene used to render models of the currently viewed item.
             * @type Scene
             */
            _itemViewScene = null,
            /**
             * A game-logic instance of the currently viewed item that is used to generate models of it.
             * @type Spacecraft
             */
            _currentItem = null,
            /**
             * The index of the currently viewed item in the array of all spacecrafts available for the database.
             * @type Number
             */
            _currentItemIndex = 0,
            /**
             * The ID for the loop that is modifying the reveal state that is sent to the shaders for the reveal effect.
             * @type Number
             */
            _revealLoop = -1,
            /**
             * The current state (progress) of the reveal animation that is sent to the shaders.
             * @type Number
             */
            _revealState = 0,
            /**
             * The ID for the loop that is updating the orientation of the models to follow a rotation around their Z axis.
             * @type Number
             */
            _rotationLoop = -1,
            /**
             * The model to which the current item is loaded in triangle rendering mode.
             * @type ParameterizedMesh
             */
            _solidModel = null,
            /**
             * The model to which the current item is loaded in wireframe (line) rendering mode.
             * @type ParameterizedMesh
             */
            _wireframeModel = null,
            /**
             * Stores the previous mouse position to allow rotation of the current item by dragging it with the mouse.
             * @type Number[2]
             */
            _mousePos = null,
            /**
             * The starting scale of the currently loaded model(s)
             * @type Number
             */
            _currentItemOriginalScale = 0,
            /**
             * The size of the currently loaded models on the Y axis in meters
             * @type Number
             */
            _currentItemLengthInMeters = 0,
            /**
             * Whether we are in the first load cycle (no items have been loaded yet)
             * @type Boolean
             */
            _firstLoad = true;
    // ------------------------------------------------------------------------------
    // private functions
    /**
     * A shortcut to retrieving settings from the logic context
     * @param {Object} settingDescriptor
     */
    function _getSetting(settingDescriptor) {
        return config.getSetting(settingDescriptor);
    }
    /**
     * A shortcut that returns whether the wireframe model should be rendered according to the current settings
     * @returns {Boolean}
     */
    function _showWireframeModel() {
        return graphics.isRevealAvailable() ?
                _getSetting(SETTINGS.SHOW_WIREFRAME_MODEL) :
                !_getSetting(SETTINGS.SHOW_SOLID_MODEL);
    }
    /**
     * A shortcut that returns whether the reveal animation should be rendered according to the current settings
     * @returns {Boolean}
     */
    function _shouldReveal() {
        return graphics.isRevealAvailable() &&
                _getSetting(SETTINGS.MODEL_REVEAL_ANIMATION);
    }
    /**
     * Stops the loop that updates the reveal state (without changing the reveal state itself)
     */
    function _stopRevealLoop() {
        clearInterval(_revealLoop);
        _revealLoop = LOOP_CANCELED;
    }
    /**
     * Resets the current reveal state to its initial (no parts revealed) state.
     */
    function _resetRevealState() {
        _revealState = 0;
    }
    /**F
     * Resets the reveal state and sets a loop to update it according to the current settings
     */
    function _startRevealLoop() {
        var
                revealStartDate = performance.now(),
                startRevealState = _showWireframeModel() ? REVEAL_WIREFRAME_START_STATE : REVEAL_SOLID_START_STATE,
                maxRevealState = (_getSetting(SETTINGS.SHOW_SOLID_MODEL) ? REVEAL_SOLID_END_STATE : REVEAL_WIREFRAME_END_STATE),
                elapsedTime;
        _revealState = startRevealState;
        if (_revealLoop !== LOOP_CANCELED) {
            clearInterval(_revealLoop);
        }
        // creating the reveal function on-the-fly so we can use closures, and as a new loop is not started frequently
        _revealLoop = setInterval(function () {
            elapsedTime = performance.now() - revealStartDate;
            // applying the solid reveal delay
            if (elapsedTime > REVEAL_SOLID_START_STATE * _getSetting(SETTINGS.REVEAL_DURATION)) {
                elapsedTime = Math.max(REVEAL_SOLID_START_STATE * _getSetting(SETTINGS.REVEAL_DURATION), elapsedTime - _getSetting(SETTINGS.REVEAL_SOLID_DELAY_DURATION));
            }
            // calculating the current reveal state
            if (_revealState < maxRevealState) {
                _revealState = Math.min(startRevealState + elapsedTime / _getSetting(SETTINGS.REVEAL_DURATION), maxRevealState);
            } else {
                _stopRevealLoop();
                _itemViewScene.setShouldAnimate(true);
            }
        }, 1000 / _getSetting(SETTINGS.REVEAL_FPS));
    }
    /**
     * Stops the loop that updates the orientation of the shown items automatically (without changing their orientation)
     */
    function _stopRotationLoop() {
        clearInterval(_rotationLoop);
        _rotationLoop = LOOP_CANCELED;
    }
    /**
     * Sets the model orientation to be rotated by the passed angle (around the Z axis - around the X axis it will be rotated according to
     * the corresponding setting)
     * @param {Number} angle The angle in degrees
     */
    function _setRotation(angle) {
        var orientationMatrix = mat.prod3x3SubOf4Aux(
                mat.rotationZ4Aux(Math.radians(angle)),
                mat.rotationX4Aux(Math.radians(_getSetting(SETTINGS.ROTATION_VIEW_ANGLE))));
        if (_solidModel) {
            _solidModel.setOrientationMatrix(mat.matrix4(orientationMatrix));
        }
        if (_wireframeModel) {
            _wireframeModel.setOrientationMatrix(mat.matrix4(orientationMatrix));
        }
    }
    /*
     * Start the loop that will keep updating the orientation or the shown items automatically according to the current rotation settings
     * @param {Number} startAngle The starting angle in degrees
     */
    function _startRotationLoop(startAngle) {
        var
                prevDate = performance.now(),
                curDate;
        // setting the starting orientation
        _setRotation(startAngle);
        if (_rotationLoop !== LOOP_CANCELED) {
            clearInterval(_rotationLoop);
        }
        // setting the loop function
        _rotationLoop = setInterval(function () {
            var visualModel = _currentItem.getVisualModel();
            curDate = performance.now();
            if (visualModel) {
                if (_solidModel) {
                    _solidModel.rotate(visualModel.getZDirectionVector(), (curDate - prevDate) * Math.radians(360 / _getSetting(SETTINGS.ROTATION_DURATION)));
                }
                if (_wireframeModel) {
                    _wireframeModel.rotate(visualModel.getZDirectionVector(), (curDate - prevDate) * Math.radians(360 / _getSetting(SETTINGS.ROTATION_DURATION)));
                }
            }
            prevDate = curDate;
        }, 1000 / _getSetting(SETTINGS.ROTATION_FPS));
    }
    /**
     * Resizes the currently rendered models using the given scale, but making sure their size remains within the set limits
     * @param {Number} scale
     */
    function _scaleModels(scale) {
        scale = Math.min(Math.max(_currentItemOriginalScale * _getSetting(SETTINGS.MIN_SIZE_FACTOR), scale), _currentItemOriginalScale * _getSetting(SETTINGS.MAX_SIZE_FACTOR));
        if (_wireframeModel) {
            _wireframeModel.setScalingMatrix(mat.scaling4(scale));
        }
        if (_solidModel) {
            _solidModel.setScalingMatrix(mat.scaling4(scale));
        }
    }
    /**
     * Sets the uniform value functions related to the wireframe reveal state for the passed model.
     * @param {ParameterizedMesh} model
     */
    function _setWireframeRevealUniformFunctions(model) {
        var front = model.getMaxY(), length = model.getHeight();
        model.setUniformValueFunction(UNIFORM_WIREFRAME_COLOR_NAME, function () {
            return _getSetting(SETTINGS.WIREFRAME_COLOR);
        });
        model.setUniformValueFunction(UNIFORM_REVEAL_FRONT_NAME, function () {
            // while revealing the solid model, the wireframe model will disappear starting from the other side
            return (_revealState <= REVEAL_WIREFRAME_END_STATE);
        });
        model.setUniformValueFunction(UNIFORM_REVEAL_START_NAME, function () {
            return front - (
                    (_revealState > REVEAL_WIREFRAME_END_STATE ? (_revealState - REVEAL_WIREFRAME_END_STATE) : _revealState) *
                    length * (1 + _getSetting(SETTINGS.REVEAL_TRANSITION_LENGTH_FACTOR)));
        });
        model.setUniformValueFunction(UNIFORM_REVEAL_TRANSITION_LENGTH_NAME, function () {
            return (_revealState <= REVEAL_WIREFRAME_END_STATE) ? length * _getSetting(SETTINGS.REVEAL_TRANSITION_LENGTH_FACTOR) : 0;
        });
        model.setUniformValueFunction(UNIFORM_REVEAL_COLOR_NAME, function () {
            return _getSetting(SETTINGS.REVEAL_COLOR);
        });
    }
    /**
     * Sets the uniform value functions related to the solid reveal state for the passed model.
     * @param {ParameterizedMesh} model
     */
    function _setSolidRevealUniformFunctions(model) {
        var front = model.getMaxY(), length = model.getHeight();
        model.setUniformValueFunction(UNIFORM_REVEAL_FRONT_NAME, function () {
            return true;
        });
        model.setUniformValueFunction(UNIFORM_REVEAL_START_NAME, function () {
            return front - ((_revealState - REVEAL_SOLID_START_STATE) * length * (1 + _getSetting(SETTINGS.REVEAL_TRANSITION_LENGTH_FACTOR)));
        });
        model.setUniformValueFunction(UNIFORM_REVEAL_TRANSITION_LENGTH_NAME, function () {
            return (_revealState < REVEAL_SOLID_END_STATE) ? length * _getSetting(SETTINGS.REVEAL_TRANSITION_LENGTH_FACTOR) : 0;
        });
        model.setUniformValueFunction(UNIFORM_REVEAL_COLOR_NAME, function () {
            return _getSetting(SETTINGS.REVEAL_COLOR);
        });
    }
    /**
     * Creates the game-logic item corresponding to the currently selected spacecraft class and marks all resources that need to be loaded
     * to display the its models for loading as well as sets the callbacks to set up the models after the resources have been loaded.
     */
    function _setupCurrentItemAndModels() {
        // create a ship that can be used to add the models to the scene
        _currentItem = new spacecraft.Spacecraft(
                classes.getSpacecraftClassesInArray(true)[_currentItemIndex],
                null,
                mat.identity4(),
                mat.identity4(),
                _getSetting(SETTINGS.EQUIPMENT_PROFILE_NAME));
        // request the required shaders from the resource manager
        graphics.getShader(_getSetting(SETTINGS.WIREFRAME_SHADER_NAME));
        graphics.getShader(_getSetting(SETTINGS.SOLID_SHADER_NAME));
        if (_getSetting(SETTINGS.SHOW_SOLID_MODEL)) {
            // add the ship to the scene in triangle drawing mode
            _currentItem.addToScene(_itemViewScene, graphics.getMaxLoadedLOD(), false, {weapons: true, lightSources: true, blinkers: true}, {
                // set the shader to reveal, so that we have a nice reveal animation when a new ship is selected
                shaderName: _getSetting(SETTINGS.SOLID_SHADER_NAME)
            }, function (model) {
                _solidModel = model;
                // set the necessary uniform functions for the reveal shader
                _setSolidRevealUniformFunctions(_solidModel);
            }, function (model) {
                _setSolidRevealUniformFunctions(model);
            });
        } else {
            _solidModel = null;
        }
        if (_showWireframeModel()) {
            // add the ship to the scene in line drawing mode as well
            _currentItem.addToScene(_itemViewScene, graphics.getMaxLoadedLOD(), true, {weapons: true}, {
                // set the shader to one colored reveal, so that we have a nice reveal animation when a new ship is selected
                shaderName: _getSetting(SETTINGS.WIREFRAME_SHADER_NAME)
            }, function (model) {
                _wireframeModel = model;
                // set the necessary uniform functions for the one colored reveal shader
                _setWireframeRevealUniformFunctions(_wireframeModel);
            }, function (model) {
                _setWireframeRevealUniformFunctions(model);
            });
        } else {
            _wireframeModel = null;
        }
    }
    /**
     * A handler for the mouse move event that rotates the displayed models according to the mouse movement.
     * @param {MouseEvent} event
     */
    function handleMouseMove(event) {
        if (_solidModel) {
            _solidModel.rotate([0.0, 1.0, 0.0], -(event.screenX - _mousePos[0]) * Math.radians(_getSetting(SETTINGS.ROTATION_MOUSE_SENSITIVITY)));
            _solidModel.rotate([1.0, 0.0, 0.0], -(event.screenY - _mousePos[1]) * Math.radians(_getSetting(SETTINGS.ROTATION_MOUSE_SENSITIVITY)));
        }
        if (_wireframeModel) {
            _wireframeModel.rotate([0.0, 1.0, 0.0], -(event.screenX - _mousePos[0]) * Math.radians(_getSetting(SETTINGS.ROTATION_MOUSE_SENSITIVITY)));
            _wireframeModel.rotate([1.0, 0.0, 0.0], -(event.screenY - _mousePos[1]) * Math.radians(_getSetting(SETTINGS.ROTATION_MOUSE_SENSITIVITY)));
        }
        _mousePos = [event.screenX, event.screenY];
    }
    /**
     * A handler for the mouse up event that cancels the rotation by the mouse and restarts the automatic rotation.
     * @param {MouseEvent} event
     * @returns {Boolean}
     */
    function handleMouseUp(event) {
        document.body.onmousemove = null;
        document.body.onmouseup = null;
        if (_currentItem && _getSetting(SETTINGS.MODEL_AUTO_ROTATION)) {
            _startRotationLoop(_getSetting(SETTINGS.ROTATION_START_ANGLE));
        }
        event.preventDefault();
        return false;
    }
    /**
     * A handler for the mouse down event that sets the other handlers to switch from automatic to mouse model rotation
     * @param {MouseEvent} event
     * @returns {Boolean}
     */
    function handleMouseDown(event) {
        if (_getSetting(SETTINGS.MODEL_MOUSE_ROTATION)) {
            _mousePos = [event.screenX, event.screenY];
            // automatic rotation should stop for the time of manual rotation
            if (_getSetting(SETTINGS.MODEL_AUTO_ROTATION)) {
                _stopRotationLoop();
            }
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
    /**
     * A handler for the wheel event that fires when the user scrolls with the mouse, that resizes the model according to the direction
     * of the scrolling
     * @param {WheelEvent} event
     * @returns {Boolean}
     */
    function handleWheel(event) {
        var originalScale, scaleFactor = 0;
        if (event.deltaY > 0) {
            scaleFactor = SHRINK_FACTOR;
        }
        if (event.deltaY < 1) {
            scaleFactor = ENLARGE_FACTOR;
        }
        if (scaleFactor) {
            originalScale = _currentItem.getVisualModel().getScalingMatrix()[0];
            _scaleModels(originalScale * scaleFactor);
        }
        return false;
    }
    /**
     * Returns a format string that can be used for the stats paragraph and is translated to the current language, but only has the 
     * placeholders for the stat values
     * @returns {String}
     */
    function getStatsFormatString() {
        return strings.get(strings.DATABASE.LENGTH) + ": {length}<br/>" +
                strings.get(strings.DATABASE.MASS) + ": {mass}<br/>" +
                strings.get(strings.SPACECRAFT_STATS.ARMOR) + ": {armor} (" +
                strings.get(strings.SPACECRAFT_STATS.ARMOR_RATING) + ")<br/>" +
                strings.get(strings.DATABASE.WEAPON_SLOTS) + ": {weaponSlots}<br/>" +
                strings.get(strings.DATABASE.THRUSTERS) + ": {thrusters}";
    }
    /**
     * Stops the ongoing loops and closes the database screen.
     */
    function _closeScreen() {
        _stopRevealLoop();
        _stopRotationLoop();
        game.closeOrNavigateTo(armadaScreens.MAIN_MENU_SCREEN_NAME);
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
                {
                    cssFilename: armadaScreens.DATABASE_SCREEN_CSS,
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                graphics.getAntialiasing(),
                true,
                graphics.getFiltering(),
                _getSetting(config.GENERAL_SETTINGS.USE_REQUEST_ANIM_FRAME),
                undefined,
                {
                    "escape": _closeScreen,
                    "left": this.selectPreviousShip.bind(this),
                    "right": this.selectNextShip.bind(this)
                },
                armadaScreens.BUTTON_EVENT_HANDLERS);
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
                        LOADING_BOX_ID,
                        armadaScreens.LOADING_BOX_SOURCE,
                        {cssFilename: armadaScreens.LOADING_BOX_CSS},
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
        _itemViewScene.clearNodes(true);
        _itemViewScene.clearPointLights();
        _itemViewScene.clearSpotLights();
        _itemViewScene = null;
        if (_currentItem) {
            _currentItem.destroy();
            _currentItem = null;
        }
        _solidModel = null;
        _wireframeModel = null;
    };
    /**
     * @override
     */
    DatabaseScreen.prototype._initializeComponents = function () {
        screens.HTMLScreenWithCanvases.prototype._initializeComponents.call(this);
        this._backButton.getElement().onclick = _closeScreen;
        this._prevButton.getElement().onclick = function () {
            this.selectPreviousShip();
        }.bind(this);
        this._nextButton.getElement().onclick = function () {
            this.selectNextShip();
        }.bind(this);
    };
    /**
     * Updates the name, stat and description headers/paragraphs with the info about the currently selected spacecraft class
     */
    DatabaseScreen.prototype._updateItemInfo = function () {
        var shipClass = classes.getSpacecraftClassesInArray(true)[_currentItemIndex];
        _currentItemLengthInMeters = (_currentItem && _currentItem.getVisualModel()) ? _currentItem.getVisualModel().getHeightInMeters() : 0;
        // full names can have translations, that need to refer to the name of the spacecraft class / type, and if they exist,
        // then they are displayed, otherwise the stock value is displayed
        this._itemNameHeader.setContent(shipClass.getDisplayName());
        this._itemTypeHeader.setContent(shipClass.getSpacecraftType().getDisplayName());
        this._itemStatsParagraph.setContent(getStatsFormatString(), {
            length: (_currentItemLengthInMeters && utils.getLengthString(_currentItemLengthInMeters)) || "-",
            mass: utils.getMassString(shipClass.getMass()) || "-",
            armor: shipClass.getHitpoints() || "-",
            rating: shipClass.getArmor() || "0",
            weaponSlots: shipClass.getWeaponSlots().length || "-",
            thrusters: shipClass.getThrusterSlots().length || "-"
        });
        // descriptions can have translations, that need to refer to the name of the spacecraft class / type, and if they exist,
        // then they are displayed, otherwise an info about the missing description is displayed
        this._itemDescriptionParagraph.setContent(shipClass.getDisplayDescription() +
                "<br/>" + "<br/>" +
                shipClass.getSpacecraftType().getDisplayDescription());
    };
    /**
     * @override
     */
    DatabaseScreen.prototype._updateComponents = function () {
        screens.HTMLScreenWithCanvases.prototype._updateComponents.call(this);
        this._updateItemInfo();
    };
    /**
     * Updates the status message and the progress value on the loading box.
     * @param {String} [newStatus] The status to show on the loading box. If
     * undefined, the status won't be updated.
     * @param {Number} [newProgress] The new value of the progress bar on the loading
     * box. If undefined, the value won't be updated.
     */
    DatabaseScreen.prototype._updateLoadingStatus = function (newStatus, newProgress) {
        if (newStatus !== undefined) {
            this._loadingBox.updateStatus(armadaScreens.getSubParagraph(newStatus));
        }
        if (newProgress !== undefined) {
            this._loadingBox.updateProgress(newProgress);
        }
    };
    /**
     * Updates the loading box message and progress value to reflect the state given in the parameters.
     * @param {String} resourceName The name of the resource that have just finished loading
     * @param {String} resourceType The type of the resource that have just finished loading
     * @param {Number} totalResources The number of total resources to be loaded
     * @param {Number} loadedResources The number of resources that have already been loaded
     */
    DatabaseScreen.prototype._updateLoadingBoxForResourceLoad = function (resourceName, resourceType, totalResources, loadedResources) {
        this._updateLoadingStatus(
                utils.formatString(strings.get(strings.LOADING.RESOURCE_READY), {
                    resource: resourceName,
                    resourceType: resourceType,
                    loaded: loadedResources,
                    total: totalResources
                }),
                LOADING_RESOURCES_START_PROGRESS + (loadedResources / totalResources) * LOADING_RESOURCE_PROGRESS);
    };
    /**
     * Carries out the resource loading and scene setup that needs to be done the first time an item is displayed.
     */
    DatabaseScreen.prototype._initializeCanvas = function () {
        var canvas, i, lightSources, shadowMappingSettings;
        _firstLoad = true;
        document.body.classList.add("wait");
        if (_getSetting(SETTINGS.SHOW_LOADING_BOX_FIRST_TIME)) {
            this._loadingBox.show();
        }
        this._updateLoadingStatus(strings.get(strings.DATABASE.LOADING_BOX_INITIALIZING), 0);
        this.getScreenCanvas(DATABASE_CANVAS_NAME).handleResize();
        if (graphics.shouldUseShadowMapping()) {
            graphics.getShadowMappingShader();
        }
        canvas = this.getScreenCanvas(DATABASE_CANVAS_NAME).getCanvasElement();
        _itemViewScene = new sceneGraph.Scene(
                0, 0, 1, 1,
                true, [true, true, true, true],
                _getSetting(SETTINGS.BACKGROUND_COLOR), true,
                graphics.getLODContext(),
                graphics.getMaxDirLights(),
                graphics.getMaxPointLights(),
                graphics.getMaxSpotLights(),
                {
                    useVerticalValues: _getSetting(config.GENERAL_SETTINGS.USE_VERTICAL_CAMERA_VALUES),
                    viewDistance: _getSetting(SETTINGS.ITEM_VIEW_DISTANCE),
                    fov: _getSetting(SETTINGS.ITEM_VIEW_FOV),
                    span: _getSetting(SETTINGS.ITEM_VIEW_SPAN)
                });
        lightSources = _getSetting(SETTINGS.LIGHT_SOURCES);
        if (lightSources) {
            for (i = 0; i < lightSources.length; i++) {
                _itemViewScene.addDirectionalLightSource(new lights.DirectionalLightSource(lightSources[i].color, lightSources[i].direction));
            }
        }
        if (_getSetting(SETTINGS.SHOW_LOADING_BOX_FIRST_TIME)) {
            resources.executeOnResourceLoad(this._updateLoadingBoxForResourceLoad.bind(this));
        }
        resources.executeWhenReady(function () {
            shadowMappingSettings = graphics.getShadowMappingSettings();
            if (shadowMappingSettings) {
                shadowMappingSettings.ranges = [];
                shadowMappingSettings.deferSetup = true;
            }
            _itemViewScene.setShadowMapping(shadowMappingSettings);
        }.bind(this));
        if (_getSetting(SETTINGS.SHOW_LOADING_BOX_FIRST_TIME)) {
            this._updateLoadingStatus(strings.get(strings.LOADING.RESOURCES_START), LOADING_INITIAL_PROGRESS);
        }
        _currentItemIndex = 0;
        this.loadShip();
        // when the user presses the mouse on the canvas, he can start rotating the model
        // by moving the mouse
        canvas.onmousedown = handleMouseDown;
        canvas.onwheel = handleWheel;
    };
    /**
     * @override
     * @returns {Boolean}
     */
    DatabaseScreen.prototype.show = function () {
        if (screens.HTMLScreenWithCanvases.prototype.show.call(this)) {
            this.executeWhenReady(function () {
                this._initializeCanvas();
            });
            return true;
        }
        return false;
    };
    /**
     * @override
     * @returns {Boolean}
     */
    DatabaseScreen.prototype.hide = function () {
        if (screens.HTMLScreenWithCanvases.prototype.hide.call(this)) {
            this.executeWhenReady(function () {
                _itemViewScene.clearNodes(true);
                _itemViewScene.clearPointLights();
                _itemViewScene.clearSpotLights();
                this.render();
            });
            if (_revealLoop !== LOOP_CANCELED) {
                clearInterval(_revealLoop);
                _revealLoop = LOOP_CANCELED;
            }
            if (_rotationLoop !== LOOP_CANCELED) {
                clearInterval(_rotationLoop);
                _rotationLoop = LOOP_CANCELED;
            }
            return true;
        }
        return false;
    };
    /**
     * Selects and displays the previous spacecraft class from the list on the database screen. Loops around.
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
     * Selects and displays the next spacecraft class from the list on the database screen. Loops around.
     */
    DatabaseScreen.prototype.selectNextShip = function () {
        _currentItemIndex = (_currentItemIndex + 1) % classes.getSpacecraftClassesInArray(true).length;
        this.loadShip();
    };
    /**
     * Load the information and model of the currently selected ship and display them on the page.
     * If a class name is given, that class will be selected and displayed.
     * @param {String} [spacecraftClassName] The name of the spacecraft class to load
     */
    DatabaseScreen.prototype.loadShip = function (spacecraftClassName) {
        if (spacecraftClassName) {
            _currentItemIndex = classes.getSpacecraftClassesInArray(true).indexOf(classes.getSpacecraftClass(spacecraftClassName));
        }
        // the execution might take a few seconds, and is in the main thread, so better inform the user
        document.body.classList.add("wait");
        // stop the possible ongoing loops that display the previous ship to avoid null reference
        _stopRevealLoop();
        _stopRotationLoop();
        this.stopRenderLoop();
        // clear the previous scene graph and render the empty scene to clear the canvas 
        _itemViewScene.clearNodes(true);
        _itemViewScene.clearPointLights();
        _itemViewScene.clearSpotLights();
        _itemViewScene.setShouldAnimate(false);
        if (_currentItem) {
            _currentItem.destroy();
        }
        _currentItem = null;
        this.render();
        missions.executeWhenReady(function () {
            this._updateItemInfo();
            _setupCurrentItemAndModels();
            // set the loading box to update when a new resource is loaded
            resources.executeOnResourceLoad(this._updateLoadingBoxForResourceLoad.bind(this));
            // set the callback for when the potentially needed additional file resources have been loaded
            resources.executeWhenReady(function () {
                var visualModel = _currentItem.getVisualModel();
                if (!visualModel) {
                    game.log("WARNING! No visual item to load for database, loading aborted!");
                    return;
                }
                this._updateItemInfo();
                // this will create the GL context if needed or update it with the new data if it already exists
                this.bindSceneToCanvas(_itemViewScene, this.getScreenCanvas(DATABASE_CANVAS_NAME));
                // set the camera position so that the whole ship nicely fits into the picture
                _itemViewScene.getCamera().moveToPosition([0, 0, visualModel.getScaledSize()], 0);
                // set the shadow mappin ranges manually, adapting to the size of the shown model
                if (graphics.shouldUseShadowMapping()) {
                    _itemViewScene.setShadowMapRanges([
                        0.5 * visualModel.getScaledSize(),
                        visualModel.getScaledSize()
                    ]);
                    _itemViewScene.enableShadowMapping();
                } else {
                    _itemViewScene.disableShadowMapping();
                }
                // applying original scale
                _currentItemOriginalScale = visualModel.getScalingMatrix()[0];
                _scaleModels(_currentItemOriginalScale * _getSetting(SETTINGS.START_SIZE_FACTOR));
                this._updateLoadingStatus(strings.get(strings.LOADING.INIT_WEBGL), LOADING_INIT_WEBGL_PROGRESS);
                this._sceneCanvasBindings[0].canvas.getManagedContext().setup();
                if (_shouldReveal()) {
                    _resetRevealState();
                }
                this.render();
                utils.executeAsync(function () {
                    // if no loops are running, a single render is enough since the scene will be static
                    if (_getSetting(SETTINGS.MODEL_AUTO_ROTATION) || _getSetting(SETTINGS.MODEL_MOUSE_ROTATION) || _shouldReveal()) {
                        this.startRenderLoop(1000 / _getSetting(SETTINGS.RENDER_FPS));
                    }
                    // starting rotation and reveal loops, as needed
                    if (_getSetting(SETTINGS.MODEL_AUTO_ROTATION)) {
                        _startRotationLoop(_shouldReveal() ? _getSetting(SETTINGS.ROTATION_REVEAL_START_ANGLE) : _getSetting(SETTINGS.ROTATION_START_ANGLE));
                    } else {
                        _setRotation(_getSetting(SETTINGS.ROTATION_START_ANGLE));
                    }
                    if (_shouldReveal()) {
                        _startRevealLoop();
                    } else {
                        _revealState = REVEAL_SOLID_END_STATE;
                        _itemViewScene.setShouldAnimate(true);
                    }
                    document.body.classList.remove("wait");
                    if ((_firstLoad && _getSetting(SETTINGS.SHOW_LOADING_BOX_FIRST_TIME)) ||
                            (!_firstLoad && _getSetting(SETTINGS.SHOW_LOADING_BOX_ON_ITEM_CHANGE))) {
                        this._updateLoadingStatus(strings.get(strings.LOADING.READY), 100);
                        this._loadingBox.hide();
                    }
                    _firstLoad = false;
                }.bind(this));
            }.bind(this), function () {
                // if the resources are not ready, display the loading box
                if (!_firstLoad && _getSetting(SETTINGS.SHOW_LOADING_BOX_ON_ITEM_CHANGE)) {
                    this._loadingBox.show();
                }
            }.bind(this),
                    // force an asynchronous execution, so that the wait cursor will be applied before running the setup even if the graphics
                    // resources are all loaded already (as the setup itself can take some time)
                    true);
            // initiate the loading of additional file resources if they are needed
            this._updateLoadingStatus(strings.get(strings.LOADING.RESOURCES_START), LOADING_INITIAL_PROGRESS);
            resources.requestResourceLoad();
        }.bind(this), function () {
            // if the game logic is not ready, display the loading box
            if (!_firstLoad && _getSetting(SETTINGS.SHOW_LOADING_BOX_ON_ITEM_CHANGE)) {
                this._loadingBox.show();
            }
        }.bind(this),
                // force an asynchronous execution, so that the wait cursor will be applied before running the setup even if the logic and
                // media resources are all loaded already (as the setup itself can take some time)
                true);
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        databaseScreen: new DatabaseScreen()
    };
});