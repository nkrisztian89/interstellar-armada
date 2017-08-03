/**
 * Copyright 2016 Krisztián Nagy
 * @file Provides the setup and event-handling for the preview window used for explosion classes within the Interstellar Armada editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, document, window */
/*jslint white: true, nomen: true, plusplus: true */

/**
 * @param mat Used for creating identity matrices
 * @param pools Used for displaying info about the particle pool state
 * @param renderableObjects Used to access the pool for particles
 * @param lights Used for creating the light sources for the preview scene
 * @param explosion Used to create the preview explosions
 * @param common Used for creating option elements
 * @param preview This module is based on the common WebGL preview module
 */
define([
    "utils/matrices",
    "modules/pools",
    "modules/scene/renderable-objects",
    "modules/scene/lights",
    "armada/logic/explosion",
    "editor/common",
    "editor/preview/webgl-preview"
], function (mat, pools, renderableObjects, lights, explosion, common, preview) {
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
                "particleEmitters",
                "lightStates",
                "soundEffect"
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
             * @type Pool
             */
            _particlePool,
            /**
             * A reference to the object storing the HTML elements to be used for the preview
             * @type Object
             */
            _elements,
            /**
             * @type Explosion
             */
            _explosion,
            /**
             * A reference to the displayed explosion class
             * @type ExplosionClass
             */
            _explosionClass,
            /**
             * Stores the WebGL preview context information for explosion class previews
             * @type WebGLPreviewContext
             */
            _previewContext,
            /**
             * 
             * @type Object
             */
            _optionElements = {
                restartButton: null
            };
    // ----------------------------------------------------------------------
    // Private Functions
    /**
     * For the WebGL preview context.
     * Clears the object references of the currently stored explosion (if any)
     */
    function _clear() {
        if (_explosion) {
            _explosion.destroy();
            _explosion = null;
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
                _explosion = new explosion.Explosion(_explosionClass, mat.identity4(), orientationMatrix, [0, 1, 0], true, mat.identity4());
            }
            _explosion.addResourcesToScene(preview.getScene(), false);
            _explosion.addToScene(preview.getScene().getRootNode(), null, false, function (model) {
                preview.setModel(model);
            });
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
     */
    function _createOptions() {
        // explode button
        _optionElements.restartButton = common.createButton("Restart", function () {
            _explosion.getVisualModel().getNode().markAsReusable(true);
            _explosion.addToScene(preview.getScene().getRootNode(), null, false, function (model) {
                preview.setModel(model);
            });
            preview.startAnimating();
        });
        _elements.options.appendChild(preview.createSetting(_optionElements.restartButton));
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
     * For the WebGL preview context.
     * Returns the info (particle count and particle pool state) to be added to the info panel
     */
    function _getInfo() {
        var explosionNode = _explosion && _explosion.getVisualModel() && _explosion.getVisualModel().getNode();
        return (explosionNode ? ("Particles: " + (!explosionNode.canBeReused() ? explosionNode.getSubnodes().getLength() : "0") + ", ") : "") +
                "Pool: " + _particlePool.getLockedObjectCount() + "/" + _particlePool.getObjects().length;
    }
    // ----------------------------------------------------------------------
    // Public Functions
    /**
     * The main function that sets up the preview window (both options and the preview canvas) for the editor to show the selected 
     * explosion class.
     * @param {Editor~RefreshElements} elements References to the HTML elements that can be used for the preview.
     * @param {ExplosionClass} explosionClass The explosion class to preview
     * @param {Editor~RefreshParams} params Additional parameters 
     */
    function refresh(elements, explosionClass, params) {
        var sameClass = (_explosionClass === explosionClass);

        preview.setContext(_previewContext);

        _elements = elements;
        _explosionClass = explosionClass;
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
        animateButton: true,
        animateOnRefresh: true,
        muteCheckbox: true,
        canvasUpdateProperties: CANVAS_UPDATE_PROPERTIES,
        optionRefreshProperties: OPTION_REFRESH_PROPERIES,
        defaultDistanceFactor: 2
    }, {
        clear: _clear,
        load: _load,
        updateForRefresh: _updateForRefresh,
        clearSettingsForNewItem: _clearSettingsForNewItem,
        createOptions: _createOptions,
        getInfo: _getInfo
    });
    // initializazion
    // obtaining pool references
    _particlePool = pools.getPool(renderableObjects.Particle);
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
