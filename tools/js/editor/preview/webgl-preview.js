/**
 * Copyright 2016 Krisztián Nagy
 * @file Provides the general structure to preview windows of the Interstellar Armada editor that use a WebGL scene 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, document, window */
/*jslint white: true, nomen: true, plusplus: true */

/**
 * @param utils Used for enum value listing, async execution.
 * @param vec Used for vector operations related to camera control.
 * @param mat Used for matrix operatinos related to camera control.
 * @param managedGL Used to create a managed context for the WebGL preview canvas.
 * @param budaScene Used for creating the preview scene and light sources.
 * @param resources Used to request media resources and wait for their loading.
 * @param graphics Used to access the graphics settings of the game (same are used for the preview)
 * @param config Used to access default camera configuration settings.
 * @param classes Used to create an object view for the preview model.
 * @param common Used to create selectors.
 */
define([
    "utils/utils",
    "utils/vectors",
    "utils/matrices",
    "modules/managed-gl",
    "modules/buda-scene",
    "modules/media-resources",
    "armada/graphics",
    "armada/configuration",
    "armada/classes",
    "editor/common"
], function (utils, vec, mat, managedGL, budaScene, resources, graphics, config, classes, common) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // Enums
            /**
             * The available render modes for the preview.
             * @enum {String}
             * @type Object
             */
            RenderMode = {
                WIREFRAME: "wireframe",
                SOLID: "solid",
                BOTH: "both"
            },
    // ----------------------------------------------------------------------
    // Constants
    INITIAL_CAMERA_FOV = 40,
            INITIAL_CAMERA_SPAN = 0.2,
            ROTATION_MOUSE_SENSITIVITY = 1.0,
            MODEL_ROTATE_BUTTON = utils.MouseButton.LEFT,
            CAMERA_ROTATE_BUTTON = utils.MouseButton.MIDDLE,
            ENLARGE_FACTOR = 1.05,
            SHRINK_FACTOR = 0.95,
            SETTING_CLASS = "setting",
            SETTING_LABEL_CLASS = "settingLabel",
            CANVAS_BACKGROUND_COLOR = [0, 0, 0, 1],
            MANAGED_CONTEXT_NAME = "context",
            DEFAULT_DISTANCE_FACTOR = 1.5,
            MAX_DISTANCE_FACTOR = 100,
            OBJECT_VIEW_NAME = "standard",
            FOV = 45,
            WIREFRAME_SHADER_NAME = "oneColor",
            WIREFRAME_COLOR = [1, 1, 1, 1],
            // ----------------------------------------------------------------------
            // Private variables
            /**
             * @type ManagedGLContext
             */
            _context,
            /**
             * @type Scene
             */
            _scene,
            /**
             * @type RenderableObject3D
             */
            _model, _wireframeModel,
            /**
             * @type Number[2]
             */
            _mousePos,
            /**
             * @type Boolean
             */
            _turningModel, _turningCamera,
            /**
             * A reference to the object storing the HTML elements to be used for the preview
             * @type Object
             */
            _elements,
            /**
             * (enum RenderMode)
             * @type String
             */
            _renderMode,
            /**
             * @type String
             */
            _lod,
            /**
             * 
             * @type WebGLPreviewContext
             */
            _currentContext,
            /**
             * 
             * @type Object
             */
            _optionElements = {
                renderModeSelector: null,
                lodSelector: null
            };
    /**
     * @typedef {Object} Editor~WebGLPreviewParams
     * @property {Boolean} renderModeSetting
     * @property {Boolean} lodSetting
     * @property {String[]} canvasUpdateProperties
     * @property {String[]} optionRefreshProperties
     */
    /**
     * @typedef {Object} Editor~WebGLPreviewFunctions
     * @property {Function} clear
     * @property {Function} load
     * @property {Function} updateForRefresh
     * @property {Function} clearSettingsForNewItem
     * @property {Function} createOptions
     */
    /**
     * @class
     * @param {Editor~WebGLPreviewParams} params
     * @param {Editor~WebGLPreviewFunctions} functions
     */
    function WebGLPreviewContext(params, functions) {
        /**
         * @type Editor~WebGLPreviewParams
         */
        this.params = params;
        /**
         * @type Editor~WebGLPreviewFunctions
         */
        this.functions = functions;
        /**
         * @type Float32Array
         */
        this.modelOrientationMatrix = mat.identity4();
        /**
         * @type Float32Array
         */
        this.cameraOrientationMatrix = mat.identity4();
        /**
         * @type Number
         */
        this.cameraDistance = 0;
    }
    function setContext(value) {
        if (_currentContext) {
            _currentContext.functions.clear();
        }
        _currentContext = value;
    }
    function getScene() {
        return _scene;
    }
    function getWireframeShaderName() {
        return WIREFRAME_SHADER_NAME;
    }
    function setModel(value) {
        _model = value;
    }
    function setupWireframeModel(model) {
        model.setUniformValueFunction(budaScene.UNIFORM_COLOR_NAME, function () {
            return WIREFRAME_COLOR;
        });
    }
    function setWireframeModel(value) {
        _wireframeModel = value;
        setupWireframeModel(value);
    }
    /**
     * Called when a change happens as the result of which the preview scene should rendered again (if it is not rendered continuously)
     */
    function requestRender() {
        _scene.render(_context, 0);
    }
    // ----------------------------------------------------------------------
    // Private Functions
    /**
     * Turns the model or the camera (or both), depending on which turn mode is active. Attached to the mouse move after a mouse down 
     * on the preview canvas.
     * @param {MouseEvent} event
     */
    function _handleMouseMove(event) {
        var cameraOri,
                rotA = -(event.screenX - _mousePos[0]) * Math.radians(ROTATION_MOUSE_SENSITIVITY),
                rotB = -(event.screenY - _mousePos[1]) * Math.radians(ROTATION_MOUSE_SENSITIVITY);
        if (_model) {
            if (_turningModel) {
                cameraOri = _scene.getCamera().getCameraOrientationMatrix();
                _model.rotate(mat.getRowB43(cameraOri), rotA);
                _model.rotate(mat.getRowA43(cameraOri), rotB);
                _wireframeModel.rotate(mat.getRowB43(cameraOri), rotA);
                _wireframeModel.rotate(mat.getRowA43(cameraOri), rotB);
                mat.setMatrix4(_currentContext.modelOrientationMatrix, _model.getOrientationMatrix());
            }
        }
        if (_turningCamera) {
            _scene.getCamera().setAngularVelocityVector([-rotB, -rotA, 0]);
            _scene.getCamera().update(10000);
            _scene.getCamera().setAngularVelocityVector([0, 0, 0]);
            mat.setMatrix4(_currentContext.cameraOrientationMatrix, _scene.getCamera().getCameraOrientationMatrix());
        }
        requestRender();
        _mousePos = [event.screenX, event.screenY];
    }
    /**
     * A handler for the mouse up event that cancels the rotation (of the model or the camera, depending on the button) by the mouse
     * @param {MouseEvent} event
     * @returns {Boolean}
     */
    function _handleMouseUp(event) {
        switch (event.which) {
            case MODEL_ROTATE_BUTTON:
                _turningModel = false;
                break;
            case CAMERA_ROTATE_BUTTON:
                _turningCamera = false;
                break;
        }
        if (!_turningModel && !_turningCamera) {
            document.body.onmousemove = null;
            document.body.onmouseup = null;
        }
        event.preventDefault();
        event.stopPropagation();
        return false;
    }
    /**
     * A handler for the mouse down event that sets the other handlers to start mouse model /camera rotation (depending on the button)
     * @param {MouseEvent} event
     * @returns {Boolean}
     */
    function _handleMouseDown(event) {
        switch (event.which) {
            case MODEL_ROTATE_BUTTON:
                _turningModel = true;
                break;
            case CAMERA_ROTATE_BUTTON:
                _turningCamera = true;
                break;
        }
        if (_turningModel || _turningCamera) {
            _mousePos = [event.screenX, event.screenY];
            document.body.onmousemove = _handleMouseMove;
            // once the user releases the mouse button, the event handlers should be cancelled
            document.body.onmouseup = _handleMouseUp;
        }
        event.preventDefault();
        event.stopPropagation();
        return false;
    }
    /**
     * A handler for the wheel event that fires when the user scrolls with the mouse, that approaches / moves away from the model,
     * depending on the scroll direction
     * @param {WheelEvent} event
     * @returns {Boolean}
     */
    function _handleWheel(event) {
        var originalDistance, originalPos, scaleFactor = 0;
        if (event.deltaY > 0) {
            scaleFactor = ENLARGE_FACTOR;
        }
        if (event.deltaY < 1) {
            scaleFactor = SHRINK_FACTOR;
        }
        if (scaleFactor) {
            originalPos = mat.translationVector3(_scene.getCamera().getCameraPositionMatrix());
            originalDistance = vec.length3(originalPos);
            _scene.getCamera().setControlledVelocityVector([0, 0, originalDistance * (scaleFactor - 1)]);
            _scene.getCamera().update(1000);
            _scene.getCamera().setControlledVelocityVector([0, 0, 0]);
            _currentContext.cameraDistance = vec.length3(mat.translationVector3(_scene.getCamera().getCameraPositionMatrix()));
            requestRender();
        }
        return false;
    }
    /**
     * Return whether according to the currently set render mode, the wireframe model should be rendered.
     * @returns {Boolean}
     */
    function _shouldRenderWireframe() {
        return (_renderMode === RenderMode.WIREFRAME) || (_renderMode === RenderMode.BOTH);
    }
    /**
     * Return whether according to the currently set render mode, the solid model should be rendered.
     * @returns {Boolean}
     */
    function _shouldRenderSolid() {
        return (_renderMode === RenderMode.SOLID) || (_renderMode === RenderMode.BOTH);
    }
    /**
     * Shows or hides the wireframe and solid models according to the currently set render mode. Does not call for render.
     */
    function _updateForRenderMode() {
        if (_wireframeModel) {
            if (_shouldRenderWireframe()) {
                _wireframeModel.getNode().show();
            } else {
                _wireframeModel.getNode().hide();
            }
        }
        if (_model) {
            if (_shouldRenderSolid()) {
                _model.getNode().show();
            } else {
                _model.getNode().hide();
            }
        }
    }
    /**
     * Sets the currently active numeric LOD for the passed model
     * @param {ShadedLODMesh} model
     */
    function _updateLOD(model) {
        if (model.setStaticLOD) {
            model.setStaticLOD(graphics.getLOD(_lod));
        }
    }
    /**
     * Sets the currently active numeric LOD for the wireframe and solid models. Does not call for render.
     */
    function _updateForLOD() {
        if (_model) {
            _model.getNode().execute(_updateLOD);
        }
        if (_wireframeModel) {
            _wireframeModel.getNode().execute(_updateLOD);
        }
    }
    /**
     * Creates and returns a <span> HTML element storing the passed text, having the class associated with setting labels.
     * @param {String} text
     * @returns {Element}
     */
    function _createSettingLabel(text) {
        var result = document.createElement("span");
        result.classList.add(SETTING_LABEL_CLASS);
        result.innerHTML = text;
        return result;
    }
    /**
     * Creates a setting element for the preview options panel, with a label and a control
     * @param {String} labelText The text that should show on the label
     * @param {Element} control The control to edit the value of the setting
     * @returns {Element}
     */
    function createSetting(labelText, control) {
        var result = document.createElement("div");
        result.classList.add(SETTING_CLASS);
        result.appendChild(_createSettingLabel(labelText));
        result.appendChild(control);
        return result;
    }
    /**
     * Creates the content for the preview information panel and adds it to the page.
     */
    function _updateInfo() {
        _elements.info.innerHTML = "";
        if (_model) {
            _elements.info.appendChild(common.createLabel(
                    "Model: " +
                    "triangles: " + _model.getModel().getNumTriangles(graphics.getLOD(_lod)) +
                    ", lines: " + _model.getModel().getNumLines(graphics.getLOD(_lod))));
        }
        _elements.info.hidden = (_elements.info.innerHTML === "");
    }
    /**
     * Updates both the calculated CSS size for the canvas as well as sets the size attributes according to the rendered (client) size.
     */
    function _updateCanvasSize() {
        _elements.canvas.style.height = (_elements.canvas.parentNode.clientHeight - (_elements.options.clientHeight + _elements.info.clientHeight)) + "px";
        _elements.canvas.width = _elements.canvas.clientWidth;
        _elements.canvas.height = _elements.canvas.clientHeight;
    }
    /**
     * Call this whenever a resize event occurs on the window to update the canvas
     */
    function _handleResize() {
        if (_scene) {
            _updateCanvasSize();
            requestRender();
        }
    }
    /**
     * @typedef {Object} Editor~RefreshElements
     * @property {HTMLCanvasElement} canvas The canvas that can be used to display a preview image of the selected object
     * @property {Element} options The div that houses the preview options
     */
    /**
     * @typedef {Object} Editor~RefreshParams
     * @property {Boolean} preserve Whether to preserve the existing settings (e.g. model and camera orientation)
     * @property {Boolean} reload Whether to force-reload the model (even if the settings are set to be preserved)
     * @property {Boolean} clearScene Whether to clear the scene (nodes, light sources)
     */
    /**
     * Updates the content of the preview canvas according to the current preview settings
     * @param {Editor~RefreshParams} params
     */
    function updateCanvas(params) {
        var shadowMappingSettings,
                shouldReload;
        params = params || {};
        shouldReload = !params.preserve || params.reload;
        if (graphics.shouldUseShadowMapping()) {
            graphics.getShadowMappingShader();
        }
        if (shouldReload) {
            _currentContext.functions.clear();
            _model = null;
            _wireframeModel = null;
        }
        if (!_scene) {
            _scene = new budaScene.Scene(
                    0, 0, 1, 1, // full canvas
                    true, [true, true, true, true], // background is erased on render
                    CANVAS_BACKGROUND_COLOR, true,
                    graphics.getLODContext(),
                    graphics.getMaxDirLights(),
                    graphics.getMaxPointLights(),
                    graphics.getMaxSpotLights(),
                    {
                        useVerticalValues: config.getSetting(config.GENERAL_SETTINGS.USE_VERTICAL_CAMERA_VALUES),
                        viewDistance: config.getSetting(config.BATTLE_SETTINGS.VIEW_DISTANCE),
                        fov: INITIAL_CAMERA_FOV,
                        span: INITIAL_CAMERA_SPAN,
                        transitionDuration: config.getSetting(config.BATTLE_SETTINGS.CAMERA_DEFAULT_TRANSITION_DURATION),
                        transitionStyle: config.getSetting(config.BATTLE_SETTINGS.CAMERA_DEFAULT_TRANSITION_STYLE)
                    });
            resources.executeWhenReady(function () {
                shadowMappingSettings = graphics.getShadowMappingSettings();
                if (shadowMappingSettings) {
                    shadowMappingSettings.deferSetup = true;
                }
                _scene.setShadowMapping(shadowMappingSettings);
            });
        } else {
            if (params.clearScene || shouldReload) {
                _scene.clearNodes();
                _scene.clearDirectionalLights();
                _scene.clearPointLights();
                _scene.clearSpotLights();
            }
        }
        // clear the previous render
        if (_context && !params.preserve) {
            requestRender();
        }
        _currentContext.functions.load(params, _currentContext.modelOrientationMatrix);
        _context = _context || new managedGL.ManagedGLContext(MANAGED_CONTEXT_NAME, _elements.canvas, graphics.getAntialiasing(), true, graphics.getFiltering());
        resources.executeWhenReady(function () {
            var view;
            _elements.canvas.hidden = false;
            _updateInfo();
            _updateCanvasSize();
            _scene.addToContext(_context);
            _context.setup();
            if (shouldReload) {
                if (_model) {
                    if (!params.preserve) {
                        _currentContext.cameraDistance = DEFAULT_DISTANCE_FACTOR * _model.getScaledSize();
                    }
                    view = new classes.ObjectView({
                        name: OBJECT_VIEW_NAME,
                        isAimingView: false,
                        fps: false,
                        fov: FOV,
                        fovRange: [FOV, FOV],
                        followsPosition: true,
                        followsOrientation: false,
                        movable: true,
                        turnable: true,
                        rotationCenterIsObject: true,
                        distanceRange: [0, MAX_DISTANCE_FACTOR * _model.getScaledSize()],
                        position: [0, -_currentContext.cameraDistance, 0]
                    });
                    _scene.getCamera().setConfiguration(view.createCameraConfiguration(_model,
                            config.getDefaultCameraBaseOrientation(),
                            config.getDefaultCameraPointToFallback(),
                            config.getDefaultCameraFOV(),
                            config.getDefaultCameraFOVRange(),
                            config.getDefaultCameraSpan(),
                            config.getDefaultCameraSpanRange()));
                } else {
                    _scene.getCamera().moveToPosition([0, 0, 0], 0);
                    _scene.getCamera().getConfiguration().setRelativeOrientationMatrix(mat.identity4(), true);
                }
                if (params.preserve) {
                    _scene.getCamera().getConfiguration().setRelativeOrientationMatrix(mat.matrix4(_currentContext.cameraOrientationMatrix), true);
                }
            }
            _elements.canvas.onmousedown = _handleMouseDown;
            _elements.canvas.onwheel = _handleWheel;
            _context.executeWhenReady(function () {
                _updateForRenderMode();
                _updateForLOD();
                _currentContext.functions.updateForRefresh();
                requestRender();
            });
        });
        resources.requestResourceLoad();
    }
    /**
     * Resets the preview settings (those handled through the optionns, not the ones connected to the canvas) to their default values.
     * The settings that persist across different items are not reset.
     */
    function clearSettingsForNewItem() {
        _renderMode = _renderMode || RenderMode.SOLID;
        _lod = (_lod !== undefined) ? _lod : graphics.getLODLevel();
        _currentContext.modelOrientationMatrix = mat.identity4();
        _currentContext.cameraOrientationMatrix = mat.identity4();
        _currentContext.functions.clearSettingsForNewItem();
    }
    /**
     * Creates the controls that form the content of the preview options and adds them to the page.
     */
    function createOptions() {
        _elements.options.innerHTML = "";
        // render mode selector
        if (_currentContext.params.renderModeSetting) {
            _optionElements.renderModeSelector = common.createSelector(utils.getEnumValues(RenderMode), _renderMode, false, function () {
                _renderMode = _optionElements.renderModeSelector.value;
                _updateForRenderMode();
                requestRender();
            });
            _elements.options.appendChild(createSetting("Render mode:", _optionElements.renderModeSelector));
        }
        if (_currentContext.params.lodSetting) {
            // LOD selector
            _optionElements.lodSelector = common.createSelector(graphics.getLODLevels(), _lod, false, function () {
                _lod = _optionElements.lodSelector.value;
                _updateForLOD();
                requestRender();
                _updateInfo();
            });
            _elements.options.appendChild(createSetting("LOD:", _optionElements.lodSelector));
        }
        _currentContext.functions.createOptions();
        _elements.options.hidden = (_elements.options.innerHTML === "");
    }
    // ----------------------------------------------------------------------
    // Public Functions
    /**
     * @typedef {Object} refreshElements
     * @property {HTMLCanvasElement} canvas The canvas that can be used to display a preview image of the selected object
     * @property {Element} options The div that houses the preview options
     */
    /**
     * The main function that sets up the preview window (both options and the preview canvas) for the editor 
     * @param {refreshElements} elements References to the HTML elements that can be used for the preview.
     * @param {Editor~RefreshParams} params Additional parameters 
     */
    function refresh(elements, params) {
        _elements = elements;
        createOptions();
        updateCanvas(params);
        window.addEventListener("resize", _handleResize);
    }
    /**
     * Updates the preview (refreshes if needed) in case the property with the given name changed
     * @param {String} name
     */
    function handleDataChanged(name) {
        if (_currentContext.params.optionRefreshProperties.indexOf(name) >= 0) {
            createOptions();
        }
        if (_currentContext.params.canvasUpdateProperties.indexOf(name) >= 0) {
            updateCanvas({
                preserve: true,
                reload: true
            });
        }
    }
    // ----------------------------------------------------------------------
    // The public interface of the module
    return {
        WebGLPreviewContext: WebGLPreviewContext,
        setContext: setContext,
        getScene: getScene,
        getWireframeShaderName: getWireframeShaderName,
        setModel: setModel,
        setWireframeModel: setWireframeModel,
        setupWireframeModel: setupWireframeModel,
        requestRender: requestRender,
        createSetting: createSetting,
        clearSettingsForNewItem: clearSettingsForNewItem,
        updateCanvas: updateCanvas,
        refresh: refresh,
        handleDataChanged: handleDataChanged
    };
});
