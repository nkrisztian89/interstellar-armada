/**
 * Copyright 2016, 2020-2021 Krisztián Nagy
 * @file Provides the setup and event-handling for the preview window used for background object classes within the Interstellar Armada editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param environments Used to create the background object
 * @param preview Used for common WebGL preview functionality
 */
define([
    "armada/logic/environments",
    "editor/preview/webgl-preview"
], function (environments, preview) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // Constants
            /**
             * The names of properties the change of which should trigger an update of the preview canvas
             * @type String[]
             */
            CANVAS_UPDATE_PROPERTIES = [
                "layers"
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
             * An instance to preview the currently selected background object class
             * @type BackgroundObject
             */
            _backgroundObject,
            /**
             * A reference to the displayed background object class
             * @type BackgroundObjectClass
             */
            _backgroundObjectClass,
            /**
             * Stores the WebGL preview context information for background object class previews
             * @type WebGLPreviewContext
             */
            _previewContext;
    // ----------------------------------------------------------------------
    // Private Functions
    /**
     * For the functions.clear property of the preview context
     */
    function _clear() {
        if (_backgroundObject) {
            _backgroundObject.destroy();
            _backgroundObject = null;
        }
    }
    /**
     * For the functions.load property of the preview context
     * @param {Editor~RefreshParams} params
     */
    function _load(params) {
        var
                shouldReload;
        params = params || {};
        shouldReload = !params.preserve || params.reload;
        if (shouldReload) {
            _backgroundObject = new environments.BackgroundObject(_backgroundObjectClass, 600, 0, -90, 180);
        }
        _backgroundObject.addToScene(preview.getScene(), true);
    }
    /**
     * For the functions.clearSettingsForNewItem property of the preview context
     */
    function _clearSettingsForNewItem() {
        return true;
    }
    /**
     * For the functions.createOptions property of the preview context
     */
    function _createOptions() {
        return true;
    }
    /**
     * For the functions.updateForRefresh property of the preview context
     */
    function _updateForRefresh() {
        return true;
    }
    // ----------------------------------------------------------------------
    // Public Functions
    /**
     * The main function that sets up the preview window (both options and the preview canvas) for the editor to show the selected 
     * background object class.
     * @param {Editor~RefreshElements} elements References to the HTML elements that can be used for the preview.
     * @param {SpacecraftClass} backgroundObjectClass The background object class to preview
     * @param {Editor~RefreshParams} params Additional parameters 
     */
    function refresh(elements, backgroundObjectClass, params) {
        var sameClass = (_backgroundObjectClass === backgroundObjectClass);
        preview.setContext(_previewContext);
        _backgroundObjectClass = backgroundObjectClass;
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
     * Called from outside
     */
    function handleStartEdit() {
        return true;
    }
    /**
     * Called from outside
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
        infoUpdateProperties: INFO_UPDATE_PROPERTIES
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
        clear: preview.clear,
        handleDataChanged: preview.handleDataChanged,
        handleStartEdit: handleStartEdit,
        handleStopEdit: handleStopEdit
    };
});
