/**
 * Copyright 2016, 2020-2022 Krisztián Nagy
 * @file Provides the setup and event-handling for the preview window used for projectile classes within the Interstellar Armada editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param lights Used for creating the light sources for the preview scene
 * @param equipment Used to create the preview projectiles
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
                "shader", "texture",
                "size", "intersectionPositions", "width"
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
            ],
            // ----------------------------------------------------------------------
            // Private variables
            /**
             * @type Projectile
             */
            _projectile,
            /**
             * A reference to the displayed projectile class
             * @type ProjectileClass
             */
            _projectileClass,
            /**
             * Stores the WebGL preview context information for projectile class previews
             * @type WebGLPreviewContext
             */
            _previewContext;
    // ----------------------------------------------------------------------
    // Private Functions
    /**
     * For the WebGL preview context.
     * Clears the object references of the currently stored projectile (if any)
     */
    function _clear() {
        if (_projectile) {
            _projectile.destroy();
            _projectile = null;
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
                _projectile = new equipment.Projectile(_projectileClass);
            }
            _projectile.addResourcesToScene(preview.getScene(), false);
            _projectile.addToScene(preview.getScene(), false, undefined, orientationMatrix, 0, function (model) {
                preview.setModel(model);
            });
        }
    }
    /**
     * For the WebGL preview context.
     * Resets the preview settings (those handled through the options, not the ones connected to the canvas) to their default values.
     * The settings that persist across different items are not reset.
     */
    function _clearSettingsForNewItem() {
        return true;
    }
    /**
     * For the WebGL preview context.
     * Creates the controls that form the content of the preview options and adds them to the page.
     * Currently does nothing, no preview options are yet implemented for projectile previews.
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
     * The handler for when the model is rotated by the user
     */
    function _onModelRotate() {
        _projectile.getVisualModel().updateDirection();
    }
    // ----------------------------------------------------------------------
    // Public Functions
    /**
     * The main function that sets up the preview window (both options and the preview canvas) for the editor to show the selected 
     * projectile class.
     * @param {Editor~RefreshElements} elements References to the HTML elements that can be used for the preview.
     * @param {ProjectileClass} projectileClass The projectile class to preview
     * @param {Editor~SpacecraftClassRefreshParams} params Additional parameters 
     */
    function refresh(elements, projectileClass, params) {
        var sameClass = (_projectileClass === projectileClass);

        preview.setContext(_previewContext);

        _projectileClass = projectileClass;
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
        renderModeSetting: false,
        lodSetting: false,
        canvasUpdateProperties: CANVAS_UPDATE_PROPERTIES,
        optionRefreshProperties: OPTION_REFRESH_PROPERIES,
        infoUpdateProperties: INFO_UPDATE_PROPERTIES,
        defaultDistanceFactor: 3
    }, {
        clear: _clear,
        load: _load,
        updateForRefresh: _updateForRefresh,
        clearSettingsForNewItem: _clearSettingsForNewItem,
        createOptions: _createOptions,
        onModelRotate: _onModelRotate
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
