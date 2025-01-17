/**
 * Copyright 2020-2025 Krisztián Nagy
 * @file Provides the setup and event-handling for the preview window used for missions within the Interstellar Armada editor.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils
 * @param vec
 * @param mat
 * @param resources
 * @param camera
 * @param renderableObjects
 * @param common
 * @param preview
 */
define([
    "utils/utils",
    "utils/vectors",
    "utils/matrices",
    "modules/media-resources",
    "modules/scene/camera",
    "modules/scene/renderable-objects",
    "editor/common",
    "editor/preview/webgl-preview"
], function (utils, vec, mat, resources, camera, renderableObjects, common, preview) {
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
                "teams",
                "spacecrafts",
                "events"
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
             * Position markers for spacecrafts are rendered with this color in the mission preview,
             * if the spacecraft has a positive Z coordinate
             * @type Number[4]
             */
            MARKER_COLOR_POSITIVE = [1, 1, 0, 0.25],
            /** 
             * Position markers for spacecrafts are rendered with this color in the mission preview,
             * if the spacecraft has a negative Z coordinate
             * @type Number[4]
             */
            MARKER_COLOR_NEGATIVE = [1, 0.5, 0, 0.25],
            /**
             * Jump markers (lines from the anchor to the spacecraft) are rendered with this color in the mission preview
             * @type Number[4]
             */
            JUMP_MARKER_COLOR = [0.4, 0.7, 1.0, 0.5],
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
             * Selected friendly spacecrafts are rendered with this color in the mission preview
             * @type Number[4]
             */
            FRIENDLY_HIGHTLIGHTED_COLOR = [0.75, 1, 0.75, 1],
            /** 
             * Selected hostile spacecrafts are rendered with this color in the mission preview
             * @type Number[4]
             */
            HOSTILE_HIGHTLIGHTED_COLOR = [1, 0.75, 0.75, 1],
            /** 
             * Spacecrafts are rendered when their visible size reaches minimum this number
             * @type Number 
             */
            SMALLEST_SIZE_WHEN_DRAWN = 0.1,
            /**
             * When checking if we are hovering over a spacecraft with the cursor, the boundaries of the spacecraft
             * will be extended by this offset (in meters)
             * @type Number
             */
            SPACECRAFT_HOVER_OFFSET = 1,
            /**
             * The tooltip will be displayed offset to the right by this amount relative to the cursor
             * @type Number
             */
            TOOLTIP_OFFSET_X = 10,
            /**
             * The tooltip will be displayed offset downwards by this amount relative to the cursor
             * @type Number
             */
            TOOLTIP_OFFSET_Y = 10,
            /**
             * A star character that marks the player ship
             * @type String
             */
            PLAYER_SHIP_STAR = "★",
            // ----------------------------------------------------------------------
            // Private variables
            /**
             * A reference to the object storing the HTML elements to be used for the preview
             * @type Object
             */
            _elements,
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
            _previewContext,
            /**
             * The value of the setting of whether the grids should be visible in the preview
             * @type Boolean
             */
            _gridVisible = true,
            /**
             * The value of the setting of whether the markers should be visible in the preview
             * @type Boolean
             */
            _markersVisible = true,
            /**
             * The value of the setting of whether the environment should be visible in the preview
             * @type Boolean
             */
            _environmentVisible = true,
            /**
             * The value of the setting of whether the spacecraft models should be visible with textures in the preview
             * @type Boolean
             */
            _texturedSpacecraftsVisible = false,
            /**
             * The index of the currently edited spacecraft entry from the mission
             * descriptor JSON
             * @type Number
             */
            _selectedSpacecraftIndex,
            /**
             * The index of the spacecraft entry highlighted by hovering the mouse
             * cursor over one of the spacecrafts belonging to it
             * @type Number
             */
            _highlightedSpacecraftIndex,
            /**
             * A reusable array to pass color values to uniforms
             * @type Number[4]
             */
            _color = [0, 0, 0, 0],
            /**
             * The index of the spacecraft for which the tooltip is currently shown
             * @type Number
             */
            _tooltipSpacecraftIndex,
            /**
             * A reference to the HTML element used to show the tooltip
             * @type HTMLDivElement
             */
            _tooltip;
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
     * @param {Number[4]} color
     * @param {Number} colorFactor
     * @param {Number} alphaFactor
     * @returns {Number[4]}
     */
    function _getColor(color, colorFactor, alphaFactor) {
        _color[0] = colorFactor * color[0];
        _color[1] = colorFactor * color[1];
        _color[2] = colorFactor * color[2];
        _color[3] = alphaFactor * color[3];
        return _color;
    }
    /**
     * Returns the color the passed spacecraft should be rendered with in the preview (if not selected)
     * @param {Spacecraft} spacecraft
     * @returns {Number[4]}
     */
    function _spacecraftColorFunction(spacecraft) {
        var
                color = (_mission.getPilotedSpacecraft() && _mission.getPilotedSpacecraft().isHostile(spacecraft)) ? HOSTILE_COLOR : FRIENDLY_COLOR,
                colorFactor = spacecraft.isAway() ? AWAY_COLOR_FACTOR : 1,
                alphaFactor = spacecraft.isAway() ? AWAY_ALPHA_FACTOR : 1;
        return _getColor(color, colorFactor, alphaFactor);
    }
    /**
     * Returns the color the passed spacecraft should be rendered with in the preview if selected
     * @param {Spacecraft} spacecraft
     * @returns {Number[4]}
     */
    function _highlightedSpacecraftColorFunction(spacecraft) {
        var
                color = (_mission.getPilotedSpacecraft() && _mission.getPilotedSpacecraft().isHostile(spacecraft)) ? HOSTILE_HIGHTLIGHTED_COLOR : FRIENDLY_HIGHTLIGHTED_COLOR,
                colorFactor = spacecraft.isAway() ? AWAY_COLOR_FACTOR : 1,
                alphaFactor = spacecraft.isAway() ? AWAY_ALPHA_FACTOR : 1;
        return _getColor(color, colorFactor, alphaFactor);
    }
    /**
     * Returns the index of the spacecraft descriptor entry that corresponds to the spacecraft with
     * the passed index within the mission's spacecraft array
     * @param {Number} index
     * @returns {Number}
     */
    function _getDescriptorIndexForSpacecraft(index) {
        var i, currentIndex, spacecraftData = _mission.getData().spacecrafts;
        currentIndex = 0;
        for (i = 0; i < spacecraftData.length; i++) {
            if (index < currentIndex + (spacecraftData[i].count || 1)) {
                return i;
            }
            currentIndex += (spacecraftData[i].count || 1);
        }
        return -1;
    }
    /**
     * Update the preview for the current option settings
     */
    function _updateForOptions() {
        _mission.setGridVisibility(_gridVisible);
        _mission.setMarkerVisibility(_markersVisible);
        _mission.setEnvironmentVisibility(_environmentVisible);
    }
    /**
     * Update the preview for the current spacecraft selection (and highlight)
     */
    function _updateForSpacecraftSelection() {
        var i, startIndex, endIndex, highlightStartIndex, highlightEndIndex, spacecraftData = _mission.getData().spacecrafts, spacecrafts = _mission.getSpacecrafts();
        if (_selectedSpacecraftIndex >= 0) {
            startIndex = 0;
            for (i = 0; i < _selectedSpacecraftIndex; i++) {
                startIndex += (spacecraftData[i].count || 1);
            }
            endIndex = startIndex + (spacecraftData[i].count || 1);
        } else {
            startIndex = -1;
            endIndex = -1;
        }
        if (_highlightedSpacecraftIndex >= 0) {
            highlightStartIndex = 0;
            for (i = 0; i < _highlightedSpacecraftIndex; i++) {
                highlightStartIndex += (spacecraftData[i].count || 1);
            }
            highlightEndIndex = highlightStartIndex + (spacecraftData[i].count || 1);
        } else {
            highlightStartIndex = -1;
            highlightEndIndex = -1;
        }
        for (i = 0; i < spacecrafts.length; i++) {
            spacecrafts[i].getVisualModel().setUniformValueFunction(renderableObjects.UNIFORM_COLOR_NAME, (((i >= startIndex) && (i < endIndex)) || ((i >= highlightStartIndex) && (i < highlightEndIndex))) ?
                    _highlightedSpacecraftColorFunction.bind(this, spacecrafts[i]) :
                    _spacecraftColorFunction.bind(this, spacecrafts[i]));
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
                _mission = _missionDescriptor.createMission({difficulty: DIFFICULTY});
                preview.setMission(_mission);
            }
            _mission.addToScene(preview.getScene(), null, {
                spacecraftShaderName: SPACECRAFT_SHADER_NAME,
                showTexturedSpacecrafts: _texturedSpacecraftsVisible,
                gridShaderName: GRID_SHADER_NAME,
                markerShaderName: MARKER_SHADER_NAME,
                gridColor: GRID_COLOR,
                gridCount: GRID_COUNT,
                smallestGridSize: SMALLEST_GRID_SIZE,
                markerColorPositive: MARKER_COLOR_POSITIVE,
                markerColorNegative: MARKER_COLOR_NEGATIVE,
                markerSize: MARKER_SIZE,
                jumpMarkerColor: JUMP_MARKER_COLOR,
                friendlyColor: FRIENDLY_COLOR,
                hostileColor: HOSTILE_COLOR,
                smallestSizeWhenDrawn: SMALLEST_SIZE_WHEN_DRAWN,
                awayColorFactor: AWAY_COLOR_FACTOR,
                awayAlphaFactor: AWAY_ALPHA_FACTOR,
                callback: function () {
                    _updateForOptions();
                    _updateForSpacecraftSelection();
                }
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
        _elements.options.appendChild(common.createSetting(common.createBooleanInput(_gridVisible, function (value) {
            _gridVisible = value;
            _mission.setGridVisibility(_gridVisible);
            preview.requestRender();
        }), "Show grid: "));
        _elements.options.appendChild(common.createSetting(common.createBooleanInput(_markersVisible, function (value) {
            _markersVisible = value;
            _mission.setMarkerVisibility(_markersVisible);
            preview.requestRender();
        }), "Show markers: "));
        _elements.options.appendChild(common.createSetting(common.createBooleanInput(_environmentVisible, function (value) {
            _environmentVisible = value;
            _mission.setEnvironmentVisibility(_environmentVisible);
            preview.requestRender();
        }), "Show environment: "));
        _elements.options.appendChild(common.createSetting(common.createBooleanInput(_texturedSpacecraftsVisible, function (value) {
            _texturedSpacecraftsVisible = value;
            preview.refresh(_elements, {preserve: true, reload: true, clearScene: true});
        }), "Show textures: "));
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
                result += ", " + PLAYER_SHIP_STAR + " Player ship: " + (pilotedCraft.getDisplayName() || ("unnamed " + pilotedCraft.getClass().getDisplayName()));
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
    /**
     * Called when the mouse cursor is moved - highlights the spacecrafts we are hovering over
     * @param {MouseEvent} event
     * @param {Float32Array} cameraPositionMatrix
     * @param {Number[3]} direction The 3D direction in which we are pointing with the cursor (from camera focus point towards the 3D position of the cursor)
     * @returns {Boolean} Whether we should trigger a re-rendering of the preview
     */
    function _onMouseMove(event, cameraPositionMatrix, direction) {
        var i, spacecrafts, spacecraft, hit, distance, range, matrix, hitIndex = -1, hitDistance = 0, index, offset;
        spacecrafts = _mission.getSpacecrafts();
        range = preview.FREE_CAMERA_VIEW_DISTANCE * camera.CAMERA_EXTENSION_FACTOR;
        offset = SPACECRAFT_HOVER_OFFSET;
        matrix = mat.translation4(
                cameraPositionMatrix[12] + direction[0] * range,
                cameraPositionMatrix[13] + direction[1] * range,
                cameraPositionMatrix[14] + direction[2] * range);
        for (i = 0; i < spacecrafts.length; i++) {
            spacecraft = spacecrafts[i];
            if (!spacecraft.isAway() || (spacecraft.getPhysicalPositionMatrix()[12] !== 0) || (spacecraft.getPhysicalPositionMatrix()[13] !== 0) || (spacecraft.getPhysicalPositionMatrix()[14] !== 0)) {
                hit = spacecraft.getPhysicalModel().checkHit(matrix, mat.translation4v(vec.scaled3(direction, range)), 1000, offset);
                if (hit) {
                    distance = vec.dot3(vec.diff3Aux(spacecraft.getPhysicalPositionVector(), mat.translationVector3(cameraPositionMatrix)), direction);
                    if ((hitIndex < 0) || (distance < hitDistance)) {
                        hitIndex = i;
                        hitDistance = distance;
                    }
                }
            }
        }
        if (hitIndex !== _tooltipSpacecraftIndex) {
            if (hitIndex >= 0) {
                _tooltip.textContent = spacecrafts[hitIndex].getDisplayName() || spacecrafts[hitIndex].getClass().getDisplayName();
                _tooltip.textContent += (spacecrafts[hitIndex] === _mission.getPilotedSpacecraft()) ? " " + PLAYER_SHIP_STAR : "";
                _tooltip.hidden = false;
            } else {
                _tooltip.hidden = true;
            }
            _tooltipSpacecraftIndex = hitIndex;
        }
        _tooltip.style.left = (event.clientX + TOOLTIP_OFFSET_X) + "px";
        _tooltip.style.top = (event.clientY + TOOLTIP_OFFSET_Y) + "px";
        index = (hitIndex >= 0) ? _getDescriptorIndexForSpacecraft(hitIndex) : -1;
        if (_highlightedSpacecraftIndex !== index) {
            _highlightedSpacecraftIndex = index;
            resources.executeWhenReady(function () {
                _updateForSpacecraftSelection();
                preview.requestRender();
            });
        }
        return false;
    }
    /**
     * Called when we click on the preview canvas (but not when releasing the mouse button after turning the camera)
     * @param {MouseEvent} event
     */
    function _onClick(event) {
        if (event.which === utils.MouseButton.LEFT) {
            preview.editProperty("spacecrafts", _highlightedSpacecraftIndex);
        }
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
        _tooltip = elements.tooltip;
        _elements = elements;
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
     * @param {String} name The name of the property that is edited (under which the editing is happening)
     * @param {Number} [index] If the property is an array, this is the index of the element in the array being edited
     */
    function handleStartEdit(name, index) {
        if ((name === "spacecrafts") && _mission.getData().spacecrafts && (_mission.getData().spacecrafts.length > 0)) {
            resources.executeWhenReady(function () {
                _selectedSpacecraftIndex = index;
                _updateForSpacecraftSelection();
                preview.requestRender();
            });
        }
    }
    /**
     * Updates the preview for the case when a property of the previewed item is no longer being edited
     * @param {String} name The name of the property that is no longer edited 
     */
    function handleStopEdit(name) {
        if (name === "spacecrafts") {
            _selectedSpacecraftIndex = -1;
            _updateForSpacecraftSelection();
            preview.requestRender();
        }
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
        createOptions: _createOptions,
        onMouseMove: _onMouseMove,
        onClick: _onClick
    });
    // ----------------------------------------------------------------------
    // The public interface of the module
    return {
        refresh: refresh,
        clear: preview.clear,
        handleDataChanged: preview.handleDataChanged,
        handleStartEdit: handleStartEdit,
        handleStopEdit: handleStopEdit,
        setEditProperty: preview.setEditProperty
    };
});
