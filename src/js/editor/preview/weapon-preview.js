/**
 * Copyright 2016-2021, 2023 Krisztián Nagy
 * @file Provides the setup and event-handling for the preview window used for weapon classes within the Interstellar Armada editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param renderableObjects Used for accessing uniform name constants
 * @param lights Used for creating the light sources for the preview scene
 * @param graphics Used to set graphics settings
 * @param equipment Used to create the preview weapons
 * @param preview
 */
define([
    "modules/scene/renderable-objects",
    "modules/scene/lights",
    "armada/graphics",
    "armada/logic/equipment",
    "editor/preview/webgl-preview"
], function (renderableObjects, lights, graphics, equipment, preview) {
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
            /**
             * The color used for barrel markers
             * @type Number[]
             */
            BARREL_MARKER_COLOR = [0.0, 0.5, 0.5, 1],
            /**
             * The color used for the currently edited barrel marker
             * @type Number[]
             */
            BARREL_MARKER_HIGHLIGHT_COLOR = [0.8, 0.4, 0.3, 1],
            /**
             * The scaling factor for barrel markers
             * @type Number
             */
            BARREL_MARKER_SIZE = 0.2,
            /**
             * The names of properties the change of which should trigger an update of the preview canvas
             * @type String[]
             */
            CANVAS_UPDATE_PROPERTIES = [
                "model", "shader", "texture",
                "defaultLuminosityFactors", "barrels"
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
                "cooldown", "projectileClass", "projectileVelocity"
            ],
            // ----------------------------------------------------------------------
            // Private variables
            /**
             * @type Weapon
             */
            _weapon, _wireframeWeapon,
            /**
             * A reference to the displayed weapon class
             * @type WeaponClass
             */
            _weaponClass,
            /**
             * Whether the barrel markers are currently visible
             * @type Boolean
             */
            _showBarrelMarkers,
            /**
             * Used to highlight the barrel marker that is currently being edited
             * @type Number
             */
            _highlightedBarrelMarkerIndex,
            /**
             * Stores the WebGL preview context information for weapon class previews
             * @type WebGLPreviewContext
             */
            _previewContext;
    // ----------------------------------------------------------------------
    // Private Functions
    /**
     * Returns the regular barrel marker color
     * @returns {Number[4]}
     */
    function _barrelMarkerColorFunction() {
        return BARREL_MARKER_COLOR;
    }
    /**
     * Returns the color to be used for the currently edited barrel marker
     * @returns {Number[4]}
     */
    function _highlightedBarrelMarkerColorFunction() {
        return BARREL_MARKER_HIGHLIGHT_COLOR;
    }
    /**
     * Sets the appropriate barrel marker visibility and colors for the current settings
     */
    function _updateForBarrelMarkerState() {
        var i, node, nodes = _weapon.getBarrelMarkers().getSubnodes();
        if (_showBarrelMarkers) {
            i = 0;
            for (node = nodes.getFirst(); node; node = node.next, i++) {
                node.getRenderableObject().setUniformValueFunction(renderableObjects.UNIFORM_COLOR_NAME, (i === _highlightedBarrelMarkerIndex) ?
                        _highlightedBarrelMarkerColorFunction :
                        _barrelMarkerColorFunction);
            }
            _weapon.getBarrelMarkers().show();
        } else {
            _weapon.getBarrelMarkers().hide();
        }
    }
    /**
     * For the WebGL preview context.
     * Clears the object references of the currently stored weapon (if any)
     */
    function _clear() {
        if (_weapon) {
            _weapon.destroy();
            _weapon = null;
            _wireframeWeapon.destroy();
            _wireframeWeapon = null;
        }
    }
    /**
     * For the WebGL preview context.
     * Updates the content of the preview canvas according to the current preview settings
     * @param {Editor~RefreshParams} params
     * @param {Float32Array} orientationMatrix
     */
    function _load(params, orientationMatrix) {
        var
                shouldReload,
                shadows,
                i;
        params = params || {};
        shouldReload = !params.preserve || params.reload;
        if (params.clearScene || shouldReload) {
            shadows = graphics.isShadowMappingEnabled();
            preview.getScene().setClearColor([0, 0, 0, 1]);
            preview.getScene().setAmbientColor([0, 0, 0]);
            for (i = 0; i < LIGHT_SOURCES.length; i++) {
                preview.getScene().addDirectionalLightSource(new lights.DirectionalLightSource(LIGHT_SOURCES[i].color, LIGHT_SOURCES[i].direction));
            }
            graphics.setShadowMapping();
            if (shadows !== graphics.isShadowMappingEnabled()) {
                graphics.handleSettingsChanged();
                shouldReload = true;
            }
            if (shouldReload) {
                _weapon = new equipment.Weapon(_weaponClass);
                _wireframeWeapon = new equipment.Weapon(_weaponClass);
            }
            _weapon.addToScene(preview.getScene().getRootNode(), undefined, false,
                    {
                        projectileResources: false,
                        sound: false,
                        orientationMatrix: orientationMatrix,
                        barrelMarkers: true,
                        barrelMarkerSize: BARREL_MARKER_SIZE,
                        barrelMarkerShaderName: preview.getWireframeShaderName()
                    },
                    shouldReload ?
                    function (model) {
                        preview.setModel(model);
                    } :
                    null);
            _wireframeWeapon.addToScene(preview.getScene().getRootNode(), undefined, true,
                    {
                        shaderName: preview.getWireframeShaderName(),
                        projectileResources: false,
                        sound: false,
                        orientationMatrix: orientationMatrix
                    },
                    shouldReload ?
                    function (model) {
                        preview.setWireframeModel(model);
                    } :
                    null);
        }
    }
    /**
     * For the WebGL preview context.
     * Resets the preview settings (those handled through the options, not the ones connected to the canvas) to their default values.
     * The settings that persist across different items are not reset.
     */
    function _clearSettingsForNewItem() {
        _showBarrelMarkers = false;
    }
    /**
     * For the WebGL preview context.
     * Creates the controls that form the content of the preview options and adds them to the page.
     * Currently does nothing, no preview options are yet implemented for weapon previews.
     */
    function _createOptions() {
        return true;
    }
    /**
     * For the WebGL preview context.
     */
    function _updateForRefresh() {
        _updateForBarrelMarkerState();
    }
    /**
     * Returns additional information to be displayed in the info section of the preview
     * @returns {String}
     */
    function _getInfo() {
        var result, value, valueDrop;
        result = "";
        if (_weapon) {
            value = _weapon.getDamage();
            if (value > 0) {
                result = "Weapon: ";
                valueDrop = value - _weapon.getDamage(1);
                result += "damage: " + (Math.round(value * 100) / 100) + " (-" + (Math.round(valueDrop * 100) / 100) + " / arm.), ";
                value = _weapon.getFirepower();
                valueDrop = value - _weapon.getFirepower(1);
                result += "firepower: " + (Math.round(value * 100) / 100) + " (-" + (Math.round(valueDrop * 100) / 100) + " / arm.), ";
                result += "fire rate: " + (Math.round(_weapon.getFireRate() * 100) / 100) + " / s, ";
                result += "range: " + _weapon.getRange(0) + " m";
            }
        }
        return result;
    }
    // ----------------------------------------------------------------------
    // Public Functions
    /**
     * The main function that sets up the preview window (both options and the preview canvas) for the editor to show the selected 
     * weapon class.
     * @param {Editor~RefreshElements} elements References to the HTML elements that can be used for the preview.
     * @param {WeaponClass} weaponClass The weapon class to preview
     * @param {Editor~SpacecraftClassRefreshParams} params Additional parameters 
     */
    function refresh(elements, weaponClass, params) {
        var sameClass = (_weaponClass === weaponClass);

        preview.setContext(_previewContext);

        _weaponClass = weaponClass;
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
        if (name === "barrels") {
            _showBarrelMarkers = true;
            _highlightedBarrelMarkerIndex = index;
            _updateForBarrelMarkerState();
            preview.requestRender();
        }
    }
    /**
     * Updates the preview for the case when a property of the previewed item is no longer being edited
     * @param {String} name The name of the property that is no longer edited 
     */
    function handleStopEdit(name) {
        if (name === "barrels") {
            _showBarrelMarkers = false;
            _updateForBarrelMarkerState();
            preview.requestRender();
        }
    }
    // ----------------------------------------------------------------------
    // Initialization
    _previewContext = new preview.WebGLPreviewContext({
        renderModeSetting: true,
        lodSetting: true,
        canvasUpdateProperties: CANVAS_UPDATE_PROPERTIES,
        optionRefreshProperties: OPTION_REFRESH_PROPERIES,
        infoUpdateProperties: INFO_UPDATE_PROPERTIES
    }, {
        clear: _clear,
        load: _load,
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
