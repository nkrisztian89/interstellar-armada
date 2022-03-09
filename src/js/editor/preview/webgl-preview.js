/**
 * Copyright 2016-2022 Krisztián Nagy
 * @file Provides the general structure to preview windows of the Interstellar Armada editor that use a WebGL scene 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used for enum value listing, async execution.
 * @param vec Used for vector operations related to camera control.
 * @param mat Used for matrix operatinos related to camera control.
 * @param pools Used to clean up the particle pool during animations and refresh
 * @param managedGL Used to create a managed context for the WebGL preview canvas.
 * @param renderableObjects Used for accessing uniform name constants
 * @param sceneGraph Used for creating the preview scene
 * @param resources Used to request media resources and wait for their loading.
 * @param audio Used to set audio volume
 * @param graphics Used to access the graphics settings of the game (same are used for the preview)
 * @param config Used to access default camera configuration settings.
 * @param constants Used to get pool names
 * @param classes Used to create an object view for the preview model.
 * @param explosion Used to manage the explosion pool.
 * @param common Used to create selectors.
 */
define([
    "utils/utils",
    "utils/vectors",
    "utils/matrices",
    "modules/pools",
    "modules/managed-gl",
    "modules/media-resources",
    "modules/audio",
    "modules/scene/renderable-objects",
    "modules/scene/scene-graph",
    "armada/graphics",
    "armada/configuration",
    "armada/logic/constants",
    "armada/logic/classes",
    "armada/logic/explosion",
    "editor/common"
], function (
        utils, vec, mat,
        pools, managedGL, resources, audio,
        renderableObjects, sceneGraph,
        graphics, config, constants, classes, explosion,
        common) {
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
            CAMERA_ROTATION_MOUSE_SENSITIVITY = 0.25,
            CAMERA_PAN_MOUSE_SENSITIVITY = 0.25,
            CAMERA_SCROLL_MOVE_FACTOR = 1000,
            FREE_CAMERA_INITIAL_HEIGHT = 500,
            FREE_CAMERA_VIEW_DISTANCE = 15000,
            FREE_CAMERA_ROTATIONS = [{axis: "X", degrees: 90}],
            MODEL_ROTATE_BUTTON = utils.MouseButton.LEFT,
            CAMERA_ROTATE_BUTTON = utils.MouseButton.MIDDLE,
            ENLARGE_FACTOR = 1.05,
            SHRINK_FACTOR = 0.95,
            SETTING_CLASS = "setting",
            SETTING_LABEL_CLASS = "settingLabel",
            CANVAS_BACKGROUND_COLOR = [0, 0, 0, 1],
            AMBIENT_COLOR = [0, 0, 0],
            MANAGED_CONTEXT_NAME = "context",
            DEFAULT_DISTANCE_FACTOR = 1.5,
            DEFAULT_CAMERA_DIRECTION = [0, -1, 0],
            MAX_DISTANCE_FACTOR = 100,
            VIEW_NAME = "standard",
            FOV = 45,
            WIREFRAME_SHADER_NAME = "oneColor",
            WIREFRAME_COLOR = [1, 1, 1, 1],
            // ----------------------------------------------------------------------
            // Private variables
            /**
             * @type Pool
             */
            _particlePool,
            /**
             * @type Pool
             */
            _explosionPool,
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
             * @type Mission
             */
            _mission,
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
             * Whether the scne is currently animating (a requestAnimFrame loop is active)
             * @type Boolean
             */
            _animating,
            /**
             * Whether the animation should be stopped next time a frame is about to be rendered by requestAnimFrame
             * @type Boolean
             */
            _animationStopScheduled,
            /**
             * Whether the sound should be muted
             * @type Boolean
             */
            _muted,
            /**
             * The timestamp of the last render frame to calculate elapsed time
             * @type DOMHighResTimeStamp
             */
            _lastRenderTimestamp,
            /**
             * The current frames per seconds value
             * @type Number
             */
            _fps,
            /**
             * 
             * @type Object
             */
            _optionElements = {
                renderModeSelector: null,
                lodSelector: null,
                animateButton: null,
                muteCheckbox: null
            };
    /**
     * @typedef {Object} Editor~WebGLPreviewParams
     * @property {Boolean} renderModeSetting
     * @property {Boolean} lodSetting
     * @property {Boolean} animateButton
     * @property {Boolean} [animateOnRefresh] If not set, preserving previously set animation state
     * @property {Boolean} muteCheckbox
     * @property {String[]} canvasUpdateProperties
     * @property {String[]} optionRefreshProperties
     * @property {String[]} infoUpdateProperties
     * @property {Number} [defaultDistanceFactor]
     * @property {Number[3]} [cameraDirection] 
     */
    /**
     * @typedef {Object} Editor~WebGLPreviewFunctions
     * @property {Function} clear
     * @property {Function} load
     * @property {Function} updateForRefresh
     * @property {Function} clearSettingsForNewItem
     * @property {Function} createOptions
     * @property {Function} animate
     * @property {Function} onModelRotate
     * @property {Function} getInfo
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
    function setMission(value) {
        _mission = value;
    }
    function setupWireframeModel(model) {
        model.setUniformValueFunction(renderableObjects.UNIFORM_COLOR_NAME, function () {
            return WIREFRAME_COLOR;
        });
    }
    function setWireframeModel(value) {
        _wireframeModel = value;
        setupWireframeModel(value);
    }
    /**
     * Creates the content for the preview information panel and adds it to the page.
     */
    function _updateInfo() {
        var infoSections = [], info;
        _elements.info.innerHTML = "";
        if (_currentContext) {
            if (_model && _model.getModel) {
                infoSections.push(
                        "Model: " +
                        "triangles: " + _model.getModel().getNumTriangles(_model.getCurrentLOD()) +
                        ", lines: " + _model.getModel().getNumLines(_model.getCurrentLOD()) +
                        ", dimensions: " + _model.getModel().getWidth(_model.getCurrentLOD()).toFixed(3) + " × " +
                        _model.getModel().getHeight(_model.getCurrentLOD()).toFixed(3) + " × " +
                        _model.getModel().getDepth(_model.getCurrentLOD()).toFixed(3));
            }
            if (_currentContext.functions.getInfo) {
                info = _currentContext.functions.getInfo();
                if (info) {
                    infoSections.push(info);
                }
            }
            if (_fps) {
                infoSections.push("FPS: " + _fps);
            }
            _elements.info.appendChild(common.createLabel(infoSections.join("<br/>")));
        }
        _elements.info.hidden = (_elements.info.innerHTML === "");
    }
    /**
     * Function to execute on (active, used) particles in the particle pool every animation step
     * @param {Particle} particle
     * @param {Number} indexInPool
     */
    function _handleParticle(particle, indexInPool) {
        if (particle.canBeReused()) {
            _particlePool.markAsFree(indexInPool);
        }
    }
    /**
     * Function to execute on (active, used) explosions in the explosion pool every animation step
     * @param {Explosion} exp
     * @param {Number} indexInPool
     */
    function _handleExplosion(exp, indexInPool) {
        if (exp.canBeReused()) {
            _explosionPool.markAsFree(indexInPool);
        }
    }
    /**
     * Updates both the calculated CSS size for the canvas as well as sets the size attributes according to the rendered (client) size.
     */
    function _updateCanvasSize() {
        _elements.div.style.height = (_elements.div.parentNode.clientHeight - (_elements.options.clientHeight + _elements.info.clientHeight)) + "px";
        _elements.canvas.style.height = _elements.div.style.height;
        _elements.canvas.width = _elements.canvas.clientWidth;
        _elements.canvas.height = _elements.canvas.clientHeight;
    }
    /**
     * Called when a change happens as the result of which the preview scene should rendered again (if it is not rendered continuously)
     * @param {Boolean} [force=false] If false, the render is only executed if there is no requestAnimFrame render loop active
     * @param {Number} [dt=0] The time elapsed since the last render (to advance animation, in milliseconds)
     */
    function requestRender(force, dt) {
        if (!_animating || force) {
            dt = dt || 0;
            if (_particlePool.hasLockedObjects()) {
                _particlePool.executeForLockedObjects(_handleParticle);
            }
            if (_explosionPool.hasLockedObjects()) {
                _explosionPool.executeForLockedObjects(_handleExplosion);
            }
            _updateInfo();
            _updateCanvasSize();
            _scene.render(_context, dt);
            if (_currentContext && _currentContext.functions.animate) {
                _currentContext.functions.animate(dt);
            }
            _fps = dt ? Math.round(1000 / dt) : 0;
        }
    }
    /**
     * Updates the caption of the "Animate" button according to the current animation state
     */
    function _updateAnimateButton() {
        if (_optionElements.animateButton) {
            _optionElements.animateButton.innerHTML = _animating ? "Stop" : "Animate";
        }
    }
    /**
     * Renders one animation frame (to be used with requestAnimFrame)
     * @param {DOMHighResTimeStamp} timestamp From requestAnimFrame
     */
    function _renderFrame(timestamp) {
        var dt;
        if (_animating) {
            if (!_lastRenderTimestamp) {
                _lastRenderTimestamp = timestamp;
            }
            dt = timestamp - _lastRenderTimestamp;
            if (!_animationStopScheduled) {
                requestRender(true, dt);
                _lastRenderTimestamp = timestamp;
                window.requestAnimationFrame(_renderFrame);
            } else {
                _fps = 0;
                _animating = false;
                _updateAnimateButton();
                _updateInfo();
                _updateCanvasSize();
            }
        }
    }
    /**
     * Starts the animation loop using requestAnimFrame (if it is not active)
     */
    function startAnimating() {
        if (!_animating) {
            _animating = true;
            _animationStopScheduled = false;
            _lastRenderTimestamp = 0;
            _updateAnimateButton();
            window.requestAnimationFrame(_renderFrame);
        } else if (_animationStopScheduled) {
            _animationStopScheduled = false;
        }
    }
    /**
     * Sets the animation loop to be stopped next time the frame render is invoked
     */
    function stopAnimating() {
        _animationStopScheduled = true;
    }
    /**
     * Turns the model or the camera (or both), depending on which turn mode is active. Attached to the mouse move after a mouse down 
     * on the preview canvas.
     * @param {MouseEvent} event
     */
    function _handleMouseMove(event) {
        var camera = _scene.getCamera(), cameraOri,
                rotA = -(event.screenX - _mousePos[0]) * Math.radians(ROTATION_MOUSE_SENSITIVITY),
                rotB = -(event.screenY - _mousePos[1]) * Math.radians(ROTATION_MOUSE_SENSITIVITY),
                axisA, axisB;
        if (_model) {
            if (_turningModel) {
                cameraOri = camera.getCameraOrientationMatrix();
                axisA = mat.getRowA43(cameraOri);
                axisB = mat.getRowB43(cameraOri);
                _model.rotate(axisB, rotA);
                _model.rotate(axisA, rotB);
                if (_wireframeModel) {
                    _wireframeModel.setOrientationMatrix(_model.getOrientationMatrix());
                }
                mat.setMatrix4(_currentContext.modelOrientationMatrix, _model.getOrientationMatrix());
                if (_currentContext.functions.onModelRotate) {
                    _currentContext.functions.onModelRotate();
                }
            }
        } else {
            if (_turningModel) {
                camera.setAngularVelocityVector([
                    CAMERA_ROTATION_MOUSE_SENSITIVITY * rotB,
                    CAMERA_ROTATION_MOUSE_SENSITIVITY * rotA,
                    0]);
                camera.update(10000);
                camera.setAngularVelocityVector([0, 0, 0]);
                mat.setMatrix4(_currentContext.cameraOrientationMatrix, camera.getCameraOrientationMatrix());
            }
        }
        if (_turningCamera) {
            if (_model) {
                camera.setAngularVelocityVector([-rotB, -rotA, 0]);
                camera.update(10000);
                camera.setAngularVelocityVector([0, 0, 0]);
                mat.setMatrix4(_currentContext.cameraOrientationMatrix, camera.getCameraOrientationMatrix());
            } else {
                _scene.getCamera().setControlledVelocityVector([
                    -(event.screenX - _mousePos[0]) * CAMERA_PAN_MOUSE_SENSITIVITY,
                    (event.screenY - _mousePos[1]) * CAMERA_PAN_MOUSE_SENSITIVITY,
                    0]);
                _scene.getCamera().update(1000);
                _scene.getCamera().setControlledVelocityVector([0, 0, 0]);
            }
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
            _scene.getCamera().setControlledVelocityVector([0, 0, (_model ? originalDistance : CAMERA_SCROLL_MOVE_FACTOR) * (scaleFactor - 1)]);
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
        return (_renderMode === RenderMode.SOLID) || (_renderMode === RenderMode.BOTH) || (!_wireframeModel);
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
     * @param {Element} control The control to edit the value of the setting
     * @param {String} [labelText] The text that should show on the label (if any)
     * @returns {Element}
     */
    function createSetting(control, labelText) {
        var result = document.createElement("div");
        result.classList.add(SETTING_CLASS);
        if (labelText) {
            result.appendChild(_createSettingLabel(labelText));
        }
        result.appendChild(control);
        return result;
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
     * @property {Element} div The div that houses the canvas
     * @property {HTMLCanvasElement} canvas The canvas that can be used to display a preview image of the selected object
     * @property {Element} options The div that houses the preview options
     * @property {Element} info The div that houses the bottom info bar
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
        var shadowMappingSettings, shouldReload, wasAnimating;
        params = params || {};
        shouldReload = !params.preserve || params.reload;
        wasAnimating = _animating;
        stopAnimating();
        if (graphics.shouldUseShadowMapping()) {
            graphics.getShadowMappingShader();
        }
        if (shouldReload) {
            _currentContext.functions.clear();
            _model = null;
            _wireframeModel = null;
            _mission = null;
            _particlePool.clear();
            _explosionPool.clear();
        }
        if (!_scene) {
            _scene = new sceneGraph.Scene(
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
                _scene.clear(true);
                _scene.setClearColor(CANVAS_BACKGROUND_COLOR);
                _scene.setAmbientColor(AMBIENT_COLOR);
            }
        }
        // clear the previous render
        if (_context && !params.preserve) {
            requestRender();
        }
        if (_currentContext.functions.load(params, _currentContext.modelOrientationMatrix)) {
            shouldReload = true;
        }
        _context = _context || new managedGL.ManagedGLContext(MANAGED_CONTEXT_NAME, _elements.canvas, graphics.getAntialiasing(), true, graphics.getFiltering());
        resources.executeWhenReady(function () {
            var view;
            _elements.div.hidden = false;
            _elements.canvas.hidden = false;
            _updateForLOD();
            _updateInfo();
            _updateCanvasSize();
            _context.clear();
            resources.executeWhenReady(function () {
                _scene.addToContext(_context);
                _context.setup();
                if (shouldReload) {
                    if (_model) {
                        if (!params.preserve) {
                            _currentContext.cameraDistance = (_currentContext.params.defaultDistanceFactor || DEFAULT_DISTANCE_FACTOR) * _model.getScaledSize();
                        }
                        view = new classes.ObjectView({
                            name: VIEW_NAME,
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
                            position: vec.scaled3(_currentContext.params.cameraDirection || DEFAULT_CAMERA_DIRECTION, _currentContext.cameraDistance)
                        });
                        _scene.getCamera().setViewDistance(config.getSetting(config.BATTLE_SETTINGS.VIEW_DISTANCE));
                        _scene.getCamera().setConfiguration(view.createCameraConfiguration(_model,
                                config.getDefaultCameraBaseOrientation(),
                                config.getDefaultCameraPointToFallback(),
                                config.getDefaultCameraFOV(),
                                config.getDefaultCameraSpan()));
                    } else {
                        if (!params.preserve) {
                            if (_mission) {
                                view = new classes.SceneView({
                                    name: VIEW_NAME,
                                    fps: true,
                                    lookAt: classes.SceneViewLookAtMode.NONE,
                                    fov: FOV,
                                    fovRange: [FOV, FOV],
                                    movable: true,
                                    turnable: true,
                                    position: [0, 0, FREE_CAMERA_INITIAL_HEIGHT],
                                    rotations: FREE_CAMERA_ROTATIONS
                                });
                                _scene.getCamera().setConfiguration(_mission.createCameraConfigurationForSceneView(view, _scene));
                            } else {
                                _scene.getCamera().moveToPosition([0, 0, FREE_CAMERA_INITIAL_HEIGHT], 0);
                            }
                            _scene.getCamera().getConfiguration().setRelativeOrientationMatrix(mat.identity4(), true);
                        }
                        _scene.getCamera().setViewDistance(FREE_CAMERA_VIEW_DISTANCE);
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
                    if (_currentContext.params.animateOnRefresh || (wasAnimating && (_currentContext.params.animateOnRefresh !== false))) {
                        startAnimating();
                    } else {
                        requestRender();
                    }
                });
            });
            // cannot directly call a new load request inside executeWhenReady() as it would change the ready state
            // back to not ready and commence an infinite loop, with the setTimeout() it is executed after all 
            // onReady handlers are cleared
            setTimeout(function () {
                resources.requestResourceLoad();
            }, 0);
        });
        resources.requestResourceLoad();
    }
    /**
     * Resets the preview settings (those handled through the options, not the ones connected to the canvas) to their default values.
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
            _elements.options.appendChild(createSetting(_optionElements.renderModeSelector, "Render mode:"));
        }
        if (_currentContext.params.lodSetting) {
            // LOD selector
            _optionElements.lodSelector = common.createSelector(graphics.getLODLevels(), _lod, false, function () {
                _lod = _optionElements.lodSelector.value;
                _updateForLOD();
                requestRender();
                _updateInfo();
            });
            _elements.options.appendChild(createSetting(_optionElements.lodSelector, "LOD:"));
        }
        if (_currentContext.params.animateButton) {
            // animate button
            _optionElements.animateButton = common.createButton(_animating ? "Stop" : "Animate", function () {
                if (!_animating) {
                    startAnimating();
                } else {
                    stopAnimating();
                }
            });
            _elements.options.appendChild(createSetting(_optionElements.animateButton));
        }
        if (_currentContext.params.muteCheckbox) {
            // mute checkbox
            _optionElements.muteCheckbox = common.createBooleanInput(_muted, function () {
                _muted = _optionElements.muteCheckbox.checked;
                audio.setMasterVolume(_muted ? 0 : 1);
            });
            _elements.options.appendChild(createSetting(_optionElements.muteCheckbox, "Mute:"));
        }
        _currentContext.functions.createOptions();
        _elements.options.hidden = (_elements.options.innerHTML === "");
    }
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
     * Clears the preview and its current context so that a new preview (or the same with a different context) can be opened
     */
    function clear() {
        stopAnimating();
        setContext(null);
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
        } else if (_currentContext.params.infoUpdateProperties.indexOf(name) >= 0) {
            _updateInfo();
            _updateCanvasSize();
            requestRender();
        }
    }
    // initializazion
    // obtaining pool references
    _particlePool = pools.getPool(constants.PARTICLE_POOL_NAME, renderableObjects.Particle);
    _explosionPool = pools.getPool(constants.EXPLOSION_POOL_NAME, explosion.Explosion);
    // ----------------------------------------------------------------------
    // The public interface of the module
    return {
        WebGLPreviewContext: WebGLPreviewContext,
        setContext: setContext,
        getScene: getScene,
        getWireframeShaderName: getWireframeShaderName,
        setModel: setModel,
        setMission: setMission,
        setWireframeModel: setWireframeModel,
        setupWireframeModel: setupWireframeModel,
        requestRender: requestRender,
        startAnimating: startAnimating,
        stopAnimating: stopAnimating,
        createSetting: createSetting,
        clearSettingsForNewItem: clearSettingsForNewItem,
        updateCanvas: updateCanvas,
        refresh: refresh,
        clear: clear,
        handleDataChanged: handleDataChanged
    };
});
