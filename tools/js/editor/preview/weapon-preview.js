/**
 * Copyright 2016-2017 Krisztián Nagy
 * @file Provides the setup and event-handling for the preview window used for spacecraft classes within the Interstellar Armada editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, document, window */
/*jslint white: true, nomen: true, plusplus: true */

/**
 * @param lights Used for creating the light sources for the preview scene
 * @param equipment Used to create the preview weapons
 * @param preview
 */
define([
    "modules/scene/lights",
    "armada/logic/equipment",
    "editor/preview/webgl-preview"
], function (lights, equipment, preview) {
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
             * The names of properties the change of which should trigger an update of the preview canvas
             * @type String[]
             */
            CANVAS_UPDATE_PROPERTIES = [
                "model", "shader", "texture",
                "defaultLuminosityFactors",
                "cooldown", "barrels" // to refresh info
            ],
            /**
             * The names of the properties the change of which should trigger a refresh of the preview options
             * @type String[]
             */
            OPTION_REFRESH_PROPERIES = [
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
             * Stores the WebGL preview context information for spacecraft class previews
             * @type WebGLPreviewContext
             */
            _previewContext;
    // ----------------------------------------------------------------------
    // Private Functions
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
                i;
        params = params || {};
        shouldReload = !params.preserve || params.reload;
        if (params.clearScene || shouldReload) {
            for (i = 0; i < LIGHT_SOURCES.length; i++) {
                preview.getScene().addDirectionalLightSource(new lights.DirectionalLightSource(LIGHT_SOURCES[i].color, LIGHT_SOURCES[i].direction));
            }
            if (shouldReload) {
                _weapon = new equipment.Weapon(_weaponClass);
                _wireframeWeapon = new equipment.Weapon(_weaponClass);
            }
            _weapon.addToScene(preview.getScene().getRootNode(), undefined, false,
                    {
                        orientationMatrix: orientationMatrix
                    },
                    shouldReload ?
                    function (model) {
                        preview.setModel(model);
                    } :
                    null);
            _wireframeWeapon.addToScene(preview.getScene().getRootNode(), undefined, true,
                    {
                        shaderName: preview.getWireframeShaderName(),
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
     * Resets the preview settings (those handled through the optionns, not the ones connected to the canvas) to their default values.
     * The settings that persist across different items are not reset.
     */
    function _clearSettingsForNewItem() {
        return true;
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
     * Currently does nothing, the model does not need to be changed when refreshed.
     */
    function _updateForRefresh() {
        return true;
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
                result += "range: " + _weapon.getRange() + " m";
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
     * @param {SpacecraftClass} spacecraftClass The spacecraft class to preview
     * @param {Editor~SpacecraftClassRefreshParams} params Additional parameters 
     */
    function refresh(elements, spacecraftClass, params) {
        var sameClass = (_weaponClass === spacecraftClass);

        preview.setContext(_previewContext);

        _weaponClass = spacecraftClass;
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
        canvasUpdateProperties: CANVAS_UPDATE_PROPERTIES,
        optionRefreshProperties: OPTION_REFRESH_PROPERIES
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
