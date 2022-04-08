/**
 * Copyright 2019-2021 Krisztián Nagy
 * @file Provides the setup and event-handling for the preview window used for missile classes within the Interstellar Armada editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param vec Used for vector operations
 * @param mat Used for matrix operations
 * @param resources Used for waiting for resource load
 * @param lights Used for creating the light sources for the preview scene
 * @param graphics Used to acquire wireframe shader and update settings based on the environment
 * @param environments Used to access the environments
 * @param equipment Used to create the preview missiles
 * @param common Used to create selectors
 * @param descriptors Used to access enums
 * @param preview This module is based on the common WebGL preview module
 */
define([
    "utils/vectors",
    "utils/matrices",
    "modules/media-resources",
    "modules/scene/lights",
    "armada/graphics",
    "armada/logic/environments",
    "armada/logic/equipment",
    "editor/common",
    "editor/descriptors",
    "editor/preview/webgl-preview"
], function (vec, mat, resources, lights, graphics, environments, equipment, common, descriptors, preview) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // Constants
            LIGHT_SOURCES = [
                {
                    color: [1, 1, 1],
                    direction: [1, 0, 1]
                }
            ],
            ENGINE_STATE_OFF = "off",
            /**
             * The names of properties the change of which should trigger an update of the preview canvas
             * @type String[]
             */
            CANVAS_UPDATE_PROPERTIES = [
                "model", "modelScale", "shader", "texture",
                "trail", "thrusterSlots"
            ],
            /**
             * The names of the properties the change of which should trigger a refresh of the preview options
             * @type String[]
             */
            OPTION_REFRESH_PROPERIES = [
            ],
            /**
             * The names of the properties the change of which should trigger a refresh of the info text
             * @type String[]
             */
            INFO_UPDATE_PROPERTIES = [
                "launchVelocity", "ignitionTime", "acceleration", "duration"
            ],
            // ----------------------------------------------------------------------
            // Private variables
            /**
             * @type Missile
             */
            _missile, _wireframeMissile,
            /**
             * @type Environment
             */
            _environment,
            /**
             * A reference to the object storing the HTML elements to be used for the preview
             * @type Object
             */
            _elements,
            /**
             * A reference to the displayed missile class
             * @type MissileClass
             */
            _missileClass,
            /**
             * @type String
             */
            _environmentName,
            /**
             * The uses of the engine that are currently set to be turned on
             * @type String[]
             */
            _activeEngineUses = [],
            /**
             * Stores the WebGL preview context information for missile class previews
             * @type WebGLPreviewContext
             */
            _previewContext,
            /**
             * 
             * @type Object
             */
            _optionElements = {
                addTrailButton: null,
                environmentSelector: null,
                engineStateEditor: null,
                engineStatePopup: null
            };
    // ----------------------------------------------------------------------
    // Private Functions
    /**
     * Updates the visual models of the thrusters according to the currently set engine state.
     */
    function _updateThrusters() {
        var i;
        _missile.resetThrusterBurn();
        for (i = 0; i < _activeEngineUses.length; i++) {
            switch (_activeEngineUses[i]) {
                case descriptors.ThrusterUse.FORWARD:
                    _missile.addThrusterBurnForward(1);
                    break;
                case descriptors.ThrusterUse.YAW_LEFT:
                    _missile.addThrusterBurnYawLeft(1);
                    break;
                case descriptors.ThrusterUse.YAW_RIGHT:
                    _missile.addThrusterBurnYawRight(1);
                    break;
                case descriptors.ThrusterUse.PITCH_UP:
                    _missile.addThrusterBurnPitchUp(1);
                    break;
                case descriptors.ThrusterUse.PITCH_DOWN:
                    _missile.addThrusterBurnPitchDown(1);
                    break;
            }
        }
        _missile.updateThrusterVisuals();
    }
    /**
     * Updates the engine state editor control in the preview options panel according to the current possibilities and settings.
     */
    function _updateEngineStateEditor() {
        _optionElements.engineStateEditor.innerHTML = _activeEngineUses.length > 0 ?
                (_activeEngineUses[0] + ((_activeEngineUses.length > 1) ? "..." : "")) :
                ENGINE_STATE_OFF;
    }
    /**
     * Adds a trail based on the current orientation of the missile to show how it would look
     */
    function _addTrail() {
        var
                trailEmitter = _missile._trailEmitter,
                growthRate = trailEmitter._descriptor.getGrowthRate(),
                duration = trailEmitter._descriptor.getDuration(),
                model = _missile.getVisualModel(),
                enginePosition, direction, length, count, segmentLength, dt, i;
        enginePosition = model.getPositionVector();
        vec.add3(enginePosition, vec.prodVec3Mat3Aux(_missileClass.getEnginePosition(), mat.prodScalingRotation3Aux(model.getScalingMatrix(), model.getOrientationMatrix())));
        direction = (vec.length3Squared(enginePosition) > 0) ? vec.normal3(enginePosition) : mat.getRowB43Neg(model.getOrientationMatrix());
        length = _missileClass.getLength() * 5;
        count = 3;
        segmentLength = length / count;
        dt = duration / (count * growthRate);
        trailEmitter.startNew(preview.getScene(), vec.sum3(enginePosition, vec.scaled3(direction, count * segmentLength)));
        for (i = 1; i <= count; i++) {
            trailEmitter.addPoint(vec.sum3(enginePosition, vec.scaled3(direction, (count - i) * segmentLength)), dt);
        }
        preview.requestRender();
    }
    /**
     * For the WebGL preview context.
     * Clears the object references of the currently stored missile (if any)
     */
    function _clear() {
        if (_missile) {
            _missile.destroy();
            _missile = null;
            _wireframeMissile.destroy();
            _wireframeMissile = null;
        }
    }
    /**
     * For the WebGL preview context.
     * Updates the content of the preview canvas according to the current preview settings
     * @param {Editor~RefreshParams} params
     * @param {Float32Array} orientationMatrix
     * @returns {Boolean}
     */
    function _load(params, orientationMatrix) {
        var
                environmentChanged,
                shouldReload,
                shadows,
                i;
        params = params || {};
        if (params.preserve) {
            if (params.environmentName === undefined) {
                params.environmentName = _environmentName;
            }
        }
        environmentChanged = params.environmentName !== _environmentName;
        shouldReload = !params.preserve || params.reload;
        if (environmentChanged || shouldReload) {
            shadows = graphics.isShadowMappingEnabled();
            if (params.environmentName) {
                _environment = environments.getEnvironment(params.environmentName);
                if (_environment.hasShadows()) {
                    graphics.setShadowMapping();
                } else {
                    graphics.setShadowMapping(false, false);
                }
            } else {
                _environment = null;
                preview.getScene().setClearColor([0, 0, 0, 1]);
                preview.getScene().setAmbientColor([0, 0, 0]);
                for (i = 0; i < LIGHT_SOURCES.length; i++) {
                    preview.getScene().addDirectionalLightSource(new lights.DirectionalLightSource(LIGHT_SOURCES[i].color, LIGHT_SOURCES[i].direction));
                }
                graphics.setShadowMapping();
            }
            if (shadows !== graphics.isShadowMappingEnabled()) {
                graphics.handleSettingsChanged();
                shouldReload = true;
            }
        }
        if (shouldReload) {
            _clear();
            _missile = new equipment.Missile(_missileClass);
            _wireframeMissile = new equipment.Missile(_missileClass);
        }
        if (orientationMatrix) {
            _missile.getPhysicalModel().updateOrientationMatrix(orientationMatrix);
            _wireframeMissile.getPhysicalModel().updateOrientationMatrix(_missile.getPhysicalModel().getOrientationMatrix());
        }
        if (params.clearScene || shouldReload) {
            _missileClass.acquireResources({missileOnly: false, sound: true, trail: true});
            graphics.getShader(preview.getWireframeShaderName());
            _missile.addToScene(preview.getScene(), false, undefined,
                    undefined,
                    true,
                    shouldReload ?
                    function (model) {
                        preview.setModel(model);
                        _missile._trailEmitter.addResourcesToScene(preview.getScene());
                    } :
                    null);
            _wireframeMissile.addToScene(preview.getScene(), true, undefined,
                    preview.getWireframeShaderName(),
                    false,
                    shouldReload ?
                    function (model) {
                        preview.setWireframeModel(model);
                    } :
                    null);
        } else {
            preview.setModel(_missile.getVisualModel());
            preview.setWireframeModel(_wireframeMissile.getVisualModel());
        }
        if (params.environmentName && (environmentChanged || shouldReload)) {
            _environment.addToScene(preview.getScene());
            if (_environment.addParticleEffectsToScene(preview.getScene())) {
                resources.executeWhenReady(preview.startAnimating);
            }
        }
        _environmentName = params.environmentName;
        _updateEngineStateEditor();
        return shouldReload;
    }
    /**
     * For the WebGL preview context.
     * Resets the preview settings (those handled through the options, not the ones connected to the canvas) to their default values.
     * The settings that persist across different items are not reset.
     */
    function _clearSettingsForNewItem() {
        _environmentName = null;
        _activeEngineUses = [];
    }
    /**
     * Creates and returns the control that can be used to set the engine state for the preview. Also sets the reference for the 
     * corresponding popup.
     * @returns {Element}
     */
    function _createEngineEditor() {
        var
                button = document.createElement("button"),
                popup = new common.Popup(button, null, {}),
                values = [
                    descriptors.ThrusterUse.FORWARD,
                    descriptors.ThrusterUse.YAW_LEFT,
                    descriptors.ThrusterUse.YAW_RIGHT,
                    descriptors.ThrusterUse.PITCH_UP,
                    descriptors.ThrusterUse.PITCH_DOWN
                ],
                table, row, cell, propertyEditor, i,
                elementChangeHandler = function (index, value) {
                    var elementIndex = _activeEngineUses.indexOf(values[index]);
                    if (value) {
                        if (elementIndex === -1) {
                            _activeEngineUses.push(values[index]);
                        }
                    } else {
                        if (elementIndex >= 0) {
                            _activeEngineUses.splice(elementIndex, 1);
                        }
                    }
                    _updateEngineStateEditor();
                    _updateThrusters();
                    preview.requestRender();
                };
        table = document.createElement("table");
        for (i = 0; i < values.length; i++) {
            propertyEditor = common.createBooleanInput(_activeEngineUses.indexOf(values[i]) >= 0, elementChangeHandler.bind(_createEngineEditor, i));
            row = document.createElement("tr");
            cell = document.createElement("td");
            cell.appendChild(common.createLabel(values[i].toString()));
            row.appendChild(cell);
            cell = document.createElement("td");
            cell.appendChild(propertyEditor);
            row.appendChild(cell);
            table.appendChild(row);
        }
        popup.getElement().appendChild(table);
        popup.addToPage();
        _optionElements.engineStatePopup = popup;
        // create a button using which the popup can be opened
        button.type = "button";
        button.onclick = function () {
            popup.toggle();
        };
        return button;
    }
    /**
     * For the WebGL preview context.
     * Creates the controls that form the content of the preview options and adds them to the page.
     */
    function _createOptions() {
        // add trail button
        _optionElements.addTrailButton = common.createButton("Add trail", function () {
            _addTrail();
        });
        _elements.options.appendChild(preview.createSetting(_optionElements.addTrailButton));
        // environment selector
        _optionElements.environmentSelector = common.createSelector(environments.getEnvironmentNames(), _environmentName, true, function () {
            preview.updateCanvas({
                preserve: true,
                clearScene: true,
                environmentName: (_optionElements.environmentSelector.value !== "none") ? _optionElements.environmentSelector.value : null
            });

        });
        _elements.options.appendChild(preview.createSetting(_optionElements.environmentSelector, "Environment:"));
        // engine state editor
        _optionElements.engineStateEditor = _createEngineEditor();
        _elements.options.appendChild(preview.createSetting(_optionElements.engineStateEditor, "Thrusters:"));
    }
    /**
     * The animation step
     */
    function _animate() {
        if (_environment) {
            _environment.simulate();
        }
    }
    /**
     * For the WebGL preview context.
     */
    function _updateForRefresh() {
        _updateThrusters();
    }
    /**
     * Returns additional information to be displayed in the info section of the preview
     * @returns {String}
     */
    function _getInfo() {
        var result, value;
        result = "";
        if (_missile) {
            value = _missileClass.getNominalRange();
            if (value > 0) {
                result = "Missile: ";
                result += "nominal range: " + (Math.round(value * 100) / 100) + " m";
            }
        }
        return result;
    }
    // ----------------------------------------------------------------------
    // Public Functions
    /**
     * The main function that sets up the preview window (both options and the preview canvas) for the editor to show the selected 
     * missile class.
     * @param {Editor~RefreshElements} elements References to the HTML elements that can be used for the preview.
     * @param {MissileClass} missileClass The missile class to preview
     * @param {Editor~SpacecraftClassRefreshParams} params Additional parameters 
     */
    function refresh(elements, missileClass, params) {
        var sameClass = (_missileClass === missileClass);

        preview.setContext(_previewContext);

        _elements = elements;
        _missileClass = missileClass;
        if (sameClass) {
            if (!params) {
                params = {
                    preserve: true,
                    reload: true
                };
            }
        } else {
            preview.clearSettingsForNewItem();
        }
        preview.refresh(elements, params);
    }
    /**
     * Updates the preview for the case when a property of the previewed item is being edited
     */
    function handleStartEdit() {
        return true;
    }
    /**
     * Updates the preview for the case when a property of the previewed item is no longer being edited
     */
    function handleStopEdit() {
        return true;
    }
    // ----------------------------------------------------------------------
    // Initialization
    _previewContext = new preview.WebGLPreviewContext({
        renderModeSetting: true,
        lodSetting: true,
        animateButton: true,
        canvasUpdateProperties: CANVAS_UPDATE_PROPERTIES,
        optionRefreshProperties: OPTION_REFRESH_PROPERIES,
        infoUpdateProperties: INFO_UPDATE_PROPERTIES
    }, {
        clear: _clear,
        load: _load,
        animate: _animate,
        updateForRefresh: _updateForRefresh,
        getInfo: _getInfo,
        clearSettingsForNewItem: _clearSettingsForNewItem,
        createOptions: _createOptions
    });
    // ----------------------------------------------------------------------
    // The public interface of the module
    return {
        refresh: refresh,
        clear: preview.clear,
        handleDataChanged: preview.handleDataChanged,
        handleStartEdit: handleStartEdit,
        handleStopEdit: handleStopEdit
    };
});
