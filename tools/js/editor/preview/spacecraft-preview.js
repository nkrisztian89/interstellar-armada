/**
 * Copyright 2016 Krisztián Nagy
 * @file Provides the setup and event-handling for the preview window used for spacecraft classes within the Interstellar Armada editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, document, window */
/*jslint white: true, nomen: true, plusplus: true */

/**
 * @param utils Used for enum value listing, async execution.
 * @param budaScene Used for creating the preview scene and light sources.
 * @param config Used to access default camera configuration settings.
 * @param logic Used to create the preview spacecraft(s) and access the environments.
 * @param common Used to create selectors.
 * @param descriptors Used to access enums
 * @param preview
 */
define([
    "utils/utils",
    "modules/buda-scene",
    "armada/configuration",
    "armada/logic",
    "editor/common",
    "editor/descriptors",
    "editor/preview/webgl-preview"
], function (utils, budaScene, config, logic, common, descriptors, preview) {
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
            HITBOX_HIGHLIGHT_COLOR = [0.8, 0.4, 0.3, 0.5],
            ENGINE_STATE_NO_PROPULSION = "no propulsion",
            ENGINE_STATE_OFF = "off",
            /**
             * The names of properties the change of which should trigger an update of the preview canvas
             * @type String[]
             */
            CANVAS_UPDATE_PROPERTIES = [
                "basedOn",
                "model", "shader", "texture",
                "factionColor", "defaultLuminosityFactors",
                "bodies",
                "weaponSlots", "thrusterSlots",
                "equipmentProfiles",
                "lights", "blinkers"],
            /**
             * The names of the properties the change of which should trigger a refresh of the preview options
             * @type String[]
             */
            OPTION_REFRESH_PROPERIES = [
                "basedOn",
                "equipmentProfiles"
            ],
            // ----------------------------------------------------------------------
            // Private variables
            /**
             * @type Spacecraft
             */
            _spacecraft, _wireframeSpacecraft,
            /**
             * A reference to the object storing the HTML elements to be used for the preview
             * @type Object
             */
            _elements,
            /**
             * A reference to the displayed spacecraft class
             * @type SpacecraftClass
             */
            _spacecraftClass,
            /**
             * @type String
             */
            _environmentName, _equipmentProfileName,
            /**
             * The faction color to use on the previewed spacecraft model
             * @type Number[4]
             */
            _factionColor,
            /**
             * Whether the user has changed the original faction color to a custom one
             * @type Boolean
             */
            _factionColorChanged,
            /**
             * The uses of the engine that are currently set to be turned on
             * @type String[]
             */
            _activeEngineUses = [],
            /**
             * Whether the hitbox is currently visible
             * @type Boolean
             */
            _showHitbox,
            /**
             * Used to highlight the hitbox that is currently being edited
             * @type Number
             */
            _highlightedHitboxIndex,
            /**
             * Stores the WebGL preview context information for spacecraft class previews
             * @type WebGLPreviewContext
             */
            _previewContext,
            /**
             * 
             * @type Object
             */
            _optionElements = {
                environmentSelector: null,
                equipmentSelector: null,
                factionColorPicker: null,
                engineStateEditor: null,
                engineStatePopup: null
            };
    // ----------------------------------------------------------------------
    // Private Functions
    /**
     * Returns the regular hitbox color (detemined by game configuration, the same that is shown if hitboxes are turned on in the game)
     * @returns {Number[4]}
     */
    function _hitboxColorFunction() {
        return config.getSetting(config.BATTLE_SETTINGS.HITBOX_COLOR);
    }
    /**
     * Returns the color to be used on the currently edited hitbox
     * @returns {Number[4]}
     */
    function _highlighterHitboxColorFunction() {
        return HITBOX_HIGHLIGHT_COLOR;
    }
    /**
     * Sets the appropriate hitbox visibility and colors for the current settingsF
     */
    function _updateForHitboxState() {
        var i, n = _spacecraft.getHitbox().getSubnodes().length;
        if (_showHitbox) {
            for (i = 0; i < n; i++) {
                _spacecraft.getHitbox(i).getRenderableObject().setUniformValueFunction(budaScene.UNIFORM_COLOR_NAME, (i === _highlightedHitboxIndex) ?
                        _highlighterHitboxColorFunction :
                        _hitboxColorFunction);
            }
            _spacecraft.showHitbox();
        } else {
            _spacecraft.hideHitbox();
        }
    }
    /**
     * Updates the visual models of the thrusters according to the currently set engine state.
     */
    function _updateThrusters() {
        var i;
        if (_spacecraft.getPropulsion()) {
            _spacecraft.resetThrusterBurn();
            for (i = 0; i < _activeEngineUses.length; i++) {
                _spacecraft.addThrusterBurn(_activeEngineUses[i], (
                        (_activeEngineUses[i] === descriptors.ThrusterUse.FORWARD) ||
                        (_activeEngineUses[i] === descriptors.ThrusterUse.REVERSE) ||
                        (_activeEngineUses[i] === descriptors.ThrusterUse.STRAFE_LEFT) ||
                        (_activeEngineUses[i] === descriptors.ThrusterUse.STRAFE_RIGHT) ||
                        (_activeEngineUses[i] === descriptors.ThrusterUse.RAISE) ||
                        (_activeEngineUses[i] === descriptors.ThrusterUse.LOWER)) ?
                        _spacecraft.getMaxThrusterMoveBurnLevel() :
                        _spacecraft.getMaxThrusterTurnBurnLevel());
            }
        }
    }
    /**
     * Updates the engine state editor control in the preview options panel according to the current possibilities and settings.
     */
    function _updateEngineStateEditor() {
        var i, checkboxes;
        _optionElements.engineStateEditor.disabled = !_spacecraft.getPropulsion();
        if (_optionElements.engineStateEditor.disabled) {
            _activeEngineUses = [];
            checkboxes = _optionElements.engineStatePopup.getElement().querySelectorAll('input[type="checkbox"]');
            for (i = 0; i < checkboxes.length; i++) {
                checkboxes[i].checked = false;
            }
            _optionElements.engineStatePopup.hide();
        }
        _optionElements.engineStateEditor.innerHTML = _activeEngineUses.length > 0 ?
                (_activeEngineUses[0] + ((_activeEngineUses.length > 1) ? "..." : "")) :
                (_spacecraft.getPropulsion() ? ENGINE_STATE_OFF : ENGINE_STATE_NO_PROPULSION);
    }
    /**
     * @typedef {Editor~RefreshParams} Editor~SpacecraftClassRefreshParams
     * @property {String} environmentName The name of the environment to put the previewed spacecraft in
     * @property {String} equipmentProfileName The name of the equipment profile to be equipped on the previewed spacecraft
     */
    /**
     * 
     */
    function _clear() {
        if (_spacecraft) {
            _spacecraft.destroy();
            _spacecraft = null;
            _wireframeSpacecraft.destroy();
            _wireframeSpacecraft = null;
        }
    }
    /**
     * Updates the content of the preview canvas according to the current preview settings
     * @param {Editor~SpacecraftClassRefreshParams} params
     * @param {Float32Array} orientationMatrix
     */
    function _load(params, orientationMatrix) {
        var
                environmentChanged,
                equipmentProfileChanged,
                shouldReload,
                i;
        params = params || {};
        if (params.preserve) {
            if (params.environmentName === undefined) {
                params.environmentName = _environmentName;
            }
            if (params.equipmentProfileName === undefined) {
                params.equipmentProfileName = _equipmentProfileName;
            }
        }
        environmentChanged = params.environmentName !== _environmentName;
        equipmentProfileChanged = params.equipmentProfileName !== _equipmentProfileName;
        shouldReload = !params.preserve || params.reload;
        if ((environmentChanged || shouldReload) && !params.environmentName) {
            for (i = 0; i < LIGHT_SOURCES.length; i++) {
                preview.getScene().addDirectionalLightSource(new budaScene.DirectionalLightSource(LIGHT_SOURCES[i].color, LIGHT_SOURCES[i].direction));
            }
        }
        if (shouldReload) {
            _spacecraft = new logic.Spacecraft(_spacecraftClass, undefined, undefined, params.reload ? orientationMatrix : undefined);
            _wireframeSpacecraft = new logic.Spacecraft(_spacecraftClass, undefined, undefined, params.reload ? orientationMatrix : undefined);
        }
        if (equipmentProfileChanged || environmentChanged || shouldReload) {
            if (_equipmentProfileName) {
                _spacecraft.unequip();
                _wireframeSpacecraft.unequip();
                _equipmentProfileName = null;
            }
            if (params.equipmentProfileName) {
                _spacecraft.equipProfile(_spacecraftClass.getEquipmentProfile(params.equipmentProfileName));
                _wireframeSpacecraft.equipProfile(_spacecraftClass.getEquipmentProfile(params.equipmentProfileName));
                _equipmentProfileName = params.equipmentProfileName;
            }
        }
        _spacecraft.addToScene(preview.getScene(), undefined, false,
                (environmentChanged || shouldReload) ?
                {weapons: true, lightSources: true, blinkers: true, hitboxes: true, thrusterParticles: true} :
                {self: false, weapons: true},
                {
                    replaceVisualModel: true,
                    factionColor: _factionColor
                },
        (environmentChanged || shouldReload) ?
                function (model) {
                    preview.setModel(model);
                } :
                null);
        _wireframeSpacecraft.addToScene(preview.getScene(), undefined, true,
                (environmentChanged || shouldReload) ?
                {weapons: true} :
                {self: false, weapons: true},
                {
                    replaceVisualModel: true,
                    shaderName: preview.getWireframeShaderName()
                },
        (environmentChanged || shouldReload) ?
                function (model) {
                    preview.setWireframeModel(model);
                } :
                null,
                function (model) {
                    preview.setupWireframeModel(model);
                });
        if (params.environmentName && (environmentChanged || shouldReload)) {
            logic.getEnvironment(params.environmentName).addToScene(preview.getScene());
        }
        _environmentName = params.environmentName;
        _updateEngineStateEditor();
    }
    /**
     * Resets the preview settings (those handled through the optionns, not the ones connected to the canvas) to their default values.
     * The settings that persist across different items are not reset.
     */
    function _clearSettingsForNewItem() {
        _environmentName = null;
        _equipmentProfileName = null;
        if (!_factionColor) {
            _factionColorChanged = false;
        }
        if (!_factionColorChanged) {
            _factionColor = _spacecraftClass.getFactionColor().slice();
        }
        _activeEngineUses = [];
        _showHitbox = false;
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
                values = utils.getEnumValues(descriptors.ThrusterUse),
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
            propertyEditor = common.createBooleanInput(_activeEngineUses.indexOf(values[i]) >= 0, elementChangeHandler.bind(this, i));
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
        button.disabled = true;
        button.onclick = function () {
            popup.toggle();
        };
        return button;
    }
    /**
     * Creates the controls that form the content of the preview options and adds them to the page.
     */
    function _createOptions() {
        // environment selector
        _optionElements.environmentSelector = common.createSelector(logic.getEnvironmentNames(), _environmentName, true, function () {
            preview.updateCanvas({
                preserve: true,
                clearScene: true,
                environmentName: (_optionElements.environmentSelector.value !== "none") ? _optionElements.environmentSelector.value : null
            });
        });
        _elements.options.appendChild(preview.createSetting("Environment:", _optionElements.environmentSelector));
        // equipment profile selector
        _optionElements.equipmentSelector = common.createSelector(_spacecraftClass.getEquipmentProfileNames(), _equipmentProfileName, true, function () {
            preview.updateCanvas({
                preserve: true,
                reload: true,
                equipmentProfileName: (_optionElements.equipmentSelector.value !== "none") ? _optionElements.equipmentSelector.value : null
            });
            _updateEngineStateEditor();
        });
        _elements.options.appendChild(preview.createSetting("Equipment:", _optionElements.equipmentSelector));
        // faction color picker
        _optionElements.factionColorPicker = common.createColorPicker(_factionColor, function () {
            _factionColorChanged = true;
            preview.updateCanvas({
                preserve: true,
                reload: true
            });
        });
        _elements.options.appendChild(preview.createSetting("Faction color:", _optionElements.factionColorPicker));
        // engine state editor
        _optionElements.engineStateEditor = _createEngineEditor();
        _elements.options.appendChild(preview.createSetting("Engine:", _optionElements.engineStateEditor));
    }
    function _updateForRefresh() {
        _updateForHitboxState();
        _updateThrusters();
    }
    // ----------------------------------------------------------------------
    // Public Functions
    /**
     * The main function that sets up the preview window (both options and the preview canvas) for the editor to show the selected 
     * spacecraft class.
     * @param {Editor~RefreshElements} elements References to the HTML elements that can be used for the preview.
     * @param {SpacecraftClass} spacecraftClass The spacecraft class to preview
     * @param {Editor~SpacecraftClassRefreshParams} params Additional parameters 
     */
    function refresh(elements, spacecraftClass, params) {
        var sameClass = (_spacecraftClass === spacecraftClass);

        preview.setContext(_previewContext);

        _elements = elements;
        _spacecraftClass = spacecraftClass;
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
     * @param {String} name The name of the property that is edited (under which the editing is happening)
     * @param {Number} [index] If the property is an array, this is the index of the element in the array being edited
     */
    function handleStartEdit(name, index) {
        if (name === "bodies") {
            _showHitbox = true;
            _highlightedHitboxIndex = index;
            _updateForHitboxState();
            preview.requestRender();
        }
    }
    /**
     * Updates the preview for the case when a property of the previewed item is no longer being edited
     * @param {String} name The name of the property that is no longer edited 
     */
    function handleStopEdit(name) {
        if (name === "bodies") {
            _showHitbox = false;
            _updateForHitboxState();
            preview.requestRender();
        }
    }
    // ----------------------------------------------------------------------
    // Initialization
    _previewContext = new preview.WebGLPreviewContext({
        renderModeSetting: true,
        lodSetting: true,
        canvasUpdateProperties: CANVAS_UPDATE_PROPERTIES,
        optionRefreshProperties: OPTION_REFRESH_PROPERIES
    }, {
        clear: _clear,
        load: _load,
        updateForRefresh: _updateForRefresh,
        clearSettingsForNewItem: _clearSettingsForNewItem,
        createOptions: _createOptions
    });
    // ----------------------------------------------------------------------
    // The public interface of the module
    return {
        refresh: refresh,
        handleDataChanged: preview.handleDataChanged,
        handleStartEdit: handleStartEdit,
        handleStopEdit: handleStopEdit
    };
});
