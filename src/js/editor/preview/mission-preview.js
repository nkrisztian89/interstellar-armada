/**
 * Copyright 2020 Krisztián Nagy
 * @file Provides the setup and event-handling for the preview window used for missions within the Interstellar Armada editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, document, window */

/**
 * @param preview
 */
define([
    "editor/preview/webgl-preview"
], function (preview) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // Constants
            /**
             * The names of properties the change of which should trigger an update of the preview canvas
             * @type String[]
             */
            CANVAS_UPDATE_PROPERTIES = [
                "environment",
                "spacecrafts"
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
                "events"
            ],
            /** 
             * The mission is loaded on this difficulty for the preview
             * @type String 
             * */
            DIFFICULTY = "hard",
            /**
             * The spacecrafts in the mission preview are rendered with this shader
             * @type String
             */
            SPACECRAFT_SHADER_NAME = "oneColor",
            /**
             * The grids in the mission preview are rendered with this shader
             * @type String
             */
            GRID_SHADER_NAME = "oneColor",
            /**
             * The position markers in the mission preview are rendered with this shader
             * @type String
             */
            MARKER_SHADER_NAME = "oneColor",
            /**
             * The number of grids (increasing in size) to add to the mission preview scene
             * @type Number
             */
            GRID_COUNT = 4,
            /**
             * The size of the smallest grid to add, in meters
             * @type Number
             */
            SMALLEST_GRID_SIZE = 10,
            /**
             * The size (radius) of the circle part of the position markers
             * @type Number
             */
            MARKER_SIZE = 10,
            /**
             * The RGB color components of spacecrafts that are away will be multiplied by this factor
             * @type String
             */
            AWAY_COLOR_FACTOR = 0.5,
            /**
             * The alpha color component of spacecrafts that are away will be multiplied by this factor
             * @type String
             */
            AWAY_ALPHA_FACTOR = 0.1,
            /** 
             * Grids are rendered with this color in the mission preview
             * @type Number[4]
             */
            GRID_COLOR = [1, 1, 1, 0.1],
            /** 
             * Position markers for spacecrafts are rendered with this color in the mission preview
             * @type Number[4]
             */
            MARKER_COLOR = [1, 1, 0, 0.25],
            /** 
             * Friendly spacecrafts are rendered with this color in the mission preview
             * @type Number[4]
             */
            FRIENDLY_COLOR = [0, 1, 0, 1],
            /** 
             * Hostile spacecrafts are rendered with this color in the mission preview
             * @type Number[4]
             */
            HOSTILE_COLOR = [1, 0, 0, 1],
            /** 
             * Spacecrafts are rendered when their visible size reaches minimum this number
             * @type Number 
             */
            SMALLEST_SIZE_WHEN_DRAWN = 0.1,
            // ----------------------------------------------------------------------
            // Private variables
            /**
             * @type MissionDescriptor
             */
            _missionDescriptor,
            /**
             * @type Mission
             */
            _mission,
            /**
             * Stores the WebGL preview context information for mission previews
             * @type WebGLPreviewContext
             */
            _previewContext;
    // ----------------------------------------------------------------------
    // Private Functions
    /**
     * For the WebGL preview context.
     * Clears the object references of the currently stored mission (if any)
     */
    function _clear() {
        if (_mission) {
            _mission.destroy();
            _mission = null;
        }
    }
    /**
     * For the WebGL preview context.
     * Updates the content of the preview canvas according to the current preview settings
     * @param {Editor~RefreshParams} params
     */
    function _load(params) {
        var shouldReload;
        params = params || {};
        shouldReload = !params.preserve || params.reload;
        if (params.clearScene || shouldReload) {
            if (shouldReload) {
                _mission = _missionDescriptor.createMission(DIFFICULTY);
            }
            _mission.addToScene(preview.getScene(), null, {
                spacecraftShaderName: SPACECRAFT_SHADER_NAME,
                gridShaderName: GRID_SHADER_NAME,
                markerShaderName: MARKER_SHADER_NAME,
                gridColor: GRID_COLOR,
                gridCount: GRID_COUNT,
                smallestGridSize: SMALLEST_GRID_SIZE,
                markerColor: MARKER_COLOR,
                markerSize: MARKER_SIZE,
                friendlyColor: FRIENDLY_COLOR,
                hostileColor: HOSTILE_COLOR,
                smallestSizeWhenDrawn: SMALLEST_SIZE_WHEN_DRAWN,
                awayColorFactor: AWAY_COLOR_FACTOR,
                awayAlphaFactor: AWAY_ALPHA_FACTOR
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
     * Currently does nothing, no preview options are yet implemented for mission previews.
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
        var result, performanceLevelScores, performanceLevels, spacecrafts, pilotedCraft, i, friendlyPresent = 0, friendlyTotal = 0, hostilePresent = 0, hostileTotal = 0;
        result = "";
        if (_mission) {
            result = '<span class="objectives">[show objectives]<div class="objectives popup">' + _missionDescriptor.getMissionObjectives().join('<br>') + '</div></span>';
            performanceLevelScores = _mission.getPerformanceLevelScores();
            performanceLevels = Object.keys(performanceLevelScores);
            result += "  Score requirements:";
            for (i = 0; i < performanceLevels.length; i++) {
                if (performanceLevelScores[performanceLevels[i]] > 0) {
                    result += " " + performanceLevels[i] + ": " + performanceLevelScores[performanceLevels[i]];
                }
            }
            spacecrafts = _mission.getSpacecrafts();
            pilotedCraft = _mission.getPilotedSpacecraft();
            if (pilotedCraft) {
                result += ", Player ship: " + (pilotedCraft.getDisplayName() || ("unnamed " + pilotedCraft.getClass().getDisplayName()));
            }
            for (i = 0; i < spacecrafts.length; i++) {
                if (pilotedCraft && spacecrafts[i].isHostile(pilotedCraft)) {
                    if (!spacecrafts[i].isAway()) {
                        hostilePresent++;
                    }
                    hostileTotal++;
                } else {
                    if (!spacecrafts[i].isAway()) {
                        friendlyPresent++;
                    }
                    friendlyTotal++;
                }
            }
            if (pilotedCraft) {
                result += ", friendlies: " + friendlyPresent + " / " + friendlyTotal + ", hostiles: " + hostilePresent + " / " + hostileTotal;
            } else {
                result += ", spacecrafts: " + friendlyPresent + " / " + friendlyTotal;
            }
        }
        return result;
    }
    // ----------------------------------------------------------------------
    // Public Functions
    /**
     * The main function that sets up the preview window (both options and the preview canvas) for the editor to show the selected 
     * mission.
     * @param {Editor~RefreshElements} elements References to the HTML elements that can be used for the preview.
     * @param {MissionDescriptor} missionDescriptor The descriptor of the mission to preview
     * @param {Editor~RefreshParams} params Additional parameters 
     */
    function refresh(elements, missionDescriptor, params) {
        var sameClass = (_missionDescriptor === missionDescriptor);

        preview.setContext(_previewContext);

        _missionDescriptor = missionDescriptor;
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
