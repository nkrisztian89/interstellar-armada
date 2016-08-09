/**
 * Copyright 2016 Krisztián Nagy
 * @file Provides the setup and event-handling for the preview window used for spacecraft classes within the Interstellar Armada editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, document */
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
 * @param classes Used to create an object view for the preview spacecraft.
 * @param logic Used to create the preview spacecraft(s) and access the environments.
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
    "armada/logic"
], function (utils, vec, mat, managedGL, budaScene, resources, graphics, config, classes, logic) {
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
            SPACECRAFT_ROTATE_BUTTON = utils.MouseButton.LEFT,
            CAMERA_ROTATE_BUTTON = utils.MouseButton.MIDDLE,
            ENLARGE_FACTOR = 1.05,
            SHRINK_FACTOR = 0.95,
            SETTING_LABEL_CLASS = "settingLabel",
            CANVAS_BACKGROUND_COLOR = [0, 0, 0, 1],
            LIGHT_SOURCES = [
                {
                    color: [1, 1, 1],
                    direction: [1, 0, 1]
                }
            ],
            WIREFRAME_SHADER_NAME = "oneColor",
            WIREFRAME_SHADER_COLOR_UNIFORM_NAME = "color",
            WIREFRAME_COLOR = [1, 1, 1, 1],
            MANAGED_CONTEXT_NAME = "context",
            DEFAULT_DISTANCE_FACTOR = 1.5,
            MAX_DISTANCE_FACTOR = 10,
            OBJECT_VIEW_NAME = "standard",
            FOV = 45,
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
             * @type Spacecraft
             */
            _spacecraft, _wireframeSpacecraft,
            /**
             * @type Number[2]
             */
            _mousePos,
            /**
             * @type Boolean
             */
            _turningSpacecraft, _turningCamera,
            /**
             * (enum RenderMode)
             * @type String
             */
            _renderMode,
            /**
             * @type Number
             */
            _lod,
            /**
             * @type String
             */
            _environmentName, _equipmentProfileName;
    // ----------------------------------------------------------------------
    // Private Functions
    /**
     * Called when a change happens as the result of which the preview scene should rendered again (if it is not rendered continuously)
     */
    function _requestRender() {
        _scene.render(_context, 0);
    }
    /**
     * Turns the spacecraft or the camera (or both), depending on which turn mode is active. Attached to the mouse move after a mouse down 
     * on the preview canvas.
     * @param {MouseEvent} event
     */
    function _handleMouseMove(event) {
        var cameraOri,
                rotA = -(event.screenX - _mousePos[0]) * Math.radians(ROTATION_MOUSE_SENSITIVITY),
                rotB = -(event.screenY - _mousePos[1]) * Math.radians(ROTATION_MOUSE_SENSITIVITY);
        if (_spacecraft) {
            if (_turningSpacecraft) {
                cameraOri = _scene.getCamera().getCameraOrientationMatrix();
                _spacecraft.getVisualModel().rotate(mat.getRowB43(cameraOri), rotA);
                _spacecraft.getVisualModel().rotate(mat.getRowA43(cameraOri), rotB);
                _wireframeSpacecraft.getVisualModel().rotate(mat.getRowB43(cameraOri), rotA);
                _wireframeSpacecraft.getVisualModel().rotate(mat.getRowA43(cameraOri), rotB);
            }
            if (_turningCamera) {
                _scene.getCamera().setAngularVelocityVector([-rotB, -rotA, 0]);
                _scene.getCamera().update(10000);
                _scene.getCamera().setAngularVelocityVector([0, 0, 0]);
            }
            _requestRender();
        }
        _mousePos = [event.screenX, event.screenY];
    }
    /**
     * A handler for the mouse up event that cancels the rotation (of the spacecraft or the camera, depending on the button) by the mouse
     * @param {MouseEvent} event
     * @returns {Boolean}
     */
    function _handleMouseUp(event) {
        switch (event.which) {
            case SPACECRAFT_ROTATE_BUTTON:
                _turningSpacecraft = false;
                break;
            case CAMERA_ROTATE_BUTTON:
                _turningCamera = false;
                break;
        }
        if (!_turningSpacecraft && !_turningCamera) {
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
            case SPACECRAFT_ROTATE_BUTTON:
                _turningSpacecraft = true;
                break;
            case CAMERA_ROTATE_BUTTON:
                _turningCamera = true;
                break;
        }
        if (_turningSpacecraft || _turningCamera) {
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
     * A handler for the wheel event that fires when the user scrolls with the mouse, that approaches / moves away from the spacecraft,
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
            _requestRender();
        }
        return false;
    }
    /**
     * Creates and returns an HTML <select> element storing the given options (with the same value and text)
     * @param {String[]} options The options to include in the element
     * @param {String} selected The initial text of the element (should be one of the options)
     * @param {Boolean} includeNone If true, an additional, "none" option will be included as the first one
     * @param {Function} onchange The function to set as the element's onchange handler.
     * @returns {Element}
     */
    function _createSelector(options, selected, includeNone, onchange) {
        var result = document.createElement("select"), s, i;
        s = includeNone ? '<option value="none">none</option>' : '';
        for (i = 0; i < options.length; i++) {
            s += '<option value="' + options[i] + '">' + options[i] + '</option>';
        }
        result.innerHTML = s;
        if (selected) {
            result.value = selected;
        }
        result.onchange = onchange;
        return result;
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
        if (_shouldRenderWireframe()) {
            _wireframeSpacecraft.getVisualModel().getNode().show();
        } else {
            _wireframeSpacecraft.getVisualModel().getNode().hide();
        }
        if (_shouldRenderSolid()) {
            _spacecraft.getVisualModel().getNode().show();
        } else {
            _spacecraft.getVisualModel().getNode().hide();
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
        _spacecraft.getVisualModel().getNode().execute(_updateLOD);
        _wireframeSpacecraft.getVisualModel().getNode().execute(_updateLOD);
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
    // ----------------------------------------------------------------------
    // Public Functions
    /**
     * @typedef {Object} refreshElements
     * @property {HTMLCanvasElement} canvas The canvas that can be used to display a preview image of the selected object
     * @property {Element} options The div that houses the preview options
     */
    /**
     * @typedef {Object} refreshParams
     * @property {Boolean} preserve Whether to preserve the existing settings (e.g. spacecraft and camera orientation)
     * @property {String} environmentName The name of the environment to put the previewed spacecraft in
     * @property {String} equipmentProfileName The name of the equipment profile to be equipped on the previewed spacecraft
     */
    /**
     * The main function that sets up the preview window for the editor to show the selected spacecraft class.
     * @param {refreshElements} elements References to the HTML elements that can be used for the preview.
     * @param {SpacecraftClass} spacecraftClass The spacecraft class to preview
     * @param {refreshParams} params Additional parameters 
     */
    function refresh(elements, spacecraftClass, params) {
        var shadowMappingSettings,
                renderModeSelector,
                lodSelector,
                environmentSelector,
                equipmentSelector,
                environmentChanged,
                equipmentProfileChanged,
                i;
        params = params || {};
        environmentChanged = params.environmentName !== _environmentName;
        equipmentProfileChanged = params.equipmentProfileName !== _equipmentProfileName;
        elements.canvas.width = elements.canvas.clientWidth;
        elements.canvas.height = elements.canvas.clientHeight;
        if (graphics.shouldUseShadowMapping()) {
            graphics.getShadowMappingShader();
        }
        if (_spacecraft && !params.preserve) {
            _spacecraft.destroy();
            _spacecraft = null;
            _wireframeSpacecraft.destroy();
            _wireframeSpacecraft = null;
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
            if (environmentChanged || !params.preserve) {
                _scene.clearNodes();
                _scene.clearDirectionalLights();
                _scene.clearPointLights();
                _scene.clearSpotLights();
            }
        }
        if ((environmentChanged || !params.preserve) && !params.environmentName) {
            for (i = 0; i < LIGHT_SOURCES.length; i++) {
                _scene.addDirectionalLightSource(new budaScene.DirectionalLightSource(LIGHT_SOURCES[i].color, LIGHT_SOURCES[i].direction));
            }
        }
        if (!params.preserve) {
            _spacecraft = new logic.Spacecraft(spacecraftClass);
            _wireframeSpacecraft = new logic.Spacecraft(spacecraftClass);
        }
        if (equipmentProfileChanged || environmentChanged || !params.preserve) {
            if (_equipmentProfileName) {
                _spacecraft.unequip();
                _wireframeSpacecraft.unequip();
                _equipmentProfileName = null;
            }
            if (params.equipmentProfileName) {
                _spacecraft.equipProfile(spacecraftClass.getEquipmentProfile(params.equipmentProfileName));
                _wireframeSpacecraft.equipProfile(spacecraftClass.getEquipmentProfile(params.equipmentProfileName));
                _equipmentProfileName = params.equipmentProfileName;
            }
        }
        _spacecraft.addToScene(_scene, undefined, false,
                (environmentChanged || !params.preserve) ? {weapons: true, lightSources: true, blinkers: true} : {self: false, weapons: true},
                {replaceVisualModel: true});
        _wireframeSpacecraft.addToScene(_scene, undefined, true,
                (environmentChanged || !params.preserve) ? {weapons: true, lightSources: false, blinkers: false} : {self: false, weapons: true},
                {
                    replaceVisualModel: true,
                    shaderName: WIREFRAME_SHADER_NAME
                },
        (environmentChanged || !params.preserve) ?
                function (model) {
                    model.setUniformValueFunction(WIREFRAME_SHADER_COLOR_UNIFORM_NAME, function () {
                        return WIREFRAME_COLOR;
                    });
                } :
                null,
                function (model) {
                    model.setUniformValueFunction(WIREFRAME_SHADER_COLOR_UNIFORM_NAME, function () {
                        return WIREFRAME_COLOR;
                    });
                });
        if (params.environmentName && (environmentChanged || !params.preserve)) {
            logic.getEnvironment(params.environmentName).addToScene(_scene);
        }
        _environmentName = params.environmentName;
        _context = _context || new managedGL.ManagedGLContext(MANAGED_CONTEXT_NAME, elements.canvas, graphics.getAntialiasing(), true, graphics.getFiltering());
        _renderMode = _renderMode || RenderMode.SOLID;
        _lod = (_lod !== undefined) ? _lod : graphics.getLODLevel();
        // setting up preview options
        elements.options.innerHTML = "";
        // render mode selector
        elements.options.appendChild(_createSettingLabel("Render mode:"));
        renderModeSelector = _createSelector(utils.getEnumValues(RenderMode), _renderMode, false, function () {
            _renderMode = renderModeSelector.value;
            _updateForRenderMode();
            _requestRender();
        });
        elements.options.appendChild(renderModeSelector);
        // LOD selector
        elements.options.appendChild(_createSettingLabel("LOD:"));
        lodSelector = _createSelector(graphics.getLODLevels(), _lod, false, function () {
            _lod = lodSelector.value;
            _updateForLOD();
            _requestRender();
        });
        elements.options.appendChild(lodSelector);
        // environment selector
        elements.options.appendChild(_createSettingLabel("Environment:"));
        environmentSelector = _createSelector(logic.getEnvironmentNames(), _environmentName, true, function () {
            refresh(elements, spacecraftClass, {
                preserve: true,
                environmentName: (environmentSelector.value !== "none") ? environmentSelector.value : undefined,
                equipmentProfileName: _equipmentProfileName
            });
        });
        elements.options.appendChild(environmentSelector);
        // equipment profile selector
        elements.options.appendChild(_createSettingLabel("Equipment:"));
        equipmentSelector = _createSelector(spacecraftClass.getEquipmentProfileNames(), _equipmentProfileName, true, function () {
            refresh(elements, spacecraftClass, {
                preserve: true,
                environmentName: _environmentName,
                equipmentProfileName: (equipmentSelector.value !== "none") ? equipmentSelector.value : undefined
            });
        });
        elements.options.appendChild(equipmentSelector);
        elements.options.hidden = false;
        elements.canvas.hidden = false;
        resources.executeWhenReady(function () {
            var view, distance;
            _scene.addToContext(_context);
            _context.setup();
            if (!params.preserve) {
                distance = DEFAULT_DISTANCE_FACTOR * _spacecraft.getVisualModel().getScaledSize();
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
                    distanceRange: [0, MAX_DISTANCE_FACTOR * distance],
                    position: [0, -distance, 0]
                });
                _scene.getCamera().setConfiguration(_spacecraft.createCameraConfigurationForView(view));
            }
            elements.canvas.onmousedown = _handleMouseDown;
            elements.canvas.onwheel = _handleWheel;
            _context.executeWhenReady(function () {
                utils.executeAsync(function () {
                    _updateForRenderMode();
                    _updateForLOD();
                    _requestRender();
                });
            });
        });
        resources.requestResourceLoad();
    }
    // ----------------------------------------------------------------------
    // The public interface of the module
    return {
        refresh: refresh
    };
});
